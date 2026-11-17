// Ripple Intelligence board: everything the Ripple page shows, worked out from
// the existing engines (ripple.js, simulation.js, planner.js) without changing
// them. Pure functions, so they can be tested without a browser.
//
//   031 multi-hop dependency tracing  -> chainsFor()
//   032 incident impact cascade       -> board.cascade
//   035 before / after plan view      -> board.plans
//   036 three alternative strategies  -> board.options
//   040 consequences with explanations-> board.explain

import { INCIDENTS, applyReassignment, snapshot } from './simulation.js';
import { analyzeScenarioRipple, evaluateAlternatives, traceDownstream, traceUpstream } from './ripple.js';
import { absentOfficers } from './attendance.js';
import { assessRisk, buildSchedule } from './planner.js';
import { bumpRev, getOfficer, getTask, isOpen, logActivity, meetingsFor, nextId, officerName } from './state.js';
import { NOW, TODAY, datePart, dt, fmtHours, horizonDays, workDay } from './time.js';

export const SCENARIOS = [
  { id: 'lift', label: 'Lift entrapment, Blk 214', hint: 'Urgent safety incident for Aisyah', make: () => ({ incident: 'lift', incidentAssignee: 'o1' }) },
  { id: 'pipe', label: 'Burst water pipe, Blk 316', hint: 'Urgent incident for Daniel', make: () => ({ incident: 'pipe', incidentAssignee: 'o4' }) },
  {
    id: 'absent',
    label: 'Officers absent today',
    hint: 'Uses the Attendance page',
    make: (s) => {
      const absent = absentOfficers(s);
      return { absent: absent.map((o) => o.id), absenceType: absent[0]?.availability?.[TODAY] || 'mc', absenceDays: 1 };
    },
  },
];

export const OPTION_IDS = ['none', 'reschedule', 'reassign'];
const OPTION_KEY = { none: 'noAction', reschedule: 'reschedule', reassign: 'reassign' };
export const OPTION_LABEL = { none: 'No action', reschedule: 'Reschedule lower-impact work', reassign: 'Reassign eligible work' };

// ----- 031: dependency chains -----

/** Tasks that other tasks depend on, so the page can offer them to explore. */
export function chainRoots(s) {
  return s.tasks
    .filter((t) => isOpen(t) && s.tasks.some((o) => isOpen(o) && o.dependsOn?.includes(t.id)))
    .map((t) => t.id);
}

/**
 * Walk the chain below one task. Each step has the task, how many hops from the
 * disrupted task it is, and what is at stake, so the page can draw
 * "A -> B -> C" and say why each link matters.
 */
export function chainsFor(s, rootId) {
  const root = getTask(s, rootId);
  if (!root) return null;
  const down = traceDownstream(s, rootId);
  const upstream = traceUpstream(s, rootId);
  // In a circular dependency the engine lists the starting task as its own dependent. Leave it out.
  const dependents = down.dependents.filter((d) => d.task.id !== rootId);
  return {
    root,
    upstream: upstream.map((u) => u.task),
    steps: dependents.map((d) => ({
      task: d.task,
      depth: d.depth,
      path: d.chain.map((id) => getTask(s, id)).filter(Boolean),
      statutory: !!d.task.statutory,
      safety: !!d.task.safety,
      consequence: d.task.consequence || null,
      slaDue: d.task.slaDue,
      slaType: d.task.slaType,
    })),
    maxDepth: dependents.reduce((n, d) => Math.max(n, d.depth), 0),
    hasCycle: down.hasCycle,
  };
}

// ----- building the three "after" states -----

function incidentTask(s, scenario, id = 'sim_inc') {
  const inc = INCIDENTS.find((i) => i.id === scenario.incident);
  if (!inc) return null;
  return {
    id,
    title: inc.title,
    description: '',
    category: inc.category,
    priority: 'Critical',
    due: dt(TODAY, inc.dueTime),
    effort: inc.effort,
    spent: 0,
    status: 'todo',
    location: inc.location,
    dependsOn: [],
    source: 'SyncAI',
    safety: true,
    statutory: false,
    consequence: null,
    complaints: 0,
    impact: 'high',
    slaDue: dt(TODAY, inc.dueTime),
    slaType: 'Safety SLA (BCA standard)',
    appointmentTime: null,
    commitmentWindow: null,
    createdAt: NOW,
    completedAt: null,
    actual: null,
    projectId: null,
    checklist: [],
    ownerId: scenario.incidentAssignee,
  };
}

