// My Team Page — Manager Team Workload, Capacity & Approval Queue
import { html, raw, icon, capacityBadge } from '../ui.js';
import {
  getTeams,
  getCurrentUser,
  getPendingApprovals,
  getApprovals,
  getOfficer,
  officerName,
  isOpen,
  update,
  decideApproval,
  logActivity,
} from '../state.js';
import { dayCapacity, assessRisk } from '../planner.js';
import { TODAY, fmtDue } from '../time.js';

const teamView = {
  q: '',
  expandedTeamId: 'team-1',
};

export default {
  render(s) {
    const user = getCurrentUser(s);
    const teams = getTeams(s);
    const pendingApprovals = getPendingApprovals(s);
    const allApprovals = getApprovals(s);

    const allMembers = teams.flatMap((t) => t.members || []);
    const activeTodayCount = s.officers.filter((o) => !o.availability?.[TODAY]).length;

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('team', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Operations Management & Team Workload</p>
          <h1>My Team <span class="hero-badge">Manager Portal</span></h1>
          <p>
            Monitor team capacity across operational zones, review pending schedule change requests, and rebalance tasks safely.
          </p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat">
            <strong>${teams.length}</strong>
            <span>Teams</span>
          </div>
          <div class="hero-stat">
            <strong>${allMembers.length}</strong>
            <span>Officers</span>
          </div>
          <div class="hero-stat">
            <strong>${activeTodayCount}</strong>
            <span>Active today</span>
          </div>
        </div>
      </header>

      <!-- Manager Approval Queue (PS 12i Signature Workflow) -->
      <section class="panel" aria-labelledby="approval-h">
        <div class="panel-head">
          <div>
            <h2 id="approval-h">Manager Approval Queue</h2>
            <p class="muted small">Authorised review for schedule adjustments and task reassignments.</p>
          </div>
          <span class="tag ${pendingApprovals.length ? 'tag-warning' : 'tag-neutral'}">
            ${pendingApprovals.length} pending decision
          </span>
        </div>

        ${pendingApprovals.length === 0
          ? html`<div class="empty">${icon('check', 20)}<p>Approval queue is clear. No pending officer requests.</p></div>`
          : html`
              <ul class="queue">
                ${pendingApprovals.map(
                  (a) => html`
                    <li style="padding: 16px 0;">
                      <div class="stat-icon" style="width: 40px; height: 40px; border-radius: 50%; background: var(--colorPaletteMarigoldBackground1); color: var(--colorPaletteMarigoldForeground2);">
                        ${icon('arrow', 18)}
                      </div>
                      <div class="queue-who">
                        <strong style="font-size: 1rem;">${a.taskTitle}</strong>
                        <span style="font-size: 0.875rem; margin-top: 2px;">
                          Requested by <strong>${a.requesterName}</strong> (${a.requestType.replace('_', ' ')})
                        </span>
                        <div style="margin-top: 8px; padding: 10px 14px; border-radius: 8px; background: var(--colorNeutralBackground2); font-size: 0.8125rem;">
                          <div><strong>Reason:</strong> ${a.reason}</div>
                          <div style="margin-top: 4px;"><strong>SLA Impact:</strong> ${a.slaImpact}</div>
                          <div style="margin-top: 4px;"><strong>Operational Impact:</strong> ${a.operationalImpact}</div>
                        </div>
                      </div>
                      <div class="queue-actions" style="flex-direction: column;">
                        <button type="button" class="btn-primary btn-sm" data-action="manager-approve" data-id="${a.id}">
                          Approve Change
                        </button>
                        <button type="button" class="btn-ghost btn-sm" data-action="manager-reject" data-id="${a.id}">
                          Decline Request
                        </button>
                      </div>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>

      <!-- Team Capacity & Workload Cards -->
      <section class="panel" aria-labelledby="teams-list-h">
        <div class="panel-head">
          <div>
            <h2 id="teams-list-h">Operational Teams Directory</h2>
            <p class="muted small">Capacity and real-time workload balance by zone.</p>
          </div>
        </div>

        <div class="teams-list">
          ${teams.map((team) => renderTeamCard(s, team))}
        </div>
      </section>

      <!-- Recent Decisions Audit Trail -->
      <section class="panel" aria-labelledby="history-h">
        <div class="panel-head">
          <h2 id="history-h">Recent Approval Decisions & Audit Records</h2>
        </div>
        <ul style="list-style: none; margin: 0; padding: 0; display: grid; gap: 8px;">
          ${allApprovals
            .filter((a) => a.status !== 'pending')
            .slice(0, 5)
            .map(
              (a) => html`
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; background: var(--colorNeutralBackground2);">
                  <div>
                    <strong>${a.taskTitle}</strong>
                    <span class="small muted" style="display: block;">
                      ${a.status === 'approved' ? 'Approved by' : 'Declined by'} ${a.decidedBy} · ${a.decision}
                    </span>
                  </div>
                  <span class="tag ${a.status === 'approved' ? 'tag-success' : 'tag-danger'}">
                    ${a.status.toUpperCase()}
                  </span>
                </li>
              `,
            )}
        </ul>
      </section>
    `;
  },
};

function renderTeamCard(s, team) {
  const isExpanded = teamView.expandedTeamId === team.id;
  const members = team.members || [];

  return html`
    <div class="team-card ${isExpanded ? 'is-expanded' : ''}">
      <div class="team-card-header" data-action="team-toggle-expand" data-team="${team.id}">
        <div class="team-card-main">
          <span class="team-card-icon" aria-hidden="true">${icon('team', 22)}</span>
          <div class="team-card-info">
            <div class="team-card-title-row">
              <h2>${team.name}</h2>
              <span class="tag tag-brand">Managed by Jennifer Ong</span>
              <span class="tag tag-neutral">${members.length} Officers</span>
            </div>
          </div>
        </div>
        <div class="team-card-controls">
          <button type="button" class="btn-subtle btn-sm">
            ${icon(isExpanded ? 'chevron-up' : 'chevron-down', 16)}
          </button>
        </div>
      </div>

      ${isExpanded
        ? html`
            <div class="team-card-content">
              ${members.map((m) => {
                const off = getOfficer(s, m.id) || { skills: ['inspection', 'resident'] };
                const cap = dayCapacity(s, m.id, TODAY) || { freeHours: 4.5 };
                const assigned = s.tasks.filter((t) => t.ownerId === m.id && isOpen(t));
                const away = off.availability?.[TODAY];

                return html`
                  <div class="team-section-box">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <div>
                        <strong>${m.displayName}</strong>
                        <span class="small muted" style="display: block;">${m.role}</span>
                      </div>
                      <span class="tag ${away ? 'tag-neutral' : 'tag-success'}">
                        ${away ? away.toUpperCase() : 'Available'}
                      </span>
                    </div>

                    <div style="margin-top: 10px; font-size: 0.8125rem;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Today's Capacity:</span>
                        <strong>${(cap.freeHours ?? 4.5).toFixed(1)}h free / 7.0h</strong>
                      </div>
                      <div style="display: flex; justify-content: space-between;">
                        <span>Open Tasks:</span>
                        <strong>${assigned.length} assigned</strong>
                      </div>
                    </div>

                    <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 4px;">
                      ${(off.skills || []).map((sk) => html`<span class="tag tag-neutral">${sk}</span>`)}
                    </div>

                    <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                      <button
                        type="button"
                        class="btn-secondary btn-sm"
                        data-action="reassign-to-officer"
                        data-officer="${m.id}"
                      >
                        Reassign task →
                      </button>
                    </div>
                  </div>
                `;
              })}
            </div>
          `
        : ''}
    </div>
  `;
}
