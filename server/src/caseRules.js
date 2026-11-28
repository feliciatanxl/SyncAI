// Case stage rules, enforced on the server. Mirrors client/src/features/cases/caseLogic.js (caseStage,
// closureReadiness, checkTransition) so the dialog's explanation and the server's decision agree; the server's
// answer is the one that counts. V1 differences: closure requests, manager approvals and reopening a closed
// case are refused with 501, because those workflows have no backend yet.

export const STAGES = ['open', 'in_progress', 'pending_external', 'ready_for_closure', 'closed']
export const URGENCIES = ['critical', 'high', 'medium', 'low']

const activeBlockers = (c) => c.blockers.filter((b) => !b.resolved)

// Exactly one Kanban column per case: an active blocker wins over "in progress".
export function caseStage(c) {
  if (c.stage === 'closed' || c.stage === 'ready_for_closure') return c.stage
  if (c.stage === 'pending_external' || activeBlockers(c).length) return 'pending_external'
  return c.stage === 'in_progress' ? 'in_progress' : 'open'
}

// Plain-language gaps between this case and closure.
export function closureGaps(c) {
  const items = activeBlockers(c).map((b) => `Resolve blocker: ${b.title}`)
  for (const e of c.evidence) {
    if (!e.requiredForClosure) continue
    if (e.status === 'missing') items.push(`Upload required evidence: ${e.title}`)
    else if (e.status !== 'verified') items.push(`Verify evidence: ${e.title}`)
  }
  for (const cp of c.checkpoints) {
    if (cp.requiredForClosure && !cp.completed) items.push(`Complete: ${cp.title}${cp.requiresManager ? ' (manager sign-off)' : ''}`)
  }
  return items
}

// May `role` ('manager' | 'member') move this case (already known to be in their scope) to `target`?
// Returns { status, message, needsReason } where status is 200 (allowed), 409 (rule), 400 or 501 (not built yet).
export function checkTransition(c, target, role) {
  if (!STAGES.includes(target)) return { status: 400, message: `target must be one of ${STAGES.join(', ')}.` }
  const current = caseStage(c)
  if (current === target) return { status: 409, message: 'The case is already in this stage.' }
  if (current === 'closed') return { status: 501, message: 'Reopening a closed case is not available yet.' }
  if (target === 'pending_external') return { status: 200, needsReason: true, message: 'Say what the case is waiting on.' }
  if (current === 'pending_external' && activeBlockers(c).length) {
    return { status: 409, message: `Resolve the active blocker first: ${activeBlockers(c)[0].title}.` }
  }
  const gaps = closureGaps(c)
  if (target === 'ready_for_closure' && gaps.length) return { status: 409, message: `Not ready to close: ${gaps[0]}.` }
  if (target === 'closed') {
    if (role !== 'manager') return { status: 501, message: 'Closure requests to a manager are not available yet.' }
    if (gaps.length) return { status: 409, message: `Closure checklist incomplete: ${gaps[0]}.` }
    if (current !== 'ready_for_closure') return { status: 409, message: 'Move the case to Closure Ready before closing it.' }
  }
  return { status: 200, message: '' }
}
