// Task timer: one running timer per officer. Real elapsed time (not the demo
// clock) is added to task.spent when the timer stops, which feeds remaining
// effort in the planner and the estimated-vs-actual figures.

/** A timer left running longer than this (e.g. overnight) counts as this many hours. */
export const MAX_SESSION_H = 10;

export const elapsedHours = (startMs, nowMs) => Math.min(Math.max(nowMs - startMs, 0) / 3600000, MAX_SESSION_H);

export function runningTimer(s, officerId) {
  return s.tasks.find((t) => t.timerStart && t.ownerId === officerId) || null;
}

/** Stop a task's timer if it is running and add the time to `spent`. Returns the hours added. */
export function settleTimer(t, nowMs) {
  if (!t?.timerStart) return 0;
  const h = elapsedHours(t.timerStart, nowMs);
  t.spent = Math.round(((t.spent || 0) + h) * 100) / 100;
  t.timerStart = null;
  return h;
}

/** Start timing a task, stopping the owner's other running timer first. To-do work moves to In progress. */
export function startTimer(s, taskId, nowMs) {
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) return null;
  settleTimer(runningTimer(s, t.ownerId), nowMs);
  t.timerStart = nowMs;
  if (t.status === 'todo') t.status = 'in_progress';
  return t;
}

/** "1:05:09" or "05:09". */
export function fmtClock(ms) {
  const sec = Math.floor(Math.max(ms, 0) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(sec / 3600);
  return `${h ? `${h}:` : ''}${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
}
