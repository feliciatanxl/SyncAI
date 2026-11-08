import { createApp } from './app.js'
import { createTokenVerifier } from './auth.js'
import { createPool, createUserStore, migrate } from './db.js'

const env = process.env
const list = (value) => (value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

for (const name of ['DATABASE_URL', 'ENTRA_CLIENT_ID']) {
  if (!env[name]) {
    console.error(`Missing ${name}. Copy server/.env.example to server/.env and fill it in.`)
    process.exit(1)
  }
}

const retentionDays = Number(env.ACTIVITY_RETENTION_DAYS) || 365
const pool = createPool(env.DATABASE_URL)
await migrate(pool)

const users = createUserStore(pool, { adminEmails: list(env.ADMIN_EMAILS) })
const app = createApp({
  verifyToken: createTokenVerifier({ clientId: env.ENTRA_CLIENT_ID, allowedTenants: list(env.ALLOWED_TENANT_IDS) }),
  users,
})

// PDPA: keep activity records only as long as needed. Runs at start-up and then daily.
async function purge() {
  try {
    const removed = await users.purgeActivity(retentionDays)
    if (removed) console.log(`Deleted ${removed} activity records older than ${retentionDays} days`)
  } catch (err) {
    console.error('Activity retention job failed', err)
  }
}
await purge()
setInterval(purge, 24 * 60 * 60 * 1000).unref()

const port = Number(env.PORT) || 3000
app.listen(port, () => console.log(`SyncAI API on http://localhost:${port}/api`))
