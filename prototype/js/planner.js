// Conflict-aware scheduling, capacity analysis and deadline-risk assessment.
// The same schedule drives the Smart Planner, dashboards, risk alerts and the
// What-If Simulator, so every page reports consistent numbers.

import { scoreTask } from './ai.js';
import { bumpRev, getOfficer, getTask, isOpen, isUnavailable, meetingsFor, nextId, openTasksFor, remainingHours, officerName } from './state.js';
import { TODAY, NOW, horizonDays, toMin, fromMin, dt, datePart, timePart, dayIndex, fmtDue, relDay, fmtTime } from './time.js';

const SLOT = 5; // minute granularity

/** Merge overlapping intervals. */
function merge(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

/** Working-day breakdown for one officer on one date. */
export function dayCapacity(s, officerId, date) {
  const st = s.settings;
  const officer = getOfficer(s, officerId);
  const dayStart = toMin(st.workStart);
  const dayEnd = toMin(st.workEnd);
  const lunch = { start: toMin(st.lunchStart), end: toMin(st.lunchEnd) };
  const workMin = dayEnd - dayStart - Math.max(0, Math.min(lunch.end, dayEnd) - Math.max(lunch.start, dayStart));

  if (isUnavailable(officer, date)) {
    return { date, unavailable: true, workMin, meetingMin: 0, freeMin: 0, free: [], meetings: [] };
  }

  const meetings = meetingsFor(s, officerId, date);
  const meetingBlocks = merge(meetings.map((m) => ({ start: toMin(m.start), end: toMin(m.end) })));
  const meetingMin = meetingBlocks.reduce(
    (n, b) => n + Math.max(0, Math.min(b.end, dayEnd) - Math.max(b.start, dayStart)) - overlap(b, lunch),
    0,
  );

  const start = date === TODAY ? Math.max(dayStart, toMin(timePart(NOW))) : dayStart;
  const busy = merge([lunch, ...meetingBlocks.map((b) => ({ start: b.start, end: b.end + st.bufferMin }))]);
  const free = [];
  let cursor = start;
  for (const b of busy) {
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, dayEnd) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });
  const cleaned = free.filter((f) => f.end - f.start >= SLOT);
  return {
    date,
    unavailable: false,
    workMin,
    meetingMin,
    freeMin: cleaned.reduce((n, f) => n + f.end - f.start, 0),
    free: cleaned,
    meetings,
  };
}

function overlap(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** Pairs of meetings that overlap on a date — shown as calendar conflicts. */
export function meetingConflicts(s, officerId, date) {
  const ms = meetingsFor(s, officerId, date);
  const out = [];
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      if (ms[i].start < ms[j].end && ms[j].start < ms[i].end) out.push([ms[i], ms[j]]);
    }
  }
  return out;
}

/** Scheduling strategies offered as alternative plans. */
export const STRATEGIES = {
  balanced: { label: 'Balanced', desc: 'Urgent “Do now” work first, then by deadline day and AI score.' },
  deadline: { label: 'Deadline-first', desc: 'Strictly earliest deadline first, which minimises late tasks.' },
  cluster: { label: 'Fewer site trips', desc: 'Groups site visits in the same area back to back to cut travel.' },
};

/** Coarse area for site visits: Blk 208 and 209 share an area, 211 and 215 another. */
export function areaKey(t) {
  const m = /\bBlk\s*(\d+)/i.exec(t.location || '');
  return m ? Math.floor(Number(m[1]) / 10) : null;
}

const matchesBoost = (t, boost) => {
  const text = `${t.title} ${t.category}`.toLowerCase();
  return !!boost?.terms?.some((words) => words.every((w) => text.includes(w)));
};

