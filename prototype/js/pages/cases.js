// Case Action Centre — Category C: Task Visibility & Operational Loose-End Intelligence
import { CASE_PRIORITY_ORDER, accessibleCase, tasksForCase, visibleCases } from '../cases.js';
import {
  getCases,
  getCase,
  detectLooseEnds,
  checkClosureReadiness,
  generateCaseBrief,
  closeCase,
  requestCaseReassignment,
  getTask,
  getTasks,
  officerName,
  isAdmin,
  isManager,
  isTeamMember,
  actorName,
} from '../state.js';
import { CAPTURE_STATUSES, taskDateInput } from '../taskCapture.js';
import { TODAY, fmtDue, fmtLongDay, fmtTime, timePart } from '../time.js';
import { emptyState, html, icon, priorityBadge, riskBadge, raw } from '../ui.js';

// Module view state
export const caseView = {
  activeTab: 'all', // 'all' | 'open' | 'radar' | 'blocked' | 'ready' | 'closed'
  viewMode: 'list', // 'list' | 'kanban'
  searchQuery: '',
  estateFilter: 'all',
  urgencyFilter: 'all',
  radarFilter: 'all',
  selectedCaseId: null,
  journeyTab: 'timeline', // 'timeline' | 'loose_ends' | 'readiness' | 'brief'
};

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
        <p class="page-hero-eyebrow">${record.number || record.caseNumber} · Fictional demo case</p>
        <h1>${record.title}</h1>
        <p>${record.description || record.summary || ''}</p>
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
  caseView,
  render(s, caseId) {
    if (caseId) {
      return caseDetails(s, caseId);
    }
    if (s.status !== 'active') {
      return renderRestrictedAccess(s);
    }
    if (isAdmin(s)) {
      return renderAdminGovernanceView(s);
    }
    return renderOperationalCaseActionCentre(s);
  },
};

function renderRestrictedAccess(s) {
  return html`
    <header class="page-hero">
      <span class="page-hero-icon" aria-hidden="true">${icon('lock', 28)}</span>
      <div class="page-hero-text">
        <p class="page-hero-eyebrow">Access Control</p>
        <h1>Case Action Centre <span class="hero-badge">Restricted</span></h1>
        <p>Operational case management is reserved for active Town Council officers and supervisors.</p>
      </div>
    </header>
    <div class="panel" style="margin-top: 24px; text-align: center; padding: 48px 20px;">
      <div style="font-size: 2.5rem; margin-bottom: 12px;">🔒</div>
      <h2>Account Status: ${s.status === 'pending' ? 'Pending Approval' : 'Disabled'}</h2>
      <p class="muted" style="max-width: 50ch; margin: 0 auto 20px;">
        ${s.status === 'pending'
          ? 'Your Microsoft Entra ID demo identity is awaiting Town Council administrator review.'
          : 'This operational demo account is currently disabled by administrative policy.'}
      </p>
      <button type="button" class="btn-primary" data-action="quick-switch-role" data-role="member">
        Switch to Active Officer (Aisyah)
      </button>
    </div>
  `;
}

