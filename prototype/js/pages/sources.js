// Data sources (12g shared data layer): how each EMS system feeds SyncAI.
// All connections are simulated; IEMS and TCMS details are assumptions to confirm with EMS.

import { NOW, fmtTime, timePart } from '../time.js';
import { html, icon, toast } from '../ui.js';
import { ctx } from '../ctx.js';

const M365_SOURCES = ['Outlook', 'Planner', 'To Do'];
const lastSync = {}; // simulated "Sync now" times for this session

const SOURCES = [
  { id: 'm365', name: 'Microsoft 365', icon: 'calendar', status: 'connected', via: 'Microsoft Graph', every: 'Every 15 minutes',
    provides: 'Meetings and free/busy time from Outlook; tasks from Planner and To Do. Approved plans are written back to Outlook.',
    entities: ['Meeting', 'Task', 'Free/busy'], count: (s) => `${s.meetings.length} meetings · ${s.tasks.filter((t) => M365_SOURCES.includes(t.source)).length} tasks` },
  { id: 'sharepoint', name: 'SharePoint / OneDrive', icon: 'folder', status: 'connected', via: 'Microsoft Graph (Sites.Selected)', every: 'On demand',
    provides: 'Meeting minutes and maintenance reports, read only when a user opens or imports them.',
    entities: ['Document', 'Minutes'], count: () => '128 documents (sample)' },
  { id: 'd365', name: 'Dynamics 365', icon: 'link', status: 'connected', via: 'Dataverse native tables', every: 'Near real time',
    provides: 'Contractors, contracts, work orders and invoices. Work orders become contractor tasks and lift defects.',
    entities: ['Contractor', 'Work order', 'Invoice'], count: () => '24 contractors · 312 work orders (sample)' },
  { id: 'iems', name: 'IEMS', icon: 'message', status: 'confirm', via: 'Power Automate custom connector or scheduled export', every: 'Hourly',
    provides: 'Resident feedback cases and estate defects, used for tasks, response rates and early-warning tracking.',
    entities: ['Feedback case', 'Defect'], count: () => 'Not connected' },
  { id: 'tcms', name: 'TCMS', icon: 'chart', status: 'planned', via: 'Scheduled export to Dataverse', every: 'Daily',
    provides: 'Town Council administration and finance figures for HQ roll-ups and management reports.',
    entities: ['Council', 'Budget line', 'Report score'], count: () => 'Not connected' },
  { id: 'entra', name: 'Microsoft Entra ID', icon: 'shield', status: 'connected', via: 'OpenID Connect + group claims', every: 'At sign-in',
    provides: 'Single sign-on, and security groups that decide each user’s role and Town Council.',
    entities: ['User', 'Role', 'Council'], count: (s) => `${s.officers.length + 2} demo users` },
];

const STATUS = {
  connected: ['badge-success', 'Connected · simulated'],
  confirm: ['badge-warning', 'To confirm with EMS'],
  planned: ['badge-neutral', 'Planned'],
};

function flow() {
  const box = (title, items, cls = '') => html`<div class="flow-box ${cls}"><strong>${title}</strong><ul>${items.map((i) => html`<li>${i}</li>`)}</ul></div>`;
  return html`<div class="flow" role="img" aria-label="Source systems feed connectors, which write to the shared Dataverse data layer. The Smart Work Planner, Project Tracker and HQ overview read from the data layer.">
    ${box('Source systems', ['Microsoft 365', 'SharePoint', 'Dynamics 365', 'IEMS', 'TCMS'])}
    <span class="flow-arrow" aria-hidden="true">${icon('arrow', 20)}</span>
    ${box('Connectors', ['Microsoft Graph', 'Dataverse tables', 'Power Automate flows'])}
    <span class="flow-arrow" aria-hidden="true">${icon('arrow', 20)}</span>
    ${box('Shared data layer', ['Dataverse', 'Tasks, projects, cases', 'Row-level security by council'], 'flow-core')}
    <span class="flow-arrow" aria-hidden="true">${icon('arrow', 20)}</span>
    ${box('Hub modules', ['Smart Work Planner (12i)', 'Project Tracker (12h)', 'HQ overview (12g)', 'Future: 12a–12f'])}
  </div>`;
}

function renderPage(s) {
  return html`
    <div class="page-head">
      <div><h1>Data sources</h1><p>One shared data layer for every module. Each EMS system feeds it through a connector, and SyncAI modules read only from the data layer.</p></div>
    </div>
    <p class="notice notice-info">${icon('info', 16)}<span class="grow"><strong>Prototype:</strong> every connection here is simulated. What IEMS and TCMS hold, and how they can be reached, are assumptions to confirm at the EMS briefing. See <code>docs/architecture.md</code>.</span></p>

    <section class="card mt" aria-labelledby="fl-h">
      <div class="card-head"><h2 id="fl-h">How data flows</h2></div>
      <div class="card-body">${flow()}</div>
    </section>

    <div class="grid grid-2 mt">
      ${SOURCES.map((src) => {
        const [tone, label] = STATUS[src.status];
        const synced = lastSync[src.id] || (src.status === 'connected' ? '08:15' : null);
        return html`<section class="card source-card" aria-labelledby="src-${src.id}">
          <div class="card-body stack" style="gap:10px">
            <div class="integration-head">
              <span class="integration-logo">${icon(src.icon, 18)}</span>
              <div class="grow" style="flex:1"><h2 id="src-${src.id}" style="font-size:15px">${src.name}</h2><span class="badge ${tone}">${label}</span></div>
              <button class="btn btn-sm" data-action="source-sync" data-id="${src.id}" ${src.status === 'connected' ? '' : 'disabled'}>${icon('refresh', 14)}Sync now</button>
            </div>
            <p class="small">${src.provides}</p>
            <div class="feature-chips" aria-label="Data provided">${src.entities.map((e) => html`<span>${e}</span>`)}</div>
            <div class="kv small"><span>Connector</span><span>${src.via}</span></div>
            <div class="kv small"><span>Schedule</span><span>${src.every}</span></div>
            <div class="kv small"><span>Records</span><span>${src.count(s)}</span></div>
            <div class="kv small"><span>Last sync</span><span>${synced ? `Today, ${fmtTime(synced)}` : '—'}</span></div>
          </div>
        </section>`;
      })}
    </div>`;
}

export default {
  id: 'sources',
  title: 'Data sources',
  icon: 'link',
  roles: ['supervisor', 'hq'],
  render: renderPage,
  actions: {
    'source-sync': (el) => {
      const src = SOURCES.find((x) => x.id === el.dataset.id);
      lastSync[src.id] = timePart(NOW);
      ctx.rerender();
      document.querySelector(`[data-action="source-sync"][data-id="${src.id}"]`)?.focus();
      toast(`${src.name} synced (simulated)`);
    },
  },
};