/** Order tasks for a strategy while keeping dependencies ahead of dependants. */
function orderTasks(s, tasks, opts = {}) {
  const strategy = opts.strategy || 'balanced';
  // Balanced: "Do now" work (score 70+) first, then earliest deadline day,
  // then score, so a high-scoring task due later never pushes a task due
  // today past its deadline.
  const urgentToday = (x) => x.score >= 70 && datePart(x.t.due) <= TODAY;
  const balanced = (a, b) =>
    urgentToday(b) - urgentToday(a) || datePart(a.t.due).localeCompare(datePart(b.t.due)) || b.score - a.score || a.t.due.localeCompare(b.t.due);
  const cmp = strategy === 'deadline' ? (a, b) => a.t.due.localeCompare(b.t.due) || b.score - a.score : balanced;
  let scored = tasks
    .map((t) => {
      const boosted = matchesBoost(t, opts.boost);
      return { t, boosted, score: scoreTask(s, t).score + (boosted ? 30 : 0) };
    })
    .sort((a, b) => b.boosted - a.boosted || cmp(a, b));

  // Fewer site trips: right after each site visit, pull in other visits to
  // the same area so they are scheduled back to back.
  if (strategy === 'cluster') {
    const out = [];
    const used = new Set();
    for (const item of scored) {
      if (used.has(item)) continue;
      out.push(item);
      used.add(item);
      const area = areaKey(item.t);
      if (area == null) continue;
      for (const other of scored) {
        if (!used.has(other) && areaKey(other.t) === area) {
          out.push(other);
          used.add(other);
        }
      }
    }
    scored = out;
  }

  const ids = new Set(tasks.map((t) => t.id));
  const placed = new Set();
  const order = [];
  let pending = scored;
  while (pending.length) {
    const idx = pending.findIndex(({ t }) => t.dependsOn.every((d) => !ids.has(d) || placed.has(d)));
    const pick = pending[idx >= 0 ? idx : 0];
    order.push(pick);
    placed.add(pick.t.id);
    pending = pending.filter((p) => p !== pick);
  }
  return order;
}

/** Remove [start, end + buffer) from a list of free intervals. */
function occupy(list, start, end, buffer) {
  const out = [];
  for (const iv of list) {
    if (end + buffer <= iv.start || start >= iv.end) {
      out.push(iv);
      continue;
    }
    if (start - iv.start >= SLOT) out.push({ start: iv.start, end: start });
    if (iv.end - (end + buffer) >= SLOT) out.push({ start: end + buffer, end: iv.end });
  }
  return out;
}

/**
 * Greedy, conflict-aware time blocking over the horizon. Respects working
 * hours, lunch, Outlook meetings (+ buffer), absences, dependencies and a
 * minimum block length. Tasks that cannot fit are reported, never hidden.
 *
 * opts.strategy  'balanced' | 'deadline' | 'cluster'
 * opts.boost     { terms, date } — prioritise tasks matching any term (all of
 *                its words), placing them
 *                from `date` onwards when their deadline allows
 * opts.fixed     blocks to keep exactly where they are (protected work)
 */
