import pg from 'pg'
import { eventsForChange } from './activity.js'
import { RuleError, checkPlacement, staleKinds } from './teams.js'

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

CREATE TABLE IF NOT EXISTS teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_name ON teams (lower(name));

-- Who is in which team, as manager or member. The table allows several teams per person; the partial index
-- below enforces the PoC rule of one team per team member, so relaxing it later is a one-line change.
CREATE TABLE IF NOT EXISTS team_memberships (
  team_id  UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind     TEXT NOT NULL CHECK (kind IN ('manager', 'member')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_team_per_member ON team_memberships (user_id) WHERE kind = 'member';
`

const COLUMNS = 'id, email, display_name AS "displayName", role, status, created_at AS "createdAt", last_active_at AS "lastActiveAt"'
// last_active_at is only rewritten when it is this stale, so ordinary requests don't each write to the database.
const STALE = "now() - interval '5 minutes'"
// Start of today in Singapore, for "opened SyncAI" being logged at most once a day.
const TODAY_SG = "date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore'"

export function createPool(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    keepAlive: true,
    connectionTimeoutMillis: 10000,
  })

  // Catch errors on idle clients so unexpected connection resets from remote
  // proxies (such as Railway's TCP proxy) do not crash the Node.js process.
  pool.on('error', (err) => {
    console.warn('PostgreSQL idle client connection issue:', err.code || err.message)
  })

  return pool
}

export async function migrate(pool, { maxRetries = 4, retryDelayMs = 1200 } = {}) {
  let attempt = 0
  while (true) {
    try {
      await pool.query(SCHEMA)
      return
    } catch (err) {
      attempt++
      if (attempt >= maxRetries) throw err
      console.warn(`Database migration attempt ${attempt}/${maxRetries} failed (${err.code || err.message}). Retrying in ${retryDelayMs}ms...`)
      await new Promise((r) => setTimeout(r, retryDelayMs))
    }
  }
}

// The teams a person belongs to, as [{ id, name, kind }], for the admin's People list.
const TEAMS_OF_USER = `COALESCE((
  SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'kind', m.kind) ORDER BY lower(t.name))
  FROM team_memberships m JOIN teams t ON t.id = m.team_id WHERE m.user_id = users.id
), '[]') AS teams`

// Postgres-backed store. Routes only talk to this interface, so tests can swap in a fake.
export function createUserStore(pool, { adminEmails = [] } = {}) {
  async function insertEvent(db, actorId, action, targetId, details = {}) {
    await db.query('INSERT INTO activity (actor_id, action, target_id, details) VALUES ($1, $2, $3, $4)', [actorId, action, targetId, details])
  }

  // Runs fn inside one transaction, so a change and its audit record are saved together or not at all.
  async function transaction(fn) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  // Unique-index clashes become the matching rule error instead of a server error.
  const uniqueClash = (err, ruleError) => {
    if (err.code === '23505') throw ruleError
    throw err
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
      const { rows } = await pool.query(`SELECT ${COLUMNS}, ${TEAMS_OF_USER} FROM users ORDER BY created_at`)
      return rows
    },

    // Changes a person's role and/or status and records what changed, in one transaction, so an access change
    // can never be saved without its audit record. A role change also drops team places that no longer fit.
    update(id, { role, status }, actorId) {
      return transaction(async (db) => {
        const before = (await db.query('SELECT role, status FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0]
        if (!before) return null
        const { rows } = await db.query(
          `UPDATE users SET role = COALESCE($2, role), status = COALESCE($3, status), updated_at = now()
           WHERE id = $1 RETURNING ${COLUMNS}`,
          [id, role ?? null, status ?? null],
        )
        const after = rows[0]
        for (const e of eventsForChange(before, after)) await insertEvent(db, actorId, e.action, id, e.details)
        if (before.role !== after.role) {
          const dropped = await db.query(
            `DELETE FROM team_memberships m USING teams t
             WHERE m.team_id = t.id AND m.user_id = $1 AND m.kind = ANY($2)
             RETURNING t.name, m.kind`,
            [id, staleKinds(after.role)],
          )
          for (const d of dropped.rows) {
            await insertEvent(db, actorId, 'team_member_removed', id, { team: d.name, kind: d.kind, reason: 'role_changed' })
          }
        }
        return after
      })
    },

    // ---- Teams ----

    // Every team with its people, for admins.
    async listTeams() {
      const { rows } = await pool.query(
        `SELECT t.id, t.name, t.created_at AS "createdAt",
                COALESCE(json_agg(json_build_object(
                  'id', u.id, 'displayName', u.display_name, 'email', u.email, 'kind', m.kind, 'status', u.status
                ) ORDER BY lower(coalesce(u.display_name, u.email))) FILTER (WHERE u.id IS NOT NULL), '[]') AS people
         FROM teams t
         LEFT JOIN team_memberships m ON m.team_id = t.id
         LEFT JOIN users u ON u.id = m.user_id
         GROUP BY t.id
         ORDER BY lower(t.name)`,
      )
      return rows
    },

    // The teams this person belongs to, with each team's managers: for their own /me record.
    async teamsOf(userId) {
      const { rows } = await pool.query(
        `SELECT t.id, t.name, m.kind,
                COALESCE((
                  SELECT json_agg(json_build_object('id', mu.id, 'displayName', mu.display_name, 'email', mu.email))
                  FROM team_memberships mm JOIN users mu ON mu.id = mm.user_id
                  WHERE mm.team_id = t.id AND mm.kind = 'manager'
                ), '[]') AS managers
         FROM team_memberships m JOIN teams t ON t.id = m.team_id
         WHERE m.user_id = $1
         ORDER BY lower(t.name)`,
        [userId],
      )
      return rows
    },

    // Only the teams this manager leads, with their members. This is the manager's whole view of other people.
    async teamsManagedBy(userId) {
      const { rows } = await pool.query(
        `SELECT t.id, t.name,
                COALESCE(json_agg(json_build_object(
                  'id', u.id, 'displayName', u.display_name, 'email', u.email, 'status', u.status, 'lastActiveAt', u.last_active_at
                ) ORDER BY lower(coalesce(u.display_name, u.email))) FILTER (WHERE u.id IS NOT NULL), '[]') AS members
         FROM teams t
         JOIN team_memberships lead ON lead.team_id = t.id AND lead.user_id = $1 AND lead.kind = 'manager'
         LEFT JOIN team_memberships m ON m.team_id = t.id AND m.kind = 'member'
         LEFT JOIN users u ON u.id = m.user_id
         GROUP BY t.id
         ORDER BY lower(t.name)`,
        [userId],
      )
      return rows
    },

    createTeam(name, actorId) {
      return transaction(async (db) => {
        const { rows } = await db
          .query('INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at AS "createdAt"', [name, actorId])
          .catch((err) => uniqueClash(err, new RuleError(409, 'name_taken', 'A team with that name already exists.')))
        await insertEvent(db, actorId, 'team_created', null, { team: name })
        return { ...rows[0], people: [] }
      })
    },

    renameTeam(id, name, actorId) {
      return transaction(async (db) => {
        const before = (await db.query('SELECT name FROM teams WHERE id = $1 FOR UPDATE', [id])).rows[0]
        if (!before) throw new RuleError(404, 'team_not_found', 'Team not found.')
        await db
          .query('UPDATE teams SET name = $2 WHERE id = $1', [id, name])
          .catch((err) => uniqueClash(err, new RuleError(409, 'name_taken', 'A team with that name already exists.')))
        if (before.name !== name) await insertEvent(db, actorId, 'team_renamed', null, { from: before.name, to: name })
        return { id, name }
      })
    },

    // Only empty teams can be deleted, so nobody silently loses their team.
    deleteTeam(id, actorId) {
      return transaction(async (db) => {
        const team = (await db.query('SELECT name FROM teams WHERE id = $1 FOR UPDATE', [id])).rows[0]
        if (!team) throw new RuleError(404, 'team_not_found', 'Team not found.')
        const people = (await db.query('SELECT count(*)::int AS n FROM team_memberships WHERE team_id = $1', [id])).rows[0].n
        if (people) throw new RuleError(409, 'team_not_empty', 'Remove everyone from the team before deleting it.')
        await db.query('DELETE FROM teams WHERE id = $1', [id])
        await insertEvent(db, actorId, 'team_deleted', null, { team: team.name })
      })
    },

    addToTeam(teamId, userId, kind, actorId) {
      return transaction(async (db) => {
        const team = (await db.query('SELECT name FROM teams WHERE id = $1 FOR UPDATE', [teamId])).rows[0]
        if (!team) throw new RuleError(404, 'team_not_found', 'Team not found.')
        const user = (await db.query('SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0]
        const inThisTeam = (await db.query('SELECT 1 FROM team_memberships WHERE team_id = $1 AND user_id = $2', [teamId, userId])).rowCount > 0
        const memberTeam = (await db.query(
          `SELECT t.name FROM team_memberships m JOIN teams t ON t.id = m.team_id WHERE m.user_id = $1 AND m.kind = 'member'`,
          [userId],
        )).rows[0]
        checkPlacement({ user, kind, inThisTeam, memberTeamName: memberTeam?.name })
        await db
          .query('INSERT INTO team_memberships (team_id, user_id, kind) VALUES ($1, $2, $3)', [teamId, userId, kind])
          .catch((err) => uniqueClash(err, new RuleError(409, 'already_in_team', 'They’re already in a team.')))
        await insertEvent(db, actorId, 'team_member_added', userId, { team: team.name, kind })
      })
    },

    removeFromTeam(teamId, userId, actorId) {
      return transaction(async (db) => {
        const removed = (await db.query(
          `DELETE FROM team_memberships m USING teams t
           WHERE m.team_id = t.id AND m.team_id = $1 AND m.user_id = $2
           RETURNING t.name, m.kind`,
          [teamId, userId],
        )).rows[0]
        if (!removed) throw new RuleError(404, 'not_in_team', 'They’re not in this team.')
        await insertEvent(db, actorId, 'team_member_removed', userId, { team: removed.name, kind: removed.kind })
      })
    },

    logActivity(actorId, action, targetId, details) {
      return insertEvent(pool, actorId, action, targetId, details)
    },

    // Newest first. `person` matches either who did it or who it was done to. `before` is the last id seen, for paging.
    async listActivity({ limit, before, person, action, date }) {
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
           AND ($4::text IS NULL OR (a.at >= ($4 || ' 00:00:00+08')::timestamptz AND a.at < ($4 || ' 00:00:00+08')::timestamptz + INTERVAL '1 day'))
         ORDER BY a.id DESC
         LIMIT $5`,
        [before ?? null, person ?? null, action ?? null, date ?? null, limit],
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
