import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { eventsForChange } from '../src/activity.js'
import { claimsToIdentity } from '../src/auth.js'

// In-memory stand-in for the Postgres store, with the same admin bootstrap, visit and audit rules.
function fakeUsers(adminEmails = []) {
  const rows = new Map()
  const activity = []
  const visitedToday = new Set()
  const log = (actorId, action, targetId, details = {}) => activity.push({ id: String(activity.length + 1), actorId, action, targetId, details })
  return {
    rows,
    activity,
    async ping() {},
    async upsertFromToken({ tenantId, objectId, email, displayName }) {
      const key = `${tenantId}/${objectId}`
      const created = !rows.has(key)
      if (created) {
        const admin = adminEmails.includes(email) && ![...rows.values()].some((u) => u.role === 'admin')
        rows.set(key, { id: randomUUID(), email, displayName, role: admin ? 'admin' : 'member', status: admin ? 'active' : 'pending', lastActiveAt: new Date() })
      }
      const firstVisitToday = !visitedToday.has(key)
      visitedToday.add(key)
      return { ...rows.get(key), created, firstVisitToday }
    },
    async list() { return [...rows.values()] },
    async update(id, { role, status }, actorId) {
      const user = [...rows.values()].find((u) => u.id === id)
      if (!user) return null
      const before = { ...user }
      Object.assign(user, role && { role }, status && { status })
      for (const e of eventsForChange(before, user)) log(actorId, e.action, id, e.details)
      return user
    },
    async logActivity(actorId, action, targetId, details) { log(actorId, action, targetId, details) },
    async listActivity({ limit, before, person, action }) {
      return activity
        .filter((a) => (!before || Number(a.id) < Number(before)) && (!person || a.actorId === person || a.targetId === person) && (!action || a.action === action))
        .reverse()
        .slice(0, limit)
    },
  }
}

// Tokens are "<email>" or "<email>#<other account>" here; the fake verifier rejects "bad".
const verifyToken = async (token) => {
  if (token === 'bad') throw new Error('invalid')
  const email = token.split('#')[0]
  return { tenantId: 't1', objectId: token, email, displayName: email }
}

async function withServer(fn) {
  const users = fakeUsers(['boss@x.com'])
  const server = createApp({ verifyToken, users }).listen(0)
  const base = `http://localhost:${server.address().port}/api`
  const call = (path, token, init = {}) =>
    fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) } })
  try { await fn(call, users) } finally { server.close() }
}

test('rejects missing and invalid tokens', () => withServer(async (call) => {
  assert.equal((await call('/me')).status, 401)
  assert.equal((await call('/me', 'bad')).status, 401)
}))

test('new people are pending; admin email is active admin', () => withServer(async (call) => {
  assert.deepEqual(await (await call('/me', 'new@x.com')).json().then(({ role, status }) => ({ role, status })), { role: 'member', status: 'pending' })
  assert.deepEqual(await (await call('/me', 'boss@x.com')).json().then(({ role, status }) => ({ role, status })), { role: 'admin', status: 'active' })
}))

test('admin email only creates the first admin', () => withServer(async (call) => {
  assert.equal((await (await call('/me', 'boss@x.com')).json()).role, 'admin')
  // A different account claiming the same email, after an admin exists, gets nothing special.
  const lookalike = await (await call('/me', 'boss@x.com#other-tenant')).json()
  assert.deepEqual({ role: lookalike.role, status: lookalike.status }, { role: 'member', status: 'pending' })
}))

test('only active admins manage users', () => withServer(async (call) => {
  const pending = await (await call('/me', 'new@x.com')).json()
  assert.equal((await call('/users', 'new@x.com')).status, 403)

  const res = await call(`/users/${pending.id}`, 'boss@x.com', { method: 'PATCH', body: JSON.stringify({ role: 'manager', status: 'active' }) })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).role, 'manager')

  // Approved, but a manager is still not an admin.
  assert.equal((await call('/users', 'new@x.com')).status, 403)
  assert.equal((await call('/users', 'boss@x.com')).status, 200)
}))