const withRev = (state) => bumpRev(state);

/** The day as it would be if the disruption happened and nothing was done about it. */
function disrupted(base, scenario) {
  const sim = structuredClone(base);
  const inc = scenario.incident ? incidentTask(base, scenario) : null;
  if (inc) sim.tasks.push(inc);
  return withRev(sim);
}

function reschedulePlan(base, alt) {
  return alt.displacedTasks.map((d) => {
    const task = getTask(base, d.taskId);
    const idx = horizonDays().indexOf(datePart(task.due));
    return { taskId: d.taskId, title: d.title, from: d.from, to: d.to, newDue: dt(workDay(Math.min(4, idx + 1)), '17:00') };
  });
}

function applyOption(sim, optionId, alts, base) {
  const next = structuredClone(sim);
  if (optionId === 'reschedule') {
    for (const move of reschedulePlan(base, alts.reschedule)) {
      const t = getTask(next, move.taskId);
      if (t) t.due = move.newDue;
    }
  } else if (optionId === 'reassign') {
    for (const r of alts.reassign.reassignments) applyReassignment(next, { taskId: r.taskId, toId: r.toId });
  }
  return withRev(next);
}

const highRiskIds = (state) => new Set(state.tasks.filter((t) => isOpen(t) && assessRisk(state, t).level === 'high').map((t) => t.id));

/**
 * Numbers for one option. "New" means the task was not at high risk before the
 * disruption, so every figure is about what this disruption causes, not about
 * work that was already behind.
 */
function metrics(state, base, baseHigh) {
  const open = state.tasks.filter(isOpen);
  const high = open.filter((t) => assessRisk(state, t).level === 'high');
  const fresh = high.filter((t) => !baseHigh.has(t.id));
  const snap = snapshot(state);
  return {
    highRisk: high.length,
    newRisk: fresh,
    cleared: [...baseHigh].filter((id) => !high.some((t) => t.id === id)).length,
    sla: fresh.filter((t) => t.slaDue),
    appointments: fresh.filter((t) => t.appointmentTime),
    mandatory: fresh.filter((t) => t.statutory),
    safety: fresh.filter((t) => t.safety),
    missing: snap.missing,
    overloaded: snap.overloaded,
    avgUtil: snap.avgUtil,
    moved: open.filter((t) => base.tasks.find((b) => b.id === t.id && (b.ownerId !== t.ownerId || b.due !== t.due))).length,
  };
}

// ----- 035: timelines -----

const DAY_START = 8 * 60 + 30;
const DAY_END = 17 * 60 + 30;
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Today's day for one officer as positioned bars, for the before / after view. */
export function dayTimeline(state, officerId, { incidentId } = {}) {
  const officer = getOfficer(state, officerId);
  const sched = buildSchedule(state, officerId, [TODAY]);
  const late = new Map(sched.warnings.filter((w) => w.type !== 'overdue').map((w) => [w.taskId, w.type]));
  const pos = (start, end) => {
    const a = Math.max(mins(start), DAY_START);
    const b = Math.min(mins(end), DAY_END);
    return { left: ((a - DAY_START) / (DAY_END - DAY_START)) * 100, width: Math.max(((b - a) / (DAY_END - DAY_START)) * 100, 1.5) };
  };
  const blocks = sched.blocks
    .filter((b) => b.date === TODAY)
    .map((b) => {
      const t = getTask(state, b.taskId);
      return {
        kind: b.taskId === incidentId ? 'incident' : t?.safety ? 'safety' : t?.statutory ? 'mandatory' : 'task',
        title: t?.title || b.taskId,
        start: b.start,
        end: b.end,
        late: late.has(b.taskId),
        ...pos(b.start, b.end),
      };
    });
  const meetings = meetingsFor(state, officerId, TODAY).map((m) => ({ kind: 'meeting', title: m.title, start: m.start, end: m.end, late: false, ...pos(m.start, m.end) }));
  return {
    officer,
    away: !!officer?.availability?.[TODAY],
    blocks: [...meetings, ...blocks],
    unscheduled: sched.unscheduled.filter((u) => !u.beyondHorizon).map((u) => getTask(state, u.taskId)?.title).filter(Boolean),
    late: [...late.keys()].map((id) => getTask(state, id)?.title).filter(Boolean),
    taskMin: sched.taskMinByDay[0] || 0,
  };
}

// ----- 040: plain-language explanations -----

