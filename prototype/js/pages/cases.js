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
  requestCaseStageTransition,
  canTransitionCase,
  normalizeKanbanStage,
  getCaseEvidence,
  addCaseEvidence,
  verifyCaseEvidence,
  getEvidenceTypeLabel,
  recordCaseChange,
  getCaseChangeHistory,
  getCaseAssigneeHistory,
  getOfficerZone,
  getStructuredCaseBrief,
} from '../state.js';
import { CAPTURE_STATUSES, taskDateInput } from '../taskCapture.js';
import { TODAY, fmtDue, fmtLongDay, fmtTime, parseDate, timePart, getDeadlineCountdown } from '../time.js';
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

export function renderDeadlineBadge(countdown) {
  if (!countdown || countdown.state === 'none' || countdown.isNone) {
    return html`<span class="deadline-badge deadline-badge-none" title="No deadline recorded">No deadline</span>`;
  }
  let iconName = 'clock';
  let badgeClass = 'deadline-badge-upcoming';
  if (countdown.isOverdue) {
    iconName = 'alert';
    badgeClass = 'deadline-badge-overdue';
  } else if (countdown.isDueSoon) {
    iconName = 'clock';
    badgeClass = 'deadline-badge-soon';
  }
  return html`<span class="deadline-badge ${badgeClass}" title="${countdown.text}">
    ${icon(iconName, 12)} ${countdown.text}
  </span>`;
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
  journeyTab: 'timeline', // 'timeline' | 'loose_ends' | 'blockers' | 'readiness' | 'evidence' | 'history' | 'communications' | 'brief'
  activeExplanationRuleId: null, // when viewing an Evidence-Linked Explanation
  highlightedSourceId: null, // ID of source record to highlight
  commChannelFilter: 'all', // 'all' | 'in_app' | 'whatsapp' | 'teams' | 'telegram'
  extractedTaskDraft: null, // draft extracted from fictional message
  moveStageModalCaseId: null, // case ID when "Move to Stage" dialog is open
  transitionModal: null, // payload when consequential confirmation dialog is open
};

