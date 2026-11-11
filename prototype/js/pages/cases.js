// Case Action Centre — Category C: Task Visibility & Operational Loose-End Intelligence
import { html, raw, icon, priorityBadge, riskBadge, emptyState } from '../ui.js';
import {
  getCases,
  getCase,
  visibleCases,
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
import { TODAY, fmtDue } from '../time.js';

// Module view state
export const caseView = {
  activeTab: 'all', // 'all' | 'open' | 'radar' | 'blocked' | 'ready' | 'closed'
  viewMode: 'list', // 'list' | 'kanban'
  searchQuery: '',
  estateFilter: 'all',
  urgencyFilter: 'all',
  radarFilter: 'all', // 'all' | 'resident' | 'contractor' | 'inspection' | 'evidence' | 'closure'
  selectedCaseId: null,
  journeyTab: 'timeline', // 'timeline' | 'loose_ends' | 'readiness' | 'brief'
};

export default {
  caseView,
  render(s) {
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
        <div class="stat-body">
          <span class="stat-label">Active Workflows</span>
          <span class="stat-value">${totalOpen}</span>
          <span class="stat-sub">Across Zones A, B and C</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('alert', 20)}</span>
        <div class="stat-body">
          <span class="stat-label">Blocked Workflows</span>
          <span class="stat-value">${blockedCount}</span>
          <span class="stat-sub">Awaiting specialist/contractor</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('check', 20)}</span>
        <div class="stat-body">
          <span class="stat-label">Closure Approvals Pending</span>
          <span class="stat-value">${readyCount}</span>
          <span class="stat-sub">Ready for manager sign-off</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('shield', 20)}</span>
        <div class="stat-body">
          <span class="stat-label">Data Privacy Boundary</span>
          <span class="stat-value" style="font-size: 1.1rem; color: var(--colorPaletteGreenForeground1);">Enforced</span>
          <span class="stat-sub">Resident PII isolated</span>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="panel-icon" aria-hidden="true">${icon('shield', 20)}</span>
          <div>
            <h2>Data Protection & Governance Assurance</h2>
            <p class="muted small">Demonstration of Role-Based Access Control (RBAC) separation</p>
          </div>
        </div>
      </div>
      <div style="padding: 16px 20px; line-height: 1.6; display: grid; gap: 14px;">
        <p>
          <strong>Responsible AI Governance Notice:</strong> In this simulated environment, administrative accounts can manage accounts, provision teams, and review system audit records. Operational estate case details (resident phone numbers, private unit numbers, and specific water seepage photographs) are strictly segregated from administrators and available only to designated Property Officers and supervising Estate Managers.
        </p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button type="button" class="btn-secondary" data-action="quick-switch-role" data-role="member">
            Switch to Property Officer (Aisyah) →
          </button>
          <button type="button" class="btn-secondary" data-action="quick-switch-role" data-role="manager">
            Switch to Estate Manager (Jennifer) →
          </button>
        </div>
      </div>
    </div>
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
        <div class="stat-body">
          <span class="stat-label">Follow-Up Radar</span>
          <span class="stat-value">${allLooseEnds.length}</span>
          <span class="stat-sub">${allLooseEnds.filter((l) => l.severity === 'critical').length} critical loose ends</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('alert', 20)}</span>
        <div class="stat-body">
          <span class="stat-label">Case Blockers</span>
          <span class="stat-value">${blockedCases.length}</span>
          <span class="stat-sub">Awaiting specialist/contractor</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('check', 20)}</span>
        <div class="stat-body">
          <span class="stat-label">Closure Warnings</span>
          <span class="stat-value">${readyCases.length}</span>
          <span class="stat-sub">Require checklist validation</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" aria-hidden="true">${icon('sparkle', 20)}</span>
        <div class="stat-body">
          <span class="stat-label">Cross-Workstream Links</span>
          <span class="stat-value" style="font-size: 1.1rem; color: var(--colorBrandForeground1);">Smart Plan + Ripple</span>
          <span class="stat-sub">Connected shared state</span>
        </div>
      </div>
    </div>

    <!-- Section A: Follow-Up Radar (Signature Feature Banner) -->
    ${caseView.activeTab === 'radar' || allLooseEnds.length > 0 ? renderFollowUpRadar(s, allLooseEnds) : ''}

    <!-- Main Workspace Navigation & Toolbar -->
    <section class="panel" style="margin-top: 20px;" aria-label="Case Directory">
      <div class="toolbar-wrap" style="padding: 16px 20px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
        <div class="filter-tabs" role="tablist" aria-label="Filter cases">
          ${[
            ['all', 'All Cases', allCasesCount],
            ['open', 'Open Cases', openCases.length],
            ['radar', 'Follow-Up Radar', allLooseEnds.length],
            ['blocked', 'Blocked', blockedCases.length],
            ['ready', 'Closure Ready', readyCases.length],
            ['closed', 'Closed', cases.filter((c) => c.status === 'closed').length],
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

        <div style="display: flex; align-items: center; gap: 8px;">
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

      <!-- Filters Row -->
      <div style="padding: 12px 20px; background: var(--colorNeutralBackground2); border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
        <div class="search-input" style="flex: 1 1 240px; max-width: 380px;">
          <span class="search-icon" aria-hidden="true">${icon('search', 16)}</span>
          <input
            type="search"
            id="case-search-input"
            placeholder="Search by case #, title, estate, resident..."
            value="${caseView.searchQuery}"
            aria-label="Search cases"
            data-action="case-search"
          />
        </div>

        <select
          id="case-estate-filter"
          class="filter-tab"
          data-action="case-filter-estate"
          style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-size: 0.8125rem;"
          aria-label="Filter by estate"
        >
          <option value="all">All Estates & Blocks</option>
          <option value="Blk 211" ${caseView.estateFilter === 'Blk 211' ? 'selected' : ''}>Zone A — Blk 211</option>
          <option value="Blk 208" ${caseView.estateFilter === 'Blk 208' ? 'selected' : ''}>Zone A — Blk 208</option>
          <option value="Blk 214" ${caseView.estateFilter === 'Blk 214' ? 'selected' : ''}>Zone A — Blk 214</option>
          <option value="Blk 207" ${caseView.estateFilter === 'Blk 207' ? 'selected' : ''}>Zone A — Blk 207</option>
          <option value="Blk 310" ${caseView.estateFilter === 'Blk 310' ? 'selected' : ''}>Zone B — Blk 310</option>
          <option value="Blk 318" ${caseView.estateFilter === 'Blk 318' ? 'selected' : ''}>Zone B — Blk 318</option>
          <option value="Blk 322" ${caseView.estateFilter === 'Blk 322' ? 'selected' : ''}>Zone B — Blk 322</option>
        </select>

        <select
          id="case-urgency-filter"
          class="filter-tab"
          data-action="case-filter-urgency"
          style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-size: 0.8125rem;"
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

      <!-- Workspace Body: List View vs Kanban View -->
      <div style="padding: 16px 20px;">
        ${filteredCases.length === 0
          ? emptyState('No matching cases found', 'Try adjusting your search query, status tab, or estate filter.')
          : caseView.viewMode === 'kanban'
            ? renderCaseKanban(s, filteredCases)
            : renderCaseList(s, filteredCases)}
      </div>
    </section>

    <!-- Case Journey Drawer / Modal -->
    ${caseView.selectedCaseId ? renderCaseJourneyModal(s, getCase(s, caseView.selectedCaseId)) : ''}
  `;
}

function filterCases(s, cases) {
  return cases.filter((c) => {
    // Tab filter
    if (caseView.activeTab === 'open' && c.status === 'closed') return false;
    if (caseView.activeTab === 'blocked' && !(c.blockers || []).some((b) => !b.resolved)) return false;
    if (caseView.activeTab === 'ready' && c.status !== 'ready_for_closure') return false;
    if (caseView.activeTab === 'closed' && c.status !== 'closed') return false;
    if (caseView.activeTab === 'radar' && detectLooseEnds(s, c).length === 0) return false;

    // Estate filter
    if (caseView.estateFilter !== 'all' && !c.estate.includes(caseView.estateFilter) && c.block !== caseView.estateFilter) {
      return false;
    }

    // Urgency filter
    if (caseView.urgencyFilter !== 'all' && c.urgency !== caseView.urgencyFilter) {
      return false;
    }

    // Search query
    if (caseView.searchQuery) {
      const q = caseView.searchQuery.toLowerCase();
      const matchNumber = c.caseNumber.toLowerCase().includes(q);
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchEstate = c.estate.toLowerCase().includes(q);
      const matchResident = (c.resident?.name || '').toLowerCase().includes(q);
      if (!matchNumber && !matchTitle && !matchEstate && !matchResident) return false;
    }

    return true;
  });
}

function renderFollowUpRadar(s, allLooseEnds) {
  return html`
    <section class="panel radar-panel" aria-labelledby="radar-h" style="border-left: 4px solid var(--colorPaletteMarigoldBorderActive);">
      <div class="panel-header" style="padding: 14px 20px; border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: center;">
        <div class="panel-title-group">
          <span class="panel-icon" style="background: var(--colorPaletteMarigoldBackground1); color: var(--colorPaletteMarigoldForeground2);" aria-hidden="true">
            ${icon('radar', 20)}
          </span>
          <div>
            <h2 id="radar-h" style="font-size: 1.0625rem; margin: 0;">Follow-Up Radar — Operational Loose-End Detector</h2>
            <p class="muted small" style="margin: 2px 0 0;">
              Deterministic intelligence highlighting unfulfilled promises, missing evidence, and unconfirmed tenant appointments before they escalate.
            </p>
          </div>
        </div>
        <span class="tag tag-warning">${allLooseEnds.length} Attention items</span>
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
    <div class="loose-end-card ${isCritical ? 'is-critical' : ''}" style="border: 1px solid ${isCritical ? 'var(--colorPaletteRedBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; border-radius: 10px; padding: 14px 16px; background: var(--colorNeutralBackground1); display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <span class="tag ${isCritical ? 'tag-danger' : 'tag-warning'} small">
          ${icon(isCritical ? 'alert' : 'clock', 12)} ${finding.title}
        </span>
        <button
          type="button"
          class="btn-ghost btn-sm"
          data-action="case-inspect"
          data-id="${c.id}"
          title="Inspect case journey"
          style="font-size: 0.75rem; padding: 2px 8px; font-weight: 600;"
        >
          ${c.caseNumber} →
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
          💡 Next step: ${finding.suggestedAction.slice(0, 50)}...
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
  const mgr = isManager(s);

  return html`
    <div class="table-wrap">
      <table class="data-table" aria-label="Cases directory">
        <thead>
          <tr>
            <th style="width: 140px;">Case Number</th>
            <th>Title & Location</th>
            ${mgr ? html`<th style="width: 130px;">Assigned Officer</th>` : ''}
            <th style="width: 110px;">Status</th>
            <th style="width: 90px;">Urgency</th>
            <th style="width: 130px;">Loose Ends</th>
            <th style="width: 140px;">SLA Deadline</th>
            <th style="text-align: right; width: 140px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map((c) => {
            const ends = detectLooseEnds(s, c);
            const statusClass = c.status === 'closed' ? 'tag-neutral' : c.status === 'ready_for_closure' ? 'tag-success' : c.status === 'pending_external' ? 'tag-warning' : 'tag-brand';
            const urgencyClass = c.urgency === 'Critical' ? 'tag-danger' : c.urgency === 'High' ? 'tag-warning' : 'tag-neutral';

            return html`
              <tr>
                <td>
                  <button
                    type="button"
                    class="task-link-btn"
                    data-action="case-inspect"
                    data-id="${c.id}"
                    style="font-family: monospace; font-weight: 700; color: var(--colorBrandForeground1);"
                  >
                    ${c.caseNumber}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    class="task-link-btn"
                    data-action="case-inspect"
                    data-id="${c.id}"
                    style="font-size: 0.9375rem;"
                  >
                    ${c.title}
                  </button>
                  <span class="small muted" style="display: flex; align-items: center; gap: 4px; margin-top: 3px;">
                    ${icon('pin', 12)} ${c.estate} (Unit: ${c.unit})
                  </span>
                </td>
                ${mgr
                  ? html`
                      <td>
                        <span class="small" style="font-weight: 600;">${officerName(s, c.ownerId)}</span>
                      </td>
                    `
                  : ''}
                <td>
                  <span class="tag ${statusClass}">
                    ${c.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  <span class="tag ${urgencyClass}">
                    ${c.urgency}
                  </span>
                </td>
                <td>
                  ${ends.length > 0
                    ? html`
                        <span class="tag ${ends.some((e) => e.severity === 'critical') ? 'tag-danger' : 'tag-warning'} small">
                          ${icon('alert', 12)} ${ends.length} Loose end${ends.length > 1 ? 's' : ''}
                        </span>
                      `
                    : html`<span class="tag tag-success small">${icon('check', 12)} On track</span>`}
                </td>
                <td>
                  <span class="small" style="font-weight: 500; display: block;">${fmtDue(c.slaDue)}</span>
                  <span class="small muted" style="font-size: 0.75rem;">${c.slaType ? c.slaType.split('(')[0] : 'SLA'}</span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button
                    type="button"
                    class="btn-subtle btn-sm"
                    data-action="case-inspect"
                    data-id="${c.id}"
                    title="Open Case Journey Timeline"
                  >
                    Journey
                  </button>
                  <button
                    type="button"
                    class="btn-subtle btn-sm"
                    data-action="case-plan-nav"
                    data-case="${c.id}"
                    data-task="${(c.taskIds && c.taskIds[0]) || ''}"
                    title="View scheduled commitments in Smart Planner"
                  >
                    Plan →
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
    { id: 'reported', title: 'Intake / Reported', filter: (c) => c.status === 'reported' },
    { id: 'in_progress', title: 'In Progress', filter: (c) => c.status === 'in_progress' },
    { id: 'pending_external', title: 'Awaiting External / Blocked', filter: (c) => c.status === 'pending_external' || (c.blockers || []).some((b) => !b.resolved) },
    { id: 'ready_for_closure', title: 'Closure Ready', filter: (c) => c.status === 'ready_for_closure' },
    { id: 'closed', title: 'Closed & Audited', filter: (c) => c.status === 'closed' },
  ];

  return html`
    <div class="kanban-board" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; overflow-x: auto; padding-bottom: 8px;">
      ${columns.map((col) => {
        const colCases = cases.filter(col.filter);
        return html`
          <div class="kanban-col" style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 380px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--colorNeutralStroke3);">
              <h3 style="font-size: 0.875rem; font-weight: 600; margin: 0;">${col.title}</h3>
              <span class="tag tag-neutral small">${colCases.length}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
              ${colCases.map((c) => {
                const ends = detectLooseEnds(s, c);
                const isCritical = c.urgency === 'Critical';

                return html`
                  <div
                    class="kanban-case-card"
                    data-action="case-inspect"
                    data-id="${c.id}"
                    tabindex="0"
                    role="button"
                    style="background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--shadow8); transition: transform 0.15s ease, border-color 0.15s ease;"
                  >
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span class="small" style="font-family: monospace; font-weight: 700; color: var(--colorBrandForeground1); font-size: 0.8125rem;">
                        ${c.caseNumber}
                      </span>
                      <span class="tag ${isCritical ? 'tag-danger' : 'tag-warning'} small" style="font-size: 0.6875rem;">
                        ${c.urgency}
                      </span>
                    </div>

                    <strong style="font-size: 0.875rem; color: var(--colorNeutralForeground1); line-height: 1.3;">
                      ${c.title}
                    </strong>

                    <span class="small muted" style="font-size: 0.75rem;">
                      ${icon('pin', 10)} ${c.estate}
                    </span>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--colorNeutralStroke3);">
                      <div class="account-avatar sm" style="width: 22px; height: 22px; font-size: 0.6875rem;">
                        ${officerName(s, c.ownerId).slice(0, 2).toUpperCase()}
                      </div>
                      ${ends.length > 0
                        ? html`
                            <span class="tag tag-warning small" style="font-size: 0.6875rem; padding: 1px 6px;">
                              ${ends.length} Loose end${ends.length > 1 ? 's' : ''}
                            </span>
                          `
                        : html`<span class="small muted" style="font-size: 0.6875rem;">On track</span>`}
                    </div>
                  </div>
                `;
              })}
              ${colCases.length === 0
                ? html`<div style="text-align: center; padding: 24px 8px; color: var(--colorNeutralForeground3); font-size: 0.8125rem;">No cases</div>`
                : ''}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

function renderCaseJourneyModal(s, c) {
  if (!c) return '';
  const mgr = isManager(s);
  const looseEnds = detectLooseEnds(s, c);
  const readiness = checkClosureReadiness(s, c);
  const caseTasks = (c.taskIds || []).map((tid) => getTask(s, tid)).filter(Boolean);
  const activeBlockers = (c.blockers || []).filter((b) => !b.resolved);
  const timelineEvents = [...(c.timeline || [])].sort((a, b) => (a.at < b.at ? 1 : -1));

  return html`
    <div class="modal-backdrop" data-action="case-modal-close" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div
        class="modal-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-dialog-title"
        onclick="event.stopPropagation()"
        style="background: var(--colorNeutralBackground1); border-radius: 12px; width: min(860px, 100%); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow16); border: 1px solid var(--colorNeutralStroke2);"
      >
        <!-- Modal Top Bar -->
        <header style="padding: 16px 20px; background: var(--colorNeutralBackground2); border-bottom: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="tag tag-brand" style="font-family: monospace; font-weight: 700;">${c.caseNumber}</span>
              <span class="tag ${c.urgency === 'Critical' ? 'tag-danger' : 'tag-warning'}">${c.urgency} Urgency</span>
              <span class="tag tag-neutral">${c.category}</span>
            </div>
            <h2 id="case-dialog-title" style="margin: 6px 0 2px; font-size: 1.1875rem;">${c.title}</h2>
            <p class="muted small" style="margin: 0;">
              ${icon('pin', 12)} ${c.estate} (Unit: ${c.unit}) · Assigned to <strong>${officerName(s, c.ownerId)}</strong> · Reported: ${c.reportedAt}
            </p>
          </div>
          <button
            type="button"
            class="btn-icon"
            data-action="case-modal-close"
            aria-label="Close dialog"
            style="width: 32px; height: 32px; border-radius: 6px; border: 0; background: transparent; cursor: pointer;"
          >
            ${icon('x', 20)}
          </button>
        </header>

        <!-- Modal Tab Strip -->
        <nav style="display: flex; border-bottom: 1px solid var(--colorNeutralStroke2); background: var(--colorNeutralBackground1); padding: 0 20px; overflow-x: auto;">
          ${[
            ['timeline', 'Case Journey Timeline', timelineEvents.length],
            ['loose_ends', 'Loose Ends', looseEnds.length],
            ['readiness', 'Closure Readiness', readiness.isReady ? '✓' : '!'],
            ['brief', 'AI Case Brief', null],
          ].map(
            ([tabKey, label, badgeVal]) => html`
              <button
                type="button"
                class="filter-tab ${caseView.journeyTab === tabKey ? 'is-active' : ''}"
                data-action="case-journey-tab"
                data-tab="${tabKey}"
                style="padding: 12px 14px; border-radius: 0; border: 0; border-bottom: 2px solid ${caseView.journeyTab === tabKey ? 'var(--colorBrandBackground)' : 'transparent'}; font-weight: 600;"
              >
                ${label}
                ${badgeVal != null ? html`<span class="tab-count">${badgeVal}</span>` : ''}
              </button>
            `,
          )}
        </nav>

        <!-- Modal Scrollable Content -->
        <div style="flex: 1; overflow-y: auto; padding: 20px;">
          ${caseView.journeyTab === 'timeline'
            ? renderJourneyTimelineTab(s, c, timelineEvents, caseTasks, activeBlockers)
            : caseView.journeyTab === 'loose_ends'
              ? renderJourneyLooseEndsTab(s, c, looseEnds)
              : caseView.journeyTab === 'readiness'
                ? renderJourneyReadinessTab(s, c, readiness)
                : renderJourneyBriefTab(s, c)}
        </div>

        <!-- Modal Footer Actions (Cross-module integration buttons) -->
        <footer style="padding: 14px 20px; background: var(--colorNeutralBackground2); border-top: 1px solid var(--colorNeutralStroke2); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <!-- Connect to Smart Planner -->
            <button
              type="button"
              class="btn-secondary btn-sm"
              data-action="case-plan-nav"
              data-case="${c.id}"
              data-task="${(caseTasks[0] && caseTasks[0].id) || ''}"
              title="Align follow-ups with officer calendar availability"
            >
              ${icon('calendar', 14)} Open in Smart Planner
            </button>

            <!-- Connect to Ripple Intelligence -->
            ${caseTasks.length > 0
              ? html`
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    data-action="case-ripple-nav"
                    data-task="${caseTasks[0].id}"
                    data-case="${c.id}"
                    title="Analyse downstream dependency disruption"
                  >
                    ${icon('zap', 14)} Analyse Ripple Impact
                  </button>
                `
              : ''}

            <!-- Connect to Approvals: Reassign Case -->
            <button
              type="button"
              class="btn-secondary btn-sm"
              data-action="case-reassign-dialog"
              data-case="${c.id}"
              title="Request case reassignment via Manager Approval workflow"
            >
              ${icon('team', 14)} Request Reassignment
            </button>
          </div>

          <div style="display: flex; gap: 8px;">
            ${c.status !== 'closed'
              ? html`
                  <button
                    type="button"
                    class="${readiness.isReady ? 'btn-primary' : 'btn-secondary'} btn-sm"
                    data-action="case-close-action"
                    data-case="${c.id}"
                    title="${readiness.isReady ? 'Mark case completed and closed' : 'Evaluate closure prerequisites'}"
                  >
                    ${icon('check', 14)} Mark Case Closed
                  </button>
                `
              : html`<span class="tag tag-success">Case Closed</span>`}
            <button type="button" class="btn-subtle btn-sm" data-action="case-modal-close">
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  `;
}

function renderJourneyTimelineTab(s, c, events, caseTasks, blockers) {
  return html`
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Active Blockers Notice -->
      ${blockers.length > 0
        ? html`
            <div style="background: var(--colorPaletteRedBackground1); border: 1px solid var(--colorPaletteRedBorderActive); border-radius: 8px; padding: 12px 16px;">
              <strong style="color: var(--colorPaletteRedForeground1); display: flex; align-items: center; gap: 6px;">
                ${icon('alert', 16)} Active Blocker Detected
              </strong>
              <p class="small" style="margin: 4px 0 0; color: var(--colorNeutralForeground1);">
                ${blockers[0].title} — Responsible: <strong>${blockers[0].responsibleParty}</strong> (${blockers[0].sourceRef})
              </p>
            </div>
          `
        : ''}

      <!-- Linked Tasks Strip -->
      ${caseTasks.length > 0
        ? html`
            <div style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke3); border-radius: 8px; padding: 12px 14px;">
              <span class="small muted" style="font-weight: 600; display: block; margin-bottom: 6px;">
                Linked Operational Work Tasks (${caseTasks.length}):
              </span>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${caseTasks.map(
                  (t) => html`
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8125rem; background: var(--colorNeutralBackground1); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke2);">
                      <span>
                        <strong style="font-family: monospace;">${t.id}:</strong> ${t.title}
                      </span>
                      <span class="tag ${t.status === 'done' ? 'tag-success' : 'tag-brand'} small">
                        ${t.status === 'done' ? 'Done' : 'Active'}
                      </span>
                    </div>
                  `,
                )}
              </div>
            </div>
          `
        : ''}

      <!-- Interactive Chronological Event Stream -->
      <div>
        <h3 style="font-size: 0.9375rem; margin-bottom: 12px;">Chronological Case Journey</h3>
        <ol class="activity-list" style="padding-left: 0;">
          ${events.map((ev) => {
            const isAlert = ev.type === 'blocker';
            const isGood = ev.type === 'closure' || ev.type === 'inspection';
            const tone = isAlert ? 'tone-bad' : isGood ? 'tone-good' : 'tone-info';

            return html`
              <li class="activity-item ${tone}">
                <span class="activity-icon" aria-hidden="true">
                  ${icon(isAlert ? 'alert' : isGood ? 'check' : 'clock', 16)}
                </span>
                <div class="activity-text">
                  <strong>${ev.title}</strong>
                  <p class="small muted" style="margin: 2px 0 0;">${ev.summary}</p>
                  <span class="small" style="font-size: 0.75rem; color: var(--colorBrandForeground1);">
                    Source: ${ev.source} · Actor: ${ev.actor}
                  </span>
                </div>
                <time datetime="${ev.at}">${ev.at.slice(11, 16) || ev.at}</time>
              </li>
            `;
          })}
        </ol>
      </div>
    </div>
  `;
}

