import { html, icon } from '../ui.js';
import { getApprovals, getCurrentUser, visibleTasks } from '../state.js';

export const myRequestsView = { typeFilter: 'all' };

function formatSubmittedAt(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
}

function renderRequest(approval) {
  const typeLabel = approval.requestType === 'operational_change' ? 'Operational Change' : 'Schedule Adjustment';
  return html`
    <li style="align-items: flex-start;">
      <div class="queue-who" style="min-width: 0;">
        <strong>${approval.taskTitle}</strong>
        <span class="small">${approval.id} · Task ${approval.taskId}${approval.caseId ? ` · Case ${approval.caseId}` : ''}</span>
        <span class="small">Request type: <strong>${typeLabel}</strong></span>
        <span class="small">Submitted ${formatSubmittedAt(approval.createdAt)}</span>
        ${approval.decision ? html`<p class="small"><strong>Manager decision:</strong> ${approval.decision}</p>` : ''}
      </div>
      <div class="queue-actions">
        <span class="tag ${approval.status === 'approved' ? 'tag-success' : approval.status === 'rejected' ? 'tag-danger' : 'tag-warning'}">${approval.status}</span>
        <button type="button" class="btn-secondary btn-sm" data-action="my-request-details" data-id="${approval.id}">View details</button>
      </div>
    </li>
  `;
}

function renderSection(title, status, requests) {
  return html`
    <section class="panel" aria-label="${title} requests">
      <div class="panel-head">
        <h2>${title}</h2>
        <span class="tag ${status === 'pending' ? 'tag-warning' : 'tag-neutral'}">${requests.length}</span>
      </div>
      ${requests.length ? html`<ul class="queue">${requests.map(renderRequest)}</ul>` : html`<p class="muted small">No ${title.toLowerCase()} requests.</p>`}
    </section>
  `;
}

export default {
  render(s) {
    const user = getCurrentUser(s);
    const myRequests = getApprovals(s)
      .filter((approval) => ['operational_change', 'schedule_adjustment'].includes(approval.requestType) && approval.requesterId === user.id)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const assignedTasks = visibleTasks(s).filter((task) => task.ownerId === user.id);
    const visibleRequests = myRequestsView.typeFilter === 'all'
      ? myRequests
      : myRequests.filter((approval) => approval.requestType === myRequestsView.typeFilter);
    const pending = visibleRequests.filter((approval) => approval.status === 'pending');
    const approved = visibleRequests.filter((approval) => approval.status === 'approved');
    const rejected = visibleRequests.filter((approval) => approval.status === 'rejected');

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('history', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Your approval requests</p>
          <h1>My Requests</h1>
          <p>Submit and track operational-change and schedule-adjustment requests.</p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat"><strong>${pending.length}</strong><span>Pending</span></div>
          <div class="hero-stat"><strong>${approved.length}</strong><span>Approved</span></div>
          <div class="hero-stat"><strong>${rejected.length}</strong><span>Rejected</span></div>
        </div>
      </header>

      <nav class="panel" aria-label="Filter requests by type" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <strong class="small">Request type</strong>
        <button type="button" class="${myRequestsView.typeFilter === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="my-requests-type-filter" data-type="all" aria-pressed="${myRequestsView.typeFilter === 'all'}">All Requests</button>
        <button type="button" class="${myRequestsView.typeFilter === 'operational_change' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="my-requests-type-filter" data-type="operational_change" aria-pressed="${myRequestsView.typeFilter === 'operational_change'}">Operational Changes</button>
        <button type="button" class="${myRequestsView.typeFilter === 'schedule_adjustment' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="my-requests-type-filter" data-type="schedule_adjustment" aria-pressed="${myRequestsView.typeFilter === 'schedule_adjustment'}">Schedule Changes</button>
      </nav>

      <section class="panel" aria-labelledby="submit-approval-request-title">
        <div class="panel-head">
          <div>
            <h2 id="submit-approval-request-title">Submit an approval request</h2>
            <p class="muted small">Choose one of your assigned tasks. The request will be linked to that task and any related case.</p>
          </div>
        </div>
        ${assignedTasks.length ? html`
          <form id="my-requests-task-form" style="display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;">
            <label class="small" for="my-requests-task-id" style="display: grid; gap: 5px; min-width: min(100%, 320px);">
              Operational task
              <select class="search-input" id="my-requests-task-id" name="taskId" required>
                <option value="">Select an assigned task</option>
                ${assignedTasks.map((task) => html`<option value="${task.id}">${task.id} · ${task.title}</option>`)}
              </select>
            </label>
            <button type="button" class="btn-primary" data-action="task-request-approval">Submit Approval Request</button>
          </form>
        ` : html`<p class="muted small">You have no assigned operational tasks available for an approval request.</p>`}
      </section>

      ${renderSection('Pending', 'pending', pending)}
      ${renderSection('Approved', 'approved', approved)}
      ${renderSection('Rejected', 'rejected', rejected)}
    `;
  },
};