function recordedDeadlines(record) {
  const deadlines = [
    ['Response due', record.responseDue],
    ['Follow-up due', record.followUpDue],
  ].filter(([, value]) => value);
  if (!deadlines.length) return html`<span class="muted">No deadline recorded</span>`;
  return html`<dl class="case-deadlines">
    ${deadlines.map(([label, value]) => {
      const countdown = getDeadlineCountdown(value);
      return html`<div class="deadline-item">
        <dt class="deadline-label">${label}</dt>
        <dd class="deadline-val">
          <time datetime="${value}+08:00">${fmtCompactDeadline(value)}</time>
          ${renderDeadlineBadge(countdown)}
        </dd>
      </div>`;
    })}
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

    <!-- Section F: Accessible Move to Stage Dialog -->
    ${caseView.moveStageModalCaseId ? renderCaseMoveStageModal(s, caseView.moveStageModalCaseId) : ''}

    <!-- Section G: Consequential Stage Transition Confirmation Modal -->
    ${caseView.transitionModal ? renderCaseTransitionModal(s) : ''}
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
            <th scope="col" class="th-case-title">Case details</th>
            <th scope="col" class="th-case-workflow">Workflow</th>
            <th scope="col" class="th-case-deadlines">Deadlines (SGT)</th>
            <th scope="col" class="th-case-actions" style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map((c) => {
            const ends = detectLooseEnds(s, c);
            const isBlocked = (c.blockers || []).some((b) => !b.resolved);
            const colId = getCaseKanbanColumn(c);
            const stageCol = KANBAN_COLUMNS.find((k) => k.id === colId);
            const stageTitle = stageCol?.title || c.status;
            const statusClass = c.status === 'closed' || c.status === 'Closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : isBlocked ? 'tag-warning' : 'tag-brand';

            return html`
              <tr class="case-table-row" data-case-id="${c.id}" data-action="case-row-click" tabindex="0" role="button" aria-label="Open case ${c.number || c.caseNumber || c.id}: ${c.title}">
                <td data-label="Case details">
                  <div class="case-cell-primary">
                    <span class="case-number-badge" data-action="case-inspect" data-id="${c.id}" style="cursor: pointer;">${c.number || c.caseNumber || c.id}</span>
                    <a class="case-title-link" href="#cases/${c.id}" data-action="case-inspect" data-id="${c.id}">${c.title}</a>
                    <div class="case-detail-tags">
                      <span class="tag tag-neutral small">${c.category}</span>
                      ${c.location ? html`<span class="case-location-tag">${icon('pin', 12)} ${c.location}</span>` : ''}
                    </div>
                  </div>
                </td>
                <td data-label="Workflow">
                  <div class="case-workflow-cell">
                    <div class="case-workflow-status">
                      <span class="tag ${statusClass}">${stageTitle}</span>
                      ${isBlocked ? html`<span class="tag tag-danger small">${icon('alert', 12)} Blocked</span>` : ''}
                    </div>
                    <span class="case-officer-line">${icon('users', 13)} ${officerName(s, c.ownerId)}</span>
                  </div>
                </td>
                <td data-label="Deadlines (SGT)">${recordedDeadlines(c)}</td>
                <td data-label="Actions" class="case-actions-cell" style="text-align: right;">
                  <div class="case-actions-group">
                    ${ends.length > 0
                      ? html`
                          <button
                            type="button"
                            class="tag tag-warning small case-followup-action"
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
                    <button type="button" class="btn-primary btn-sm case-view-btn" data-action="case-inspect" data-id="${c.id}" data-tab="timeline" aria-label="View Case">
                      ${icon('eye', 14)} View
                    </button>
                    <button
                      type="button"
                      class="btn-secondary btn-sm"
                      data-action="case-move-stage-dialog"
                      data-case="${c.id}"
                      title="Move case to stage"
                    >
                      ${icon('arrow', 12)} Move
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
 * Kanban Board with Single-Column Classification and HTML5 Drag-and-Drop.
 * Each case is evaluated by getCaseKanbanColumn(c) and placed in exactly ONE column.
 * Duplication is eliminated. Real state changes occur when cards are dropped or moved.
 */
function renderCaseKanban(s, cases) {
  return html`
    <div class="kanban-board-container">
      <div class="kanban-board-guide">
        <span>${icon('columns', 15)} Workflow board</span>
        <span class="muted small">Drag a card between columns, or use “Move stage” for an accessible workflow.</span>
      </div>
      <div class="kanban-board">
        ${KANBAN_COLUMNS.map((col) => {
          const colCases = cases.filter((c) => getCaseKanbanColumn(c) === col.id);
          return html`
            <div class="kanban-col" data-col-id="${col.id}">
              <div class="kanban-col-header">
                <div class="kanban-col-header-left">
                  <span class="kanban-col-icon">${icon('columns', 14)}</span>
                  <strong class="kanban-col-title">${col.title}</strong>
                </div>
                <span class="tag ${col.badgeClass} small kanban-count-badge">${colCases.length}</span>
              </div>

              <div class="kanban-cards-wrapper" data-col-id="${col.id}">
                ${colCases.length === 0
                  ? html`<div class="kanban-empty-col" data-col-id="${col.id}">
                      <div class="kanban-empty-col-inner">
                        <span class="kanban-empty-icon" aria-hidden="true">${icon('columns', 20)}</span>
                        <span class="kanban-empty-text">No cases in stage</span>
                        <span class="kanban-empty-sub">Drag cards here</span>
                      </div>
                    </div>`
                  : colCases.map((c) => {
                      const ends = detectLooseEnds(s, c);
                      const isBlocked = (c.blockers || []).some((b) => !b.resolved);
                      return html`
                        <div
                          class="kanban-case-card"
                          draggable="true"
                          data-action="case-card-surface"
                          data-case-id="${c.id}"
                          data-case="${c.id}"
                          tabindex="0"
                          role="region"
                          aria-label="Case ${c.number || c.caseNumber || c.id}: ${c.title}. Stage: ${col.title}."
                          style="border-left-color: ${ends.length > 0 ? 'var(--colorPaletteMarigoldBorderActive)' : isBlocked ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorBrandStroke1)'};"
                        >
                          <div class="kanban-card-top">
                            <div class="kanban-card-top-left">
                              <span class="kanban-card-drag-affordance" title="Drag to move stage" aria-hidden="true">
                                ${icon('menu', 14)}
                              </span>
                              <span class="case-number-badge" data-action="case-inspect" data-id="${c.id}" style="cursor: pointer;">${c.number || c.caseNumber || c.id}</span>
                            </div>
                            <div class="kanban-card-badges">
                              ${isBlocked ? html`<span class="tag tag-danger small kanban-chip-blocked" style="display: inline-flex; align-items: center; gap: 3px;">${icon('alert', 11)} Blocked</span>` : ''}
                              <span class="tag ${c.urgency === 'Critical' ? 'tag-danger' : c.urgency === 'High' ? 'tag-warning' : 'tag-neutral'} small kanban-chip-urgency">${c.urgency || 'Standard'}</span>
                            </div>
                          </div>

                          <div class="kanban-card-body">
                            <h3 class="kanban-card-title">
                              <a href="#cases/${c.id}" class="kanban-card-link" data-action="case-inspect" data-id="${c.id}">${c.title}</a>
                            </h3>

                            <div class="kanban-card-meta muted">
                              <span class="kanban-meta-item">
                                ${icon('users', 12)} ${officerName(s, c.ownerId)}
                              </span>
                              ${c.location ? html`<span class="kanban-meta-item">${icon('pin', 12)} ${c.location}</span>` : ''}
                            </div>
                          </div>

                          <div class="kanban-card-indicators">
                            ${ends.length > 0
                              ? html`
                                  <button
                                    type="button"
                                    class="tag tag-warning small kanban-followup-btn"
                                    data-action="case-explain-finding"
                                    data-case="${c.id}"
                                    data-rule="${ends[0].ruleId}"
                                    title="${ends.length} Attention items"
                                  >
                                    ${icon('radar', 12)} <span>${ends.length} Follow-Up${ends.length > 1 ? 's' : ''} (Explain)</span>
                                  </button>
                                `
                              : ''}
                            ${(c.responseDue || c.followUpDue || c.slaDue)
                              ? html`
                                  <div class="kanban-deadline-tag-wrap" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                    ${renderDeadlineBadge(getDeadlineCountdown(c.responseDue || c.followUpDue || c.slaDue))}
                                    <span class="small muted kanban-deadline-date" style="font-size: 0.6875rem;">
                                      ${fmtCompactDeadline(c.responseDue || c.followUpDue || c.slaDue)}
                                    </span>
                                  </div>
                                `
                              : ''}
                          </div>

                          <div class="kanban-card-footer">
                            <button type="button" class="btn-primary btn-sm case-view-btn" data-action="case-inspect" data-id="${c.id}" data-tab="timeline">
                              ${icon('eye', 14)} View Case
                            </button>
                            <button
                              type="button"
                              class="btn-secondary btn-sm btn-move-stage"
                              data-action="case-move-stage-dialog"
                              data-case="${c.id}"
                              title="Move case to stage"
                            >
                              ${icon('arrow', 12)} Move to Stage
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

/**
 * Accessible Move to Stage Dialog for keyboard, mobile, and screen-reader operation.
 */
function renderCaseMoveStageModal(s, caseId) {
  const c = getCase(s, caseId);
  if (!c) return '';
  const currentStage = getCaseKanbanColumn(c);
  const currentStageCol = KANBAN_COLUMNS.find((col) => col.id === currentStage);

  return html`
    <div class="modal-backdrop is-open" data-action="case-move-stage-close" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1050; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div
        class="modal-card case-move-stage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-stage-title"
        style="max-width: 520px; width: 100%; max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; background: var(--colorNeutralBackground1); border-radius: 10px; box-shadow: var(--shadow64); padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;"
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid var(--colorNeutralStroke2); padding-bottom: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="case-number-badge">${c.number || c.caseNumber || c.id}</span>
              <span class="tag ${currentStageCol?.badgeClass || 'tag-neutral'} small">Current: ${currentStageCol?.title || currentStage}</span>
            </div>
            <h2 id="move-stage-title" style="font-size: 1.125rem; margin: 0; font-weight: 600; color: var(--colorNeutralForeground1); line-height: 1.35;">
              Move Case to Stage
            </h2>
            <p class="muted small" style="margin: 4px 0 0;">${c.title}</p>
          </div>
          <button type="button" class="drawer-close-btn" data-action="case-move-stage-close" aria-label="Close move to stage dialog" title="Close">
            ${icon('x', 18)}
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <p class="small" style="font-weight: 600; color: var(--colorNeutralForeground2); margin: 0;">Select Destination Workflow Stage:</p>
          <div class="case-stage-options-list" role="radiogroup" aria-label="Workflow stages" style="display: flex; flex-direction: column; gap: 6px;">
            ${KANBAN_COLUMNS.map((col) => {
              const check = canTransitionCase(s, c.id, col.id);
              const isCurrent = check.isCurrent;

              return html`
                <div
                  class="case-stage-option-row ${isCurrent ? 'is-current' : check.permitted ? 'is-permitted' : 'is-disabled'}"
                  style="border: 1px solid ${isCurrent ? 'var(--colorBrandStroke1)' : check.permitted ? 'var(--colorNeutralStroke1)' : 'var(--colorNeutralStroke3)'}; background: ${isCurrent ? 'var(--colorBrandBackground2)' : check.permitted ? 'var(--colorNeutralBackground1)' : 'var(--colorNeutralBackground3)'}; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;"
                >
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <strong style="font-size: 0.875rem; color: ${check.permitted || isCurrent ? 'var(--colorNeutralForeground1)' : 'var(--colorNeutralForeground4)'};">${col.title}</strong>
                      <span class="tag ${col.badgeClass} small">${col.id}</span>
                      ${isCurrent ? html`<span class="tag tag-brand small">Current Stage</span>` : ''}
                    </div>
                    <div class="small muted" style="margin-top: 4px; font-size: 0.75rem; color: ${check.permitted ? 'var(--colorNeutralForeground3)' : 'var(--colorPaletteRedForeground1)'};">
                      ${check.reason}
                    </div>
                  </div>

                  <div>
                    ${isCurrent
                      ? html`<span class="small muted" style="font-weight: 600; font-size: 0.8125rem;">Active</span>`
                      : check.permitted
                        ? html`
                            <button
                              type="button"
                              class="btn-primary btn-sm"
                              data-action="case-select-move-stage"
                              data-case="${c.id}"
                              data-target="${col.id}"
                              style="white-space: nowrap;"
                            >
                              ${check.requiresApproval ? 'Request Approval' : check.requiresReason ? 'Enter Reason & Move' : 'Move Here'}
                            </button>
                          `
                        : check.canResolveBlocker
                          ? html`
                              <button
                                type="button"
                                class="btn-secondary btn-sm"
                                data-action="case-resolve-blocker-and-move"
                                data-case="${c.id}"
                                data-blocker="${check.activeBlockers[0].id}"
                                data-target="${col.id}"
                                style="white-space: nowrap; font-size: 0.75rem;"
                                title="Resolve active blocker and resume In Progress"
                              >
                                Resolve &amp; Move
                              </button>
                            `
                          : html`
                              <button type="button" class="btn-subtle btn-sm" disabled style="opacity: 0.5; white-space: nowrap;">
                                Blocked
                              </button>
                            `}
                  </div>
                </div>
              `;
            })}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke2);">
          <button type="button" class="btn-ghost btn-sm" data-action="case-move-stage-close">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Consequential Stage Transition Confirmation Modal (7-step readable workflow).
 * Opens for hold reasons, manager approval requests, and manager exceptions.
 */
function renderCaseTransitionModal(s) {
  const modal = caseView.transitionModal;
  if (!modal) return '';
  const c = getCase(s, modal.caseId);
  if (!c) return '';

  const fromCol = KANBAN_COLUMNS.find((col) => col.id === modal.currentStage);
  const toCol = KANBAN_COLUMNS.find((col) => col.id === modal.targetStage);

  const fromTitle = fromCol?.title || modal.currentStage;
  const toTitle = toCol?.title || modal.targetStage;

  let headerTitle = 'Confirm Stage Move';
  let bannerHtml = '';
  let reasonLabel = 'Operational Reason / Note';
  let placeholder = 'Explain the operational context for this transition...';
  let confirmBtnLabel = 'Confirm Transition';

  if (modal.requiresApproval) {
    headerTitle = 'Request Manager Closure Sign-Off';
    bannerHtml = html`
      <div class="callout callout-warning" style="background: var(--colorPaletteMarigoldBackground1); border: 1px solid var(--colorPaletteMarigoldBorderActive); border-radius: 6px; padding: 10px 12px; font-size: 0.8125rem; color: var(--colorNeutralForeground1);">
        <strong>${icon('clock', 14)} Manager Sign-Off Required:</strong> As a Property Officer, moving a case to <strong>Closed &amp; Audited</strong> submits an auditable closure approval request to Estate Manager Jennifer Ong.
      </div>
    `;
    reasonLabel = 'Closure Request Justification';
    placeholder = 'Describe completed inspection findings and verification details for manager audit...';
    confirmBtnLabel = 'Submit for Approval';
  } else if (modal.isException) {
    headerTitle = 'Manager Exception Case Closure';
    bannerHtml = html`
      <div class="callout callout-warning" style="background: var(--colorPaletteMarigoldBackground1); border: 1px solid var(--colorPaletteMarigoldBorderActive); border-radius: 6px; padding: 10px 12px; font-size: 0.8125rem; color: var(--colorNeutralForeground1);">
        <strong style="color: #000000;">${icon('alert', 14)} Incomplete Checklist Exception:</strong> This case has incomplete prerequisites: <strong style="color: #000000;">${modal.unresolvedItems?.join(', ') || 'Requirements pending'}</strong>. Estate Manager authorization requires an auditable exception memo.
      </div>
    `;
    reasonLabel = 'Auditable Manager Exception Memo (Required)';
    placeholder = 'Document why statutory closure is granted despite outstanding prerequisites...';
    confirmBtnLabel = 'Authorize Closure (Exception)';
  } else if (modal.targetStage === 'pending_external') {
    headerTitle = 'Place Case on Hold (Awaiting External)';
    bannerHtml = html`
      <div class="callout callout-info" style="background: var(--colorBrandBackground2); border: 1px solid var(--colorBrandStroke2); border-radius: 6px; padding: 10px 12px; font-size: 0.8125rem; color: var(--colorBrandForeground1);">
        <strong>${icon('info', 14)} Blocker Record Creation:</strong> State the external dependency (e.g. upper unit tenant unreachable, contractor quotation pending, BCA specialist schedule). This will create an active blocker record in the case tracker.
      </div>
    `;
    reasonLabel = 'Hold / Blocker Reason (Required, min 4 characters)';
    placeholder = 'e.g. Upper unit tenant unreachable for joint inspection scheduling...';
    confirmBtnLabel = 'Place on Hold';
  } else if (modal.currentStage === 'closed') {
    headerTitle = 'Reopen Closed Case';
    bannerHtml = html`
      <div class="callout callout-warning" style="background: var(--colorPaletteMarigoldBackground1); border: 1px solid var(--colorPaletteMarigoldBorderActive); border-radius: 6px; padding: 10px 12px; font-size: 0.8125rem; color: var(--colorNeutralForeground1);">
        <strong>${icon('alert', 14)} Manager Reopen Audit:</strong> Reopening a closed case alters the statutory compliance record. An auditable reason must be logged to the case timeline and activity ledger.
      </div>
    `;
    reasonLabel = 'Auditable Reopen Reason (Required, min 4 characters)';
    placeholder = 'e.g. Resident reported recurring moisture seepage; reopening for second-tier contractor inspection...';
    confirmBtnLabel = 'Confirm Reopen';
  }

  return html`
    <div class="modal-backdrop is-open" data-action="case-transition-cancel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div
        class="modal-card case-transition-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transition-confirm-title"
        style="max-width: 560px; width: 100%; background: var(--colorNeutralBackground1); border-radius: 10px; box-shadow: var(--shadow64); padding: 22px; display: flex; flex-direction: column; gap: 14px;"
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid var(--colorNeutralStroke2); padding-bottom: 10px;">
          <div>
            <h2 id="transition-confirm-title" style="font-size: 1.125rem; margin: 0; font-weight: 600; color: var(--colorNeutralForeground1);">
              ${headerTitle}
            </h2>
            <p class="muted small" style="margin: 4px 0 0;">
              <strong>${c.number || c.caseNumber || c.id}</strong> — ${c.title}
            </p>
          </div>
          <button type="button" class="drawer-close-btn" data-action="case-transition-cancel" aria-label="Cancel transition" title="Close">
            ${icon('x', 18)}
          </button>
        </div>

        <!-- 7-Step Workflow Layout -->

        <!-- Step 1: Case Summary -->
        <div class="transition-step transition-step-summary" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
            <span class="case-number-badge">${c.number || c.caseNumber || c.id}</span>
            <span class="tag tag-neutral small">${c.category || 'Estate Case'}</span>
          </div>
          <strong style="font-size: 0.875rem; color: var(--colorNeutralForeground1); display: block; margin-bottom: 2px;">${c.title}</strong>
          <div class="small muted" style="font-size: 0.75rem;">
            <span>${icon('users', 12)} Officer: <strong>${officerName(s, c.ownerId)}</strong></span>
            ${c.location ? html` · <span>${icon('pin', 12)} ${c.location}</span>` : ''}
          </div>
        </div>

        <!-- Step 2: Stage Progression -->
        <div class="transition-step transition-step-progression" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="text-align: left;">
            <span class="small muted" style="display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Current Stage</span>
            <span class="tag ${fromCol?.badgeClass || 'tag-neutral'}" style="margin-top: 2px;">${fromTitle}</span>
          </div>
          <span style="color: var(--colorNeutralForeground3); font-size: 1.25rem; font-weight: 700;">→</span>
          <div style="text-align: right;">
            <span class="small muted" style="display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Target Stage</span>
            <span class="tag ${toCol?.badgeClass || 'tag-brand'}" style="margin-top: 2px;">${toTitle}</span>
          </div>
        </div>

        <!-- Step 3: Statutory & Compliance Justification Banner -->
        ${bannerHtml}

        <!-- Step 4: Checklist & Prerequisites Inspection -->
        <div class="transition-step transition-step-requirements" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 10px 14px;">
          <span class="small" style="font-weight: 600; display: block; margin-bottom: 6px; color: var(--colorNeutralForeground1);">
            Prerequisites &amp; Statutory Checklist:
          </span>
          ${(c.checkpoints && c.checkpoints.length > 0)
            ? html`
                <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem;">
                  ${c.checkpoints.map((cp) => html`
                    <li style="display: flex; align-items: center; gap: 6px; color: ${cp.completed ? 'var(--colorPaletteGreenForeground1)' : 'var(--colorPaletteMarigoldForeground1)'};">
                      <span>${cp.completed ? '✓' : '○'}</span>
                      <span>${cp.title} — <strong>${cp.completed ? 'Verified' : 'Pending'}</strong></span>
                    </li>
                  `)}
                </ul>
              `
            : html`<span class="small muted">Standard operational verification criteria apply.</span>`}
        </div>

        <!-- Step 5: Auditable Memo / Reason Input -->
        <div>
          <label for="case-transition-reason-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px; color: var(--colorNeutralForeground1);">
            ${reasonLabel} <span style="color: var(--colorPaletteRedForeground1);">*</span>
          </label>
          <textarea
            id="case-transition-reason-input"
            class="search-input"
            rows="3"
            style="width: 100%; box-sizing: border-box; font-family: inherit; font-size: 0.875rem; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1);"
            placeholder="${placeholder}"
          ></textarea>
          <p class="small muted" style="margin: 3px 0 0; font-size: 0.6875rem;">Minimum 4 characters required for statutory audit compliance.</p>
        </div>

        <!-- Step 6: Post-Submission Explanation -->
        <div class="transition-step transition-step-post-submission" style="background: var(--colorNeutralBackground3); border-radius: 6px; padding: 8px 12px; font-size: 0.75rem; color: var(--colorNeutralForeground3); line-height: 1.4;">
          <strong>Post-Submission Effect:</strong> Upon confirmation, this change is written to the immutable audit ledger. Notifications are dispatched to relevant team officers and Town Council stakeholders.
        </div>

        <!-- Step 7: Action Controls -->
        <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke2);">
          <button type="button" class="btn-ghost btn-sm" data-action="case-transition-cancel">Cancel</button>
          <button
            type="button"
            class="btn-primary btn-sm"
            data-action="case-transition-confirm"
            data-case="${c.id}"
            data-target="${modal.targetStage}"
          >
            ${confirmBtnLabel}
          </button>
        </div>
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
    (a) => a.caseId === c.id && (a.requestType === 'case_closure' || a.requestType === 'closure') && a.status === 'pending',
  );
  const evidenceList = getCaseEvidence(s, c.id);
  const changeHistory = getCaseChangeHistory(s, c.id);

  const STAGE_LABELS = {
    new: 'New Intake',
    investigating: 'Active Investigation',
    pending_action: 'Pending Action',
    ready_for_closure: 'Closure Ready',
    closed: 'Closed & Audited',
  };
  const humanStatus = STAGE_LABELS[c.status] || c.status;
  const caseDeadline = c.responseDue || c.followUpDue || c.slaDue;
  const countdown = caseDeadline ? getDeadlineCountdown(caseDeadline) : null;

  return html`
    <div class="modal-backdrop is-open case-workspace-backdrop" data-action="case-modal-close">
      <div
        class="drawer-panel case-detail-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-drawer-title"
        tabindex="-1"
      >
        <!-- Drawer Header -->
        <div class="drawer-header case-detail-header">
          <div class="case-detail-heading">
            <div class="case-detail-kicker">
              <span class="case-number">${c.number || c.caseNumber || c.id}</span>
              <span class="tag ${c.status === 'closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : 'tag-brand'} small" style="font-weight: 600;">${humanStatus}</span>
              ${c.category ? html`<span class="tag tag-neutral small" style="font-weight: 600;">${c.category.toUpperCase()}</span>` : ''}
              ${countdown ? renderDeadlineBadge(countdown) : ''}
              ${pendingClosure ? html`<span class="tag tag-warning small" style="color: #000000; font-weight: 700;">${icon('clock', 12)} Pending Sign-Off</span>` : ''}
              ${c.safetyHazard ? html`<span class="tag tag-danger small" style="font-weight: 600;" title="${c.safetyDetails || 'Safety Hazard'}">${icon('alert', 12)} Safety Hazard</span>` : ''}
              ${c.location ? html`<span class="small muted case-detail-location">${icon('pin', 12)} ${c.location}</span>` : ''}
            </div>
            <h2 id="case-drawer-title">${c.title}</h2>
            <div class="case-detail-owner-row">
              <button
                type="button"
                class="btn-ghost btn-sm case-owner-button"
                data-action="case-reassign-dialog"
                data-case="${c.id}"
                title="Click to reassign this case"
              >
                ${icon('users', 12)} Assigned: <strong>${officerName(s, c.ownerId)}</strong>
              </button>
              <span class="case-detail-readiness ${readiness.isReady ? 'is-ready' : ''}" style="${!readiness.isReady ? 'color: #000000 !important; font-weight: 700;' : ''}">
                ${icon(readiness.isReady ? 'check' : 'clock', 13)} ${readiness.isReady ? 'Ready for closure' : `${readiness.unresolvedItems.length} closure item${readiness.unresolvedItems.length === 1 ? '' : 's'} pending`}
              </span>
              ${c.status !== 'closed' ? html`
                <button
                  type="button"
                  class="btn-subtle btn-sm"
                  data-action="case-move-stage-dialog"
                  data-case="${c.id}"
                  style="font-size: 0.75rem; padding: 2px 8px; font-weight: 600;"
                  title="Move case workflow stage"
                >
                  ${icon('trend', 12)} Move Stage...
                </button>
              ` : ''}
            </div>
          </div>
          <button type="button" class="drawer-close-btn" data-action="case-modal-close" aria-label="Close drawer" title="Close drawer">
            ${icon('x', 20)}
          </button>
        </div>

        <!-- Responsive Wrapped Navigation Tabs -->
        <div class="case-detail-main">
        <nav class="drawer-tabs-nav case-detail-nav" role="tablist" aria-label="Case detail sections">
          ${[
            ['timeline', 'Timeline & Notes', null, 'history'],
            ['loose_ends', 'Outstanding Follow-Ups', looseEnds.length, 'radar'],
            ['blockers', 'Blockers', activeBlockers.length, 'alert'],
            ['readiness', 'Ready to Close?', readiness.isReady ? 'Ready' : 'Incomplete', 'check'],
            ['evidence', 'Evidence & Docs', evidenceList.length, 'folder'],
            ['history', 'History & Changes', changeHistory.length, 'clock'],
            ['communications', 'Communications', comms.length, 'message'],
            ['brief', 'AI Case Brief', null, 'sparkle'],
          ].map(
            ([tabKey, label, count, iconName]) => html`
              <button
                type="button"
                class="filter-tab drawer-tab-btn ${caseView.journeyTab === tabKey ? 'is-active' : ''}"
                data-action="case-journey-tab"
                data-tab="${tabKey}"
                role="tab"
                aria-selected="${caseView.journeyTab === tabKey ? 'true' : 'false'}"
              >
                <span class="drawer-tab-btn-content" style="display: inline-flex; align-items: center; gap: 8px; min-width: 0;">
                  <span class="drawer-tab-icon" style="display: inline-flex; flex-shrink: 0;">${icon(iconName, 14)}</span>
                  <span class="drawer-tab-label" style="white-space: nowrap;">${label}</span>
                </span>
                ${tabKey === 'readiness' && count === 'Incomplete'
                  ? html`<span class="tab-count tab-count-incomplete tab-count-alert-circle" data-status="incomplete" title="Incomplete: ${readiness.unresolvedItems.length} checklist requirement(s) pending" aria-label="Incomplete requirements" style="color: #ffffff !important; background: var(--colorPaletteRedBackground3, #d13438) !important; border: 1px solid #b2262a !important; width: 20px; height: 20px; min-width: 20px; max-width: 20px; border-radius: 50% !important; padding: 0 !important; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; line-height: 1; flex-shrink: 0; box-shadow: 0 1px 3px rgba(209, 52, 56, 0.35);">!</span>`
                  : tabKey === 'readiness' && count === 'Ready'
                    ? html`<span class="tab-count tab-count-success" data-status="ready" title="Ready for closure" aria-label="Ready for closure" style="color: #ffffff !important; background: #107c10 !important; border: 1px solid #0e6b0e; width: 20px; height: 20px; min-width: 20px; max-width: 20px; border-radius: 50% !important; padding: 0 !important; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; line-height: 1; flex-shrink: 0;">✓</span>`
                    : count != null
                      ? html`<span class="tab-count ${count > 0 && (tabKey === 'loose_ends' || tabKey === 'blockers') ? 'tab-count-warn' : ''}">${count}</span>`
                      : ''}
              </button>
            `,
          )}
        </nav>

        <div class="case-detail-content">

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
        <div class="case-detail-scroll">
          ${caseView.journeyTab === 'timeline'
            ? renderJourneyTimelineTab(s, c)
            : caseView.journeyTab === 'loose_ends'
              ? renderJourneyLooseEndsTab(s, c, looseEnds)
              : caseView.journeyTab === 'blockers'
                ? renderJourneyBlockersTab(s, c)
                : caseView.journeyTab === 'readiness'
                  ? renderJourneyReadinessTab(s, c, readiness)
                  : caseView.journeyTab === 'evidence'
                    ? renderJourneyEvidenceTab(s, c)
                    : caseView.journeyTab === 'history'
                      ? renderJourneyHistoryTab(s, c)
                      : caseView.journeyTab === 'communications'
                        ? renderJourneyCommunicationsTab(s, c, comms)
                        : renderJourneyBriefTab(s, c)}
        </div>

        </div>
        </div>

        <!-- Drawer Footer Actions -->
        <div class="drawer-footer case-detail-footer">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn-secondary btn-sm" data-action="case-reassign-dialog" data-case="${c.id}">
              ${icon('user-plus', 14)} Reassign Case
            </button>
            ${c.status !== 'closed' ? html`
              <button type="button" class="btn-secondary btn-sm" data-action="case-move-stage-dialog" data-case="${c.id}">
                ${icon('trend', 14)} Move Stage...
              </button>
            ` : ''}
            <button type="button" class="btn-subtle btn-sm" data-action="case-plan-nav" data-case="${c.id}">
              ${icon('calendar', 14)} View in Planner
            </button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            ${pendingClosure
              ? html`<span class="tag tag-warning small" style="display: inline-flex; align-items: center; gap: 4px; color: #000000; font-weight: 700;">${icon('clock', 12)} Closure Pending Manager Sign-off</span>`
              : c.status !== 'closed' && !readiness.isReady ? html`
              <button
                type="button"
                class="btn-ghost btn-sm"
                data-action="case-journey-tab"
                data-tab="readiness"
                title="View closure readiness checklist"
                style="font-size: 0.75rem; color: #000000; font-weight: 700; text-decoration: underline; cursor: pointer; padding: 2px 6px;"
              >
                ${readiness.unresolvedItems.length} checklist item${readiness.unresolvedItems.length === 1 ? '' : 's'} pending
              </button>
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
            style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1); font-family: inherit; font-size: 0.8125rem;"
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
                        title="View downstream dependencies for the linked task"
                      >
                        ${icon('trend', 12)} View Task Dependencies
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

      <div class="readiness-summary-card" style="padding: 16px; border-radius: 10px; border: 1px solid ${readiness.isReady ? 'var(--colorPaletteGreenBorderActive, #107c10)' : 'var(--colorPaletteMarigoldBorderActive, #f9a825)'}; background: ${readiness.isReady ? 'var(--colorPaletteGreenBackground1, #e7f7ef)' : 'var(--colorPaletteMarigoldBackground1, #fff8e1)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <strong style="color: ${readiness.isReady ? 'var(--colorPaletteGreenForeground1, #0b6b43)' : '#000000'}; display: flex; align-items: center; gap: 8px; font-size: 0.9375rem;">
            ${icon(readiness.isReady ? 'check' : 'alert', 18)}
            ${readiness.isReady ? 'All Checkpoints Satisfied — Ready for Closure' : `Closure Incomplete — ${readiness.unresolvedItems.length} Requirements Outstanding`}
          </strong>
          <span class="tag ${readiness.isReady ? 'tag-success' : 'tag-warning'} small" style="font-weight: 700; color: #000000;">
            ${readiness.isReady ? 'Compliant &amp; Ready' : `${readiness.unresolvedItems.length} Incomplete`}
          </span>
        </div>
        ${readiness.isReady
          ? html`<p class="small" style="margin: 8px 0 0; color: var(--colorNeutralForeground1);">All statutory and operational requirements verified. Case is fully compliant and eligible for manager sign-off.</p>`
          : html`
              <p class="small" style="margin: 6px 0 10px; color: var(--colorNeutralForeground1); font-weight: 500;">
                The following mandatory criteria must be resolved before this case can be closed:
              </p>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${readiness.unresolvedItems.map((item) => {
                  let tagClass = 'tag-warning';
                  let itemType = 'Checkpoint';
                  let itemIcon = 'check';
                  let cleanText = item;
                  let shortcutAction = html`<span class="small muted" style="font-size: 0.71875rem; flex-shrink: 0;">Check off below ↓</span>`;

                  if (item.toLowerCase().startsWith('active blocker:')) {
                    tagClass = 'tag-danger';
                    itemType = 'Active Blocker';
                    itemIcon = 'alert';
                    cleanText = item.replace(/^active blocker:\s*/i, '');
                    shortcutAction = html`<button type="button" class="btn-subtle btn-sm" data-action="case-journey-tab" data-tab="blockers" style="font-size: 0.75rem; padding: 2px 8px; font-weight: 600; color: var(--colorBrandForeground1); flex-shrink: 0;">Resolve in Blockers →</button>`;
                  } else if (item.toLowerCase().startsWith('missing required evidence:')) {
                    tagClass = 'tag-danger';
                    itemType = 'Missing Evidence';
                    itemIcon = 'folder';
                    cleanText = item.replace(/^missing required evidence:\s*/i, '');
                    shortcutAction = html`<button type="button" class="btn-subtle btn-sm" data-action="case-journey-tab" data-tab="evidence" style="font-size: 0.75rem; padding: 2px 8px; font-weight: 600; color: var(--colorBrandForeground1); flex-shrink: 0;">Upload in Evidence →</button>`;
                  } else if (item.toLowerCase().startsWith('incomplete prerequisite:')) {
                    tagClass = 'tag-warning';
                    itemType = 'Prerequisite';
                    itemIcon = 'check';
                    cleanText = item.replace(/^incomplete prerequisite:\s*/i, '');
                  }
                  return html`
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 0.8125rem; background: var(--colorNeutralBackground1); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke3); flex-wrap: wrap;">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                        <span class="tag ${tagClass} small" style="flex-shrink: 0; font-size: 0.6875rem; font-weight: 700; padding: 2px 7px; color: #000000; display: inline-flex; align-items: center; gap: 4px;">
                          ${icon(itemIcon, 11)} ${itemType}
                        </span>
                        <span style="color: #000000; font-weight: 500; line-height: 1.4;">${cleanText}</span>
                      </div>
                      ${shortcutAction}
                    </div>
                  `;
                })}
              </div>
            `}
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
            <textarea name="content" id="comm-manual-log-content" rows="2" placeholder="Record key points of the call or message..." required style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1); font-family: inherit; font-size: 0.8125rem;"></textarea>
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
              <div class="comm-message-card" style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke2); border-left: 3px solid ${m.channel === 'whatsapp' ? '#25d366' : m.channel === 'teams' ? '#5b5fc7' : m.channel === 'telegram' ? '#229ed9' : 'var(--colorBrandStroke1)'}; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow2);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="tag ${m.channel === 'whatsapp' ? 'tag-success' : m.channel === 'teams' ? 'tag-brand' : m.channel === 'telegram' ? 'tag-brand' : 'tag-neutral'} small" style="font-weight: 600;">
                      ${m.channelLabel}
                    </span>
                    <strong style="font-size: 0.8125rem; color: var(--colorNeutralForeground1);">${m.sender}</strong>
                  </div>
                  <span class="small muted" style="font-size: 0.75rem;">${fmtTime(timePart(m.timestamp)) || m.timestamp}</span>
                </div>
                <p style="margin: 0; font-size: 0.8125rem; color: var(--colorNeutralForeground1); line-height: 1.45;">${m.content}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px; padding-top: 6px; border-top: 1px solid var(--colorNeutralStroke3); font-size: 0.75rem;" class="muted">
                  <span>Source: <em>${m.sourceLabel}</em></span>
                  <button type="button" class="btn-subtle btn-sm comm-ack-btn" data-action="comm-ack" data-id="${m.id}" style="font-size: 0.75rem; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                    ${m.acknowledged ? '✓ Acknowledged (Click to undo)' : html`${icon('check', 12)} Mark Acknowledged`}
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
          style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1); font-family: inherit; font-size: 0.8125rem; resize: vertical;"
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
          style="width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); background: var(--colorNeutralBackground1); color: var(--colorNeutralForeground1); font-family: inherit; font-size: 0.8125rem; resize: vertical;"
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
  const structured = getStructuredCaseBrief(s, c);
  if (!structured) {
    return html`<div class="empty-state">No brief available</div>`;
  }

  const primaryDeadline = structured.responseDue || structured.followUpDue || structured.slaDue;
  const countdown = primaryDeadline ? getDeadlineCountdown(primaryDeadline) : null;

  return html`
    <div class="case-brief-structured" style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Hidden pre containing clean plaintext for copy button -->
      <pre id="case-brief-text" style="display: none;" aria-hidden="true">${briefText}</pre>

      <!-- Action bar -->
      <div class="brief-action-bar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--colorNeutralStroke2); padding-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="tag tag-brand small" style="display: inline-flex; align-items: center; gap: 4px;">
            ${icon('sparkle', 12)} Deterministic Template
          </span>
          <span class="small muted">Factual State Intelligence · Town Council Protocol</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-subtle btn-sm" data-action="case-refresh-brief" data-case="${c.id}">
            ${icon('sparkle', 14)} Refresh Brief
          </button>
          <button type="button" class="btn-secondary btn-sm" id="btn-copy-case-brief" data-action="case-copy-brief" data-case="${c.id}">
            ${icon('copy', 14)} Copy Plaintext Brief
          </button>
        </div>
      </div>

      <!-- 1. Case Overview Card -->
      <div class="brief-card brief-overview-card" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
              <span class="case-number-badge">${structured.caseNumber}</span>
              <span class="tag ${structured.stage === 'closed' ? 'tag-neutral' : structured.stage === 'ready_for_closure' ? 'tag-success' : 'tag-brand'} small">${structured.stage}</span>
              <span class="tag ${structured.urgency === 'Critical' ? 'tag-danger' : 'tag-neutral'} small">${structured.urgency}</span>
              ${countdown ? renderDeadlineBadge(countdown) : ''}
            </div>
            <h3 style="font-size: 1.125rem; font-weight: 600; margin: 0 0 4px; color: var(--colorNeutralForeground1);">${structured.title}</h3>
            <p class="small muted" style="margin: 0;">${structured.category} · ${structured.location}</p>
          </div>
          <div style="text-align: right;">
            <div class="small muted">Assigned Officer</div>
            <strong style="font-size: 0.875rem; color: var(--colorNeutralForeground1);">${structured.officerZoneDisplay}</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--colorNeutralStroke2);">
          <div>
            <span class="small muted" style="display: block;">Response Due</span>
            <span style="font-size: 0.8125rem; font-weight: 600;">${structured.responseDue ? fmtCompactDeadline(structured.responseDue) : 'None'}</span>
          </div>
          <div>
            <span class="small muted" style="display: block;">Follow-Up Due</span>
            <span style="font-size: 0.8125rem; font-weight: 600;">${structured.followUpDue ? fmtCompactDeadline(structured.followUpDue) : 'None'}</span>
          </div>
          <div>
            <span class="small muted" style="display: block;">SLA Due</span>
            <span style="font-size: 0.8125rem; font-weight: 600;">${structured.slaDue ? fmtCompactDeadline(structured.slaDue) : 'None'}</span>
          </div>
        </div>
      </div>

      <!-- 2. What Happened? (Executive Summary) -->
      <div class="brief-card" style="border: 1px solid var(--colorNeutralStroke1); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 0.9375rem; font-weight: 600; margin: 0 0 8px; color: var(--colorNeutralForeground1); display: flex; align-items: center; gap: 6px;">
          ${icon('info', 16)} What Happened? (Executive Summary)
        </h4>
        <p style="font-size: 0.875rem; line-height: 1.5; color: var(--colorNeutralForeground2); margin: 0;">
          ${structured.summary}
        </p>
      </div>

      <!-- 3. Work Completed -->
      <div class="brief-card" style="border: 1px solid var(--colorNeutralStroke1); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 0.9375rem; font-weight: 600; margin: 0 0 10px; color: var(--colorNeutralForeground1); display: flex; align-items: center; gap: 6px;">
          ${icon('check', 16)} Work Completed
        </h4>
        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;">
          ${structured.completedWork.map(
            (w) => html`
              <li style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; background: var(--colorNeutralBackground2); border-radius: 6px; font-size: 0.8125rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--colorPaletteGreenForeground1);">${icon('check', 14)}</span>
                  <span><strong>${w.title}</strong></span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="tag ${w.isVerified ? 'tag-success' : 'tag-neutral'} small">${w.note}</span>
                  ${w.actor ? html`<span class="small muted">by ${w.actor}</span>` : ''}
                </div>
              </li>
            `,
          )}
        </ul>
      </div>

      <!-- 4. Outstanding Commitments & Loose Ends -->
      <div class="brief-card" style="border: 1px solid ${structured.looseEnds.length > 0 ? 'var(--colorPaletteMarigoldBorderActive)' : 'var(--colorNeutralStroke1)'}; border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="font-size: 0.9375rem; font-weight: 600; margin: 0; color: var(--colorNeutralForeground1); display: flex; align-items: center; gap: 6px;">
            ${icon('radar', 16)} Outstanding Commitments &amp; Loose Ends (${structured.looseEnds.length})
          </h4>
          ${structured.looseEnds.length > 0
            ? html`
                <button type="button" class="btn-ghost btn-sm" data-action="case-journey-tab" data-tab="loose_ends" style="font-size: 0.75rem;">
                  View in Follow-Ups Tab →
                </button>
              `
            : ''}
        </div>
        ${structured.looseEnds.length === 0
          ? html`<p class="small muted" style="margin: 0;">No unfulfilled operational loose ends detected.</p>`
          : html`
              <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;">
                ${structured.looseEnds.map(
                  (l) => html`
                    <li style="padding: 12px 14px; background: var(--colorPaletteMarigoldBackground1); border: 1px solid var(--colorPaletteMarigoldBorderActive); border-radius: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <strong style="font-size: 0.8125rem; color: var(--colorNeutralForeground1);">${l.ruleName}</strong>
                        <span class="tag tag-danger small" style="font-weight: 600;">${l.ruleCode || 'Unresolved'}</span>
                      </div>
                      <p class="small" style="margin: 4px 0 8px; color: var(--colorNeutralForeground2); line-height: 1.4;">${l.whyMatters}</p>
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; flex-wrap: wrap; gap: 8px; border-top: 1px dashed var(--colorPaletteMarigoldBorderActive); padding-top: 8px;">
                        <span class="muted" style="line-height: 1.35;"><strong>Action:</strong> ${l.suggestedAction}</span>
                        <button type="button" class="btn-secondary btn-sm" data-action="case-explain-finding" data-case="${c.id}" data-rule="${l.ruleId}" style="font-size: 0.75rem; padding: 3px 10px; white-space: nowrap; flex-shrink: 0;">
                          ${icon('eye', 12)} Inspect Finding
                        </button>
                      </div>
                    </li>
                  `,
                )}
              </ul>
            `}
      </div>

      <!-- 5. Recommended Next Actions -->
      <div class="brief-card" style="border: 1px solid var(--colorNeutralStroke1); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 0.9375rem; font-weight: 600; margin: 0 0 10px; color: var(--colorNeutralForeground1); display: flex; align-items: center; gap: 6px;">
          ${icon('arrow', 16)} Recommended Next Actions
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${structured.recommendations.map(
            (r, i) => html`
              <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; background: var(--colorNeutralBackground2); border-radius: 6px;">
                <span class="badge" style="background: var(--colorBrandBackground); color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;">${i + 1}</span>
                <div>
                  <strong style="font-size: 0.8125rem; color: var(--colorNeutralForeground1);">${r.action}</strong>
                  <p class="small muted" style="margin: 2px 0 0;">${r.reason}</p>
                </div>
              </div>
            `,
          )}
        </div>
      </div>

      <!-- 6. Statutory Closure Readiness Progress -->
      <div class="brief-card" style="border: 1px solid var(--colorNeutralStroke1); border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="font-size: 0.9375rem; font-weight: 600; margin: 0; color: var(--colorNeutralForeground1); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${icon('check', 16)} Statutory Closure Readiness <span class="tag ${structured.readiness.isReady ? 'tag-success' : 'tag-warning'}" style="color: #000000; font-weight: 700; font-size: 0.75rem; padding: 1px 8px; border-radius: 999px;">${structured.readiness.isReady ? 'Ready' : 'Incomplete'}</span>
          </h4>
          <button type="button" class="btn-ghost btn-sm" data-action="case-journey-tab" data-tab="readiness" style="font-size: 0.75rem;">
            Full Checklist →
          </button>
        </div>
        <p class="small" style="margin: 0 0 10px; color: var(--colorNeutralForeground2);">
          ${structured.readiness.isReady
            ? 'All mandatory operational checkpoints and evidence requirements have been verified. Ready for Estate Manager closure sign-off.'
            : `Pending requirements: ${structured.readiness.unresolvedItems.join(', ')}.`}
        </p>
      </div>

      <!-- 7. Supporting Records Jump Links -->
      <div class="brief-card" style="border: 1px solid var(--colorNeutralStroke1); border-radius: 8px; padding: 14px 16px; background: var(--colorNeutralBackground2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span class="small" style="font-weight: 600; color: var(--colorNeutralForeground1);">Jump to Supporting Case Records:</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-secondary btn-sm" data-action="case-journey-tab" data-tab="evidence" style="font-size: 0.75rem;">
              ${icon('folder', 12)} Evidence &amp; Docs (${structured.evidence.length})
            </button>
            <button type="button" class="btn-secondary btn-sm" data-action="case-journey-tab" data-tab="history" style="font-size: 0.75rem;">
              ${icon('clock', 12)} History &amp; Changes
            </button>
            <button type="button" class="btn-secondary btn-sm" data-action="case-journey-tab" data-tab="communications" style="font-size: 0.75rem;">
              ${icon('mail', 12)} Resident Comms
            </button>
            <button type="button" class="btn-secondary btn-sm" data-action="case-journey-tab" data-tab="timeline" style="font-size: 0.75rem;">
              ${icon('menu', 12)} Timeline &amp; Notes
            </button>
          </div>
        </div>
      </div>

      <!-- 8. Responsible AI Disclosures -->
      <div class="brief-card brief-disclaimer-card" style="background: var(--colorNeutralBackground3); border-radius: 8px; padding: 12px 14px; font-size: 0.75rem; color: var(--colorNeutralForeground3); line-height: 1.45;">
        <strong style="color: var(--colorNeutralForeground2); display: block; margin-bottom: 2px;">Responsible AI &amp; Town Council Governance Disclosure:</strong>
        This case brief is deterministically compiled from operational state records, checklist verifications, and Singapore Town Council statutory protocols. It does not generate hallucinations or invent unrecorded site facts. Factual gaps and missing evidence are explicitly identified. Officers must confirm physical site conditions before authorizing formal closure.
      </div>
    </div>
  `;
}

