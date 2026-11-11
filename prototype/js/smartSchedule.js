import { PRIORITIES } from './data.js';
import { schedulePreferences } from './schedulePreferences.js';
import { getOfficer, getTask, isOpen, isUnavailable, meetingsFor, openTasksFor } from './state.js';
import { taskDuration } from './taskCapture.js';
import { taskDeadline } from './taskIntelligence.js';
import { NOW, TODAY, singaporeDateInput, toMin, weekday } from './time.js';

const MINUTES_PER_DAY = 1440;
const minuteOn = (date) => Date.parse(date + 'T00:00:00Z') / 60000;
const timestampMinute = (value) => value ? minuteOn(value.slice(0, 10)) + toMin(value.slice(11, 16)) : Infinity;
const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const minutesOf = (blocks) => blocks.reduce((total, block) => total + block.end - block.start, 0);

function mergedIntervals(blocks) {
  const intervals = [];
  for (const { start, end } of [...blocks].sort((a, b) => a.start - b.start)) {
    const last = intervals.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else intervals.push({ start, end });
  }
  return intervals;
}

function availableSlots(window, blocked) {
  if (window.start >= window.end) return [];
  const slots = [];
  let start = window.start;
  for (const block of mergedIntervals(blocked)) {
    if (block.end <= start) continue;
    if (block.start >= window.end) break;
    if (block.start > start) slots.push({ start, end: block.start });
    start = block.end;
  }
  if (start < window.end) slots.push({ start, end: window.end });
  return slots;
}

function fixedTaskCommitments(tasks) {
  return tasks.flatMap((task) => {
    const value = singaporeDateInput(task.fixedStartAt);
    const duration = taskDuration(task);
    if (task.schedulingType !== 'fixed' || !value || !Number.isFinite(duration) || duration <= 0) return [];
    const start = timestampMinute(value);
    return [{ id: task.id, kind: 'fixed-task', title: task.title, location: task.location,
      taskId: task.id, start, end: start + duration }];
  });
}

function protectedCommitments(state, officerId, date, appointments, fixedTasks) {
  const midnight = minuteOn(date);
  const calendar = [
    ...meetingsFor(state, officerId, date).map((meeting) => ({ ...meeting, kind: 'meeting' })),
    ...appointments.filter((appointment) => appointment.date === date).map((appointment) => ({ ...appointment, kind: 'appointment' })),
  ].map((block) => ({ ...block, start: toMin(block.start), end: toMin(block.end) }));
  const fixed = fixedTasks.filter((task) => task.start < midnight + MINUTES_PER_DAY && task.end > midnight)
    .map((task) => ({ ...task, start: Math.max(0, task.start - midnight), end: Math.min(MINUTES_PER_DAY, task.end - midnight) }));
  return [...calendar, ...fixed].sort((a, b) => a.start - b.start || a.end - b.end);
}

