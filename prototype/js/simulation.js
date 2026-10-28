// Reassignment recommendations and What-If simulations. Simulations run on a
// cloned copy of the state; the baseline only changes when a supervisor
// explicitly applies the result.

import { CATEGORY_SKILL } from './data.js';
import { bumpRev, getOfficer, getTask, isOpen, isUnavailable, nextId, openTasksFor, remainingHours, officerName } from './state.js';
import { analyseOfficer, assessRisk, schedule, teamAnalysis } from './planner.js';
import { TODAY, NOW, horizonDays, workDay, dt, datePart, timePart, toMin, fmtDue, fmtDay, fmtTime } from './time.js';

export const INCIDENTS = [
  { id: 'lift', title: 'Lift breakdown with resident trapped — Blk 214', category: 'Maintenance', effort: 2.5, dueTime: '13:00', location: 'Blk 214', zone: 'Zone A', skill: 'lift', label: 'Lift breakdown (resident trapped)' },
  { id: 'pipe', title: 'Burst water pipe flooding common corridor — Blk 316', category: 'Maintenance', effort: 3, dueTime: '17:00', location: 'Blk 316', zone: 'Zone B', skill: 'maintenance', label: 'Burst water pipe' },
  { id: 'tree', title: 'Fallen tree blocking footpath — Blk 402', category: 'Horticulture', effort: 2, dueTime: '15:00', location: 'Blk 402', zone: 'Zone C', skill: 'horticulture', label: 'Fallen tree on footpath' },
];

function requiredSkills(task) {
  const skills = [CATEGORY_SKILL[task.category]];
  if (/\blift\b/i.test(task.title)) skills.push('lift');
  return skills.filter(Boolean);
}

/**
 * Rank officers who could take a task. Skill, spare capacity, availability
 * before the deadline and zone familiarity all contribute.
 */
export function rankCandidates(s, task, { exclude = [] } = {}) {
  const dueDate = datePart(task.due);
  const days = horizonDays().filter((d) => d <= dueDate);
  const need = remainingHours(task);
  const skills = requiredSkills(task);

  return s.officers
    .filter((o) => !exclude.includes(o.id))
    .map((o) => {
      const a = analyseOfficer(s, o.id);
      const reasons = [];
      let score = 0;
      const availableDays = (days.length ? days : [TODAY]).filter((d) => !isUnavailable(o, d));
      if (!availableDays.length) return { officer: o, score: -1, eligible: false, reasons: ['unavailable before the deadline'] };

      const matched = skills.filter((k) => o.skills.includes(k));
      if (matched.length) {
        score += 25 + 10 * (matched.length - 1);
        reasons.push(`has ${matched.join(' & ')} skills`);
      } else {
        reasons.push('no direct skill match');
        if (task.safety) score -= 20;
      }

      // Spare time before the deadline: working time minus meetings, minus
      // work the candidate already has due by then.
      const lastDay = dueDate < a.perDay[0].date ? a.perDay[0].date : dueDate;
      const st = s.settings;
      const dayFraction = Math.min(1, Math.max(0, (toMin(timePart(task.due)) - toMin(st.workStart)) / (toMin(st.workEnd) - toMin(st.workStart))));
      const capMin = a.perDay
        .filter((p) => !p.unavailable && p.date <= lastDay)
        .reduce((n, p) => n + (p.workMin - p.meetingMin) * (p.date === dueDate ? dayFraction : 1), 0);
      const loadMin = openTasksFor(s, o.id)
        .filter((t) => t.due <= task.due)
        .reduce((n, t) => n + remainingHours(t) * 60, 0);
      const spare = (capMin - loadMin) / 60;
      const fits = spare >= need;
      if (fits) {
        score += Math.min(spare, 10) * 3;
        reasons.push(`${Math.round(spare * 10) / 10}h free before the deadline`);
      } else {
        score -= 25;
        reasons.push('not enough free time before the deadline');
      }

      if (a.status.id === 'over') {
        score -= 15;
        reasons.push('already overloaded');
      } else if (a.status.id === 'spare') {
        score += 8;
      }
      if (task.zone ? o.zone === task.zone : false) {
        score += 10;
        reasons.push(`covers ${o.zone}`);
      }
      return { officer: o, score: Math.round(score), eligible: true, fits, reasons };
    })
    .filter((c) => c.eligible)
    .sort((a, b) => b.score - a.score);
}

