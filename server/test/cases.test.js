// Case Action Centre API against a real PostgreSQL. Needs TEST_DATABASE_URL pointing at a throwaway database whose
// name contains "test" (the suite wipes its public schema). Skipped when it isn't set, e.g.
//   docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=syncai_test -p 55432:5432 postgres:16-alpine
//   TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/syncai_test npm test
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { createApp } from '../src/app.js'
import { createCaseStore } from '../src/cases.js'
import { createPool, createUserStore, migrate } from '../src/db.js'

const url = process.env.TEST_DATABASE_URL
const skip = !url ? 'TEST_DATABASE_URL not set' : !/test/i.test(new URL(url).pathname) ? 'TEST_DATABASE_URL database name must contain "test"' : false

describe('Case API (PostgreSQL)', { skip }, () => {
  let pool, server, base
  const ids = {}

  // Bearer token = "tenant/object" of a user row; the real Entra check is replaced, everything else is real.
  const verifyToken = async (token) => {
    const [tenantId, objectId] = token.split('/')
    return { tenantId, objectId, email: `${objectId}@example.test`, displayName: objectId }
  }
  const call = async (who, method, path, body, headers = {}) => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(who && { authorization: `Bearer t/${who}` }), ...(body !== undefined && { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  }
  const q = async (sql, params) => (await pool.query(sql, params)).rows

  before(async () => {
    pool = createPool(url)
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
    await migrate(pool)
    const app = createApp({ verifyToken, users: createUserStore(pool), cases: createCaseStore(pool) })
    server = app.listen(0)
    base = `http://localhost:${server.address().port}`
  })
  after(async () => {
    server?.close()
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE case_history, case_events, case_evidence, case_checkpoints, case_blockers, case_contacts, cases, team_memberships, teams, activity, users CASCADE')
    const user = async (name, role, status = 'active') => {
      ids[name] = (await q(`INSERT INTO users (tenant_id, object_id, email, display_name, role, status) VALUES ('t', $1, $2, $1, $3, $4) RETURNING id`, [name, `${name}@example.test`, role, status]))[0].id
    }
    await user('mgrA', 'manager'); await user('mgrB', 'manager'); await user('mgrNone', 'manager')
    await user('offA', 'member'); await user('offA2', 'member'); await user('offB', 'member')
    await user('admin', 'admin'); await user('pendingMgr', 'manager', 'pending'); await user('offMgr', 'manager', 'disabled')
    ids.teamA = (await q(`INSERT INTO teams (name) VALUES ('Team A') RETURNING id`))[0].id
    ids.teamB = (await q(`INSERT INTO teams (name) VALUES ('Team B') RETURNING id`))[0].id
    const place = (team, u, kind) => q('INSERT INTO team_memberships (team_id, user_id, kind) VALUES ($1, $2, $3)', [ids[team], ids[u], kind])
    await place('teamA', 'mgrA', 'manager'); await place('teamA', 'offA', 'member'); await place('teamA', 'offA2', 'member')
    await place('teamB', 'mgrB', 'manager'); await place('teamB', 'offB', 'member')
    await place('teamA', 'pendingMgr', 'manager'); await place('teamA', 'offMgr', 'manager')
    const kase = async (key, team, owner, stage, extra = {}) => {
      ids[key] = (await q(
        `INSERT INTO cases (number, team_id, owner_id, title, urgency, stage, deadline) VALUES ($1, $2, $3, $4, 'high', $5, now() + interval '1 day') RETURNING id`,
        [key, ids[team], ids[owner], `Case ${key}`, stage],
      ))[0].id
      if (extra.blocker) await q(`INSERT INTO case_blockers (case_id, title, party_type) VALUES ($1, 'Waiting on contractor', 'contractor')`, [ids[key]])
      if (extra.ready) {
        await q(`INSERT INTO case_checkpoints (case_id, kind, title, completed) VALUES ($1, 'inspection', 'Inspect', true)`, [ids[key]])
        await q(`INSERT INTO case_evidence (case_id, title, status) VALUES ($1, 'Photo', 'verified')`, [ids[key]])
      }
      if (extra.missing) await q(`INSERT INTO case_evidence (case_id, title, status) VALUES ($1, 'Notice', 'missing')`, [ids[key]])
      if (extra.contact) await q(`INSERT INTO case_contacts (case_id, name) VALUES ($1, 'Fictional resident')`, [ids[key]])
    }
    await kase('A1', 'teamA', 'offA', 'open', { contact: true })
    await kase('A2', 'teamA', 'offA2', 'in_progress', { blocker: true })
    await kase('A3', 'teamA', 'offA', 'in_progress', { ready: true })
    await kase('A4', 'teamA', 'offA', 'in_progress', { missing: true })
    await kase('B1', 'teamB', 'offB', 'open')
  })

  test('migrations are recorded once and re-running them changes nothing', async () => {
    await migrate(pool)
    assert.deepEqual(await q('SELECT version, name FROM schema_migrations'), [{ version: 1, name: 'case_action_centre_v1' }])
    assert.equal((await q('SELECT count(*)::int AS n FROM users'))[0].n, 9)
  })

  test('only signed-in, active managers and members reach cases', async () => {
    assert.equal((await call(null, 'GET', '/cases')).status, 401)
    for (const who of ['admin', 'pendingMgr', 'offMgr']) assert.equal((await call(who, 'GET', '/cases')).status, 403, who)
    assert.equal((await call('offMgr', 'POST', `/cases/${ids.A1}/notes`, { text: 'x' })).status, 403)
    assert.equal((await call('admin', 'GET', `/cases/${ids.A1}`)).status, 403)
  })

  test('a manager lists exactly their team’s cases in the shape the app reads', async () => {
    const { status, body } = await call('mgrA', 'GET', '/cases')
    assert.equal(status, 200)
    assert.deepEqual(body.cases.map((c) => c.number).sort(), ['A1', 'A2', 'A3', 'A4'])
    assert.deepEqual(body.managedOfficerIds.sort(), [ids.offA, ids.offA2].sort())
    assert.deepEqual(body.officers.map((o) => o.name).sort(), ['mgrA', 'offA', 'offA2'])
    assert.ok(body.officers.every((o) => !('email' in o)))
    const a1 = body.cases.find((c) => c.number === 'A1')
    for (const key of ['id', 'title', 'stage', 'ownerId', 'urgency', 'deadline', 'blockers', 'checkpoints', 'evidence', 'timeline', 'history', 'communications', 'taskRefs']) assert.ok(key in a1, key)
    assert.equal(a1.pendingRequest, null)
    assert.deepEqual(a1.resident, { name: 'Fictional resident' })
    assert.equal(body.cases.find((c) => c.number === 'A2').blockers[0].title, 'Waiting on contractor')
  })

  test('cross-team cases are invisible and unchangeable, whatever id is sent', async () => {
    assert.deepEqual((await call('mgrB', 'GET', '/cases')).body.cases.map((c) => c.number), ['B1'])
    assert.equal((await call('mgrB', 'GET', `/cases/${ids.A1}`)).status, 404)
    assert.equal((await call('mgrB', 'POST', `/cases/${ids.A1}/notes`, { text: 'sneaky' })).status, 404)
    assert.equal((await call('mgrB', 'POST', `/cases/${ids.A1}/stage`, { target: 'in_progress' })).status, 404)
    assert.equal((await call('mgrB', 'GET', '/cases/not-a-uuid')).status, 404)
    // Browser-supplied ids are ignored.
    assert.deepEqual((await call('mgrB', 'GET', `/cases?teamId=${ids.teamA}&userId=${ids.mgrA}`)).body.cases.map((c) => c.number), ['B1'])
    assert.equal((await q('SELECT count(*)::int AS n FROM case_events'))[0].n, 0)
  })

  test('a manager with no team gets an empty list, not every case', async () => {
    const { status, body } = await call('mgrNone', 'GET', '/cases')
    assert.equal(status, 200)
    assert.deepEqual(body.cases, [])
    assert.deepEqual(body.managedOfficerIds, [])
  })

  test('a team member sees only cases assigned to them', async () => {
    assert.deepEqual((await call('offA2', 'GET', '/cases')).body.cases.map((c) => c.number), ['A2'])
    assert.equal((await call('offA2', 'GET', `/cases/${ids.A1}`)).status, 404)
  })

  test('a progress note persists with an audit row that holds no note text', async () => {
    const res = await call('mgrA', 'POST', `/cases/${ids.A1}/notes`, { text: '  Called the contractor  ' })
    assert.equal(res.status, 200)
    assert.equal(res.body.timeline.at(-1).summary, 'Called the contractor')
    assert.equal(res.body.timeline.at(-1).actor, 'mgrA')
    const again = (await call('mgrA', 'GET', `/cases/${ids.A1}`)).body
    assert.equal(again.timeline.at(-1).summary, 'Called the contractor')
    const [row] = await q('SELECT actor_id, action, after_value, reason FROM case_history WHERE case_id = $1', [ids.A1])
    assert.equal(row.actor_id, ids.mgrA)
    assert.equal(row.action, 'note_added')
    assert.ok(!JSON.stringify(row).includes('contractor'))
  })

  test('communications are logged with validated fields', async () => {
    const ok = await call('mgrA', 'POST', `/cases/${ids.A1}/communications`, { channel: 'Phone', direction: 'outbound', party: 'Resident', summary: 'Gave update' })
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.body.communications.map((m) => [m.channel, m.party]), [['Phone', 'Resident']])
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A1}/communications`, { channel: 'Fax', direction: 'outbound', party: 'R', summary: 'x' })).status, 400)
  })

  test('invalid input is refused before anything is written', async () => {
    for (const body of [{}, { text: '   ' }, { text: 42 }, { text: 'x'.repeat(2001) }]) {
      assert.equal((await call('mgrA', 'POST', `/cases/${ids.A1}/notes`, body)).status, 400, JSON.stringify(body).slice(0, 40))
    }
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A1}/stage`, { target: 'done' })).status, 400)
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A1}/notes`, '{bad json')).status, 400)
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A1}/notes`, 'text', { 'content-type': 'text/plain' })).status, 415)
    assert.equal((await q('SELECT count(*)::int AS n FROM case_history'))[0].n, 0)
  })

  test('stage moves follow the rules on the server and are recorded', async () => {
    const moved = await call('mgrA', 'POST', `/cases/${ids.A1}/stage`, { target: 'in_progress' })
    assert.equal(moved.status, 200)
    assert.equal(moved.body.stage, 'in_progress')
    assert.deepEqual(moved.body.history.map((h) => [h.field, h.before, h.after, h.actor]), [['Stage', 'Open', 'In progress', 'mgrA']])
    assert.equal((await q('SELECT stage FROM cases WHERE id = $1', [ids.A1]))[0].stage, 'in_progress')

    // Unresolved blocker and missing closure evidence can't be skipped by editing the request.
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A2}/stage`, { target: 'ready_for_closure' })).status, 409)
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A2}/stage`, { target: 'closed' })).status, 409)
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A4}/stage`, { target: 'ready_for_closure' })).status, 409)
    // Closing straight from in progress is refused; it has to be Closure Ready first.
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A3}/stage`, { target: 'closed' })).status, 409)
    // Blocked needs a reason.
    const noReason = await call('mgrA', 'POST', `/cases/${ids.A3}/stage`, { target: 'pending_external' })
    assert.equal(noReason.status, 400)
    assert.equal(noReason.body.code, 'reason_required')

    // A complete case can go to Closure Ready, then a manager can close it; reopening isn't built yet.
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A3}/stage`, { target: 'ready_for_closure' })).status, 200)
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A3}/stage`, { target: 'closed' })).status, 200)
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A3}/stage`, { target: 'open', reason: 'Resident called back' })).status, 501)
    const history = await q(`SELECT before_value, after_value FROM case_history WHERE case_id = $1 AND action = 'stage_changed' ORDER BY id`, [ids.A3])
    assert.deepEqual(history.map((h) => `${h.before_value}>${h.after_value}`), ['in_progress>ready_for_closure', 'ready_for_closure>closed'])
  })

  test('a member’s closure request and manager approvals are refused, not simulated', async () => {
    await pool.query(`UPDATE cases SET stage = 'ready_for_closure' WHERE id = $1`, [ids.A3])
    const req = await call('offA', 'POST', `/cases/${ids.A3}/stage`, { target: 'closed', reason: 'Done' })
    assert.equal(req.status, 501)
    assert.equal(req.body.code, 'not_available')
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A3}/request/decision`, { approve: true })).status, 501)
    assert.equal((await call('mgrA', 'POST', `/cases/${ids.A3}/reassignment`, { toOfficerId: ids.offA2, reason: 'x' })).status, 501)
    assert.equal((await q('SELECT stage, owner_id FROM cases WHERE id = $1', [ids.A3]))[0].stage, 'ready_for_closure')
  })

  test('a failed audit write rolls the whole change back', async () => {
    await pool.query(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit down'; END $$`)
    await pool.query('CREATE TRIGGER fail_audit BEFORE INSERT ON case_history FOR EACH ROW EXECUTE FUNCTION fail_audit()')
    const origError = console.error
    console.error = () => {}
    try {
      assert.equal((await call('mgrA', 'POST', `/cases/${ids.A1}/stage`, { target: 'in_progress' })).status, 500)
      assert.equal((await call('mgrA', 'POST', `/cases/${ids.A1}/notes`, { text: 'lost' })).status, 500)
    } finally {
      console.error = origError
      await pool.query('DROP TRIGGER fail_audit ON case_history; DROP FUNCTION fail_audit()')
    }
    assert.equal((await q('SELECT stage FROM cases WHERE id = $1', [ids.A1]))[0].stage, 'open')
    assert.equal((await q('SELECT count(*)::int AS n FROM case_events WHERE case_id = $1', [ids.A1]))[0].n, 0)
  })

  test('a team with cases cannot be deleted', async () => {
    await pool.query('DELETE FROM team_memberships WHERE team_id = $1', [ids.teamB])
    assert.equal((await call('admin', 'DELETE', `/teams/${ids.teamB}`)).status, 409)
  })
})

test('case routes answer 503 when no case store is configured', async () => {
  const users = {
    upsertFromToken: async () => ({ id: '00000000-0000-4000-8000-000000000001', role: 'manager', status: 'active', created: false, firstVisitToday: false }),
  }
  const server = createApp({ verifyToken: async () => ({}), users }).listen(0)
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/cases`, { headers: { authorization: 'Bearer x' } })
    assert.equal(res.status, 503)
  } finally {
    server.close()
  }
})