function renderAdminGovernanceView(s) {
  const allCases = getCases(s);
  const totalOpen = allCases.filter((c) => c.status !== 'closed').length;
  const blockedCount = allCases.filter((c) => (c.blockers || []).some((b) => !b.resolved)).length;
  const readyCount = allCases.filter((c) => c.status === 'ready_for_closure').length;

  return html`
    <header class="page-hero">
      <span class="page-hero-icon" aria-hidden="true">${icon('cases', 28)}</span>
      <div class="page-hero-text">
        <p class="page-hero-eyebrow">Operational Governance</p>
        <h1>Case Action Centre <span class="hero-badge">Admin Summary</span></h1>
        <p>
          High-level operational metrics and case workflow governance. In accordance with Singapore Town Council data minimisation principles, administrative roles inspect compliance aggregates rather than confidential resident casework.
        </p>
      </div>
      <div class="page-hero-aside">
        <div class="hero-stat">
          <strong>${allCases.length}</strong>
          <span>Total cases</span>
        </div>
        <div class="hero-stat">
          <strong>${totalOpen}</strong>
          <span>Active cases</span>
        </div>
      </div>
    </header>

    <div class="stat-grid" style="margin: 20px 0;">
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('folder', 20)}</span>
        <span class="stat-label">Active Workflows</span>
        <strong class="stat-value">${totalOpen}</strong>
        <span class="stat-hint">Across Zones A, B and C</span>
      </div>
      <div class="stat-card ${blockedCount > 0 ? 'warn' : ''}">
        <span class="stat-icon" aria-hidden="true">${icon('alert', 20)}</span>
        <span class="stat-label">Blocked Workflows</span>
        <strong class="stat-value">${blockedCount}</strong>
        <span class="stat-hint">Awaiting specialist/contractor</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('check', 20)}</span>
        <span class="stat-label">Closure Approvals Pending</span>
        <strong class="stat-value">${readyCount}</strong>
        <span class="stat-hint">Ready for manager sign-off</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('shield', 20)}</span>
        <span class="stat-label">Data Minimisation Policy</span>
        <strong class="stat-value" style="font-size: 1.25rem; align-self: center; color: var(--colorPaletteGreenForeground1);">Active</strong>
        <span class="stat-hint">Resident casework isolated</span>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Case Action Centre Configuration</h2>
          <p class="muted small">Configured SLA thresholds and automated loose-end detection triggers</p>
        </div>
        <span class="tag tag-brand">Governance Mode</span>
      </div>
      <div class="table-wrap">
        <table class="data-table" aria-label="Detector Configuration">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Target Workstream</th>
              <th>Illustrative Trigger Threshold</th>
              <th>Resolution SLA</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Resident Follow-up Commitment</strong></td>
              <td>Tenant Feedback</td>
              <td>Follow-up promised but no call log recorded within 24h</td>
              <td>1 Working Day</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><strong>Contractor Confirmation</strong></td>
              <td>Estate Maintenance</td>
              <td>Work order issued with pending acknowledgment &gt; 48h</td>
              <td>2 Working Days</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><strong>Inspection Finding Completion</strong></td>
              <td>Lift &amp; Civil Inspection</td>
              <td>Site inspection block ended without outcome record</td>
              <td>Same Day (17:00)</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><strong>Stale Case Stalemate</strong></td>
              <td>All Categories</td>
              <td>Zero timeline activity recorded for &gt; 3 working days</td>
              <td>3 Working Days</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><strong>Mandatory Supporting Evidence</strong></td>
              <td>Town Council Compliance</td>
              <td>Repair complete but photo/defect doc unverified</td>
              <td>Prior to Closure</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderOperationalCaseActionCentre(s) {
  const cases = visibleCases(s);
  const mgr = isManager(s);
  const allCasesCount = cases.length;
  const openCases = cases.filter((c) => c.status !== 'closed');

  // Collect all loose ends across visible cases
  const allLooseEnds = [];
  cases.forEach((c) => {
    const ends = detectLooseEnds(s, c);
    ends.forEach((e) => allLooseEnds.push({ ...e, caseItem: c }));
  });

  const blockedCases = cases.filter((c) => (c.blockers || []).some((b) => !b.resolved));
  const readyCases = cases.filter((c) => c.status === 'ready_for_closure');

  // Apply filters
  const filteredCases = filterCases(s, cases);

  return html`
    <header class="page-hero">
      <span class="page-hero-icon" aria-hidden="true">${icon('cases', 28)}</span>
      <div class="page-hero-text">
        <p class="page-hero-eyebrow">Operational Loose-End Intelligence</p>
        <h1>Case Action Centre <span class="hero-badge">${mgr ? 'Manager Workspace' : 'Property Officer'}</span></h1>
        <p>
          Proactively detects unresolved resident follow-ups, pending contractor quotes, and missing inspection evidence before routine tasks slip through the cracks.
        </p>
      </div>
      <div class="page-hero-aside">
        <div class="hero-stat">
          <strong>${openCases.length}</strong>
          <span>Open cases</span>
        </div>
        <div class="hero-stat ${allLooseEnds.length > 0 ? 'hero-stat-warn' : ''}">
          <strong>${allLooseEnds.length}</strong>
          <span>Loose ends</span>
        </div>
        <div class="hero-stat">
          <strong>${blockedCases.length}</strong>
          <span>Blocked</span>
        </div>
      </div>
    </header>

    <!-- Operational Summary Bar -->
    <div class="stat-grid" style="margin: 20px 0;">
      <div class="stat-card ${allLooseEnds.length > 0 ? 'warn' : ''}">
        <span class="stat-icon" aria-hidden="true">${icon('radar', 20)}</span>
        <span class="stat-label">Follow-Up Radar</span>
        <strong class="stat-value">${allLooseEnds.length}</strong>
        <span class="stat-hint">${allLooseEnds.filter((l) => l.severity === 'critical').length} critical loose ends</span>
      </div>
      <div class="stat-card ${blockedCases.length > 0 ? 'warn' : ''}">
        <span class="stat-icon" aria-hidden="true">${icon('alert', 20)}</span>
        <span class="stat-label">Case Blockers</span>
        <strong class="stat-value">${blockedCases.length}</strong>
        <span class="stat-hint">${blockedCases.length > 0 ? 'Awaiting specialist/contractor' : 'No active blockers'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('check', 20)}</span>
        <span class="stat-label">Closure Warnings</span>
        <strong class="stat-value">${readyCases.length}</strong>
        <span class="stat-hint">${readyCases.length > 0 ? 'Ready for manager sign-off' : 'Checklists pending'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('sparkle', 20)}</span>
        <span class="stat-label">Cross-Workstream Links</span>
        <strong class="stat-value" style="font-size: 1.15rem; color: var(--colorBrandForeground1); align-self: center;">Smart Plan + Ripple</strong>
        <span class="stat-hint">Connected shared state</span>
      </div>
    </div>

    <!-- Section A: Follow-Up Radar (Signature Feature Banner) -->
    ${caseView.activeTab === 'radar' || allLooseEnds.length > 0 ? renderFollowUpRadar(s, allLooseEnds) : ''}

    <!-- Main Workspace Navigation & Toolbar -->
    <section class="panel" style="margin-top: 20px;" aria-labelledby="cases-h">
      <div class="panel-head" style="padding: 16px 20px 12px;">
        <div>
          <h2 id="cases-h">Operational cases</h2>
          <p class="muted small" style="margin: 2px 0 0;">Review estate issues, recorded deadlines, and the tasks needed to follow up.</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="tag tag-neutral">Fictional demo cases</span>
          <!-- List vs Kanban View Toggle -->
          <div class="view-toggle" role="group" aria-label="View layout">
            <button
              type="button"
              class="btn-icon ${caseView.viewMode === 'list' ? 'is-active' : ''}"
              data-action="case-view-mode"
              data-mode="list"
              title="Table / List View"
              aria-label="Table / List View"
            >
              ${icon('list', 16)}
            </button>
            <button
              type="button"
              class="btn-icon ${caseView.viewMode === 'kanban' ? 'is-active' : ''}"
              data-action="case-view-mode"
              data-mode="kanban"
              title="Kanban Board View"
              aria-label="Kanban Board View"
            >
              ${icon('columns', 16)}
            </button>
          </div>
        </div>
      </div>

      <div class="toolbar-wrap" style="padding: 12px 20px; border-bottom: 1px solid var(--colorNeutralStroke2); margin-bottom: 0;">
        <div class="filter-tabs" role="tablist" aria-label="Filter cases">
          ${[
            ['all', 'All Cases', allCasesCount],
            ['open', 'Open Cases', openCases.length],
            ['radar', 'Follow-Up Radar', allLooseEnds.length],
            ['blocked', 'Blocked', blockedCases.length],
            ['ready', 'Closure Ready', readyCases.length],
            ['closed', 'Closed', cases.filter((c) => c.status === 'closed' || c.status === 'Closed').length],
          ].map(
            ([tabKey, label, count]) => html`
              <button
                type="button"
                class="filter-tab ${caseView.activeTab === tabKey ? 'is-active' : ''}"
                data-action="case-tab"
                data-tab="${tabKey}"
                role="tab"
                aria-selected="${caseView.activeTab === tabKey ? 'true' : 'false'}"
              >
                ${label}
                <span class="tab-count">${count}</span>
              </button>
            `,
          )}
        </div>

        <div class="toolbar-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div class="search-input" style="min-width: 200px;">
            <span class="search-icon" aria-hidden="true">${icon('search', 16)}</span>
            <input
              type="search"
              id="case-search-input"
              placeholder="Search case #, title, estate..."
              value="${caseView.searchQuery}"
              aria-label="Search cases"
              data-action="case-search"
            />
          </div>

          <select
            id="case-estate-filter"
            class="filter-tab"
            data-action="case-filter-estate"
            style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-size: 0.8125rem; background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);"
            aria-label="Filter by estate"
          >
            <option value="all">All Estates & Blocks</option>
            <option value="Blk 211" ${caseView.estateFilter === 'Blk 211' ? 'selected' : ''}>Zone A — Blk 211</option>
            <option value="Blk 208" ${caseView.estateFilter === 'Blk 208' ? 'selected' : ''}>Zone A — Blk 208</option>
            <option value="Blk 214" ${caseView.estateFilter === 'Blk 214' ? 'selected' : ''}>Zone A — Blk 214</option>
            <option value="Blk 207" ${caseView.estateFilter === 'Blk 207' ? 'selected' : ''}>Zone A — Blk 207</option>
            <option value="Blk 310" ${caseView.estateFilter === 'Blk 310' ? 'selected' : ''}>Zone B — Blk 310</option>
            <option value="Blk 405" ${caseView.estateFilter === 'Blk 405' ? 'selected' : ''}>Zone C — Blk 405</option>
          </select>

          <select
            id="case-urgency-filter"
            class="filter-tab"
            data-action="case-filter-urgency"
            style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-size: 0.8125rem; background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);"
            aria-label="Filter by urgency"
          >
            <option value="all">All Urgencies</option>
            <option value="Critical" ${caseView.urgencyFilter === 'Critical' ? 'selected' : ''}>Critical Urgency</option>
            <option value="High" ${caseView.urgencyFilter === 'High' ? 'selected' : ''}>High Urgency</option>
            <option value="Medium" ${caseView.urgencyFilter === 'Medium' ? 'selected' : ''}>Medium Urgency</option>
          </select>

          ${caseView.searchQuery || caseView.estateFilter !== 'all' || caseView.urgencyFilter !== 'all'
            ? html`
                <button type="button" class="btn-subtle btn-sm" data-action="case-clear-filters">
                  Clear filters
                </button>
              `
            : ''}
        </div>
      </div>

      <!-- Workspace Body: List View vs Kanban View -->
      <div style="padding: 16px 20px;">
        ${filteredCases.length === 0
          ? emptyState('folder', 'No matching cases found', 'Try adjusting your search query, status tab, or estate filter.')
          : caseView.viewMode === 'kanban'
            ? renderCaseKanban(s, filteredCases)
            : renderCaseList(s, filteredCases)}
      </div>
    </section>

    <!-- EMS case prioritisation order panel -->
    <section class="panel" aria-labelledby="case-priority-h" style="margin-top: 20px;">
      <div class="panel-head"><h2 id="case-priority-h">EMS case prioritisation order</h2></div>
      <ol class="case-priority-order">${CASE_PRIORITY_ORDER.map((item) => html`<li>${item}</li>`)}</ol>
    </section>

    <!-- Case Journey Drawer / Modal -->
    ${caseView.selectedCaseId ? renderCaseJourneyModal(s, getCase(s, caseView.selectedCaseId)) : ''}
  `;
}

function filterCases(s, cases) {
  return cases.filter((c) => {
    // Tab filter
    if (caseView.activeTab === 'open' && (c.status === 'closed' || c.status === 'Closed')) return false;
    if (caseView.activeTab === 'blocked' && !(c.blockers || []).some((b) => !b.resolved)) return false;
    if (caseView.activeTab === 'ready' && c.status !== 'ready_for_closure') return false;
    if (caseView.activeTab === 'closed' && c.status !== 'closed' && c.status !== 'Closed') return false;
    if (caseView.activeTab === 'radar' && detectLooseEnds(s, c).length === 0) return false;

    // Estate filter
    if (caseView.estateFilter !== 'all') {
      const matchEstate = (c.estate || '').includes(caseView.estateFilter) || (c.location || '').includes(caseView.estateFilter);
      if (!matchEstate) return false;
    }

    // Urgency filter
    if (caseView.urgencyFilter !== 'all' && c.urgency !== caseView.urgencyFilter) {
      return false;
    }

    // Search query
    if (caseView.searchQuery) {
      const q = caseView.searchQuery.toLowerCase();
      const matchNumber = (c.number || c.caseNumber || c.id || '').toLowerCase().includes(q);
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchEstate = (c.estate || c.location || '').toLowerCase().includes(q);
      const matchResident = (c.resident?.name || '').toLowerCase().includes(q);
      if (!matchNumber && !matchTitle && !matchEstate && !matchResident) return false;
    }

    return true;
  });
}

function renderFollowUpRadar(s, allLooseEnds) {
  if (allLooseEnds.length === 0) {
    return html`
      <section class="panel radar-panel" aria-labelledby="radar-h" style="border-left: 4px solid var(--colorPaletteGreenBorderActive); margin-top: 20px;">
        <div class="panel-header" style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div class="panel-title-group" style="display: flex; align-items: center; gap: 12px;">
            <span class="panel-icon" style="background: var(--colorPaletteGreenBackground1); color: var(--colorPaletteGreenForeground1); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px;" aria-hidden="true">
              ${icon('check', 20)}
            </span>
            <div>
              <h2 id="radar-h" style="font-size: 1.0625rem; margin: 0;">Follow-Up Radar — Operational Loose-End Detector</h2>
              <p class="muted small" style="margin: 2px 0 0;">
                All operational commitments, resident follow-ups, and contractor quotes are fully on schedule.
              </p>
            </div>
          </div>
          <span class="tag tag-success">0 Loose Ends</span>
        </div>
      </section>
    `;
  }

  const criticalCount = allLooseEnds.filter((l) => l.severity === 'critical').length;

  return html`
    <section class="panel radar-panel" aria-labelledby="radar-h" style="border-left: 4px solid ${criticalCount > 0 ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; margin-top: 20px;">
      <div class="panel-header" style="padding: 14px 20px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div class="panel-title-group" style="display: flex; align-items: center; gap: 12px;">
          <span class="panel-icon" style="background: ${criticalCount > 0 ? 'var(--colorPaletteRedBackground1)' : 'var(--colorPaletteMarigoldBackground1)'}; color: ${criticalCount > 0 ? 'var(--colorPaletteRedForeground1)' : 'var(--colorPaletteMarigoldForeground2)'}; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px;" aria-hidden="true">
            ${icon('radar', 20)}
          </span>
          <div>
            <h2 id="radar-h" style="font-size: 1.0625rem; margin: 0;">Follow-Up Radar — Operational Loose-End Detector</h2>
            <p class="muted small" style="margin: 2px 0 0;">
              Deterministic intelligence highlighting unfulfilled promises, missing evidence, and unconfirmed tenant appointments before they escalate.
            </p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${criticalCount > 0 ? html`<span class="tag tag-danger">${criticalCount} Critical</span>` : ''}
          <span class="tag tag-warning">${allLooseEnds.length} Attention item${allLooseEnds.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div class="radar-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: 14px; padding: 16px 20px;">
        ${allLooseEnds.map((finding) => renderLooseEndCard(s, finding))}
      </div>
    </section>
  `;
}

function renderLooseEndCard(s, finding) {
  const c = finding.caseItem;
  const isCritical = finding.severity === 'critical';

  return html`
    <div class="loose-end-card ${isCritical ? 'is-critical' : ''}" style="border: 1px solid ${isCritical ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; border-left-width: 4px; border-radius: 8px; padding: 14px 16px; background: var(--colorNeutralBackground1); display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow4);">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span class="tag ${isCritical ? 'tag-danger' : 'tag-warning'} small" style="display: inline-flex; align-items: center; gap: 4px;">
          ${icon(isCritical ? 'alert' : 'clock', 12)} ${finding.title}
        </span>
        <button
          type="button"
          class="btn-ghost btn-sm"
          data-action="case-inspect"
          data-id="${c.id}"
          title="Inspect case journey"
          style="font-size: 0.75rem; padding: 2px 8px; font-weight: 700; color: var(--colorBrandForeground1); font-family: monospace;"
        >
          ${c.number || c.caseNumber || c.id} →
        </button>
      </div>

      <strong style="font-size: 0.9375rem; color: var(--colorNeutralForeground1); line-height: 1.35;">
        ${c.title}
      </strong>

      <p class="small muted" style="margin: 0; line-height: 1.45;">
        <strong>Why it matters:</strong> ${finding.explanation}
      </p>

      <div style="font-size: 0.75rem; color: var(--colorNeutralForeground3); background: var(--colorNeutralBackground2); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke3);">
        <strong>Source Evidence:</strong> ${finding.sourceEvidence}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke2); flex-wrap: wrap;">
        <span class="small" style="font-size: 0.75rem; color: var(--colorBrandForeground1); font-weight: 600;">
          💡 Next: ${finding.suggestedAction.length > 45 ? finding.suggestedAction.slice(0, 45) + '...' : finding.suggestedAction}
        </span>
        <button
          type="button"
          class="btn-subtle btn-sm"
          data-action="case-inspect"
          data-id="${c.id}"
          data-tab="loose_ends"
        >
          Take Action
        </button>
      </div>
    </div>
  `;
}

function renderCaseList(s, cases) {
  return html`
    <div class="table-wrap">
      <table class="data-table capture-table case-table" aria-labelledby="cases-h">
        <thead>
          <tr>
            <th scope="col" style="width: 250px;">Case # &amp; Title</th>
            <th scope="col" style="width: 130px;">Category</th>
            <th scope="col" style="width: 110px;">Status</th>
            <th scope="col" style="width: 140px;">Assigned Officer</th>
            <th scope="col" style="width: 180px;">Deadlines (SGT)</th>
            <th scope="col" style="width: 125px;">Loose Ends</th>
            <th scope="col" style="text-align: right; width: 150px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map((c) => {
            const ends = detectLooseEnds(s, c);
            const statusClass = c.status === 'closed' || c.status === 'Closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : 'tag-brand';

            return html`
              <tr>
                <td>
                  <span class="case-number" style="font-family: monospace; font-size: 0.75rem; font-weight: 700; color: var(--colorBrandForeground1);">${c.number || c.caseNumber || c.id}</span>
                  <a class="case-title" href="#cases/${c.id}" style="display: block; font-weight: 600; text-decoration: none; color: inherit; margin-top: 2px;">${c.title}</a>
                  ${c.location ? html`<span class="small muted" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 3px;">${icon('pin', 12)} ${c.location}</span>` : ''}
                </td>
                <td data-label="Category"><span class="tag tag-neutral small">${c.category}</span></td>
                <td data-label="Status"><span class="tag ${statusClass}">${c.status}</span></td>
                <td data-label="Assigned officer">${officerName(s, c.ownerId)}</td>
                <td data-label="Deadlines (SGT)">${recordedDeadlines(c)}</td>
                <td data-label="Loose Ends">
                  ${ends.length === 0
                    ? html`<span class="tag tag-success small" style="display: inline-flex; align-items: center; gap: 4px;">${icon('check', 12)} On Track</span>`
                    : html`<button type="button" class="tag tag-warning small" data-action="case-inspect" data-id="${c.id}" data-tab="loose_ends" style="cursor: pointer; border: 1px solid var(--colorPaletteMarigoldBorderActive); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">${icon('radar', 12)} ${ends.length} Alert${ends.length > 1 ? 's' : ''}</button>`}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button type="button" class="btn-subtle btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="timeline">
                    Journey
                  </button>
                  <button type="button" class="btn-primary btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="readiness">
                    Readiness
                  </button>
                </td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}

