import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../js/data.js';
import { canRequestScheduleChange, pendingScheduleRequest, requestScheduleChange, scheduleIssues } from '../js/planningIssues.js';
import { acceptDraft, discardDraft, generateDraft, reviewDraft } from '../js/scheduleReview.js';
import { renderPlanningIssues } from '../js/pages/planningIssuePanel.js';
import { planningIssueView, planningView, renderSmartPlan } from '../js/pages/smartPlan.js';
import { createApprovalRequest, decideApproval, getTask, loadState, replaceState, setCurrentUser, storage, update } from '../js/state.js';
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

test('a quiet day in a weekly plan can show all warnings with stable dates before and after acceptance', () => {
  const state = createSeedState();
  const officer = state.officers.find(({ id }) => id === 'o1');
  for (let index = 0; index < 4; index++) {
    saveCapturedTask(state, {
      title: `Audit task ${index}`, description: 'Fictional capacity example', ownerId: officer.id,
      category: 'Inspection', priority: 'High', estimatedDurationMinutes: 600, due: `${TODAY}T17:00`,
    });
  }
  const dates = calendarWeek(TODAY);
  const draft = generateDraft(state, officer.id, dates);
  const previousView = { ...planningView };
  const previousIssueView = { ...planningIssueView };
  const render = () => renderSmartPlan(state, officer).toString();
  const cards = (page) => [...page.matchAll(/data-issue-id="([^"]+)"[^]*?<\/article>/g)]
    .map(([card, id]) => [id, card.match(/<time[^>]*datetime="([^"]+)"/)?.[1]]);
  try {
    Object.assign(planningView, { date: TODAY, mode: 'weekly', drafts: new Map([[officer.id, draft]]) });
    Object.assign(planningIssueView, { open: true, allDates: false, date: '' });
    const weekly = render();
    assert.match(weekly, /View all warnings/);
    assert.match(weekly, /Show less/);
    assert.equal(cards(weekly.split('class="schedule-more-warnings"')[0]).length, 3);
    Object.assign(planningView, { date: dates.at(-1), mode: 'daily' });
    const quiet = render();
    assert.match(quiet, /Review all draft issues/);
    assert.match(quiet, /No warnings for this day/);
    planningIssueView.allDates = true;
    const daily = render();
    assert.deepEqual(cards(daily), cards(weekly));
    assert.ok(cards(daily).some(([id, date]) => id.startsWith('unscheduled-') && date === TODAY));
    acceptDraft(state, draft, { acknowledged: true });
    planningView.drafts.clear();
    const accepted = render();
    assert.match(accepted, /Review all accepted plan issues/);
    assert.deepEqual(cards(accepted), cards(weekly));
  } finally {
    Object.assign(planningView, previousView);
    Object.assign(planningIssueView, previousIssueView);
  }
});

test('manager feedback distinguishes review approval from an applied task change', () => {
  const state = createSeedState();
  const task = getTask(state, 't102');
  const request = requestScheduleChange(state, { id: 'review-test', task, message: 'Review workload' }, 'Check capacity.');
  const original = structuredClone(task);
  setCurrentUser(state, 'manager');
  const review = decideApproval(state, request.id, 'approved');
  assert.equal(review.message, 'Review approved. Update the task or commitment, then regenerate.');
  assert.deepEqual(task, original);
  assert.ok(state.notifications.some(({ approvalId, summary }) => approvalId === request.id && summary.includes(review.message)));

  const change = createApprovalRequest(state, { requesterId: 'o1', taskId: task.id, proposedOwnerId: 'o2' });
  const applied = decideApproval(state, change.id, 'approved');
  assert.equal(applied.message, 'Schedule change approved and applied.');
  assert.equal(task.ownerId, 'o2');
});
