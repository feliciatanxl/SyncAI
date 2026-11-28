// Case Action Centre store. Every read and write is scoped in SQL to the signed-in person's persisted team
// places, never to ids sent by the browser: managers see cases of the teams they lead, team members the cases
// assigned to them in their own team. Admins and pending/disabled accounts are stopped before reaching here
// (see app.js) and also have no scope below. Out-of-scope cases answer 404, so their existence isn't revealed.
// Each change and its audit row are written in one transaction. Nothing here calls Groq.
import { RuleError } from './teams.js'
import { STAGES, URGENCIES, caseStage, checkTransition } from './caseRules.js'

export const CASE_SCHEMA = `
-- Operational cases. Resident contact details live in case_contacts, not here.
CREATE TABLE IF NOT EXISTS cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number      TEXT NOT NULL UNIQUE CHECK (length(number) BETWEEN 1 AND 40),
  team_id     UUID NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  owner_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  category    TEXT NOT NULL DEFAULT '',
  estate      TEXT NOT NULL DEFAULT '',
  block       TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  urgency     TEXT NOT NULL CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  stage       TEXT NOT NULL DEFAULT 'open' CHECK (stage IN ('open', 'in_progress', 'pending_external', 'ready_for_closure', 'closed')),
  description TEXT NOT NULL DEFAULT '',
  deadline    TIMESTAMPTZ,
  fictional   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cases_team ON cases (team_id);
CREATE INDEX IF NOT EXISTS cases_owner ON cases (owner_id);

-- Kept apart from case metadata so it can be restricted, masked or purged on its own.
CREATE TABLE IF NOT EXISTS case_contacts (
  case_id UUID PRIMARY KEY REFERENCES cases (id) ON DELETE CASCADE,
  name    TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS case_blockers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  title             TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  responsible_party TEXT NOT NULL DEFAULT '',
  party_type        TEXT NOT NULL DEFAULT 'internal' CHECK (party_type IN ('resident', 'contractor', 'agency', 'internal')),
  due               TIMESTAMPTZ,
  resolved          BOOLEAN NOT NULL DEFAULT false,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS case_blockers_case ON case_blockers (case_id);

CREATE TABLE IF NOT EXISTS case_checkpoints (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  kind                 TEXT NOT NULL CHECK (kind IN ('inspection', 'resident', 'contractor', 'appointment', 'other')),
  title                TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  due                  TIMESTAMPTZ,
  completed            BOOLEAN NOT NULL DEFAULT false,
  completed_at         TIMESTAMPTZ,
  required_for_closure BOOLEAN NOT NULL DEFAULT true,
  requires_manager     BOOLEAN NOT NULL DEFAULT false,
  position             INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS case_checkpoints_case ON case_checkpoints (case_id);

CREATE TABLE IF NOT EXISTS case_evidence (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  title                TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  file_name            TEXT,
  type                 TEXT NOT NULL DEFAULT 'Document',
  size                 TEXT,
  status               TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'pending_review', 'verified')),
  required_for_closure BOOLEAN NOT NULL DEFAULT true,
  uploaded_at          TIMESTAMPTZ,
  uploaded_by          TEXT,
  verified_by          TEXT
);
CREATE INDEX IF NOT EXISTS case_evidence_case ON case_evidence (case_id);

-- Timeline entries (progress notes) and logged communications. Nothing is sent to anyone from here.
CREATE TABLE IF NOT EXISTS case_events (
  id          BIGSERIAL PRIMARY KEY,
  case_id     UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind        TEXT NOT NULL CHECK (kind IN ('timeline', 'communication')),
  type        TEXT NOT NULL DEFAULT 'update',
  title       TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 2000),
  source      TEXT NOT NULL DEFAULT '',
  channel     TEXT,
  direction   TEXT CHECK (direction IN ('inbound', 'outbound')),
  party       TEXT,
  actor_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS case_events_case ON case_events (case_id, at);

-- Append-only audit of every case change. No route edits or deletes it, and a case with history can't be
-- deleted (RESTRICT). Note and message text stays in case_events; this only points at the event.
CREATE TABLE IF NOT EXISTS case_history (
  id           BIGSERIAL PRIMARY KEY,
  case_id      UUID NOT NULL REFERENCES cases (id) ON DELETE RESTRICT,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_label  TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL,
  field        TEXT,
  before_value TEXT,
  after_value  TEXT,
  reason       TEXT
);
CREATE INDEX IF NOT EXISTS case_history_case ON case_history (case_id, id);
`

