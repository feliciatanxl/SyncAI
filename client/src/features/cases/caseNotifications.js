import { caseStage, deadlineCountdown, detectFollowUps, formatDuration } from './caseLogic.js'

// Bell notifications from the cases a person can see. Returns [{ id, key, vars, tone }]: the portal translates
// `key`. Ids include what changed, so a new event shows as unread even for the same case. Most urgent first.
export function caseNotifications(cases, me, now = new Date()) {
  const out = []
  for (const c of cases) {
    if (caseStage(c) === 'closed') continue
    const { tone, minutes } = deadlineCountdown(c.deadline, now)
    if (tone === 'overdue') out.push({ id: `overdue:${c.id}:${c.deadline}`, key: 'notif.case.overdue', vars: { case: c.number, time: formatDuration(minutes) }, caseTitle: c.title, tone: 'bad', rank: 0 })
    else if (tone === 'soon') out.push({ id: `soon:${c.id}:${c.deadline}`, key: 'notif.case.dueSoon', vars: { case: c.number, time: formatDuration(minutes) }, caseTitle: c.title, tone: 'warn', rank: 2 })
    for (const f of detectFollowUps(c, now).filter((f) => f.severity === 'critical')) {
      out.push({ id: `fu:${f.id}`, key: 'notif.case.critical', vars: { case: c.number, what: f.title }, caseTitle: c.title, tone: 'bad', rank: 1 })
    }
    const req = c.pendingRequest
    if (req && me.role === 'manager') out.push({ id: `req:${c.id}:${req.at}`, key: 'notif.case.decide', vars: { case: c.number }, caseTitle: c.title, tone: 'info', rank: 1 })
    else if (req) out.push({ id: `req:${c.id}:${req.at}`, key: 'notif.case.waiting', vars: { case: c.number }, caseTitle: c.title, tone: 'info', rank: 3 })
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, 8)
}
