// People Page — Admin User Directory & Role Assignment (matches full-stack AdminPortal)
import { html, raw, icon } from '../ui.js';
import {
  getUsers,
  getCurrentUser,
  approveUser,
  setUserRole,
  setUserStatus,
} from '../state.js';

const peopleView = {
  q: '',
  filter: 'all',
};

export default {
  render(s) {
    const allUsers = getUsers(s);
    const pending = allUsers.filter((u) => u.status === 'pending');
    const active = allUsers.filter((u) => u.status === 'active');
    const managers = allUsers.filter((u) => u.role === 'manager' && u.status === 'active');

    const filtered = allUsers.filter((u) => {
      if (peopleView.filter !== 'all' && u.status !== peopleView.filter) return false;
      if (peopleView.q) {
        const q = peopleView.q.toLowerCase();
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('users', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Identity & Access Governance</p>
          <h1>People <span class="hero-badge">Admin Portal</span></h1>
          <p>
            Approve new Town Council officers, govern operational role permissions (Admin, Manager, Team Member), and configure access status.
          </p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat">
            <strong>${allUsers.length}</strong>
            <span>Total people</span>
          </div>
          <div class="hero-stat ${pending.length > 0 ? 'hero-stat-warn' : ''}">
            <strong>${pending.length}</strong>
            <span>Pending</span>
          </div>
          <div class="hero-stat">
            <strong>${active.length}</strong>
            <span>Active</span>
          </div>
          <div class="hero-stat">
            <strong>${managers.length}</strong>
            <span>Managers</span>
          </div>
        </div>
      </header>

      <section class="panel" aria-labelledby="people-table-h">
        <div class="panel-head">
          <h2 id="people-table-h">Officers & Administrators</h2>
        </div>

        <!-- Filter tabs & search -->
        <div class="toolbar-wrap">
          <div class="filter-tabs" role="group" aria-label="People filter">
            ${[
              ['all', 'All', allUsers.length],
              ['pending', 'Pending', pending.length],
              ['active', 'Active', active.length],
              ['disabled', 'Disabled', allUsers.filter((u) => u.status === 'disabled').length],
            ].map(
              ([key, label, count]) => html`
                <button
                  type="button"
                  class="filter-tab ${peopleView.filter === key ? 'active' : ''}"
                  data-action="people-filter"
                  data-filter="${key}"
                >
                  ${label} <span class="muted small">(${count})</span>
                </button>
              `,
            )}
          </div>

          <div class="search-input">
            ${icon('search', 16)}
            <input
              type="search"
              placeholder="Search by name, email..."
              value="${peopleView.q}"
              data-action="people-search"
              aria-label="Search people"
            />
          </div>
        </div>

        <!-- Table -->
        <div class="table-wrap">
          <table class="data-table people-table" aria-label="People directory">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role Assignment</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((u) => renderPersonRow(u))}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Roles explanation helper box matching full-stack AdminPortal -->
      <details class="roles-help panel" style="margin-top: 20px;">
        <summary style="font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          ${icon('info', 18)} Role permissions and access boundaries
        </summary>
        <div style="margin-top: 14px; display: grid; gap: 12px; font-size: 0.875rem;">
          <div>
            <strong>Admin:</strong> Approves people, assigns roles, creates teams and audits activity. Private officer calendar data is protected.
          </div>
          <div>
            <strong>Manager:</strong> Oversees team workload across operational zones, assesses capacity, and approves reassignments.
          </div>
          <div>
            <strong>Team Member:</strong> Sees their own tasks, daily plan, and simulated Outlook calendar & To Do. Cannot access manager or admin actions.
          </div>
        </div>
      </details>
    `;
  },
};

function renderPersonRow(u) {
  const isPending = u.status === 'pending';
  const isDisabled = u.status === 'disabled';

  return html`
    <tr>
      <td data-label="Person">
        <div class="people-person">
          <div class="account-avatar">
            ${u.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>${u.displayName}</strong>
            <span class="small muted" style="display: block;">${u.email}</span>
          </div>
        </div>
      </td>
      <td data-label="Role Assignment">
        <select
          class="filter-tab"
          style="border: 1px solid var(--colorNeutralStroke1); border-radius: 6px; padding: 4px 8px; font-size: 0.8125rem;"
          data-action="admin-change-role"
          data-id="${u.id}"
          ${isDisabled ? 'disabled' : ''}
        >
          <option value="member" ${u.role === 'member' ? 'selected' : ''}>Team Member</option>
          <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td data-label="Status">
        <span class="tag ${isPending ? 'tag-warning' : isDisabled ? 'tag-neutral' : 'tag-success'}">
          ${u.status.toUpperCase()}
        </span>
      </td>
      <td data-label="Actions" class="row-actions" style="text-align: right; white-space: nowrap;">
        ${isPending
          ? html`
              <button
                type="button"
                class="btn-primary btn-sm"
                data-action="admin-approve"
                data-id="${u.id}"
              >
                Approve
              </button>
            `
          : isDisabled
            ? html`
                <button
                  type="button"
                  class="btn-secondary btn-sm"
                  data-action="admin-restore"
                  data-id="${u.id}"
                >
                  Restore
                </button>
              `
            : html`
                <button
                  type="button"
                  class="btn-ghost btn-sm"
                  data-action="admin-disable"
                  data-id="${u.id}"
                >
                  Turn off
                </button>
              `}
      </td>
    </tr>
  `;
}
