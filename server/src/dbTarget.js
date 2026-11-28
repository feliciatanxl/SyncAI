// Local or remote database? Decides what start-up and the scripts may do, not whether the API may connect:
//   - ordinary API reads and writes: any database in DATABASE_URL, including the shared Railway one;
//   - schema migrations: automatic on start-up only for a local database. A remote one is checked read-only
//     (verifySchema in db.js) and migrated only by scripts/migrate.js with an explicit flag;
//   - development seed data: local databases only, never remote, with no override.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function databaseHost(url) {
  try {
    const host = new URL(url).hostname
    return { host, local: LOCAL_HOSTS.has(host) }
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL.')
  }
}
