import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASE_PRIORITY_ORDER, accessibleCase, tasksForCase, visibleCases } from '../js/cases.js';
import { createSeedState } from '../js/data.js';
import casesPage from '../js/pages/cases.js';
import tasksPage from '../js/pages/tasks.js';
import { getTask, loadState, replaceState, setCurrentUser } from '../js/state.js';
import { saveCapturedTask } from '../js/taskCapture.js';
import { TODAY } from '../js/time.js';

const input = {
  title: 'Check repair photos',
  description: 'Compare the before and after photos',
  ownerId: 'o1',
  category: 'Inspection',
  priority: 'Medium',
  due: `${TODAY}T17:00`,
  estimatedDurationMinutes: '25',
};

test('case fixtures show the documented EMS order and only recorded deadlines', () => {
  const s = createSeedState();
  setCurrentUser(s, 'manager');
  assert.deepEqual(CASE_PRIORITY_ORDER, ['Service', 'Safety', 'Residents’ well-being', 'Actual concern / urgency']);
  const list = casesPage.render(s).toString();
  assert.match(list, /Fictional demo cases/);
  assert.match(list, /Response due/);
  assert.match(list, /No deadline recorded/);
  assert.doesNotMatch(list, /case-priority-order/);
  assert.doesNotMatch(list, /EMS case prioritisation order/);
  const detail = casesPage.render(s, 'case-001').toString();
  assert.match(detail, /Associated tasks/);
  assert.match(detail, /data-case-id="case-001"/);
  assert.match(detail, /Resident follow-up call/);
  assert.doesNotMatch(detail, /Inspect refuse chute hopper/);
});

test('cases and linked tasks respect member, manager, admin and inactive access', () => {
  const s = createSeedState();
  assert.deepEqual(visibleCases(s).map(({ id }) => id), ['case-001', 'case-004']);
  assert.equal(accessibleCase(s, 'case-002'), undefined);
  assert.match(casesPage.render(s, 'case-002').toString(), /Case unavailable/);
  assert.doesNotMatch(casesPage.render(s, 'case-002').toString(), /Blk 310/);
  setCurrentUser(s, 'manager');
  assert.equal(visibleCases(s).length, 4);
  const linked = saveCapturedTask(s, { ...input, ownerId: 'o3', caseId: 'case-001' });
  assert.ok(tasksForCase(s, 'case-001').includes(linked));
  s.teams.find(({ id }) => id === 'team-2').managers = [];
  assert.equal(accessibleCase(s, 'case-002'), undefined);
  setCurrentUser(s, 'member');
  assert.ok(!tasksForCase(s, 'case-001').includes(linked));
  for (const role of ['admin', 'pending', 'disabled']) {
    setCurrentUser(s, role);
    assert.deepEqual(visibleCases(s), []);
    assert.deepEqual(tasksForCase(s, 'case-001'), []);
  }
});

test('multiple tasks can link to one case, change links, or stay standalone', () => {
  const s = createSeedState();
  const first = saveCapturedTask(s, { ...input, caseId: 'case-001' });
  const second = saveCapturedTask(s, { ...input, caseId: 'case-001' });
  const standalone = saveCapturedTask(s, { ...input, caseId: '' });
  assert.ok(tasksForCase(s, 'case-001').includes(first));
  assert.ok(tasksForCase(s, 'case-001').includes(second));
  assert.equal(standalone.caseId, null);
  assert.throws(() => saveCapturedTask(s, { ...input, caseId: 'missing' }), /Select a case you can access/);
  assert.throws(() => saveCapturedTask(s, { ...input, caseId: 'case-002' }, second.id), /Select a case you can access/);
  assert.equal(second.caseId, 'case-001');
  assert.equal(saveCapturedTask(s, input, first.id).caseId, 'case-001');
  assert.equal(saveCapturedTask(s, { ...input, caseId: 'case-004' }, first.id).caseId, 'case-004');
  assert.equal(saveCapturedTask(s, { ...input, caseId: '' }, second.id).caseId, null);
});

test('existing browser data gains case fixtures and task links survive reload and day rollover', () => {
  const original = globalThis.localStorage;
  let saved;
  globalThis.localStorage = {
    getItem: () => saved,
    setItem: (_key, value) => { saved = value; },
  };
  try {
    const old = createSeedState();
    delete old.cases;
    for (const task of old.tasks) delete task.caseId;
    replaceState(old);
    const s = loadState();
    assert.equal(tasksForCase(s, 'case-001').length, 3);
    const task = saveCapturedTask(s, { ...input, caseId: 'case-001' });
    getTask(s, 't103').caseId = null;
    replaceState(s);
    assert.equal(getTask(loadState(), task.id).caseId, 'case-001');
    replaceState({ ...s, seededFor: '2000-01-01' });
    const rolled = loadState();
    assert.equal(rolled.seededFor, TODAY);
    assert.deepEqual(rolled.cases, s.cases);
    assert.equal(getTask(rolled, 't103').caseId, null);
    assert.equal(getTask(rolled, task.id).caseId, 'case-001');
  } finally {
    globalThis.localStorage = original;
  }
});

test('My Tasks puts one work-order creation flow above the separate To Do preview', () => {
  const s = createSeedState();
  const output = tasksPage.render(s).toString();
  assert.equal((output.match(/data-action="task-create-dialog"/g) || []).length, 1);
  assert.ok(output.indexOf('SyncAI work orders') < output.indexOf('Microsoft To Do'));
  assert.match(output, /href="#cases\/case-004"/);
  assert.match(output, /<details[^>]*id="todo-preview"/);
  assert.match(output, /data-label="Priority"/);
  assert.doesNotMatch(output, /AI (?:Priority )?Score/i);
});
