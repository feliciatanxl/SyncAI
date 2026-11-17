import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeedState } from '../js/data.js';
import { absentOfficers, applyReshuffle, attendanceStatus, attendanceSummary, checkIn, checkOut, clearAbsence, markAbsent, proposeReshuffle } from '../js/attendance.js';
import attendancePage from '../js/pages/attendance.js';
import ripplePage, { rippleView } from '../js/pages/ripple.js';
import { SCENARIOS, applyDecision, buildBoard, chainRoots, chainsFor, lastDecision } from '../js/rippleBoard.js';
import { getOfficer, getTask, replaceState, setCurrentUser, getState } from '../js/state.js';
import { TODAY } from '../js/time.js';

const fresh = () => createSeedState();

test('104 attendance: check in, check out and absence are tracked per officer', () => {
  const s = fresh();
  const pending = s.officers.find((o) => attendanceStatus(s, o).id === 'pending');
  assert.ok(pending, 'one officer is still to arrive in the demo data');
  assert.equal(attendanceStatus(s, getOfficer(s, 'o6')).id, 'mc', 'Ravi starts the day on MC');

  checkIn(s, pending.id);
  assert.equal(attendanceStatus(s, pending).id, 'in');
  checkOut(s, pending.id);
  assert.equal(attendanceStatus(s, pending).id, 'out');
  assert.equal(attendanceStatus(s, pending).group, 'present');

  markAbsent(s, 'o2', 'leave');
  assert.equal(attendanceStatus(s, getOfficer(s, 'o2')).id, 'leave');
  assert.equal(getOfficer(s, 'o2').availability[TODAY], 'leave', 'the planner sees the same absence');
  clearAbsence(s, 'o2');
  assert.equal(getOfficer(s, 'o2').availability[TODAY], undefined);

  const sum = attendanceSummary(s);
  assert.equal(sum.present + sum.pending + sum.absent, sum.total);
});

test('104 attendance: only the type of absence is recorded, never medical details', () => {
  const s = fresh();
  markAbsent(s, 'o4', 'mc');
  const text = JSON.stringify(s.attendance) + JSON.stringify(getOfficer(s, 'o4').availability);
  assert.match(attendanceStatus(s, getOfficer(s, 'o4')).label, /Medical leave/);
  assert.doesNotMatch(text, /diagnos|illness|fever|doctor/i);
});

test('051 MC reshuffle: absent officers’ open work is proposed to available officers and nothing changes until applied', () => {
  const s = fresh();
  markAbsent(s, 'o4', 'mc');
  const before = JSON.stringify(s.tasks.map((t) => [t.id, t.ownerId]));
  const r = proposeReshuffle(s);
  assert.deepEqual(r.absent.map((o) => o.id).sort(), ['o4', 'o6']);
  assert.ok(r.proposals.length > 0);
  assert.equal(JSON.stringify(s.tasks.map((t) => [t.id, t.ownerId])), before, 'proposing must not change the live data');

  const absentIds = absentOfficers(s).map((o) => o.id);
  for (const p of r.proposals) {
    assert.ok(!absentIds.includes(p.toId), 'never handed to someone who is also away');
    assert.ok(p.reasons.length > 0, 'every proposal explains itself');
  }
  // Safety work only goes to someone with the right skills.
  for (const p of r.proposals.filter((x) => x.safety)) {
    assert.ok(!p.reasons.includes('no direct skill match'));
  }

  const moved = applyReshuffle(s, r.proposals);
  assert.equal(moved, r.proposals.length);
  for (const p of r.proposals) assert.equal(getTask(s, p.taskId).ownerId, p.toId);
  assert.equal(proposeReshuffle(s).proposals.length, 0, 'nothing is left to move once applied');
  assert.match(s.activity[0].text, /MC reshuffle approved/);
});

test('031 dependency tracing: follows a chain more than one step and is safe with cycles', () => {
  const s = fresh();
  assert.ok(chainRoots(s).includes('t103'));
  const chain = chainsFor(s, 't103');
  assert.equal(chain.maxDepth, 2, 'seepage check -> follow-up call -> work order');
  assert.deepEqual(chain.steps.map((x) => x.task.id), ['t104', 't112']);

  getTask(s, 't103').dependsOn = ['t112']; // make a loop
  const looped = chainsFor(s, 't103');
  assert.equal(looped.hasCycle, true);
  assert.ok(looped.steps.length <= 2, 'terminates');
});

