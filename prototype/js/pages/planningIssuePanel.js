import { blockTimes, canRequestScheduleChange, pendingScheduleRequest } from '../planningIssues.js';
import { accessibleTask } from '../taskCapture.js';
import { fmtDay, fmtDue, fmtWorkMinutes, toMin } from '../time.js';
import { html, icon } from '../ui.js';

const warningType = (issue) => ({
  'Unscheduled · deadline risk': 'Deadline risk',
  'Unscheduled task': 'Task could not fit',
  'Daily capacity': 'Over daily limit',
}[issue.kind] || issue.kind);

export function renderPlanningIssues(state, issues, days, { weekly, date, selectedDate, allDates, open }) {
  const selected = weekly ? (issues.some((issue) => !issue.blocking && issue.date === selectedDate) ? selectedDate : '') : allDates ? '' : date;
  if (!issues.length) return html`<p class="schedule-review-clear small muted">${icon('check', 16)} No scheduling issues detected.</p>`;
  const blocking = issues.filter((issue) => issue.blocking);
  const warnings = issues.filter((issue) => !issue.blocking);
  const shown = warnings.filter((issue) => !selected || issue.date === selected || (!weekly && !issue.date));
  const types = new Map();
  for (const issue of warnings) {
    const type = warningType(issue);
    types.set(type, (types.get(type) || 0) + 1);
  }
  const counts = [blocking.length ? `${blocking.length} blocking ${blocking.length === 1 ? 'conflict' : 'conflicts'}` : '',
    warnings.length ? `${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}` : ''].filter(Boolean).join(' · ');
  const renderCard = (issue) => {
    const task = issue.task && accessibleTask(state, issue.task.id);
    const pending = pendingScheduleRequest(state, issue);
    const selectedDay = days.find((day) => day.date === (issue.date || date));
    const issueType = warningType(issue);
    return html`<article class="loose-end-card schedule-issue ${issue.blocking ? 'is-critical' : ''}" data-issue-id="${issue.id}">
      <div class="radar-card-header">
        <div class="radar-card-top-row">
          <span class="tag ${issue.blocking ? 'tag-danger' : 'tag-warning'}">${icon(issue.blocking ? 'alert' : 'clock', 12)}
            ${issue.blocking ? 'Blocks acceptance' : issueType}</span>
          ${issue.date ? html`<time class="small muted" datetime="${issue.date}">${fmtDay(issue.date)}</time>` : ''}
        </div>
        <h3 class="radar-card-title">${issue.title}</h3>
        <div class="small muted">${[issue.blocking && issueType, issue.block && `${blockTimes(issue.block)} SGT`,
          issue.task?.priority && `${issue.task.priority} priority`, issue.task?.safety && 'Safety', issue.task?.statutory && 'Statutory'].filter(Boolean).join(' · ')}</div>
      </div>
      <p class="radar-card-explanation">${issue.message}</p>
      ${issue.duration ? html`<div class="radar-card-evidence">
        <span class="radar-evidence-label">Time needed</span>
        <span class="radar-evidence-value">${issue.duration} min${issue.deadline?.at ? ` · ${issue.deadline.label} ${fmtDue(issue.deadline.at)} SGT` : ''}</span>
      </div>` : ''}
      ${issue.blocking ? html`<p class="small muted">Review the task or commitment, then regenerate the draft.</p>` : ''}
      ${selectedDay ? html`<details class="schedule-issue-slots">
        <summary>Review available slots</summary>
        ${renderSlots(issue, selectedDay)}
      </details>` : ''}
      <div class="radar-card-actions schedule-issue-actions">
        ${task ? html`<button type="button" class="btn-primary btn-sm" data-action="capture-edit" data-id="${task.id}">Edit task</button>` : ''}
        ${!weekly ? html`<button type="button" class="${task ? 'btn-subtle' : 'btn-secondary'} btn-sm" data-action="plan-issue-week" data-date="${issue.date || date}">View weekly capacity</button>` : issue.date ? html`
          <button type="button" class="${task ? 'btn-subtle' : 'btn-secondary'} btn-sm" data-action="plan-open-day" data-date="${issue.date}">Open day</button>` : ''}
        ${pending ? html`<span class="tag tag-warning">Pending Approval</span>` : canRequestScheduleChange(state, issue) ? html`
          <button type="button" class="btn-subtle btn-sm" data-action="plan-issue-request" data-id="${issue.id}">Request Schedule Change</button>` : ''}
      </div>
    </article>`;
  };
  return html`<details class="radar-panel schedule-issue-panel ${blocking.length ? 'is-critical' : ''}" id="schedule-issue-panel" ${open || blocking.length ? 'open' : ''}>
    <summary class="radar-panel-header">
      <span class="radar-header-title-group">
        <span class="radar-header-icon ${blocking.length ? 'is-critical' : ''}">${icon('radar', 20)}</span>
        <span class="schedule-review-heading">
          <strong>Scheduling Review Required</strong>
          <span class="small muted">${counts}</span>
        </span>
      </span>
      <span class="schedule-review-toggle" aria-hidden="true">
        <span class="schedule-review-show">Review issues</span><span class="schedule-review-hide">Hide issues</span>
        ${icon('chevron-down', 16)}
      </span>
    </summary>
    ${types.size ? html`<ul class="schedule-warning-types small muted" aria-label="Warnings by type">
      ${[...types].map(([type, count]) => html`<li>${type} · ${count}</li>`)}
    </ul>` : ''}
    ${weekly && warnings.some((issue) => issue.date) ? html`<div class="filter-tabs radar-filter-tabs schedule-issue-days" role="group" aria-label="Filter warnings by day">
      ${['', ...new Set(warnings.map((issue) => issue.date).filter(Boolean).sort())].map((value) => html`
        <button type="button" class="filter-tab ${(selected || '') === value ? 'active' : ''}" data-action="plan-issue-day"
          data-date="${value}" aria-pressed="${(selected || '') === value}">${value ? fmtDay(value) : 'All warnings'}
          (${value ? warnings.filter((issue) => issue.date === value).length : warnings.length})</button>`)}
    </div>` : ''}
    ${selected && !shown.length && warnings.length ? html`<p class="schedule-review-empty muted small">No warnings for this day.</p>` : ''}
    ${blocking.length || shown.length ? html`<div class="radar-grid schedule-issue-list">
      ${[...blocking, ...shown.slice(0, 3)].map(renderCard)}
    </div>` : ''}
    ${shown.length > 3 ? html`<details class="schedule-more-warnings">
      <summary><span>View all warnings (${shown.length})</span><span>Show less</span></summary>
      <div class="radar-grid schedule-issue-list">${shown.slice(3).map(renderCard)}</div>
    </details>` : ''}
  </details>`;
}

function renderSlots(issue, day) {
  const slots = day.slots;
  const deadline = issue.deadline?.at;
  const lastMinute = deadline?.slice(0, 10) === day.date ? toMin(deadline.slice(11, 16))
    : deadline && deadline.slice(0, 10) < day.date ? 0 : 1440;
  const fitsTime = issue.duration <= day.remainingMinutes
    && slots.some(({ start, end }) => start + issue.duration <= Math.min(end, lastMinute));
  return html`
    <p class="small muted">Free calendar gaps: ${slots.length ? slots.map(blockTimes).join(', ') + ' SGT' : day.closed || 'None'}</p>
    <p class="small muted">Usable time under daily limit: ${fmtWorkMinutes(day.remainingMinutes)}</p>
    ${issue.duration ? html`<p class="small muted">This task needs ${fmtWorkMinutes(issue.duration)} in one block${deadline ? ` before its recorded ${issue.deadline.label.toLowerCase()}` : ''}.
      ${fitsTime ? 'A gap fits the duration and deadline. Review any other constraints above.' : 'No gap meets both the time needed and the daily limit within the deadline window.'}</p>` : ''}
  `;
}
