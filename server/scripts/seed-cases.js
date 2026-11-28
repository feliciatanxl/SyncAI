// Adds FICTIONAL development cases to one existing team. Never runs on its own: you must name the team and pass --yes.
//
//   DATABASE_URL=postgres://…@localhost/… node scripts/seed-cases.js --team "Zone A Team" --yes            add (skips existing)
//   DATABASE_URL=postgres://…@localhost/… node scripts/seed-cases.js --team "Zone A Team" --remove --yes   remove them
//
// Local databases only: it refuses any remote DATABASE_URL (such as Railway's), with no override.
//
// It reads DATABASE_URL, so check which database that is first. It never creates or changes users, teams, roles or
// memberships, and never runs migrations (start the server once so the case tables exist). Cases are owned by the
// team's members in turn, or by its manager if it has no members. Every case is marked fictional = true and numbered
// DEV-CAS-…, and --remove deletes only those.
import pg from 'pg'
import { databaseHost } from '../src/dbTarget.js'

const args = process.argv.slice(2)
const teamName = args[args.indexOf('--team') + 1]
if (!args.includes('--team') || !teamName || teamName.startsWith('--') || !args.includes('--yes')) {
  console.error('Usage: node --env-file=.env scripts/seed-cases.js --team "<existing team name>" [--remove] --yes')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
// Fictional data never goes into a remote (shared/production) database. There is deliberately no override.
const { host, local } = databaseHost(process.env.DATABASE_URL)
if (!local) {
  console.error(`Refusing to seed fictional cases into the remote database ${host}. Seeding is for local databases only.`)
  process.exit(1)
}

const hours = (h) => new Date(Date.now() + h * 3_600_000).toISOString()

// Fictional cases adapted from client/src/features/cases/demoCases.js. No real residents, units or contractors.
const CASES = [
  {
    number: 'DEV-CAS-001', title: 'Ceiling seepage at Blk 211', category: 'Resident feedback', stage: 'in_progress', estate: 'Zone A', block: 'Blk 211',
    location: 'Unit (fictional)', urgency: 'high', deadline: hours(6), contact: 'Fictional resident A',
    description: 'Resident reported ceiling seepage. Inspect the unit, update the resident and prepare the repair work order.',
    blockers: [{ title: 'Upper unit not reachable for joint inspection', party: 'Upper-unit resident', type: 'resident' }],
    checkpoints: [
      { kind: 'inspection', title: 'Inspect ceiling moisture', completed: true },
      { kind: 'resident', title: 'Call resident with inspection update', due: hours(-2) },
      { kind: 'inspection', title: 'Joint inspection with upper unit', due: hours(30) },
    ],
    evidence: [{ title: 'Ceiling seepage photo', status: 'verified' }, { title: 'Joint inspection notice copy', status: 'missing' }],
    note: 'Water stains above master bedroom toilet.',
  },
  {
    number: 'DEV-CAS-002', title: 'Refuse chute hopper fault at Blk 310', category: 'Maintenance', stage: 'pending_external', estate: 'Zone B', block: 'Blk 310',
    location: 'Common lobby', urgency: 'high', deadline: hours(5),
    description: 'Hopper door jammed ajar, causing odour in the lobby. Contractor to replace the hinge.',
    blockers: [{ title: 'Contractor quotation for hinge replacement', party: 'Fictional Conservancy Pte Ltd', type: 'contractor', due: hours(3) }],
    checkpoints: [{ kind: 'inspection', title: 'Inspect hopper latch', completed: true }, { kind: 'appointment', title: 'Contractor repair visit', due: hours(8) }],
    evidence: [{ title: 'Hopper latch photo', status: 'pending_review' }],
    note: 'Hopper door jammed ajar.',
  },
  {
    number: 'DEV-CAS-003', title: 'Drain obstruction at Blk 405', category: 'Cleaning', stage: 'open', estate: 'Zone C', block: 'Blk 405',
    location: 'Perimeter drain', urgency: 'medium', deadline: hours(50),
    description: 'Possible drain obstruction near the block. Confirm location and extent on site.',
    blockers: [], checkpoints: [{ kind: 'inspection', title: 'Perimeter drain inspection', due: hours(48) }], evidence: [],
    note: 'Leaves and silt near the perimeter drain.',
  },
  {
    number: 'DEV-CAS-004', title: 'Corridor lighting repaired at Blk 214', category: 'Maintenance', stage: 'in_progress', estate: 'Zone A', block: 'Blk 214',
    location: 'Level 7 corridor', urgency: 'low', deadline: hours(30),
    description: 'Two corridor lights were out. Contractor replaced both fittings.',
    blockers: [],
    checkpoints: [{ kind: 'inspection', title: 'Check corridor lighting', completed: true }, { kind: 'contractor', title: 'Contractor replaces fittings', completed: true }],
    evidence: [{ title: 'Completion photo', status: 'verified' }],
    note: 'Contractor replaced both fittings.',
  },
]

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  const team = (await client.query('SELECT id, name FROM teams WHERE lower(name) = lower($1)', [teamName])).rows[0]
  if (!team) throw new Error(`No team named "${teamName}". Create it in the Admin portal first; this script never creates teams.`)

  if (args.includes('--remove')) {
    const ids = (await client.query('SELECT id FROM cases WHERE team_id = $1 AND fictional AND number LIKE $2', [team.id, 'DEV-CAS-%'])).rows.map((r) => r.id)
    await client.query('DELETE FROM case_history WHERE case_id = ANY($1)', [ids])
    await client.query('DELETE FROM cases WHERE id = ANY($1)', [ids])
    await client.query('COMMIT')
    console.log(`Removed ${ids.length} fictional cases from ${team.name}.`)
  } else {
    const people = (await client.query(
      `SELECT u.id, m.kind FROM team_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.team_id = $1 AND u.status = 'active' ORDER BY m.kind = 'member' DESC, u.created_at`,
      [team.id],
    )).rows
    const members = people.filter((p) => p.kind === 'member')
    const owners = members.length ? members : people
    if (!owners.length) throw new Error(`${team.name} has no active manager or members to own the cases.`)
    let added = 0
    for (const [i, c] of CASES.entries()) {
      const row = (await client.query(
        `INSERT INTO cases (number, team_id, owner_id, title, category, estate, block, location, urgency, stage, description, deadline, fictional)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true) ON CONFLICT (number) DO NOTHING RETURNING id`,
        [c.number, team.id, owners[i % owners.length].id, c.title, c.category, c.estate, c.block, c.location, c.urgency, c.stage, c.description, c.deadline],
      )).rows[0]
      if (!row) continue
      added++
      if (c.contact) await client.query('INSERT INTO case_contacts (case_id, name) VALUES ($1, $2)', [row.id, c.contact])
      for (const b of c.blockers) {
        await client.query('INSERT INTO case_blockers (case_id, title, responsible_party, party_type, due) VALUES ($1, $2, $3, $4, $5)', [row.id, b.title, b.party, b.type, b.due ?? null])
      }
      for (const [pos, cp] of c.checkpoints.entries()) {
        await client.query(
          'INSERT INTO case_checkpoints (case_id, kind, title, due, completed, completed_at, position) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [row.id, cp.kind, cp.title, cp.due ?? null, Boolean(cp.completed), cp.completed ? hours(-6) : null, pos],
        )
      }
      for (const e of c.evidence) {
        await client.query(
          'INSERT INTO case_evidence (case_id, title, status, uploaded_at, uploaded_by, verified_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [row.id, e.title, e.status, e.status === 'missing' ? null : hours(-6), e.status === 'missing' ? null : 'Seed data', e.status === 'verified' ? 'Seed data' : null],
        )
      }
      await client.query(
        `INSERT INTO case_events (case_id, at, kind, type, title, summary, source, actor_label) VALUES ($1, $2, 'timeline', 'reported', 'Case reported', $3, 'Seed data', 'Intake')`,
        [row.id, hours(-40), c.note],
      )
    }
    await client.query('COMMIT')
    console.log(`Added ${added} fictional cases to ${team.name} (${CASES.length - added} were already there).`)
  }
} catch (err) {
  await client.query('ROLLBACK')
  console.error(err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