function dailyCapacity(state, officer, date, prefs, appointments, fixedTasks) {
  const midnight = minuteOn(date);
  const working = { start: toMin(prefs.workStart), end: toMin(prefs.workEnd) };
  const lunch = prefs.lunchStart && { start: toMin(prefs.lunchStart), end: toMin(prefs.lunchEnd) };
  const blocked = protectedCommitments(state, officer.id, date, appointments, fixedTasks);
  const closed = date < TODAY ? 'This date has passed in the demo.'
    : !prefs.days.includes(weekday(date)) ? 'Outside your selected working days.'
      : isUnavailable(officer, date) ? 'The officer is unavailable on this date.' : '';
  const warnings = [];
  for (const [index, block] of blocked.entries()) {
    for (const other of blocked.slice(index + 1).filter((next) => overlaps(block, next))) {
      warnings.push(`“${block.title}” overlaps “${other.title}”. Both commitments are protected.`);
    }
    if (block.start < working.start || block.end > working.end || !prefs.days.includes(weekday(date)) || isUnavailable(officer, date)) {
      warnings.push(`“${block.title}” falls outside the officer’s working availability.`);
    }
    if (lunch && overlaps(block, lunch)) warnings.push(`“${block.title}” overlaps the protected lunch break.`);
    const task = block.taskId && getTask(state, block.taskId);
    if (task && midnight + block.end > timestampMinute(taskDeadline(task).at)) {
      warnings.push(`“${block.title}” extends beyond the task’s recorded deadline.`);
    }
    if (task?.ownerId === officer.id && isOpen(task) && block.kind === 'appointment'
      && block.end - block.start < remainingDuration(task)) {
      warnings.push(`“${block.title}” is shorter than the task’s remaining estimate.`);
    }
  }
  const protectedMinutes = minutesOf(mergedIntervals(blocked));
  if (protectedMinutes > prefs.maxMinutes) warnings.push('Protected commitments already exceed the daily working-hours limit.');
  const workingWindow = { ...working, start: date === TODAY ? Math.max(working.start, toMin(NOW.slice(11))) : working.start };
  const slots = closed ? [] : availableSlots(workingWindow, lunch ? [...blocked, lunch] : blocked);
  const freeMinutes = Math.max(0, Math.min(minutesOf(slots), prefs.maxMinutes - protectedMinutes));
  return {
    date, midnight, closed, lunch, blocked, warnings, protectedMinutes, slots, initialSlots: slots, freeMinutes,
    remainingMinutes: freeMinutes, proposed: [], dueUnscheduled: [], overloaded: protectedMinutes > prefs.maxMinutes,
  };
}

function selectSlot(slots, focus, earliest, latest, duration) {
  const fittingStart = (window, preferred) => {
    const start = Math.max(window.start, earliest, preferred?.start ?? 0);
    const end = Math.min(window.end, latest, preferred?.end ?? MINUTES_PER_DAY);
    return start + duration <= end ? start : null;
  };
  for (const period of focus) {
    for (const window of slots) {
      const start = fittingStart(window, period);
      if (start !== null) return start;
    }
  }
  for (const window of slots) {
    const start = fittingStart(window);
    if (start !== null) return start;
  }
  return null;
}

function remainingDuration(task) {
  return Math.max(1, taskDuration(task) - Math.round((task.spent || 0) * 60));
}

