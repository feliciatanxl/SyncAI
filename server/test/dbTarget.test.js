import assert from 'node:assert/strict'
import { test } from 'node:test'
import { databaseHost } from '../src/dbTarget.js'

// local: true lets start-up migrate and the seed script run; anything else (e.g. Railway) gets neither.
test('local and remote databases are told apart', () => {
  assert.deepEqual(databaseHost('postgres://u:p@localhost:5432/syncai_test'), { host: 'localhost', local: true })
  assert.equal(databaseHost('postgres://u:p@127.0.0.1/x').local, true)
  assert.deepEqual(databaseHost('postgresql://u:p@tokaido.proxy.rlwy.net:41597/railway'), { host: 'tokaido.proxy.rlwy.net', local: false })
  assert.equal(databaseHost('postgresql://u:p@postgres.railway.internal/railway').local, false)
  assert.throws(() => databaseHost('not a url'), /not a valid/)
})
