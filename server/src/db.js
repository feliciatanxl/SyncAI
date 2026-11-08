import pg from 'pg'
import { eventsForChange } from './activity.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,
  object_id    TEXT NOT NULL,
  email        TEXT,
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, object_id)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Append-only audit trail. The API has no way to edit or delete rows; only the retention job removes old ones.
CREATE TABLE IF NOT EXISTS activity (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id  UUID REFERENCES users (id) ON DELETE SET NULL,
  action    TEXT NOT NULL,
  target_id UUID REFERENCES users (id) ON DELETE SET NULL,
  details   JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS activity_at ON activity (at);
CREATE INDEX IF NOT EXISTS activity_actor ON activity (actor_id);
CREATE INDEX IF NOT EXISTS activity_target ON activity (target_id);
`

const COLUMNS = 'id, email, display_name AS "displayName", role, status, created_at AS "createdAt", last_active_at AS "lastActiveAt"'
// last_active_at is only rewritten when it is this stale, so ordinary requests don't each write to the database.
const STALE = "now() - interval '5 minutes'"
// Start of today in Singapore, for "opened SyncAI" being logged at most once a day.
const TODAY_SG = "date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore'"

export function createPool(connectionString) {
  return new pg.Pool({ connectionString })
}

export async function migrate(pool) {
  await pool.query(SCHEMA)
}

// Postgres-backed store. Routes only talk to this interface, so tests can swap in a fake.
export function createUserStore(pool, { adminEmails = [] } = {}) {
  async function insertEvent(db, actorId, action, targetId, details = {}) {
    await db.query('INSERT INTO activity (actor_id, action, target_id, details) VALUES ($1, $2, $3, $4)', [actorId, action, targetId, details])
  }

  return {
    async ping() {
      await pool.query('SELECT 1')
    },

    // Finds the signed-in person, creating them as pending on first sign-in, and notes when they were last active.
    // Also returns `created` and `firstVisitToday` so the caller can log the visit.
    // Emails can be renamed or reassigned, so ADMIN_EMAILS only creates the first admin: once any admin row
    // exists, a matching email gets no special treatment and roles change only through an admin.
    async upsertFromToken({ tenantId, objectId, email, displayName }) {
      const bootstrap = Boolean(email && adminEmails.includes(email.toLowerCase()))
      const { rows } = await pool.query(
        `WITH prev AS (
           SELECT last_active_at FROM users WHERE tenant_id = $1 AND object_id = $2
         ), first_admin AS (
           SELECT $5::boolean AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS yes
         ), up AS (
           INSERT INTO users (tenant_id, object_id, email, display_name, role, status, last_active_at)
           SELECT $1, $2, $3, $4,
                  CASE WHEN yes THEN 'admin' ELSE 'member' END,
                  CASE WHEN yes THEN 'active' ELSE 'pending' END,
                  now()
           FROM first_admin
           ON CONFLICT (tenant_id, object_id) DO UPDATE SET
             email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             last_active_at = CASE WHEN users.last_active_at IS NULL OR users.last_active_at < ${STALE} THEN now() ELSE users.last_active_at END,
             updated_at = now()
           WHERE users.email IS DISTINCT FROM EXCLUDED.email
              OR users.display_name IS DISTINCT FROM EXCLUDED.display_name
              OR users.last_active_at IS NULL OR users.last_active_at < ${STALE}
           RETURNING ${COLUMNS}, (xmax = 0) AS created
         ), me AS (
           SELECT * FROM up
           UNION ALL
           SELECT ${COLUMNS}, false FROM users WHERE tenant_id = $1 AND object_id = $2 AND NOT EXISTS (SELECT 1 FROM up)
         )
         SELECT me.*, COALESCE((SELECT last_active_at FROM prev) < ${TODAY_SG}, true) AS "firstVisitToday" FROM me`,
        [tenantId, objectId, email, displayName, bootstrap],
      )
      return rows[0]
    },

    async list() {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users ORDER BY created_at`)
      return rows
    },

    // Changes a person's role and/or status and records what changed, in one transaction, so an access change
    // can never be saved without its audit record.
    async update(id, { role, status }, actorId) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const before = (await client.query('SELECT role, status FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0]
        if (!before) {
          await client.query('ROLLBACK')
          return null
        }
        const { rows } = await client.query(
          `UPDATE users SET role = COALESCE($2, role), status = COALESCE($3, status), updated_at = now()
           WHERE id = $1 RETURNING ${COLUMNS}`,
          [id, role ?? null, status ?? null],
        )
        for (const e of eventsForChange(before, rows[0])) await insertEvent(client, actorId, e.action, id, e.details)
        await client.query('COMMIT')
        return rows[0]
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    },

    logActivity(actorId, action, targetId, details) {
      return insertEvent(pool, actorId, action, targetId, details)
    },

    // Newest first. `person` matches either who did it or who it was done to. `before` is the last id seen, for paging.
    async listActivity({ limit, before, person, action }) {
      const { rows } = await pool.query(
        `SELECT a.id::text AS id, a.at, a.action, a.details,
                a.actor_id AS "actorId", actor.display_name AS "actorName", actor.email AS "actorEmail",
                a.target_id AS "targetId", target.display_name AS "targetName", target.email AS "targetEmail"
         FROM activity a
         LEFT JOIN users actor ON actor.id = a.actor_id
         LEFT JOIN users target ON target.id = a.target_id
         WHERE ($1::bigint IS NULL OR a.id < $1)
           AND ($2::uuid IS NULL OR a.actor_id = $2 OR a.target_id = $2)
           AND ($3::text IS NULL OR a.action = $3)
         ORDER BY a.id DESC
         LIMIT $4`,
        [before ?? null, person ?? null, action ?? null, limit],
      )
      return rows
    },

    // Deletes activity older than the retention period. Returns how many rows were removed.
    async purgeActivity(days) {
      const { rowCount } = await pool.query('DELETE FROM activity WHERE at < now() - make_interval(days => $1)', [days])
      return rowCount
    },
  }
}