export function buildSmartSchedule(state, officerId, dates, { generate = true } = {}) {
  const officer = getOfficer(state, officerId);
  if (!officer || !dates.length) return { days: [], unscheduled: [], workloadMinutes: 0 };
  const prefs = schedulePreferences(state, officerId);
  const tasks = openTasksFor(state, officerId);
  const appointments = (state.appointments || []).filter((appointment) => appointment.ownerId === officerId);
  const fixedTasks = fixedTaskCommitments(tasks);
  const days = [...new Set(dates)].sort().map((date) => dailyCapacity(state, officer, date, prefs, appointments, fixedTasks));
  const focus = prefs.focus.map(({ start, end }) => ({ start: toMin(start), end: toMin(end) }));
  const now = timestampMinute(NOW);
  const finishedAt = new Map();
  const booked = new Map();
  for (const appointment of appointments) {
    const task = appointment.taskId && tasks.find(({ id }) => id === appointment.taskId);
    if (!task) continue;
    const end = timestampMinute(`${appointment.date}T${appointment.end}`);
    if (end <= now) booked.set(task.id, 'The fixed appointment has ended. Confirm the outcome before replanning.');
    else if (toMin(appointment.end) - toMin(appointment.start) < remainingDuration(task)) {
      booked.set(task.id, 'The protected appointment is shorter than the remaining estimate. Review the booking.');
    } else {
      finishedAt.set(task.id, Math.max(end, finishedAt.get(task.id) || 0));
    }
  }
  for (const task of fixedTasks) {
    if (task.end <= now) booked.set(task.taskId, 'The fixed block has ended. Confirm the outcome before replanning.');
    else finishedAt.set(task.taskId, Math.max(task.end, finishedAt.get(task.taskId) || 0));
  }
  let pending = tasks.filter((task) => !finishedAt.has(task.id)).map((task) => ({
    task, deadline: taskDeadline(task), duration: remainingDuration(task),
    dependencies: (task.dependsOn || []).filter((id) => {
      const dependency = getTask(state, id);
      return dependency && isOpen(dependency);
    }),
  })).sort((a, b) => (a.deadline.at || '9999').localeCompare(b.deadline.at || '9999')
    || PRIORITIES.indexOf(a.task.priority) - PRIORITIES.indexOf(b.task.priority) || a.task.id.localeCompare(b.task.id));

  if (generate) {
    for (const day of days) {
      let previousCount;
      do {
        previousCount = pending.length;
        pending = pending.filter(({ task, deadline, duration, dependencies }) => {
          if (task.schedulingType === 'fixed' || booked.has(task.id) || duration > day.remainingMinutes
            || dependencies.some((id) => !finishedAt.has(id))) return true;
          const earliest = Math.max(0, ...dependencies.map((id) => finishedAt.get(id) - day.midnight));
          const latest = timestampMinute(deadline.at) - day.midnight;
          const start = selectSlot(day.slots, focus, earliest, latest, duration);
          if (start === null) return true;
          const end = start + duration;
          day.proposed.push({ kind: 'task', taskId: task.id, title: task.title, location: task.location, start, end });
          day.remainingMinutes -= duration;
          day.slots = day.slots.flatMap((slot) => {
            if (!overlaps(slot, { start, end })) return [slot];
            return [{ start: slot.start, end: start }, { start: end, end: slot.end }].filter((part) => part.start < part.end);
          });
          finishedAt.set(task.id, day.midnight + end);
          return false;
        });
      } while (pending.length < previousCount && pending.length && day.remainingMinutes > 0);
    }
  }

  const unscheduled = generate ? pending.map(({ task, deadline, duration, dependencies }) => {
    let reason = 'No continuous slot fits the task before its deadline within this proposal.';
    if (booked.has(task.id)) reason = booked.get(task.id);
    else if (task.schedulingType === 'fixed') reason = 'A fixed start is required before this task can be planned.';
    else if (deadline.at && deadline.at <= NOW) reason = `The recorded ${deadline.label.toLowerCase()} has already passed in the demo.`;
    else if (dependencies.some((id) => !finishedAt.has(id))) reason = 'An earlier task must be completed or scheduled first.';
    else if (days.every((day) => day.closed)) reason = 'No working availability in the selected period.';
    else if (duration > prefs.maxMinutes) reason = 'The estimated duration exceeds the daily working-hours limit.';
    else if (deadline.at && days.every((day) => day.initialSlots.every(({ start, end }) =>
      start + duration > Math.min(end, timestampMinute(deadline.at) - day.midnight)))) {
      reason = `No available slot is long enough before the recorded ${deadline.label.toLowerCase()}.`;
    }
    else if (days.every((day) => day.remainingMinutes < duration)) reason = 'Insufficient capacity after protected commitments and the daily working-hours limit.';
    if (deadline.at && deadline.at.slice(0, 10) <= days.at(-1).date) {
      const dueDay = days.find((day) => day.date === deadline.at.slice(0, 10) && day.date >= TODAY)
        || days.find((day) => day.date >= TODAY);
      dueDay?.dueUnscheduled.push(task.id);
    }
    return { task, deadline, duration, reason };
  }) : [];

  for (const day of days) {
    day.proposed.sort((a, b) => a.start - b.start);
    day.taskMinutes = minutesOf(day.proposed);
    day.workloadMinutes = day.protectedMinutes + day.taskMinutes;
    day.overloaded ||= day.dueUnscheduled.length > 0;
  }
  return { days, unscheduled, workloadMinutes: days.reduce((sum, day) => sum + day.workloadMinutes, 0) };
}