test('032 + 036 + 035 + 040: each scenario gives a cascade, three options, before/after plans and explanations', () => {
  const s = fresh();
  for (const sc of SCENARIOS) {
    const board = buildBoard(s, sc.id);
    assert.equal(board.empty, false, `${sc.id} has something to analyse`);
    assert.deepEqual(board.options.map((o) => o.id), ['none', 'reschedule', 'reassign']);
    assert.ok(board.cascade.direct.length > 0, `${sc.id} displaces work`);
    for (const o of board.options) {
      assert.ok(o.explain.headline.length > 10);
      assert.ok(o.explain.what.length > 0);
      assert.equal(typeof o.m.newRisk.length, 'number');
    }
    for (const key of ['before', 'none', 'reschedule', 'reassign']) {
      assert.equal(board.plans[key].length, board.affected.length);
    }
    // Doing nothing is never better than the best real option.
    const best = Math.min(board.options[1].m.newRisk.length, board.options[2].m.newRisk.length);
    assert.ok(board.options[0].m.newRisk.length >= best);
  }
  const lift = buildBoard(s, 'lift');
  assert.deepEqual(lift.cascade.downstream.map((t) => t.id).sort(), ['t104', 't112'], 'the lift incident ripples down the seepage chain');
  assert.ok(lift.chains.some((c) => c.maxDepth === 2));
});

test('Ripple analysis never changes the live data', () => {
  const s = fresh();
  const snapshot = JSON.stringify(s.tasks);
  for (const sc of SCENARIOS) buildBoard(s, sc.id);
  assert.equal(JSON.stringify(s.tasks), snapshot);
});

test('the absent scenario follows the Attendance page', () => {
  const s = fresh();
  const base = buildBoard(s, 'absent');
  assert.deepEqual(base.scenario.absent, ['o6']);
  markAbsent(s, 'o4', 'mc');
  s.rev += 1;
  assert.deepEqual(buildBoard(s, 'absent').scenario.absent.sort(), ['o4', 'o6']);
  for (const o of s.officers) clearAbsence(s, o.id);
  s.rev += 1;
  assert.equal(buildBoard(s, 'absent').empty, true, 'nobody away means nothing to analyse');
});

test('approving an option applies it once and records the decision', () => {
  const s = fresh();
  const tasksBefore = s.tasks.length;
  const changed = applyDecision(s, 'lift', 'reassign', 'Jennifer Ong');
  assert.ok(changed > 0);
  assert.equal(s.tasks.length, tasksBefore + 1, 'the urgent incident joins the plan');
  assert.equal(lastDecision(s, 'lift').optionId, 'reassign');
  assert.equal(applyDecision(s, 'lift', 'none', 'Jennifer Ong'), 0, 'no action changes nothing');
  assert.match(s.activity[0].text, /Ripple Intelligence: approved/);
});

test('pages render for managers and members and show no broken values', () => {
  const s = fresh();
  replaceState(s);
  setCurrentUser(getState(), 'manager');
  for (const sc of SCENARIOS) {
    rippleView.scenarioId = sc.id;
    rippleView.optionId = null;
    const out = ripplePage.render(getState()).toString();
    assert.doesNotMatch(out, /undefined|NaN|\[object/, `${sc.id} renders cleanly`);
    for (const heading of ['What it knocks over', 'How the delay spreads', 'Three ways to respond', 'before and after', 'in plain words', 'Your decision']) {
      assert.ok(out.includes(heading), `${sc.id} shows "${heading}"`);
    }
  }
  const mgr = attendancePage.render(getState()).toString();
  assert.ok(mgr.includes('MC reshuffle') && mgr.includes('Mark MC'));

  setCurrentUser(getState(), 'member');
  const member = attendancePage.render(getState()).toString();
  assert.ok(!member.includes('MC reshuffle'), 'reshuffle is for managers');
  assert.ok(!member.includes('Mark MC'), 'members cannot mark others absent');
});

test('script-like text in task names is escaped on the page', () => {
  const s = fresh();
  replaceState(s);
  setCurrentUser(getState(), 'manager');
  getTask(getState(), 't103').title = '<img src=x onerror=alert(1)>';
  getState().rev += 1;
  rippleView.scenarioId = 'lift';
  const out = ripplePage.render(getState()).toString();
  assert.ok(!out.includes('<img src=x'));
  assert.ok(out.includes('&lt;img src=x'));
});
