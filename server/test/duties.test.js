import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { test } from 'node:test'
import pg from 'pg'
import { createApp } from '../src/app.js'
import { createUserStore, migrate } from '../src/db.js'
import { createDutyStore } from '../src/dutyStore.js'
import { dutyInput } from '../src/duties.js'

const range = '?start=2026-11-22T16:00:00.000Z&end=2026-11-29T16:00:00.000Z'
const fields = {
  title: 'Inspect pump room', description: 'Operational notes', category: 'Inspection',
  durationMinutes: 45, deadline: '2026-11-27T09:00:00.000Z', location: 'Block 101',
  factors: { service: 'Restore reliable water pressure' }, remarks: 'Internal remarks',
}
const fixed = {
  ...fields, title: 'Check lift controls', type: 'fixed',
  startAt: '2026-11-23T02:00:00.000Z', endAt: '2026-11-23T02:45:00.000Z',
}

test('duty validation keeps types, real UTC dates and known factors explicit', () => {
  const officerId = randomUUID()
  const flexible = { ...fields, officerId, type: 'flexible' }
  assert.deepEqual(dutyInput({ ...flexible, factors: { safety: 'Recorded hazard', score: 42 } }).factors, {
    service: '', safety: 'Recorded hazard', residents: '', concern: '',
  })
  assert.throws(() => dutyInput({ ...flexible, startAt: fixed.startAt }), /cannot have/)
  assert.throws(() => dutyInput({ ...fixed, officerId, endAt: fixed.startAt }), /after start/)
  assert.throws(() => dutyInput({ ...fixed, officerId, deadline: '2026-02-31T02:00:00.000Z' }), /UTC timestamp/)
  assert.throws(() => dutyInput({ ...flexible, shareLocation: 'true' }), /location is shared/)
})

