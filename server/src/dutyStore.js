import { CATEGORIES, PRIORITY_FACTORS } from './duties.js'
import { RuleError } from './teams.js'

const officerName = "COALESCE(NULLIF(o.display_name, ''), 'Officer')"
const fields = `
  a.id, a.officer_id AS "officerId", ${officerName} AS "officerName",
  a.type, a.start_at AS "startAt", a.end_at AS "endAt",
  d.title, d.category, a.cancelled_at AS "cancelledAt",
  CASE WHEN a.cancelled_at IS NOT NULL THEN 'cancelled'
       WHEN a.type = 'fixed' THEN 'protected' ELSE 'unscheduled' END AS status,
  CASE WHEN access.full_details OR d.share_location THEN d.location END AS location,
  CASE WHEN access.full_details THEN d.description END AS description,
  CASE WHEN access.full_details THEN d.deadline END AS deadline,
  CASE WHEN access.full_details THEN d.duration_minutes END AS "durationMinutes",
  CASE WHEN access.full_details THEN d.share_location END AS "shareLocation",
  CASE WHEN access.full_details THEN d.priority_factors END AS factors,
  CASE WHEN access.full_details THEN d.remarks END AS remarks,
  CASE WHEN access.can_manage THEN a.team_id END AS "teamId",
  CASE WHEN access.can_manage THEN a.revision END AS revision,
  access.can_manage AS "canManage"
`

function notFound() {
  return new RuleError(404, 'assignment_not_found', 'Duty assignment not found.')
}

async function authorisedTeam(db, managerId, officerId, requiredTeam = null) {
  const { rows } = await db.query(`
    SELECT lead.team_id
    FROM team_memberships lead
    JOIN team_memberships member ON member.team_id = lead.team_id AND member.kind = 'member'
    JOIN users manager ON manager.id = lead.user_id AND manager.role = 'manager' AND manager.status = 'active'
    JOIN users officer ON officer.id = member.user_id AND officer.role = 'member' AND officer.status = 'active'
    WHERE lead.user_id = $1 AND lead.kind = 'manager' AND member.user_id = $2
      AND ($3::uuid IS NULL OR lead.team_id = $3)
    FOR SHARE OF lead, member, manager, officer
  `, [managerId, officerId, requiredTeam])
  return rows[0]?.team_id
}

function requireTeam(team) {
  if (!team) throw new RuleError(403, 'officer_out_of_scope', 'Choose an active officer on a team you manage.')
  return team
}

function dutyValues(input) {
  return [input.title, input.description, input.category, input.durationMinutes, input.deadline,
    input.location, input.shareLocation, input.factors, input.remarks]
}

