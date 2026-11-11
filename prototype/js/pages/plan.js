// Plan Page — Smart Work Planner + Simulated Outlook Calendar + Ripple What-If Simulator
import { html, raw, icon, capacityBadge } from '../ui.js';
import {
  assessRisk,
  buildSchedule,
  dayCapacity,
  schedule,
  teamAnalysis,
} from '../planner.js';
import {
  analyzeScenarioRipple,
  evaluateAlternatives,
  traceDownstream,
} from '../ripple.js';
import {
  INCIDENTS,
  runSimulation,
  commitSimulation,
} from '../simulation.js';
import {
  getOfficer,
  getState,
  getTask,
  isOpen,
  isManager,
  isTeamMember,
  getCurrentUser,
  officerName,
  update,
  visibleTasks,
  meetingsFor,
  createApprovalRequest,
} from '../state.js';
import {
  TODAY,
  NOW,
  fmtDue,
  fmtHours,
  fmtTime,
  workDay,
  horizonDays,
} from '../time.js';

const planView = {
  day: TODAY,
  activeScenarioId: 'lift_emergency',
  selectedAltId: 'b',
  showSimulator: true,
  simulationResult: null,
};

export default {
  render(s) {
    const user = getCurrentUser(s);
    const mgr = isManager(s);
    const officerId = s.currentOfficerId || 'o1';
    const officer = getOfficer(s, officerId) || s.officers[0];

    // Compute day capacity and schedule
    const cap = dayCapacity(s, officer.id, planView.day) || { freeHours: 4.5 };
    const sched = buildSchedule(s, officer.id, [planView.day]);
    const meetings = meetingsFor(s, officer.id, planView.day);
    const allocatedHours = ((sched.taskMinByDay?.[0] || 0) / 60);

    // Compute simulation if not cached
    if (!planView.simulationResult || planView.simulationResult.scenarioId !== planView.activeScenarioId) {
      planView.simulationResult = evaluateAlternatives(s, planView.activeScenarioId);
    }
    const sim = planView.simulationResult;

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('calendar', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Capacity-Aware Scheduling & Resilience</p>
          <h1>My Plan <span class="hero-badge">Smart Planner</span></h1>
          <p>
            Dynamically fits your operational tasks around Outlook meetings and travel buffer. Use the What-If Simulator to explore downstream ripple effects before committing changes.
          </p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat">
            <strong>${allocatedHours.toFixed(1)}h</strong>
            <span>Allocated</span>
          </div>
          <div class="hero-stat">
            <strong>${(cap.freeHours || 0).toFixed(1)}h</strong>
            <span>Free capacity</span>
          </div>
          <div class="hero-stat">
            <strong>${meetings.length}</strong>
            <span>Outlook blocks</span>
          </div>
        </div>
      </header>

      <!-- Simulated Outlook Calendar Panel -->
      ${renderOutlookCalendar(s, officer)}

      <!-- Daily Schedule Timeline -->
      <section class="panel" aria-labelledby="timeline-h">
        <div class="panel-head">
          <div>
            <h2 id="timeline-h">Today's Proposed Schedule (${officer.name})</h2>
            <p class="muted small">Working hours: 08:30 – 17:30 · Lunch break: 12:30 – 13:30 (Protected)</p>
          </div>
          <div class="panel-tools">
            <span class="tag ${allocatedHours > (cap.freeHours || 0) ? 'tag-danger' : 'tag-brand'}">
              ${allocatedHours > (cap.freeHours || 0) ? 'Overloaded' : 'Fits Available Time'}
            </span>
          </div>
        </div>

        <div style="display: grid; gap: 8px; margin-top: 14px;">
          ${sched.blocks.length === 0
            ? html`<p class="muted">No scheduled task blocks for today.</p>`
            : sched.blocks.map((b) => {
                const blockClass = b.kind === 'meeting' ? 'is-meeting' : b.task?.safety ? 'is-safety' : b.task?.statutory ? 'is-statutory' : '';
                return html`
                  <div class="timeline-block ${blockClass}">
                    <span class="small muted" style="font-variant-numeric: tabular-nums; font-weight: 600;">
                      ${b.start} – ${b.end}
                    </span>
                    <div>
                      <strong>${b.title}</strong>
                      ${b.location
                        ? html`<span class="small muted" style="display: block;">${icon('pin', 12)} ${b.location}</span>`
                        : ''}
                      ${b.task?.caseId
                        ? html`<button type="button" class="tag tag-brand small" data-action="nav-to-case" data-case="${b.task.caseId}" style="cursor: pointer; margin-top: 3px; border: 1px solid var(--colorBrandStroke2); background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-family: monospace; font-weight: 600;" title="View Case ${b.task.caseId}">${icon('cases', 12)} ${b.task.caseId}</button>`
                        : ''}
                    </div>
                    <div>
                      <span class="tag ${b.kind === 'meeting' ? 'tag-brand' : b.task?.safety ? 'tag-danger' : b.task?.statutory ? 'tag-warning' : 'tag-neutral'}">
                        ${b.kind === 'meeting' ? 'Outlook' : b.task?.safety ? 'Safety' : b.task?.statutory ? 'Statutory' : 'Task'}
                      </span>
                    </div>
                  </div>
                `;
              })}
        </div>
      </section>

      <!-- Operational Ripple Intelligence & What-If Simulator -->
      <section class="panel sim-box" aria-labelledby="sim-h">
        <div class="panel-head">
          <div>
            <h2 id="sim-h">Operational Ripple Intelligence & What-If Simulator</h2>
            <p class="muted small">
              Test operational disruptions and evaluate 3 deterministic alternatives before touching real schedules.
            </p>
          </div>
          <span class="tag tag-brand">Explainable AI</span>
        </div>

        <!-- Disruption Scenario Selector -->
        <div style="margin: 16px 0; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
          <span class="small muted" style="font-weight: 600;">Simulate Disruption:</span>
          ${[
            ['lift_emergency', 'Emergency Lift Entrapment (Blk 214)'],
            ['officer_mc', 'Officer on Medical Leave (Ravi Kumar)'],
            ['seepage_delay', 'Inspection Delay (Blk 211 Seepage)'],
          ].map(
            ([id, label]) => html`
              <button
                type="button"
                class="btn-sm ${planView.activeScenarioId === id ? 'btn-primary' : 'btn-secondary'}"
                data-action="sim-select-scenario"
                data-scenario="${id}"
              >
                ${label}
              </button>
            `,
          )}
        </div>

        <!-- Ripple Consequence Analysis Banner -->
        <div class="callout warn" style="margin-bottom: 20px;">
          ${icon('alert', 22)}
          <div>
            <strong>Downstream Disruption Detected:</strong><br />
            <span>
              ${sim.ripple?.headline || 'Operational emergency requires schedule adaptation. Downstream appointments at risk.'}
            </span>
            ${sim.ripple?.consequences?.length > 0
              ? html`
                  <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 0.8125rem;">
                    ${sim.ripple.consequences.map((c) => html`<li>${c}</li>`)}
                  </ul>
                `
              : ''}
          </div>
        </div>

        <!-- Three Alternatives Comparison Grid -->
        <h3 style="margin-bottom: 12px; font-size: 1rem;">Compare 3 Operational Alternatives:</h3>
        <div class="alternatives-grid">
          <!-- Alt A -->
          <div
            class="alt-card is-baseline ${planView.selectedAltId === 'a' ? 'selected' : ''}"
            data-action="sim-select-alt"
            data-alt="a"
          >
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="alt-letter">A</span>
              <span class="tag tag-neutral">Baseline</span>
            </div>
            <strong>No Action</strong>
            <p class="small muted">Accept disruption without schedule changes. Exposes unmitigated SLA breaches.</p>
            <div class="small" style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke3);">
              <span class="tag tag-danger" style="margin-bottom: 4px;">2 SLA Breaches</span><br />
              <span class="muted">Resident appointment displaced</span>
            </div>
          </div>

          <!-- Alt B -->
          <div
            class="alt-card ${planView.selectedAltId === 'b' ? 'selected' : ''}"
            data-action="sim-select-alt"
            data-alt="b"
          >
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="alt-letter">B</span>
              <span class="tag tag-brand">Recommended</span>
            </div>
            <strong>Reschedule Lower-Impact</strong>
            <p class="small muted">Postpones routine administrative work orders. Keeps safety inspection intact.</p>
            <div class="small" style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke3);">
              <span class="tag tag-success" style="margin-bottom: 4px;">0 Safety Breaches</span><br />
              <span class="muted">Defers CleanPro review to tomorrow</span>
            </div>
          </div>

          <!-- Alt C -->
          <div
            class="alt-card ${planView.selectedAltId === 'c' ? 'selected' : ''}"
            data-action="sim-select-alt"
            data-alt="c"
          >
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="alt-letter">C</span>
              <span class="tag tag-warning">Reassign</span>
            </div>
            <strong>Reassign Eligible Work</strong>
            <p class="small muted">Transfers Blk 211 seepage check to Priya Nair (Zone A qualified, spare capacity).</p>
            <div class="small" style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--colorNeutralStroke3);">
              <span class="tag tag-success" style="margin-bottom: 4px;">Protects 16:00 Visit</span><br />
              <span class="muted">Requires manager approval</span>
            </div>
          </div>
        </div>

        <!-- Simulation Action -->
        <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
          <span class="small muted">
            Selected Alternative: <strong>Alternative ${planView.selectedAltId.toUpperCase()}</strong>
          </span>
          ${mgr
            ? html`
                <button type="button" class="btn-primary" data-action="sim-commit" data-alt="${planView.selectedAltId}">
                  Commit Alternative ${planView.selectedAltId.toUpperCase()} to Schedule
                </button>
              `
            : html`
                <button type="button" class="btn-primary" data-action="sim-request-approval" data-alt="${planView.selectedAltId}">
                  Submit Alternative ${planView.selectedAltId.toUpperCase()} for Manager Approval
                </button>
              `}
        </div>
      </section>
    `;
  },
};

function renderOutlookCalendar(s, officer) {
  const meetings = s.meetings.filter((m) => m.ownerIds.includes(officer.id));

  return html`
    <section class="panel cal-panel" aria-labelledby="cal-h">
      <div class="cal-head">
        <span class="card-icon" aria-hidden="true">${icon('calendar', 24)}</span>
        <div class="cal-head-text">
          <h2 id="cal-h">Outlook Calendar (Simulated Integration)</h2>
          <p class="muted">
            Reads upcoming meetings, inspections and reserved resident appointments from Microsoft Graph.
          </p>
        </div>
        <span class="tag tag-brand">Demo data — no live Microsoft connection</span>
      </div>

      <div class="cal-bar">
        <span class="cal-bar-text small muted">
          Connected as: <strong>${officer.name}</strong> (${officer.name.toLowerCase().replace(/\s+/g, '.')}@towncouncil.gov.sg)
        </span>
        <button type="button" class="btn-secondary btn-sm" data-action="cal-refresh">
          ${icon('refresh', 14)} Refresh Calendar
        </button>
      </div>

      <ol class="cal-list">
        ${meetings.slice(0, 6).map((m) => {
          const isBusy = m.start !== '12:30';
          return html`
            <li class="cal-item">
              <span class="cal-when">
                <time datetime="${m.date}">${m.date}</time>
                <span>${m.start} – ${m.end}</span>
              </span>
              <span class="cal-what">
                <strong>${m.title}</strong>
                ${m.location ? html`<span class="small muted">${m.location}</span>` : ''}
              </span>
              <span class="cal-meta">
                <span class="tag ${isBusy ? 'tag-danger' : 'tag-success'}">
                  ${isBusy ? 'Busy' : 'Free'}
                </span>
              </span>
            </li>
          `;
        })}
      </ol>
      <p class="cal-foot small muted">
        Demo data — Microsoft Graph read-only simulation. Changes do not alter live Microsoft 365 calendars.
      </p>
    </section>
  `;
}