test('validates role changes', () => withServer(async (call) => {
  const me = await (await call('/me', 'boss@x.com')).json()
  const other = await (await call('/me', 'new@x.com')).json()
  const patch = (id, body) => call(`/users/${id}`, 'boss@x.com', { method: 'PATCH', body: JSON.stringify(body) })
  assert.equal((await patch(other.id, { role: 'owner' })).status, 400)
  assert.equal((await patch(me.id, { status: 'disabled' })).status, 400)
  assert.equal((await patch(randomUUID(), { status: 'active' })).status, 404)
}))

test('maps Microsoft claims to an identity', () => {
  assert.deepEqual(claimsToIdentity({ tid: 't', oid: 'o', preferred_username: 'Fel@Outlook.com', name: 'fel' }), {
    tenantId: 't', objectId: 'o', email: 'fel@outlook.com', displayName: 'fel',
  })
  assert.throws(() => claimsToIdentity({ tid: 't' }))
})

test('rate-limits API requests per IP', async () => {
  const server = createApp({ verifyToken, users: fakeUsers(), requestsPerWindow: 2 }).listen(0)
  const url = `http://localhost:${server.address().port}/api/health`
  try {
    assert.equal((await fetch(url)).status, 200)
    assert.equal((await fetch(url)).status, 200)
    const blocked = await fetch(url)
    assert.equal(blocked.status, 429)
    assert.match((await blocked.json()).message, /Too many requests/)
  } finally {
    server.close()
  }
})

test('admins cannot act once their own access is turned off', () => withServer(async (call, users) => {
  const boss = await (await call('/me', 'boss@x.com')).json()
  users.rows.get(`t1/boss@x.com`).status = 'disabled'
  assert.equal((await call('/users', 'boss@x.com')).status, 403)
  assert.equal((await call('/activity', 'boss@x.com')).status, 403)
  assert.equal((await call(`/users/${boss.id}`, 'boss@x.com', { method: 'PATCH', body: '{"status":"active"}' })).status, 403)
}))

test('rejects empty and malformed change requests', () => withServer(async (call) => {
  await call('/me', 'boss@x.com')
  const other = await (await call('/me', 'new@x.com')).json()
  assert.equal((await call(`/users/${other.id}`, 'boss@x.com', { method: 'PATCH', body: '{}' })).status, 400)
  assert.equal((await call(`/users/${other.id}`, 'boss@x.com', { method: 'PATCH', body: '{not json' })).status, 400)
  assert.equal((await call('/users/not-a-uuid', 'boss@x.com', { method: 'PATCH', body: '{"status":"active"}' })).status, 404)
}))

test('logs first sign-in once and a visit at most once a day', () => withServer(async (call, users) => {
  const me = await (await call('/me', 'new@x.com')).json()
  await call('/me', 'new@x.com')
  await call('/me', 'new@x.com')
  assert.deepEqual(users.activity.map((a) => a.action), ['signed_up'])
  assert.equal(users.activity[0].actorId, me.id)
  assert.equal('created' in me || 'firstVisitToday' in me, false)
}))

test('records who approved, changed or turned off whom', () => withServer(async (call, users) => {
  const boss = await (await call('/me', 'boss@x.com')).json()
  const a = await (await call('/me', 'a@x.com')).json()
  const b = await (await call('/me', 'b@x.com')).json()
  const patch = (id, body) => call(`/users/${id}`, 'boss@x.com', { method: 'PATCH', body: JSON.stringify(body) })
  await patch(a.id, { status: 'active', role: 'manager' })
  await patch(a.id, { role: 'member' })
  await patch(a.id, { status: 'disabled' })
  await patch(b.id, { status: 'disabled' })
  const changes = users.activity.filter((e) => e.actorId === boss.id && e.targetId !== boss.id)
  assert.deepEqual(changes.map((e) => [e.action, e.details]), [
    ['approved', { role: 'manager' }],
    ['role_changed', { from: 'manager', to: 'member' }],
    ['access_off', {}],
    ['declined', {}],
  ])
}))

