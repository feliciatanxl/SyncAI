// Plan Page — schedule proposals, simulated Outlook preview and What-If Simulator
import { html, icon } from '../ui.js';
import { analyzeScenarioRipple, analyzeTaskRipple } from '../ripple.js';
import { isManager, visibleTasks } from '../state.js';
import { currentPlanningOfficer, renderSmartPlan } from './smartPlan.js';

export const planView = {
  activeScenarioId: 'lift_emergency',
  selectedAltId: 'b',
  simulationResult: null,
};

export default {
  render(s) {
    const mgr = isManager(s);
    const officer = currentPlanningOfficer(s);

    if (officer && (planView.simulationResult?.state !== s || planView.simulationResult?.revision !== s.rev)) {
      const scenario = planView.activeScenarioId;
      const ripple = scenario === 'seepage_delay' ? analyzeTaskRipple(s, 't103')
        : analyzeScenarioRipple(s, scenario === 'officer_mc' ? { absent: ['o6'] } : { incident: 'lift', incidentAssignee: 'o1' });
      planView.simulationResult = { state: s, revision: s.rev, ripple };
    }
    const visibleIds = new Set(visibleTasks(s).map((task) => task.id));
    const ripple = planView.simulationResult?.ripple;
    const downstream = (ripple?.downstreamTaskIds || []).filter((id) => visibleIds.has(id));
    const consequences = (ripple?.potentialConsequences || []).filter(({ taskId }) => visibleIds.has(taskId));

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('calendar', 28)}</span>
        <div class="page-hero-text">
          <h1>My Plan</h1>
          <p>Preview daily and weekly work around protected commitments and your schedule preferences.</p>
        </div>
      </header>
      ${renderSmartPlan(s, officer)}
      ${officer ? renderOutlookCalendar(s, officer) : ''}

      <!-- Operational Ripple Intelligence & What-If Simulator -->
      ${officer ? html`<section class="panel sim-box" aria-labelledby="sim-h">
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
            <strong>Simulated disruption</strong><br />
            <span>${downstream.length} downstream tasks in your view.</span>
            ${consequences.length > 0
              ? html`
                  <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 0.8125rem;">
                    ${consequences.map(({ title, consequence }) => html`<li><strong>${title}</strong> ${consequence}</li>`)}
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
                  Record simulated choice ${planView.selectedAltId.toUpperCase()}
                </button>
              `
            : html`
                <button type="button" class="btn-primary" data-action="sim-request-approval" data-alt="${planView.selectedAltId}">
                  Submit Alternative ${planView.selectedAltId.toUpperCase()} for Manager Approval
                </button>
              `}
        </div>
      </section>` : ''}
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
            Preview the fictional Outlook meeting records used by this demo.
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