const names = (tasks, n = 3) => {
  const list = tasks.slice(0, n).map((t) => `"${t.title}"`);
  return list.join(', ') + (tasks.length > n ? ` and ${tasks.length - n} more` : '');
};

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function explainOption(optionId, ctx) {
  const { m, alts, baseM, scenarioLabel, incident } = ctx;
  const what = [];
  const who = [];
  let headline = '';

  if (optionId === 'none') {
    headline = incident
      ? `If nothing changes, the ${incident.label.toLowerCase()} uses up ${fmtHours(incident.effort)} of the day and ${plural(m.newRisk.length, 'more task')} become high risk.`
      : `If nothing changes, the work of the absent officers has nobody to do it and ${plural(m.newRisk.length, 'more task')} become high risk.`;
    if (m.sla.length) what.push(`${plural(m.sla.length, 'SLA deadline')} would be missed: ${names(m.sla)}.`);
    if (m.appointments.length) what.push(`${plural(m.appointments.length, 'fixed appointment')} would clash: ${names(m.appointments)}.`);
    if (m.mandatory.length) what.push(`${plural(m.mandatory.length, 'mandatory (statutory) deadline')} would be missed: ${names(m.mandatory)}.`);
    if (!what.length) what.push('No new deadline is certain to be missed, but several tasks have no slack left.');
  } else if (optionId === 'reschedule') {
    const moves = alts.reschedule.displacedTasks;
    headline = moves.length
      ? `Safety and mandatory work stay where they are. ${plural(moves.length, 'routine task')} move to a later day.`
      : 'Nothing needs to move.';
    for (const mv of moves.slice(0, 4)) what.push(`"${mv.title}" moves from ${mv.from} to ${mv.to}.`);
    if (moves.length > 4) what.push(`${moves.length - 4} more routine tasks move to later days.`);
    if (m.appointments.length) what.push(`Moving work leaves ${plural(m.appointments.length, 'fixed appointment')} at risk: ${names(m.appointments)}.`);
    what.push(
      m.newRisk.length
        ? `${plural(m.newRisk.length, 'task')} still become high risk, so a manager should review this.`
        : 'No new task becomes high risk.',
    );
    who.push('The officer who takes the incident keeps the work. Nobody else is affected.');
  } else {
    const moves = alts.reassign.reassignments;
    headline = moves.length
      ? `${plural(moves.length, 'task')} go to officers who have free time and the best fit.`
      : 'Nobody has free time and the right skills, so nothing can be handed over.';
    for (const r of moves.slice(0, 4)) what.push(`"${r.title}" moves from ${r.from} to ${r.to} (${r.reasons.slice(0, 2).join(', ')}).`);
    if (moves.length > 4) what.push(`${moves.length - 4} more tasks are handed over.`);
    for (const c of alts.reassign.ineligibleCandidates.slice(0, 2)) what.push(`"${c.title}" could not be handed to ${c.officer}: ${c.issue}`);
    what.push(
      m.newRisk.length
        ? `${plural(m.newRisk.length, 'task')} still become high risk afterwards.`
        : 'No new task becomes high risk.',
    );
    const receivers = [...new Set(moves.map((r) => r.to))];
    if (receivers.length) who.push(`${receivers.join(', ')} take on extra work, so each needs to know about the change.`);
    who.push('Handing over work needs a manager’s approval first.');
  }

  const stake = m.newRisk.map((t) => t.consequence).filter(Boolean).slice(0, 2);
  return { headline, what, who, stake, scenarioLabel, baseHigh: baseM.highRisk };
}

// ----- the board -----

const cache = new WeakMap();

/**
 * Everything the page shows for one scenario. Cached per state revision, as
 * the three alternatives are worked out on cloned copies of the team's plans.
 */
export function buildBoard(s, scenarioId) {
  let entry = cache.get(s);
  if (!entry || entry.rev !== s.rev) {
    entry = { rev: s.rev, boards: new Map() };
    cache.set(s, entry);
  }
  if (!entry.boards.has(scenarioId)) entry.boards.set(scenarioId, computeBoard(s, scenarioId));
  return entry.boards.get(scenarioId);
}

