import { html, icon } from '../ui.js';
import { getApprovals } from '../state.js';
import { managerReviewType, MANAGER_REVIEW_TYPES } from './approval-governance.js';

export const auditTrailView = { requestType: 'all', action: 'all', actor: 'all', date: '', requestId: '', scopedRequestId: '', sortOrder: 'newest', includeNotifications: false };

export function parseAuditTrailRequestRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '');
  const match = /^audit-trail\/([^/]+)$/.exec(route);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

const ACTION_LABELS = {
  SUBMITTED: 'Request submitted',
  DISPATCHED: 'Notification dispatched',
  APPROVED: 'Request approved',
  REJECTED: 'Request rejected',
  ESCALATED: 'Request escalated',
  INFORMATION_REQUESTED: 'Manager requested additional information',
  INFORMATION_PROVIDED: 'Requester submitted additional information',
  VERSION_CREATED: 'Submission version recorded',
  ASSESSMENT_GENERATED: 'Assessment generated',
};

const ACTION_CATEGORIES = {
  SUBMITTED: 'Submission',
  DISPATCHED: 'Notification',
  APPROVED: 'Approval Decision',
  REJECTED: 'Rejection',
  ESCALATED: 'Escalation',
  INFORMATION_REQUESTED: 'Clarification',
  INFORMATION_PROVIDED: 'Clarification',
  VERSION_CREATED: 'Version',
  ASSESSMENT_GENERATED: 'Assessment',
};

function eventCategory(action) {
  const category = ACTION_CATEGORIES[action] || (String(action || '').startsWith('VERSION_')
    ? 'Version'
    : String(action || '').startsWith('ASSESSMENT_') || String(action || '').startsWith('AI_ASSESSMENT_')
      ? 'Assessment' : 'Other activity');
  const className = category.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  return { category, className };
}

function isNotificationEvent(action) {
  return action === 'DISPATCHED' || ACTION_CATEGORIES[action] === 'Notification';
}

