// The one place the Case Action Centre reads and writes cases. Components only use the methods below, so the
// demo adapter can be swapped for the Express/PostgreSQL one without touching them.
//
//   list()                                  -> { cases, officers, managedOfficerIds }
//   addNote(caseId, text)                   -> case
//   logCommunication(caseId, { channel, direction, party, summary }) -> case
//   moveStage(caseId, target, reason)       -> case   (creates an approval request when one is needed)
//   decideRequest(caseId, approve, note)    -> case   (manager only)
//   requestReassignment(caseId, toOfficerId, reason) -> case
//
// There is no fallback between adapters: if the API fails, the page shows the error, never demo cases.
import { apiRequest } from '../../lib/api.js'
import { caseStage, checkTransition } from './caseLogic.js'
import { demoCases, demoOfficers } from './demoCases.js'

// 'demo' only when explicitly configured, or in the Vite dev server. A production build without
// VITE_CASE_DATA=demo always uses the API, so fictional cases can't ship by accident.
export function caseDataMode(env = import.meta.env ?? {}) {
  if (env.VITE_CASE_DATA === 'demo' || env.VITE_CASE_DATA === 'api') return env.VITE_CASE_DATA
  return env.DEV ? 'demo' : 'api'
}

export function createCaseService({ mode, me, getToken }) {
  return mode === 'demo' ? createDemoCaseService(me) : createApiCaseService(getToken)
}

// Future endpoints (not implemented on the server yet; see client/README.md). Until they exist, list()
// fails with 404 and the page says the case service isn't available.
export function createApiCaseService(getToken) {
  const call = (path, method, body) => apiRequest(path, { method, body, getToken })
  return {
    mode: 'api',
    list: () => call('/cases', 'GET'),
    addNote: (id, text) => call(`/cases/${encodeURIComponent(id)}/notes`, 'POST', { text }),
    logCommunication: (id, entry) => call(`/cases/${encodeURIComponent(id)}/communications`, 'POST', entry),
    moveStage: (id, target, reason) => call(`/cases/${encodeURIComponent(id)}/stage`, 'POST', { target, reason }),
    decideRequest: (id, approve, note) => call(`/cases/${encodeURIComponent(id)}/request/decision`, 'POST', { approve, note }),
    requestReassignment: (id, toOfficerId, reason) => call(`/cases/${encodeURIComponent(id)}/reassignment`, 'POST', { toOfficerId, reason }),
  }
}

const STAGE_LABEL = { open: 'Open', in_progress: 'In progress', pending_external: 'Awaiting external', ready_for_closure: 'Closure ready', closed: 'Closed & audited' }

// In-memory demo store, one per service instance (one per page visit). Nothing is saved anywhere.
export function createDemoCaseService(me, now = () => new Date()) {
  const officers = demoOfficers(me)
  const managedOfficerIds = me.role === 'manager' ? officers.map((o) => o.id) : []
  let cases = demoCases(me, now())
  let seq = 0
  const nextId = (p) => `${p}-${++seq}`
  const name = me.displayName || me.email || 'You'
  const officerName = (id) => officers.find((o) => o.id === id)?.name ?? id

  // Every write goes through here: scope check, then an immutable update.
  // async, so every refusal is a rejected promise like the API adapter's.
  async function update(id, fn) {
    const c = cases.find((x) => x.id === id)
    if (!c) throw new Error('Case not found.')
    const manager = me.role === 'manager'
    if (c.ownerId !== me.id && !(manager && managedOfficerIds.includes(c.ownerId))) throw new Error('You cannot change this case.')
    const next = fn(structuredClone(c))
    cases = cases.map((x) => (x.id === id ? next : x))
    return structuredClone(next)
  }
  const log = (c, title, summary, source) => c.timeline.push({ id: nextId('tl'), at: now().toISOString(), type: 'update', title, summary, source, actor: name })
  const history = (c, field, before, after, reason) => c.history.push({ id: nextId('h'), at: now().toISOString(), actor: name, field, before, after, reason })
  const requireText = (text, what) => {
    if (!text?.trim()) throw new Error(`${what} is required.`)
    return text.trim()
  }

  return {
    mode: 'demo',
    list: () => Promise.resolve(structuredClone({ cases, officers, managedOfficerIds })),
    addNote: (id, text) => update(id, (c) => (log(c, 'Progress note', requireText(text, 'A note'), 'Manual note'), c)),
    logCommunication: (id, entry) => update(id, (c) => {
      c.communications.push({ id: nextId('cm'), at: now().toISOString(), channel: `${entry.channel} (simulated)`, direction: entry.direction, party: entry.party, summary: requireText(entry.summary, 'A summary') })
      return c
    }),
    moveStage: (id, target, reason = '') => update(id, (c) => {
      const check = checkTransition(c, target, me, managedOfficerIds)
      if (!check.allowed) throw new Error(check.message)
      if (check.needsReason) requireText(reason, 'A reason')
      if (check.needsApproval) {
        c.pendingRequest = { type: 'closure', targetStage: target, by: name, at: now().toISOString(), reason: reason.trim() }
        log(c, 'Closure requested', reason.trim(), 'Approval request')
        return c
      }
      history(c, 'Stage', STAGE_LABEL[caseStage(c)], STAGE_LABEL[target], reason.trim() || 'Stage moved')
      c.stage = target
      return c
    }),
    decideRequest: (id, approve, note = '') => update(id, (c) => {
      if (me.role !== 'manager') throw new Error('Only a manager can decide requests.')
      const req = c.pendingRequest
      if (!req) throw new Error('There is no request to decide.')
      c.pendingRequest = null
      log(c, `${req.type === 'closure' ? 'Closure' : 'Reassignment'} request ${approve ? 'approved' : 'rejected'}`, note.trim() || req.reason, 'Manager decision')
      if (approve && req.type === 'closure') {
        history(c, 'Stage', STAGE_LABEL[caseStage(c)], STAGE_LABEL.closed, note.trim() || 'Closure approved')
        c.stage = 'closed'
      }
      if (approve && req.type === 'reassignment') {
        history(c, 'Assigned officer', officerName(c.ownerId), officerName(req.toOfficerId), req.reason)
        c.ownerId = req.toOfficerId
      }
      return c
    }),
    requestReassignment: (id, toOfficerId, reason) => update(id, (c) => {
      if (c.pendingRequest) throw new Error('A request on this case is already waiting for a decision.')
      if (!officers.some((o) => o.id === toOfficerId) || toOfficerId === c.ownerId) throw new Error('Choose a different officer.')
      if (me.role === 'manager') {
        // Managers reassign within their team directly; it is still recorded with their reason.
        history(c, 'Assigned officer', officerName(c.ownerId), officerName(toOfficerId), requireText(reason, 'A reason'))
        c.ownerId = toOfficerId
        return c
      }
      c.pendingRequest = { type: 'reassignment', toOfficerId, by: name, at: now().toISOString(), reason: requireText(reason, 'A reason') }
      log(c, 'Reassignment requested', `To ${officerName(toOfficerId)}: ${reason.trim()}`, 'Approval request')
      return c
    }),
  }
}
