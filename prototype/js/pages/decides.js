// How It Decides Page — Plain-language explanation of SyncAI's 4 factors & 3 principles (matches HowItDecides.jsx)
import { html, raw, icon } from '../ui.js';

export default {
  render() {
    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('sparkle', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Operationally aware AI scheduling</p>
          <h1>How SyncAI decides</h1>
          <p>
            The four operational factors and responsible AI principles that guide every priority score, feasibility estimate and schedule recommendation.
          </p>
        </div>
      </header>

      <!-- 4 Factors Grid -->
      <ol class="factor-cards" aria-label="Four operational priority factors">
        <li class="panel">
          <span class="factor-n" aria-hidden="true">1</span>
          <div>
            <h2>Safety</h2>
            <p class="muted">
              Genuine risks to residents, staff and public property outrank routine requests. Emergencies like passenger lift entrapments and exposed live wires receive top priority and +20 score weight.
            </p>
          </div>
        </li>

        <li class="panel">
          <span class="factor-n" aria-hidden="true">2</span>
          <div>
            <h2>Mandatory deadlines</h2>
            <p class="muted">
              Statutory deadlines (BCA lift compliance, EMA electrical inspections, SCDF fire certificates) and strict funding cut-off dates cannot slip. Missing them incurs permanent grant forfeiture or regulatory sanctions.
            </p>
          </div>
        </li>

        <li class="panel">
          <span class="factor-n" aria-hidden="true">3</span>
          <div>
            <h2>Service impact & long-term consequences</h2>
            <p class="muted">
              Evaluates what happens if the work waits: concrete spalling, rebar corrosion, water seepage escalation. Focuses on actual resident needs, not who calls or complains loudest.
            </p>
          </div>
        </li>

        <li class="panel">
          <span class="factor-n" aria-hidden="true">4</span>
          <div>
            <h2>Scheduling feasibility</h2>
            <p class="muted">
              Estimated task durations matched to each officer’s free time, travel buffers and Outlook appointments. Flags impossible capacity constraints early instead of overcommitting the team.
            </p>
          </div>
        </li>
      </ol>

      <!-- 3 Principles Grid -->
      <div class="principles" aria-label="Responsible AI principles">
        <div class="panel">
          <span class="card-icon" aria-hidden="true">${icon('sparkle', 24)}</span>
          <h2>Explainable</h2>
          <p class="muted">
            Every score, estimate and suggestion lists the reasons behind it in plain, calibrated language without opaque black-box scoring.
          </p>
        </div>

        <div class="panel">
          <span class="card-icon" aria-hidden="true">${icon('check', 24)}</span>
          <h2>Human approval</h2>
          <p class="muted">
            AI recommends, humans decide. A team member or authorised manager must review and approve schedule changes before they take effect.
          </p>
        </div>

        <div class="panel">
          <span class="card-icon" aria-hidden="true">${icon('shield', 24)}</span>
          <h2>Private by design</h2>
          <p class="muted">
            Role-based access through Microsoft Entra ID. Absences are recorded as MC or leave only, never medical details, protecting officer dignity.
          </p>
        </div>
      </div>
    `;
  },
};
