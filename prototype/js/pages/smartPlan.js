import { schedulePreferences } from '../schedulePreferences.js';
import { buildSmartSchedule } from '../smartSchedule.js';
import { accessibleTask, taskAssignees } from '../taskCapture.js';
import { changedPlanningInputs, reviewDraft } from '../scheduleReview.js';
import { calendarWeek, fmtDay, fmtDue, fmtHours, fmtLongDay, fromMin, TODAY } from '../time.js';
import { html, icon } from '../ui.js';

export const planningView = { date: TODAY, mode: 'daily', officerId: null, drafts: new Map() };
export const planningDates = () => planningView.mode === 'weekly' ? calendarWeek(planningView.date) : [planningView.date];
export const scheduleRange = (dates) => dates.length === 1 ? fmtLongDay(dates[0]) : `${fmtLongDay(dates[0])} – ${fmtLongDay(dates.at(-1))}`;
export function visibleDraft(officerId) {
  const draft = planningView.drafts.get(officerId);
  return draft?.dates.some((date) => planningDates().includes(date)) ? draft : null;
}
export function currentPlanningOfficer(state) {
  const officers = taskAssignees(state);
  return officers.find(({ id }) => id === planningView.officerId) || officers[0];
}

const timeRange = (block) => `${fromMin(block.start)}–${fromMin(block.end)}`;
const hours = (minutes) => fmtHours(minutes / 60);
const blockLabels = { meeting: 'Meeting', appointment: 'Repair appointment', 'fixed-task': 'Fixed task', lunch: 'Lunch break', task: 'Proposed task' };
const blockReasons = {
  meeting: 'Reserved for a fictional calendar meeting.',
  appointment: 'Reserved for a fictional repair appointment.',
  'fixed-task': 'Reserved at the fixed start entered on the task.',
  lunch: 'Reserved by the officer’s schedule preferences.',
};

function blockTitle(state, block) {
  return block.taskId && accessibleTask(state, block.taskId)
    ? html`<button type="button" class="task-link-btn" data-action="task-inspect" data-id="${block.taskId}">${block.title}</button>`
    : html`<strong>${block.title}</strong>`;
}

function renderDaily(state, day) {
  const lunch = day.lunch && !day.closed ? [{ ...day.lunch, kind: 'lunch', title: 'Lunch break' }] : [];
  const timeline = [...day.blocked, ...day.proposed, ...lunch].sort((a, b) => a.start - b.start || a.end - b.end);
  return html`
    <div class="smart-day-summary">
      <strong>${fmtLongDay(day.date)}</strong>
      ${day.overloaded ? html`<span class="tag tag-danger">Overloaded</span>` : ''}
      <span class="muted small">${hours(day.workloadMinutes)} total · ${hours(day.taskMinutes)} ${day.accepted ? 'accepted' : 'proposed'} tasks</span>
    </div>
    ${day.closed ? html`<p class="muted small">${day.closed}</p>` : ''}
    ${timeline.length ? html`
      <ul class="smart-timeline">
        ${timeline.map((block) => html`
          <li class="timeline-block ${block.kind === 'meeting' ? 'is-meeting' : block.kind === 'task' ? '' : 'is-protected'}">
            <span class="smart-time">${timeRange(block)}</span>
            <div class="smart-block-text">
              ${blockTitle(state, block)}
              ${block.location ? html`<div class="small muted">${block.location}</div>` : ''}
              ${blockReasons[block.kind] ? html`<details class="small muted"><summary>Why unavailable?</summary>${blockReasons[block.kind]}</details>` : ''}
            </div>
            <span class="tag ${block.kind === 'task' ? 'tag-success' : 'tag-brand'}">${day.accepted && block.kind === 'task' ? 'Accepted task' : blockLabels[block.kind]}</span>
          </li>`)}
      </ul>` : html`<p class="muted">This day has no protected or proposed blocks.</p>`}
    <details class="smart-availability">
      <summary>Remaining availability · ${hours(day.remainingMinutes)}</summary>
      ${day.remainingMinutes && day.slots.length
        ? html`<p class="small muted">Open gaps: ${day.slots.map(timeRange).join(', ')}. The daily hours limit may reduce usable time.</p>`
        : html`<p class="small muted">${day.closed || 'Protected commitments and planned work leave no usable capacity.'}</p>`}
    </details>
    ${day.warnings.length ? html`<div class="callout warn smart-warnings">
      ${icon('alert', 20)}<div><strong>Schedule conflicts</strong><ul>${day.warnings.map((warning) => html`<li>${warning}</li>`)}</ul></div>
    </div>` : ''}
  `;
}

