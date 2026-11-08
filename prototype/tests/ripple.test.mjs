// Operational Ripple Intelligence test suite.
// Run from repo root: node --test prototype/tests/ripple.test.mjs
// Uses Node's built-in test runner; modules under test are ES modules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../js/data.js';
import { openTasksFor } from '../js/state.js';
import {
  traceDownstream,
  traceUpstream,
  analyzeTaskRipple,
  analyzeScenarioRipple,
  evaluateAlternatives,
} from '../js/ripple.js';
import {
  runSimulation,
  commitSimulation,
  snapshot,
  INCIDENTS,
} from '../js/simulation.js';
import { TODAY, dt } from '../js/time.js';

const seed = () => createSeedState();

test('1. direct task dependency impact (traceDownstream)', () => {
  const s = seed();
  // t103: Ceiling seepage site check. t104 has dependsOn: ['t103']
  const ds = traceDownstream(s, 't103');
  assert.ok(ds.dependents.length >= 1, 'has at least one dependent');
  const directChild = ds.dependents.find((d) => d.task.id === 't104');
  assert.ok(directChild, 't104 is a direct dependent of t103');
  assert.equal(directChild.depth, 1, 'direct dependency depth is 1');
  assert.equal(directChild.direct, true, 'direct flag is true');
});

test('2. multi-level dependencies (t103 -> t104 -> t112)', () => {
  const s = seed();
  // t103 -> t104 (depth 1) -> t112 (depth 2)
  const ds = traceDownstream(s, 't103');
  const child104 = ds.dependents.find((d) => d.task.id === 't104');
  const child112 = ds.dependents.find((d) => d.task.id === 't112');
  assert.ok(child104, 'finds t104 at depth 1');
  assert.ok(child112, 'finds t112 at depth 2');
  assert.equal(child104.depth, 1);
  assert.equal(child112.depth, 2);
  assert.deepEqual(child112.chain, ['t103', 't104', 't112']);
});

test('3. circular dependency handling terminates safely', () => {
  const s = seed();
  // Introduce a cycle: task cA depends on cB, cB depends on cA
  s.tasks.push(
    { id: 'cycleA', title: 'Cycle A', status: 'To do', dependsOn: ['cycleB'], category: 'General' },
    { id: 'cycleB', title: 'Cycle B', status: 'To do', dependsOn: ['cycleA'], category: 'General' }
  );
  const ds = traceDownstream(s, 'cycleA');
  assert.ok(ds.hasCycle, 'cycle detected');
  assert.ok(ds.dependents.length <= 2, 'cycle does not cause infinite recursion');
  assert.ok(Array.isArray(ds.cycleNodes), 'cycleNodes is an array');
});

test('4. missing task references handled safely without throwing', () => {
  const s = seed();
  // Reference a task that does not exist in s.tasks
  assert.doesNotThrow(() => {
    const ds = traceDownstream(s, 'non_existent_task_999');
    assert.equal(ds.dependents.length, 0);
  });
  assert.doesNotThrow(() => {
    const us = traceUpstream(s, 'non_existent_task_999');
    assert.equal(us.length, 0);
  });
  // Task that dependsOn an invalid/deleted ID
  s.tasks.push({
    id: 'danglingChild',
    title: 'Dangling Child',
    status: 'To do',
    dependsOn: ['deleted_parent_404'],
    category: 'General',
  });
  assert.doesNotThrow(() => {
    const ds = traceDownstream(s, 'deleted_parent_404');
    assert.equal(ds.dependents.length, 1);
    assert.equal(ds.dependents[0].task.id, 'danglingChild');
  });
});

test('5. mandatory deadline protection evaluated', () => {
  const s = seed();
  // t401 is Critical/safety/statutory. Delaying it should evaluate mandatory risks
  const rip = analyzeTaskRipple(s, 't401', { delayHours: 4 });
  assert.equal(rip.trigger.delayHours, 4);
  assert.ok(Array.isArray(rip.mandatoryAtRisk));
  assert.ok(rip.escalationRequired, 'safety/critical task triggers escalation');
});

