import pg from 'pg'

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
`

const COLUMNS = 'id, email, display_name AS "displayName", role, status, created_at AS "createdAt"'

export function createPool(connectionString) {
  return new pg.Pool({ connectionString })
}

export async function migrate(pool) {
  await pool.query(SCHEMA)
}

// Postgres-backed user store. Routes only talk to this interface, so tests can swap in a fake.
export function createUserStore(pool, { adminEmails = [] } = {}) {
  return {
    async ping() {
      await pool.query('SELECT 1')
    },

    // Finds the signed-in person, creating them as pending on first sign-in.
    // Emails can be renamed or reassigned, so ADMIN_EMAILS only creates the first admin: once any admin row
    // exists, a matching email gets no special treatment and roles change only through an admin.
    async upsertFromToken({ tenantId, objectId, email, displayName }) {
      const bootstrap = Boolean(email && adminEmails.includes(email.toLowerCase()))
      const { rows } = await pool.query(
        `WITH first_admin AS (
           SELECT $5::boolean AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS yes
         )
         INSERT INTO users (tenant_id, object_id, email, display_name, role, status)
         SELECT $1, $2, $3, $4,
                CASE WHEN yes THEN 'admin' ELSE 'member' END,
                CASE WHEN yes THEN 'active' ELSE 'pending' END
         FROM first_admin
         ON CONFLICT (tenant_id, object_id)
         DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, updated_at = now()
         RETURNING ${COLUMNS}`,
        [tenantId, objectId, email, displayName, bootstrap],
      )
      return rows[0]
    },

    async list() {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users ORDER BY created_at`)
      return rows
    },

    async update(id, { role, status }) {
      const { rows } = await pool.query(
        `UPDATE users SET role = COALESCE($2, role), status = COALESCE($3, status), updated_at = now()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, role ?? null, status ?? null],
      )
      return rows[0] ?? null
    },
  }
}