function renderWeek(state, days) {
  return html`
    <div class="smart-week">
      ${days.map((day) => html`
        <article class="smart-week-day ${day.overloaded ? 'is-overloaded' : ''}">
          <h3><button class="task-link-btn" type="button" data-action="plan-open-day" data-date="${day.date}">${fmtDay(day.date)}</button></h3>
          <p class="small muted">${hours(day.workloadMinutes)} scheduled · ${hours(day.remainingMinutes)} available</p>
          ${day.accepted ? html`<span class="tag tag-success">Accepted</span>` : day.draft ? html`<span class="tag tag-brand">Draft</span>` : ''}
          ${day.overloaded ? html`<span class="tag tag-danger">Overloaded</span>` : ''}
          ${day.warnings.length ? html`<span class="tag tag-warning">${day.warnings.length} conflicts</span>` : ''}
          ${day.closed ? html`<p class="small muted">${day.closed}</p>` : ''}
          <ul>
            ${[...day.blocked, ...day.proposed].sort((a, b) => a.start - b.start).map((block) => html`
              <li><span class="small muted">${timeRange(block)} · ${day.accepted && block.kind === 'task' ? 'Accepted task' : blockLabels[block.kind]}</span>${blockTitle(state, block)}</li>`)}
          </ul>
        </article>`)}
    </div>
  `;
}

function renderUnscheduled(state, { unscheduled, openCount, dates, id, acceptedAt }) {
  return html`
    <section class="smart-unscheduled" aria-labelledby="unscheduled-${id}">
      <h3 id="unscheduled-${id}">Unscheduled tasks</h3>
      <p class="small muted">${acceptedAt ? 'Accepted' : 'Draft'} · ${scheduleRange(dates)}</p>
      ${unscheduled.length ? html`<ul>${unscheduled.map(({ task, deadline, duration, reason }) => html`
        <li>
          ${blockTitle(state, { taskId: task.id, title: task.title })}
          <span class="small muted">${task.priority} · ${duration} min${deadline.at ? ` · ${deadline.label} ${fmtDue(deadline.at)} SGT` : ''}</span>
          <p class="small">${reason}</p>
          ${accessibleTask(state, task.id) ? html`<button type="button" class="btn-secondary btn-sm" data-action="capture-edit" data-id="${task.id}" aria-label="Edit task: ${task.title}">Edit task</button>` : ''}
        </li>`)}</ul>
        ${planningView.mode === 'daily' ? html`<button type="button" class="btn-secondary btn-sm" data-action="plan-view" data-mode="weekly">View weekly capacity</button>` : ''}
      ` : html`<p class="muted small">${openCount ? 'All eligible tasks fit in this schedule.' : 'No open tasks to schedule.'}</p>`}
    </section>`;
}