export function buildSchedule(s, officerId, days = horizonDays(), opts = {}) {
  const st = s.settings;
  const caps = days.map((d) => dayCapacity(s, officerId, d));
  const free = caps.map((c) => c.free.map((f) => ({ ...f })));
  const finish = {}; // taskId -> { day, min }
  const blocks = [];
  const unscheduled = [];
  const warnings = [];
  const later = (f, day, min) => !f || day > f.day || (day === f.day && min > f.min);

  // Protected blocks are placed first and credited against their task.
  const credit = {};
  for (const b of opts.fixed || []) {
    const di = days.indexOf(b.date);
    if (di < 0) continue;
    free[di] = occupy(free[di], toMin(b.start), toMin(b.end), st.bufferMin);
    credit[b.taskId] = (credit[b.taskId] || 0) + toMin(b.end) - toMin(b.start);
    blocks.push({ taskId: b.taskId, date: b.date, start: b.start, end: b.end, part: 1, parts: 1, protected: true });
    if (later(finish[b.taskId], di, toMin(b.end))) finish[b.taskId] = { day: di, min: toMin(b.end) };
  }
  const boostDay = opts.boost?.date ? days.indexOf(opts.boost.date) : -1;

  for (const { t, score, boosted } of orderTasks(s, openTasksFor(s, officerId), opts)) {
    let need = Math.ceil((remainingHours(t) * 60) / SLOT) * SLOT - (credit[t.id] || 0);
    if (need <= 0) continue;
    const minChunk = Math.min(st.minChunkMin, need);

    // Earliest start: after open dependencies finish (and on the requested
    // day for boosted tasks whose deadline allows it).
    let earliest = { day: 0, min: 0 };
    if (boosted && boostDay > 0 && datePart(t.due) >= opts.boost.date) earliest = { day: boostDay, min: 0 };
    let blocked = null;
    for (const depId of t.dependsOn) {
      const dep = getTask(s, depId);
      if (!dep || !isOpen(dep)) continue;
      if (dep.ownerId !== officerId) {
        warnings.push({ taskId: t.id, type: 'dependency', message: `Depends on “${dep.title}” owned by ${officerName(s, dep.ownerId)}.` });
        continue;
      }
      const f = finish[depId];
      if (!f) blocked = dep;
      else if (later(earliest, f.day, f.min)) earliest = { ...f };
    }
    if (blocked) {
      unscheduled.push({ taskId: t.id, score, reason: `Waiting on “${blocked.title}”, which could not be scheduled.` });
      continue;
    }

    // Tentatively find pieces.
    const pieces = [];
    for (let di = earliest.day; di < days.length && need > 0; di++) {
      for (const iv of free[di]) {
        if (need <= 0) break;
        const start = di === earliest.day ? Math.max(iv.start, earliest.min ? earliest.min + st.bufferMin : 0) : iv.start;
        const avail = iv.end - start;
        let take = Math.min(avail, need);
        // Avoid leaving a tail shorter than the minimum block length.
        if (need - take > 0 && need - take < minChunk) take = need - minChunk;
        if (take < minChunk) continue;
        pieces.push({ di, start, end: start + take });
        need -= take;
      }
    }

    const dueDay = dayIndex(t.due, days);
    if (need > 0) {
      const reason =
        dueDay === Infinity
          ? `Not enough free time this week — due ${fmtDue(t.due)}, can be planned later.`
          : `Not enough free time before the deadline (${fmtDue(t.due)}).`;
      unscheduled.push({ taskId: t.id, score, reason, beyondHorizon: dueDay === Infinity });
      continue;
    }

    const prior = blocks.filter((b) => b.taskId === t.id).length;
    pieces.forEach((p, i) => {
      free[p.di] = occupy(free[p.di], p.start, p.end, st.bufferMin);
      blocks.push({ taskId: t.id, date: days[p.di], start: fromMin(p.start), end: fromMin(p.end), part: prior + i + 1, parts: prior + pieces.length });
    });
    const last = pieces[pieces.length - 1];
    if (later(finish[t.id], last.di, last.end)) finish[t.id] = { day: last.di, min: last.end };
  }

  // Deadline checks run after placement so protected blocks are covered too.
  for (const [taskId, f] of Object.entries(finish)) {
    const t = getTask(s, taskId);
    if (!t) continue;
    const finishAt = dt(days[f.day], fromMin(f.min));
    if (t.due < NOW) warnings.push({ taskId, type: 'overdue', message: `Already overdue (was due ${fmtDue(t.due)}).` });
    else if (finishAt > t.due) warnings.push({ taskId, type: 'late', message: `Earliest finish ${fmtDue(finishAt)} is after the deadline (${fmtDue(t.due)}).` });
  }

  blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  blocks.forEach((b, i) => (b.id = `b${i + 1}`));
  const taskMinByDay = days.map((d) => blocks.filter((b) => b.date === d).reduce((n, b) => n + toMin(b.end) - toMin(b.start), 0));
  return { officerId, days, caps, blocks, unscheduled, warnings, taskMinByDay, strategy: opts.strategy || 'balanced', travel: travelEstimate(s, blocks) };
}

/**
 * Rough travel estimate between site visits each day: 15 min from the office
 * or between areas, 5 min within an area, none within the same block.
 */
export function travelEstimate(s, blocks) {
  let minutes = 0;
  let trips = 0;
  const byDay = {};
  blocks.forEach((b) => (byDay[b.date] ||= []).push(b));
  for (const list of Object.values(byDay)) {
    let prev = null;
    for (const b of [...list].sort((x, y) => x.start.localeCompare(y.start))) {
      const t = getTask(s, b.taskId);
      if (!t || areaKey(t) == null) {
        prev = null; // back at the office
        continue;
      }
      if (prev && prev.location === t.location) continue;
      if (!prev) trips += 1;
      minutes += prev && areaKey(prev) === areaKey(t) ? 5 : 15;
      prev = t;
    }
  }
  return { minutes, trips };
}