export function auditActionLabel(action) {
  if (!action) return 'Recorded event';
  return ACTION_LABELS[action]
    || String(action).replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatAuditDate(value) {
  if (!value) return 'Timestamp not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
}

function singaporeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function collectApprovalAuditEvents(approvals) {
  const events = [];
  (Array.isArray(approvals) ? approvals : []).forEach((approval, approvalIndex) => {
    const type = managerReviewType(approval);
    if (!type || !Array.isArray(approval.auditTrail)) return;
    approval.auditTrail.forEach((event, eventIndex) => {
      events.push({
        approval,
        approvalIndex,
        event,
        eventIndex,
        requestTypeKey: type.key,
        requestTypeLabel: type.label,
      });
    });
  });
  return events.sort((left, right) => {
    const leftTime = left.event?.at ? Date.parse(left.event.at) : Number.NaN;
    const rightTime = right.event?.at ? Date.parse(right.event.at) : Number.NaN;
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime || left.approvalIndex - right.approvalIndex || left.eventIndex - right.eventIndex;
    if (Number.isFinite(leftTime)) return -1;
    if (Number.isFinite(rightTime)) return 1;
    return left.approvalIndex - right.approvalIndex || left.eventIndex - right.eventIndex;
  });
}

function renderEventCard(item) {
  const { approval, event } = item;
  const { category, className } = eventCategory(event?.action);
  const isRoutine = isNotificationEvent(event?.action);
  const actionClass = String(event?.action || 'unknown').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return html`<article class="audit-event-card audit-event-${className} audit-event-action-${actionClass}${isRoutine ? ' audit-event-routine' : ''}">
    <div class="audit-event-main">
      <div class="audit-event-heading">
        <span class="audit-event-marker" aria-hidden="true"></span>
        <button type="button" class="audit-event-title" data-action="audit-trail-open-request" data-id="${approval.id}">${auditActionLabel(event?.action)}</button>
        <span class="audit-event-category">${category}</span>
      </div>
      <time class="audit-event-time" datetime="${event?.at || ''}">${formatAuditDate(event?.at)}</time>
      ${event?.details ? html`<p class="audit-event-details">${event.details}</p>` : ''}
      <div class="audit-event-meta"><span><strong>Actor</strong> ${event?.actor || 'Not recorded'}</span><span><strong>Request type</strong> ${item.requestTypeLabel}</span></div>
    </div>
    <div class="audit-event-reference"><span class="small muted">Related approval</span><strong>${approval.id || 'Request ID not recorded'}</strong><button type="button" class="btn-secondary btn-sm" data-action="audit-trail-open-request" data-id="${approval.id}">Open request</button></div>
  </article>`;
}

export default {
  render(s) {
    const allEvents = collectApprovalAuditEvents(getApprovals(s));
    const eventTypes = [...new Set(allEvents.map(({ event }) => event?.action).filter(Boolean))].sort();
    const actors = [...new Set(allEvents.map(({ event }) => event?.actor).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const decisions = allEvents.filter(({ event }) => ['APPROVED', 'REJECTED'].includes(event?.action)).length;
    const submissions = allEvents.filter(({ event }) => event?.action === 'SUBMITTED').length;
    const clarifications = allEvents.filter(({ event }) => ['INFORMATION_REQUESTED', 'INFORMATION_PROVIDED'].includes(event?.action)).length;
    const query = auditTrailView.requestId.trim().toLowerCase();
    const filtered = allEvents.filter(({ approval, event, requestTypeKey }) => {
      if (auditTrailView.scopedRequestId && approval.id !== auditTrailView.scopedRequestId) return false;
      if (auditTrailView.requestType !== 'all' && requestTypeKey !== auditTrailView.requestType) return false;
      if (auditTrailView.action !== 'all' && event?.action !== auditTrailView.action) return false;
      if (auditTrailView.actor !== 'all' && event?.actor !== auditTrailView.actor) return false;
      if (auditTrailView.date && singaporeDate(event?.at) !== auditTrailView.date) return false;
      if (!auditTrailView.includeNotifications && auditTrailView.action !== event?.action && isNotificationEvent(event?.action)) return false;
      return !query || String(approval.id || '').toLowerCase().includes(query);
    }).sort((left, right) => {
      const leftTime = left.event?.at ? Date.parse(left.event.at) : Number.NaN;
      const rightTime = right.event?.at ? Date.parse(right.event.at) : Number.NaN;
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
        return (auditTrailView.sortOrder === 'oldest' ? leftTime - rightTime : rightTime - leftTime)
          || left.approvalIndex - right.approvalIndex || left.eventIndex - right.eventIndex;
      }
      if (Number.isFinite(leftTime)) return -1;
      if (Number.isFinite(rightTime)) return 1;
      return left.approvalIndex - right.approvalIndex || left.eventIndex - right.eventIndex;
    });
    const hiddenNotifications = !auditTrailView.includeNotifications
      ? allEvents.filter(({ event }) => isNotificationEvent(event?.action)).length
      : 0;
    const scopedApproval = auditTrailView.scopedRequestId
      ? getApprovals(s).find((approval) => approval.id === auditTrailView.scopedRequestId && managerReviewType(approval))
      : null;
    const scopedType = managerReviewType(scopedApproval);

    return html`<div class="audit-trail-page">
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('history', 28)}</span>
        <div class="page-hero-text"><p class="page-hero-eyebrow">Manager Portal</p><h1>Audit Trail</h1><p>Review recorded events across manager-review approval requests.</p></div>
        <div class="page-hero-aside">
          <div class="hero-stat"><strong>${allEvents.length}</strong><span>Total audit events</span></div>
          <div class="hero-stat"><strong>${decisions}</strong><span>Approval decisions</span></div>
          <div class="hero-stat"><strong>${submissions}</strong><span>Request submissions</span></div>
          <div class="hero-stat"><strong>${clarifications}</strong><span>Clarification activities</span></div>
        </div>
      </header>

      ${auditTrailView.scopedRequestId ? html`<section class="panel audit-trail-request-context" aria-label="Filtered approval request">
        <div><p class="page-hero-eyebrow">Filtered to one request</p><h2>${scopedApproval?.taskTitle || scopedApproval?.id || auditTrailView.scopedRequestId}</h2>
          <div class="audit-trail-context-meta"><span><strong>Request type</strong> ${scopedType?.label || 'Not available'}</span><span><strong>Request ID</strong> ${auditTrailView.scopedRequestId}</span><span><strong>Requester</strong> ${scopedApproval?.requesterName || scopedApproval?.requesterId || 'Not recorded'}</span></div>
        </div>
        <button type="button" class="btn-secondary btn-sm" data-action="audit-trail-clear-scope">Clear Filter / View All Events</button>
      </section>` : ''}

      <section class="panel audit-trail-filter-panel" aria-label="Filter audit events">
        <div class="audit-trail-filters">
          <label>Request type<select class="search-input" data-action="audit-trail-filter-type"><option value="all">All request types</option>${MANAGER_REVIEW_TYPES.map((type) => html`<option value="${type.key}" ${auditTrailView.requestType === type.key ? 'selected' : ''}>${type.label}</option>`)}</select></label>
          <label>Event type<select class="search-input" data-action="audit-trail-filter-action"><option value="all">All event types</option>${eventTypes.map((action) => html`<option value="${action}" ${auditTrailView.action === action ? 'selected' : ''}>${auditActionLabel(action)}</option>`)}</select></label>
          <label>Actor<select class="search-input" data-action="audit-trail-filter-actor"><option value="all">All actors</option>${actors.map((actor) => html`<option value="${actor}" ${auditTrailView.actor === actor ? 'selected' : ''}>${actor}</option>`)}</select></label>
          <label>Date<input class="search-input" type="date" data-action="audit-trail-filter-date" value="${auditTrailView.date}" /></label>
          <label>Approval request ID<input class="search-input" type="search" data-action="audit-trail-search" value="${auditTrailView.requestId}" placeholder="Search request ID" /></label>
        </div>
        <div class="audit-trail-options">
          <label class="audit-trail-checkbox"><input type="checkbox" data-action="audit-trail-toggle-notifications" ${auditTrailView.includeNotifications ? 'checked' : ''} /> Include routine system notifications (${allEvents.filter(({ event }) => isNotificationEvent(event?.action)).length})</label>
          <label class="audit-trail-sort">Sort order<select class="search-input" data-action="audit-trail-sort"><option value="newest" ${auditTrailView.sortOrder === 'newest' ? 'selected' : ''}>Newest first</option><option value="oldest" ${auditTrailView.sortOrder === 'oldest' ? 'selected' : ''}>Oldest first</option></select></label>
        </div>
      </section>

      <section class="panel" aria-labelledby="audit-trail-events-title">
        <div class="panel-head audit-trail-list-head"><div><h2 id="audit-trail-events-title">Recorded events</h2><p class="small muted">Newest events first, sorted by their stored timestamps. ${hiddenNotifications ? `${hiddenNotifications} routine notification events are hidden by default.` : 'Routine notification events are included when present.'}</p></div><span class="tag tag-neutral">${filtered.length} shown</span></div>
        ${filtered.length ? html`<div class="audit-event-list">${filtered.map(renderEventCard)}</div>` : html`<div class="empty">${icon('history', 20)}<p>No audit events match these filters.</p></div>`}
      </section>
    </div>`;
  },
};
