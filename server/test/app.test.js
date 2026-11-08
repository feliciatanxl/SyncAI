import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { claimsToIdentity } from '../src/auth.js'

// In-memory stand-in for the Postgres user store, with the same admin bootstrap rule.
function fakeUsers(adminEmails = []) {
  const rows = new Map()
  return {
    rows,
    async ping() {},
    async upsertFromToken({ tenantId, objectId, email, displayName }) {
      const key = `${tenantId}/${objectId}`
      if (!rows.has(key)) {
        const admin = adminEmails.includes(email)
        rows.set(key, { id: randomUUID(), email, displayName, role: admin ? 'admin' : 'member', status: admin ? 'active' : 'pending' })
      }
      return rows.get(key)
    },
    async list() { return [...rows.values()] },
    async update(id, { role, status }) {
      const user = [...rows.values()].find((u) => u.id === id)
      if (!user) return null
      return Object.assign(user, role && { role }, status && { status })
    },
  }
}

// Tokens are just "<email>" here; the fake verifier rejects "bad".
const verifyToken = async (token) => {
  if (token === 'bad') throw new Error('invalid')
  return { tenantId: 't1', objectId: token, email: token, displayName: token }
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