async function record(db, assignment, actorId, action, previousOfficerId = null) {
  await db.query(`
    INSERT INTO duty_assignment_history (assignment_id, actor_id, officer_id, previous_officer_id, action, revision)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [assignment.id, actorId, assignment.officer_id, previousOfficerId, action, assignment.revision])
  return { id: assignment.id, revision: assignment.revision }
}

export function createDutyStore(pool) {
  async function transaction(work, begin = 'BEGIN') {
    const db = await pool.connect()
    try {
      await db.query(begin)
      const result = await work(db)
      await db.query('COMMIT')
      return result
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    } finally {
      db.release()
    }
  }

  return {
    list(actor, { start, end }) {
      return transaction(async (db) => {
        const { rows: [current] } = await db.query("SELECT role FROM users WHERE id = $1 AND status = 'active'", [actor.id])
        if (!['manager', 'member'].includes(current?.role)) throw new RuleError(403, 'planning_forbidden', 'You do not have access to this.')
        const kind = current.role
        const { rows: officers } = await db.query(`
          SELECT o.id, ${officerName} AS name, CASE WHEN $2 = 'manager' THEN peer.team_id END AS "teamId"
          FROM users o
          LEFT JOIN team_memberships peer ON peer.user_id = o.id AND peer.kind = 'member'
          WHERE o.id = $1 OR (
            o.role = 'member' AND o.status = 'active' AND EXISTS (
              SELECT 1 FROM team_memberships viewer WHERE viewer.user_id = $1 AND viewer.kind = $2 AND viewer.team_id = peer.team_id
            )
          )
          ORDER BY name, o.id
        `, [actor.id, kind])
        const { rows: assignments } = await db.query(`
          SELECT ${fields}
          FROM duty_assignments a
          JOIN duties d ON d.id = a.duty_id
          JOIN users o ON o.id = a.officer_id
          CROSS JOIN LATERAL (
            SELECT (o.role = 'member' AND o.status = 'active' AND EXISTS (
              SELECT 1 FROM team_memberships viewer
              JOIN team_memberships peer ON peer.team_id = viewer.team_id AND peer.kind = 'member'
              WHERE viewer.user_id = $1 AND viewer.kind = $2 AND viewer.team_id = a.team_id AND peer.user_id = o.id
            )) AS team_access
          ) scope
          CROSS JOIN LATERAL (
            SELECT (scope.team_access AND $2 = 'manager') AS can_manage,
                   (a.officer_id = $1 OR (scope.team_access AND $2 = 'manager')) AS full_details
          ) access
          WHERE (a.officer_id = $1 OR scope.team_access)
            AND (a.cancelled_at IS NULL OR access.full_details)
            AND (
              (a.type = 'fixed' AND a.start_at < $4 AND a.end_at > $3)
              OR (a.type = 'flexible' AND access.full_details)
            )
          ORDER BY a.start_at NULLS LAST, d.deadline NULLS LAST, d.title, a.id
        `, [actor.id, kind, start, end])
        return { officers, assignments, categories: CATEGORIES, priorityFactors: PRIORITY_FACTORS }
      }, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    },

    create(actor, input) {
      return transaction(async (db) => {
        const team = requireTeam(await authorisedTeam(db, actor.id, input.officerId))
        const { rows: [duty] } = await db.query(`
          INSERT INTO duties (title, description, category, duration_minutes, deadline, location, share_location, priority_factors, remarks)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, dutyValues(input))
        const { rows: [assignment] } = await db.query(`
          INSERT INTO duty_assignments (duty_id, team_id, officer_id, assigned_by, type, start_at, end_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, officer_id, revision
        `, [duty.id, team, input.officerId, actor.id, input.type, input.startAt, input.endAt])
        return record(db, assignment, actor.id, 'created')
      })
    },

    update(actor, id, { revision, cancel, input }) {
      return transaction(async (db) => {
        const { rows: [current] } = await db.query(`
          SELECT a.* FROM duty_assignments a
          JOIN team_memberships lead ON lead.team_id = a.team_id AND lead.user_id = $1 AND lead.kind = 'manager'
          WHERE a.id = $2 FOR UPDATE OF a
        `, [actor.id, id])
        if (!current || !await authorisedTeam(db, actor.id, current.officer_id, current.team_id)) throw notFound()
        if (current.revision !== revision || current.cancelled_at) {
          throw new RuleError(409, 'assignment_changed', 'This assignment has changed. Refresh the calendar and try again.')
        }
        if (cancel) {
          const { rows: [assignment] } = await db.query(`
            UPDATE duty_assignments SET cancelled_at = now(), revision = revision + 1, updated_at = now()
            WHERE id = $1 RETURNING id, officer_id, revision
          `, [id])
          return record(db, assignment, actor.id, 'cancelled')
        }
        if (current.officer_id !== input.officerId) {
          requireTeam(await authorisedTeam(db, actor.id, input.officerId, current.team_id))
        }
        await db.query(`
          UPDATE duties SET title = $1, description = $2, category = $3, duration_minutes = $4, deadline = $5,
            location = $6, share_location = $7, priority_factors = $8, remarks = $9 WHERE id = $10
        `, [...dutyValues(input), current.duty_id])
        const { rows: [assignment] } = await db.query(`
          UPDATE duty_assignments SET officer_id = $2, type = $3, start_at = $4, end_at = $5,
            revision = revision + 1, updated_at = now()
          WHERE id = $1 RETURNING id, officer_id, revision
        `, [id, input.officerId, input.type, input.startAt, input.endAt])
        return record(db, assignment, actor.id, 'updated', current.officer_id)
      })
    },
  }
}
