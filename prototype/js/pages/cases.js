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
import { TODAY, fmtDue, fmtLongDay, fmtTime, parseDate, timePart } from '../time.js';
import { emptyState, html, icon, priorityBadge, riskBadge, raw } from '../ui.js';

const COMPACT_DATE_FMT = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

export function fmtCompactDeadline(iso) {
  if (!iso) return '';
  const parsed = parseDate(iso);
  const dateStr = COMPACT_DATE_FMT.format(parsed);
  const t = timePart(iso);
  if (!t) return dateStr;
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  const mm = String(m).padStart(2, '0');
  return `${dateStr} · ${h12}:${mm} ${suffix}`;
}

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
    ${deadlines.map(([label, value]) => html`<div class="deadline-item">
      <dt class="deadline-label">${label}</dt>
      <dd class="deadline-val"><time datetime="${value}+08:00">${fmtCompactDeadline(value)}</time></dd>
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
    <header class="page-hero case-action-hero">
      <div class="case-hero-main">
        <span class="page-hero-icon case-hero-icon" aria-hidden="true">${icon('cases', 28)}</span>
        <div class="case-hero-text">
          <p class="case-hero-eyebrow">Operational Governance</p>
          <div class="case-hero-title-row">
            <h1>Case Action Centre</h1>
            <div class="case-hero-badges">
              <span class="hero-badge">Admin Summary</span>
              <span class="tag tag-demo-indicator">Governance Mode</span>
            </div>
          </div>
          <p class="case-hero-description">
            High-level operational metrics and case workflow governance. In accordance with Singapore Town Council data minimisation principles, administrative roles inspect compliance aggregates rather than confidential resident casework.
          </p>
        </div>
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

    <div class="stat-grid case-overview-grid">
      <div class="stat-card case-stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('folder', 20)}</span>
        <span class="stat-label">Active Workflows</span>
        <strong class="stat-value">${totalOpen}</strong>
        <span class="stat-hint">Across Zones A, B and C</span>
      </div>
      <div class="stat-card case-stat-card ${blockedCount > 0 ? 'warn' : ''}">
        <span class="stat-icon" aria-hidden="true">${icon('alert', 20)}</span>
        <span class="stat-label">Blocked Workflows</span>
        <strong class="stat-value">${blockedCount}</strong>
        <span class="stat-hint">Awaiting specialist/contractor</span>
      </div>
      <div class="stat-card case-stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('check', 20)}</span>
        <span class="stat-label">Closure Approvals Pending</span>
        <strong class="stat-value">${readyCount}</strong>
        <span class="stat-hint">Ready for manager sign-off</span>
      </div>
      <div class="stat-card case-stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('shield', 20)}</span>
        <span class="stat-label">Data Minimisation Policy</span>
        <strong class="stat-value" style="font-size: 1.25rem; align-self: center; color: var(--colorPaletteGreenForeground1);">Active</strong>
        <span class="stat-hint">Resident casework isolated</span>
      </div>
    </div>

    <section class="panel case-workspace-panel">
      <div class="panel-head case-workspace-header">
        <div>
          <h2>Case Action Centre Configuration</h2>
          <p class="muted small">Configured SLA thresholds and automated loose-end detection triggers</p>
        </div>
        <span class="tag tag-brand">Governance Mode</span>
      </div>
      <div class="table-wrap case-table-wrap">
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

  // Apply filters
  const filteredCases = filterCases(s, cases);

  return html`
    <!-- Section A: Page Header with Gradient Hero -->
    <header class="page-hero case-action-hero">
      <div class="case-hero-main">
        <span class="page-hero-icon case-hero-icon" aria-hidden="true">${icon('cases', 28)}</span>
        <div class="case-hero-text">
          <p class="case-hero-eyebrow">Category C · Task Visibility &amp; Operational Intelligence</p>
          <div class="case-hero-title-row">
            <h1>Case Action Centre</h1>
            <div class="case-hero-badges">
              <span class="hero-badge">${mgr ? 'Manager Workspace' : 'Property Officer Workspace'}</span>
              <span class="tag tag-demo-indicator">Fictional Demo Environment</span>
            </div>
          </div>
          <p class="case-hero-description">
            Proactively detects unresolved resident follow-ups, pending contractor quotes, and missing inspection evidence before routine tasks slip through the cracks.
          </p>
        </div>
      </div>
    </header>

    <!-- Section B: Operational Overview — 4 Equal-Width Metric Cards -->
    <div class="stat-grid case-overview-grid">
      <button
        type="button"
        class="stat-card case-stat-card stat-card-interactive ${caseView.activeTab === 'open' ? 'is-selected' : ''}"
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
        class="stat-card case-stat-card stat-card-interactive ${allLooseEnds.length > 0 ? 'warn' : ''} ${caseView.activeTab === 'radar' ? 'is-selected' : ''}"
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
        class="stat-card case-stat-card stat-card-interactive ${blockedCases.length > 0 ? 'warn' : ''} ${caseView.activeTab === 'blocked' ? 'is-selected' : ''}"
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
        class="stat-card case-stat-card stat-card-interactive ${caseView.activeTab === 'ready' ? 'is-selected' : ''}"
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
    <section class="panel case-workspace-panel" aria-labelledby="cases-h">
      <div class="panel-head case-workspace-header">
        <div>
          <h2 id="cases-h">Operational cases</h2>
          <p class="muted small">Review estate issues, recorded deadlines, and the tasks needed to follow up.</p>
        </div>
        <div class="case-view-controls">
          <span class="tag tag-demo-indicator hide-sm">Fictional demo cases</span>
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

      <!-- Filter Toolbar: Structured 2-Row Layout -->
      <div class="case-toolbar-container">
        <!-- Row 1: Case status tabs -->
        <div class="case-toolbar-row case-toolbar-row-primary">
          <div class="filter-tabs case-status-tabs" role="tablist" aria-label="Filter cases by status">
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
                  <span class="tab-count ${count > 0 && (tabKey === 'radar' || tabKey === 'blocked') ? 'tab-count-warn' : ''}">${count}</span>
                </button>
              `,
            )}
          </div>
        </div>

        <!-- Row 2: Search input + Estate filter + Urgency filter + Reset -->
        <div class="case-toolbar-row case-toolbar-row-secondary">
          <div class="case-filter-search">
            <label for="case-search-input" class="visually-hidden">Search cases by case number, title, estate, or resident</label>
            <div class="search-input" style="width: 100%;">
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
          </div>

          <div class="case-filter-dropdowns">
            <div class="case-filter-group">
              <label for="case-estate-filter" class="case-filter-label">Estate / Block:</label>
              <select
                id="case-estate-filter"
                class="select-control case-filter-select"
                data-action="case-filter-estate"
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
            </div>

            <div class="case-filter-group">
              <label for="case-urgency-filter" class="case-filter-label">Urgency:</label>
              <select
                id="case-urgency-filter"
                class="select-control case-filter-select"
                data-action="case-filter-urgency"
                aria-label="Filter cases by urgency level"
              >
                <option value="all">All Urgencies</option>
                <option value="Critical" ${caseView.urgencyFilter === 'Critical' ? 'selected' : ''}>Critical Urgency</option>
                <option value="High" ${caseView.urgencyFilter === 'High' ? 'selected' : ''}>High Urgency</option>
                <option value="Medium" ${caseView.urgencyFilter === 'Medium' ? 'selected' : ''}>Medium Urgency</option>
              </select>
            </div>

            ${caseView.searchQuery || caseView.estateFilter !== 'all' || caseView.urgencyFilter !== 'all' || caseView.activeTab !== 'all'
              ? html`
                  <button type="button" class="btn-subtle btn-sm case-reset-filters-btn" data-action="case-clear-filters" aria-label="Reset all filters">
                    ${icon('refresh', 14)} Reset filters
                  </button>
                `
              : ''}
          </div>
        </div>
      </div>

      <!-- Workspace Body: List View vs Kanban View -->
      <div>
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
      <section class="panel radar-panel" aria-labelledby="radar-h" style="border-left: 4px solid var(--colorPaletteGreenBorderActive); margin-top: 24px;">
        <div class="panel-header radar-panel-header">
          <div class="radar-header-title-group">
            <span class="radar-header-icon" style="background: var(--colorPaletteGreenBackground1); color: var(--colorPaletteGreenForeground1);" aria-hidden="true">
              ${icon('check', 20)}
            </span>
            <div class="radar-header-text">
              <h2 id="radar-h">Follow-Up Radar — Operational Loose-End Detector</h2>
              <p class="muted small">
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
    <section class="panel radar-panel ${criticalCount > 0 ? 'is-critical' : ''}" aria-labelledby="radar-h">
      <div class="panel-header radar-panel-header">
        <div class="radar-header-title-group">
          <span class="radar-header-icon ${criticalCount > 0 ? 'is-critical' : ''}" aria-hidden="true">
            ${icon('radar', 20)}
          </span>
          <div class="radar-header-text">
            <h2 id="radar-h">Follow-Up Radar — Operational Loose-End Detector</h2>
            <p class="muted small">
              Deterministic intelligence highlighting unfulfilled promises, missing evidence, and unconfirmed tenant appointments before they escalate.
            </p>
          </div>
        </div>

        <div class="radar-filter-bar">
          <div class="filter-tabs radar-filter-tabs" role="tablist" aria-label="Filter follow-up items">
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'all' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="all"
              role="tab"
              aria-selected="${caseView.radarFilter === 'all' ? 'true' : 'false'}"
            >
              All <span class="tab-count">${allLooseEnds.length}</span>
            </button>
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'critical' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="critical"
              role="tab"
              aria-selected="${caseView.radarFilter === 'critical' ? 'true' : 'false'}"
            >
              Critical <span class="tab-count ${criticalCount > 0 ? 'tab-count-warn' : ''}">${criticalCount}</span>
            </button>
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'resident' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="resident"
              role="tab"
              aria-selected="${caseView.radarFilter === 'resident' ? 'true' : 'false'}"
            >
              Resident Callbacks
            </button>
            <button
              type="button"
              class="filter-tab ${caseView.radarFilter === 'contractor' ? 'is-active' : ''}"
              data-action="case-radar-filter"
              data-filter="contractor"
              role="tab"
              aria-selected="${caseView.radarFilter === 'contractor' ? 'true' : 'false'}"
            >
              Contractor
            </button>
          </div>
        </div>
      </div>

      <div class="radar-grid">
        ${displayedEnds.length === 0
          ? html`<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--colorNeutralForeground3); font-size: 0.875rem;">No follow-up items match this filter.</div>`
          : displayedEnds.map((finding) => renderLooseEndCard(s, finding))}
      </div>
    </section>
  `;
}

function renderLooseEndCard(s, finding) {
  const c = finding.caseItem;
  const isCritical = finding.severity === 'critical';

  return html`
    <div class="loose-end-card ${isCritical ? 'is-critical' : ''}">
      <!-- Header: Finding type badge, Case ID, Case title -->
      <div class="radar-card-header">
        <div class="radar-card-top-row">
          <span class="tag ${isCritical ? 'tag-danger' : 'tag-warning'} small" style="display: inline-flex; align-items: center; gap: 4px;">
            ${icon(isCritical ? 'alert' : 'clock', 12)} ${finding.title}
          </span>
          <button
            type="button"
            class="btn-ghost btn-sm radar-case-link"
            data-action="case-inspect"
            data-id="${c.id}"
            title="Inspect case details"
          >
            ${c.number || c.caseNumber || c.id} →
          </button>
        </div>
        <h3 class="radar-card-title">${c.title}</h3>
      </div>

      <!-- Explanation: Short "Why it matters" description -->
      <div class="radar-card-explanation">
        <strong>Why it matters:</strong> ${finding.explanation}
      </div>

      <!-- Evidence: Supporting record displayed in a visually distinct, subtle section -->
      <div class="radar-card-evidence">
        <span class="radar-evidence-label">Supporting Record:</span>
        <span class="radar-evidence-value">${finding.sourceEvidence}</span>
      </div>

      <!-- Actions: "Why was this flagged?" and "Take Action", aligned consistently at the bottom -->
      <div class="radar-card-actions">
        <button
          type="button"
          class="btn-subtle btn-sm radar-btn-explain"
          data-action="case-explain-finding"
          data-case="${c.id}"
          data-rule="${finding.ruleId}"
          title="Inspect why SyncAI flagged this case"
        >
          ${icon('sparkle', 14)} Why was this flagged?
        </button>

        <button
          type="button"
          class="btn-primary btn-sm radar-btn-act"
          data-action="case-inspect"
          data-id="${c.id}"
          data-tab="loose_ends"
          data-rule="${finding.ruleId}"
        >
          Take Action
        </button>
      </div>
    </div>
  `;
}

function renderCaseList(s, cases) {
  return html`
    <div class="table-wrap case-table-wrap">
      <table class="data-table capture-table case-table" aria-labelledby="cases-h">
        <thead>
          <tr>
            <th scope="col" class="th-case-title">Case / Location</th>
            <th scope="col" class="th-case-category">Category</th>
            <th scope="col" class="th-case-status">Status</th>
            <th scope="col" class="th-case-officer">Assigned Officer</th>
            <th scope="col" class="th-case-deadlines">Deadlines (SGT)</th>
            <th scope="col" class="th-case-actions" style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map((c) => {
            const ends = detectLooseEnds(s, c);
            const isBlocked = (c.blockers || []).some((b) => !b.resolved);
            const statusClass = c.status === 'closed' || c.status === 'Closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : isBlocked ? 'tag-warning' : 'tag-brand';

            return html`
              <tr>
                <td data-label="Case / Location">
                  <div class="case-cell-primary">
                    <span class="case-number-badge">${c.number || c.caseNumber || c.id}</span>
                    <a class="case-title-link" href="#cases/${c.id}">${c.title}</a>
                    ${c.location ? html`<span class="case-location-tag">${icon('pin', 12)} ${c.location}</span>` : ''}
                  </div>
                </td>
                <td data-label="Category"><span class="tag tag-neutral small">${c.category}</span></td>
                <td data-label="Status">
                  <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                    <span class="tag ${statusClass}">${c.status}</span>
                    ${isBlocked ? html`<span class="tag tag-danger small" style="display: inline-flex; align-items: center; gap: 4px;">${icon('alert', 12)} Blocked</span>` : ''}
                  </div>
                </td>
                <td data-label="Assigned officer">${officerName(s, c.ownerId)}</td>
                <td data-label="Deadlines (SGT)">${recordedDeadlines(c)}</td>
                <td data-label="Actions" class="case-actions-cell" style="text-align: right;">
                  <div class="case-actions-group">
                    ${ends.length > 0
                      ? html`
                          <button
                            type="button"
                            class="tag tag-warning small"
                            data-action="case-inspect"
                            data-id="${c.id}"
                            data-tab="loose_ends"
                            title="${ends.length} Attention items"
                            style="cursor: pointer; border: 1px solid var(--colorPaletteMarigoldBorderActive); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"
                          >
                            ${icon('radar', 12)} ${ends.length} Follow-Up${ends.length > 1 ? 's' : ''}
                          </button>
                        `
                      : ''}
                    <button type="button" class="btn-primary btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="timeline">
                      View Case
                    </button>
                  </div>
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
    <div class="kanban-board-container" style="padding: 20px 24px;">
      <div class="kanban-board">
        ${KANBAN_COLUMNS.map((col) => {
          const colCases = cases.filter((c) => getCaseKanbanColumn(c) === col.id);
          return html`
            <div class="kanban-col">
              <div class="kanban-col-header">
                <strong class="kanban-col-title">${col.title}</strong>
                <span class="tag ${col.badgeClass} small">${colCases.length}</span>
              </div>

              <div class="kanban-cards-wrapper">
                ${colCases.length === 0
                  ? html`<div class="kanban-empty-col">No cases in this stage</div>`
                  : colCases.map((c) => {
                      const ends = detectLooseEnds(s, c);
                      const isBlocked = (c.blockers || []).some((b) => !b.resolved);
                      return html`
                        <div
                          class="kanban-case-card"
                          tabindex="0"
                          role="region"
                          aria-label="${c.title}"
                          style="border-left-color: ${ends.length > 0 ? 'var(--colorPaletteMarigoldBorderActive)' : isBlocked ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorBrandStroke1)'};"
                        >
                          <div class="kanban-card-top">
                            <span class="case-number-badge">${c.number || c.caseNumber || c.id}</span>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                              ${isBlocked ? html`<span class="tag tag-danger small">Blocked</span>` : ''}
                              <span class="tag ${c.urgency === 'Critical' ? 'tag-danger' : 'tag-neutral'} small">${c.urgency || 'Standard'}</span>
                            </div>
                          </div>

                          <a href="#cases/${c.id}" class="kanban-card-link">${c.title}</a>

                          <div class="kanban-card-meta muted">
                            <span style="display: inline-flex; align-items: center; gap: 4px;">
                              ${icon('users', 12)} ${officerName(s, c.ownerId)}
                            </span>
                            ${c.location ? html`<span style="display: inline-flex; align-items: center; gap: 4px;">${icon('pin', 12)} ${c.location}</span>` : ''}
                          </div>

                          ${ends.length > 0
                            ? html`
                                <button
                                  type="button"
                                  class="tag tag-warning small kanban-followup-btn"
                                  data-action="case-explain-finding"
                                  data-case="${c.id}"
                                  data-rule="${ends[0].ruleId}"
                                >
                                  ${icon('radar', 12)} ${ends.length} Follow-Up${ends.length > 1 ? 's' : ''} (Explain)
                                </button>
                              `
                            : ''}

                          <div class="kanban-card-footer">
                            <button type="button" class="btn-primary btn-sm" data-action="case-inspect" data-id="${c.id}" data-tab="timeline">
                              View Case
                            </button>
                          </div>
                        </div>
                      `;
                    })}
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

function renderCaseJourneyModal(s, c) {
  if (!c) return '';
  const readiness = checkClosureReadiness(s, c);
  const looseEnds = detectLooseEnds(s, c);
  const comms = getCommunications(s, c.id);
  const activeBlockers = (c.blockers || []).filter((b) => !b.resolved);

  const pendingClosure = (s.approvals || []).find(
    (a) => a.caseId === c.id && (a.requestType === 'case_closure' || a.requestType === 'closure') && a.status === 'pending'
  );

  return html`
    <div class="modal-backdrop is-open" data-action="case-modal-close" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: flex-end;">
      <div
        class="drawer-panel"
        onclick="event.stopPropagation()"
        style="width: min(100%, 720px); height: 100%; background: var(--colorNeutralBackground1); display: flex; flex-direction: column; box-shadow: var(--shadow64); animation: slideInRight 0.25s cubic-bezier(0,0,0.2,1);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-drawer-title"
        tabindex="-1"
      >
        <!-- Drawer Header -->
        <div class="drawer-header" style="padding: 18px 24px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: flex-start; background: var(--colorNeutralBackground2); gap: 16px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="case-number" style="font-family: monospace; font-size: 0.8125rem; font-weight: 700; color: var(--colorBrandForeground1);">${c.number || c.caseNumber || c.id}</span>
              <span class="tag ${c.status === 'closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : 'tag-brand'} small">${c.status}</span>
              ${pendingClosure ? html`<span class="tag tag-warning small">${icon('clock', 12)} Pending Sign-Off</span>` : ''}
              ${c.location ? html`<span class="small muted" style="display: inline-flex; align-items: center; gap: 4px;">${icon('pin', 12)} ${c.location}</span>` : ''}
              <span class="small muted" style="display: inline-flex; align-items: center; gap: 4px; margin-left: auto;">
                ${icon('users', 12)} Assigned: <strong>${officerName(s, c.ownerId)}</strong>
              </span>
            </div>
            <h2 id="case-drawer-title" style="font-size: 1.1875rem; margin: 8px 0 0; line-height: 1.35; color: var(--colorNeutralForeground1); font-weight: 600;">${c.title}</h2>
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
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            ${pendingClosure
              ? html`<span class="tag tag-warning small" style="display: inline-flex; align-items: center; gap: 4px;">${icon('clock', 12)} Closure Pending Manager Sign-off</span>`
              : c.status !== 'closed' && !readiness.isReady ? html`
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
              ${c.status === 'closed'
                ? 'Case Closed &amp; Audited'
                : pendingClosure
                  ? 'Closure Pending Approval'
                  : isManager(s)
                    ? (readiness.isReady ? 'Close Case &amp; Sign Off' : 'Close Case (Manager Exception)')
                    : 'Close Case'}
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
      <!-- Add Operational Progress Note Form -->
      <div class="case-add-note-box" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="font-size: 0.875rem; display: flex; align-items: center; gap: 6px; color: var(--colorNeutralForeground1);">
            ${icon('edit', 14)} Add Operational Progress Note
          </strong>
          <span class="small muted">Updates case timeline &amp; shared audit state</span>
        </div>
        <form id="case-add-note-form" data-case="${c.id}" style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <select name="noteCategory" id="case-note-category" class="select-control" style="flex: 1; min-width: 160px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-size: 0.8125rem; background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);">
              <option value="Inspection Update">Inspection Update</option>
              <option value="Resident Contact">Resident Contact</option>
              <option value="Contractor Follow-up">Contractor Follow-up</option>
              <option value="Site Observation">Site Observation</option>
              <option value="Repair Progress">Repair Progress</option>
            </select>
          </div>
          <textarea
            name="noteContent"
            id="case-note-content"
            rows="2"
            placeholder="Record progress note (e.g. resident access confirmed, repair completed, water tested)..."
            style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.8125rem;"
            required
          ></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="submit" class="btn-primary btn-sm" data-action="case-submit-note" data-case="${c.id}">
              ${icon('plus', 12)} Add Note to Timeline
            </button>
          </div>
        </form>
      </div>

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
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                      <span class="small muted" style="font-size: 0.75rem;">Source: ${ev.source || 'SyncAI'} · Officer: ${ev.actor || officerName(s, c.ownerId)}</span>
                      ${ev.sourceRef || ev.evidenceId ? html`
                        <button type="button" class="btn-ghost btn-sm" data-action="case-jump-source" data-case="${c.id}" data-type="checkpoint" data-source-id="${ev.sourceRef || ev.evidenceId}" style="font-size: 0.7rem; padding: 1px 6px;">
                          View Evidence →
                        </button>
                      ` : ''}
                    </div>
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

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke3); flex-wrap: wrap; gap: 6px;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
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

                  <!-- Record Outcome / Resolve Follow-Up Button -->
                  <button
                    type="button"
                    class="btn-subtle btn-sm"
                    data-action="case-resolve-finding"
                    data-case="${c.id}"
                    data-rule="${l.ruleId}"
                    style="font-size: 0.75rem; color: var(--colorPaletteGreenForeground1); border-color: var(--colorPaletteGreenBorderActive); font-weight: 600;"
                    title="Record outcome and mark this operational commitment fulfilled"
                  >
                    ${icon('check', 12)} Record Outcome
                  </button>
                </div>

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
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button
            type="button"
            class="btn-subtle btn-sm"
            data-action="case-resolve-finding"
            data-case="${c.id}"
            data-rule="${exp.ruleId}"
            style="font-size: 0.75rem; color: var(--colorPaletteGreenForeground1); border-color: var(--colorPaletteGreenBorderActive); font-weight: 600;"
            title="Record outcome and mark this operational commitment fulfilled"
          >
            ${icon('check', 12)} Record Outcome / Resolve
          </button>
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
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; flex-wrap: wrap; gap: 8px;">
                ${(c.taskIds || []).length > 0
                  ? html`
                      <button
                        type="button"
                        class="btn-subtle btn-sm"
                        data-action="case-ripple-nav"
                        data-case="${c.id}"
                        data-task="${c.taskIds[0]}"
                        style="font-size: 0.75rem;"
                        title="Analyze downstream dependencies in Ripple Intelligence"
                      >
                        ${icon('trend', 12)} View Ripple Analysis
                      </button>
                    `
                  : '<span></span>'}
                ${!b.resolved
                  ? html`
                      <button type="button" class="btn-subtle btn-sm" data-action="case-resolve-blocker" data-case="${c.id}" data-blocker="${b.id}" style="font-size: 0.75rem; color: var(--colorPaletteGreenForeground1); border-color: var(--colorPaletteGreenBorderActive); font-weight: 600;">
                        ${icon('check', 12)} Mark Blocker Resolved
                      </button>
                    `
                  : ''}
              </div>
            </div>
          `)}
    </div>
  `;
}

function renderJourneyReadinessTab(s, c, readiness) {
  const checkpoints = c.checkpoints || [];
  const evidence = c.evidence || [];
  const pendingClosure = (s.approvals || []).find(
    (a) => a.caseId === c.id && (a.requestType === 'case_closure' || a.requestType === 'closure') && a.status === 'pending'
  );

  return html`
    <div style="display: flex; flex-direction: column; gap: 16px;">
      ${pendingClosure
        ? html`
            <div style="padding: 12px 14px; background: var(--colorPaletteMarigoldBackground1); border: 1px solid var(--colorPaletteMarigoldBorderActive); border-radius: 8px; font-size: 0.8125rem; color: var(--colorPaletteMarigoldForeground2); display: flex; align-items: center; gap: 8px;">
              ${icon('clock', 16)}
              <span><strong>Closure Sign-Off Submitted:</strong> Awaiting formal manager sign-off from Jennifer Ong.</span>
            </div>
          `
        : ''}

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
      <div class="filter-tabs" role="tablist" style="margin: 0; overflow-x: auto;">
        ${[
          ['all', 'All Channels', comms.length],
          ['in_app', 'In-App', comms.filter((m) => m.channel === 'in_app').length],
          ['whatsapp', 'WhatsApp (Simulated)', comms.filter((m) => m.channel === 'whatsapp').length],
          ['teams', 'Teams (Simulated)', comms.filter((m) => m.channel === 'teams').length],
          ['telegram', 'Telegram (Simulated)', comms.filter((m) => m.channel === 'telegram').length],
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
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Channel</label>
              <select name="channel" class="select-control" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);">
                <option value="in_app">In-App Portal</option>
                <option value="whatsapp">WhatsApp (Proposed)</option>
                <option value="teams">Microsoft Teams (Proposed)</option>
                <option value="telegram">Telegram (Proposed)</option>
              </select>
            </div>
            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Category</label>
              <select name="category" class="select-control" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1);">
                <option value="Resident Follow-up">Resident Follow-up</option>
                <option value="Contractor Query">Contractor Query</option>
                <option value="Inspection Scheduling">Inspection Scheduling</option>
                <option value="Status Update">Status Update</option>
              </select>
            </div>
          </div>
          <div>
            <label class="small muted" style="display: block; margin-bottom: 4px;">Message Summary / Notes</label>
            <textarea name="content" id="comm-manual-log-content" rows="2" placeholder="Record key points of the call or message..." required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.8125rem;"></textarea>
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
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="tag ${m.channel === 'whatsapp' ? 'tag-success' : m.channel === 'teams' ? 'tag-brand' : m.channel === 'telegram' ? 'tag-brand' : 'tag-neutral'} small">
                      ${m.channelLabel}
                    </span>
                    <strong style="font-size: 0.8125rem;">${m.sender}</strong>
                  </div>
                  <span class="small muted">${fmtTime(timePart(m.timestamp)) || m.timestamp}</span>
                </div>
                <p style="margin: 0; font-size: 0.8125rem; color: var(--colorNeutralForeground1); line-height: 1.4;">${m.content}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--colorNeutralStroke3); font-size: 0.75rem;" class="muted">
                  <span>Source: <em>${m.sourceLabel}</em></span>
                  <button type="button" class="btn-subtle btn-sm" data-action="comm-ack" data-id="${m.id}" style="font-size: 0.75rem; padding: 2px 8px;">
                    ${m.acknowledged ? '✓ Acknowledged (Click to undo)' : `${icon('check', 12)} Mark Acknowledged`}
                  </button>
                </div>
              </div>
            `)}
      </div>

      <!-- Suggested Reply & Follow-up Generator -->
      <div style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
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
          <button type="button" class="btn-subtle btn-sm" id="btn-copy-draft-reply" data-action="comm-copy-reply">
            ${icon('copy', 12)} Copy to Clipboard
          </button>
        </div>
      </div>

      <!-- Communication-to-Task Drafting (#076 — Stretch Feature) -->
      <div style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorBrandStroke2); border-radius: 8px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
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
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
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
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <span class="small muted">Deterministic Template · Factual State Intelligence</span>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn-subtle btn-sm" data-action="case-refresh-brief" data-case="${c.id}">
            ${icon('sparkle', 14)} Refresh Brief
          </button>
          <button type="button" class="btn-secondary btn-sm" id="btn-copy-case-brief" data-action="case-copy-brief" data-case="${c.id}">
            ${icon('copy', 14)} Copy Case Brief
          </button>
        </div>
      </div>
      <pre id="case-brief-text" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 0.8125rem; line-height: 1.5; white-space: pre-wrap; margin: 0;">${briefText}</pre>
    </div>
  `;
}