const databaseUrl = process.env.SYNCAI_TEST_DATABASE_URL
test('PostgreSQL duties persist, enforce team scope and protect against stale writes', { skip: !databaseUrl }, async (t) => {
  const admin = new pg.Pool({ connectionString: databaseUrl })
  const schema = 'planning_test_' + randomUUID().replaceAll('-', '')
  await admin.query('CREATE SCHEMA ' + schema)
  const url = new URL(databaseUrl)
  url.searchParams.set('options', '-c search_path=' + schema)
  let pool = new pg.Pool({ connectionString: url.href })
  let server
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
    await pool.end()
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE')
    await admin.end()
  })
  await migrate(pool)
  await migrate(pool)

  const people = {
    manager: ['manager', 'active'], officer: ['member', 'active'], colleague: ['member', 'active'],
    outsider: ['member', 'active'], otherManager: ['manager', 'active'], pending: ['member', 'pending'],
    disabled: ['manager', 'disabled'], admin: ['admin', 'active'],
  }
  const ids = {}
  for (const [name, [role, status]] of Object.entries(people)) {
    const { rows: [user] } = await pool.query(`
      INSERT INTO users (tenant_id, object_id, display_name, role, status)
      VALUES ('test', $1, $1, $2, $3) RETURNING id
    `, [name, role, status])
    ids[name] = user.id
  }
  const { rows: [first, second] } = await pool.query("INSERT INTO teams (name) VALUES ('One'), ('Two') RETURNING id")
  await pool.query(`
    INSERT INTO team_memberships (team_id, user_id, kind)
    VALUES ($1, $3, 'manager'), ($1, $4, 'member'), ($1, $5, 'member'), ($1, $6, 'member'),
           ($2, $7, 'manager'), ($2, $8, 'member')
  `, [first.id, second.id, ids.manager, ids.officer, ids.colleague, ids.pending, ids.otherManager, ids.outsider])

  async function startApi() {
    server = createApp({
      verifyToken: async (token) => {
        if (!people[token]) throw new Error('Unknown token')
        return { tenantId: 'test', objectId: token, displayName: token }
      },
      users: createUserStore(pool),
      duties: createDutyStore(pool),
    }).listen(0, '127.0.0.1')
    await once(server, 'listening')
  }

  async function request(person, path, method = 'GET', body) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/planning/' + path, {
      method,
      headers: {
        ...(person && { Authorization: 'Bearer ' + person }),
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    })
    return { status: response.status, data: await response.json() }
  }

  await startApi()
  const calendar = 'calendar' + range
  const flexible = { ...fields, type: 'flexible', officerId: ids.officer }
  assert.equal((await request(null, calendar)).status, 401)
  for (const person of ['pending', 'admin', 'disabled']) assert.equal((await request(person, calendar)).status, 403)
  assert.equal((await request('officer', 'assignments', 'POST', flexible)).status, 403)
  assert.equal((await request('otherManager', 'assignments', 'POST', flexible)).status, 403)
  assert.equal((await request('manager', 'assignments', 'POST', { ...flexible, officerId: ids.pending })).status, 403)
  assert.equal((await request('manager', 'assignments', 'POST', { ...fixed, officerId: ids.officer, endAt: null })).status, 400)

  const created = await request('manager', 'assignments', 'POST', flexible)
  assert.equal(created.status, 201)
  const protectedDuty = await request('manager', 'assignments', 'POST', {
    ...fixed, officerId: ids.officer, shareLocation: true,
  })
  assert.equal(protectedDuty.status, 201)
  assert.equal((await request('otherManager', 'assignments', 'POST', {
    ...fixed, title: 'Other team duty', officerId: ids.outsider,
  })).status, 201)

  // Reconnect to the database and create a fresh API, then read as the officer in another session.
  await new Promise((resolve) => server.close(resolve))
  server = null
  await pool.end()
  pool = new pg.Pool({ connectionString: url.href })
  await startApi()

  const own = (await request('officer', calendar)).data
  assert.deepEqual(own.officers.map(({ id }) => id).sort(), [ids.officer, ids.colleague].sort())
  const backlog = own.assignments.find(({ id }) => id === created.data.id)
  assert.equal(backlog.status, 'unscheduled')
  assert.equal(backlog.startAt, null)
  assert.equal(backlog.description, fields.description)
  assert.equal(backlog.factors.service, fields.factors.service)
  assert.equal(backlog.canManage, false)
  assert.equal(own.assignments.find(({ id }) => id === protectedDuty.data.id).status, 'protected')

  const peer = (await request('colleague', calendar)).data.assignments
  assert.equal(peer.length, 1)
  assert.equal(peer[0].title, fixed.title)
  assert.equal(peer[0].location, fields.location)
  for (const key of ['description', 'remarks', 'deadline', 'durationMinutes', 'factors', 'revision']) assert.equal(peer[0][key], null)
  const managerView = (await request('manager', calendar)).data.assignments
  assert.equal(managerView.length, 2)
  assert.ok(managerView.every(({ canManage }) => canManage))
  const outside = (await request('otherManager', calendar)).data.assignments
  assert.deepEqual(outside.map(({ officerId }) => officerId), [ids.outsider])

  const path = 'assignments/' + created.data.id
  const change = { ...flexible, title: 'Check water pressure', revision: 1 }
  assert.equal((await request('officer', path, 'PATCH', change)).status, 403)
  assert.equal((await request('otherManager', path, 'PATCH', change)).status, 404)
  assert.equal((await request('manager', path, 'PATCH', { ...change, officerId: ids.outsider })).status, 403)
  const edits = await Promise.all([
    request('manager', path, 'PATCH', { ...change, officerId: ids.colleague }),
    request('manager', path, 'PATCH', { ...change, officerId: ids.colleague }),
  ])
  assert.deepEqual(edits.map(({ status }) => status).sort(), [200, 409])
  assert.ok(!(await request('officer', calendar)).data.assignments.some(({ id }) => id === created.data.id))
  assert.equal((await request('colleague', calendar)).data.assignments.find(({ id }) => id === created.data.id).title, change.title)

  const removeFixed = 'assignments/' + protectedDuty.data.id
  assert.equal((await request('manager', removeFixed, 'PATCH', { revision: 1, shareLocation: false, ...fixed, officerId: ids.officer })).status, 200)
  assert.equal((await request('colleague', calendar)).data.assignments.find(({ id }) => id === protectedDuty.data.id).location, null)
  assert.equal((await request('manager', removeFixed, 'PATCH', { revision: 2, cancel: true })).status, 200)
  assert.equal((await request('officer', calendar)).data.assignments.find(({ id }) => id === protectedDuty.data.id).status, 'cancelled')
  assert.ok(!(await request('colleague', calendar)).data.assignments.some(({ id }) => id === protectedDuty.data.id))
  const { rows: history } = await pool.query('SELECT action FROM duty_assignment_history WHERE assignment_id = $1 ORDER BY revision', [protectedDuty.data.id])
  assert.deepEqual(history.map(({ action }) => action), ['created', 'updated', 'cancelled'])
})
