// Date/time helpers. The prototype runs on a fixed "demo clock" so every
// calculation is deterministic: today is the current working day (weekends
// roll forward to Monday) and the clock reads 08:30.

const pad = (n) => String(n).padStart(2, '0');

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

function computeAnchor() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

export const ANCHOR = computeAnchor();
export const TODAY = isoDate(ANCHOR);
export const NOW_TIME = '08:30';
export const NOW = `${TODAY}T${NOW_TIME}`;

/** The nth working day relative to today (negative = past). */
export function workDay(offset) {
  const d = new Date(ANCHOR);
  let n = offset;
  const step = n < 0 ? -1 : 1;
  while (n !== 0) {
    d.setDate(d.getDate() + step);
    if (!isWeekend(d)) n -= step;
  }
  return isoDate(d);
}

/** Working days from today until a date (0 = today, negative = past). */
export function workDaysUntil(iso) {
  const target = iso.slice(0, 10);
  if (target === TODAY) return 0;
  const forward = target > TODAY;
  for (let i = 1; i < 400; i++) {
    const d = workDay(forward ? i : -i);
    if (forward ? d >= target : d <= target) return forward ? i : -i;
  }
  return forward ? 400 : -400;
}

/** The planning horizon: the next five working days starting today. */
export function horizonDays(n = 5) {
  return Array.from({ length: n }, (_, i) => workDay(i));
}

export const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(Math.round(m % 60))}`;

export const dt = (date, time) => `${date}T${time}`;
export const datePart = (s) => s.slice(0, 10);
export const timePart = (s) => s.slice(11, 16);

const DAY_FMT = new Intl.DateTimeFormat('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
const LONG_FMT = new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function fmtDay(iso) {
  return DAY_FMT.format(parseDate(iso));
}
export function fmtLongDay(iso) {
  return LONG_FMT.format(parseDate(iso));
}

export function relDay(iso) {
  const d = iso.slice(0, 10);
  if (d === TODAY) return 'Today';
  if (d === workDay(1)) return 'Tomorrow';
  if (d === workDay(-1)) return 'Yesterday';
  return fmtDay(d);
}

export function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${pad(m)}${suffix}`;
}

export function fmtDue(s) {
  return `${relDay(s)}, ${fmtTime(timePart(s))}`;
}

export function fmtHours(h) {
  if (!isFinite(h)) return '—';
  if (h > 0 && h < 1) return `${Math.round(h * 60)}m`;
  const r = Math.round(h * 100) / 100;
  return `${r}h`;
}

/** Index of a date within the horizon, or -1 if before / Infinity if after. */
export function dayIndex(iso, days) {
  const d = iso.slice(0, 10);
  const i = days.indexOf(d);
  if (i >= 0) return i;
  return d < days[0] ? -1 : Infinity;
}
