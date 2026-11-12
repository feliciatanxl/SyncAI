// Case Action Centre V2 — Category C: Task Visibility, Operational Loose-End Intelligence & Communications
import { CASE_PRIORITY_ORDER, KANBAN_COLUMNS, accessibleCase, getCaseKanbanColumn, tasksForCase, visibleCases } from '../cases.js';
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
  getCommunications,
  addCommunication,
  acknowledgeCommunication,
  generateDraftReply,
  extractTaskDraftFromMessage,
  getExplanationForFinding,
  getVisibleNotifications,
  getUnreadNotifications,
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
  radarFilter: 'all', // 'all' | 'critical' | 'resident' | 'contractor'
  selectedCaseId: null,
  journeyTab: 'timeline', // 'timeline' | 'loose_ends' | 'blockers' | 'readiness' | 'communications' | 'brief'
  activeExplanationRuleId: null, // when viewing an Evidence-Linked Explanation
  highlightedSourceId: null, // ID of source record to highlight
  commChannelFilter: 'all', // 'all' | 'in_app' | 'whatsapp' | 'teams' | 'telegram'
  extractedTaskDraft: null, // draft extracted from fictional message
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
              <th>Rule Code</th>
              <th>Rule Name</th>
              <th>Target Workstream</th>
              <th>Illustrative Trigger Threshold</th>
              <th>Resolution SLA</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>EMS-LE-01</code></td>
              <td><strong>Resident Follow-up Commitment</strong></td>
              <td>Resident Feedback</td>
              <td>Follow-up promised but no contact recorded within 24h</td>
              <td>1 Working Day</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><code>EMS-LE-02</code></td>
              <td><strong>Contractor Confirmation</strong></td>
              <td>Estate Maintenance</td>
              <td>Work order issued with pending quotation &gt; 24h</td>
              <td>24 Hours</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><code>EMS-LE-03</code></td>
              <td><strong>Inspection Finding Completion</strong></td>
              <td>Lift &amp; Civil Safety</td>
              <td>Site inspection ended without outcome report uploaded</td>
              <td>4 Hours</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><code>EMS-LE-04</code></td>
              <td><strong>Stale Case Stalemate</strong></td>
              <td>All Categories</td>
              <td>Zero timeline activity recorded for &gt; 48 hours</td>
              <td>48 Hours</td>
              <td><span class="tag tag-success">Active Rule</span></td>
            </tr>
            <tr>
              <td><code>EMS-LE-05</code></td>
              <td><strong>Mandatory Supporting Evidence</strong></td>
              <td>Town Council Compliance</td>
              <td>Closure requested but required photo/defect doc unverified</td>
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
  const openCases = cases.filter((c) => c.status !== 'closed' && c.status !== 'Closed');

  // Collect all loose ends across visible cases
  const allLooseEnds = [];
  cases.forEach((c) => {
    const ends = detectLooseEnds(s, c);
    ends.forEach((e) => allLooseEnds.push({ ...e, caseItem: c }));
  });

  const blockedCases = cases.filter((c) => (c.blockers || []).some((b) => !b.resolved) || c.status === 'pending_external');
  const readyCases = cases.filter((c) => c.status === 'ready_for_closure');
  const criticalLooseEnds = allLooseEnds.filter((l) => l.severity === 'critical');
  const unreadNotifs = getUnreadNotifications(s);

  // Apply filters
  const filteredCases = filterCases(s, cases);

  return html`
    <!-- Section A: Page Header with Gradient Hero -->
    <header class="page-hero">
      <span class="page-hero-icon" aria-hidden="true">${icon('cases', 28)}</span>
      <div class="page-hero-text">
        <p class="page-hero-eyebrow">Category C · Task Visibility &amp; Operational Intelligence</p>
        <h1>
          Case Action Centre
          <span class="hero-badge">${mgr ? 'Manager Workspace' : 'Property Officer Workspace'}</span>
          <span class="tag tag-neutral" style="margin-left: 8px; font-size: 0.75rem; vertical-align: middle;">Fictional Demo Environment</span>
        </h1>
        <p>
          Proactively detects unresolved resident follow-ups, pending contractor quotes, and missing inspection evidence before routine tasks slip through the cracks.
        </p>
      </div>
    </header>

    <!-- Section B: Operational Overview — 4 Equal-Width Metric Cards -->
    <div class="stat-grid case-overview-grid" style="margin: 20px 0;">
      <button
        type="button"
        class="stat-card stat-card-interactive ${caseView.activeTab === 'open' ? 'is-selected' : ''}"
        data-action="case-tab"
        data-tab="open"
        aria-label="Filter to open cases"
      >
        <span class="stat-icon" aria-hidden="true">${icon('folder', 20)}</span>
        <span class="stat-label">Open Cases</span>
        <strong class="stat-value">${openCases.length}</strong>
        <span class="stat-hint">Active estate workflows</span>
      </button>

      <button
        type="button"
        class="stat-card stat-card-interactive ${allLooseEnds.length > 0 ? 'warn' : ''} ${caseView.activeTab === 'radar' ? 'is-selected' : ''}"
        data-action="case-tab"
        data-tab="radar"
        aria-label="Filter to outstanding follow-ups"
      >
        <span class="stat-icon" aria-hidden="true">${icon('radar', 20)}</span>
        <span class="stat-label">Outstanding Follow-Ups</span>
        <strong class="stat-value">${allLooseEnds.length}</strong>
        <span class="stat-hint">${criticalLooseEnds.length} critical attention item${criticalLooseEnds.length === 1 ? '' : 's'}</span>
      </button>

      <button
        type="button"
        class="stat-card stat-card-interactive ${blockedCases.length > 0 ? 'warn' : ''} ${caseView.activeTab === 'blocked' ? 'is-selected' : ''}"
        data-action="case-tab"
        data-tab="blocked"
        aria-label="Filter to blocked cases"
      >
        <span class="stat-icon" aria-hidden="true">${icon('alert', 20)}</span>
        <span class="stat-label">Blocked Cases</span>
        <strong class="stat-value">${blockedCases.length}</strong>
        <span class="stat-hint">${blockedCases.length > 0 ? 'Awaiting external / contractor' : 'All workflows unblocked'}</span>
      </button>

      <button
        type="button"
        class="stat-card stat-card-interactive ${caseView.activeTab === 'ready' ? 'is-selected' : ''}"
        data-action="case-tab"
        data-tab="ready"
        aria-label="Filter to closure ready cases"
      >
        <span class="stat-icon" aria-hidden="true">${icon('check', 20)}</span>
        <span class="stat-label">Ready to Close?</span>
        <strong class="stat-value">${readyCases.length}</strong>
        <span class="stat-hint">${readyCases.length > 0 ? 'Ready for manager sign-off' : 'Checklists in progress'}</span>
      </button>
    </div>

    <!-- Section C: Follow-Up Radar — Signature Operational Loose-End Detector -->
    ${caseView.activeTab === 'radar' || allLooseEnds.length > 0 ? renderFollowUpRadar(s, allLooseEnds) : ''}

    <!-- Section D: Operational Cases Workspace -->
    <section class="panel" style="margin-top: 20px;" aria-labelledby="cases-h">
      <div class="panel-head" style="padding: 16px 20px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 id="cases-h" style="margin: 0; font-size: 1.125rem;">Operational cases</h2>
          <p class="muted small" style="margin: 2px 0 0;">Review estate issues, recorded deadlines, and the tasks needed to follow up.</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
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

      <!-- Filter Toolbar -->
      <div class="toolbar-wrap" style="padding: 12px 20px; border-bottom: 1px solid var(--colorNeutralStroke2); margin-bottom: 0;">
        <div class="filter-tabs" role="tablist" aria-label="Filter cases">
          ${[
            ['all', 'All Cases', allCasesCount],
            ['open', 'Open Cases', openCases.length],
            ['radar', 'Outstanding Follow-Ups', allLooseEnds.length],
            ['blocked', 'Blocked', blockedCases.length],
            ['ready', 'Ready to Close?', readyCases.length],
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
          <label for="case-search-input" class="visually-hidden">Search cases</label>
          <div class="search-input" style="min-width: 210px;">
            <span class="search-icon" aria-hidden="true">${icon('search', 16)}</span>
            <input
              type="search"
              id="case-search-input"
              placeholder="Search case #, title, estate, resident..."
              value="${caseView.searchQuery}"
              aria-label="Search cases by case number, title, estate, or resident"
              data-action="case-search"
            />
          </div>

          <label for="case-estate-filter" class="visually-hidden">Filter by estate</label>
          <select
            id="case-estate-filter"
            class="filter-tab select-control"
            data-action="case-filter-estate"
            style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-size: 0.8125rem; background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);"
            aria-label="Filter cases by estate or block"
          >
            <option value="all">All Estates &amp; Blocks</option>
            <option value="Blk 211" ${caseView.estateFilter === 'Blk 211' ? 'selected' : ''}>Zone A — Blk 211</option>
            <option value="Blk 208" ${caseView.estateFilter === 'Blk 208' ? 'selected' : ''}>Zone A — Blk 208</option>
            <option value="Blk 214" ${caseView.estateFilter === 'Blk 214' ? 'selected' : ''}>Zone A — Blk 214</option>
            <option value="Blk 207" ${caseView.estateFilter === 'Blk 207' ? 'selected' : ''}>Zone A — Blk 207</option>
            <option value="Blk 310" ${caseView.estateFilter === 'Blk 310' ? 'selected' : ''}>Zone B — Blk 310</option>
            <option value="Blk 405" ${caseView.estateFilter === 'Blk 405' ? 'selected' : ''}>Zone C — Blk 405</option>
          </select>

          <label for="case-urgency-filter" class="visually-hidden">Filter by urgency</label>
          <select
            id="case-urgency-filter"
            class="filter-tab select-control"
            data-action="case-filter-urgency"
            style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-size: 0.8125rem; background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);"
            aria-label="Filter cases by urgency level"
          >
            <option value="all">All Urgencies</option>
            <option value="Critical" ${caseView.urgencyFilter === 'Critical' ? 'selected' : ''}>Critical Urgency</option>
            <option value="High" ${caseView.urgencyFilter === 'High' ? 'selected' : ''}>High Urgency</option>
            <option value="Medium" ${caseView.urgencyFilter === 'Medium' ? 'selected' : ''}>Medium Urgency</option>
          </select>

          ${caseView.searchQuery || caseView.estateFilter !== 'all' || caseView.urgencyFilter !== 'all' || caseView.activeTab !== 'all'
            ? html`
                <button type="button" class="btn-subtle btn-sm" data-action="case-clear-filters" aria-label="Reset all filters">
                  ${icon('refresh', 14)} Reset filters
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

    <!-- Section E: Case Journey & Insights Drawer -->
    ${caseView.selectedCaseId ? renderCaseJourneyModal(s, getCase(s, caseView.selectedCaseId)) : ''}
  `;
}

function filterCases(s, cases) {
  return cases.filter((c) => {
    // Tab filter
    if (caseView.activeTab === 'open' && (c.status === 'closed' || c.status === 'Closed')) return false;
    if (caseView.activeTab === 'blocked' && !(c.blockers || []).some((b) => !b.resolved) && c.status !== 'pending_external') return false;
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
              <h2 id="radar-h" style="font-size: 1.0625rem; margin: 0;">Follow-Up Radar — Outstanding Follow-Ups Detector</h2>
              <p class="muted small" style="margin: 2px 0 0;">
                All operational commitments, resident follow-ups, and contractor quotes are fully on schedule.
              </p>
            </div>
          </div>
          <span class="tag tag-success">0 Follow-Ups</span>
        </div>
      </section>
    `;
  }

  const criticalCount = allLooseEnds.filter((l) => l.severity === 'critical').length;

  // Filter loose ends by radar filter tab
  const displayedEnds = allLooseEnds.filter((l) => {
    if (caseView.radarFilter === 'critical') return l.severity === 'critical';
    if (caseView.radarFilter === 'resident') return l.ruleId === 'resident_followup' || l.ruleId === 'unconfirmed_appointment';
    if (caseView.radarFilter === 'contractor') return l.ruleId === 'contractor_pending' || l.ruleId === 'inspection_outcome';
    return true;
  });

  return html`
    <section class="panel radar-panel" aria-labelledby="radar-h" style="border-left: 4px solid ${criticalCount > 0 ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; margin-top: 20px;">
      <div class="panel-header" style="padding: 14px 20px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div class="panel-title-group" style="display: flex; align-items: center; gap: 12px;">
          <span class="panel-icon" style="background: ${criticalCount > 0 ? 'var(--colorPaletteRedBackground1)' : 'var(--colorPaletteMarigoldBackground1)'}; color: ${criticalCount > 0 ? 'var(--colorPaletteRedForeground1)' : 'var(--colorPaletteMarigoldForeground2)'}; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px;" aria-hidden="true">
            ${icon('radar', 20)}
          </span>
          <div>
            <h2 id="radar-h" style="font-size: 1.0625rem; margin: 0;">Follow-Up Radar — Outstanding Follow-Ups Detector</h2>
            <p class="muted small" style="margin: 2px 0 0;">
              Deterministic intelligence highlighting unfulfilled promises, missing evidence, and unconfirmed tenant appointments before they escalate.
            </p>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div class="filter-tabs" role="tablist" style="margin: 0;">
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'all' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="all"
            >
              All (${allLooseEnds.length})
            </button>
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'critical' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="critical"
            >
              Critical (${criticalCount})
            </button>
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'resident' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="resident"
            >
              Resident Callbacks
            </button>
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'contractor' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="contractor"
            >
              Contractor
            </button>
          </div>
        </div>
      </div>

      <div class="radar-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: 14px; padding: 16px 20px;">
        ${displayedEnds.map((finding) => renderLooseEndCard(s, finding))}
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
          title="Inspect case details"
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
        <strong>Supporting Record:</strong> ${finding.sourceEvidence}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke2); flex-wrap: wrap;">
        <!-- Evidence-Linked Explanation Trigger -->
        <button
          type="button"
          class="btn-subtle btn-sm"
          data-action="case-explain-finding"
          data-case="${c.id}"
          data-rule="${finding.ruleId}"
          title="Inspect why SyncAI flagged this case"
          style="font-size: 0.75rem; font-weight: 600; color: var(--colorBrandForeground1);"
        >
          ${icon('sparkle', 12)} Why was this flagged?
        </button>

        <button
          type="button"
          class="btn-primary btn-sm"
          data-action="case-inspect"
          data-id="${c.id}"
          data-tab="loose_ends"
          data-rule="${finding.ruleId}"
          style="font-size: 0.75rem;"
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
            <th scope="col" style="min-width: 250px;">Case # &amp; Title</th>
            <th scope="col" style="width: 130px;">Category</th>
            <th scope="col" style="width: 130px;">Primary Status</th>
            <th scope="col" style="width: 140px;">Assigned Officer</th>
            <th scope="col" style="width: 180px; white-space: nowrap;">Deadlines (SGT)</th>
            <th scope="col" style="width: 140px;">Follow-Ups</th>
            <th scope="col" style="text-align: right; width: 120px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map((c) => {
            const ends = detectLooseEnds(s, c);
            const colId = getCaseKanbanColumn(c);
            const isBlocked = (c.blockers || []).some((b) => !b.resolved);
            const statusClass = c.status === 'closed' || c.status === 'Closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : isBlocked ? 'tag-warning' : 'tag-brand';

            return html`
              <tr>
                <td>
                  <span class="case-number" style="font-family: monospace; font-size: 0.75rem; font-weight: 700; color: var(--colorBrandForeground1);">${c.number || c.caseNumber || c.id}</span>
                  <a class="case-title" href="#cases/${c.id}" style="display: block; font-weight: 600; text-decoration: none; color: inherit; margin-top: 2px;">${c.title}</a>
                  ${c.location ? html`<span class="small muted" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 3px;">${icon('pin', 12)} ${c.location}</span>` : ''}
                </td>
                <td data-label="Category"><span class="tag tag-neutral small">${c.category}</span></td>
                <td data-label="Primary Status">
                  <span class="tag ${statusClass}">${c.status}</span>
                  ${isBlocked ? html`<span class="tag tag-danger small" style="margin-top: 4px; display: inline-block;">Blocked</span>` : ''}
                </td>
                <td data-label="Assigned officer">${officerName(s, c.ownerId)}</td>
                <td data-label="Deadlines (SGT)">${recordedDeadlines(c)}</td>
                <td data-label="Follow-Ups">
                  ${ends.length === 0
                    ? html`<span class="tag tag-success small" style="display: inline-flex; align-items: center; gap: 4px;">${icon('check', 12)} On Track</span>`
                    : html`<button type="button" class="tag tag-warning small" data-action="case-inspect" data-id="${c.id}" data-tab="loose_ends" style="cursor: pointer; border: 1px solid var(--colorPaletteMarigoldBorderActive); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">${icon('radar', 12)} ${ends.length} Alert${ends.length > 1 ? 's' : ''}</button>`}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button type="button" class="btn-primary btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="timeline">
                    View Case
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

