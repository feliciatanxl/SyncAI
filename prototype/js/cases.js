import { getCurrentUser, visibleTasks } from './state.js';

export const CASE_PRIORITY_ORDER = ['Service', 'Safety', 'Residents’ well-being', 'Actual concern / urgency'];

export function visibleCases(state) {
  const user = getCurrentUser(state);
  if (user.status !== 'active' || user.role === 'admin') return [];
  const cases = state.cases || [];
  if (user.role === 'member') return cases.filter((record) => record.ownerId === user.id);
  const officers = new Set((state.teams || [])
    .filter((team) => team.managers.some((manager) => manager.id === user.id))
    .flatMap((team) => team.members.map((member) => member.id)));
  return cases.filter((record) => officers.has(record.ownerId));
}

export function accessibleCase(state, id) {
  return visibleCases(state).find((record) => record.id === id);
}

export function tasksForCase(state, id) {
  return accessibleCase(state, id) ? visibleTasks(state).filter((task) => task.caseId === id) : [];
}