function renderJourneyLooseEndsTab(s, c, looseEnds) {
  return html`
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="background: var(--colorBrandBackground2); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--colorBrandStroke2);">
        <strong style="color: var(--colorBrandForeground1); font-size: 0.9375rem;">
          Operational Loose-End Detective Findings
        </strong>
        <p class="small muted" style="margin: 4px 0 0;">
          Our deterministic engine cross-references promised resident callbacks, contractor response times, and evidence attachments to flag commitments before they are forgotten.
        </p>
      </div>

      ${looseEnds.length === 0
        ? html`
            <div style="text-align: center; padding: 32px 16px;">
              <div style="font-size: 2rem; margin-bottom: 8px;">✓</div>
              <strong>No Loose Ends Detected</strong>
              <p class="small muted">All commitments, callbacks, and evidence for this case are currently on track.</p>
            </div>
          `
        : html`
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${looseEnds.map(
                (l) => html`
                  <div style="border: 1px solid var(--colorPaletteMarigoldBorderActive); background: var(--colorNeutralBackground1); border-radius: 8px; padding: 14px; display: grid; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span class="tag ${l.severity === 'critical' ? 'tag-danger' : 'tag-warning'} small">
                        ${l.title}
                      </span>
                      <span class="small muted">Due: ${fmtDue(l.dueDate)}</span>
                    </div>
                    <p class="small" style="margin: 0; line-height: 1.45;">
                      <strong>Finding:</strong> ${l.explanation}
                    </p>
                    <div style="font-size: 0.75rem; color: var(--colorNeutralForeground3); background: var(--colorNeutralBackground2); padding: 6px 10px; border-radius: 6px;">
                      <strong>Evidence Reference:</strong> ${l.sourceEvidence}
                    </div>
                    <div style="background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-size: 0.8125rem; padding: 8px 12px; border-radius: 6px; font-weight: 500;">
                      Recommended Action: ${l.suggestedAction}
                    </div>
                  </div>
                `,
              )}
            </div>
          `}
    </div>
  `;
}