export const CHANNELS = ['Phone', 'Email', 'SMS', 'In person']
// The prototype's work categories (prototype/js/data.js).
export const CATEGORIES = ['Inspection', 'Maintenance', 'Resident Feedback', 'Contractor', 'Admin', 'Cleaning', 'Horticulture']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STAGE_LABEL = { open: 'Open', in_progress: 'In progress', pending_external: 'Blocked', ready_for_closure: 'Closure ready', closed: 'Closed & audited' }

// The cases each role may see, as SQL on alias `c` with $1 = the signed-in user's id. Unknown roles see nothing.
const MANAGED_TEAMS = `SELECT team_id FROM team_memberships WHERE user_id = $1 AND kind = 'manager'`
const SCOPE = {
  manager: `c.team_id IN (${MANAGED_TEAMS})`,
  member: `c.owner_id = $1 AND c.team_id IN (SELECT team_id FROM team_memberships WHERE user_id = $1 AND kind = 'member')`,
}
const scopeOf = (user) => {
  if (user.status !== 'active' || !SCOPE[user.role]) throw new RuleError(403, 'no_case_access', 'You do not have access to cases.')
  return SCOPE[user.role]
}

const CASE_COLUMNS = `c.id, c.number, c.title, c.category, c.stage, c.owner_id AS "ownerId", c.estate, c.block,
  c.location AS unit, c.urgency, c.description, c.deadline`

// Teams this person may open cases in, each with the officers a case there may be assigned to: for a manager, the
// teams they lead with themselves and the team's active members; for a team member, their own team and only themselves.
const CREATE_TEAMS = `
  SELECT t.id, t.name,
         json_agg(json_build_object('id', u.id, 'name', coalesce(u.display_name, u.email, 'Officer'))
                  ORDER BY u.id = $1 DESC, lower(coalesce(u.display_name, u.email))) AS officers
  FROM team_memberships mine
  JOIN teams t ON t.id = mine.team_id
  JOIN team_memberships m ON m.team_id = t.id
  JOIN users u ON u.id = m.user_id AND u.status = 'active'
  WHERE mine.user_id = $1
    AND ((mine.kind = 'manager' AND (m.kind = 'member' OR m.user_id = $1)) OR (mine.kind = 'member' AND m.user_id = $1))
  GROUP BY t.id
  ORDER BY lower(t.name)`

// An ISO date-time within ±5 years, or null when optional and empty.
function when(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null
  const d = typeof value === 'string' ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime()) || Math.abs(d - Date.now()) > 5 * 365 * 86_400_000) {
    throw new RuleError(400, 'invalid_input', `${field} must be a valid date and time.`)
  }
  return d.toISOString()
}

// Trimmed text of 1..max characters, or a 400.
function text(value, field, max, { optional = false } = {}) {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s && optional && (value === undefined || value === null || typeof value === 'string')) return ''
  if (!s || s.length > max) throw new RuleError(400, 'invalid_input', `${field} must be 1 to ${max} characters.`)
  return s
}

