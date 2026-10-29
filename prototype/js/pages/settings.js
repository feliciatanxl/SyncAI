import { INTEGRATIONS } from '../data.js';
import { ctx } from '../ctx.js';
import { isSupervisor, logActivity, resetState, update, storage } from '../state.js';
import { fmtDay, fmtTime, toMin } from '../time.js';
import { html, icon, toast, confirmDialog, filterTabs, limitTo, showMore } from '../ui.js';

const view = { tab: 'integrations' };
const TABS = [['integrations', 'Integrations'], ['preferences', 'Preferences'], ['privacy', 'Responsible AI'], ['data', 'Data & activity']];

function workingHoursForm(s) {
  const st = s.settings;
  const time = (name, label, value) => html`<div class="field" data-field="${name}"><label for="set-${name}">${label}</label><input class="input" type="time" step="900" id="set-${name}" name="${name}" value="${value}" required /><span class="error-text" id="e-${name}"></span></div>`;
  return html`<form data-submit="settings-save" novalidate>
    <div class="form-grid">
      ${time('workStart', 'Work starts', st.workStart)}
      ${time('workEnd', 'Work ends', st.workEnd)}
      ${time('lunchStart', 'Lunch starts', st.lunchStart)}
      ${time('lunchEnd', 'Lunch ends', st.lunchEnd)}
      <div class="field" data-field="bufferMin"><label for="set-buffer">Buffer after each block (min)</label><input class="input" type="number" min="0" max="60" step="5" id="set-buffer" name="bufferMin" value="${st.bufferMin}" /><span class="error-text" id="e-bufferMin"></span></div>
      <div class="field" data-field="minChunkMin"><label for="set-chunk">Shortest task block (min)</label><input class="input" type="number" min="15" max="120" step="15" id="set-chunk" name="minChunkMin" value="${st.minChunkMin}" /><span class="error-text" id="e-minChunkMin"></span></div>
    </div>
    <div class="row mt"><button class="btn btn-primary" type="submit">Save preferences</button><span class="muted small">Used by the Smart Planner, capacity and risk calculations.</span></div>
  </form>`;
}

function renderPage(s) {
  return html`
    <div class="page-head">
      <div><h1>Settings & Integrations</h1><p>Planning preferences, Microsoft 365 connections and demo data.</p></div>
    </div>

    <p class="notice notice-info">${icon('info', 16)}<span class="grow"><strong>Prototype notice:</strong> no real Microsoft sign-in, Graph calls or Azure OpenAI requests are made. Every connection below is simulated or planned, and all data is fictional and stored only in this browser.</span></p>

    <div class="mt">${filterTabs('settings-tab', 'Settings sections', TABS, view.tab)}</div>
    <div class="mt">${SECTIONS[view.tab](s)}</div>`;
}

const SECTIONS = {
  integrations: (s) => html`
        <section class="card" aria-labelledby="int-h">
          <div class="card-head"><h2 id="int-h">Microsoft 365 integrations</h2><span class="muted small">Core &amp; MVP first, then Phase 2, then stretch goals</span></div>
          <div class="card-body grid grid-2" style="gap:12px">
            ${INTEGRATIONS.map((i) => {
              const on = !!s.integrations[i.id];
              const tone = i.phase.startsWith('Core') ? 'badge-brand' : i.phase === 'Phase 2' ? 'badge-ai' : 'badge-neutral';
              return html`<div class="card integration">
                <div class="integration-head">
                  <span class="integration-logo">${icon(i.icon, 18)}</span>
                  <div class="grow" style="flex:1"><strong>${i.name}</strong><div class="row wrap" style="gap:4px"><span class="badge ${tone}">${i.phase}</span><span class="badge ${on ? 'badge-success' : 'badge-neutral'}">${on ? 'Simulated · on' : 'Simulated · off'}</span></div></div>
                  <label class="switch"><input type="checkbox" role="switch" data-change="integration-toggle" value="${i.id}" ${on ? 'checked' : ''} aria-label="${i.name} simulated connection" /><span></span></label>
                </div>
                <p class="small">${i.data}</p>
                <div class="feature-chips" aria-label="AI features">${i.ai.map((f) => html`<span>${f}</span>`)}</div>
                <p class="small muted">In this prototype: ${i.demo}.</p>
                <button class="btn btn-sm" data-action="integration-test" data-id="${i.id}" ${on ? '' : 'disabled'}>${icon('refresh', 14)}Test sync</button>
              </div>`;
            })}
          </div>
        </section>`,
  preferences: (s) => html`
        <section class="card narrow" aria-labelledby="wh-h">
          <div class="card-head"><h2 id="wh-h">Planning preferences</h2></div>
          <div class="card-body">${workingHoursForm(s)}</div>
        </section>`,
  privacy: () => html`
        <section class="card narrow" aria-labelledby="pr-h">
          <div class="card-head"><h2 id="pr-h">${icon('shield', 16)} Responsible AI & privacy</h2></div>
          <div class="card-body small">
            <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
              <li><strong>Human approval:</strong> plans, reassignments and simulations never change calendars or owners until a person accepts them.</li>
              <li><strong>Explainable:</strong> every score, estimate and risk shows the rules behind it.</li>
              <li><strong>Role-based:</strong> officers only see their own tasks; team workload is supervisor-only.</li>
              <li><strong>Minimal data:</strong> absences are recorded as MC or leave — never medical details.</li>
              <li><strong>Deterministic:</strong> the prototype uses rule-based logic, not random or generated output.</li>
            </ul>
          </div>
        </section>`,
  data: (s) => html`<div class="stack narrow">
        <section class="card" aria-labelledby="dd-h">
          <div class="card-head"><h2 id="dd-h">Demo data</h2></div>
          <div class="card-body stack" style="gap:10px">
            <p class="small muted">Signed in as <strong>${isSupervisor(s) ? `${s.supervisor.name} (Supervisor)` : 'Aisyah Rahman (Officer)'}</strong>. Data seeded for ${fmtDay(s.seededFor)}. ${storage.ok ? 'Saved in this browser.' : 'Browser storage unavailable — changes are temporary.'}</p>
            <button class="btn btn-danger" data-action="reset-demo">${icon('reset', 16)}Reset demo data</button>
          </div>
        </section>

        <section class="card" aria-labelledby="al-h">
          <div class="card-head"><h2 id="al-h">Approval & activity log</h2></div>
          <div class="card-body flush">
            <ul class="activity">${limitTo('settings-activity', s.activity, 8).map((x) => html`<li><time>${fmtDay(x.at.slice(0, 10))} ${fmtTime(x.at.slice(11, 16))}</time><span><strong>${x.actor}</strong> · ${x.text}</span></li>`)}</ul>
            ${showMore('settings-activity', s.activity.length, 8, 'entries')}
          </div>
        </section>
      </div>`,
};