test('only active admins can read activity, with validated filters', () => withServer(async (call) => {
  const boss = await (await call('/me', 'boss@x.com')).json()
  const a = await (await call('/me', 'a@x.com')).json()
  assert.equal((await call('/activity')).status, 401)
  assert.equal((await call('/activity', 'a@x.com')).status, 403)

  await call(`/users/${a.id}`, 'boss@x.com', { method: 'PATCH', body: '{"status":"active"}' })
  assert.equal((await call('/activity', 'a@x.com')).status, 403, 'an approved member is still not an admin')

  const all = await (await call('/activity', 'boss@x.com')).json()
  assert.equal(all.items[0].action, 'approved', 'newest first')
  const aboutA = await (await call(`/activity?person=${a.id}&action=approved`, 'boss@x.com')).json()
  assert.deepEqual(aboutA.items.map((e) => [e.actorId, e.targetId]), [[boss.id, a.id]])

  for (const bad of ['limit=0', 'limit=101', 'limit=abc', 'before=1;drop', 'person=x', 'action=deleted']) {
    assert.equal((await call(`/activity?${bad}`, 'boss@x.com')).status, 400, bad)
  }
}))

test('sends security headers and hides internals', () => withServer(async (call) => {
  const res = await call('/health')
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('x-frame-options'), 'DENY')
  assert.equal(res.headers.get('x-powered-by'), null)
}))

test('turns status and role changes into audit events', () => {
  assert.deepEqual(eventsForChange({ role: 'member', status: 'pending' }, { role: 'manager', status: 'active' }), [{ action: 'approved', details: { role: 'manager' } }])
  assert.deepEqual(eventsForChange({ role: 'member', status: 'disabled' }, { role: 'manager', status: 'active' }), [
    { action: 'access_on', details: {} },
    { action: 'role_changed', details: { from: 'member', to: 'manager' } },
  ])
  assert.deepEqual(eventsForChange({ role: 'member', status: 'active' }, { role: 'member', status: 'pending' }), [
    { action: 'status_changed', details: { from: 'active', to: 'pending' } },
  ])
  assert.deepEqual(eventsForChange({ role: 'member', status: 'active' }, { role: 'member', status: 'active' }), [])
})

test('records explicit sign-outs, for anyone signed in', () => withServer(async (call, users) => {
  assert.equal((await call('/signout', null, { method: 'POST' })).status, 401)
  const pending = await (await call('/me', 'new@x.com')).json()
  const res = await call('/signout', 'new@x.com', { method: 'POST' })
  assert.equal(res.status, 204)
  assert.deepEqual(users.activity.at(-1), { id: String(users.activity.length), actorId: pending.id, action: 'signed_out', targetId: pending.id, details: {} })

  await call('/me', 'boss@x.com')
  const feed = await (await call('/activity?action=signed_out', 'boss@x.com')).json()
  assert.deepEqual(feed.items.map((e) => e.actorId), [pending.id])
}))

test('records every sign-in, and daily opens only for people already signed in', () => withServer(async (call, users) => {
  const me = await (await (await call('/signin', 'new@x.com', { method: 'POST' })).json())
  assert.equal(me.status, 'pending', 'sign-in returns the same record as /me')
  await call('/signin', 'new@x.com', { method: 'POST' })
  await call('/signin', 'new@x.com', { method: 'POST' })
  await call('/me', 'new@x.com')
  assert.deepEqual(users.activity.map((a) => a.action), ['signed_up', 'signed_in', 'signed_in'])
  assert.equal((await call('/signin', null, { method: 'POST' })).status, 401)
}))
