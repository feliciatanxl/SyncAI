// How It Decides Page — Plain-language explanation of SyncAI's 4 factors & 3 principles (matches HowItDecides.jsx)
import { html, raw, icon } from '../ui.js';

export default {
  render() {
    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('sparkle', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Our difference</p>
          <h1>Operationally aware AI scheduling</h1>
          <p>
            A generic to-do list sorts by due date. SyncAI weighs four operational factors together, then builds a plan that fits the time each person really has.
          </p>
        </div>
      </header>

      <!-- 4 Factors Grid -->
      <ol class="factor-cards" aria-label="Four operational priority factors">
        <li class="panel">
          <span class="factor-n" aria-hidden="true">1</span>
          <div>
            <h2>Safety</h2>
            <p class="muted">Genuine risks to people, staff and property.</p>
          </div>
        </li>

        <li class="panel">
          <span class="factor-n" aria-hidden="true">2</span>
          <div>
            <h2>Mandatory deadlines</h2>
            <p class="muted">Statutory, regulatory, contractual and funding-approval dates that cannot slip.</p>
          </div>
        </li>

        <li class="panel">
          <span class="factor-n" aria-hidden="true">3</span>
          <div>
            <h2>Service impact & long-term consequences</h2>
            <p class="muted">Real customer needs and what happens if the work waits. Not who complains loudest.</p>
          </div>
        </li>

        <li class="panel">
          <span class="factor-n" aria-hidden="true">4</span>
          <div>
            <h2>Scheduling feasibility</h2>
            <p class="muted">Estimated task durations matched to each person’s free time and capacity.</p>
          </div>
        </li>
      </ol>

      <!-- 3 Principles Grid -->
      <div class="principles" aria-label="Responsible AI principles">
        <div class="panel">
          <span class="card-icon" aria-hidden="true">${icon('eye', 24)}</span>
          <h2>Explained, every time</h2>
          <p class="muted">
            Each score and suggestion lists the reasons behind it, in plain language.
          </p>
        </div>

        <div class="panel">
          <span class="card-icon" aria-hidden="true">${icon('check', 24)}</span>
          <h2>People approve</h2>
          <p class="muted">
            SyncAI recommends. A team member or manager accepts every change before it happens.
          </p>
        </div>

        <div class="panel">
          <span class="card-icon" aria-hidden="true">${icon('shield', 24)}</span>
          <h2>Safety and deadlines protected</h2>
          <p class="muted">
            When urgent work lands, safety and mandatory work stay in place. Other work moves first.
          </p>
        </div>
      </div>
    `;
  },
};
