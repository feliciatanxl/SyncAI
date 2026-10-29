// Rules-engine tests. Run from the repository root with: node --test "prototype/tests/*.test.mjs"
// Uses only Node's built-in test runner; the modules under test are plain ES modules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNCILS, PROJECT_TEMPLATES, createSeedState } from '../js/data.js';
import { scoreTask } from '../js/ai.js';
import { assessRisk, buildSchedule } from '../js/planner.js';
import { TODAY, dt, toMin, workDay } from '../js/time.js';
import { projectHealth } from '../js/pages/projects.js';
import { statusOf } from '../js/pages/hub.js';

const seed = () => createSeedState();
const task = (s, id) => s.tasks.find((t) => t.id === id);

test('seed data links every project task to a real project', () => {
  const s = seed();
  const ids = new Set(s.projects.map((p) => p.id));
  for (const t of s.tasks.filter((x) => x.projectId)) assert.ok(ids.has(t.projectId), `${t.id} → ${t.projectId}`);
  for (const p of s.projects) assert.ok(p.start < p.due, `${p.id} starts before it ends`);
});

test('templates spread their tasks across the project timeline', () => {
  for (const [key, tpl] of Object.entries(PROJECT_TEMPLATES))
    for (const [title, , effort, share] of tpl.tasks) {
      assert.ok(share >= 0 && share <= 1, `${key}: ${title} share`);
      assert.ok(effort > 0, `${key}: ${title} effort`);
    }
});

test('priority score is 0–100 and ranks urgent safety work above routine admin', () => {
  const s = seed();
  const lift = scoreTask(s, task(s, 't401')); // Critical, safety, due today
  const admin = scoreTask(s, task(s, 't108')); // Low, admin, due in 4 days
  for (const sc of [lift, admin]) assert.ok(sc.score >= 0 && sc.score <= 100);
  assert.ok(lift.score > admin.score);
  assert.ok(lift.reasons.length > 0, 'score is explained');
});

test('deadline risk: overdue is high, done is none', () => {
  const s = seed();
  assert.equal(assessRisk(s, task(s, 't201')).level, 'high'); // due yesterday
  assert.equal(assessRisk(s, { ...task(s, 't101'), status: 'done' }).level, 'none');
});

test('scheduler keeps blocks inside working hours and away from meetings', () => {
  const s = seed();
  const { blocks } = buildSchedule(s, 'o1');
  assert.ok(blocks.length > 0);
  const meetings = s.meetings.filter((m) => m.ownerIds.includes('o1'));
  for (const b of blocks) {
    assert.ok(toMin(b.start) >= toMin(s.settings.workStart) && toMin(b.end) <= toMin(s.settings.workEnd), `${b.taskId} within hours`);
    for (const m of meetings.filter((x) => x.date === b.date))
      assert.ok(toMin(b.end) <= toMin(m.start) || toMin(b.start) >= toMin(m.end), `${b.taskId} clashes with ${m.title}`);
  }
});

test('project health: empty, complete, overdue and on-track projects', () => {
  const s = seed();
  const fake = { id: 'px', start: workDay(-10), due: workDay(10), milestones: [] };
  const base = { ...task(s, 't108'), projectId: 'px' };
  assert.equal(projectHealth({ ...s, tasks: [] }, fake).level, 'on-track');
  assert.equal(projectHealth({ ...s, tasks: [{ ...base, status: 'done' }] }, fake).level, 'done');
  assert.equal(projectHealth({ ...s, tasks: [{ ...base, due: dt(workDay(-1), '17:00') }] }, fake).level, 'risk');
  assert.equal(projectHealth(s, s.projects.find((p) => p.id === 'p5')).level, 'done');
  assert.equal(projectHealth(s, s.projects.find((p) => p.id === 'p3')).level, 'on-track');
});

test('project health hides reasons that name other officers behind a flag', () => {
  const s = seed();
  const h = projectHealth(s, s.projects.find((p) => p.id === 'p1'));
  const named = h.reasons.filter((r) => s.officers.some((o) => r.text.includes(o.name)));
  assert.ok(named.length > 0, 'p1 has an owner-related reason');
  assert.ok(named.every((r) => r.personal), 'every reason naming an officer is personal');
});

test('council status thresholds', () => {
  const byId = Object.fromEntries(COUNCILS.map((c) => [c.id, c]));
  assert.equal(statusOf(byId.wr).id, 'support');
  assert.equal(statusOf(byId.eb).id, 'watch');
  assert.equal(statusOf(byId.sh).id, 'healthy');
});

test('demo clock is a working day', () => {
  const day = new Date(`${TODAY}T12:00`).getDay();
  assert.ok(day !== 0 && day !== 6);
});

test('timer: start moves to-do work in progress, stop adds time, one timer per officer', async () => {
  const { startTimer, runningTimer, settleTimer, elapsedHours, MAX_SESSION_H } = await import('../js/timer.js');
  const s = seed();
  const t0 = 1_000_000;
  startTimer(s, 't108', t0);
  assert.equal(task(s, 't108').status, 'in_progress');
  startTimer(s, 't107', t0 + 30 * 60_000); // starting another stops the first
  assert.equal(runningTimer(s, 'o1').id, 't107');
  assert.equal(task(s, 't108').spent, 0.5);
  assert.equal(settleTimer(task(s, 't107'), t0 + 90 * 60_000), 1);
  assert.equal(runningTimer(s, 'o1'), null);
  assert.equal(elapsedHours(0, 48 * 3_600_000), MAX_SESSION_H, 'runaway timers are capped');
});

test('group-by keeps every task once, in a fixed order', async () => {
  const { groupTasks } = await import('../js/pages/tasks.js');
  const s = seed();
  const rows = s.tasks.filter((t) => t.status !== 'done').map((t) => ({ t }));
  for (const by of ['status', 'priority', 'category', 'owner', 'project']) {
    const groups = groupTasks(s, rows, by);
    assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), rows.length, `${by} keeps every task`);
  }
  assert.deepEqual(groupTasks(s, rows, 'priority').map((g) => g.key), ['Critical', 'High', 'Medium', 'Low']);
  assert.equal(groupTasks(s, rows, 'project').at(-1).label, 'No project', '"No project" comes last');
});