export function renderSmartPlan(state, officer) {
  if (!officer) return html`<section class="panel"><p class="muted">No officers are available for planning.</p></section>`;
  const officers = taskAssignees(state);
  const dates = planningDates();
  const weekly = planningView.mode === 'weekly';
  const prefs = schedulePreferences(state, officer.id);
  const draft = visibleDraft(officer.id);
  const review = draft && reviewDraft(state, draft);
  const accepted = state.acceptedSchedules?.[officer.id] || {};
  const saved = [...new Map(dates.filter((date) => accepted[date] && !draft?.dates.includes(date))
    .map((date) => [accepted[date].id, accepted[date]])).values()];
  const needsReview = [...new Set(saved.flatMap((entry) => changedPlanningInputs(state, entry)))];
  const previews = buildSmartSchedule(state, officer.id,
    dates.filter((date) => !accepted[date] && !draft?.dates.includes(date)), { generate: false }).days;
  const days = dates.map((date) => {
    const proposed = draft?.days.find((day) => day.date === date);
    if (proposed) return { ...proposed, draft: true };
    if (accepted[date]) return { ...accepted[date].day, accepted: true };
    return previews.find((day) => day.date === date);
  });
  const total = days.reduce((sum, day) => sum + day.workloadMinutes, 0);
  const draftWarnings = draft?.days.flatMap((day) => day.warnings.map((message) => ({ date: day.date, message }))) || [];
  return html`
    <section class="panel smart-plan" aria-labelledby="smart-plan-h">
      <div class="panel-head">
        <div><h2 id="smart-plan-h" tabindex="-1">Schedule proposal</h2>
          <p class="small muted">Singapore time · Fictional calendar · ${hours(prefs.maxMinutes)} daily limit</p>
        </div>
        <div class="panel-tools">
          <button type="button" class="btn-secondary btn-sm" data-action="plan-preferences">Schedule preferences</button>
          <button type="button" class="btn-primary btn-sm" data-action="plan-generate">${review?.changed.length ? 'Regenerate Draft' : weekly ? 'Generate Weekly Plan' : 'Generate Daily Schedule'}</button>
        </div>
      </div>
      <div class="smart-plan-controls">
        <div class="filter-tabs" role="group" aria-label="Schedule view">
          ${[['daily', 'Daily'], ['weekly', 'Weekly']].map(([mode, label]) => html`
            <button type="button" class="filter-tab ${mode === planningView.mode ? 'active' : ''}"
              data-action="plan-view" data-mode="${mode}" aria-pressed="${mode === planningView.mode}">${label}</button>`)}
        </div>
        <div class="smart-date-controls">
          <button type="button" class="btn-secondary btn-sm" data-action="plan-shift" data-offset="-1" aria-label="Previous ${weekly ? 'week' : 'day'}">‹</button>
          <input type="date" class="capture-filter" value="${planningView.date}" aria-label="Schedule date" data-action="plan-date" />
          <button type="button" class="btn-secondary btn-sm" data-action="plan-shift" data-offset="1" aria-label="Next ${weekly ? 'week' : 'day'}">›</button>
          <button type="button" class="btn-ghost btn-sm" data-action="plan-today">Today</button>
        </div>
        ${officers.length > 1 ? html`<label class="small">Officer
          <select class="capture-filter" data-action="plan-officer">${officers.map((person) => html`
            <option value="${person.id}" ${person.id === officer.id ? 'selected' : ''}>${person.name}</option>`)}</select>
        </label>` : html`<span class="small muted">${officer.name}</span>`}
      </div>
      ${draft ? html`<div class="smart-day-summary">
        <span class="tag tag-brand">Draft</span><span>${scheduleRange(draft.dates)}</span>
        <button type="button" class="btn-primary btn-sm" data-action="plan-accept" ${review.changed.length || review.duplicates.length ? 'disabled' : ''}>Accept Schedule</button>
        <button type="button" class="btn-secondary btn-sm" data-action="plan-discard">Discard Draft</button>
      </div>
      ${review.changed.length ? html`<p role="status">Regenerate before accepting. Changed inputs: ${review.changed.join(', ')}.</p>` : ''}
      ${review.duplicates.length ? html`<p role="status">A proposed task is already accepted on ${review.duplicates.map(fmtLongDay).join(', ')}. Review those dates and replace the earlier allocation before accepting.</p>` : ''}
      ${draftWarnings.length && (weekly || draft.dates.length > 1) ? html`<details class="smart-warnings">
        <summary>${draftWarnings.length} conflict warnings across this draft</summary>
        <ul>${draftWarnings.map(({ date, message }) => html`<li>${fmtDay(date)} · ${message}</li>`)}</ul>
      </details>` : ''}
      <p class="small muted">Tasks are placed by the earliest recorded deadline. Manual priority breaks ties, and focus periods are preferred when a task fits.</p>` : ''}
      ${saved.length ? html`<div class="smart-day-summary"><span class="tag tag-success">Accepted</span>
        <span class="small">${days.filter((day) => day.accepted).map((day) => fmtDay(day.date)).join(', ')}</span>
        ${needsReview.length ? html`<span class="tag tag-warning">Needs review</span><span class="small">Changed inputs: ${needsReview.join(', ')}.</span>` : ''}
      </div>` : ''}
      ${!draft && !saved.length ? html`<p class="small muted">Protected commitments are shown below. Generate a proposal to place flexible tasks.</p>` : ''}
      ${weekly
        ? html`<div class="smart-day-summary"><strong>${fmtDay(dates[0])} – ${fmtDay(dates[6])}</strong><span class="small muted">${hours(total)} total scheduled workload</span></div>${renderWeek(state, days)}`
        : renderDaily(state, days[0])}
      ${[...(draft ? [draft] : []), ...saved].map((entry) => renderUnscheduled(state, entry))}
    </section>
  `;
}
