// Operational Ripple Intelligence Engine
// Evaluates downstream consequences of disruptions, delays, and reassignments
// across task dependencies, deadlines, and team capacity.
// Works alongside ai.js, planner.js, and simulation.js without duplicating scheduling.

import { CATEGORY_SKILL } from './data.js';
import { getTask, getOfficer, isOpen, openTasksFor, remainingHours, officerName, isUnavailable } from './state.js';
import { buildSchedule, dayCapacity, assessRisk, analyseOfficer, schedule, teamAnalysis } from './planner.js';
import { checkTaskFeasibility } from './ai.js';
import { TODAY, NOW, dt, workDay, datePart, timePart, toMin, fmtDue, fmtHours, fmtTime, horizonDays } from './time.js';
import { INCIDENTS, rankCandidates, snapshot } from './simulation.js';

/**
 * Trace all downstream dependent tasks recursively using `task.dependsOn`.
 * Handles multi-level chains, prevents duplicate counting, and terminates safely
 * on circular dependencies or missing task references.
 */
export function traceDownstream(s, rootTaskId) {
  const dependents = [];
  const visited = new Set();
  const stack = new Set();
  let hasCycle = false;
  const cycleNodes = [];

  function walk(currentId, depth, path) {
    if (stack.has(currentId)) {
      hasCycle = true;
      cycleNodes.push([...path, currentId]);
      return;
    }
    stack.add(currentId);

    // Find open tasks that declare `dependsOn` containing currentId
    const directChildren = s.tasks.filter((t) => isOpen(t) && Array.isArray(t.dependsOn) && t.dependsOn.includes(currentId));

    for (const child of directChildren) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        const childPath = [...path, child.id];
        dependents.push({
          task: child,
          depth,
          chain: childPath,
          direct: depth === 1,
          statutory: Boolean(child.statutory),
          safety: Boolean(child.safety),
          consequence: child.consequence || null,
        });
        walk(child.id, depth + 1, childPath);
      }
    }

    stack.delete(currentId);
  }

  walk(rootTaskId, 1, [rootTaskId]);

  return {
    rootTaskId,
    dependents,
    hasCycle,
    cycleNodes,
  };
}

/**
 * Trace upstream prerequisite tasks for a task.
 * Safeguarded against circular references and missing IDs.
 */
export function traceUpstream(s, targetTaskId) {
  const prerequisites = [];
  const visited = new Set();
  const stack = new Set();

  function walk(currentId, depth) {
    if (stack.has(currentId)) return;
    stack.add(currentId);

    const task = getTask(s, currentId);
    if (task && Array.isArray(task.dependsOn)) {
      for (const prereqId of task.dependsOn) {
        if (!visited.has(prereqId)) {
          visited.add(prereqId);
          const prereqTask = getTask(s, prereqId);
          if (prereqTask) {
            prerequisites.push({ task: prereqTask, depth, direct: depth === 1 });
            walk(prereqId, depth + 1);
          }
        }
      }
    }

    stack.delete(currentId);
  }

  walk(targetTaskId, 1);
  return prerequisites;
}

/**
 * Evaluate the ripple effect of delaying or disrupting a single task.
 */