test('6. urgent safety incident scenario ripple (analyzeScenarioRipple)', () => {
  const s = seed();
  const sc = {
    incident: 'lift',
    incidentAssignee: 'o1',
    absent: [],
  };
  const analysis = analyzeScenarioRipple(s, sc);
  assert.ok(analysis.directAffectedTaskIds.length > 0, 'displaced tasks identified');
  assert.ok(analysis.capacityDeficitHours >= 2.5, 'incident effort counted as capacity deficit');
  assert.ok(analysis.affectedOfficers.includes('o1'), 'assigned officer marked affected');
  assert.ok(Array.isArray(analysis.allDownstream), 'allDownstream is array');
  assert.ok(Array.isArray(analysis.potentialConsequences), 'potential consequences captured');
});

test('7. capacity shortages and deficit calculation', () => {
  const s = seed();
  const inc = INCIDENTS.find((i) => i.id === 'lift') || { effort: 2.5 };
  const sc = {
    incident: inc.id,
    incidentAssignee: 'o1',
    absent: [],
  };
  const analysis = analyzeScenarioRipple(s, sc);
  assert.equal(analysis.capacityDeficitHours, inc.effort);
});

test('8. officer unavailability ripple', () => {
  const s = seed();
  const sc = {
    absent: ['o1'],
  };
  const analysis = analyzeScenarioRipple(s, sc);
  assert.ok(analysis.affectedOfficers.includes('o1'));
  const o1OpenTasks = openTasksFor(s, 'o1');
  assert.equal(analysis.directAffectedTaskIds.length, o1OpenTasks.length);
});

test('9. reassignment skill restrictions verified (skill mismatch flagged)', () => {
  const s = seed();
  const sc = {
    incident: 'lift',
    incidentAssignee: 'o1',
    absent: [],
  };
  const alts = evaluateAlternatives(s, sc);
  const altC = alts.alternatives.reassign;
  assert.ok(altC, 'Alternative C present');
  assert.ok(Array.isArray(altC.ineligibleCandidates));
  assert.ok(typeof altC.reassignmentsCount === 'number');
});

test('10. rescheduling feasibility check', () => {
  const s = seed();
  const sc = {
    incident: 'lift',
    incidentAssignee: 'o1',
    absent: [],
  };
  const alts = evaluateAlternatives(s, sc);
  const altB = alts.alternatives.reschedule;
  assert.ok(altB, 'Alternative B (reschedule) evaluated');
  assert.ok(['Feasible', 'Requires Review', 'Infeasible'].includes(altB.status));
  assert.ok(typeof altB.displacedCount === 'number');
});

test('11. infeasible alternative reporting when constraints broken', () => {
  const s = seed();
  // Force all officers absent
  const allOfficerIds = s.officers.map((o) => o.id);
  const sc = {
    incident: 'lift',
    absent: allOfficerIds,
  };
  const alts = evaluateAlternatives(s, sc);
  const altC = alts.alternatives.reassign;
  // With everyone absent, reassignment must be Infeasible
  assert.equal(altC.status, 'Infeasible');
});

test('12. no-action baseline comparison exposes unmitigated breaches', () => {
  const s = seed();
  const sc = {
    incident: 'lift',
    incidentAssignee: 'o1',
    absent: [],
  };
  const alts = evaluateAlternatives(s, sc);
  const altA = alts.alternatives.noAction;
  assert.ok(altA, 'Alternative A exists as baseline');
  assert.ok(altA.status === 'Infeasible' || altA.status === 'Requires Review');
  assert.ok(altA.tradeOffs.length > 0, 'trade-off describes consequences of doing nothing');
});

test('13. simulation does not mutate source state', () => {
  const s = seed();
  const origTasksJSON = JSON.stringify(s.tasks);
  const origOfficersJSON = JSON.stringify(s.officers);
  const sc = {
    incident: 'lift',
    incidentAssignee: 'o1',
    absent: [],
  };
  runSimulation(s, sc);
  assert.equal(JSON.stringify(s.tasks), origTasksJSON, 'tasks unchanged after simulation');
  assert.equal(JSON.stringify(s.officers), origOfficersJSON, 'officers unchanged after simulation');
});

