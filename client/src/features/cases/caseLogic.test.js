import { describe, expect, it } from 'vitest'
import { memberSections } from '../../lib/sections.js'
import {
  byPriority, canUseCaseCentre, caseBrief, shiftCounts, caseStage, caseSummary, checkTransition, closureReadiness, deadlineCountdown, detectFollowUps, formatDuration, STAGES, visibleCases,
} from './caseLogic.js'
import { demoCases } from './demoCases.js'

const now = new Date('2026-11-17T09:00:00+08:00')
const member = { id: 'u1', status: 'active', role: 'member', displayName: 'Officer One' }
const manager = { id: 'm1', status: 'active', role: 'manager', displayName: 'Manager' }
const base = (over = {}) => ({
  id: 'c1', number: 'C-1', title: 'Case', stage: 'in_progress', ownerId: 'u1', urgency: 'high', deadline: null,
  blockers: [], checkpoints: [], evidence: [], timeline: [], history: [], communications: [], pendingRequest: null, ...over,
})
const hours = (h) => new Date(now.getTime() + h * 3_600_000).toISOString()

describe('case access and visibility', () => {
  it('lets only active members and managers in', () => {
    expect(canUseCaseCentre(member)).toBe(true)
    expect(canUseCaseCentre(manager)).toBe(true)
    expect(canUseCaseCentre({ status: 'active', role: 'admin' })).toBe(false)
    expect(canUseCaseCentre({ status: 'pending', role: 'member' })).toBe(false)
    expect(canUseCaseCentre({ status: 'disabled', role: 'manager' })).toBe(false)
  })

  it('adds the sidebar section only for active accounts', () => {
    expect(memberSections(member)).toContain('cases')
    expect(memberSections(manager)).toContain('cases')
    for (const status of ['pending', 'disabled']) expect(memberSections({ status, role: 'member' })).not.toContain('cases')
    expect(memberSections(member)).toEqual(['overview', 'assistant', 'cases', 'tasks', 'plan', 'decides', 'settings'])
  })

  it('shows members their own cases and managers their teams’', () => {
    const cases = [base({ id: 'a', ownerId: 'u1' }), base({ id: 'b', ownerId: 'u2' }), base({ id: 'c', ownerId: 'x' })]
    expect(visibleCases(cases, member).map((c) => c.id)).toEqual(['a'])
    expect(visibleCases(cases, manager, ['u1', 'u2']).map((c) => c.id)).toEqual(['a', 'b'])
    expect(visibleCases(cases, { ...member, role: 'admin' })).toEqual([])
  })
})

describe('caseStage (Kanban)', () => {
  it('puts every case in exactly one column, blockers winning over in-progress', () => {
    expect(caseStage(base({ stage: 'in_progress', blockers: [{ id: 'b', title: 'x', resolved: false }] }))).toBe('pending_external')
    expect(caseStage(base({ stage: 'in_progress', blockers: [{ id: 'b', title: 'x', resolved: true }] }))).toBe('in_progress')
    expect(caseStage(base({ stage: 'closed', blockers: [{ id: 'b', title: 'x', resolved: false }] }))).toBe('closed')
    expect(caseStage(base({ stage: 'weird' }))).toBe('open')
    for (const c of demoCases(member, now)) expect(STAGES.filter((s) => caseStage(c) === s)).toHaveLength(1)
  })
})

describe('deadlineCountdown', () => {
  it('classifies overdue, soon, ok and none', () => {
    expect(deadlineCountdown(hours(-2), now)).toEqual({ tone: 'overdue', minutes: -120 })
    expect(deadlineCountdown(hours(5), now).tone).toBe('soon')
    expect(deadlineCountdown(hours(30), now).tone).toBe('ok')
    expect(deadlineCountdown(null, now).tone).toBe('none')
  })
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(-200)).toBe('3 h 20 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(3 * 1440 + 60)).toBe('3 d 1 h')
  })
})

describe('detectFollowUps', () => {
  it('flags each rule from the record it came from', () => {
    const c = base({
      blockers: [{ id: 'b1', title: 'Quote', partyType: 'contractor', responsibleParty: 'Acme', resolved: false }],
      checkpoints: [
        { id: 'r', kind: 'resident', title: 'Call resident', completed: false, due: hours(-1) },
        { id: 'i', kind: 'inspection', title: 'Inspect', completed: false, due: hours(-1) },
        { id: 'a', kind: 'appointment', title: 'Visit', completed: false, due: hours(3) },
      ],
      evidence: [{ id: 'e', title: 'Notice', status: 'missing', requiredForClosure: true }],
      timeline: [{ id: 't', at: hours(-72), title: 'Reported' }],
    })
    const found = detectFollowUps(c, now)
    // No stale_case: the active blocker makes this "awaiting external", where silence is expected.
    expect(found.map((f) => f.ruleId).sort()).toEqual(['appointment_unconfirmed', 'contractor_pending', 'inspection_outcome', 'missing_evidence', 'resident_callback'])
    expect(detectFollowUps(base({ timeline: [{ id: 't', at: hours(-72), title: 'Reported' }] }), now).map((f) => f.ruleId)).toEqual(['stale_case'])
    for (const f of found) {
      expect(f.record.id).toBeTruthy()
      expect(f.reason).toBeTruthy()
      expect(f.nextStep).toBeTruthy()
    }
    expect(found.find((f) => f.ruleId === 'contractor_pending').reason).toContain('Acme')
  })

  it('does not flag completed, future or closed work', () => {
    const quiet = base({
      checkpoints: [
        { id: 'r', kind: 'resident', title: 'Call', completed: true },
        { id: 'i', kind: 'inspection', title: 'Inspect', completed: false, due: hours(10) },
        { id: 'a', kind: 'appointment', title: 'Visit', completed: false, due: hours(48) },
      ],
      evidence: [{ id: 'e', title: 'Photo', status: 'missing', requiredForClosure: false }],
      timeline: [{ id: 't', at: hours(-1), title: 'Note' }],
    })
    expect(detectFollowUps(quiet, now)).toEqual([])
    expect(detectFollowUps(base({ stage: 'closed', checkpoints: [{ id: 'r', kind: 'resident', title: 'x', completed: false }] }), now)).toEqual([])
  })
})