export function analyzeTaskRipple(s, taskId, { delayHours = 2, newDueDate = null } = {}) {
  const root = getTask(s, taskId);
  if (!root) {
    return {
      error: 'Task not found',
      rootTaskId: taskId,
      directAffectedTaskIds: [],
      downstreamTaskIds: [],
      mandatoryAtRisk: [],
      dependencyBreaches: [],
      potentialConsequences: [],
      assumptions: ['Target task does not exist in state.'],
      escalationRequired: false,
    };
  }

  const downstream = traceDownstream(s, taskId);
  const owner = getOfficer(s, root.ownerId);
  const downstreamTaskIds = downstream.dependents.map((d) => d.task.id);
  const mandatoryAtRisk = [];
  const dependencyBreaches = [];
  const potentialConsequences = [];

  // Check root consequence
  if (root.consequence) {
    potentialConsequences.push({
      taskId: root.id,
      title: root.title,
      consequence: root.consequence,
      exposure: 'Estimated scheduling exposure: postponement may trigger long-term defect or regulatory escalation.',
    });
  }

  // Check downstream impacts
  for (const dep of downstream.dependents) {
    const t = dep.task;
    if (t.statutory) {
      mandatoryAtRisk.push({
        taskId: t.id,
        title: t.title,
        owner: officerName(s, t.ownerId),
        deadline: fmtDue(t.due),
        depth: dep.depth,
        chain: dep.chain.join(' → '),
        warning: 'Mandatory statutory deadline downstream of delayed work; non-negotiable compliance constraint.',
      });
    }

    if (t.consequence) {
      potentialConsequences.push({
        taskId: t.id,
        title: t.title,
        consequence: t.consequence,
        exposure: `Downstream dependency impact (depth ${dep.depth}): potential consequence if cascade delays execution.`,
      });
    }

    // Dependency timing breach check
    if (t.ownerId === root.ownerId) {
      const rootDue = newDueDate || root.due;
      if (t.due <= rootDue) {
        dependencyBreaches.push({
          taskId: t.id,
          title: t.title,
          prereqId: root.id,
          prereqTitle: root.title,
          reason: `Dependent task due (${fmtDue(t.due)}) before or at prerequisite completion (${fmtDue(rootDue)}).`,
        });
      }
    }
  }

  const escalationRequired = mandatoryAtRisk.length > 0 || root.safety || (owner && isUnavailable(owner, TODAY));

  return {
    trigger: {
      type: 'delay',
      taskId: root.id,
      title: root.title,
      ownerId: root.ownerId,
      ownerName: officerName(s, root.ownerId),
      delayHours,
      newDueDate,
    },
    directAffectedTaskIds: [root.id],
    downstreamTaskIds,
    downstreamCount: downstream.dependents.length,
    downstreamDependents: downstream.dependents,
    affectedOfficers: [...new Set([root.ownerId, ...downstream.dependents.map((d) => d.task.ownerId)])],
    mandatoryAtRisk,
    dependencyBreaches,
    potentialConsequences,
    hasCycle: downstream.hasCycle,
    assumptions: [
      'Task effort estimates reflect baseline planning assumptions and historical averages.',
      'Downstream tasks cannot start until prerequisite inspection or report is completed.',
      'Potential consequences reflect documented operational failure modes, requiring supervisor verification.',
    ],
    escalationRequired,
  };
}

/**
 * Analyze full ripple impact for a simulation scenario (incident, absence, or extra work).
 */
