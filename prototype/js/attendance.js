// Attendance tracking (104) and MC reshuffle (051).
//
// Attendance is stored on the state as `s.attendance[date][officerId] =
// { checkIn, checkOut }`. An absence (MC, leave) is stored the way the rest of
// the prototype already stores it, in `officer.availability[date]`, so the
// planner, the Team page and Ripple Intelligence all see the same people as
// unavailable. Only the type of absence is recorded, never medical details.

import { NOW_TIME, TODAY, fmtDue } from './time.js';
import { absenceLabel, bumpRev, getOfficer, getTask, isOpen, logActivity, officerName, openTasksFor } from './state.js';
import { applyReassignment, rankCandidates, snapshot } from './simulation.js';

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/** Officers who checked in before the demo clock starts. The last one is still to arrive. */
function demoRecord(s, officer) {
  const available = s.officers.filter((o) => !o.availability?.[TODAY]);
  const index = available.findIndex((o) => o.id === officer.id);
  if (index < 0 || index === available.length - 1) return null;
  return { checkIn: `08:${String(5 + index * 7).padStart(2, '0')}`, checkOut: null };
}

export function attendanceRecord(s, officer) {
  return s.attendance?.[TODAY]?.[officer.id] || demoRecord(s, officer);
}

/**
 * Today's attendance for one officer.
 * `group` is one of present, pending, absent so the page can count and filter.
 */
export function attendanceStatus(s, officer) {
  const kind = officer.availability?.[TODAY] || null;
  if (kind) {
    return {
      id: kind === 'mc' ? 'mc' : kind === 'leave' ? 'leave' : 'away',
      group: 'absent',
      label: absenceLabel(kind, true),
      kind,
      checkIn: null,
      checkOut: null,
    };
  }
  const rec = attendanceRecord(s, officer);
  if (rec?.checkOut) return { id: 'out', group: 'present', label: `Checked out ${rec.checkOut}`, kind: null, checkIn: rec.checkIn, checkOut: rec.checkOut };
  if (rec?.checkIn) return { id: 'in', group: 'present', label: `Checked in ${rec.checkIn}`, kind: null, checkIn: rec.checkIn, checkOut: null };
  return { id: 'pending', group: 'pending', label: 'Not checked in yet', kind: null, checkIn: null, checkOut: null };
}

export function attendanceSummary(s) {
  const rows = s.officers.map((officer) => ({ officer, status: attendanceStatus(s, officer) }));
  const count = (group) => rows.filter((r) => r.status.group === group).length;
  return { rows, present: count('present'), pending: count('pending'), absent: count('absent'), total: rows.length };
}

export function absentOfficers(s) {
  return s.officers.filter((o) => o.availability?.[TODAY]);
}

// ----- mutations: call inside update((s) => ...) -----

function record(s, officerId) {
  s.attendance ||= {};
  s.attendance[TODAY] ||= {};
  // Keep the demo check-ins once anything is edited, so they do not shift.
  for (const o of s.officers) {
    if (!s.attendance[TODAY][o.id]) {
      const demo = demoRecord(s, o);
      if (demo) s.attendance[TODAY][o.id] = demo;
    }
  }
  s.attendance[TODAY][officerId] ||= { checkIn: null, checkOut: null };
  return s.attendance[TODAY][officerId];
}

export function checkIn(s, officerId) {
  const officer = getOfficer(s, officerId);
  if (!officer) return false;
  delete officer.availability?.[TODAY];
  const rec = record(s, officerId);
  rec.checkIn = NOW_TIME;
  rec.checkOut = null;
  logActivity(s, `${officer.name} checked in at ${NOW_TIME}.`);
  return true;
}

export function checkOut(s, officerId) {
  const officer = getOfficer(s, officerId);
  if (!officer || !attendanceStatus(s, officer).checkIn) return false;
  record(s, officerId).checkOut = NOW_TIME;
  logActivity(s, `${officer.name} checked out at ${NOW_TIME}.`);
  return true;
}