function renderCaseKanban(s, cases) {
  const columns = [
    { id: 'open', title: 'Open / Intake', filter: (c) => c.status === 'Open' || c.status === 'reported' },
    { id: 'in_progress', title: 'In Progress', filter: (c) => c.status === 'In progress' || c.status === 'in_progress' },
    { id: 'pending_external', title: 'Awaiting External / Blocked', filter: (c) => c.status === 'pending_external' || (c.blockers || []).some((b) => !b.resolved) },
    { id: 'ready_for_closure', title: 'Closure Ready', filter: (c) => c.status === 'ready_for_closure' },
    { id: 'closed', title: 'Closed & Audited', filter: (c) => c.status === 'closed' || c.status === 'Closed' },
  ];

  return html`
    <div class="kanban-board" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; overflow-x: auto; padding-bottom: 8px;">
      ${columns.map((col) => {
        const colCases = cases.filter(col.filter);
        return html`
          <div class="kanban-col" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 380px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--colorNeutralStroke3);">
              <strong style="font-size: 0.875rem;">${col.title}</strong>
              <span class="tag tag-neutral small">${colCases.length}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
              ${colCases.length === 0
                ? html`<div style="text-align: center; padding: 24px 8px; color: var(--colorNeutralForeground3); font-size: 0.8125rem;">No cases</div>`
                : colCases.map((c) => {
                    const ends = detectLooseEnds(s, c);
                    const isBlocked = (c.blockers || []).some((b) => !b.resolved);
                    return html`
                      <div class="kanban-case-card" style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke1); border-left: 4px solid ${ends.length > 0 ? 'var(--colorPaletteMarigoldBorderActive)' : isBlocked ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorBrandStroke1)'}; border-radius: 8px; padding: 12px; box-shadow: var(--shadow2); display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <span style="font-family: monospace; font-size: 0.75rem; font-weight: 700; color: var(--colorBrandForeground1);">${c.number || c.caseNumber || c.id}</span>
                          <span class="tag ${c.urgency === 'Critical' ? 'tag-danger' : 'tag-neutral'} small">${c.urgency || 'Standard'}</span>
                        </div>
                        <a href="#cases/${c.id}" style="font-size: 0.875rem; font-weight: 600; text-decoration: none; color: inherit; line-height: 1.35;">${c.title}</a>
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                          <span class="small muted" style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;">
                            ${icon('users', 12)} ${officerName(s, c.ownerId)}
                          </span>
                          ${c.location ? html`<span class="small muted" style="font-size: 0.75rem;">${c.location}</span>` : ''}
                        </div>
                        ${ends.length > 0 ? html`<span class="tag tag-warning small" style="align-self: flex-start; display: inline-flex; align-items: center; gap: 4px;">${icon('radar', 12)} ${ends.length} Loose End${ends.length > 1 ? 's' : ''}</span>` : ''}
                        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--colorNeutralStroke3);">
                          <button type="button" class="btn-subtle btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="timeline" style="font-size: 0.75rem; padding: 2px 8px;">Journey</button>
                          <button type="button" class="btn-primary btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="readiness" style="font-size: 0.75rem; padding: 2px 8px;">Readiness</button>
                        </div>
                      </div>
                    `;
                  })}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