test('14. explicit commit required (commitSimulation)', () => {
  const s = seed();
  const sc = {
    incident: 'lift',
    incidentAssignee: 'o1',
    absent: [],
  };
  const res = runSimulation(s, sc);
  const prevCount = s.tasks.length;
  // Base state untouched
  assert.equal(s.tasks.length, prevCount);
  assert.ok(res.added.length > 0, 'incident task was created in simulation');
  const incidentTaskId = res.added[0].taskId;

  // Commit creates new state with the simulated incident
  const { next } = commitSimulation(res, res.recs.map((r) => r.id));
  assert.equal(next.tasks.length, prevCount + 1, 'task count in next increased by 1 for incident');
  assert.ok(next.tasks.some((t) => t.id === incidentTaskId), 'incident task present in committed state');
  assert.equal(s.tasks.length, prevCount, 'original state tasks still unmodified');
});

test('15. stale-state protection detects revision changes', () => {
  const s = seed();
  const snap = snapshot(s);
  assert.equal(snap.rev, s.rev);
  // Increment state revision
  s.rev++;
  assert.notEqual(snap.rev, s.rev, 'revision change detected; snapshot is stale');
});

test('16. reset functionality restores state from seed', () => {
  const s = seed();
  s.tasks.push({ id: 'dummy', title: 'Temporary', status: 'To do' });
  assert.ok(s.tasks.some((t) => t.id === 'dummy'));
  const fresh = seed();
  assert.ok(!fresh.tasks.some((t) => t.id === 'dummy'), 'seed returns fresh copy without mutations');
});

test('17. no duplicated downstream tasks in diamond dependency chain', () => {
  const s = seed();
  // Diamond: root -> left -> bottom, root -> right -> bottom
  s.tasks.push(
    { id: 'diaRoot', title: 'Root', status: 'To do', category: 'General' },
    { id: 'diaLeft', title: 'Left', status: 'To do', dependsOn: ['diaRoot'], category: 'General' },
    { id: 'diaRight', title: 'Right', status: 'To do', dependsOn: ['diaRoot'], category: 'General' },
    { id: 'diaBottom', title: 'Bottom', status: 'To do', dependsOn: ['diaLeft', 'diaRight'], category: 'General' }
  );
  const ds = traceDownstream(s, 'diaRoot');
  const bottomEntries = ds.dependents.filter((d) => d.task.id === 'diaBottom');
  assert.equal(bottomEntries.length, 1, 'diamond node appears exactly once');
});

test('18. deterministic output: same input produces identical ripple results', () => {
  const s1 = seed();
  const s2 = seed();
  const sc = { incident: 'lift', incidentAssignee: 'o1', absent: [] };
  const r1 = evaluateAlternatives(s1, sc);
  const r2 = evaluateAlternatives(s2, sc);
  assert.equal(r1.recommendation.preferredId, r2.recommendation.preferredId);
  assert.equal(r1.alternatives.noAction.status, r2.alternatives.noAction.status);
  assert.equal(r1.alternatives.reschedule.status, r2.alternatives.reschedule.status);
  assert.equal(r1.alternatives.reassign.status, r2.alternatives.reassign.status);
});

test('19. unknown consequences and uninvented data handled safely', () => {
  const s = seed();
  // Task without consequence description
  s.tasks.push({
    id: 'neutralTask',
    title: 'Routine check',
    status: 'To do',
    category: 'General',
    due: dt(TODAY, '16:00'),
    effort: 1,
    ownerId: 'o1',
  });
  const rip = analyzeTaskRipple(s, 'neutralTask', { delayHours: 2 });
  assert.ok(Array.isArray(rip.potentialConsequences));
  assert.ok(Array.isArray(rip.assumptions));
  const fullText = JSON.stringify(rip);
  assert.ok(!/\$[\d,]+/.test(fullText), 'never invents monetary figures');
  assert.ok(!/\b\d{1,3}%\s+chance\b/i.test(fullText), 'never invents uncalibrated percentages');
});

test('20. calibrated language: no claims of guaranteed disaster prevention', () => {
  const s = seed();
  const sc = { incident: 'lift', incidentAssignee: 'o1', absent: [] };
  const alts = evaluateAlternatives(s, sc);
  const fullText = JSON.stringify(alts);
  assert.ok(!/guaranteed\s+prevention/i.test(fullText), 'no guaranteed prevention claims');
  assert.ok(!/disaster\s+prevented/i.test(fullText), 'no disaster prevented claims');
  assert.ok(!/100%\s+safe/i.test(fullText), 'no 100% safe claims');
  // Calibrated terms should be present
  assert.ok(
    /tradeOffs|exposure|feasible|protect|consequence|coordination/i.test(fullText),
    'uses calibrated advisory language'
  );
});