// Memoise schedules per state revision — dashboards ask for them repeatedly.
const cache = new WeakMap();
export function schedule(s, officerId) {
  let entry = cache.get(s);
  if (!entry || entry.rev !== s.rev) {
    entry = { rev: s.rev, map: new Map() };
    cache.set(s, entry);
  }
  if (!entry.map.has(officerId)) entry.map.set(officerId, buildSchedule(s, officerId));
  return entry.map.get(officerId);
}

/** Planned finish of a task in the projected schedule, or null. */
export function plannedFinish(s, t) {
  const sch = schedule(s, t.ownerId);
  const bl = sch.blocks.filter((b) => b.taskId === t.id);
  if (!bl.length) return null;
  const last = bl[bl.length - 1];
  return dt(last.date, last.end);
}

/**
 * Deadline risk (High / Medium / Low) with reasons, derived from the owner's
 * projected schedule and availability.
 */
export function assessRisk(s, t) {
  if (!isOpen(t)) return { level: 'none', reasons: [] };
  const reasons = [];
  let level = 'low';
  const raise = (l, why) => {
    reasons.push(why);
    if (l === 'high' || (l === 'medium' && level === 'low')) level = l;
  };
  const owner = getOfficer(s, t.ownerId);
  const sch = schedule(s, t.ownerId);
  const dueDate = datePart(t.due);

  if (t.due < NOW) raise('high', `Overdue since ${fmtDue(t.due)}.`);

  const daysToDue = sch.days.filter((d) => d <= dueDate);
  if (owner && daysToDue.length && daysToDue.every((d) => isUnavailable(owner, d))) {
    raise('high', `${owner.name} is unavailable until after the deadline.`);
  } else if (owner && isUnavailable(owner, dueDate)) {
    raise('medium', `${owner.name} is unavailable on the due date.`);
  }

  const un = sch.unscheduled.find((u) => u.taskId === t.id);
  if (un && !un.beyondHorizon) raise('high', un.reason);
  const late = sch.warnings.find((w) => w.taskId === t.id && w.type === 'late');
  if (late) raise('high', late.message);

  const fin = plannedFinish(s, t);
  if (fin && !late && t.due >= NOW && datePart(fin) === dueDate) {
    const slack = toMin(timePart(t.due)) - toMin(timePart(fin));
    if (slack < 90) raise('medium', `Only ${slack} minutes of buffer before the deadline.`);
  }

  if (t.status === 'todo' && t.due >= NOW && level !== 'high') {
    const ls = latestStart(s, t);
    if (!ls) raise('high', 'Not enough free time left before the deadline, even if started now.');
    else if (datePart(ls) === TODAY && toMin(timePart(ls)) - toMin(timePart(NOW)) <= 120)
      raise('medium', `Not started yet — must start by ${fmtTime(timePart(ls))} to finish on time.`);
  }

  const blockers = t.dependsOn.map((id) => getTask(s, id)).filter((d) => d && isOpen(d));
  if (blockers.length) raise('medium', `Waiting on “${blockers[0].title}”.`);

  if (!reasons.length) reasons.push('Fits comfortably in the current plan.');
  return { level, reasons };
}

/**
 * Capacity analysis for an officer over the horizon. Utilisation is demand
 * based: meetings plus remaining effort of work due in the period, divided by
 * available working time.
 */
