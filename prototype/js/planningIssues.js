import { buildSmartSchedule } from './smartSchedule.js';
import { createApprovalRequest, getCurrentUser, getTask, isOpen } from './state.js';
import { accessibleTask, taskDuration } from './taskCapture.js';
import { taskDeadline } from './taskIntelligence.js';
import { fromMin } from './time.js';

const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const minutesAt = (date, time) => Date.parse(date + 'T00:00:00Z') / 60000 + time;
export const blockTimes = (block) => `${fromMin(block.start)}–${fromMin(block.end)}`;

export function blockingPlanningIssues(state, draft) {
  const { days, fixedFinishes = {} } = buildSmartSchedule(state, draft.officerId, draft.dates, { generate: false });
  const proposed = draft.days.flatMap((day) => day.proposed.map((block) => ({ block, date: day.date })));
  return draft.days.flatMap((day) => {
    const current = days.find(({ date }) => date === day.date);
    const issues = [];
    const add = (kind, message, block, other) => issues.push({
      id: `block-${day.date}-${issues.length}`, blocking: true, kind, message, date: day.date,
      title: block?.title || 'Proposed workload', task: getTask(state, block?.taskId), block, other,
    });
    for (const [index, block] of day.proposed.entries()) {
      const task = getTask(state, block.taskId);
      if (!Number.isInteger(block.start) || !Number.isInteger(block.end) || block.start < 0 || block.end > 1440 || block.end <= block.start) {
        add('Invalid block', 'The proposed start and end do not form a valid time block.', block);
        continue;
      }
      const protectedBlocks = [...(current?.blocked || []), ...(current?.lunch ? [{ ...current.lunch, title: 'Lunch break' }] : [])];
      const clashes = [...protectedBlocks, ...day.proposed.slice(index + 1)].filter((other) => overlaps(block, other));
      for (const other of clashes) {
        add('Overlapping blocks', `${block.title} (${blockTimes(block)}) overlaps ${other.title} (${blockTimes(other)}).`, block, other);
      }
      if (!clashes.some((other) => protectedBlocks.includes(other))
        && !current?.initialSlots.some((slot) => slot.start <= block.start && block.end <= slot.end)) {
        add('Working availability', 'The proposed block falls outside the officer’s available working windows.', block);
      }
      if (!task || task.ownerId !== draft.officerId || !isOpen(task) || task.schedulingType === 'fixed'
        || (state.appointments || []).some((booking) => booking.taskId === task.id && booking.ownerId === draft.officerId)) {
        add('Task constraint', 'This task is no longer eligible for a flexible block on this officer’s schedule.', block);
        continue;
      }
      const duration = Math.max(1, taskDuration(task) - Math.round((task.spent || 0) * 60));
      if (block.end - block.start < duration) add('Task duration', 'The proposed block is shorter than the remaining estimate.', block);
      const deadline = taskDeadline(task);
      if (deadline.at && minutesAt(day.date, block.end) > Date.parse(deadline.at + ':00Z') / 60000) {
        add('Deadline violation', `The proposed block ends after the recorded ${deadline.label.toLowerCase()} (${deadline.at.replace('T', ' ')} SGT).`, block);
      }
      if (proposed.some((entry) => entry.block !== block && entry.block.taskId === block.taskId)) {
        add('Duplicate task', 'This task has more than one proposed block in the draft.', block);
      }
      for (const id of task.dependsOn || []) {
        const dependency = getTask(state, id);
        if (!dependency || !isOpen(dependency)) continue;
        const planned = proposed.find((entry) => entry.block.taskId === id);
        const finish = planned ? minutesAt(planned.date, planned.block.end) : fixedFinishes[id];
        if (finish === undefined || finish > minutesAt(day.date, block.start)) {
          add('Task dependency', `${dependency.title} must finish before this block starts.`, block);
        }
      }
    }
    const allocated = day.proposed.reduce((sum, block) => sum + Math.max(0, block.end - block.start), 0);
    if (day.proposed.length && allocated > (current?.freeMinutes ?? 0)) {
      add('Capacity limit', 'The proposed task blocks exceed the available daily capacity.');
    }
    return issues;
  });
}

export function scheduleIssues(state, days, unscheduled, blocking = []) {
  return [...blocking, ...days.flatMap((day) => day.warnings.map((message, index) => {
    const details = day.warningDetails?.[index];
    return {
      id: `warning-${day.date}-${index}`, date: day.date, message, kind: details?.kind || 'Calendar warning',
      title: details?.block?.title || 'Protected calendar', task: getTask(state, details?.block?.taskId),
      block: details?.block, other: details?.other,
    };
  })), ...unscheduled.map(({ task, deadline, duration, reason }) => ({
    id: `unscheduled-${task.id}`, date: days.find((day) => day.dueUnscheduled.includes(task.id))?.date,
    title: task.title, task, deadline, duration, message: reason,
    kind: deadline.at ? 'Unscheduled · deadline risk' : 'Unscheduled task',
  }))];
}

export function pendingScheduleRequest(state, issue) {
  return issue.task && state.approvals?.find((request) => request.status === 'pending'
    && request.requestType === 'schedule_adjustment' && request.taskId === issue.task.id
    && request.requesterId === getCurrentUser(state).id && request.reviewIssueId);
}

export function canRequestScheduleChange(state, issue) {
  const user = getCurrentUser(state);
  return user.role === 'member' && user.status === 'active' && issue.task
    && accessibleTask(state, issue.task.id)?.ownerId === user.id && isOpen(getTask(state, issue.task.id));
}

export function requestScheduleChange(state, issue, reason) {
  if (!canRequestScheduleChange(state, issue) || pendingScheduleRequest(state, issue)) throw new Error('This change request is unavailable.');
  if (!reason.trim()) throw new Error('Enter a reason for the requested change.');
  const task = getTask(state, issue.task.id);
  return createApprovalRequest(state, {
    taskId: task.id, caseId: task.caseId, originalOwnerId: task.ownerId, reviewIssueId: issue.id,
    originalSchedule: issue.block ? `${issue.date} ${blockTimes(issue.block)} SGT` : 'No task block was scheduled',
    proposedSchedule: 'Manager review requested',
    reason: reason.trim(),
    slaImpact: issue.deadline?.at ? `Review recorded deadline: ${issue.deadline.at.replace('T', ' ')} SGT` : 'Review any recorded deadline before changing commitments.',
    operationalImpact: issue.message,
  });
}