/** Tasks an officer cannot finish on time in their projected schedule. */
function missedCount(s, officerId) {
  const sch = schedule(s, officerId);
  return sch.unscheduled.filter((u) => !u.beyondHorizon).length + sch.warnings.filter((w) => w.type === 'late').length;
}

/**
 * Suggest moving at-risk work away from overloaded or absent officers.
 * Tasks already in progress stay with their owner unless the owner is away.
 * Each move is tried on a working copy and only kept if the receiving
 * officer can still finish all of their work on time.
 */
export function recommendReassignments(s, { limit = 8 } = {}) {
  const team = teamAnalysis(s);
  // Cover absent officers first, then relieve overloaded ones.
  const sources = [...team.filter((a) => a.status.id === 'away'), ...team.filter((a) => a.status.id === 'over')];
  let work = bumpRev(structuredClone(s));
  const recs = [];

  for (const a of sources) {
    const away = a.status.id === 'away';
    const candidates = s.tasks
      .filter((t) => t.ownerId === a.officer.id && isOpen(t))
      .filter((t) => away || (t.status !== 'in_progress' && t.priority !== 'Critical'))
      .map((t) => ({ t, risk: assessRisk(s, t) }))
      .filter(({ risk }) => risk.level === 'high')
      .sort((x, y) => x.t.due.localeCompare(y.t.due));

    for (const { t, risk } of candidates) {
      if (recs.length >= limit) break;
      const ranked = rankCandidates(work, { ...t, zone: a.officer.zone }, { exclude: [t.ownerId] });
      let chosen = null;
      for (const c of ranked.filter((r) => r.fits && r.score >= 10).slice(0, 4)) {
        const trial = structuredClone(work);
        applyReassignment(trial, { taskId: t.id, toId: c.officer.id });
        bumpRev(trial);
        if (missedCount(trial, c.officer.id) <= missedCount(work, c.officer.id)) {
          chosen = c;
          work = trial;
          break;
        }
      }
      if (!chosen) continue;
      recs.push({
        id: `rec:${t.id}:${chosen.officer.id}`,
        taskId: t.id,
        fromId: t.ownerId,
        toId: chosen.officer.id,
        fit: chosen.score,
        why: risk.reasons[0],
        reasons: [...chosen.reasons, 'fits their schedule without making other work late'],
        alternatives: ranked.filter((r) => r !== chosen).slice(0, 2).map((r) => r.officer.name),
      });
    }
  }
  return recs;
}

export function applyReassignment(s, rec) {
  const t = getTask(s, rec.taskId);
  if (!t) return;
  t.ownerId = rec.toId;
  t.status = t.status === 'in_progress' ? 'todo' : t.status;
}

/** Summary metrics used for before/after comparison. */
export function snapshot(s) {
  const team = teamAnalysis(s);
  const open = s.tasks.filter(isOpen);
  const risks = open.map((t) => ({ id: t.id, level: assessRisk(s, t).level }));
  const avail = team.filter((a) => a.weekUtil != null && a.status.id !== 'away');
  return {
    team: team.map((a) => ({ id: a.officer.id, name: a.officer.name, weekUtil: a.weekUtil, todayUtil: a.today.util, status: a.status, missing: a.missing })),
    highRisk: risks.filter((r) => r.level === 'high').map((r) => r.id),
    mediumRisk: risks.filter((r) => r.level === 'medium').length,
    overloaded: team.filter((a) => a.status.id === 'over').length,
    unavailable: team.filter((a) => a.status.id === 'away').length,
    avgUtil: avail.length ? avail.reduce((n, a) => n + a.weekUtil, 0) / avail.length : 0,
    missing: team.reduce((n, a) => n + a.missing, 0),
  };
}

function makeTask(s, fields) {
  return {
    id: nextId(s, 't'),
    description: '',
    spent: 0,
    status: 'todo',
    dependsOn: [],
    source: 'SyncAI',
    impact: 'high',
    createdAt: NOW,
    completedAt: null,
    actual: null,
    ...fields,
  };
}

