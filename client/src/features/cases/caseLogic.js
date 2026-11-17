// Case Action Centre domain rules: pure functions, no React, no storage, no network.
// Ported from the prototype (prototype/js/cases.js, state.js) but driven only by fields on the case record,
// so every explanation points at a real record instead of hard-coded example facts.

export const STAGES = ['open', 'in_progress', 'pending_external', 'ready_for_closure', 'closed']
export const URGENCIES = ['critical', 'high', 'medium', 'low']

const HOUR = 3_600_000
const STALE_HOURS = 48
const SOON_HOURS = 24

// Who may open the Case Action Centre at all. Admins manage accounts, not casework.
// Client-side only: the API must enforce the same rule (see client/README.md).
export const canUseCaseCentre = (me) => me?.status === 'active' && (me.role === 'member' || me.role === 'manager')

// Cases this person may see: members their own, managers their team's (and their own).
export function visibleCases(cases, me, managedOfficerIds = []) {
  if (!canUseCaseCentre(me)) return []
  if (me.role === 'member') return cases.filter((c) => c.ownerId === me.id)
  const scope = new Set([me.id, ...managedOfficerIds])
  return cases.filter((c) => scope.has(c.ownerId))
}

const activeBlockers = (c) => (c.blockers ?? []).filter((b) => !b.resolved)

// Exactly one Kanban column per case. An active blocker wins over "in progress" so a case never shows twice.
export function caseStage(c) {
  if (c.stage === 'closed') return 'closed'
  if (c.stage === 'ready_for_closure') return 'ready_for_closure'
  if (c.stage === 'pending_external' || activeBlockers(c).length) return 'pending_external'
  if (c.stage === 'in_progress') return 'in_progress'
  return 'open'
}

// Time left to a deadline. tone: overdue | soon (under 24 h) | ok | none.
export function deadlineCountdown(due, now = new Date()) {
  if (!due) return { tone: 'none', minutes: null }
  const minutes = Math.round((new Date(due) - now) / 60_000)
  return { tone: minutes < 0 ? 'overdue' : minutes < SOON_HOURS * 60 ? 'soon' : 'ok', minutes }
}

