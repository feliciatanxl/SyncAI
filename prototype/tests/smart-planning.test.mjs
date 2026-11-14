import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeedState } from '../js/data.js';
import { planningView, renderSmartPlan } from '../js/pages/smartPlan.js';
import tasksPage, { clearTaskFilters, tasksView } from '../js/pages/tasks.js';
import { saveSchedulePreferences, schedulePreferences } from '../js/schedulePreferences.js';
import { buildSmartSchedule } from '../js/smartSchedule.js';
import { acceptDraft, generateDraft, reviewDraft } from '../js/scheduleReview.js';
import { getOfficer, loadState, replaceState, setCurrentUser } from '../js/state.js';
import { saveCapturedTask } from '../js/taskCapture.js';
import { deadlineAlert, parseTaskTags, priorityFactors, suggestCategory, taskDeadline } from '../js/taskIntelligence.js';
import { calendarDay, calendarWeek, NOW, TODAY, toMin, weekday } from '../js/time.js';

const taskInput = {
  title: 'Inspect lift at Block 123', description: 'Check the lift doors', ownerId: 'o1',
  category: 'Inspection', priority: 'Medium', estimatedDurationMinutes: 30, due: `${TODAY}T17:00`,
};
const preferences = {
  days: [1, 2, 3, 4, 5, 6, 7], workStart: '08:30', workEnd: '17:30',
  lunchStart: '12:30', lunchEnd: '13:30', focus: [], maxHours: 8,
};

function emptyPlanningState() {
  const s = createSeedState();
  Object.assign(s, { tasks: [], appointments: [], meetings: [] });
  return s;
}

test('keyword suggestions remain opt-in and tags persist on case-linked and standalone tasks', () => {
  assert.deepEqual(suggestCategory('Inspect lift at Block 123'), { category: 'Inspection', keyword: 'Inspect' });
  assert.equal(suggestCategory('Check', 'Prepare the invoice').category, 'Admin');
  assert.equal(suggestCategory('Unmatched words'), null);
  assert.deepEqual(parseTaskTags(' Lift , resident visit, lift,  Resident   Visit '), ['Lift', 'resident visit']);
  assert.throws(() => parseTaskTags('a,b,c,d,e,f,g,h,i'), /eight/);
  const s = createSeedState();
  const task = saveCapturedTask(s, { ...taskInput, category: 'Maintenance', tags: 'Lift, Demo tag', caseId: 'case-001' });
  assert.equal(task.category, 'Maintenance');
  assert.deepEqual(task.tags, ['Lift', 'Demo tag']);
  const edited = saveCapturedTask(s, { ...taskInput, caseId: '', tags: 'Lift' }, task.id);
  assert.deepEqual(edited.tags, ['Lift']);
  assert.equal(edited.caseId, null);
  const prior = { ...tasksView };
  try {
    Object.assign(tasksView, { category: 'Inspection', tag: 'lift', page: 1 });
    const output = tasksPage.render(s).toString();
    assert.ok(output.includes(task.id));
    assert.match(output, /\+1 tag/);
    assert.doesNotMatch(output, />Lift<\/span>/);
    tasksView.tag = 'demo tag';
    assert.match(tasksPage.render(s).toString(), /No tasks match/);
    Object.assign(tasksView, { status: 'todo', q: 'inspect', dueDate: TODAY, moreFiltersOpen: true, page: 2 });
    clearTaskFilters();
    assert.equal(tasksView.status, 'todo');
    assert.equal(tasksView.moreFiltersOpen, true);
    assert.equal(tasksView.page, 1);
    assert.equal(tasksView.q, '');
    assert.equal(tasksView.category, 'all');
    assert.equal(tasksView.tag, '');
    assert.equal(tasksView.dueDate, '');
  } finally {
    Object.assign(tasksView, prior);
  }
});

test('priority explanation follows EMS order and deadline alerts use the recorded SLA when earlier', () => {
  const task = { ...taskInput, category: 'Resident Feedback', impact: 'high', safety: true, slaDue: `${TODAY}T09:00` };
  assert.deepEqual(priorityFactors(task).map(({ factor }) => factor),
    ['Service', 'Safety', 'Residents’ well-being', 'Actual concern / urgency']);
  assert.deepEqual(taskDeadline(task), { at: `${TODAY}T09:00`, label: 'SLA deadline' });
  assert.equal(deadlineAlert(task, NOW).label, 'Due within 24h');
  assert.equal(deadlineAlert(task, `${TODAY}T09:30`).label, 'Overdue');
  assert.equal(deadlineAlert({ ...task, status: 'done' }), null);
  assert.equal(task.priority, 'Medium');
});