export function analyzeScenarioRipple(baseState, scenario) {
  const directAffectedTaskIds = [];
  const downstreamSet = new Set();
  const allDownstream = [];
  const mandatoryAtRisk = [];
  const potentialConsequences = [];
  const affectedOfficers = new Set(scenario.absent || []);
  let capacityDeficitHours = 0;

  // 1. Incident ripple
  if (scenario.incident) {
    const inc = INCIDENTS.find((i) => i.id === scenario.incident);
    const incidentHours = inc ? inc.effort : 2.5;
    capacityDeficitHours += incidentHours;

    let assigneeId = scenario.incidentAssignee;
    if (!assigneeId || assigneeId === 'auto') {
      const best = rankCandidates(baseState, { category: inc?.category || 'Maintenance', due: dt(TODAY, inc?.dueTime || '13:00'), effort: incidentHours, safety: true });
      assigneeId = best[0]?.officer.id || baseState.officers[0].id;
    }
    affectedOfficers.add(assigneeId);

    // Tasks of this assignee due today that will be displaced by the emergency
    const assigneeOpen = openTasksFor(baseState, assigneeId).filter((t) => datePart(t.due) === TODAY);
    for (const t of assigneeOpen) {
      if (!t.safety && t.priority !== 'Critical') {
        directAffectedTaskIds.push(t.id);
        const ds = traceDownstream(baseState, t.id);
        for (const dep of ds.dependents) {
          if (!downstreamSet.has(dep.task.id)) {
            downstreamSet.add(dep.task.id);
            allDownstream.push(dep);
          }
        }
      }
    }
  }

  // 2. Absence ripple
  if (Array.isArray(scenario.absent)) {
    for (const offId of scenario.absent) {
      const offTasks = openTasksFor(baseState, offId);
      for (const t of offTasks) {
        if (!directAffectedTaskIds.includes(t.id)) directAffectedTaskIds.push(t.id);
        if (t.statutory) {
          mandatoryAtRisk.push({
            taskId: t.id,
            title: t.title,
            owner: officerName(baseState, t.ownerId),
            deadline: fmtDue(t.due),
            depth: 0,
            chain: 'Direct assignment on absent officer',
            warning: 'Statutory compliance obligation assigned to absent officer; cannot slip without regulatory exposure.',
          });
        }
        if (t.consequence) {
          potentialConsequences.push({
            taskId: t.id,
            title: t.title,
            consequence: t.consequence,
            exposure: 'Potential consequence if unassigned during absence period.',
          });
        }
        const ds = traceDownstream(baseState, t.id);
        for (const dep of ds.dependents) {
          if (!downstreamSet.has(dep.task.id)) {
            downstreamSet.add(dep.task.id);
            allDownstream.push(dep);
          }
        }
      }
    }
  }

  // Check downstream mandatory & consequence items
  for (const dep of allDownstream) {
    affectedOfficers.add(dep.task.ownerId);
    if (dep.task.statutory && !mandatoryAtRisk.some((m) => m.taskId === dep.task.id)) {
      mandatoryAtRisk.push({
        taskId: dep.task.id,
        title: dep.task.title,
        owner: officerName(baseState, dep.task.ownerId),
        deadline: fmtDue(dep.task.due),
        depth: dep.depth,
        chain: dep.chain.join(' → '),
        warning: `Downstream statutory task (depth ${dep.depth}) delayed by cascade.`,
      });
    }
    if (dep.task.consequence && !potentialConsequences.some((p) => p.taskId === dep.task.id)) {
      potentialConsequences.push({
        taskId: dep.task.id,
        title: dep.task.title,
        consequence: dep.task.consequence,
        exposure: `Downstream consequence risk (depth ${dep.depth}) if prerequisite delay propagates.`,
      });
    }
  }

  return {
    directAffectedTaskIds,
    downstreamTaskIds: [...downstreamSet],
    allDownstream,
    affectedOfficers: [...affectedOfficers],
    capacityDeficitHours,
    mandatoryAtRisk,
    potentialConsequences,
    assumptions: [
      'Urgent safety disruptions immediately occupy working capacity, displacing non-safety tasks.',
      'Absences completely remove officer capacity for the configured duration.',
      'Reassignments require skill certification match before execution.',
    ],
  };
}

/**
 * Evaluate Three Distinct Operational Alternatives for a disruption:
 * - Alternative A: No Action (Let work slip)
 * - Alternative B: Reschedule Lower-Impact Tasks (Reorganize within assigned officer)
 * - Alternative C: Reassign Eligible Work (Balance across qualified team members)
 */
