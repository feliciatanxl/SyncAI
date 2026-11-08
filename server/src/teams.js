// Team rules, shared by the Postgres store and the tests' fake store so both enforce exactly the same thing.
// PoC assumptions (to confirm with the client): each team member belongs to one team, a manager can lead
// several, and admins manage access rather than sitting in teams.

// A rule broken by the request rather than a server fault: sent to the client with its status and code.
export class RuleError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
    this.expose = true
  }
}

export const KINDS = ['manager', 'member']

export function cleanTeamName(name) {
  const trimmed = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''
  if (!trimmed || trimmed.length > 80) throw new RuleError(400, 'name_invalid', 'Team name must be 1 to 80 characters.')
  return trimmed
}

// Can this person be placed in this team, in this capacity? Throws a RuleError if not.
export function checkPlacement({ user, kind, inThisTeam, memberTeamName }) {
  if (!KINDS.includes(kind)) throw new RuleError(400, 'invalid_kind', 'kind must be manager or member.')
  if (!user) throw new RuleError(404, 'user_not_found', 'User not found.')
  if (user.role === 'admin') throw new RuleError(400, 'admin_not_allowed', 'Admins manage access and can’t be in a team.')
  if (kind === 'manager' && user.role !== 'manager') throw new RuleError(400, 'not_manager', 'Only people with the Manager role can manage a team.')
  if (kind === 'member' && user.role !== 'member') throw new RuleError(400, 'not_member', 'Only team members can join a team as a member.')
  if (user.status === 'disabled') throw new RuleError(400, 'disabled', 'Turn their access back on before adding them to a team.')
  if (inThisTeam) throw new RuleError(409, 'already_in_team', 'They’re already in this team.')
  if (kind === 'member' && memberTeamName) {
    throw new RuleError(409, 'member_has_team', `They’re already in ${memberTeamName}. Remove them there first.`, { team: memberTeamName })
  }
}

// Memberships that no longer fit after a role change: managers lead teams, team members belong to one.
export function staleKinds(newRole) {
  if (newRole === 'manager') return ['member']
  if (newRole === 'member') return ['manager']
  return ['manager', 'member']
}
