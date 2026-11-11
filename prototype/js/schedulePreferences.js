import { taskAssignees } from './taskCapture.js';
import { toMin } from './time.js';

export const WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  function period(start, end, label) {
    if (!start && !end) return null;
    if (!isTime(start) || !isTime(end) || start >= end || start < workStart || end > workEnd) {
      throw new Error(`${label} must start and end within working hours.`);
    }
    return { start, end };
  }
  const lunch = period(lunchStart, lunchEnd, 'Lunch break');
  const focus = input.focus.map(({ start, end }) => period(start, end, 'Each focus period')).filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (focus.some((slot, index) => (lunch && intersects(slot, lunch)) || (index > 0 && intersects(slot, focus[index - 1])))) {
    throw new Error('Focus periods must be separate from lunch and each other.');
  }
  const maxMinutes = Math.round(Number(input.maxHours) * 60);
  if (!Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 24 * 60) {
    throw new Error('Enter a maximum between 1 minute and 24 hours per day.');
  }
  const saved = { days, workStart, workEnd, lunchStart: lunch?.start || '', lunchEnd: lunch?.end || '', focus, maxMinutes };
  state.schedulePreferences ??= {};
  state.schedulePreferences[officerId] = saved;
  return saved;
}
