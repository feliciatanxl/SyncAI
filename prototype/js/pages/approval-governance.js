import { html, icon } from '../ui.js';
import { getApprovals } from '../state.js';

export const approvalGovernanceView = { typeFilter: 'all', statusFilter: 'all' };

export const MANAGER_REVIEW_TYPES = [
  { key: 'operational_change', label: 'Operational Change', requestTypes: ['operational_change'] },
  { key: 'schedule_adjustment', label: 'Schedule Adjustment', requestTypes: ['schedule_adjustment'] },
  { key: 'case_reassignment', label: 'Case Reassignment', requestTypes: ['reassign', 'reassignment'] },
  { key: 'case_closure', label: 'Case Closure', requestTypes: ['case_closure', 'closure'] },
];

export function managerReviewType(approval) {
  return MANAGER_REVIEW_TYPES.find((type) => type.requestTypes.includes(approval?.requestType)) || null;
}

export function isManagerReviewApproval(approval) {
  return !!managerReviewType(approval);
}

function formatSubmittedAt(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
}

function renderRequest(approval) {
  const type = managerReviewType(approval);
  const related = [
    approval.taskId ? `Task ${approval.taskId}${approval.taskTitle ? ` · ${approval.taskTitle}` : ''}` : '',
    approval.caseId ? `Case ${approval.caseId}` : '',
  ].filter(Boolean).join(' · ') || 'No task or case reference recorded';
  return html`
    <li style="align-items: flex-start;">
      <div class="queue-who" style="min-width: 0;">
        <strong>${approval.taskTitle || approval.id}</strong>
        <span class="small">Request ID: ${approval.id}</span>
        <span class="small">Request type: <strong>${type.label}</strong></span>
        <span class="small">Requester: ${approval.requesterName || 'Not recorded'}</span>
        <span class="small">${related}</span>
        <span class="small">Submitted: ${formatSubmittedAt(approval.createdAt)}</span>
      </div>
      <div class="queue-actions">
        <span class="tag ${approval.status === 'approved' ? 'tag-success' : approval.status === 'rejected' ? 'tag-danger' : 'tag-warning'}">${approval.status ? approval.status[0].toUpperCase() + approval.status.slice(1) : 'Unknown'}</span>
        <button type="button" class="btn-secondary btn-sm" data-action="manager-governance-review" data-id="${approval.id}">View Details</button>
      </div>
    </li>
  `;
}

export default {
  render(s) {
    const managerRequests = getApprovals(s).filter(isManagerReviewApproval);
    const scopedRequests = approvalGovernanceView.typeFilter === 'all'
      ? managerRequests
      : managerRequests.filter((approval) => managerReviewType(approval)?.key === approvalGovernanceView.typeFilter);
    const displayedRequests = approvalGovernanceView.statusFilter === 'all'
      ? scopedRequests
      : scopedRequests.filter((approval) => approval.status === approvalGovernanceView.statusFilter);
    const pending = displayedRequests.filter((approval) => approval.status === 'pending');
    const approved = displayedRequests.filter((approval) => approval.status === 'approved');
    const rejected = displayedRequests.filter((approval) => approval.status === 'rejected');

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('shield', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Manager Portal</p>
          <h1>Approval Governance</h1>
          <p>Review and manage requests requiring managerial authorisation.</p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat"><strong>${displayedRequests.length}</strong><span>Total Requests</span></div>
          <div class="hero-stat"><strong>${pending.length}</strong><span>Pending</span></div>
          <div class="hero-stat"><strong>${approved.length}</strong><span>Approved</span></div>
          <div class="hero-stat"><strong>${rejected.length}</strong><span>Rejected</span></div>
        </div>
      </header>

      <section class="panel" aria-label="Filter requests by type">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong class="small">Request type</strong>
          <button type="button" class="${approvalGovernanceView.typeFilter === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="manager-governance-type-filter" data-type="all" aria-pressed="${approvalGovernanceView.typeFilter === 'all'}">All Requests</button>
          ${MANAGER_REVIEW_TYPES.map((type) => html`<button type="button" class="${approvalGovernanceView.typeFilter === type.key ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="manager-governance-type-filter" data-type="${type.key}" aria-pressed="${approvalGovernanceView.typeFilter === type.key}">${type.label}</button>`)}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
          <strong class="small">Status</strong>
          ${['all', 'pending', 'approved', 'rejected'].map((status) => html`<button type="button" class="${approvalGovernanceView.statusFilter === status ? 'btn-primary' : 'btn-ghost'} btn-sm" data-action="manager-governance-status-filter" data-status="${status}" aria-pressed="${approvalGovernanceView.statusFilter === status}">${status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}</button>`)}
        </div>
      </section>

      <section class="panel" aria-labelledby="manager-approval-requests-title">
        <div class="panel-head">
          <div>
            <h2 id="manager-approval-requests-title">Manager review requests</h2>
            <p class="muted small">Review the existing request record before recording a decision.</p>
          </div>
          <span class="tag ${displayedRequests.length ? 'tag-warning' : 'tag-neutral'}">${displayedRequests.length} shown</span>
        </div>
        ${displayedRequests.length ? html`<ul class="queue">${displayedRequests.map(renderRequest)}</ul>` : html`<div class="empty">${icon('check', 20)}<p>No requests match these filters.</p></div>`}
      </section>
    `;
  },
};