export function analyseOfficer(s, officerId) {
  const sch = schedule(s, officerId);
  const officer = getOfficer(s, officerId);
  const open = openTasksFor(s, officerId);

  const perDay = sch.days.map((d, i) => {
    const cap = sch.caps[i];
    const dueMin = open
      .filter((t) => (i === 0 ? datePart(t.due) <= d : datePart(t.due) === d))
      .reduce((n, t) => n + remainingHours(t) * 60, 0);
    const util = cap.unavailable ? null : (cap.meetingMin + dueMin) / cap.workMin;
    return { date: d, unavailable: cap.unavailable, kind: officer.availability?.[d] || null, workMin: cap.workMin, meetingMin: cap.meetingMin, dueMin, plannedMin: sch.taskMinByDay[i], util };
  });

  const lastDay = sch.days[sch.days.length - 1];
  const dueInHorizon = open.filter((t) => datePart(t.due) <= lastDay);
  const loadHours = dueInHorizon.reduce((n, t) => n + remainingHours(t), 0);
  const availDays = perDay.filter((p) => !p.unavailable);
  const workHours = availDays.reduce((n, p) => n + p.workMin, 0) / 60;
  const meetingHours = availDays.reduce((n, p) => n + p.meetingMin, 0) / 60;
  const weekUtil = workHours ? (meetingHours + loadHours) / workHours : null;
  const today = perDay[0];
  const atRisk = open.filter((t) => assessRisk(s, t).level === 'high');
  const missing = sch.unscheduled.filter((u) => !u.beyondHorizon).length + sch.warnings.filter((w) => w.type === 'late').length;

  let status;
  if (today.unavailable) status = { id: 'away', label: 'Unavailable' };
  else if (missing > 0 || today.util > 1) status = { id: 'over', label: 'Overloaded' };
  else if (today.util >= 0.85 || weekUtil >= 0.85) status = { id: 'near', label: 'Near capacity' };
  else if (today.util < 0.6 && weekUtil < 0.5) status = { id: 'spare', label: 'Spare capacity' };
  else status = { id: 'ok', label: 'Balanced' };

  const freeHours = Math.max(0, workHours - meetingHours - loadHours);
  return { officer, perDay, loadHours, workHours, meetingHours, freeHours, weekUtil, today, status, atRisk, openCount: open.length, missing, schedule: sch };
}

export function teamAnalysis(s) {
  return s.officers.map((o) => analyseOfficer(s, o.id));
}

/** Fingerprint of inputs so the planner can tell when a plan is stale. */
export function planSignature(s, officerId) {
  const t = openTasksFor(s, officerId)
    .map((x) => `${x.id}:${x.effort}:${x.spent}:${x.due}:${x.status}:${x.priority}`)
    .sort()
    .join('|');
  const m = meetingsFor(s, officerId)
    .map((x) => `${x.id}:${x.date}:${x.start}:${x.end}`)
    .join('|');
  const a = JSON.stringify(getOfficer(s, officerId).availability || {});
  return `${t}#${m}#${a}#${JSON.stringify(s.settings)}`;
}

/** Accepted plan blocks that now overlap an Outlook meeting. */
export function planClashes(s, officerId) {
  const plan = s.plans[officerId];
  if (!plan) return [];
  const out = [];
  for (const b of plan.blocks) {
    for (const m of meetingsFor(s, officerId, b.date)) {
      if (b.start < m.end && m.start < b.end) out.push({ block: b, meeting: m });
    }
  }
  return out;
}

/** Plan generated for one officer and saved as a draft for human review. */
export function generatePlan(s, officerId, opts = {}) {
  const sch = buildSchedule(s, officerId, horizonDays(), opts);
  return {
    status: 'draft',
    generatedAt: NOW,
    signature: planSignature(s, officerId),
    strategy: sch.strategy,
    note: opts.note || null,
    blocks: sch.blocks.map(({ protected: _p, ...b }) => b),
    unscheduled: sch.unscheduled,
    warnings: sch.warnings,
  };
}

// ----- start-by deadlines and smart reminders -----

/**
 * The latest time an officer can start a task and still finish by the
 * deadline, using only their free time (meetings, lunch and absences
 * excluded). Returns null if it cannot fit even if started now.
 */
export function latestStart(s, t) {
  let need = remainingHours(t) * 60;
  const dueDate = datePart(t.due);
  const days = horizonDays()
    .filter((d) => d <= dueDate)
    .reverse();
  for (const d of days) {
    const free = [...dayCapacity(s, t.ownerId, d).free].reverse();
    for (const iv of free) {
      const end = d === dueDate ? Math.min(iv.end, toMin(timePart(t.due))) : iv.end;
      if (end <= iv.start) continue;
      const take = Math.min(need, end - iv.start);
      need -= take;
      if (need <= 0) return dt(d, fromMin(end - take));
    }
  }
  return null;
}