test('schedule preferences validate periods, scope and working days', () => {
  const s = createSeedState();
  const saved = saveSchedulePreferences(s, 'o1', { ...preferences, days: ['6', '1', '6'],
    focus: [{ start: '09:00', end: '10:00' }, { start: '15:00', end: '16:00' }], maxHours: 6.5 });
  assert.deepEqual(saved.days, [1, 6]);
  assert.equal(saved.maxMinutes, 390);
  assert.deepEqual(schedulePreferences(s, 'o1'), saved);
  assert.throws(() => saveSchedulePreferences(s, 'o1', { ...preferences, days: [] }), /working day/);
  assert.throws(() => saveSchedulePreferences(s, 'o1', { ...preferences, focus: [{ start: '12:00', end: '13:00' }] }), /separate from lunch/);
  assert.throws(() => saveSchedulePreferences(s, 'o1', { ...preferences, maxHours: 0 }), /maximum/);
  assert.throws(() => saveSchedulePreferences(s, 'o2', preferences), /unavailable/);
  setCurrentUser(s, 'manager');
  assert.equal(saveSchedulePreferences(s, 'o2', preferences).maxMinutes, 480);
});

test('preferences and captured tags survive browser reload and the demo day rollover', () => {
  const original = globalThis.localStorage;
  let stored;
  globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  try {
    const s = createSeedState();
    const saved = saveSchedulePreferences(s, 'o1', { ...preferences, maxHours: 5,
      lunchByDay: { 1: { start: '11:30', end: '12:30' } } });
    const captured = saveCapturedTask(s, { ...taskInput, caseId: 'case-001', tags: 'Lift' });
    replaceState(s);
    assert.deepEqual(schedulePreferences(loadState(), 'o1'), saved);
    replaceState({ ...s, seededFor: '2000-01-01' });
    const rolled = loadState();
    assert.deepEqual(schedulePreferences(rolled, 'o1'), saved);
    assert.deepEqual(rolled.tasks.find(({ id }) => id === captured.id).tags, ['Lift']);
  } finally {
    globalThis.localStorage = original;
  }
});

test('different weekdays protect their own lunch windows and invalidate a draft when edited', () => {
  const s = emptyPlanningState();
  const next = calendarDay(TODAY, 1);
  const following = calendarDay(TODAY, 2);
  const lunchByDay = {
    [weekday(TODAY)]: { start: '11:30', end: '12:30' },
    [weekday(next)]: { start: '13:30', end: '14:30' },
  };
  const oldDraft = generateDraft(s, 'o1', [TODAY, next, following]);
  saveSchedulePreferences(s, 'o1', { ...preferences, lunchByDay });
  assert.deepEqual(reviewDraft(s, oldDraft).changed, ['Schedule preferences']);
  assert.throws(() => acceptDraft(s, oldDraft, { acknowledged: true }), /Regenerate/);
  const result = buildSmartSchedule(s, 'o1', [TODAY, next, following]);
  assert.deepEqual(result.days.map(({ lunch }) => lunch), [
    { start: toMin('11:30'), end: toMin('12:30') },
    { start: toMin('13:30'), end: toMin('14:30') },
    { start: toMin('12:30'), end: toMin('13:30') },
  ]);
  for (const day of result.days) {
    assert.ok(day.slots.every(({ start, end }) => end <= day.lunch.start || start >= day.lunch.end));
  }
  assert.throws(() => saveSchedulePreferences(s, 'o1', { ...preferences,
    lunchByDay: { [weekday(TODAY)]: { start: '11:30' } } }), /lunch must start and end/);
  assert.throws(() => saveSchedulePreferences(s, 'o1', { ...preferences, lunchByDay,
    focus: [{ start: '14:00', end: '15:00' }] }), /separate from lunch/);
  saveSchedulePreferences(s, 'o1', preferences);
  assert.equal(buildSmartSchedule(s, 'o1', [TODAY]).days[0].lunch.start, toMin('12:30'));
});

test('daily scheduling protects meetings, repair appointments, fixed tasks and lunch', () => {
  const s = emptyPlanningState();
  s.meetings = [{ id: 'meeting', title: 'Estate review', ownerIds: ['o1'], date: TODAY, start: '09:00', end: '10:00' }];
  s.appointments = [{ id: 'repair', title: 'Pump repair', ownerId: 'o1', date: TODAY, start: '09:45', end: '11:00' }];
  const fixed = saveCapturedTask(s, { ...taskInput, schedulingType: 'fixed', fixedStart: `${TODAY}T11:30` });
  const flexible = saveCapturedTask(s, { ...taskInput, estimatedDurationMinutes: 60 });
  saveSchedulePreferences(s, 'o1', { ...preferences, maxHours: 5, focus: [{ start: '14:00', end: '16:00' }] });
  const preview = buildSmartSchedule(s, 'o1', [TODAY], { generate: false }).days[0];
  assert.equal(preview.proposed.length, 0);
  const { days: [day] } = buildSmartSchedule(s, 'o1', [TODAY]);
  assert.deepEqual(day.blocked.map(({ kind }) => kind), ['meeting', 'appointment', 'fixed-task']);
  assert.equal(day.protectedMinutes, 150);
  assert.match(day.warnings.join(' '), /Estate review.*Pump repair.*protected/);
  assert.equal(day.proposed[0].taskId, flexible.id);
  assert.equal(day.proposed[0].start, toMin('14:00'));
  assert.ok(!day.proposed.some(({ taskId }) => taskId === fixed.id));
  assert.ok(day.proposed.every((task) => [...day.blocked, day.lunch].every((block) => task.end <= block.start || task.start >= block.end)));
  assert.ok(day.workloadMinutes <= 300);
});

