import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../js/data.js';
import { canRequestScheduleChange, pendingScheduleRequest, requestScheduleChange, scheduleIssues } from '../js/planningIssues.js';
import { acceptDraft, discardDraft, generateDraft, reviewDraft } from '../js/scheduleReview.js';
import { renderPlanningIssues } from '../js/pages/planningIssuePanel.js';
import { loadState, replaceState, setCurrentUser, storage, update } from '../js/state.js';
import { saveCapturedTask } from '../js/taskCapture.js';
import { calendarWeek, TODAY } from '../js/time.js';

test('protected overlaps are warnings, while proposed overlaps and deadline violations block acceptance', () => {
  const state = createSeedState();
  const draft = generateDraft(state, 'o1', [TODAY]);
  assert.equal(reviewDraft(state, draft).blocking.length, 0);
  assert.ok(scheduleIssues(state, draft.days, draft.unscheduled).some((issue) => issue.kind === 'Protected overlap' && !issue.blocking));
  const day = draft.days[0];
  const meeting = day.blocked.find((block) => block.kind === 'meeting');
  const appointment = day.blocked.find((block) => block.kind === 'appointment');
  const [first, second] = day.proposed;
  assert.ok(first && second);
  Object.assign(first, { start: meeting.start, end: appointment.end });
  Object.assign(second, { start: appointment.start, end: appointment.end });
  const review = reviewDraft(state, draft);
  for (const title of [meeting.title, appointment.title, second.title]) {
    assert.ok(review.blocking.some((issue) => issue.kind === 'Overlapping blocks' && issue.other.title === title));
  }
  const task = state.tasks.find((entry) => entry.id === first.taskId);
  // Use a fresh snapshot with a real deadline, then corrupt only its proposed block.
  task.due = `${TODAY}T17:30`;
  const late = generateDraft(state, 'o1', [TODAY]);
  late.days[0].proposed.push({ taskId: task.id, title: task.title, start: 1050, end: 1100 });
  assert.ok(reviewDraft(state, late).blocking.some((issue) => issue.kind === 'Deadline violation'));
  assert.throws(() => acceptDraft(state, draft, { acknowledged: true }), /Regenerate/);
  assert.throws(() => acceptDraft(state, late, { acknowledged: true }), /blocking scheduling conflicts/);
});

test('review keeps warnings and requests through acceptance, refresh and discard without changing commitments', () => {
  const previousStorage = { ...storage };
  const previousLocalStorage = globalThis.localStorage;
  let raw;
  globalThis.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  try {
    const state = createSeedState();
    const input = {
      title: 'Review demo workload', description: 'Fictional capacity example', ownerId: 'o1',
      category: 'Inspection', priority: 'High', estimatedDurationMinutes: 600, due: `${TODAY}T17:00`,
    };
    const task = saveCapturedTask(state, input);
    const dates = calendarWeek(TODAY);
    const draft = generateDraft(state, 'o1', dates);
    const issues = scheduleIssues(state, draft.days, draft.unscheduled);
    const issue = issues.find((item) => item.task?.id === task.id);
    const day = draft.days.find((entry) => entry.date === TODAY);
    assert.equal(issue.date, TODAY);
    const week = renderPlanningIssues(state, issues, draft.days, { weekly: true, date: TODAY, selectedDate: TODAY, open: true }).toString();
    assert.match(week, /Scheduling Review Required/);
    assert.match(week, /Review available slots/);
    assert.match(week, /data-action="plan-open-day"/);
    const daily = renderPlanningIssues(state, issues, [day], { weekly: false, date: TODAY, open: true }).toString();
    assert.match(daily, /View weekly capacity/);
    const appointments = structuredClone(state.appointments);
    const request = requestScheduleChange(state, issue, 'Please review the fictional capacity limit.');
    assert.equal(request.status, 'pending');
    assert.equal(pendingScheduleRequest(state, issue), request);
    assert.throws(() => requestScheduleChange(state, issue, 'Duplicate'), /unavailable/);
    assert.deepEqual(state.appointments, appointments);
    assert.equal(reviewDraft(state, draft).changed.length, 0);
    setCurrentUser(state, 'manager');
    assert.equal(canRequestScheduleChange(state, issue), false);
    setCurrentUser(state, 'member');
    assert.throws(() => acceptDraft(state, draft), /acknowledge/);
    replaceState(state);
    update((live) => acceptDraft(live, draft, { acknowledged: true }));
    const loaded = loadState();
    assert.equal(pendingScheduleRequest(loaded, issue).id, request.id);
    assert.ok(loaded.acceptedSchedules.o1[TODAY].unscheduled.some((entry) => entry.task.id === task.id));
    const nextDraft = generateDraft(loaded, 'o1', dates);
    saveCapturedTask(loaded, { ...input, estimatedDurationMinutes: 45 }, task.id);
    assert.throws(() => acceptDraft(loaded, nextDraft, { acknowledged: true }), /Regenerate/);
    const saved = structuredClone(loaded.acceptedSchedules);
    assert.equal(discardDraft(new Map([['o1', nextDraft]]), nextDraft, true), true);
    assert.deepEqual(loaded.acceptedSchedules, saved);
  } finally {
    globalThis.localStorage = previousLocalStorage;
    Object.assign(storage, previousStorage);
  }
});