export function createCaseStore(pool) {
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

  // Case rows -> the shape the React Case Action Centre reads.
  async function hydrate(db, rows) {
    if (!rows.length) return []
    const ids = rows.map((r) => r.id)
    const q = async (sql) => (await db.query(sql, [ids])).rows
    const contacts = await q('SELECT case_id AS "caseId", name FROM case_contacts WHERE case_id = ANY($1)')
    const blockers = await q(`SELECT id, case_id AS "caseId", title, responsible_party AS "responsibleParty", party_type AS "partyType",
      due, resolved, recorded_at AS "recordedAt", resolved_at AS "resolvedAt" FROM case_blockers WHERE case_id = ANY($1) ORDER BY recorded_at`)
    const checkpoints = await q(`SELECT id, case_id AS "caseId", kind, title, due, completed, completed_at AS "completedAt",
      required_for_closure AS "requiredForClosure", requires_manager AS "requiresManager" FROM case_checkpoints WHERE case_id = ANY($1) ORDER BY position, id`)
    const evidence = await q(`SELECT id, case_id AS "caseId", title, file_name AS "fileName", type, size, status,
      required_for_closure AS "requiredForClosure", uploaded_at AS "uploadedAt", uploaded_by AS "uploadedBy", verified_by AS "verifiedBy"
      FROM case_evidence WHERE case_id = ANY($1) ORDER BY title`)
    const events = await q(`SELECT id::text AS id, case_id AS "caseId", at, kind, type, title, summary, source, channel, direction, party,
      actor_label AS actor FROM case_events WHERE case_id = ANY($1) ORDER BY at, id`)
    const history = await q(`SELECT id::text AS id, case_id AS "caseId", at, actor_label AS actor, field, before_value AS before,
      after_value AS after, reason FROM case_history WHERE case_id = ANY($1) AND field IS NOT NULL ORDER BY id`)
    const of = (list, id) => list.filter((x) => x.caseId === id).map(({ caseId, ...rest }) => rest)
    return rows.map((r) => {
      const ev = of(events, r.id)
      return {
        ...r,
        resident: of(contacts, r.id)[0] ?? null,
        taskRefs: [],
        blockers: of(blockers, r.id),
        checkpoints: of(checkpoints, r.id),
        evidence: of(evidence, r.id),
        timeline: ev.filter((e) => e.kind === 'timeline').map(({ id, at, type, title, summary, source, actor }) => ({ id, at, type, title, summary, source, actor })),
        communications: ev.filter((e) => e.kind === 'communication').map(({ id, at, channel, direction, party, summary }) => ({ id, at, channel, direction, party, summary })),
        history: of(history, r.id).map((h) => (h.field === 'stage' ? { ...h, field: 'Stage', before: STAGE_LABEL[h.before] ?? h.before, after: STAGE_LABEL[h.after] ?? h.after } : h)),
        // Approval requests aren't built yet, so no case ever has one waiting.
        pendingRequest: null,
      }
    })
  }

  const actorLabel = (user) => user.displayName || user.email || 'Unknown'

  async function audit(db, caseId, user, action, { field = null, before = null, after = null, reason = null } = {}) {
    await db.query(
      `INSERT INTO case_history (case_id, actor_id, actor_label, action, field, before_value, after_value, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [caseId, user.id, actorLabel(user), action, field, before, after, reason],
    )
  }

  // Locks one in-scope case, runs fn, and returns the updated case: all in one transaction.
  function change(user, id, fn) {
    const scope = scopeOf(user)
    return transaction(async (db) => {
      const row = (await db.query(`SELECT ${CASE_COLUMNS} FROM cases c WHERE c.id = $2 AND ${scope} FOR UPDATE OF c`, [user.id, id])).rows[0]
      if (!row) throw new RuleError(404, 'case_not_found', 'Case not found.')
      const [kase] = await hydrate(db, [row])
      await fn(db, kase)
      await db.query('UPDATE cases SET updated_at = now() WHERE id = $1', [id])
      const fresh = (await db.query(`SELECT ${CASE_COLUMNS} FROM cases c WHERE c.id = $1`, [id])).rows
      return (await hydrate(db, fresh))[0]
    })
  }

  return {
    // { cases, officers, managedOfficerIds } for this person's scope. Officers carry names only, no emails.
    async list(user) {
      const scope = scopeOf(user)
      const rows = (await pool.query(`SELECT ${CASE_COLUMNS} FROM cases c WHERE ${scope} ORDER BY c.deadline NULLS LAST, c.number`, [user.id])).rows
      const officers = (await pool.query(
        `SELECT u.id, coalesce(u.display_name, u.email, 'Officer') AS name FROM users u
         WHERE u.id = $1
            OR u.id IN (SELECT m.user_id FROM team_memberships m WHERE m.kind = 'member' AND m.team_id IN (${MANAGED_TEAMS}))
            OR u.id IN (SELECT c.owner_id FROM cases c WHERE ${scope})
         ORDER BY u.id = $1 DESC, lower(coalesce(u.display_name, u.email))`,
        [user.id],
      )).rows
      const managedOfficerIds = user.role === 'manager' ? officers.map((o) => o.id).filter((id) => id !== user.id) : []
      const teams = (await pool.query(CREATE_TEAMS, [user.id])).rows
      return { cases: await hydrate(pool, rows), officers, managedOfficerIds, teams, categories: CATEGORIES }
    },

    async get(user, id) {
      const scope = scopeOf(user)
      const rows = (await pool.query(`SELECT ${CASE_COLUMNS} FROM cases c WHERE c.id = $2 AND ${scope}`, [user.id, id])).rows
      return (await hydrate(pool, rows))[0] ?? null
    },

    // A new case in one of the teams this person may create in (see CREATE_TEAMS), assigned to an eligible officer.
    // Team, officer and creator are checked against the database, never taken on trust from the request.
    async create(user, body) {
      scopeOf(user)
      const title = text(body?.title, 'title', 200)
      if (!CATEGORIES.includes(body?.category)) throw new RuleError(400, 'invalid_input', `category must be one of ${CATEGORIES.join(', ')}.`)
      if (!URGENCIES.includes(body?.urgency)) throw new RuleError(400, 'invalid_input', `urgency must be one of ${URGENCIES.join(', ')}.`)
      const description = text(body?.description, 'description', 2000)
      const estate = text(body?.estate, 'estate', 80)
      const location = text(body?.location, 'location', 120)
      const deadline = when(body?.deadline, 'deadline')
      const followUp = when(body?.followUpDue, 'followUpDue', { optional: true })
      if (!UUID.test(body?.teamId ?? '')) throw new RuleError(400, 'invalid_input', 'teamId must be a team id.')
      if (!UUID.test(body?.ownerId ?? '')) throw new RuleError(400, 'invalid_input', 'ownerId must be an officer id.')
      return transaction(async (db) => {
        const team = (await db.query(`SELECT * FROM (${CREATE_TEAMS}) x WHERE x.id = $2`, [user.id, body.teamId])).rows[0]
        if (!team) throw new RuleError(403, 'team_not_allowed', 'You can’t create cases for that team.')
        if (!team.officers.some((o) => o.id === body.ownerId)) throw new RuleError(400, 'officer_not_allowed', 'Choose an officer from that team.')
        // CAS-<year>-<NNNN>, numbered under a transaction lock so two creations can't take the same number.
        await db.query('SELECT pg_advisory_xact_lock(727002)')
        const year = new Date().getFullYear()
        const last = (await db.query(`SELECT max(substring(number from '^CAS-${year}-([0-9]+)$')::int) AS n FROM cases`)).rows[0].n ?? 0
        const number = `CAS-${year}-${String(last + 1).padStart(4, '0')}`
        const { id } = (await db.query(
          `INSERT INTO cases (number, team_id, owner_id, title, category, estate, location, urgency, stage, description, deadline)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10) RETURNING id`,
          [number, team.id, body.ownerId, title, body.category, estate, location, body.urgency, description, deadline],
        )).rows[0]
        if (followUp) {
          await db.query(
            `INSERT INTO case_checkpoints (case_id, kind, title, due, required_for_closure) VALUES ($1, 'other', 'Follow-up', $2, false)`,
            [id, followUp],
          )
        }
        await db.query(
          `INSERT INTO case_events (case_id, kind, type, title, summary, source, actor_id, actor_label)
           VALUES ($1, 'timeline', 'reported', 'Case created', $2, 'Case Action Centre', $3, $4)`,
          [id, `Created in ${team.name}.`, user.id, actorLabel(user)],
        )
        await audit(db, id, user, 'case_created', { field: 'stage', before: null, after: 'open', reason: 'Case created' })
        const rows = (await db.query(`SELECT ${CASE_COLUMNS} FROM cases c WHERE c.id = $1`, [id])).rows
        return (await hydrate(db, rows))[0]
      })
    },

    addNote(user, id, body) {
      const note = text(body?.text, 'text', 2000)
      return change(user, id, async (db, kase) => {
        const ev = (await db.query(
          `INSERT INTO case_events (case_id, kind, type, title, summary, source, actor_id, actor_label)
           VALUES ($1, 'timeline', 'update', 'Progress note', $2, 'Manual note', $3, $4) RETURNING id::text`,
          [kase.id, note, user.id, actorLabel(user)],
        )).rows[0]
        await audit(db, kase.id, user, 'note_added', { after: `event ${ev.id}` })
      })
    },

    logCommunication(user, id, body) {
      if (!CHANNELS.includes(body?.channel)) throw new RuleError(400, 'invalid_input', `channel must be one of ${CHANNELS.join(', ')}.`)
      if (!['inbound', 'outbound'].includes(body?.direction)) throw new RuleError(400, 'invalid_input', 'direction must be inbound or outbound.')
      const party = text(body?.party, 'party', 120)
      const summary = text(body?.summary, 'summary', 2000)
      return change(user, id, async (db, kase) => {
        const ev = (await db.query(
          `INSERT INTO case_events (case_id, kind, type, summary, channel, direction, party, actor_id, actor_label)
           VALUES ($1, 'communication', 'communication', $2, $3, $4, $5, $6, $7) RETURNING id::text`,
          [kase.id, summary, body.channel, body.direction, party, user.id, actorLabel(user)],
        )).rows[0]
        await audit(db, kase.id, user, 'communication_logged', { after: `event ${ev.id}` })
      })
    },

    moveStage(user, id, body) {
      const target = body?.target
      const reason = text(body?.reason, 'reason', 500, { optional: true })
      if (!STAGES.includes(target)) throw new RuleError(400, 'invalid_input', `target must be one of ${STAGES.join(', ')}.`)
      return change(user, id, async (db, kase) => {
        const check = checkTransition(kase, target, user.role)
        if (check.status !== 200) throw new RuleError(check.status, check.status === 501 ? 'not_available' : 'transition_refused', check.message)
        if (check.needsReason && !reason) throw new RuleError(400, 'reason_required', check.message)
        await db.query('UPDATE cases SET stage = $2 WHERE id = $1', [kase.id, target])
        await audit(db, kase.id, user, 'stage_changed', { field: 'stage', before: caseStage(kase), after: target, reason: reason || 'Stage moved' })
      })
    },
  }
}

export { URGENCIES }
