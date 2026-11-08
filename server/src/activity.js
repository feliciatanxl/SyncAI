// Audit events SyncAI records. Only actions that grant access or change something are logged, not page views:
// accountability without monitoring staff (PDPA: collect only what the purpose needs).
export const ACTIONS = ['signed_up', 'opened', 'signed_out', 'approved', 'declined', 'role_changed', 'access_off', 'access_on', 'status_changed']

// The events an admin's change to a person produces, from that person's state before and after.
export function eventsForChange(before, after) {
  const events = []
  const status = `${before.status}>${after.status}`
  if (status === 'pending>active') events.push({ action: 'approved', details: { role: after.role } })
  else if (status === 'pending>disabled') events.push({ action: 'declined', details: {} })
  else if (status === 'active>disabled') events.push({ action: 'access_off', details: {} })
  else if (status === 'disabled>active') events.push({ action: 'access_on', details: {} })
  else if (before.status !== after.status) events.push({ action: 'status_changed', details: { from: before.status, to: after.status } })
  // Approving already records the role it was granted with.
  if (before.role !== after.role && events[0]?.action !== 'approved') {
    events.push({ action: 'role_changed', details: { from: before.role, to: after.role } })
  }
  return events
}
