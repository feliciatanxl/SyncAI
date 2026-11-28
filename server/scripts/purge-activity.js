// Activity retention, run on purpose. Deletes audit (activity) rows older than ACTIVITY_RETENTION_DAYS (default 365),
// the same policy the server applies automatically to a local database. Only the activity table; nothing else.
//
//   node --env-file=.env scripts/purge-activity.js --check        read-only: how many rows are past retention
//   node --env-file=.env scripts/purge-activity.js --yes          local database
//   PURGE_REMOTE_DATABASE=true node --env-file=.env scripts/purge-activity.js --yes   remote database, deliberately
import { createPool, createUserStore } from '../src/db.js'
import { databaseHost } from '../src/dbTarget.js'

const args = process.argv.slice(2)
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
const days = Number(process.env.ACTIVITY_RETENTION_DAYS) || 365
const { host, local } = databaseHost(url)
const pool = createPool(url)
try {
  if (args.includes('--check')) {
    const { n } = (await pool.query('SELECT count(*)::int AS n FROM activity WHERE at < now() - make_interval(days => $1)', [days])).rows[0]
    console.log(`${n} activity records on ${host} are older than ${days} days. Nothing was deleted.`)
  } else if (!args.includes('--yes')) {
    throw new Error('Pass --check to count, or --yes to delete records past retention.')
  } else if (!local && process.env.PURGE_REMOTE_DATABASE !== 'true') {
    throw new Error(`${host} is a remote database. Set PURGE_REMOTE_DATABASE=true for this one command to delete its old activity records.`)
  } else {
    const removed = await createUserStore(pool).purgeActivity(days)
    console.log(`Deleted ${removed} activity records older than ${days} days on ${host}.`)
  }
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
