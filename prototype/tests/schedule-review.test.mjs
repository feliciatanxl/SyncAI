import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeedState } from '../js/data.js';
import { generateDraft, acceptDraft, reviewDraft, discardDraft } from '../js/scheduleReview.js';
import { saveSchedulePreferences, schedulePreferences } from '../js/schedulePreferences.js';
import { loadState, replaceState, storage, update } from '../js/state.js';
import { calendarDay, calendarWeek, TODAY } from '../js/time.js';

test('accepted daily and weekly schedules preserve dates and the reviewed outcome', () => {
  const state = createSeedState();
  const week = generateDraft(state, 'o1', calendarWeek(TODAY));
  assert.throws(() => acceptDraft(state, week), /acknowledge/);
  acceptDraft(state, week, { acknowledged: true });
  const daily = generateDraft(state, 'o1', [TODAY]);
  assert.deepEqual(reviewDraft(state, daily).replaced, [TODAY]);
  if (reviewDraft(state, daily).duplicates.length) {
    assert.throws(() => acceptDraft(state, daily, { acknowledged: true }), /accepted task blocks/);
  } else {
    acceptDraft(state, daily, { acknowledged: true });
    assert.equal(state.acceptedSchedules.o1[TODAY].id, daily.id);
  }
  const other = week.dates.find((date) => date !== TODAY);
  assert.equal(state.acceptedSchedules.o1[other].id, week.id);
  assert.deepEqual(state.acceptedSchedules.o1[other].unscheduled, week.unscheduled);
  assert.deepEqual(state.acceptedSchedules.o1[other].day.blocked, week.days.find((day) => day.date === other).blocked);
});

test('task and preference changes invalidate drafts and cancel preserves the proposal', () => {
  const state = createSeedState();
  const draft = generateDraft(state, 'o1', [TODAY]);
  const drafts = new Map([['o1', draft]]);
  state.tasks.find((task) => task.ownerId === 'o1').title += ' revised';
  const prefs = schedulePreferences(state, 'o1');
  assert.throws(() => saveSchedulePreferences(state, 'o1', { ...prefs, days: [], maxHours: 7 }), /working day/);
  saveSchedulePreferences(state, 'o1', { ...prefs, maxHours: 7 });
  assert.deepEqual(reviewDraft(state, draft).changed, ['Tasks or dependencies', 'Schedule preferences']);
  assert.throws(() => acceptDraft(state, draft, { acknowledged: true }), /Regenerate/);
  const before = structuredClone(state);
  assert.equal(discardDraft(drafts, draft, false), false);
  assert.equal(drafts.get('o1'), draft);
  assert.equal(discardDraft(drafts, draft, true), true);
  assert.deepEqual(state, before);
});

test('reject a proposed task that is already accepted outside the draft dates', () => {
  const state = createSeedState();
  const daily = generateDraft(state, 'o1', [TODAY]);
  assert.ok(daily.days[0].proposed.length);
  const other = calendarDay(TODAY, 1);
  state.acceptedSchedules = { o1: { [other]: { day: { proposed: [daily.days[0].proposed[0]] } } } };
  assert.deepEqual(reviewDraft(state, daily).duplicates, [other]);
  assert.throws(() => acceptDraft(state, daily, { acknowledged: true }), /Review accepted task blocks/);
  assert.equal(state.acceptedSchedules.o1[TODAY], undefined);
});

test('accepted schedules reload and a failed write keeps the current session usable', () => {
  const original = globalThis.localStorage;
  const previousStorage = { ...storage };
  let raw;
  globalThis.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  try {
    const state = createSeedState();
    const draft = generateDraft(state, 'o1', [TODAY]);
    replaceState(state);
    update((s) => acceptDraft(s, draft, { acknowledged: true }));
    assert.deepEqual(loadState().acceptedSchedules.o1[TODAY].unscheduled, draft.unscheduled);
    const historical = JSON.parse(raw);
    historical.seededFor = '2000-01-01';
    raw = JSON.stringify(historical);
    assert.equal(loadState().acceptedSchedules.o1[TODAY].id, draft.id);
    const next = calendarDay(TODAY, 1);
    globalThis.localStorage.setItem = () => { throw Error('Quota exceeded'); };
    const live = loadState();
    update((s) => {
      const emptyOfficerDraft = generateDraft(s, 'o3', [next]);
      // Managers can accept on behalf of an officer they lead in the demo.
      s.role = 'manager';
      acceptDraft(s, emptyOfficerDraft, { acknowledged: true });
    });
    assert.ok(live.acceptedSchedules.o3[next]);
    assert.equal(storage.ok, false);
    assert.match(storage.notice, /lost on reload/i);
    assert.equal(JSON.parse(raw).acceptedSchedules.o3, undefined);
  } finally {
    globalThis.localStorage = original;
    Object.assign(storage, previousStorage);
  }
});
