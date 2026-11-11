import { CASE_PRIORITY_ORDER, accessibleCase, tasksForCase, visibleCases } from '../cases.js';
import { officerName } from '../state.js';
import { CAPTURE_STATUSES, taskDateInput } from '../taskCapture.js';
import { fmtLongDay, fmtTime, timePart } from '../time.js';
import { emptyState, html, icon } from '../ui.js';

function recordedDeadlines(record) {
  const deadlines = [
    ['Response due', record.responseDue],
    ['Follow-up due', record.followUpDue],
  ].filter(([, value]) => value);
  if (!deadlines.length) return html`<span class="muted">No deadline recorded</span>`;
  return html`<dl class="case-deadlines">
    ${deadlines.map(([label, value]) => html`<div>
      <dt>${label}</dt>
      <dd><time datetime="${value}+08:00">${fmtLongDay(value)}, ${fmtTime(timePart(value))}</time></dd>
    </div>`)}
  </dl>`;
}

function caseList(state) {
  const cases = visibleCases(state);
  return html`
    <header class="page-hero">
      <span class="page-hero-icon" aria-hidden="true">${icon('folder', 28)}</span>
      <div class="page-hero-text">
        <h1>Cases</h1>
        <p>Review estate issues, recorded deadlines, and the tasks needed to follow up.</p>
      </div>
    </header>
    <section class="panel" aria-labelledby="cases-h">
      <div class="panel-head">
        <h2 id="cases-h">Operational cases</h2>
        <span class="tag tag-neutral">Fictional demo cases</span>
      </div>
      ${cases.length ? html`
        <div class="table-wrap">
          <table class="data-table capture-table case-table" aria-labelledby="cases-h">
            <thead><tr>
              <th scope="col">Case number and title</th><th scope="col">Category</th><th scope="col">Status</th>
              <th scope="col">Assigned officer</th><th scope="col">Deadlines (SGT)</th>
            </tr></thead>
            <tbody>${cases.map((record) => html`
              <tr>
                <td><span class="case-number">${record.number}</span>
                  <a class="case-title" href="#cases/${record.id}">${record.title}</a>
                </td>
                <td data-label="Category">${record.category}</td>
                <td data-label="Status"><span class="tag tag-brand">${record.status}</span></td>
                <td data-label="Assigned officer">${officerName(state, record.ownerId)}</td>
                <td data-label="Deadlines (SGT)">${recordedDeadlines(record)}</td>
              </tr>`)}
            </tbody>
          </table>
        </div>` : emptyState('folder', 'No cases assigned', 'Cases you can access will appear here.')}
    </section>
    <section class="panel" aria-labelledby="case-priority-h">
      <div class="panel-head"><h2 id="case-priority-h">EMS case prioritisation order</h2></div>
      <ol class="case-priority-order">${CASE_PRIORITY_ORDER.map((item) => html`<li>${item}</li>`)}</ol>
    </section>
  `;
}

function caseDetails(state, id) {
  const back = html`<a class="case-back" href="#cases">← Back to Cases</a>`;
  const record = accessibleCase(state, id);
  if (!record) return html`
    ${back}
    <section class="panel">${emptyState('folder', 'Case unavailable', 'Return to Cases to see the records you can access.')}</section>
  `;
  const tasks = tasksForCase(state, id);
  return html`
    ${back}
    <header class="page-hero">
      <span class="page-hero-icon" aria-hidden="true">${icon('folder', 28)}</span>
      <div class="page-hero-text">
        <p class="page-hero-eyebrow">${record.number} · Fictional demo case</p>
        <h1>${record.title}</h1>
        <p>${record.description}</p>
      </div>
    </header>
    <section class="panel" aria-labelledby="case-info-h">
      <div class="panel-head"><h2 id="case-info-h">Case information</h2></div>
      <dl class="case-facts">
        <div><dt>Category</dt><dd>${record.category}</dd></div>
        <div><dt>Status</dt><dd>${record.status}</dd></div>
        <div><dt>Assigned officer</dt><dd>${officerName(state, record.ownerId)}</dd></div>
        ${record.location ? html`<div><dt>Location</dt><dd>${record.location}</dd></div>` : ''}
        <div><dt>Deadlines (SGT)</dt><dd>${recordedDeadlines(record)}</dd></div>
      </dl>
    </section>
    <section class="panel" aria-labelledby="case-tasks-h">
      <div class="panel-head">
        <h2 id="case-tasks-h">Associated tasks</h2>
        <button type="button" class="btn-primary btn-sm" data-action="task-create-dialog" data-case-id="${record.id}">
          ${icon('plus', 14)} Add task
        </button>
      </div>
      ${tasks.length ? html`<ul class="case-task-list">
        ${tasks.map((task) => {
          const status = CAPTURE_STATUSES.find((entry) => entry.id === task.status)?.label || 'In review';
          const due = taskDateInput(task.dueAt || task.due);
          return html`<li>
            <div>
              <button type="button" class="task-link-btn" data-action="task-inspect" data-id="${task.id}">${task.title}</button>
              <div class="small muted">${officerName(state, task.ownerId)} · Due ${fmtLongDay(due)}, ${fmtTime(timePart(due))} SGT</div>
            </div>
            <span class="tag ${task.status === 'done' ? 'tag-success' : 'tag-neutral'}">${status}</span>
          </li>`;
        })}
      </ul>` : html`<p class="muted">No associated tasks are visible yet.</p>`}
    </section>
  `;
}

export default {
  render(state, caseId) {
    return caseId ? caseDetails(state, caseId) : caseList(state);
  },
};
