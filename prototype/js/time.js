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

export function singaporeInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || value.startsWith('0000-')) return null;
  const wall = new Date(value + ':00Z');
  if (!Number.isFinite(+wall) || wall.toISOString().slice(0, 16) !== value) return null;
  return new Date(+wall - 8 * 60 * 60 * 1000).toISOString();
}

export function singaporeDateInput(value) {
  if (!value) return '';
  if (singaporeInstant(value)) return value;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return '';
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? new Date(instant + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
}

export function calendarDay(date, offset) {
  const day = new Date(date + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

export const weekday = (date) => new Date(date + 'T00:00:00Z').getUTCDay() || 7;
export const calendarWeek = (date) => Array.from({ length: 7 }, (_, index) => calendarDay(date, index + 1 - weekday(date)));

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

/**
 * #021 — Smart Deadline Countdown
 * Evaluates contextual countdowns relative to Singapore local time (SGT, UTC+8).
 * Supports deterministic test-time clock injection via nowIso.
 */
export function getDeadlineCountdown(targetIso, nowIso = null) {
  if (!targetIso || typeof targetIso !== 'string') {
    return {
      text: 'No deadline recorded',
      state: 'none',
      diffMs: 0,
      isOverdue: false,
      isDueSoon: false,
      isUpcoming: false,
    };
  }

  const effectiveNow = nowIso || NOW;
  const parseWithSgt = (iso) => {
    if (!iso) return NaN;
    if (iso.includes('+') || iso.endsWith('Z')) return Date.parse(iso);
    const normalized = iso.length === 10 ? `${iso}T23:59:00+08:00` : iso.length === 16 ? `${iso}:00+08:00` : iso;
    return Date.parse(normalized);
  };

  const targetMs = parseWithSgt(targetIso);
  const nowMs = parseWithSgt(effectiveNow);

  if (Number.isNaN(targetMs) || Number.isNaN(nowMs)) {
    return {
      text: 'No deadline recorded',
      state: 'none',
      diffMs: 0,
      isOverdue: false,
      isDueSoon: false,
      isUpcoming: false,
    };
  }

  const diffMs = targetMs - nowMs;

  if (diffMs < 0) {
    const overdueMs = Math.abs(diffMs);
    let text = 'Overdue';
    if (overdueMs < 60 * 1000) {
      text = 'Overdue by < 1 min';
    } else if (overdueMs < 60 * 60 * 1000) {
      const mins = Math.max(1, Math.round(overdueMs / 60000));
      text = `Overdue by ${mins} min${mins === 1 ? '' : 's'}`;
    } else if (overdueMs < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.round(overdueMs / 3600000));
      text = `Overdue by ${hours} hour${hours === 1 ? '' : 's'}`;
    } else {
      const days = Math.max(1, Math.round(overdueMs / 86400000));
      text = `Overdue by ${days} day${days === 1 ? '' : 's'}`;
    }
    return {
      text,
      state: 'overdue',
      diffMs,
      isOverdue: true,
      isDueSoon: false,
      isUpcoming: false,
    };
  }

  // Target is in the future
  let text = 'Due soon';
  let state = 'due_soon';

  if (diffMs < 60 * 1000) {
    text = 'Due now';
    state = 'due_soon';
  } else if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.round(diffMs / 60000));
    text = `Due in ${mins} min${mins === 1 ? '' : 's'}`;
    state = 'due_soon';
  } else if (diffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(diffMs / 3600000));
    text = `Due in ${hours} hour${hours === 1 ? '' : 's'}`;
    state = 'due_soon';
  } else if (diffMs < 48 * 60 * 60 * 1000) {
    text = 'Due tomorrow';
    state = 'due_soon';
  } else {
    const days = Math.max(2, Math.round(diffMs / 86400000));
    text = `Due in ${days} days`;
    state = 'upcoming';
  }

  return {
    text,
    state,
    diffMs,
    isOverdue: false,
    isDueSoon: state === 'due_soon',
    isUpcoming: state === 'upcoming',
  };
}

/** Index of a date within the horizon, or -1 if before / Infinity if after. */
export function dayIndex(iso, days) {
  const d = iso.slice(0, 10);
  const i = days.indexOf(d);
  if (i >= 0) return i;
  return d < days[0] ? -1 : Infinity;
}