test('scheduler breaks deadline ties by manual priority and reports hard SLA and capacity failures', () => {
  const s = emptyPlanningState();
  saveSchedulePreferences(s, 'o1', { ...preferences, maxHours: 0.5 });
  const low = saveCapturedTask(s, { ...taskInput, priority: 'Low' });
  const high = saveCapturedTask(s, { ...taskInput, priority: 'High' });
  const sla = saveCapturedTask(s, { ...taskInput, title: 'SLA deadline test', priority: 'Critical' });
  sla.slaDue = `${TODAY}T08:40`;
  const result = buildSmartSchedule(s, 'o1', [TODAY]);
  assert.deepEqual(result, buildSmartSchedule(s, 'o1', [TODAY]));
  assert.deepEqual(result.days[0].proposed.map(({ taskId }) => taskId), [high.id]);
  assert.equal(result.days[0].overloaded, true);
  assert.match(result.unscheduled.find(({ task }) => task.id === low.id).reason, /capacity/);
  assert.equal(result.unscheduled.find(({ task }) => task.id === sla.id).deadline.at, sla.slaDue);
  assert.match(result.unscheduled.find(({ task }) => task.id === sla.id).reason, /before the recorded sla deadline/i);
  assert.equal(sla.priority, 'Critical');
});

test('short or elapsed fixed commitments stay protected and do not complete open work', () => {
  const s = emptyPlanningState();
  const short = saveCapturedTask(s, { ...taskInput, title: 'Lift repair follow-up', estimatedDurationMinutes: 60 });
  const elapsed = saveCapturedTask(s, { ...taskInput, title: 'Early fixed check', schedulingType: 'fixed', fixedStart: `${TODAY}T07:00` });
  const followUp = saveCapturedTask(s, { ...taskInput, title: 'Report after fixed check' });
  followUp.dependsOn = [elapsed.id];
  s.appointments.push({ id: 'repair', title: 'Lift contractor visit', ownerId: 'o1', taskId: short.id,
    date: TODAY, start: '10:00', end: '10:30' });
  const result = buildSmartSchedule(s, 'o1', [TODAY]);
  assert.equal(result.days[0].blocked.length, 2);
  assert.equal(result.days[0].proposed.length, 0);
  assert.match(result.unscheduled.find(({ task }) => task.id === short.id).reason, /shorter than/);
  assert.match(result.unscheduled.find(({ task }) => task.id === elapsed.id).reason, /fixed block has ended/);
  assert.match(result.unscheduled.find(({ task }) => task.id === followUp.id).reason, /earlier task/);
});

test('weekly plan covers Monday through Sunday without duplicating tasks and honours prerequisites', () => {
  const s = emptyPlanningState();
  const next = calendarDay(TODAY, 1);
  const dates = calendarWeek(next);
  assert.equal(dates.length, 7);
  assert.equal(weekday(dates[0]), 1);
  assert.equal(weekday(dates[6]), 7);
  saveSchedulePreferences(s, 'o1', { ...preferences, days: [weekday(next)], maxHours: 1 });
  const first = saveCapturedTask(s, { ...taskInput, title: 'Preceding work', due: `${next}T17:00` });
  const second = saveCapturedTask(s, { ...taskInput, title: 'Dependent work', due: `${next}T16:00` });
  second.dependsOn = [first.id];
  const result = buildSmartSchedule(s, 'o1', dates);
  assert.equal(result.workloadMinutes, 60);
  const work = result.days.find(({ date }) => date === next).proposed;
  assert.deepEqual(work.map(({ taskId }) => taskId), [first.id, second.id]);
  assert.ok(work[0].end <= work[1].start);
  assert.ok(result.days.filter(({ date }) => date !== next).every((day) => day.proposed.length === 0));
  const savedView = { ...planningView };
  try {
    const draft = generateDraft(s, 'o1', dates);
    Object.assign(planningView, { date: next, mode: 'weekly', drafts: new Map([['o1', draft]]) });
    const page = renderSmartPlan(s, getOfficer(s, 'o1')).toString();
    assert.equal((page.match(/class="smart-week-day /g) || []).length, 7);
    assert.match(page, /1h total scheduled workload/);
    assert.match(page, /2 task blocks · 0 protected/);
    assert.match(page, new RegExp(`data-action="plan-open-day" data-date="${next}"`));
    assert.doesNotMatch(page, /Dependent work/);
    planningView.mode = 'daily';
    assert.match(renderSmartPlan(s, getOfficer(s, 'o1')).toString(), /Dependent work/);
    acceptDraft(s, draft, { acknowledged: true });
    planningView.drafts.clear();
    planningView.mode = 'weekly';
    assert.match(renderSmartPlan(s, getOfficer(s, 'o1')).toString(), /smart-week-status is-accepted/);
    planningView.mode = 'daily';
    const accepted = renderSmartPlan(s, getOfficer(s, 'o1')).toString();
    assert.match(accepted, /Dependent work/);
    assert.match(accepted, /Accepted task/);
  } finally {
    Object.assign(planningView, savedView);
  }
});