// "3 h 20 min", "2 d 4 h"; always positive (the caller says whether it is left or overdue).
export function formatDuration(minutes) {
  const m = Math.abs(minutes)
  if (m >= 48 * 60) return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`
  if (m >= 60) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
  return `${m} min`
}

const pendingCheckpoints = (c, kind) => (c.checkpoints ?? []).filter((cp) => !cp.completed && (!kind || cp.kind === kind))
const cpRecord = (cp) => ({ type: 'checkpoint', id: cp.id, label: cp.title })

// Follow-Up Radar: outstanding commitments found by fixed rules. Each finding names the rule, the record it
// came from and what is missing. Rule-based, not a model: every finding needs a person to review it.
export function detectFollowUps(c, now = new Date()) {
  if (caseStage(c) === 'closed') return []
  const out = []
  const add = (f) => out.push({ ...f, id: `${c.id}:${f.ruleId}:${f.record.id}`, caseId: c.id, caseNumber: c.number, caseTitle: c.title })

  for (const cp of pendingCheckpoints(c, 'resident')) {
    add({
      ruleId: 'resident_callback', severity: 'warning', title: 'Resident callback outstanding', due: cp.due, record: cpRecord(cp),
      reason: `A resident update was promised ("${cp.title}") and no completed callback is recorded.`,
      threshold: 'Resident updates are due by the recorded follow-up date.',
      nextStep: 'Call the resident and log the outcome as a communication.',
    })
  }
  for (const b of activeBlockers(c).filter((b) => b.partyType === 'contractor')) {
    add({
      ruleId: 'contractor_pending', severity: 'warning', title: 'Contractor confirmation pending', due: b.due, record: { type: 'blocker', id: b.id, label: b.title },
      reason: `Blocker "${b.title}" is unresolved${b.responsibleParty ? ` and waiting on ${b.responsibleParty}` : ''}.`,
      threshold: 'External dependencies stay flagged until a person marks them resolved.',
      nextStep: 'Chase the contractor and record their confirmation.',
    })
  }
  for (const cp of pendingCheckpoints(c, 'contractor').filter((cp) => !cp.due || new Date(cp.due) - now < SOON_HOURS * HOUR)) {
    add({
      ruleId: 'contractor_pending', severity: 'warning', title: 'Contractor confirmation pending', due: cp.due, record: cpRecord(cp),
      reason: `Contractor step "${cp.title}" is not marked complete.`,
      threshold: 'External dependencies stay flagged until a person marks them complete.',
      nextStep: 'Confirm the contractor appointment and record it.',
    })
  }
  for (const cp of pendingCheckpoints(c, 'inspection').filter((cp) => cp.due && new Date(cp.due) < now)) {
    add({
      ruleId: 'inspection_outcome', severity: 'critical', title: 'Inspection outcome not recorded', due: cp.due, record: cpRecord(cp),
      reason: `Inspection "${cp.title}" was due and no outcome is recorded.`,
      threshold: 'Inspection findings are recorded once the scheduled inspection time has passed.',
      nextStep: 'Record the inspection findings and attach the service log.',
    })
  }
  for (const cp of pendingCheckpoints(c, 'appointment').filter((cp) => cp.due && new Date(cp.due) - now < SOON_HOURS * HOUR)) {
    add({
      ruleId: 'appointment_unconfirmed', severity: 'warning', title: 'Appointment not confirmed', due: cp.due, record: cpRecord(cp),
      reason: `Appointment "${cp.title}" is within 24 hours and has no recorded confirmation.`,
      threshold: 'Appointments are confirmed at least 24 hours ahead.',
      nextStep: 'Confirm access with the resident or contractor.',
    })
  }
  for (const e of (c.evidence ?? []).filter((e) => e.status === 'missing' && e.requiredForClosure)) {
    add({
      ruleId: 'missing_evidence', severity: 'warning', title: 'Required evidence missing', due: c.deadline, record: { type: 'evidence', id: e.id, label: e.title },
      reason: `"${e.title}" is required for closure and has not been uploaded.`,
      threshold: 'Every evidence item marked required must be uploaded and verified before closure.',
      nextStep: 'Upload the document, then ask a manager to verify it.',
    })
  }
  const last = [...(c.timeline ?? [])].sort((a, b) => new Date(b.at) - new Date(a.at))[0]
  if (last && ['open', 'in_progress'].includes(caseStage(c)) && now - new Date(last.at) > STALE_HOURS * HOUR) {
    add({
      ruleId: 'stale_case', severity: 'warning', title: 'No update in 48 hours', due: c.deadline, record: { type: 'timeline', id: last.id, label: last.title },
      reason: `The latest timeline entry ("${last.title}") is more than 48 hours old.`,
      threshold: 'Active cases record progress at least every 48 hours.',
      nextStep: 'Add a progress note with the current status.',
    })
  }
  return out
}

// What still stands between this case and closure. `items` are plain-language gaps.
export function closureReadiness(c) {
  const items = []
  for (const b of activeBlockers(c)) items.push(`Resolve blocker: ${b.title}`)
  for (const e of c.evidence ?? []) {
    if (!e.requiredForClosure) continue
    if (e.status === 'missing') items.push(`Upload required evidence: ${e.title}`)
    else if (e.status !== 'verified') items.push(`Verify evidence: ${e.title}`)
  }
  for (const cp of c.checkpoints ?? []) {
    if (cp.requiredForClosure && !cp.completed) items.push(`Complete: ${cp.title}${cp.requiresManager ? ' (manager sign-off)' : ''}`)
  }
  const checks = [
    ...(c.checkpoints ?? []).filter((cp) => cp.requiredForClosure).map((cp) => ({ label: cp.title, done: cp.completed })),
    ...(c.evidence ?? []).filter((e) => e.requiredForClosure).map((e) => ({ label: e.title, done: e.status === 'verified' })),
    { label: 'No active blockers', done: activeBlockers(c).length === 0 },
  ]
  return { ready: items.length === 0, items, checks }
}

// Whether `me` may move a case to `target`. Returns { allowed, needsReason, needsApproval, message }.
// Mirrors the prototype's canTransitionCase; the server must re-check the same rules.
export function checkTransition(c, target, me, managedOfficerIds = []) {
  if (!canUseCaseCentre(me)) return { allowed: false, message: 'Your account cannot change cases.' }
  const manager = me.role === 'manager'
  const inScope = manager ? c.ownerId === me.id || managedOfficerIds.includes(c.ownerId) : c.ownerId === me.id
  if (!inScope) return { allowed: false, message: manager ? 'This case is outside the teams you manage.' : 'You can only change cases assigned to you.' }
  if (!STAGES.includes(target)) return { allowed: false, message: 'Unknown stage.' }
  const current = caseStage(c)
  if (current === target) return { allowed: false, message: 'The case is already in this stage.' }
  if (c.pendingRequest) return { allowed: false, message: 'A request on this case is waiting for a manager decision.' }

  if (current === 'closed') {
    return manager
      ? { allowed: true, needsReason: true, message: 'Reopening a closed case needs a recorded reason.' }
      : { allowed: false, message: 'Only a manager can reopen a closed case.' }
  }
  if (target === 'pending_external') return { allowed: true, needsReason: true, message: 'Say what the case is waiting on.' }
  if (current === 'pending_external' && activeBlockers(c).length) {
    return { allowed: false, message: `Resolve the active blocker first: ${activeBlockers(c)[0].title}.` }
  }
  const readiness = closureReadiness(c)
  if (target === 'ready_for_closure' && !readiness.ready) return { allowed: false, message: `Not ready to close: ${readiness.items[0]}.` }
  if (target === 'closed') {
    if (!manager) return { allowed: true, needsApproval: true, needsReason: true, message: 'Closing needs a manager’s approval. Your request goes to them.' }
    if (!readiness.ready) return { allowed: false, message: `Closure checklist incomplete: ${readiness.items[0]}.` }
    if (current !== 'ready_for_closure') return { allowed: false, message: 'Move the case to Closure Ready before closing it.' }
    return { allowed: true, message: 'You can sign off this closure.' }
  }
  return { allowed: true, message: '' }
}

// Plain-English case brief, assembled by fixed templates from the case's own records.
export function caseBrief(c, now = new Date()) {
  const followUps = detectFollowUps(c, now)
  const readiness = closureReadiness(c)
  const done = (c.checkpoints ?? []).filter((cp) => cp.completed)
  return {
    summary: `${c.title} (${c.number}) at ${[c.block, c.unit].filter(Boolean).join(' ')}. ${c.description ?? ''}`.trim(),
    completed: done.map((cp) => cp.title),
    outstanding: readiness.items,
    nextSteps: [...new Set(followUps.map((f) => f.nextStep))],
    sources: [
      ...done.map((cp) => `Checkpoint: ${cp.title}`),
      ...(c.evidence ?? []).filter((e) => e.status !== 'missing').map((e) => `Evidence: ${e.title}`),
      ...(c.timeline ?? []).map((e) => `Timeline: ${e.title}`),
    ],
    missing: (c.evidence ?? []).filter((e) => e.status === 'missing').map((e) => e.title),
  }
}

// The four summary-card counts, from the same rules the lists use.
export function caseSummary(cases, now = new Date()) {
  const open = cases.filter((c) => caseStage(c) !== 'closed')
  return {
    open: open.length,
    followUps: open.reduce((n, c) => n + detectFollowUps(c, now).length, 0),
    blocked: open.filter((c) => caseStage(c) === 'pending_external').length,
    ready: open.filter((c) => caseStage(c) === 'ready_for_closure').length,
  }
}

const URGENCY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

// Work order for a shift: overdue first, then due within 24 h, then by urgency, then soonest deadline. Closed last.
export function byPriority(cases, now = new Date()) {
  const key = (c) => {
    const { tone } = deadlineCountdown(c.deadline, now)
    return [caseStage(c) === 'closed' ? 1 : 0, { overdue: 0, soon: 1 }[tone] ?? 2, URGENCY_RANK[c.urgency] ?? 4, c.deadline ? new Date(c.deadline).getTime() : Infinity]
  }
  return [...cases].sort((a, b) => {
    const ka = key(a), kb = key(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]
    return 0
  })
}

// Counts for the shift banner: open cases that are overdue, and due within the next 24 hours.
export function shiftCounts(cases, now = new Date()) {
  const open = cases.filter((c) => caseStage(c) !== 'closed')
  const tone = (c) => deadlineCountdown(c.deadline, now).tone
  return { overdue: open.filter((c) => tone(c) === 'overdue').length, dueSoon: open.filter((c) => tone(c) === 'soon').length }
}
