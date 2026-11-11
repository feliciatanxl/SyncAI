// Teams Admin Page — Team Creation & Member Allocation (matches full-stack TeamsAdmin)
import { html, raw, icon } from '../ui.js';
import {
  getTeams,
  getUsers,
  createTeam,
  addTeamMember,
  removeTeamMember,
} from '../state.js';

export default {
  render(s) {
    const teams = getTeams(s);
    const users = getUsers(s).filter((u) => u.status === 'active' && u.role === 'member');

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
  const members = team.members || [];
  const assignedIds = new Set(members.map((m) => m.id));
  const availableToAssign = eligibleUsers.filter((u) => !assignedIds.has(u.id));

  return html`
    <section class="panel team-card" aria-labelledby="team-${team.id}-h" style="padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div>
          <h2 id="team-${team.id}-h" style="font-size: 1.25rem; margin-bottom: 4px;">${team.name}</h2>
          <span class="tag tag-brand">Supervising Manager: Jennifer Ong</span>
        </div>
        <span class="tag tag-neutral">${members.length} Officers</span>
      </div>

      <div style="display: grid; gap: 8px;">
        <h3 style="font-size: 0.9375rem; color: var(--colorNeutralForeground2); margin: 0 0 6px;">Team Members</h3>
        ${members.length === 0
          ? html`<p class="muted small">No officers assigned to this team yet.</p>`
          : html`
              <ul style="list-style: none; margin: 0; padding: 0; display: grid; gap: 8px;">
                ${members.map(
                  (m) => html`
                    <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; background: var(--colorNeutralBackground2);">
                      <div>
                        <strong>${m.displayName}</strong>
                        <span class="small muted" style="display: block;">${m.email || m.role}</span>
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
      </div>

      <!-- Add member form -->
      <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--colorNeutralStroke3); display: flex; gap: 10px; align-items: center;">
        <label for="assign-select-${team.id}" class="small muted">Add officer:</label>
        <select id="assign-select-${team.id}" class="filter-tab" style="flex: 1; max-width: 280px; border: 1px solid var(--colorNeutralStroke1); border-radius: 6px;">
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
    </section>
  `;
}