/** Mark someone absent today. Only the type is stored. */
export function markAbsent(s, officerId, kind = 'mc') {
  const officer = getOfficer(s, officerId);
  if (!officer) return false;
  record(s, officerId);
  s.attendance[TODAY][officerId] = { checkIn: null, checkOut: null };
  officer.availability = { ...(officer.availability || {}), [TODAY]: kind };
  logActivity(s, `${officer.name} marked ${absenceLabel(kind, true).toLowerCase()} today.`);
  return true;
}

export function clearAbsence(s, officerId) {
  const officer = getOfficer(s, officerId);
  if (!officer?.availability?.[TODAY]) return false;
  delete officer.availability[TODAY];
  record(s, officerId);
  logActivity(s, `${officer.name} is back and no longer marked absent today.`);
  return true;
}

// ----- MC reshuffle (051) -----

/**
 * Propose who takes over the open work of everyone who is absent today.
 * Work is handled most important first (safety, statutory, then deadline), and
 * each pick is applied to a working copy so the next pick sees the new load.
 *
 * Returns { absent, proposals, unassigned, before, after } and never changes `s`.
 */
export function proposeReshuffle(s) {
  const absent = absentOfficers(s);
  const absentIds = absent.map((o) => o.id);
  const work = bumpRev(structuredClone(s));
  const proposals = [];
  const unassigned = [];

  const tasks = absent
    .flatMap((o) => openTasksFor(s, o.id))
    .sort(
      (a, b) =>
        Number(!!b.safety) - Number(!!a.safety) ||
        Number(!!b.statutory) - Number(!!a.statutory) ||
        (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4) ||
        a.due.localeCompare(b.due),
    );

  for (const task of tasks) {
    const ranked = rankCandidates(work, { ...task, zone: getOfficer(s, task.ownerId)?.zone }, { exclude: absentIds });
    // Safety work must go to someone with the right skills. Anything else may go to the best fit with time.
    const pick = ranked.find((c) => c.fits && c.score >= 0 && !(task.safety && c.reasons.includes('no direct skill match'))) || null;
    const base = {
      taskId: task.id,
      title: task.title,
      due: fmtDue(task.due),
      priority: task.priority,
      safety: !!task.safety,
      statutory: !!task.statutory,
      fromId: task.ownerId,
      fromName: officerName(s, task.ownerId),
    };
    if (!pick) {
      const near = ranked[0];
      unassigned.push({
        ...base,
        reason: near
          ? `${near.officer.name} is the closest match but ${near.reasons.find((r) => /not enough|no direct/.test(r)) || 'cannot fit it'}.`
          : 'Nobody is available before the deadline.',
      });
      continue;
    }
    applyReassignment(work, { taskId: task.id, toId: pick.officer.id });
    bumpRev(work);
    proposals.push({
      ...base,
      toId: pick.officer.id,
      toName: pick.officer.name,
      fit: pick.score,
      reasons: pick.reasons,
      alternatives: ranked.filter((c) => c !== pick).slice(0, 2).map((c) => c.officer.name),
    });
  }

  return { absent, proposals, unassigned, before: snapshot(s), after: snapshot(work) };
}

/** Apply approved proposals to the live state. Call inside update((s) => ...). */
export function applyReshuffle(s, proposals) {
  let moved = 0;
  const from = new Set();
  const to = new Set();
  for (const p of proposals) {
    const task = getTask(s, p.taskId);
    if (!task || !isOpen(task) || !p.toId) continue;
    applyReassignment(s, p);
    from.add(p.fromName);
    to.add(p.toName);
    moved += 1;
  }
  if (moved) {
    logActivity(s, `MC reshuffle approved: ${moved} task${moved > 1 ? 's' : ''} moved from ${[...from].join(', ')} to ${[...to].join(', ')}.`);
  }
  return moved;
}