describe('closure and transitions', () => {
  const ready = base({ stage: 'ready_for_closure', checkpoints: [{ id: 'k', title: 'Done', completed: true, requiredForClosure: true }], evidence: [{ id: 'e', title: 'Photo', status: 'verified', requiredForClosure: true }] })

  it('lists what blocks closure', () => {
    const r = closureReadiness(base({ evidence: [{ id: 'e', title: 'Photo', status: 'pending_review', requiredForClosure: true }], blockers: [{ id: 'b', title: 'Wait', resolved: false }] }))
    expect(r.ready).toBe(false)
    expect(r.items).toEqual(['Resolve blocker: Wait', 'Verify evidence: Photo'])
    expect(closureReadiness(ready).ready).toBe(true)
  })

  it('blocks out-of-scope and admin changes', () => {
    expect(checkTransition(base({ ownerId: 'other' }), 'open', member).allowed).toBe(false)
    expect(checkTransition(base({ ownerId: 'other' }), 'open', manager, []).allowed).toBe(false)
    expect(checkTransition(base(), 'open', { ...manager, role: 'admin' }).allowed).toBe(false)
    expect(checkTransition(base({ ownerId: 'u1' }), 'open', manager, ['u1']).allowed).toBe(true)
  })

  it('enforces blocker, checklist and approval rules', () => {
    const blocked = base({ stage: 'pending_external', blockers: [{ id: 'b', title: 'Wait', resolved: false }] })
    expect(checkTransition(blocked, 'in_progress', member).allowed).toBe(false)
    expect(checkTransition(base(), 'pending_external', member)).toMatchObject({ allowed: true, needsReason: true })
    expect(checkTransition(base({ evidence: [{ id: 'e', title: 'x', status: 'missing', requiredForClosure: true }] }), 'ready_for_closure', member).allowed).toBe(false)
    expect(checkTransition(ready, 'closed', member)).toMatchObject({ allowed: true, needsApproval: true })
    expect(checkTransition(ready, 'closed', manager, ['u1'])).toMatchObject({ allowed: true })
    expect(checkTransition(ready, 'closed', manager, ['u1']).needsApproval).toBeFalsy()
    expect(checkTransition(base(), 'closed', manager, ['u1']).allowed).toBe(false)
    expect(checkTransition({ ...ready, pendingRequest: { type: 'closure' } }, 'in_progress', member).allowed).toBe(false)
    expect(checkTransition(base({ stage: 'closed' }), 'in_progress', member).allowed).toBe(false)
    expect(checkTransition(base({ stage: 'closed' }), 'in_progress', manager, ['u1'])).toMatchObject({ allowed: true, needsReason: true })
  })
})

describe('summary and brief', () => {
  it('counts the summary cards from the same rules', () => {
    const cases = demoCases(member, now)
    const s = caseSummary(cases, now)
    expect(s.open).toBe(cases.filter((c) => c.stage !== 'closed').length)
    expect(s.blocked).toBe(cases.filter((c) => caseStage(c) === 'pending_external').length)
    expect(s.ready).toBe(1)
    expect(s.followUps).toBe(cases.reduce((n, c) => n + detectFollowUps(c, now).length, 0))
  })

  it('builds the brief only from the case records', () => {
    const c = demoCases(member, now)[0]
    const b = caseBrief(c, now)
    expect(b.summary).toContain(c.number)
    expect(b.completed).toEqual(c.checkpoints.filter((cp) => cp.completed).map((cp) => cp.title))
    expect(b.missing).toEqual(['Joint inspection notice copy'])
    for (const s of b.sources) expect(s).toMatch(/^(Checkpoint|Evidence|Timeline): /)
  })
})

describe('shift ordering', () => {
  it('puts overdue, then due-soon, then urgency first and closed cases last', () => {
    const list = [
      base({ id: 'closed', stage: 'closed', urgency: 'critical', deadline: hours(-5) }),
      base({ id: 'later-critical', urgency: 'critical', deadline: hours(48) }),
      base({ id: 'soon-low', urgency: 'low', deadline: hours(3) }),
      base({ id: 'overdue-low', urgency: 'low', deadline: hours(-1) }),
      base({ id: 'later-high', urgency: 'high', deadline: hours(30) }),
    ]
    expect(byPriority(list, now).map((c) => c.id)).toEqual(['overdue-low', 'soon-low', 'later-critical', 'later-high', 'closed'])
    expect(shiftCounts(list, now)).toEqual({ overdue: 1, dueSoon: 1 })
  })
})
