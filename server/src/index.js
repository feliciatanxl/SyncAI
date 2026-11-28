import { createApp } from './app.js'
import { createTokenVerifier } from './auth.js'
import { createAssistant } from './assistant.js'
import { createPool, createUserStore, migrate, verifySchema } from './db.js'
import { createCaseStore } from './cases.js'
import { databaseHost } from './dbTarget.js'

const env = process.env
const list = (value) => (value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

for (const name of ['DATABASE_URL', 'ENTRA_CLIENT_ID']) {
  if (!env[name]) {
    console.error(`Missing ${name}. Copy server/.env.example to server/.env and fill it in.`)
    process.exit(1)
  }
}

let target
try {
  target = databaseHost(env.DATABASE_URL)
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const retentionDays = Number(env.ACTIVITY_RETENTION_DAYS) || 365
const pool = createPool(env.DATABASE_URL)
// Only a local database is migrated automatically. A remote one (the shared Railway database) is checked read-only;
// if its schema is missing or out of date the server stops, and scripts/migrate.js is run deliberately instead.
if (target.local) {
  await migrate(pool)
  console.log(`Database: local (${target.host}), migrated`)
} else {
  try {
    await verifySchema(pool)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
  console.log(`Database: remote (${target.host}), schema verified read-only, not migrated`)
}

// Email claims aren't verified for accounts from other tenants, so anyone could put an admin's email on their own
// account. ADMIN_EMAILS therefore only works when sign-in is limited to known tenants.
const allowedTenants = list(env.ALLOWED_TENANT_IDS)
const adminEmails = allowedTenants.length ? list(env.ADMIN_EMAILS) : []
if (list(env.ADMIN_EMAILS).length && !allowedTenants.length) {
  console.warn('ADMIN_EMAILS is ignored: set ALLOWED_TENANT_IDS so the first admin can only come from your own tenant.')
}
const users = createUserStore(pool, { adminEmails })
const app = createApp({
  verifyToken: createTokenVerifier({ clientId: env.ENTRA_CLIENT_ID, allowedTenants }),
  users,
  cases: createCaseStore(pool),
  trustProxy: Number(env.TRUST_PROXY) || 0,
  assistant: createAssistant({ apiKey: env.GROQ_API_KEY }),
})

// PDPA: keep activity records only as long as needed. Automatic (start-up, then daily) only for a local database;
// a remote one (the shared Railway database) is cleaned only by running scripts/purge-activity.js deliberately.
async function purge() {
  try {
    const removed = await users.purgeActivity(retentionDays)
    if (removed) console.log(`Deleted ${removed} activity records older than ${retentionDays} days`)
  } catch (err) {
    console.error('Activity retention job failed', err)
  }
}
if (target.local) {
  await purge()
  setInterval(purge, 24 * 60 * 60 * 1000).unref()
} else {
  console.log(`Activity retention (${retentionDays} days) is not run automatically on a remote database: see scripts/purge-activity.js`)
}

if (!env.GROQ_API_KEY) console.warn('GROQ_API_KEY is not set: Ask SyncAI will answer from its built-in help guide only.')

const port = Number(env.PORT) || 3000
app.listen(port, () => console.log(`SyncAI API on http://localhost:${port}/api`))