/** Reminder suggestions based on importance and preparation time needed. */
export function smartReminders(s, officerId) {
  const out = [];
  for (const t of openTasksFor(s, officerId)) {
    if (t.status !== 'todo' || t.due < NOW) continue;
    const ls = latestStart(s, t);
    if (!ls) continue;
    const { score } = scoreTask(s, t);
    const lead = t.safety ? 60 : score >= 70 ? 45 : score >= 50 ? 30 : 15;
    const why = t.safety ? 'safety work — allow an hour to prepare equipment and access' : score >= 70 ? 'high priority — 45 minutes to prepare' : score >= 50 ? '30 minutes to prepare' : 'short heads-up';
    let at;
    if (datePart(ls) === TODAY) {
      const m = Math.max(toMin(timePart(NOW)), toMin(timePart(ls)) - lead);
      at = dt(TODAY, fromMin(m));
    } else {
      at = dt(datePart(ls), fromMin(Math.max(toMin(s.settings.workStart), toMin(timePart(ls)) - lead)));
    }
    out.push({ key: `rem:${t.id}`, taskId: t.id, at, latest: ls, lead, why, score });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, 6);
}

// ----- manual plan editing: realism checks -----

/**
 * Check a (possibly hand-edited) plan for problems: outside working hours,
 * clashes, overbooked days, deadline misses, dependency order and work that
 * is out of priority order. Returns issues, most serious first.
 */
