import { taskAssignees } from './taskCapture.js';
import { toMin, weekday } from './time.js';

export const WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function lunchForDate(preferences, date) {
  return preferences.lunchByDay?.[weekday(date)] ?? {
    start: preferences.lunchStart,
    end: preferences.lunchEnd,
  };
}

export function schedulePreferences(state, officerId) {
  const settings = state.settings;
  return state.schedulePreferences?.[officerId] ?? {
    days: [1, 2, 3, 4, 5],
    workStart: settings.workStart,
    workEnd: settings.workEnd,
    lunchStart: settings.lunchStart,
    lunchEnd: settings.lunchEnd,
    focus: [],
    maxMinutes: toMin(settings.workEnd) - toMin(settings.workStart)
      - (toMin(settings.lunchEnd) - toMin(settings.lunchStart)),
  };
}

const isTime = (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const intersects = (a, b) => a.start < b.end && b.start < a.end;
const preferenceError = (message, ...sections) => Object.assign(new Error(message), { sections });

export function saveSchedulePreferences(state, officerId, input) {
  if (!taskAssignees(state).some(({ id }) => id === officerId)) throw new Error('This officer is unavailable for planning.');
  const days = [...new Set(input.days.map(Number))].sort((a, b) => a - b);
  if (!days.length || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error('Select at least one working day.');
  }
  const { workStart, workEnd, lunchStart, lunchEnd } = input;
  if (!isTime(workStart) || !isTime(workEnd) || workStart >= workEnd) {
    throw new Error('Set working hours with the end after the start.');
  }
  function period(start, end, label, section) {
    if (!start && !end) return null;
    if (!isTime(start) || !isTime(end) || start >= end || start < workStart || end > workEnd) {
      throw preferenceError(`${label} must start and end within working hours.`, section);
    }
    return { start, end };
  }
  const lunch = period(lunchStart, lunchEnd, 'Lunch break');
  const lunchByDay = {};
  for (const day of days) {
    const override = input.lunchByDay?.[day];
    if (!override) continue;
    const window = period(override.start, override.end, `${WORKING_DAYS[day - 1]} lunch`, 'custom-lunch');
    if (window && (window.start !== lunch?.start || window.end !== lunch?.end)) lunchByDay[day] = window;
  }
  const focus = input.focus.map(({ start, end }) => period(start, end, 'Each focus period', 'focus')).filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (focus.some((slot, index) => index > 0 && intersects(slot, focus[index - 1]))) {
    throw preferenceError('Focus periods must be separate from each other.', 'focus');
  }
  for (const day of days) {
    const window = lunchByDay[day] ?? lunch;
    if (window && focus.some((slot) => intersects(slot, window))) {
      throw preferenceError(`Focus periods must be separate from lunch on ${WORKING_DAYS[day - 1]}.`,
        ...(lunchByDay[day] ? ['focus', 'custom-lunch'] : ['focus']));
    }
  }
  const maxMinutes = Math.round(Number(input.maxHours) * 60);
  if (!Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 24 * 60) {
    throw new Error('Enter a maximum between 1 minute and 24 hours per day.');
  }
  const saved = { days, workStart, workEnd, lunchStart: lunch?.start || '', lunchEnd: lunch?.end || '', focus, maxMinutes,
    ...(Object.keys(lunchByDay).length ? { lunchByDay } : {}) };
  state.schedulePreferences ??= {};
  state.schedulePreferences[officerId] = saved;
  return saved;
}