/**
 * Kanban Board with Single-Column Classification.
 * Each case is evaluated by getCaseKanbanColumn(c) and placed in exactly ONE column.
 * Duplication is eliminated. Secondary conditions (e.g. Blockers, High Priority) are shown via badges.
 */
function renderCaseKanban(s, cases) {
  return html`
    <div class="kanban-board" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; overflow-x: auto; padding-bottom: 8px;">
      ${KANBAN_COLUMNS.map((col) => {
        const colCases = cases.filter((c) => getCaseKanbanColumn(c) === col.id);
        return html`
          <div class="kanban-col" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--colorNeutralStroke3);">
              <strong style="font-size: 0.875rem;">${col.title}</strong>
              <span class="tag ${col.badgeClass} small">${colCases.length}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
              ${colCases.length === 0
                ? html`<div style="text-align: center; padding: 32px 8px; color: var(--colorNeutralForeground3); font-size: 0.8125rem;">No cases in this stage</div>`
                : colCases.map((c) => {
                    const ends = detectLooseEnds(s, c);
                    const isBlocked = (c.blockers || []).some((b) => !b.resolved);
                    return html`
                      <div
                        class="kanban-case-card"
                        tabindex="0"
                        role="region"
                        aria-label="${c.title}"
                        style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke1); border-left: 4px solid ${ends.length > 0 ? 'var(--colorPaletteMarigoldBorderActive)' : isBlocked ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorBrandStroke1)'}; border-radius: 8px; padding: 12px; box-shadow: var(--shadow2); display: flex; flex-direction: column; gap: 8px;"
                      >
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                          <span style="font-family: monospace; font-size: 0.75rem; font-weight: 700; color: var(--colorBrandForeground1);">${c.number || c.caseNumber || c.id}</span>
                          <div style="display: flex; gap: 4px;">
                            ${isBlocked ? html`<span class="tag tag-danger small">Blocked</span>` : ''}
                            <span class="tag ${c.urgency === 'Critical' ? 'tag-danger' : 'tag-neutral'} small">${c.urgency || 'Standard'}</span>
                          </div>
                        </div>

                        <a href="#cases/${c.id}" style="font-size: 0.875rem; font-weight: 600; text-decoration: none; color: inherit; line-height: 1.35;">${c.title}</a>

                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.75rem;" class="muted">
                          <span style="display: inline-flex; align-items: center; gap: 4px;">
                            ${icon('users', 12)} ${officerName(s, c.ownerId)}
                          </span>
                          ${c.location ? html`<span>${c.location}</span>` : ''}
                        </div>

                        ${ends.length > 0
                          ? html`
                              <button
                                type="button"
                                class="tag tag-warning small"
                                data-action="case-explain-finding"
                                data-case="${c.id}"
                                data-rule="${ends[0].ruleId}"
                                style="align-self: flex-start; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--colorPaletteMarigoldBorderActive);"
                              >
                                ${icon('radar', 12)} ${ends.length} Follow-Up${ends.length > 1 ? 's' : ''} (Explain)
                              </button>
                            `
                          : ''}

                        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--colorNeutralStroke3);">
                          <button type="button" class="btn-primary btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="timeline" style="font-size: 0.75rem; padding: 2px 10px;">View Case</button>
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
  const comms = getCommunications(s, c.id);
  const activeBlockers = (c.blockers || []).filter((b) => !b.resolved);

  return html`
    <div class="modal-backdrop is-open" data-action="case-modal-close" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: flex-end;">
      <div
        class="drawer-panel"
        onclick="event.stopPropagation()"
        style="width: min(100%, 720px); height: 100%; background: var(--colorNeutralBackground1); display: flex; flex-direction: column; box-shadow: var(--shadow64); animation: slideInRight 0.25s cubic-bezier(0,0,0.2,1);"
        role="dialog"
        aria-label="Case details: ${c.title}"
      >
        <!-- Drawer Header -->
        <div class="drawer-header" style="padding: 18px 24px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: flex-start; background: var(--colorNeutralBackground2); gap: 16px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="case-number" style="font-family: monospace; font-size: 0.8125rem; font-weight: 700; color: var(--colorBrandForeground1);">${c.number || c.caseNumber || c.id}</span>
              <span class="tag ${c.status === 'closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : 'tag-brand'} small">${c.status}</span>
              ${c.location ? html`<span class="small muted" style="display: inline-flex; align-items: center; gap: 4px;">${icon('pin', 12)} ${c.location}</span>` : ''}
              <span class="small muted" style="display: inline-flex; align-items: center; gap: 4px; margin-left: auto;">
                ${icon('users', 12)} Assigned: <strong>${officerName(s, c.ownerId)}</strong>
              </span>
            </div>
            <h2 style="font-size: 1.1875rem; margin: 8px 0 0; line-height: 1.35; color: var(--colorNeutralForeground1); font-weight: 600;">${c.title}</h2>
          </div>
          <button type="button" class="drawer-close-btn" data-action="case-modal-close" aria-label="Close drawer" title="Close drawer">
            ${icon('x', 20)}
          </button>
        </div>

        <!-- Responsive Wrapped Navigation Tabs -->
        <nav class="drawer-tabs-nav" style="padding: 10px 24px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; flex-wrap: wrap; gap: 8px; background: var(--colorNeutralBackground1);" role="tablist" aria-label="Case detail sections">
          ${[
            ['timeline', 'Timeline & Notes', null],
            ['loose_ends', 'Outstanding Follow-Ups', looseEnds.length],
            ['blockers', 'Blockers', activeBlockers.length],
            ['readiness', 'Ready to Close?', readiness.isReady ? 'Ready' : 'Incomplete'],
            ['communications', 'Communications', comms.length],
            ['brief', 'AI Case Brief', null],
          ].map(
            ([tabKey, label, count]) => html`
              <button
                type="button"
                class="filter-tab drawer-tab-btn ${caseView.journeyTab === tabKey ? 'is-active' : ''}"
                data-action="case-journey-tab"
                data-tab="${tabKey}"
                role="tab"
                aria-selected="${caseView.journeyTab === tabKey ? 'true' : 'false'}"
              >
                ${label}
                ${count != null ? html`<span class="tab-count ${count > 0 && (tabKey === 'loose_ends' || tabKey === 'blockers') ? 'tab-count-warn' : ''}">${count}</span>` : ''}
              </button>
            `,
          )}
        </nav>

        <!-- Highlighting Source Notice Bar (if returning from inspection) -->
        ${caseView.highlightedSourceId
          ? html`
              <div style="padding: 8px 24px; background: var(--colorBrandBackground2); border-bottom: 1px solid var(--colorBrandStroke2); display: flex; justify-content: space-between; align-items: center; font-size: 0.8125rem;">
                <span style="color: var(--colorBrandForeground1); font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                  ${icon('sparkle', 14)} Inspecting verified source record linked to explanation
                </span>
                <button type="button" class="btn-ghost btn-sm" data-action="case-return-explanation" style="font-size: 0.75rem; padding: 2px 8px;">
                  ← Back to Explanation
                </button>
              </div>
            `
          : ''}

        <!-- Tab Body -->
        <div style="flex: 1; overflow-y: auto; padding: 20px 24px;">
          ${caseView.journeyTab === 'timeline'
            ? renderJourneyTimelineTab(s, c)
            : caseView.journeyTab === 'loose_ends'
              ? renderJourneyLooseEndsTab(s, c, looseEnds)
              : caseView.journeyTab === 'blockers'
                ? renderJourneyBlockersTab(s, c)
                : caseView.journeyTab === 'readiness'
                  ? renderJourneyReadinessTab(s, c, readiness)
                  : caseView.journeyTab === 'communications'
                    ? renderJourneyCommunicationsTab(s, c, comms)
                    : renderJourneyBriefTab(s, c)}
        </div>

        <!-- Drawer Footer Actions -->
        <div class="drawer-footer" style="padding: 16px 24px; border-top: 1px solid var(--colorNeutralStroke2); background: var(--colorNeutralBackground2); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-secondary btn-sm" data-action="case-reassign-dialog" data-case="${c.id}">
              ${icon('user-plus', 14)} Reassign Case
            </button>
            <button type="button" class="btn-subtle btn-sm" data-action="case-plan-nav" data-case="${c.id}">
              ${icon('calendar', 14)} View in Planner
            </button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${c.status !== 'closed' && !readiness.isReady ? html`
              <span class="small muted" style="font-size: 0.75rem; color: var(--colorPaletteMarigoldForeground2);">
                ${readiness.unresolvedItems.length} checklist item${readiness.unresolvedItems.length === 1 ? '' : 's'} pending
              </span>
            ` : ''}
            <button
              type="button"
              class="btn-primary"
              data-action="case-close-action"
              data-case="${c.id}"
              ${c.status === 'closed' ? 'disabled' : ''}
            >
              ${c.status === 'closed' ? 'Case Closed &amp; Audited' : 'Close Case'}
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
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <p class="small muted" style="margin: 0;">Chronological history of inspections, resident contacts, and contractor updates.</p>
        <span class="small muted">${events.length} recorded event${events.length === 1 ? '' : 's'}</span>
      </div>

      ${events.length === 0
        ? html`
            <div class="empty-state-compact" style="padding: 24px 16px; text-align: center; color: var(--colorNeutralForeground3); background: var(--colorNeutralBackground2); border-radius: 8px; border: 1px dashed var(--colorNeutralStroke2);">
              <p class="muted" style="margin: 0; font-size: 0.875rem;">No case updates have been recorded yet.</p>
            </div>
          `
        : html`
            <div style="border-left: 2px solid var(--colorNeutralStroke2); margin-left: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 18px;">
              ${events.map((ev) => {
                const isHighlighted = caseView.highlightedSourceId === ev.id || caseView.highlightedSourceId === ev.sourceRef;
                return html`
                  <div id="source-${ev.id}" style="position: relative; ${isHighlighted ? 'background: var(--colorBrandBackground2); padding: 8px; border-radius: 6px; border: 1px solid var(--colorBrandStroke1);' : ''}">
                    <div style="position: absolute; left: ${isHighlighted ? '-31px' : '-23px'}; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--colorBrandForeground1); border: 2px solid #fff;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                      <strong style="font-size: 0.875rem;">${ev.title}</strong>
                      <span class="small muted">${ev.at || TODAY}</span>
                    </div>
                    <p class="small" style="margin: 4px 0 0; color: var(--colorNeutralForeground2);">${ev.summary}</p>
                    <span class="small muted" style="font-size: 0.75rem;">Source: ${ev.source || 'SyncAI'} · Officer: ${ev.actor || officerName(s, c.ownerId)}</span>
                  </div>
                `;
              })}
            </div>
          `}
    </div>
  `;
}

/**
 * Loose Ends & Evidence-Linked Explanations (#117)
 * Displays detected loose ends with interactive explanation drawers,
 * 4-part breakdown (Facts, Deductions, Missing Info, Recommendations),
 * and clickable evidence links.
 */
function renderJourneyLooseEndsTab(s, c, looseEnds) {
  // If user selected a specific finding to explain
  if (caseView.activeExplanationRuleId) {
    const explanation = getExplanationForFinding(s, c.id, caseView.activeExplanationRuleId);
    if (explanation) {
      return renderExplanationPanel(s, c, explanation);
    }
  }

  return html`
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="font-size: 0.9375rem; margin: 0;">Outstanding Follow-Ups</h3>
          <p class="small muted" style="margin: 2px 0 0;">Unresolved commitments detected by deterministic rules.</p>
        </div>
        <span class="tag tag-warning small">${looseEnds.length} Attention items</span>
      </div>

      ${looseEnds.length === 0
        ? html`
            <div class="callout" style="border: 1px solid var(--colorPaletteGreenBorderActive); background: var(--colorPaletteGreenBackground1); padding: 16px; border-radius: 8px;">
              <strong style="color: var(--colorPaletteGreenForeground1);">No unresolved loose ends detected!</strong>
              <p class="small" style="margin: 4px 0 0;">All resident follow-ups, contractor confirmations, and inspections are on track.</p>
            </div>
          `
        : looseEnds.map((l) => html`
            <div style="border: 1px solid var(--colorPaletteMarigoldBorderActive); border-left: 4px solid ${l.severity === 'critical' ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; border-radius: 8px; padding: 14px; background: var(--colorNeutralBackground2); display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <strong style="font-size: 0.9375rem;">${l.title}</strong>
                  <span class="tag tag-neutral small">${l.ruleCode || 'Rule'}</span>
                </div>
                <span class="tag ${l.severity === 'critical' ? 'tag-danger' : 'tag-warning'} small">${l.severity}</span>
              </div>

              <p class="small muted" style="margin: 0;">${l.explanation}</p>

              <div style="font-size: 0.75rem; color: var(--colorNeutralForeground3); background: var(--colorNeutralBackground1); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke3);">
                <strong>Supporting Record:</strong> ${l.sourceEvidence}
              </div>

              <div class="small" style="background: var(--colorNeutralBackground1); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--colorNeutralStroke2); color: var(--colorBrandForeground1); font-weight: 500;">
                💡 <strong>Next step:</strong> ${l.suggestedAction}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke3);">
                <!-- Explain Finding Button -->
                <button
                  type="button"
                  class="btn-primary btn-sm"
                  data-action="case-view-explanation"
                  data-case="${c.id}"
                  data-rule="${l.ruleId}"
                  style="font-size: 0.75rem;"
                >
                  ${icon('sparkle', 12)} Why was this flagged?
                </button>

                <!-- Shortcut to Communication Hub -->
                <button
                  type="button"
                  class="btn-subtle btn-sm"
                  data-action="case-journey-tab"
                  data-tab="communications"
                  style="font-size: 0.75rem;"
                >
                  ${icon('message', 12)} Follow-up Hub
                </button>
              </div>
            </div>
          `)}
    </div>
  `;
}

/**
 * Evidence-Linked Explanation Panel (#117)
 * Implements full Responsible AI explanation architecture with 4-part breakdown:
 * 1. Verified Recorded Facts
 * 2. Rule-Based Deductions
 * 3. Missing Information
 * 4. Proposed Recommendations
 * Plus clickable evidence reference resolution.
 */
function renderExplanationPanel(s, c, exp) {
  return html`
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <!-- Breadcrumb / Back button -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button type="button" class="btn-ghost btn-sm" data-action="case-exit-explanation" style="font-weight: 600;">
          ← Back to Follow-Ups List
        </button>
        <span class="tag tag-brand small">Evidence-Linked Intelligence (#117)</span>
      </div>

      <!-- Responsible AI Disclaimer Card -->
      <div style="padding: 12px 14px; background: var(--colorBrandBackground2); border: 1px solid var(--colorBrandStroke2); border-radius: 8px; font-size: 0.8125rem; color: var(--colorBrandForeground1); line-height: 1.45;">
        <strong style="display: flex; align-items: center; gap: 6px;">
          ${icon('shield', 16)} Responsible AI Disclosure: Deterministic Rule-Based Finding
        </strong>
        <p style="margin: 4px 0 0;">
          This finding was evaluated by deterministic rule <strong>${exp.ruleCode} (${exp.ruleName})</strong> against recorded Town Council case events. It is not an autonomous machine learning prediction and contains no fabricated evidence. Human review is required before taking operational action.
        </p>
      </div>

      <!-- Finding Header & Reason -->
      <div style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h3 style="font-size: 1rem; margin: 0;">${exp.title}</h3>
          <span class="tag ${exp.severity === 'critical' ? 'tag-danger' : 'tag-warning'}">${exp.severity}</span>
        </div>
        <p style="margin: 0 0 10px; font-size: 0.875rem; color: var(--colorNeutralForeground1); line-height: 1.45;">
          ${exp.whyDetected || exp.explanation}
        </p>
        <div class="small muted" style="font-size: 0.75rem;">
          <strong>Configured Rule Threshold:</strong> ${exp.ruleThreshold || 'Standard operational turnaround SLA.'}
        </div>
      </div>

      <!-- 4-Part Responsible AI Breakdown Grid -->
      <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
        <!-- 1. Verified Recorded Facts -->
        <div style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorPaletteGreenBorderActive); border-left: 4px solid var(--colorPaletteGreenBorderActive); border-radius: 8px; padding: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="color: var(--colorPaletteGreenForeground1);">${icon('check', 16)}</span>
            <strong style="font-size: 0.875rem; color: var(--colorPaletteGreenForeground1);">1. Verified Recorded Facts</strong>
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 0.8125rem; line-height: 1.45; color: var(--colorNeutralForeground1);">
            ${(exp.verifiedFacts || [exp.sourceEvidence]).map((fact) => html`<li>${fact}</li>`)}
          </ul>
        </div>

        <!-- 2. Rule-Based Deductions -->
        <div style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorBrandStroke2); border-left: 4px solid var(--colorBrandStroke1); border-radius: 8px; padding: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="color: var(--colorBrandForeground1);">${icon('sparkle', 16)}</span>
            <strong style="font-size: 0.875rem; color: var(--colorBrandForeground1);">2. Rule-Based Deductions</strong>
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 0.8125rem; line-height: 1.45; color: var(--colorNeutralForeground1);">
            ${(exp.ruleDeductions || [exp.explanation]).map((ded) => html`<li>${ded}</li>`)}
          </ul>
        </div>

        <!-- 3. Missing Information -->
        <div style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorPaletteMarigoldBorderActive); border-left: 4px solid var(--colorPaletteMarigoldBorderActive); border-radius: 8px; padding: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="color: var(--colorPaletteMarigoldForeground2);">${icon('alert', 16)}</span>
            <strong style="font-size: 0.875rem; color: var(--colorPaletteMarigoldForeground2);">3. Missing Information</strong>
          </div>
          <p style="margin: 0; font-size: 0.8125rem; color: var(--colorNeutralForeground1); line-height: 1.45;">
            ${exp.missingInfo || 'No missing files recorded.'}
          </p>
        </div>

        <!-- 4. Proposed Recommendations -->
        <div style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke1); border-left: 4px solid var(--colorBrandForeground1); border-radius: 8px; padding: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="color: var(--colorBrandForeground1);">${icon('shield', 16)}</span>
            <strong style="font-size: 0.875rem; color: var(--colorBrandForeground1);">4. Proposed Recommendations</strong>
          </div>
          <p style="margin: 0; font-size: 0.8125rem; color: var(--colorNeutralForeground1); line-height: 1.45;">
            ${exp.suggestedAction}
          </p>
        </div>
      </div>

      <!-- Clickable Supporting Evidence Box -->
      <div style="border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px; background: var(--colorNeutralBackground2); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <span class="small muted" style="display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Supporting Source Record</span>
          <strong style="font-size: 0.875rem;">${exp.sourceRecordRef || exp.sourceEvidence}</strong>
        </div>
        <button
          type="button"
          class="btn-primary btn-sm"
          data-action="case-jump-source"
          data-case="${c.id}"
          data-type="${exp.sourceRecordType || 'timeline'}"
          data-source-id="${exp.sourceRecordId}"
          title="Jump directly to source record and highlight"
        >
          View Supporting Record →
        </button>
      </div>
    </div>
  `;
}

function renderJourneyBlockersTab(s, c) {
  const blockers = c.blockers || [];
  return html`
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <p class="small muted" style="margin: 0;">External blockers preventing case resolution (e.g. resident access, contractor quotes).</p>
        <span class="small muted">${blockers.filter((b) => !b.resolved).length} active blocker(s)</span>
      </div>

      ${blockers.length === 0
        ? html`
            <div class="callout" style="border: 1px solid var(--colorPaletteGreenBorderActive); background: var(--colorPaletteGreenBackground1); padding: 16px; border-radius: 8px;">
              <strong style="color: var(--colorPaletteGreenForeground1);">No active blockers recorded.</strong>
              <p class="small" style="margin: 4px 0 0;">This case is flowing through operational milestones without external hold-ups.</p>
            </div>
          `
        : blockers.map((b) => html`
            <div style="border: 1px solid ${b.resolved ? 'var(--colorPaletteGreenBorderActive)' : 'var(--colorPaletteRedBorderActive)'}; border-left: 4px solid ${b.resolved ? 'var(--colorPaletteGreenBorderActive)' : 'var(--colorPaletteRedBorderActive)'}; border-radius: 8px; padding: 14px; background: var(--colorNeutralBackground2); display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 0.9375rem;">${b.title}</strong>
                <span class="tag ${b.resolved ? 'tag-success' : 'tag-danger'} small">${b.resolved ? 'Resolved' : 'Active Blocker'}</span>
              </div>
              <div class="small muted">
                <strong>Recorded:</strong> ${b.recordedAt || TODAY} · <strong>Party:</strong> ${b.responsibleParty || 'External Specialist'}
              </div>
              <p class="small" style="margin: 0; color: var(--colorNeutralForeground1);">
                <strong>Action needed:</strong> ${b.suggestedAction || 'Awaiting contractor or resident response.'}
              </p>
              ${!b.resolved
                ? html`
                    <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                      <button type="button" class="btn-subtle btn-sm" data-action="case-resolve-blocker" data-case="${c.id}" data-blocker="${b.id}">
                        ${icon('check', 12)} Mark Blocker Resolved
                      </button>
                    </div>
                  `
                : ''}
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
          ${checkpoints.map((cp) => {
            const isHighlighted = caseView.highlightedSourceId === cp.id;
            return html`
              <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px; background: var(--colorNeutralBackground2); border: 1px solid ${isHighlighted ? 'var(--colorBrandStroke1)' : 'var(--colorNeutralStroke3)'}; ${isHighlighted ? 'box-shadow: var(--shadow8);' : ''}">
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
            `;
          })}
        </ul>
      </div>

      ${evidence.length > 0
        ? html`
            <div>
              <h3 style="font-size: 0.9375rem; margin: 0 0 8px;">Evidence &amp; Documentation</h3>
              <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 8px;">
                ${evidence.map((evi) => {
                  const isHighlighted = caseView.highlightedSourceId === evi.id;
                  return html`
                    <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; background: var(--colorNeutralBackground2); border: 1px solid ${isHighlighted ? 'var(--colorBrandStroke1)' : 'var(--colorNeutralStroke3)'}; ${isHighlighted ? 'box-shadow: var(--shadow8);' : ''}">
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
                  `;
                })}
              </ul>
            </div>
          `
        : ''}
    </div>
  `;
}

/**
 * Case Communication Hub
 * Chronological multi-channel simulation (In-App, WhatsApp, Teams, Telegram),
 * manual logging, draft reply generator with copy to clipboard,
 * and Communication-to-Task Drafting (#076).
 */
function renderJourneyCommunicationsTab(s, c, comms) {
  const filteredComms = comms.filter((m) => {
    if (caseView.commChannelFilter === 'all') return true;
    return m.channel === caseView.commChannelFilter;
  });

  return html`
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Communication Hub Header & Channel Filter -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 0.9375rem; margin: 0;">Case Communication Hub</h3>
          <p class="small muted" style="margin: 2px 0 0;">Multi-channel simulated communication history and follow-up tracking.</p>
        </div>
        <button type="button" class="btn-primary btn-sm" data-action="comm-toggle-log-form">
          ${icon('plus', 12)} Log Update
        </button>
      </div>

      <!-- Channel Filter Tabs -->
      <div class="filter-tabs" role="tablist" style="margin: 0;">
        ${[
          ['all', 'All Channels', comms.length],
          ['in_app', 'In-App', comms.filter((m) => m.channel === 'in_app').length],
          ['whatsapp', 'WhatsApp (Simulated)', comms.filter((m) => m.channel === 'whatsapp').length],
          ['teams', 'Teams (Simulated)', comms.filter((m) => m.channel === 'teams').length],
        ].map(
          ([ch, label, count]) => html`
            <button
              type="button"
              class="filter-tab ${caseView.commChannelFilter === ch ? 'is-active' : ''}"
              data-action="comm-filter-channel"
              data-channel="${ch}"
            >
              ${label} <span class="tab-count">${count}</span>
            </button>
          `,
        )}
      </div>

      <!-- Expandable Manual Log Form -->
      <div id="comm-log-form-container" style="display: none; background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px;">
        <h4 style="margin: 0 0 10px; font-size: 0.875rem;">Log Simulated Communication Record</h4>
        <form id="comm-manual-log-form" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Channel</label>
              <select name="channel" class="select-control" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1);">
                <option value="in_app">In-App Portal</option>
                <option value="whatsapp">WhatsApp (Proposed)</option>
                <option value="teams">Microsoft Teams (Proposed)</option>
                <option value="telegram">Telegram (Proposed)</option>
              </select>
            </div>
            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Category</label>
              <select name="category" class="select-control" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1);">
                <option value="Resident Follow-up">Resident Follow-up</option>
                <option value="Contractor Query">Contractor Query</option>
                <option value="Inspection Scheduling">Inspection Scheduling</option>
                <option value="Status Update">Status Update</option>
              </select>
            </div>
          </div>
          <div>
            <label class="small muted" style="display: block; margin-bottom: 4px;">Message Summary / Notes</label>
            <textarea name="content" rows="2" placeholder="Record key points of the call or message..." required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.8125rem;"></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn-subtle btn-sm" data-action="comm-toggle-log-form">Cancel</button>
            <button type="submit" class="btn-primary btn-sm">Save Communication Record</button>
          </div>
        </form>
      </div>

      <!-- Messages Timeline -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${filteredComms.length === 0
          ? html`<p class="muted small" style="text-align: center; padding: 20px;">No communication records found for this channel.</p>`
          : filteredComms.map((m) => html`
              <div style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="tag ${m.channel === 'whatsapp' ? 'tag-success' : m.channel === 'teams' ? 'tag-brand' : 'tag-neutral'} small">
                      ${m.channelLabel}
                    </span>
                    <strong style="font-size: 0.8125rem;">${m.sender}</strong>
                  </div>
                  <span class="small muted">${fmtTime(timePart(m.timestamp)) || m.timestamp}</span>
                </div>
                <p style="margin: 0; font-size: 0.8125rem; color: var(--colorNeutralForeground1); line-height: 1.4;">${m.content}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--colorNeutralStroke3); font-size: 0.75rem;" class="muted">
                  <span>Source: <em>${m.sourceLabel}</em></span>
                  ${!m.acknowledged
                    ? html`
                        <button type="button" class="btn-subtle btn-sm" data-action="comm-ack" data-id="${m.id}" style="font-size: 0.75rem; padding: 2px 6px;">
                          ${icon('check', 12)} Mark Acknowledged
                        </button>
                      `
                    : html`<span style="color: var(--colorPaletteGreenForeground1);">✓ Acknowledged</span>`}
                </div>
              </div>
            `)}
      </div>

      <!-- Suggested Reply & Follow-up Generator -->
      <div style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 0.875rem;">Simulated Draft Reply Generator</h4>
          <button type="button" class="btn-secondary btn-sm" data-action="comm-generate-reply" data-case="${c.id}">
            ${icon('sparkle', 12)} Generate Draft
          </button>
        </div>
        <textarea
          id="comm-draft-reply-box"
          rows="3"
          style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.8125rem;"
          placeholder="Click 'Generate Draft' to prepare a simulated contextual response..."
        >${generateDraftReply(s, c.id)}</textarea>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button type="button" class="btn-subtle btn-sm" data-action="comm-copy-reply">
            ${icon('copy', 12)} Copy to Clipboard
          </button>
        </div>
      </div>

      <!-- Communication-to-Task Drafting (#076 — Stretch Feature) -->
      <div style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorBrandStroke2); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h4 style="margin: 0; font-size: 0.875rem; color: var(--colorBrandForeground1); display: flex; align-items: center; gap: 6px;">
            ${icon('sparkle', 14)} Message-to-Task Drafting (#076)
          </h4>
          <span class="tag tag-brand small">Prototype Simulation</span>
        </div>
        <p class="small muted" style="margin: 0 0 8px;">Paste a fictional communication to extract a structured task draft for Smart Planning.</p>

        <textarea
          id="comm-msg-to-task-input"
          rows="2"
          placeholder="Paste fictional message or click sample below..."
          style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.8125rem;"
        >Hi Officer Aisyah, Eng Seng Plumbing here regarding Blk 211 seepage. We need joint access to #06-12 tomorrow at 14:00 to verify floor trap seal before quote approval.</textarea>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-ghost btn-sm" data-action="comm-load-sample-1" style="font-size: 0.75rem;">Sample: Contractor Access</button>
            <button type="button" class="btn-ghost btn-sm" data-action="comm-load-sample-2" style="font-size: 0.75rem;">Sample: Resident Callback</button>
          </div>
          <button type="button" class="btn-primary btn-sm" data-action="comm-parse-task" data-case="${c.id}">
            Extract Task Draft
          </button>
        </div>

        <!-- Extracted Draft Preview (if parsed) -->
        <div id="comm-extracted-task-preview" style="display: ${caseView.extractedTaskDraft ? 'block' : 'none'}; margin-top: 12px; padding: 12px; background: var(--colorNeutralBackground1); border: 1px solid var(--colorPaletteGreenBorderActive); border-radius: 6px;">
          ${caseView.extractedTaskDraft
            ? html`
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <strong style="font-size: 0.8125rem; color: var(--colorPaletteGreenForeground1);">Proposed Task Draft</strong>
                  <span class="tag tag-success small">Requires Confirmation</span>
                </div>
                <div style="font-size: 0.8125rem; line-height: 1.45;">
                  <div><strong>Title:</strong> ${caseView.extractedTaskDraft.title}</div>
                  <div><strong>Category:</strong> ${caseView.extractedTaskDraft.category} · <strong>Priority:</strong> ${caseView.extractedTaskDraft.priority}</div>
                  <div><strong>Due:</strong> ${caseView.extractedTaskDraft.due} · <strong>Linked Case:</strong> ${caseView.extractedTaskDraft.caseId}</div>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                  <button type="button" class="btn-primary btn-sm" data-action="comm-confirm-task">
                    ${icon('check', 12)} Confirm &amp; Create Task in Smart Planner
                  </button>
                </div>
              `
            : ''}
        </div>
      </div>
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