export function checkPlan(s, officerId, blocks) {
  const st = s.settings;
  const officer = getOfficer(s, officerId);
  const ws = toMin(st.workStart);
  const we = toMin(st.workEnd);
  const lunch = { start: toMin(st.lunchStart), end: toMin(st.lunchEnd) };
  const issues = [];
  const add = (level, blockId, taskId, message) => issues.push({ level, blockId, taskId, message });
  const sorted = [...blocks].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const lastEnd = {};
  sorted.forEach((b) => {
    const e = dt(b.date, b.end);
    if (!lastEnd[b.taskId] || e > lastEnd[b.taskId]) lastEnd[b.taskId] = e;
  });

  sorted.forEach((b, i) => {
    const t = getTask(s, b.taskId);
    if (!t || !isOpen(t) || t.ownerId !== officerId) return add('warning', b.id, b.taskId, 'This task is completed, deleted or reassigned — remove the block.');
    const iv = { start: toMin(b.start), end: toMin(b.end) };
    if (isUnavailable(officer, b.date)) add('danger', b.id, t.id, `“${t.title}” is planned on a day you are unavailable.`);
    if (iv.start < ws || iv.end > we) add('danger', b.id, t.id, `“${t.title}” is outside working hours (${st.workStart}–${st.workEnd}).`);
    if (overlap(iv, lunch) > 0) add('warning', b.id, t.id, `“${t.title}” overlaps the lunch break.`);
    if (b.date === TODAY && b.start < timePart(NOW)) add('warning', b.id, t.id, `“${t.title}” starts before the current time.`);
    for (const m of meetingsFor(s, officerId, b.date)) {
      if (overlap(iv, { start: toMin(m.start), end: toMin(m.end) }) > 0) add('danger', b.id, t.id, `“${t.title}” clashes with “${m.title}” (${m.start}–${m.end}).`);
    }
    for (const o of sorted.slice(i + 1)) {
      if (o.date === b.date && overlap(iv, { start: toMin(o.start), end: toMin(o.end) }) > 0) add('danger', b.id, t.id, `“${t.title}” overlaps another planned block.`);
    }
    if (t.due >= NOW && dt(b.date, b.end) > t.due) add('danger', b.id, t.id, `“${t.title}” is planned to finish after its deadline (${fmtDue(t.due)}).`);
    for (const depId of t.dependsOn) {
      const dep = getTask(s, depId);
      if (dep && isOpen(dep) && lastEnd[depId] && lastEnd[depId] > dt(b.date, b.start)) add('warning', b.id, t.id, `“${t.title}” starts before “${dep.title}” is planned to finish.`);
    }
  });

  // Coverage: every open task due this week should be fully planned.
  const days = horizonDays();
  for (const t of openTasksFor(s, officerId)) {
    const planned = blocks.filter((b) => b.taskId === t.id).reduce((n, b) => n + toMin(b.end) - toMin(b.start), 0);
    const need = remainingHours(t) * 60;
    if (datePart(t.due) > days[days.length - 1]) continue;
    if (!planned) add('warning', null, t.id, `“${t.title}” (due ${fmtDue(t.due)}) is not in the plan.`);
    else if (planned < need - 5) add('warning', null, t.id, `Only ${Math.round((planned / 60) * 100) / 100}h of “${t.title}” is planned; it needs ${remainingHours(t)}h.`);
  }

  // Overbooked days: tasks + meetings beyond working time.
  for (const d of days) {
    const cap = dayCapacity(s, officerId, d);
    if (cap.unavailable) continue;
    const taskMin = blocks.filter((b) => b.date === d).reduce((n, b) => n + toMin(b.end) - toMin(b.start), 0);
    if (taskMin + cap.meetingMin > cap.workMin) add('danger', null, null, `${relDay(d)} is overbooked: ${Math.round(((taskMin + cap.meetingMin) / 60) * 10) / 10}h planned against ${cap.workMin / 60}h of working time.`);
  }

  // Priority order: a late task while lower-priority, later-due work runs first.
  for (const [taskId, end] of Object.entries(lastEnd)) {
    const late = getTask(s, taskId);
    if (!late || !isOpen(late) || end <= late.due || late.due < NOW) continue;
    const lateScore = scoreTask(s, late).score;
    const firstStart = sorted.find((b) => b.taskId === taskId);
    const earlier = sorted.find((b) => {
      const o = getTask(s, b.taskId);
      return o && o.id !== taskId && dt(b.date, b.start) < dt(firstStart.date, firstStart.start) && o.due > late.due && scoreTask(s, o).score < lateScore;
    });
    if (earlier) add('warning', earlier.id, earlier.taskId, `Out of priority order: “${getTask(s, earlier.taskId).title}” runs before “${late.title}”, which is due sooner and would finish late.`);
  }

  const rank = { danger: 0, warning: 1 };
  const seen = new Set();
  return issues
    .filter((i) => !seen.has(i.message) && seen.add(i.message))
    .sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Generate and score each scheduling strategy as alternatives to compare. */
export function compareStrategies(s, officerId) {
  return Object.entries(STRATEGIES).map(([id, meta]) => {
    const sch = buildSchedule(s, officerId, horizonDays(), { strategy: id });
    const late = sch.warnings.filter((w) => w.type === 'late').length + sch.unscheduled.filter((u) => !u.beyondHorizon).length;
    return { id, ...meta, sch, late, scheduled: new Set(sch.blocks.map((b) => b.taskId)).size, travel: sch.travel };
  });
}

// ----- emergency rescheduling -----

/**
 * Insert an urgent task and re-plan the week. Critical work and safety work
 * due today keep their current slots; lower-priority work moves around the
 * emergency. Runs on a copy — nothing changes until the officer approves.
 */
export function emergencyReschedule(s, officerId, fields) {
  const current = s.plans[officerId]?.blocks || schedule(s, officerId).blocks;
  const sim = bumpRev(structuredClone(s));
  const task = { id: nextId(sim, 't'), description: 'Urgent task added through emergency rescheduling.', spent: 0, status: 'todo', dependsOn: [], source: 'SyncAI', impact: 'high', createdAt: NOW, completedAt: null, actual: null, ownerId: officerId, ...fields };
  sim.tasks.push(task);
  bumpRev(sim);

  // Only protect blocks that are themselves realistic (no clash, not late).
  const broken = new Set(checkPlan(s, officerId, current).filter((i) => i.level === 'danger' && i.blockId).map((i) => i.blockId));
  const keep = current.filter((b) => {
    const t = getTask(sim, b.taskId);
    return t && isOpen(t) && !broken.has(b.id) && dt(b.date, b.start) >= NOW && (t.priority === 'Critical' || (t.safety && datePart(t.due) === TODAY));
  });
  const after = buildSchedule(sim, officerId, horizonDays(), { fixed: keep });
  const first = (blocks, id) => blocks.filter((b) => b.taskId === id).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  const label = (b) => (b ? `${relDay(b.date)} ${b.start}` : 'Not scheduled');

  const moved = [];
  for (const t of openTasksFor(s, officerId)) {
    const a = first(current, t.id);
    const b = first(after.blocks, t.id);
    if (label(a) !== label(b)) moved.push({ taskId: t.id, title: t.title, from: label(a), to: label(b), dropped: !b });
  }
  const newlyLate = after.warnings
    .filter((w) => w.type === 'late')
    .map((w) => w.taskId)
    .concat(after.unscheduled.filter((u) => !u.beyondHorizon).map((u) => u.taskId));
  return { sim, task, after, protectedIds: [...new Set(keep.map((b) => b.taskId))], moved, newlyLate: [...new Set(newlyLate)] };
}