function renderJourneyReadinessTab(s, c, readiness) {
  const checkpoints = c.checkpoints || [];
  const evidence = c.evidence || [];

  return html`
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Readiness Status Banner -->
      <div style="border-radius: 8px; padding: 14px 18px; border: 1px solid ${readiness.isReady ? 'var(--colorPaletteGreenBorderActive)' : 'var(--colorPaletteMarigoldBorderActive)'}; background: ${readiness.isReady ? 'var(--colorPaletteGreenBackground1)' : 'var(--colorPaletteMarigoldBackground1)'};">
        <strong style="color: ${readiness.isReady ? 'var(--colorPaletteGreenForeground1)' : 'var(--colorPaletteMarigoldForeground2)'}; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
          ${icon(readiness.isReady ? 'check' : 'alert', 18)}
          ${readiness.isReady ? 'Case is Ready for Closure' : 'Closure Blocked by Incomplete Prerequisites'}
        </strong>
        <p class="small" style="margin: 4px 0 0; color: var(--colorNeutralForeground1);">
          ${readiness.isReady
            ? 'All inspection records, evidence attachments, and resident sign-offs are complete. Ready for formal audit archival.'
            : `Case cannot be officially closed until ${readiness.unresolvedItems.length} requirement(s) are satisfied.`}
        </p>
      </div>

      <!-- Checklist Items -->
      <div>
        <h3 style="font-size: 0.9375rem; margin-bottom: 8px;">Prerequisite Checkpoints</h3>
        <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 8px;">
          ${checkpoints.map(
            (cp) => html`
              <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke3);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="color: ${cp.completed ? 'var(--colorPaletteGreenForeground1)' : 'var(--colorNeutralForeground3)'};">
                    ${icon(cp.completed ? 'check' : 'clock', 16)}
                  </span>
                  <div>
                    <strong style="font-size: 0.875rem;">${cp.title}</strong>
                    ${cp.requiresManager ? html`<span class="tag tag-brand small" style="margin-left: 6px;">Manager Sign-off</span>` : ''}
                    ${cp.requiredForClosure ? html`<span class="small muted" style="display: block; font-size: 0.75rem;">Mandatory for closure</span>` : ''}
                  </div>
                </div>
                <span class="tag ${cp.completed ? 'tag-success' : 'tag-neutral'} small">
                  ${cp.completed ? 'Completed' : 'Pending'}
                </span>
              </li>
            `,
          )}
        </ul>
      </div>

      <!-- Evidence Verification -->
      <div>
        <h3 style="font-size: 0.9375rem; margin-bottom: 8px;">Evidence & Technical Attachments</h3>
        <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 8px;">
          ${evidence.map(
            (evi) => html`
              <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; background: var(--colorNeutralBackground1); border: 1px solid var(--colorNeutralStroke2);">
                <div>
                  <strong style="font-size: 0.875rem;">${evi.title}</strong>
                  <span class="small muted" style="display: block; font-size: 0.75rem;">
                    Source: ${evi.sourceRef || 'Uploaded Attachment'} · Type: ${evi.type}
                  </span>
                </div>
                <span class="tag ${evi.missing ? 'tag-danger' : evi.verified ? 'tag-success' : 'tag-warning'} small">
                  ${evi.missing ? 'Missing' : evi.verified ? 'Verified' : 'Pending'}
                </span>
              </li>
            `,
          )}
        </ul>
      </div>
    </div>
  `;
}

function renderJourneyBriefTab(s, c) {
  const briefText = generateCaseBrief(s, c);

  return html`
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="small muted">
          <strong>Deterministic JavaScript Template</strong> (AI backend ready)
        </span>
        <button
          type="button"
          class="btn-secondary btn-sm"
          data-action="case-copy-brief"
          data-case="${c.id}"
        >
          ${icon('copy', 14)} Copy Case Brief
        </button>
      </div>

      <pre
        id="case-brief-text"
        style="background: var(--colorNeutralBackground2); border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 16px; font-family: monospace; font-size: 0.8125rem; line-height: 1.55; white-space: pre-wrap; margin: 0; max-height: 380px; overflow-y: auto;"
      >${briefText}</pre>

      <p class="small muted" style="margin: 0; font-size: 0.75rem;">
        * Generated from factual recorded data in prototype state. Future production AI integrations will map this deterministic structure into authorized Microsoft Copilot or LLM summaries.
      </p>
    </div>
  `;
}
