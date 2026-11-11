// Activity Log Page — Auditable Operational Records (matches full-stack ActivityLog)
import { html, raw, icon } from '../ui.js';
import { getState, getCurrentUser } from '../state.js';
import { TODAY, fmtDue } from '../time.js';

export const activityView = {
  filter: 'all',
  page: 1,
  pageSize: 8,
};

export default {
  render(s) {
    const activity = s.activity || [];
    const notifications = s.notifications || [];

    const totalPages = Math.max(1, Math.ceil(activity.length / activityView.pageSize));
    if (activityView.page > totalPages) activityView.page = totalPages;
    const startIndex = (activityView.page - 1) * activityView.pageSize;
    const paged = activity.slice(startIndex, startIndex + activityView.pageSize);

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('history', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Audit & Compliance Trail</p>
          <h1>Activity <span class="hero-badge">Audit Log</span></h1>
          <p>
            Immutable log of scheduling decisions, manager approvals, task reassignments, and simulated notification dispatches.
          </p>
        </div>
      </header>

      <section class="panel" aria-labelledby="activity-h">
        <div class="panel-head">
          <h2 id="activity-h">Operational Audit Records</h2>
          <span class="tag tag-neutral">${activity.length} recorded events</span>
        </div>

        <ol class="activity-list" aria-label="Activity timeline">
          ${paged.map((item, idx) => {
            const isApproval = item.text.includes('Approved') || item.text.includes('Declined');
            const isReassign = item.text.includes('reassign') || item.text.includes('schedule');
            const tone = isApproval ? 'tone-good' : isReassign ? 'tone-info' : '';

            return html`
              <li class="activity-item ${tone}">
                <span class="activity-icon" aria-hidden="true">
                  ${icon(isApproval ? 'check' : isReassign ? 'arrow' : 'sparkle', 16)}
                </span>
                <div class="activity-text">
                  <strong>${item.actor}</strong>
                  <span style="display: block; margin-top: 2px;">${item.text}</span>
                </div>
                <time datetime="${item.at}">${fmtDue(item.at)}</time>
              </li>
            `;
          })}
        </ol>

        <div class="pagination-bar" style="margin-top: 14px; border-radius: 8px;">
          <span class="pagination-info">
            Showing ${activity.length === 0 ? 0 : startIndex + 1}–${Math.min(startIndex + activityView.pageSize, activity.length)} of ${activity.length} records
          </span>
          ${totalPages > 1
            ? html`
                <div class="pagination-controls" role="navigation" aria-label="Activity pagination">
                  <button
                    type="button"
                    class="pagination-btn"
                    data-action="activity-page"
                    data-page="${activityView.page - 1}"
                    ${activityView.page <= 1 ? 'disabled' : ''}
                    aria-label="Previous page"
                  >
                    ‹ Prev
                  </button>
                  ${Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => html`
                      <button
                        type="button"
                        class="pagination-btn ${p === activityView.page ? 'active' : ''}"
                        data-action="activity-page"
                        data-page="${p}"
                        aria-current="${p === activityView.page ? 'page' : 'false'}"
                      >
                        ${p}
                      </button>
                    `,
                  )}
                  <button
                    type="button"
                    class="pagination-btn"
                    data-action="activity-page"
                    data-page="${activityView.page + 1}"
                    ${activityView.page >= totalPages ? 'disabled' : ''}
                    aria-label="Next page"
                  >
                    Next ›
                  </button>
                </div>
              `
            : ''}
        </div>

        <div class="privacy-note small muted" style="margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--colorNeutralStroke3); display: flex; gap: 8px;">
          ${icon('shield', 18)}
          <span>
            <strong>Data Protection & Privacy Notice:</strong> Medical information is never logged into operational audit records. Absences are recorded strictly as "MC" or "Leave" to protect officer confidentiality under Singapore PDPA standards.
          </span>
        </div>
      </section>
    `;
  },
};
