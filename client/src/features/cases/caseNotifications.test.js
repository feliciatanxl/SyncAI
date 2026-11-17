import { describe, expect, it } from 'vitest'
import { caseNotifications } from './caseNotifications.js'

const now = new Date('2026-11-17T09:00:00+08:00')
const hours = (h) => new Date(now.getTime() + h * 3_600_000).toISOString()
const base = (over) => ({ id: 'c', number: 'C-1', title: 'Case', stage: 'in_progress', ownerId: 'u1', blockers: [], checkpoints: [], evidence: [], timeline: [], pendingRequest: null, ...over })

describe('caseNotifications', () => {
  it('lists overdue, critical and due-soon cases, most urgent first, and skips closed ones', () => {
    const list = caseNotifications([
      base({ id: 'soon', deadline: hours(3) }),
      base({ id: 'late', deadline: hours(-2) }),
      base({ id: 'done', stage: 'closed', deadline: hours(-9) }),
      base({ id: 'insp', deadline: hours(40), checkpoints: [{ id: 'i', kind: 'inspection', title: 'Inspect', completed: false, due: hours(-1) }] }),
    ], { role: 'member' }, now)
    expect(list.map((n) => n.key)).toEqual(['notif.case.overdue', 'notif.case.critical', 'notif.case.dueSoon'])
  })

  it('tells managers a request needs a decision and members theirs is waiting', () => {
    const req = base({ id: 'r', deadline: hours(40), pendingRequest: { type: 'closure', at: '2026-11-17T01:00:00Z' } })
    expect(caseNotifications([req], { role: 'manager' }, now).map((n) => n.key)).toEqual(['notif.case.decide'])
    expect(caseNotifications([req], { role: 'member' }, now).map((n) => n.key)).toEqual(['notif.case.waiting'])
  })
})