function computeBoard(s, scenarioId) {
  const def = SCENARIOS.find((x) => x.id === scenarioId) || SCENARIOS[0];
  const scenario = def.make(s);
  const empty = !scenario.incident && !(scenario.absent || []).length;
  if (empty) return { def, scenario, empty: true };

  const ripple = analyzeScenarioRipple(s, scenario);
  const evaluated = evaluateAlternatives(s, scenario);
  const alts = evaluated.alternatives;
  const incident = scenario.incident ? INCIDENTS.find((i) => i.id === scenario.incident) : null;

  const noAction = disrupted(s, scenario);
  const states = { none: noAction, reschedule: applyOption(noAction, 'reschedule', alts, s), reassign: applyOption(noAction, 'reassign', alts, s) };
  const baseHigh = highRiskIds(s);
  const baseM = metrics(s, s, baseHigh);
  const options = OPTION_IDS.map((id) => {
    const alt = alts[OPTION_KEY[id]];
    const m = metrics(states[id], s, baseHigh);
    return {
      id,
      label: OPTION_LABEL[id],
      alt,
      status: alt.status,
      badge: alt.statusBadge,
      recommended: evaluated.recommendation.preferredId === (id === 'none' ? 'no_action' : id),
      m,
      summary: alt.summary,
      tradeOffs: alt.tradeOffs,
      moves: id === 'reschedule' ? reschedulePlan(s, alt) : id === 'reassign' ? alt.reassignments : [],
      explain: explainOption(id, { m, alts, base: s, baseM, incident, scenarioLabel: def.label }),
    };
  });

  const affected = [...new Set([...ripple.affectedOfficers, ...options[2].moves.map((r) => r.toId)])].filter((id) => getOfficer(s, id)).slice(0, 4);
  const incidentId = scenario.incident ? 'sim_inc' : null;
  const plans = Object.fromEntries(
    ['before', ...OPTION_IDS].map((key) => [
      key,
      affected.map((id) => dayTimeline(key === 'before' ? s : states[key], id, { incidentId })),
    ]),
  );

  const roots = ripple.directAffectedTaskIds.filter((id) => getTask(s, id));
  const chains = roots.map((id) => chainsFor(s, id)).filter(Boolean);

  const taskRows = (ids) => ids.map((id) => getTask(s, id)).filter(Boolean);
  return {
    def,
    scenario,
    empty: false,
    incident,
    ripple,
    baseM,
    cascade: {
      direct: taskRows(ripple.directAffectedTaskIds),
      downstream: taskRows(ripple.downstreamTaskIds),
      sla: ripple.slaAtRisk,
      appointments: ripple.appointmentsAtRisk,
      mandatory: ripple.mandatoryAtRisk,
      consequences: ripple.potentialConsequences,
      officers: ripple.affectedOfficers.map((id) => officerName(s, id)),
      deficitHours: ripple.capacityDeficitHours,
    },
    chains,
    options,
    plans,
    affected,
    recommendation: evaluated.recommendation,
    assumptions: ripple.assumptions,
  };
}

// ----- approving a decision (manager only) -----

/**
 * Apply the chosen option to the live data and record the decision. Call
 * inside update((s) => ...). Returns the number of tasks that changed.
 */
export function applyDecision(s, scenarioId, optionId, actor) {
  const board = computeBoard(s, scenarioId);
  if (board.empty) return 0;
  const option = board.options.find((o) => o.id === optionId);
  if (!option || optionId === 'none') return 0;

  let changed = 0;
  const inc = board.scenario.incident ? incidentTask(s, board.scenario, nextId(s, 't')) : null;
  if (inc) {
    inc.rippleScenario = scenarioId;
    s.tasks.unshift(inc);
    changed += 1;
  }
  if (optionId === 'reschedule') {
    for (const mv of option.moves) {
      const t = getTask(s, mv.taskId);
      if (t) {
        t.due = mv.newDue;
        changed += 1;
      }
    }
  } else {
    for (const r of option.moves) {
      applyReassignment(s, { taskId: r.taskId, toId: r.toId });
      changed += 1;
    }
  }
  s.rippleDecisions ||= [];
  s.rippleDecisions.unshift({ scenarioId, label: board.def.label, optionId, optionLabel: option.label, at: NOW, by: actor, changed, summary: option.explain.headline });
  s.rippleDecisions = s.rippleDecisions.slice(0, 10);
  logActivity(s, `Ripple Intelligence: approved "${option.label}" for ${board.def.label} (${changed} change${changed === 1 ? '' : 's'}).`, actor);
  return changed;
}

export const lastDecision = (s, scenarioId) => (s.rippleDecisions || []).find((d) => d.scenarioId === scenarioId) || null;
