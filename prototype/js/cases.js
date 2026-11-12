import { getCurrentUser, visibleTasks } from './state.js';

export const CASE_PRIORITY_ORDER = ['Service', 'Safety', 'Residents’ well-being', 'Actual concern / urgency'];

export const KANBAN_COLUMNS = [
  { id: 'open', title: 'Open / Intake', badgeClass: 'tag-neutral' },
  { id: 'in_progress', title: 'In Progress', badgeClass: 'tag-brand' },
  { id: 'pending_external', title: 'Awaiting External / Blocked', badgeClass: 'tag-warning' },
  { id: 'ready_for_closure', title: 'Closure Ready', badgeClass: 'tag-info' },
  { id: 'closed', title: 'Closed & Audited', badgeClass: 'tag-success' },
];

/**
 * Single consistent classifier determining primary workflow status for Kanban.
 * Prevents case duplication across columns (e.g. ceiling seepage appears only in
 * Awaiting External / Blocked when an active blocker is present, never duplicated in In Progress).
 */
export function getCaseKanbanColumn(record) {
  if (!record) return 'open';
  const statusLower = (record.status || '').toLowerCase();
  if (statusLower === 'closed') return 'closed';
  if (statusLower === 'ready_for_closure' || statusLower === 'ready for closure') return 'ready_for_closure';
  const hasActiveBlockers = Array.isArray(record.blockers) && record.blockers.some((b) => !b.resolved);
  if (statusLower === 'pending_external' || statusLower === 'blocked' || hasActiveBlockers) {
    return 'pending_external';
  }
  if (statusLower === 'in progress' || statusLower === 'in_progress') return 'in_progress';
  return 'open';
}

export function visibleCases(state) {
  const user = getCurrentUser(state);
  if (user.status !== 'active' || user.role === 'admin') return [];
  const cases = state.cases || [];
  if (user.role === 'member') return cases.filter((record) => record.ownerId === user.id);
  const officers = new Set((state.teams || [])
    .filter((team) => team.managers.some((manager) => manager.id === user.id))
    .flatMap((team) => team.members.map((member) => member.id)));
  officers.add(user.id);
  return cases.filter((record) => officers.has(record.ownerId));
}

export function accessibleCase(state, id) {
  return visibleCases(state).find((record) => record.id === id);
}

export function tasksForCase(state, id) {
  return accessibleCase(state, id) ? visibleTasks(state).filter((task) => task.caseId === id) : [];
}