export function evaluateAlternatives(baseState, scenario, options = {}) {
  const ripple = analyzeScenarioRipple(baseState, scenario);

  // -------------------------------------------------------------
  // ALTERNATIVE A: NO ACTION
  // What happens if the team makes no adjustments?
  // -------------------------------------------------------------
  const simNoAction = structuredClone(baseState);
  // Apply absences
  for (const offId of scenario.absent || []) {
    const o = getOfficer(simNoAction, offId);
    if (o) {
      horizonDays().slice(0, scenario.absenceDays || 1).forEach((d) => {
        o.availability[d] = scenario.absenceType || 'mc';
      });
    }
  }
  // Apply incident
  let incTask = null;
  if (scenario.incident) {
    const inc = INCIDENTS.find((i) => i.id === scenario.incident);
    let ownerId = scenario.incidentAssignee;
    if (!ownerId || ownerId === 'auto') {
      ownerId = baseState.officers[0].id;
    }
    incTask = {
      id: 'sim_inc',
      title: inc?.title || 'Urgent incident',
      category: inc?.category || 'Maintenance',
      priority: 'Critical',
      due: dt(TODAY, inc?.dueTime || '13:00'),
      effort: inc?.effort || 2.5,
      spent: 0,
      status: 'todo',
      location: inc?.location || 'Estate',
      safety: true,
      dependsOn: [],
      ownerId,
    };
    simNoAction.tasks.push(incTask);
  }

  const snapNoAction = snapshot(simNoAction);
  const noActionBreaches = simNoAction.tasks.filter((t) => isOpen(t) && t.statutory && assessRisk(simNoAction, t).level === 'high');
  const noActionOverdue = snapNoAction.missing;
  const noActionStatus = noActionBreaches.length > 0 || (incTask && assessRisk(simNoAction, incTask).level === 'high')
    ? 'Infeasible'
    : 'Requires Review';

  const altA = {
    id: 'no_action',
    label: 'Alternative A: No Action',
    summary: 'Maintain current schedule without reallocating or rescheduling work.',
    status: noActionStatus,
    statusBadge: noActionStatus === 'Infeasible' ? 'badge-danger' : 'badge-warning',
    highRiskCount: snapNoAction.highRisk.length,
    missingCount: noActionOverdue,
    mandatoryBreaches: noActionBreaches.map((t) => ({ taskId: t.id, title: t.title, owner: officerName(simNoAction, t.ownerId), deadline: fmtDue(t.due) })),
    unresolvedCount: snapNoAction.highRisk.length,
    tradeOffs: 'Zero coordination effort required upfront, but results in severe compliance exposure, missed deadlines, and unmanaged resident dissatisfaction.',
    isFeasible: false,
  };

  // -------------------------------------------------------------
  // ALTERNATIVE B: RESCHEDULE LOWER-IMPACT TASKS
  // Keep work with the primary officer, but defer routine non-safety tasks
  // -------------------------------------------------------------
  const simResched = structuredClone(simNoAction);
  const displacedTasks = [];
  let reschedBreachedMandatory = false;

  // For affected officers, protect safety and mandatory work, push flexible work
  for (const offId of ripple.affectedOfficers) {
    const oTasks = simResched.tasks.filter((t) => t.ownerId === offId && isOpen(t));
    for (const t of oTasks) {
      if (!t.safety && !t.statutory && t.priority !== 'Critical') {
        // Evaluate shifting lower-priority task later in horizon
        const origDue = t.due;
        const targetDay = workDay(Math.min(4, horizonDays().indexOf(datePart(origDue)) + 1));
        t.due = dt(targetDay, '17:00');
        displacedTasks.push({ taskId: t.id, title: t.title, from: fmtDue(origDue), to: fmtDue(t.due) });
      }
    }
  }

  const snapResched = snapshot(simResched);
  const reschedMandatoryRisks = simResched.tasks.filter((t) => isOpen(t) && t.statutory && assessRisk(simResched, t).level === 'high');
  if (reschedMandatoryRisks.length > 0) reschedBreachedMandatory = true;

  const reschedFeasible = !reschedBreachedMandatory && snapResched.missing === 0;
  const reschedStatus = reschedFeasible
    ? 'Feasible'
    : reschedMandatoryRisks.length > 0
    ? 'Infeasible'
    : 'Requires Review';

  const altB = {
    id: 'reschedule',
    label: 'Alternative B: Reschedule Lower-Impact Tasks',
    summary: 'Protect mandatory obligations by deferring non-statutory inspections and routine admin within the officer’s schedule.',
    status: reschedStatus,
    statusBadge: reschedStatus === 'Feasible' ? 'badge-success' : reschedStatus === 'Infeasible' ? 'badge-danger' : 'badge-warning',
    displacedCount: displacedTasks.length,
    displacedTasks,
    highRiskCount: snapResched.highRisk.length,
    missingCount: snapResched.missing,
    mandatoryBreaches: reschedMandatoryRisks.map((t) => ({ taskId: t.id, title: t.title, owner: officerName(simResched, t.ownerId), deadline: fmtDue(t.due) })),
    tradeOffs: displacedTasks.length
      ? `Maintains operational continuity and protects compliance, but delays ${displacedTasks.length} routine task(s) (e.g. routine report drafting, non-critical site checks).`
      : 'Minimal displacement required.',
    isFeasible: reschedFeasible,
  };

  // -------------------------------------------------------------
  // ALTERNATIVE C: REASSIGN ELIGIBLE WORK
  // Offload tasks to qualified team members with spare capacity
  // -------------------------------------------------------------
  const simReassign = structuredClone(simNoAction);
  const reassignments = [];
  const ineligibleCandidates = [];

  // Identify candidate tasks to move away from overloaded officers
  for (const offId of ripple.affectedOfficers) {
    const candidateTasks = simReassign.tasks
      .filter((t) => t.ownerId === offId && isOpen(t) && !t.safety && t.priority !== 'Critical')
      .slice(0, 3);

    for (const t of candidateTasks) {
      const candidates = rankCandidates(simReassign, t, { exclude: [offId] });
      const qualified = candidates.find((c) => c.fits && c.score >= 10);
      const unqualifiedWithTime = candidates.find((c) => c.fits && c.score < 10);

      if (qualified) {
        t.ownerId = qualified.officer.id;
        reassignments.push({
          taskId: t.id,
          title: t.title,
          from: officerName(baseState, offId),
          to: qualified.officer.name,
          fit: qualified.score,
          reasons: qualified.reasons,
        });
      } else if (unqualifiedWithTime) {
        ineligibleCandidates.push({
          taskId: t.id,
          title: t.title,
          officer: unqualifiedWithTime.officer.name,
          issue: `Officer has free hours but lacks required ${t.category} certification / domain skill.`,
        });
      }
    }
  }

  const snapReassign = snapshot(simReassign);
  const reassignMandatoryRisks = simReassign.tasks.filter((t) => isOpen(t) && t.statutory && assessRisk(simReassign, t).level === 'high');
  const reassignFeasible = reassignMandatoryRisks.length === 0 && snapReassign.overloaded === 0;
  const reassignStatus = reassignFeasible
    ? 'Feasible'
    : reassignments.length > 0 && reassignMandatoryRisks.length === 0
    ? 'Requires Review'
    : 'Infeasible';

  const altC = {
    id: 'reassign',
    label: 'Alternative C: Reassign Eligible Work',
    summary: 'Transfer tasks to certified officers who possess spare capacity before the deadline.',
    status: reassignStatus,
    statusBadge: reassignStatus === 'Feasible' ? 'badge-success' : reassignStatus === 'Infeasible' ? 'badge-danger' : 'badge-warning',
    reassignmentsCount: reassignments.length,
    reassignments,
    ineligibleCandidates,
    highRiskCount: snapReassign.highRisk.length,
    missingCount: snapReassign.missing,
    mandatoryBreaches: reassignMandatoryRisks.map((t) => ({ taskId: t.id, title: t.title, owner: officerName(simReassign, t.ownerId), deadline: fmtDue(t.due) })),
    tradeOffs: reassignments.length
      ? `Rebalances team workload across ${reassignments.length} task(s), but requires cross-zone coordination and officer handover.`
      : 'No qualified candidates with spare capacity available.',
    isFeasible: reassignFeasible,
  };

  // -------------------------------------------------------------
  // RECOMMENDATION DETERMINATION
  // -------------------------------------------------------------
  let preferred = null;
  let escalationRequired = false;
  let escalationWarning = null;
  let rationale = '';

  if (altC.isFeasible && altC.reassignmentsCount > 0 && snapReassign.avgUtil < 90) {
    preferred = 'reassign';
    rationale = `Alternative C is recommended: reassigning ${altC.reassignmentsCount} task(s) to qualified officers with available capacity balances the team without deferring work.`;
  } else if (altB.isFeasible) {
    preferred = 'reschedule';
    rationale = `Alternative B is recommended: rescheduling ${altB.displacedCount} routine task(s) allows the assigned officer to handle the disruption while fully protecting mandatory compliance deadlines.`;
  } else if (altC.status === 'Requires Review') {
    preferred = 'reassign';
    rationale = 'Alternative C is the closest viable option; review candidate qualifications and zone handover before confirming.';
  } else {
    preferred = null;
    escalationRequired = true;
    escalationWarning = 'Manager escalation required — current team capacity cannot accommodate all protected obligations under the disruption.';
    rationale = escalationWarning;
  }

  return {
    alternatives: {
      noAction: altA,
      reschedule: altB,
      reassign: altC,
    },
    recommendation: {
      preferredId: preferred,
      preferredAlternative: preferred === 'reassign' ? altC : preferred === 'reschedule' ? altB : null,
      rationale,
      escalationRequired,
      escalationWarning,
    },
  };
}
