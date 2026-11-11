import { CATEGORIES, PRIORITIES } from './data.js';
import { accessibleCase } from './cases.js';
import { getCurrentUser, getUser, logActivity, visibleTasks } from './state.js';
import { parseTaskTags } from './taskIntelligence.js';
import { singaporeDateInput, singaporeInstant } from './time.js';

export const CAPTURE_STATUSES = [
  { id: 'todo', label: 'Pending' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Completed' },
];

export function canCapture(s) {
  const user = getCurrentUser(s);
  return user.status === 'active' && (user.role === 'member' || user.role === 'manager');
}

export function accessibleTask(s, id) {
  return canCapture(s) ? visibleTasks(s).find((task) => task.id === id) : undefined;
}

export function taskAssignees(s, task) {
  if (!canCapture(s)) return [];
  const user = getCurrentUser(s);
  const teams = (s.teams || []).filter((team) => team.managers.some((manager) => manager.id === user.id)
    && (!task || team.members.some((member) => member.id === task.ownerId)));
  return s.officers.filter((officer) => {
    if (officer.id === task?.ownerId && accessibleTask(s, task.id)) return true;
    const account = getUser(s, officer.id);
    return account?.role === 'member' && account.status === 'active' && (user.role === 'member'
      ? officer.id === user.id
      : teams.some((team) => team.members.some((member) => member.id === officer.id)));
  });
}

export const taskDateInput = singaporeDateInput;

export function taskDuration(task) {
  return task.estimatedDurationMinutes ?? Math.round(task.effort * 60);
}

export function saveCapturedTask(s, input, id) {
  if (!canCapture(s)) throw new Error('This account cannot manage tasks.');
  const task = id ? accessibleTask(s, id) : null;
  if (id && !task) throw new Error('This task is unavailable.');
  const title = String(input.title ?? '').trim();
  const description = String(input.description ?? '').trim();
  const location = String(input.location ?? '').trim();
  const remarks = String(input.remarks ?? '').trim();
  if (!title || title.length > 160) throw new Error('Enter a task title of 1 to 160 characters.');
  if (!description || description.length > 4000) throw new Error('Enter a description of 1 to 4000 characters.');
  if (location.length > 160 || remarks.length > 4000) throw new Error('Shorten the location or remarks.');
  if (!CATEGORIES.includes(input.category)) throw new Error('Select a category.');
  if (!PRIORITIES.includes(input.priority)) throw new Error('Select a priority.');
  if (!taskAssignees(s, task).some((officer) => officer.id === input.ownerId)) {
    throw new Error('Select an officer you can assign to this task.');
  }
  const hasCaseChange = Object.hasOwn(input, 'caseId');
  const caseId = hasCaseChange ? input.caseId || null : task?.caseId ?? null;
  if (hasCaseChange && caseId && !accessibleCase(s, caseId)) throw new Error('Select a case you can access.');
  const tags = Object.hasOwn(input, 'tags') ? parseTaskTags(input.tags) : task?.tags ?? [];
  const estimatedDurationMinutes = Number(input.estimatedDurationMinutes);
  if (!Number.isSafeInteger(estimatedDurationMinutes) || estimatedDurationMinutes < 1 || estimatedDurationMinutes > 2147483647) {
    throw new Error('Enter a positive whole number of minutes.');
  }
  const dueAt = singaporeInstant(input.due);
  if (!dueAt) throw new Error('Enter a valid due date and time.');
  const schedulingType = input.schedulingType || 'flexible';
  if (!['fixed', 'flexible'].includes(schedulingType)) throw new Error('Select a scheduling type.');
  const fixedStartAt = schedulingType === 'fixed' ? singaporeInstant(input.fixedStart) : null;
  if (schedulingType === 'fixed' && !fixedStartAt) throw new Error('Enter a valid start date and time for a fixed task.');
  if (fixedStartAt && Date.parse(fixedStartAt) + estimatedDurationMinutes * 60000 > Date.parse(dueAt)) {
    throw new Error('The fixed start and estimated duration must fit by the deadline.');
  }
  const updatedAt = new Date().toISOString();
  const fields = {
    title, description, location, remarks, estimatedDurationMinutes, dueAt, schedulingType, fixedStartAt, updatedAt,
    ownerId: input.ownerId, category: input.category, priority: input.priority, caseId, tags,
    due: input.due, effort: estimatedDurationMinutes / 60,
    safety: !!input.safety, statutory: !!input.statutory,
  };
  if (task) {
    Object.assign(task, fields);
    logActivity(s, `Updated task: ${task.title}`);
    return task;
  }
  const created = {
    ...fields, id: `capture-${crypto.randomUUID()}`, createdBy: getCurrentUser(s).id,
    createdAt: updatedAt, manualCapture: true, status: 'todo', source: 'SyncAI',
    dependsOn: [], spent: 0, completedAt: null,
  };
  s.tasks.unshift(created);
  logActivity(s, `Created task: ${created.title}`);
  return created;
}

export function changeTaskStatus(s, id, status) {
  const task = accessibleTask(s, id);
  if (!task || !CAPTURE_STATUSES.some((option) => option.id === status)) return false;
  const now = new Date().toISOString();
  task.completedAt = status === 'done' ? task.completedAt || now : null;
  task.status = status;
  task.updatedAt = now;
  logActivity(s, `Updated task status: ${task.title}`);
  return true;
}

export function deleteCapturedTask(s, id) {
  const task = accessibleTask(s, id);
  if (!task?.manualCapture) return false;
  s.tasks = s.tasks.filter((item) => item.id !== id);
  for (const item of s.tasks) item.dependsOn = (item.dependsOn || []).filter((dependency) => dependency !== id);
  logActivity(s, `Deleted task: ${task.title}`);
  return true;
}