function saveSettings(form) {
  const fd = new FormData(form);
  const v = Object.fromEntries(['workStart', 'workEnd', 'lunchStart', 'lunchEnd'].map((k) => [k, String(fd.get(k) || '')]));
  const bufferMin = Number(fd.get('bufferMin'));
  const minChunkMin = Number(fd.get('minChunkMin'));
  const errors = {};
  const isTime = (t) => /^\d{2}:\d{2}$/.test(t);
  Object.entries(v).forEach(([k, t]) => {
    if (!isTime(t)) errors[k] = 'Enter a valid time.';
  });
  if (!errors.workEnd && !errors.workStart && toMin(v.workEnd) - toMin(v.workStart) < 240) errors.workEnd = 'Working day must be at least 4 hours.';
  if (!errors.lunchEnd && !errors.lunchStart && v.lunchEnd <= v.lunchStart) errors.lunchEnd = 'Lunch must end after it starts.';
  if (!errors.lunchStart && (v.lunchStart < v.workStart || v.lunchEnd > v.workEnd)) errors.lunchStart = 'Lunch must fall within working hours.';
  if (!(bufferMin >= 0 && bufferMin <= 60)) errors.bufferMin = 'Between 0 and 60 minutes.';
  if (!(minChunkMin >= 15 && minChunkMin <= 120)) errors.minChunkMin = 'Between 15 and 120 minutes.';

  form.querySelectorAll('[data-field]').forEach((el) => {
    const k = el.dataset.field;
    el.classList.toggle('invalid', !!errors[k]);
    const out = el.querySelector('.error-text');
    if (out) out.textContent = errors[k] || '';
  });
  if (Object.keys(errors).length) return;

  update((st) => {
    Object.assign(st.settings, v, { bufferMin, minChunkMin });
    logActivity(st, 'Updated planning preferences.');
  });
  toast('Preferences saved. Existing plans are marked out of date.');
}

export default {
  id: 'settings',
  title: 'Settings & Integrations',
  icon: 'settings',
  roles: ['officer', 'supervisor'],
  render: renderPage,
  actions: {
    'settings-tab': (el) => {
      view.tab = el.dataset.value;
      ctx.rerender();
      document.querySelector(`[data-action="settings-tab"][data-value="${el.dataset.value}"]`)?.focus();
    },
    'reset-demo': async () => {
      const ok = await confirmDialog({ title: 'Reset demo data?', body: 'All tasks, plans, appointments and approvals return to the original sample data.', confirmLabel: 'Reset data', danger: true });
      if (!ok) return;
      resetState();
      toast('Demo data reset');
    },
    'integration-test': (el) => {
      const i = INTEGRATIONS.find((x) => x.id === el.dataset.id);
      update((st) => logActivity(st, `Simulated sync check for ${i.name} — no external request made.`, 'SyncAI'));
      toast(`${i.name}: simulated sync OK. No external request was made.`, 'info');
    },
  },
  changes: {
    'integration-toggle': (el) => {
      const i = INTEGRATIONS.find((x) => x.id === el.value);
      update((st) => {
        st.integrations[i.id] = el.checked;
        logActivity(st, `${el.checked ? 'Enabled' : 'Disabled'} simulated ${i.name} connection.`);
      });
      toast(`${i.name} ${el.checked ? 'enabled' : 'disabled'} (simulated)`, 'info');
    },
  },
  submits: { 'settings-save': saveSettings },
};
