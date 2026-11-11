import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeedState } from '../js/data.js';
import tasksPage, { tasksView } from '../js/pages/tasks.js';
import { buildSchedule } from '../js/planner.js';
import { getTask, loadState, replaceState, setCurrentUser } from '../js/state.js';
import { accessibleTask, changeTaskStatus, deleteCapturedTask, saveCapturedTask, taskAssignees } from '../js/taskCapture.js';
import { TODAY } from '../js/time.js';

const valid = {
  title: 'Check the corridor fittings',
  description: 'Inspect fittings on levels 2 and 3',
  ownerId: 'o1',
  due: `${TODAY}T11:00`,
  estimatedDurationMinutes: '45',
  category: 'Inspection',
  priority: 'High',
};

test('capture creates a pending task with manual priority and offset-aware deadline', () => {
  const s = createSeedState();
  const task = saveCapturedTask(s, valid);
  assert.equal(task.status, 'todo');
  assert.equal(task.schedulingType, 'flexible');
  assert.equal(task.fixedStartAt, null);
  assert.equal(task.dueAt, `${TODAY}T03:00:00.000Z`);
  assert.equal(task.estimatedDurationMinutes, 45);
  assert.equal(task.priority, 'High');
  assert.equal(task.createdBy, 'o1');
  assert.equal(task.createdAt, task.updatedAt);
  assert.equal(accessibleTask(s, task.id), task);
  assert.ok(buildSchedule(s, 'o1').blocks.every(({ taskId }) => taskId !== task.id));
  assert.notEqual(saveCapturedTask(s, valid).id, task.id);
});

test('invalid required fields, dates and schedules leave the task list unchanged', () => {
  const s = createSeedState();
  const count = s.tasks.length;
  for (const invalid of [
    { title: '' }, { description: '  ' }, { category: '' }, { priority: 'Urgent' }, { ownerId: '' },
    { due: '2026-02-30T12:00' }, { due: '2026-12-01T24:00' },
    { estimatedDurationMinutes: 0 }, { estimatedDurationMinutes: 1.5 },
    { schedulingType: 'fixed' }, { schedulingType: 'fixed', fixedStart: `${TODAY}T10:30` },
  ]) {
    assert.throws(() => saveCapturedTask(s, { ...valid, ...invalid }));
  }
  assert.equal(s.tasks.length, count);
});

test('edit, status updates, and delete preserve task identity and demo fixtures', () => {
  const s = createSeedState();
  const task = saveCapturedTask(s, {
    ...valid, schedulingType: 'fixed', fixedStart: `${TODAY}T10:15`, remarks: 'Bring a ladder',
  });
  assert.equal(task.fixedStartAt, `${TODAY}T02:15:00.000Z`);
  assert.throws(() => saveCapturedTask(s, {
    ...valid, schedulingType: 'fixed', fixedStart: `${TODAY}T10:15`, estimatedDurationMinutes: 46,
  }, task.id));
  assert.equal(task.remarks, 'Bring a ladder');
  const edited = saveCapturedTask(s, { ...valid, title: 'Inspect corridor lighting' }, task.id);
  assert.equal(edited, task);
  assert.equal(edited.fixedStartAt, null);
  assert.equal(changeTaskStatus(s, task.id, 'in_progress'), true);
  assert.equal(task.status, 'in_progress');
  assert.equal(changeTaskStatus(s, task.id, 'done'), true);
  assert.ok(task.completedAt);
  assert.equal(deleteCapturedTask(s, 't103'), false);
  assert.equal(deleteCapturedTask(s, task.id), true);
  assert.equal(getTask(s, task.id), undefined);
});

test('capture obeys prototype access and manager assignment rules', () => {
  const s = createSeedState();
  const task = saveCapturedTask(s, valid);
  assert.throws(() => saveCapturedTask(s, { ...valid, ownerId: 'o3' }));
  setCurrentUser(s, { role: 'member', status: 'active', id: 'o3' });
  assert.equal(accessibleTask(s, task.id), undefined);
  assert.equal(changeTaskStatus(s, task.id, 'done'), false);
  assert.equal(deleteCapturedTask(s, task.id), false);
  assert.throws(() => saveCapturedTask(s, valid, task.id));
  setCurrentUser(s, 'manager');
  assert.ok(taskAssignees(s).some(({ id }) => id === 'o2'));
  assert.throws(() => saveCapturedTask(s, { ...valid, ownerId: 'o2' }, task.id));
  assert.equal(saveCapturedTask(s, { ...valid, ownerId: 'o3' }, task.id).ownerId, 'o3');
  for (const role of ['admin', 'pending', 'disabled']) {
    setCurrentUser(s, role);
    assert.equal(accessibleTask(s, task.id), undefined);
    assert.deepEqual(taskAssignees(s), []);
    assert.throws(() => saveCapturedTask(s, valid));
  }
});

test('filters combine title, status, priority, category and Singapore due date', () => {
  const s = createSeedState();
  const captured = saveCapturedTask(s, valid);
  const prior = { ...tasksView };
  try {
    Object.assign(tasksView, { q: 'corridor fittings', status: 'todo', priority: 'High', category: 'Inspection', dueDate: TODAY });
    assert.ok(tasksPage.render(s).toString().includes(captured.id));
    tasksView.status = 'done';
    assert.match(tasksPage.render(s).toString(), /No tasks match the selected filters/);
    tasksView.status = 'todo';
    tasksView.dueDate = '2099-01-01';
    assert.match(tasksPage.render(s).toString(), /No tasks match the selected filters/);
  } finally {
    Object.assign(tasksView, prior);
  }
});

test('browser persistence restores captured tasks after reload and demo day rollover', () => {
  const original = globalThis.localStorage;
  let stored;
  globalThis.localStorage = {
    setItem: (_key, value) => { stored = value; },
    getItem: () => stored,
  };
  try {
    const s = createSeedState();
    const task = saveCapturedTask(s, valid);
    const legacyId = 't9876';
    s.tasks.push({ id: legacyId, title: 'Previously captured task', ownerId: 'o1', due: task.dueAt, effort: 1 });
    replaceState(s);
    assert.deepEqual(getTask(loadState(), task.id), task);
    replaceState({ ...s, seededFor: '2000-01-01' });
    const rolled = loadState();
    assert.equal(rolled.seededFor, TODAY);
    assert.deepEqual(getTask(rolled, task.id), task);
    assert.equal(getTask(rolled, legacyId).manualCapture, true);
    assert.equal(deleteCapturedTask(rolled, task.id), true);
    replaceState(rolled);
    assert.equal(getTask(loadState(), task.id), undefined);
  } finally {
    globalThis.localStorage = original;
  }
});