/** Run a what-if scenario on a copy of the state. */
export function runSimulation(base, sc) {
  const sim = bumpRev(structuredClone(base));
  const notes = [];
  const added = [];
  const absenceDays = horizonDays().slice(0, sc.absenceDays);

  for (const id of sc.absent) {
    const o = getOfficer(sim, id);
    absenceDays.forEach((d) => {
      o.availability[d] = o.availability[d] || sc.absenceType;
    });
    notes.push(`${o.name} marked unavailable for ${absenceDays.length} day${absenceDays.length > 1 ? 's' : ''} (${fmtDay(absenceDays[0])}${absenceDays.length > 1 ? ` – ${fmtDay(absenceDays[absenceDays.length - 1])}` : ''}).`);
  }
  bumpRev(sim);

  const addTask = (fields, assignee, zone) => {
    const draft = { ...fields, ownerId: null };
    let ownerId = assignee;
    let why = 'Assigned by supervisor';
    if (assignee === 'auto') {
      const best = rankCandidates(sim, { ...draft, zone })[0];
      ownerId = best?.officer.id || sim.officers[0].id;
      why = best ? `Best fit — ${best.reasons.join(', ')}` : 'No ideal candidate — assigned to first available officer';
    }
    const t = makeTask(sim, { ...fields, ownerId });
    sim.tasks.push(t);
    bumpRev(sim);
    added.push({ taskId: t.id, ownerId, why });
    notes.push(`New task “${t.title}” assigned to ${officerName(sim, ownerId)}. ${why}.`);
  };

  if (sc.incident) {
    const inc = INCIDENTS.find((i) => i.id === sc.incident);
    addTask(
      { title: inc.title, category: inc.category, priority: 'Critical', due: dt(TODAY, inc.dueTime), effort: inc.effort, location: inc.location, safety: true, description: 'Urgent incident (simulated).' },
      sc.incidentAssignee,
      inc.zone,
    );
  }
  if (sc.extra) {
    addTask(
      { title: sc.extra.title, category: sc.extra.category, priority: 'High', due: dt(workDay(sc.extra.dueDays), '17:00'), effort: sc.extra.effort, location: '', safety: false, description: 'Additional assignment (simulated).' },
      sc.extra.assignee,
      null,
    );
  }

  const afterNoAction = snapshot(sim);
  const recs = recommendReassignments(sim, { limit: 12 });
  const withActions = bumpRev(structuredClone(sim));
  recs.forEach((r) => applyReassignment(withActions, r));
  bumpRev(withActions);

  return {
    scenario: sc,
    sim,
    recs,
    added,
    notes,
    before: snapshot(base),
    afterNoAction,
    after: snapshot(withActions),
    afterState: withActions,
    moved: movedTasks(base, withActions),
  };
}

/** Tasks whose planned start changes between two states. */
export function movedTasks(a, b) {
  const firstBlock = (s, t) => schedule(s, t.ownerId).blocks.find((x) => x.taskId === t.id) || null;
  const out = [];
  for (const tb of b.tasks.filter(isOpen)) {
    const ta = getTask(a, tb.id);
    if (!ta) continue;
    const before = firstBlock(a, ta);
    const after = firstBlock(b, tb);
    const ownerChanged = ta.ownerId !== tb.ownerId;
    const label = (bl) => (bl ? `${fmtDay(bl.date)} ${fmtTime(bl.start)}` : 'Not scheduled');
    const dayOf = (bl) => (bl ? bl.date : null);
    if (ownerChanged || dayOf(before) !== dayOf(after)) {
      out.push({
        taskId: tb.id,
        title: tb.title,
        fromOwner: ta.ownerId,
        toOwner: tb.ownerId,
        from: label(before),
        to: label(after),
        due: fmtDue(tb.due),
        late: !after,
      });
    }
  }
  return out;
}

/** Commit a simulation (with the supervisor's chosen recommendations). */
export function commitSimulation(result, acceptedIds) {
  const next = structuredClone(result.sim);
  const applied = result.recs.filter((r) => acceptedIds.includes(r.id));
  applied.forEach((r) => applyReassignment(next, r));
  return { next, applied };
}
