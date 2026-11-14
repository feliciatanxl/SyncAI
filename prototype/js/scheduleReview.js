import { schedulePreferences } from './schedulePreferences.js';
import { buildSmartSchedule } from './smartSchedule.js';
import { getOfficer, getTask, openTasksFor } from './state.js';
import { taskAssignees } from './taskCapture.js';
import { NOW } from './time.js';
import { blockingPlanningIssues } from './planningIssues.js';

function planningInputs(state, officerId) {
  const tasks = new Map(state.tasks.filter((task) => task.ownerId === officerId).map((task) => [task.id, task]));
  for (const task of tasks.values()) {
    for (const id of task.dependsOn || []) {
      const dependency = getTask(state, id);
      if (dependency && !tasks.has(id)) tasks.set(id, dependency);
    }
  }
  return {
    'Tasks or dependencies': JSON.stringify([...tasks.values()].sort((a, b) => a.id.localeCompare(b.id))),
    'Schedule preferences': JSON.stringify(schedulePreferences(state, officerId)),
    'Officer availability': JSON.stringify(getOfficer(state, officerId)?.availability),
    'Protected commitments': JSON.stringify([
      state.meetings.filter((meeting) => meeting.ownerIds.includes(officerId)),
      (state.appointments || []).filter((appointment) => appointment.ownerId === officerId),
    ]),
    'Demo date': NOW,
  };
}

export function generateDraft(state, officerId, dates) {
  const { days, unscheduled, workloadMinutes } = buildSmartSchedule(state, officerId, dates);
  return {
    id: crypto.randomUUID(),
    officerId,
    dates: [...new Set(dates)].sort(),
    inputs: planningInputs(state, officerId),
    openCount: openTasksFor(state, officerId).length,
    ...structuredClone({ days, unscheduled, workloadMinutes }),
  };
}

export function changedPlanningInputs(state, schedule) {
  const current = planningInputs(state, schedule.officerId);
  return Object.keys(current).filter((key) => current[key] !== schedule.inputs[key]);
}

export function reviewDraft(state, draft) {
  const accepted = state.acceptedSchedules?.[draft.officerId] || {};
  const proposed = new Set(draft.days.flatMap((day) => day.proposed.map(({ taskId }) => taskId)));
  // A reassigned task can also still appear on another officer’s accepted calendar.
  const duplicateDates = new Set();
  for (const [officerId, schedules] of Object.entries(state.acceptedSchedules || {})) {
    for (const [date, entry] of Object.entries(schedules)) {
      if (officerId === draft.officerId && draft.dates.includes(date)) continue;
      if (entry.day.proposed.some(({ taskId }) => proposed.has(taskId))) duplicateDates.add(date);
    }
  }
  const changed = changedPlanningInputs(state, draft);
  return {
    changed,
    blocking: changed.length ? [] : blockingPlanningIssues(state, draft),
    duplicates: [...duplicateDates].sort(),
    replaced: draft.dates.filter((date) => accepted[date]),
    warningCount: draft.days.reduce((count, day) => count + day.warnings.length, 0),
    unscheduledCount: draft.unscheduled.length,
  };
}

export function acceptDraft(state, draft, { acknowledged = false } = {}) {
  if (!taskAssignees(state).some(({ id }) => id === draft.officerId)) throw new Error('This officer is unavailable for planning.');
  const review = reviewDraft(state, draft);
  if (review.changed.length) throw new Error(`Regenerate before accepting. Changed inputs: ${review.changed.join(', ')}.`);
  if (review.blocking.length) throw new Error('Resolve blocking scheduling conflicts and regenerate before accepting.');
  if (review.duplicates.length) throw new Error(`Review accepted task blocks on ${review.duplicates.join(', ')} before accepting.`);
  if (!acknowledged && (review.replaced.length || review.warningCount || review.unscheduledCount)) {
    throw new Error('Review and acknowledge the draft issues before accepting.');
  }
  const acceptedAt = new Date().toISOString();
  const { days, workloadMinutes, ...details } = draft;
  state.acceptedSchedules ??= {};
  const schedules = state.acceptedSchedules[draft.officerId] ??= {};
  for (const day of days) schedules[day.date] = structuredClone({ ...details, acceptedAt, day });
}

export function discardDraft(drafts, draft, confirmed) {
  if (!confirmed || drafts.get(draft.officerId) !== draft) return false;
  drafts.delete(draft.officerId);
  return true;
}
