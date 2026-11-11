// Settings Page — Theme, Typography, Accessibility & Demo Reset (matches SettingsPanel.jsx)
import { html, raw, icon } from '../ui.js';
import { getState, resetState } from '../state.js';

const prefs = {
  theme: typeof localStorage !== 'undefined' ? localStorage.getItem('syncai_theme') || 'system' : 'system',
  textSize: typeof localStorage !== 'undefined' ? localStorage.getItem('syncai_text_size') || 'standard' : 'standard',
  language: typeof localStorage !== 'undefined' ? localStorage.getItem('syncai_lang') || 'en' : 'en',
  graphTested: false,
};

export default {
  render(s) {
    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('settings', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">User Preferences & Accessibility</p>
          <h1>Settings <span class="hero-badge">Preferences</span></h1>
          <p>
            Customise your appearance, text scale and language options. Reset prototype demo state to initial seed data anytime.
          </p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat">
            <strong>${prefs.textSize.toUpperCase()}</strong>
            <span>Text Size</span>
          </div>
          <div class="hero-stat">
            <strong>${prefs.theme.toUpperCase()}</strong>
            <span>Theme</span>
          </div>
          <div class="hero-stat">
            <strong>${prefs.language.toUpperCase()}</strong>
            <span>Language</span>
          </div>
        </div>
      </header>

      <div class="settings-layout">
        <div class="panel settings-form">
          <!-- Text Size Selection -->
          <fieldset class="settings-group">
            <legend>Text size</legend>
            <p class="muted small">Scales typography across all pages for improved legibility.</p>
            <div class="choice-grid">
              ${[
                ['standard', 'Standard', '1rem'],
                ['medium', 'Medium', '1.25rem'],
                ['large', 'Large', '1.5rem'],
              ].map(
                ([val, label, fontSz]) => html`
                  <label class="choice">
                    <input
                      type="radio"
                      name="textSize"
                      value="${val}"
                      ${prefs.textSize === val ? 'checked' : ''}
                      data-action="settings-change-text"
                    />
                    <span class="choice-body">
                      <span class="choice-sample" style="font-size: ${fontSz};">A</span>
                      <span class="choice-label">${label}</span>
                    </span>
                  </label>
                `,
              )}
            </div>
          </fieldset>

          <!-- Language Selection -->
          <fieldset class="settings-group">
            <legend>Language</legend>
            <p class="muted small">Preferred display language for operational terms and descriptions.</p>
            <div class="choice-grid">
              ${[
                ['en', 'English'],
                ['zh', '中文 (Chinese)'],
                ['ms', 'Melayu (Malay)'],
                ['ta', 'தமிழ் (Tamil)'],
              ].map(
                ([code, label]) => html`
                  <label class="choice">
                    <input
                      type="radio"
                      name="language"
                      value="${code}"
                      ${prefs.language === code ? 'checked' : ''}
                      data-action="settings-change-lang"
                    />
                    <span class="choice-body">
                      <span class="choice-label">${label}</span>
                    </span>
                  </label>
                `,
              )}
            </div>
          </fieldset>

          <!-- Theme Appearance -->
          <fieldset class="settings-group">
            <legend>Appearance</legend>
            <p class="muted small">Light, dark, or follow operating system setting.</p>
            <div class="choice-grid">
              ${[
                ['system', 'System default', 'system'],
                ['light', 'Light', 'light'],
                ['dark', 'Dark', 'dark'],
              ].map(
                ([val, label, swatch]) => html`
                  <label class="choice">
                    <input
                      type="radio"
                      name="appearance"
                      value="${val}"
                      ${prefs.theme === val ? 'checked' : ''}
                      data-action="settings-change-theme"
                    />
                    <span class="choice-body">
                      <span class="choice-swatch ${swatch}"></span>
                      <span class="choice-label">${label}</span>
                    </span>
                  </label>
                `,
              )}
            </div>
          </fieldset>

          <!-- Actions -->
          <div style="padding-top: 16px; border-top: 1px solid var(--colorNeutralStroke3); display: flex; gap: 12px; flex-wrap: wrap;">
            <button type="button" class="btn-secondary" data-action="settings-reset-defaults">
              ${icon('reset', 16)} Reset display settings
            </button>
            <button type="button" class="btn-danger" data-action="settings-reset-demo-data">
              ${icon('reset', 16)} Reset all demo data to seed
            </button>
          </div>
        </div>

        <!-- Settings Preview Aside -->
        <aside class="panel settings-preview" aria-label="Settings preview card">
          <p class="eyebrow">Settings preview</p>
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            <span class="card-icon" style="flex: none; margin: 0;">${icon('shield', 20)}</span>
            <div>
              <strong style="font-size: 0.9375rem;">Lift inspection · Block 208</strong>
              <p class="muted small" style="margin: 4px 0 0;">
                Quarterly safety inspection following resident reports of jerky stops.
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 12px;">
            <span class="tag tag-danger">Safety Hazard</span>
            <span class="tag tag-brand">Score 95</span>
          </div>
        </aside>
      </div>

      <!-- Simulated Microsoft Graph Connection Test -->
      <section class="panel cal-panel" style="margin-top: 24px;" aria-labelledby="graph-test-h">
        <div class="cal-head">
          <span class="card-icon" aria-hidden="true">${icon('plug', 24)}</span>
          <div class="cal-head-text">
            <h2 id="graph-test-h">Microsoft Graph Connection Test (Simulated)</h2>
            <p class="muted">
              Verify that Microsoft Graph token acquisition and profile read permissions simulate cleanly.
            </p>
          </div>
          <span class="tag tag-success">Simulated Endpoint</span>
        </div>
        <div class="cal-bar">
          <button type="button" class="btn-primary btn-sm" data-action="graph-test-run">
            ${icon('plug', 14)} Test Microsoft Graph Connection
          </button>
          <span class="small muted" id="graph-test-result">
            Status: Ready. Click to test simulated token handshake.
          </span>
        </div>
      </section>
    `;
  },
};
