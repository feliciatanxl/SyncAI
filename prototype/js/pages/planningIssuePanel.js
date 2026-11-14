import { blockTimes, canRequestScheduleChange, pendingScheduleRequest } from '../planningIssues.js';
import { accessibleTask } from '../taskCapture.js';
import { fmtDay, fmtDue } from '../time.js';
import { html, icon } from '../ui.js';

export function renderPlanningIssues(state, issues, days, { weekly, date, selectedDate, open }) {
  const selected = weekly ? (issues.some((issue) => issue.date === selectedDate) ? selectedDate : '') : date;
  const shown = selected ? issues.filter((issue) => issue.date === selected || (!weekly && !issue.date)) : issues;
  if (!issues.length) return html`<p class="schedule-review-clear small muted">${icon('check', 16)} No scheduling issues detected.</p>`;
  const blocking = issues.filter((issue) => issue.blocking).length;
  const warnings = issues.length - blocking;
  const counts = [blocking ? `${blocking} blocking ${blocking === 1 ? 'conflict' : 'conflicts'}` : '',
    warnings ? `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : ''].filter(Boolean).join(' · ');
  return html`<details class="radar-panel schedule-issue-panel ${blocking ? 'is-critical' : ''}" id="schedule-issue-panel" ${open ? 'open' : ''}>
    <summary class="radar-panel-header">
      <span class="radar-header-title-group">
        <span class="radar-header-icon ${blocking ? 'is-critical' : ''}">${icon('radar', 20)}</span>
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
    ${weekly ? html`<div class="filter-tabs radar-filter-tabs schedule-issue-days" role="group" aria-label="Filter issues by day">
      ${['', ...new Set(issues.map((issue) => issue.date).filter(Boolean))].map((value) => html`
        <button type="button" class="filter-tab ${(selected || '') === value ? 'active' : ''}" data-action="plan-issue-day"
          data-date="${value}" aria-pressed="${(selected || '') === value}">${value ? fmtDay(value) : 'All issues'}
          (${value ? issues.filter((issue) => issue.date === value).length : issues.length})</button>`)}
    </div>` : ''}
    ${!shown.length ? html`<p class="schedule-review-empty muted small">No issues for this day. Open Weekly to review the full schedule.</p>` : ''}
    ${shown.length ? html`<div class="radar-grid schedule-issue-list">
      ${shown.map((issue) => {
        const task = issue.task && accessibleTask(state, issue.task.id);
        const pending = pendingScheduleRequest(state, issue);
        const selectedDay = days.find((day) => day.date === (issue.date || date));
        const issueType = issue.kind === 'Unscheduled · deadline risk' ? 'Task could miss deadline'
          : issue.kind === 'Unscheduled task' ? 'Task could not fit' : issue.kind;
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
      })}
    </div>` : ''}
  </details>`;
}

function renderSlots(issue, day) {
  const slots = day.remainingMinutes > 0 ? day.slots : [];
  return html`
    ${slots.length ? html`<p class="small muted">${slots.map(blockTimes).join(', ')} SGT · ${day.remainingMinutes} min remaining capacity.</p>` : ''}
    ${issue.duration ? html`<p class="small muted">This task needs ${issue.duration} continuous minutes${issue.deadline?.at ? ` before its recorded ${issue.deadline.label.toLowerCase()}` : ''}. ${slots.length ? 'These calendar gaps are for review.' : day.closed || 'No usable time remains on this day.'}</p>`
      : !slots.length ? html`<p class="small muted">${day.closed || 'Protected commitments, scheduled work or the daily limit leave no usable capacity.'}</p>` : ''}
  `;
}
