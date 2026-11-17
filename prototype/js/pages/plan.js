// Plan Page — schedule proposals and simulated Outlook preview
import { html, icon } from '../ui.js';
import { currentPlanningOfficer, renderSmartPlan } from './smartPlan.js';

export default {
  render(s) {
    const officer = currentPlanningOfficer(s);

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
