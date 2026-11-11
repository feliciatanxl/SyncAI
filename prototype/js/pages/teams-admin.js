// Teams Admin Page — Team Creation & Member Allocation (matches full-stack TeamsAdmin)
import { html, raw, icon } from '../ui.js';
import {
  getTeams,
  getUsers,
  createTeam,
  addTeamMember,
  removeTeamMember,
} from '../state.js';

export const teamsAdminView = {
  expandedIds: new Set(['team-1', 'team-2']),
};

export default {
  teamsAdminView,
  render(s) {
    const teams = getTeams(s);
    const users = getUsers(s).filter((u) => u.status === 'active' && u.role === 'member');
    const allExpanded = teams.length > 0 && teams.every((t) => teamsAdminView.expandedIds.has(t.id));

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('team', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Organisational Structure</p>
          <h1>Teams <span class="hero-badge">Admin Portal</span></h1>
          <p>
            Configure operational teams, assign supervising Estate Managers, and allocate officers to zones.
          </p>
        </div>
        <div class="page-hero-aside">
          <button type="button" class="btn-subtle btn-sm hero-button" data-action="admin-teams-toggle-all">
            ${allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
          <button type="button" class="btn-primary" data-action="admin-create-team-dialog">
            ${icon('plus', 16)} New Team
          </button>
        </div>
      </header>

      <div class="teams-list">
        ${teams.map((team) => renderAdminTeamCard(s, team, users))}
      </div>
    `;
  },
};

function renderAdminTeamCard(s, team, eligibleUsers) {
  const isExpanded = teamsAdminView.expandedIds.has(team.id);
  const members = team.members || [];
  const assignedIds = new Set(members.map((m) => m.id));
  const availableToAssign = eligibleUsers.filter((u) => !assignedIds.has(u.id));

  return html`
    <section class="team-card ${isExpanded ? 'is-expanded' : ''}" aria-labelledby="team-${team.id}-h" style="margin-bottom: 20px;">
      <div
        class="team-card-header"
        data-action="admin-team-toggle"
        data-team="${team.id}"
        role="button"
        tabindex="0"
        aria-expanded="${isExpanded ? 'true' : 'false'}"
        style="cursor: pointer;"
      >
        <div class="team-card-main">
          <span class="team-card-icon" aria-hidden="true">${icon('team', 22)}</span>
          <div class="team-card-info">
            <div class="team-card-title-row">
              <h2 id="team-${team.id}-h">${team.name}</h2>
              <span class="muted small">${members.length} Officers</span>
            </div>
            <div class="team-badges-row">
              <span class="team-badge is-manager">Supervising Manager: Jennifer Ong</span>
            </div>
          </div>
        </div>

        <div class="team-card-controls">
          <button
            type="button"
            class="btn-subtle btn-sm"
            data-action="admin-team-toggle"
            data-team="${team.id}"
            aria-label="${isExpanded ? 'Collapse team' : 'Expand team'}"
          >
            ${isExpanded ? icon('chevron-up', 18) : icon('chevron-down', 18)}
          </button>
        </div>
      </div>

      ${isExpanded
        ? html`
            <div class="team-card-content">
              <div class="team-section-box">
                <div class="team-section-header">
                  <h3>${icon('users', 16)} Team Members</h3>
                  <span class="team-section-count">${members.length}</span>
                </div>

                ${members.length === 0
                  ? html`<p class="muted small">No officers assigned to this team yet.</p>`
                  : html`
                      <ul class="team-members-list" style="list-style: none; margin: 0; padding: 0; display: grid; gap: 8px;">
                        ${members.map(
                          (m) => html`
                            <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke3);">
                              <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="account-avatar sm">${m.displayName.slice(0, 2).toUpperCase()}</div>
                                <div>
                                  <strong>${m.displayName}</strong>
                                  <span class="small muted" style="display: block;">${m.email || 'Property Officer'}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                class="btn-ghost btn-sm"
                                style="color: var(--colorPaletteRedForeground1);"
                                data-action="admin-remove-team-member"
                                data-team="${team.id}"
                                data-user="${m.id}"
                                title="Remove member from team"
                              >
                                Remove
                              </button>
                            </li>
                          `,
                        )}
                      </ul>
                    `}

                <!-- Add member form -->
                <div style="margin-top: 8px; padding-top: 14px; border-top: 1px solid var(--colorNeutralStroke2); display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                  <label for="assign-select-${team.id}" class="small muted" style="font-weight: 600;">Add officer:</label>
                  <select id="assign-select-${team.id}" class="filter-tab" style="flex: 1 1 200px; border: 1px solid var(--colorNeutralStroke1); border-radius: 6px; padding: 6px 10px; cursor: pointer;">
                    <option value="">Select an active officer...</option>
                    ${availableToAssign.map(
                      (u) => html`<option value="${u.id}">${u.displayName} (${u.email})</option>`,
                    )}
                  </select>
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    data-action="admin-add-team-member"
                    data-team="${team.id}"
                    data-select="assign-select-${team.id}"
                  >
                    Add to team
                  </button>
                </div>
              </div>
            </div>
          `
        : ''}
    </section>
  `;
}