function renderCaseJourneyModal(s, c) {
  if (!c) return '';
  const readiness = checkClosureReadiness(s, c);
  const looseEnds = detectLooseEnds(s, c);

  return html`
    <div class="modal-backdrop is-open" data-action="case-modal-close" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: flex-end;">
      <div
        class="drawer-panel"
        onclick="event.stopPropagation()"
        style="width: min(100%, 680px); height: 100%; background: var(--colorNeutralBackground1); display: flex; flex-direction: column; box-shadow: var(--shadow64); animation: slideInRight 0.25s cubic-bezier(0,0,0.2,1);"
        role="dialog"
        aria-label="Case details: ${c.title}"
      >
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: center; background: var(--colorNeutralBackground2);">
          <div>
            <span style="font-family: monospace; font-size: 0.8125rem; font-weight: 700; color: var(--colorBrandForeground1);">${c.number || c.caseNumber || c.id}</span>
            <h2 style="font-size: 1.125rem; margin: 4px 0 0;">${c.title}</h2>
          </div>
          <button type="button" class="btn-icon" data-action="case-modal-close" aria-label="Close drawer">
            ${icon('close', 20)}
          </button>
        </div>

        <div style="padding: 10px 24px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; gap: 8px; background: var(--colorNeutralBackground1);">
          ${[
            ['timeline', 'Timeline'],
            ['loose_ends', `Loose Ends (${looseEnds.length})`],
            ['readiness', `Closure Readiness (${readiness.isReady ? 'Ready' : 'Incomplete'})`],
            ['brief', 'AI Case Brief'],
          ].map(
            ([tabKey, label]) => html`
              <button
                type="button"
                class="filter-tab ${caseView.journeyTab === tabKey ? 'is-active' : ''}"
                data-action="case-journey-tab"
                data-tab="${tabKey}"
              >
                ${label}
              </button>
            `,
          )}
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 20px 24px;">
          ${caseView.journeyTab === 'timeline'
            ? renderJourneyTimelineTab(s, c)
            : caseView.journeyTab === 'loose_ends'
              ? renderJourneyLooseEndsTab(s, c, looseEnds)
              : caseView.journeyTab === 'readiness'
                ? renderJourneyReadinessTab(s, c, readiness)
                : renderJourneyBriefTab(s, c)}
        </div>

        <div style="padding: 16px 24px; border-top: 1px solid var(--colorNeutralStroke2); background: var(--colorNeutralBackground2); display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <button type="button" class="btn-secondary" data-action="case-reassign-dialog" data-case="${c.id}">
            ${icon('user-plus', 14)} Reassign Case
          </button>
          <div style="display: flex; gap: 8px;">
            <button
              type="button"
              class="btn-primary"
              data-action="case-close-action"
              data-case="${c.id}"
              ${c.status === 'closed' ? 'disabled' : ''}
            >
              ${c.status === 'closed' ? 'Case Closed' : 'Close Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderJourneyTimelineTab(s, c) {
  const events = c.timeline || [];
  return html`
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <p class="small muted" style="margin: 0;">Chronological history of inspections, resident contacts, and contractor updates.</p>
      ${events.length === 0
        ? html`<p class="muted">No timeline events recorded.</p>`
        : html`
            <div style="border-left: 2px solid var(--colorNeutralStroke2); margin-left: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 18px;">
              ${events.map((ev) => html`
                <div style="position: relative;">
                  <div style="position: absolute; left: -23px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--colorBrandForeground1); border: 2px solid #fff;"></div>
                  <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <strong style="font-size: 0.875rem;">${ev.title}</strong>
                    <span class="small muted">${ev.at || TODAY}</span>
                  </div>
                  <p class="small" style="margin: 4px 0 0; color: var(--colorNeutralForeground2);">${ev.summary}</p>
                  <span class="small muted" style="font-size: 0.75rem;">Source: ${ev.source || 'SyncAI'} · Officer: ${ev.actor || officerName(s, c.ownerId)}</span>
                </div>
              `)}
            </div>
          `}
    </div>
  `;
}

function renderJourneyLooseEndsTab(s, c, looseEnds) {
  return html`
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${looseEnds.length === 0
        ? html`
            <div class="callout" style="border: 1px solid var(--colorPaletteGreenBorderActive); background: var(--colorPaletteGreenBackground1); padding: 16px; border-radius: 8px;">
              <strong style="color: var(--colorPaletteGreenForeground1);">No unresolved loose ends detected!</strong>
              <p class="small" style="margin: 4px 0 0;">All resident follow-ups, contractor confirmations, and inspections are on track.</p>
            </div>
          `
        : looseEnds.map((l) => html`
            <div style="border: 1px solid var(--colorPaletteMarigoldBorderActive); border-left: 4px solid ${l.severity === 'critical' ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; border-radius: 8px; padding: 14px; background: var(--colorNeutralBackground2);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 0.9375rem;">${l.title}</strong>
                <span class="tag ${l.severity === 'critical' ? 'tag-danger' : 'tag-warning'} small">${l.severity}</span>
              </div>
              <p class="small muted" style="margin: 6px 0;">${l.explanation}</p>
              <div style="font-size: 0.75rem; color: var(--colorNeutralForeground3); margin-bottom: 6px;">
                <strong>Evidence:</strong> ${l.sourceEvidence}
              </div>
              <div class="small" style="background: var(--colorNeutralBackground1); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--colorNeutralStroke2); color: var(--colorBrandForeground1); font-weight: 500;">
                💡 <strong>Next step:</strong> ${l.suggestedAction}
              </div>
            </div>
          `)}
    </div>
  `;
}

function renderJourneyReadinessTab(s, c, readiness) {
  const checkpoints = c.checkpoints || [];
  const evidence = c.evidence || [];
  return html`
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="padding: 14px 16px; border-radius: 8px; border: 1px solid ${readiness.isReady ? 'var(--colorPaletteGreenBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; background: ${readiness.isReady ? 'var(--colorPaletteGreenBackground1)' : 'var(--colorPaletteMarigoldBackground1)'};">
        <strong style="color: ${readiness.isReady ? 'var(--colorPaletteGreenForeground1)' : 'var(--colorPaletteMarigoldForeground2)'}; display: flex; align-items: center; gap: 8px; font-size: 0.9375rem;">
          ${icon(readiness.isReady ? 'check' : 'alert', 18)}
          ${readiness.isReady ? 'All Checkpoints Satisfied — Ready for Closure' : 'Closure Incomplete — Requirements Outstanding'}
        </strong>
        <p class="small" style="margin: 6px 0 0; color: var(--colorNeutralForeground1);">
          ${readiness.isReady ? 'All statutory and operational requirements verified. Eligible for manager sign-off.' : `Blocked by ${readiness.unresolvedItems.length} requirement(s): ${readiness.unresolvedItems.join(', ')}.`}
        </p>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 0.9375rem; margin: 0;">Progress Checkpoints</h3>
          <span class="small muted">${checkpoints.filter((cp) => cp.completed).length} / ${checkpoints.length} complete</span>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 8px;">
          ${checkpoints.map((cp) => html`
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px; background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke3);">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; margin: 0;">
                <input
                  type="checkbox"
                  ${cp.completed ? 'checked' : ''}
                  data-action="case-toggle-checkpoint"
                  data-case="${c.id}"
                  data-cp="${cp.id}"
                  style="width: 16px; height: 16px; cursor: pointer;"
                />
                <span style="font-size: 0.875rem; ${cp.completed ? 'text-decoration: line-through; color: var(--colorNeutralForeground3);' : 'font-weight: 500;'}">
                  ${cp.title}
                </span>
              </label>
              <span class="tag ${cp.completed ? 'tag-success' : 'tag-neutral'} small">
                ${cp.completed ? 'Completed' : 'Pending'}
              </span>
            </li>
          `)}
        </ul>
      </div>

      ${evidence.length > 0
        ? html`
            <div>
              <h3 style="font-size: 0.9375rem; margin: 0 0 8px;">Evidence & Documentation</h3>
              <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 8px;">
                ${evidence.map((evi) => html`
                  <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke3);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: ${evi.verified ? 'var(--colorPaletteGreenForeground1)' : 'var(--colorPaletteRedForeground1)'};">
                        ${icon(evi.verified ? 'check' : 'alert', 16)}
                      </span>
                      <span style="font-size: 0.8125rem;">${evi.title}</span>
                    </div>
                    <span class="tag ${evi.verified ? 'tag-success' : 'tag-danger'} small">
                      ${evi.verified ? 'Verified' : 'Missing'}
                    </span>
                  </li>
                `)}
              </ul>
            </div>
          `
        : ''}
    </div>
  `;
}

function renderJourneyBriefTab(s, c) {
  const briefText = generateCaseBrief(s, c);
  return html`
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="small muted">Deterministic JavaScript Template</span>
        <button type="button" class="btn-secondary btn-sm" data-action="case-copy-brief" data-case="${c.id}">
          ${icon('copy', 14)} Copy Case Brief
        </button>
      </div>
      <pre id="case-brief-text" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 0.8125rem; line-height: 1.5; white-space: pre-wrap; margin: 0;">${briefText}</pre>
    </div>
  `;
}