function renderJourneyEvidenceTab(s, c) {
  const evidence = getCaseEvidence(s, c.id);
  const isMgr = isManager(s);
  const verifiedCount = evidence.filter((e) => e.verified).length;
  const pendingCount = evidence.filter((e) => e.status === 'pending_review' || (!e.verified && !e.rejectedBy)).length;

  return html`
    <div class="evidence-tab-container" style="display: flex; flex-direction: column; gap: 18px;">
      <!-- Summary Bar -->
      <div class="evidence-summary-bar" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <strong style="font-size: 0.9375rem; color: var(--colorNeutralForeground1);">Evidence &amp; Verification Vault</strong>
          <p class="small muted" style="margin: 2px 0 0;">Mandatory documentation, inspection photos, and statutory completion sign-offs (#027).</p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="tag tag-success small">${verifiedCount} Verified</span>
          <span class="tag ${pendingCount > 0 ? 'tag-warning' : 'tag-neutral'} small">${pendingCount} Pending Review</span>
        </div>
      </div>

      <!-- Evidence List -->
      <div class="evidence-list-section">
        <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
          <h4 style="font-size: 0.875rem; font-weight: 600; margin: 0; color: var(--colorNeutralForeground1); display: inline-flex; align-items: center; gap: 6px;">
            ${icon('folder', 14)} Attached Records (${evidence.length})
          </h4>
          <span class="small muted" style="font-size: 0.75rem;">Verified on-site documentation and statutory inspection attachments</span>
        </div>
        ${evidence.length === 0
          ? html`<div class="empty-state" style="padding: 24px; text-align: center; background: var(--colorNeutralBackground2); border-radius: 8px;">
              <p class="muted small" style="margin: 0;">No evidence records attached yet. Use the demo upload form below to attach inspection documents.</p>
            </div>`
          : html`
              <div class="evidence-grid">
                ${evidence.map((e) => {
                  const isVerified = e.status === 'verified' || e.verified;
                  const isRejected = e.status === 'rejected';
                  const isPending = !isVerified && !isRejected;

                  return html`
                    <div class="evidence-card ${isVerified ? 'is-verified' : isRejected ? 'is-rejected' : 'is-pending'}" style="background: var(--colorNeutralBackground1); border: 1px solid ${isVerified ? 'var(--colorPaletteGreenBorderActive, #107c10)' : isRejected ? 'var(--colorPaletteRedBorderActive, #d13438)' : 'var(--colorPaletteMarigoldBorderActive, #f9a825)'}; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; box-shadow: var(--shadow4); box-sizing: border-box; overflow: hidden;">
                      <div>
                        <div class="evidence-card-badges" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
                          <span class="tag ${isVerified ? 'tag-success' : isRejected ? 'tag-danger' : 'tag-warning'} small" style="font-weight: 600; flex-shrink: 0;">
                            ${isVerified ? '✓ Verified' : isRejected ? '✗ Rejected' : '⏳ Pending Review'}
                          </span>
                          <span class="tag tag-neutral small evidence-type-pill" style="font-size: 0.71875rem; padding: 2px 8px; border-radius: 999px; flex-shrink: 0;" title="${e.typeLabel || getEvidenceTypeLabel(e.type)}">
                            ${(e.typeLabel || getEvidenceTypeLabel(e.type)).replace(/Supporting Document/i, 'Document')}
                          </span>
                        </div>

                        <h5 style="font-size: 0.875rem; font-weight: 600; margin: 0 0 6px; color: var(--colorNeutralForeground1); line-height: 1.35; min-height: 2.7em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${e.title}">${e.title}</h5>
                        <p class="small muted" style="margin: 0 0 8px; font-size: 0.75rem;">
                          <span>${e.fileName || 'document.pdf'} · ${e.fileSize || '1.5 MB'}</span>
                        </p>
                        <p style="font-size: 0.8125rem; color: var(--colorNeutralForeground2); line-height: 1.45; margin: 0 0 10px; min-height: 2.9em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${e.description || 'No description provided.'}</p>
                      </div>

                      <div style="border-top: 1px solid var(--colorNeutralStroke2); padding-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                        <div class="small muted" style="font-size: 0.6875rem; line-height: 1.3;">
                          <div>Uploaded by <strong>${e.uploadedBy || 'Property Officer'}</strong> ${e.uploadedAt ? `on ${fmtCompactDeadline(e.uploadedAt)}` : html`· <span style="color: #64748b; font-style: italic;">Pending site upload</span>`}</div>
                          ${isVerified ? html`<div style="color: var(--colorPaletteGreenForeground1); margin-top: 2px;">Verified by <strong>${e.verifiedBy}</strong> on ${fmtCompactDeadline(e.verifiedAt)}</div>` : ''}
                          ${isRejected ? html`<div style="color: var(--colorPaletteRedForeground1); margin-top: 2px;">Rejected by <strong>${e.rejectedBy}</strong>: ${e.rejectionReason}</div>` : ''}
                          ${e.requiredForClosure ? html`<div style="color: var(--colorBrandForeground1); font-weight: 600; margin-top: 2px;">★ Required for Case Closure</div>` : ''}
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                          <button type="button" class="btn-ghost btn-sm" data-action="case-preview-evidence" data-case="${c.id}" data-evidence="${e.id}" style="font-size: 0.75rem; padding: 2px 8px;">
                            ${icon('eye', 12)} View Document
                          </button>

                          ${isPending && isMgr
                            ? html`
                                <div style="display: flex; gap: 6px; align-items: center;">
                                  <button type="button" class="btn-primary btn-sm" data-action="case-verify-evidence" data-case="${c.id}" data-evidence="${e.id}" style="font-size: 0.75rem; padding: 3px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Verify record as meeting statutory standards">
                                    ${icon('check', 12)} Verify
                                  </button>
                                  <button type="button" class="btn-secondary btn-sm" data-action="case-reject-evidence" data-case="${c.id}" data-evidence="${e.id}" style="font-size: 0.75rem; padding: 3px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; color: var(--colorPaletteRedForeground1); border-color: var(--colorPaletteRedBorderActive);" title="Reject with mandatory reason">
                                    ${icon('x', 12)} Reject
                                  </button>
                                </div>
                              `
                            : isPending && !isMgr
                              ? html`<span class="small muted" style="font-size: 0.71875rem; font-style: italic;">Awaiting Manager sign-off</span>`
                              : ''}
                        </div>
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
      </div>

      <!-- Demo Local Upload Box -->
      <div class="evidence-upload-section" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 0.875rem; font-weight: 600; margin: 0 0 4px; color: var(--colorNeutralForeground1);">
          Attach Operational Evidence (Safe Demo Upload)
        </h4>
        <p class="small muted" style="margin: 0 0 12px; font-size: 0.75rem;">
          Upload inspection photos, completion notes, or BCA compliance reports. Local demo storage validated up to 5MB.
        </p>

        <form id="case-evidence-upload-form" data-case="${c.id}" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="evidence-form-row">
            <div>
              <label for="evidence-title-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px; color: var(--colorNeutralForeground1);">
                Evidence Title <span style="color: var(--colorPaletteRedForeground1);">*</span>
              </label>
              <input
                id="evidence-title-input"
                type="text"
                class="search-input"
                required
                minlength="3"
                placeholder="e.g. Blk 211 Joint Inspection Moisture Meter Readings"
                style="width: 100%; box-sizing: border-box; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1);"
              />
            </div>
            <div>
              <label for="evidence-type-select" class="small" style="font-weight: 600; display: block; margin-bottom: 4px; color: var(--colorNeutralForeground1);">
                Evidence Category
              </label>
              <select
                id="evidence-type-select"
                class="search-input"
                style="width: 100%; box-sizing: border-box; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1);"
              >
                <option value="photo">Inspection Photo</option>
                <option value="inspection_report">Inspection Report</option>
                <option value="completion_record">Work Completion Record</option>
                <option value="resident_ack">Resident Acknowledgement</option>
                <option value="document">Supporting Document</option>
              </select>
            </div>
          </div>

          <div class="evidence-upload-grid">
            <div>
              <label class="small" style="font-weight: 600; display: block; margin-bottom: 6px; color: var(--colorNeutralForeground1);">
                Attach File (Photo / Report / Doc)
              </label>
              <div
                id="evidence-dropzone"
                class="evidence-dropzone"
                tabindex="0"
                role="button"
                aria-label="Upload evidence file. Click or drag file here."
              >
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; pointer-events: none;">
                  <span style="color: var(--colorBrandForeground1);">${icon('upload', 20)}</span>
                  <span id="evidence-filename-display" style="font-size: 0.8125rem; font-weight: 600; color: var(--colorNeutralForeground1);">
                    Click to browse or drop file here
                  </span>
                  <span class="small muted" style="font-size: 0.6875rem;">
                    Supports JPG, PNG, PDF, DOC (max 5MB demo simulation)
                  </span>
                </div>
                <input
                  id="evidence-file-input"
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;"
                />
              </div>
            </div>

            <div>
              <label class="small" style="font-weight: 600; display: block; margin-bottom: 6px; color: var(--colorNeutralForeground1);">
                Statutory Closure Gate
              </label>
              <div class="evidence-closure-gate-tile" style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; min-height: 72px; box-sizing: border-box;">
                <input id="evidence-required-checkbox" type="checkbox" style="margin-top: 3px; cursor: pointer; width: 16px; height: 16px; flex-shrink: 0;" />
                <div>
                  <label for="evidence-required-checkbox" class="small" style="font-weight: 700; color: #000000; cursor: pointer; display: block; line-height: 1.3;">
                    Mandatory Checkpoint for Statutory Case Closure
                  </label>
                  <span class="small muted" style="font-size: 0.71875rem; line-height: 1.35; display: block; margin-top: 3px;">
                    When checked, this case cannot be closed until an Estate Manager reviews and signs off on this document.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label for="evidence-desc-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px; color: var(--colorNeutralForeground1);">
              Findings &amp; Verification Note
            </label>
            <textarea
              id="evidence-desc-input"
              class="search-input"
              rows="2"
              placeholder="Record observations, equipment measurements, or contractor verification details..."
              style="width: 100%; box-sizing: border-box; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.8125rem;"
            ></textarea>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px;">
            <span class="small muted" style="font-size: 0.6875rem;">
              Local client-side simulation. Files are processed within browser state.
            </span>
            <button type="submit" class="btn-primary btn-sm" data-action="case-submit-evidence">
              ${icon('plus', 12)} Attach Evidence
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderJourneyHistoryTab(s, c) {
  const assigneeHistory = getCaseAssigneeHistory(s, c.id);
  const changeHistory = getCaseChangeHistory(s, c.id);

  return html`
    <div class="history-tab-container" style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Section 1: Assignee History (#024) -->
      <div class="assignee-history-section" style="border: 1px solid var(--colorNeutralStroke1); border-radius: 8px; padding: 16px; background: var(--colorNeutralBackground1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h4 style="font-size: 0.9375rem; font-weight: 600; margin: 0; color: var(--colorNeutralForeground1); display: flex; align-items: center; gap: 6px;">
              ${icon('users', 16)} Assignee History &amp; Handover Audit (#024)
            </h4>
            <p class="small muted" style="margin: 2px 0 0;">Historical record of case ownership transitions and manager authorizations.</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" data-action="case-reassign-dialog" data-case="${c.id}">
            ${icon('user-plus', 14)} Request Reassignment
          </button>
        </div>

        ${assigneeHistory.length === 0
          ? html`<div class="empty-state" style="padding: 18px; text-align: center; background: var(--colorNeutralBackground2); border-radius: 6px;">
              <p class="muted small" style="margin: 0;">No previous reassignment recorded.</p>
            </div>`
          : html`
              <div class="assignee-history-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${assigneeHistory.map((h) => {
                  const isApproved = h.approvalStatus === 'approved';
                  const isRejected = h.approvalStatus === 'rejected';
                  const isPending = h.approvalStatus === 'pending';

                  return html`
                    <div class="history-card" style="padding: 12px 14px; background: var(--colorNeutralBackground2); border-left: 3px solid ${isApproved ? 'var(--colorPaletteGreenBorderActive, #107c10)' : isRejected ? 'var(--colorPaletteRedBorderActive, #d13438)' : 'var(--colorPaletteMarigoldBorderActive, #f9a825)'}; border-radius: 6px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                        <div>
                          <span style="font-size: 0.875rem; font-weight: 600; color: var(--colorNeutralForeground1);">
                            ${h.before?.assigneeName || 'Previous Officer'} → <strong>${h.after?.assigneeName || 'New Officer'}</strong>
                          </span>
                          <div class="small muted" style="margin-top: 2px;">
                            Requested by <strong>${h.requestedBy}</strong> on ${fmtCompactDeadline(h.timestamp)}
                          </div>
                        </div>
                        <span class="tag ${isApproved ? 'tag-success' : isRejected ? 'tag-danger' : 'tag-warning'} small">
                          ${isApproved ? '✓ Handover Approved' : isRejected ? '✗ Handover Declined' : '⏳ Pending Approval'}
                        </span>
                      </div>

                      <p class="small" style="margin: 8px 0 4px; color: var(--colorNeutralForeground2);">
                        <strong>Reason:</strong> ${h.reason}
                      </p>
                      ${h.approver
                        ? html`
                            <div class="small muted" style="font-size: 0.75rem;">
                              Decided by <strong>${h.approver}</strong> ${h.decidedAt ? `on ${fmtCompactDeadline(h.decidedAt)}` : ''}
                              ${h.decisionNote ? ` · "${h.decisionNote}"` : ''}
                            </div>
                          `
                        : ''}
                    </div>
                  `;
                })}
              </div>
            `}
      </div>

      <!-- Section 2: Task & Case Change Comparison (#029) -->
      <div class="change-comparison-section" style="border: 1px solid var(--colorNeutralStroke1); border-radius: 8px; padding: 16px; background: var(--colorNeutralBackground1);">
        <div style="margin-bottom: 12px;">
          <h4 style="font-size: 0.9375rem; font-weight: 600; margin: 0; color: var(--colorNeutralForeground1); display: flex; align-items: center; gap: 6px;">
            ${icon('columns', 16)} Task &amp; Case Change Comparison (#029)
          </h4>
          <p class="small muted" style="margin: 2px 0 0;">Before-and-after snapshots of case attributes (Assignee, Due Date, Stage, Priority).</p>
        </div>

        ${changeHistory.length === 0
          ? html`<div class="empty-state" style="padding: 18px; text-align: center; background: var(--colorNeutralBackground2); border-radius: 6px;">
              <p class="muted small" style="margin: 0;">No change snapshots recorded yet.</p>
            </div>`
          : html`
              <div class="change-history-list" style="display: flex; flex-direction: column; gap: 14px;">
                ${changeHistory.map((ch) => {
                  return html`
                    <div class="change-comparison-card" style="border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 12px 14px; background: var(--colorNeutralBackground2);">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                        <span class="tag tag-neutral small" style="font-weight: 600; text-transform: capitalize;">
                          ${ch.changeType.replace('_', ' ')}
                        </span>
                        <span class="small muted">${fmtCompactDeadline(ch.timestamp)} · by ${ch.requestedBy}</span>
                      </div>

                      <!-- Before vs After Grid -->
                      <div class="before-after-grid" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center;">
                        <!-- Before Box -->
                        <div class="change-box before-box" style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke2); border-radius: 6px; padding: 10px; font-size: 0.75rem;">
                          <strong class="muted" style="display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Before State</strong>
                          <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div><strong>Assignee:</strong> ${ch.before?.assigneeName || 'Unassigned'}</div>
                            <div><strong>Stage:</strong> ${ch.before?.stage || 'N/A'}</div>
                            <div><strong>Due:</strong> ${ch.before?.due ? fmtCompactDeadline(ch.before.due) : 'None'}</div>
                            <div><strong>Priority:</strong> ${ch.before?.priority || 'Standard'}</div>
                          </div>
                        </div>

                        <!-- Transition Arrow -->
                        <div style="font-size: 1.25rem; color: var(--colorBrandForeground1); font-weight: 700;">→</div>

                        <!-- After Box -->
                        <div class="change-box after-box" style="background: var(--colorBrandBackground2); border: 1px solid var(--colorBrandStroke2); border-radius: 6px; padding: 10px; font-size: 0.75rem;">
                          <strong style="color: var(--colorBrandForeground1); display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">After State</strong>
                          <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div><strong>Assignee:</strong> ${ch.after?.assigneeName || 'Unassigned'}</div>
                            <div><strong>Stage:</strong> ${ch.after?.stage || 'N/A'}</div>
                            <div><strong>Due:</strong> ${ch.after?.due ? fmtCompactDeadline(ch.after.due) : 'None'}</div>
                            <div><strong>Priority:</strong> ${ch.after?.priority || 'Standard'}</div>
                          </div>
                        </div>
                      </div>

                      <div class="small" style="margin-top: 8px; color: var(--colorNeutralForeground2);">
                        <strong>Audit Note:</strong> ${ch.reason}
                        ${ch.decisionNote ? html` · <em>Manager Decision: ${ch.decisionNote}</em>` : ''}
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
      </div>
    </div>
  `;
}
