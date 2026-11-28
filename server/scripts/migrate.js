// Applies the baseline schema and pending versioned migrations (db.js) on purpose, for databases the server won't
// migrate on start-up (any remote one, such as the shared Railway database). Additive only: it never drops or
// truncates. Back up first.
//
//   node --env-file=.env scripts/migrate.js --check                       read-only: report what is missing or pending
//   node --env-file=.env scripts/migrate.js --yes                         local database
//   MIGRATE_REMOTE_DATABASE=true node --env-file=.env scripts/migrate.js --yes   remote database, deliberately
import { createPool, migrate, verifySchema } from '../src/db.js'
import { databaseHost } from '../src/dbTarget.js'

const args = process.argv.slice(2)
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
const { host, local } = databaseHost(url)
const pool = createPool(url)
try {
  if (args.includes('--check')) {
    await verifySchema(pool)
    console.log(`Schema on ${host} is up to date.`)
  } else if (!args.includes('--yes')) {
    throw new Error('Pass --check to inspect, or --yes to apply migrations.')
  } else if (!local && process.env.MIGRATE_REMOTE_DATABASE !== 'true') {
    throw new Error(`${host} is a remote database. Back it up, then set MIGRATE_REMOTE_DATABASE=true for this one command.`)
  } else {
    console.log(`Migrating ${host}…`)
    await migrate(pool, { maxRetries: 1 })
    await verifySchema(pool)
    console.log('Done. Schema is up to date.')
  }
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
