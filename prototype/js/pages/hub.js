// EMS HQ overview (12g Operations Hub): roll-ups across Town Councils with a
// council switcher. HQ sees counts and project health only, never officer names.

import { COUNCILS } from '../data.js';
import { assessRisk, teamAnalysis } from '../planner.js';
import { isOpen, isOverdue } from '../state.js';
import { html, icon, filterTabs, meter, pct } from '../ui.js';
import { healthBadge, progressBar, projectHealth } from './projects.js';
import { ctx } from '../ctx.js';

const view = { council: 'all' };
// shortcut: the feedback response rate has no source in the demo data, so Northvale uses a fixed sample value; replace with IEMS case data.
const NORTHVALE_FEEDBACK_RATE = 0.92;
const STATUS = {
  support: { label: 'Needs support', tone: 'danger', rank: 2 },
  watch: { label: 'Watch', tone: 'warning', rank: 1 },
  healthy: { label: 'Healthy', tone: 'success', rank: 0 },
};

/** Roll-up for one council: live from the app state for Northvale, sample figures for the rest. */
function councilStats(s, c) {
  if (!c.live) return { ...c, projects: c.projects.map((p) => ({ ...p })) };
  const open = s.tasks.filter(isOpen);
  const team = teamAnalysis(s).filter((a) => a.status.id !== 'away');
  const work = team.reduce((n, a) => n + a.today.workMin, 0);
  return {
    ...c,
    officers: s.officers.length,
    openTasks: open.length,
    overdue: open.filter(isOverdue).length,
    highRisk: open.filter((t) => assessRisk(s, t).level === 'high').length,
    utilisation: team.reduce((n, a) => n + a.today.meetingMin + a.today.dueMin, 0) / (work || 1),
    feedbackRate: NORTHVALE_FEEDBACK_RATE,
    projects: s.projects.map((p) => {
      const h = projectHealth(s, p);
      return { name: p.name, level: h.level, progress: h.progress, id: p.id };
    }),
  };
}

export function statusOf(c) {
  const atRisk = c.projects.filter((p) => p.level === 'risk').length;
  const reasons = [];
  if (c.overdue >= 5) reasons.push(`${c.overdue} overdue tasks`);
  if (c.highRisk >= 8) reasons.push(`${c.highRisk} deadlines at high risk`);
  if (c.utilisation > 1) reasons.push(`team at ${pct(c.utilisation)} of capacity today`);
  if (atRisk >= 2) reasons.push(`${atRisk} projects at risk`);
  if (reasons.length) return { id: 'support', reasons };
  if (c.overdue) reasons.push(`${c.overdue} overdue task${c.overdue > 1 ? 's' : ''}`);
  if (c.highRisk >= 4) reasons.push(`${c.highRisk} deadlines at high risk`);
  if (c.utilisation >= 0.85) reasons.push(`team at ${pct(c.utilisation)} of capacity today`);
  if (atRisk === 1) reasons.push('1 project at risk');
  if (c.feedbackRate < 0.85) reasons.push(`feedback response rate ${pct(c.feedbackRate)}`);
  return { id: reasons.length ? 'watch' : 'healthy', reasons: reasons.length ? reasons : ['no overdue work and capacity to spare'] };
}

const statusBadge = (id) => html`<span class="badge badge-${STATUS[id].tone}">${STATUS[id].label}</span>`;

function totals(list) {
  const officers = list.reduce((n, c) => n + c.officers, 0);
  return {
    openTasks: list.reduce((n, c) => n + c.openTasks, 0),
    overdue: list.reduce((n, c) => n + c.overdue, 0),
    highRisk: list.reduce((n, c) => n + c.highRisk, 0),
    projects: list.flatMap((c) => c.projects),
    // Weighted by team size so a small council does not skew the average.
    utilisation: list.reduce((n, c) => n + c.utilisation * c.officers, 0) / (officers || 1),
    officers,
  };
}

function briefing(list) {
  const ranked = list.map((c) => ({ c, st: statusOf(c) })).sort((a, b) => STATUS[b.st.id].rank - STATUS[a.st.id].rank || b.c.overdue - a.c.overdue);
  const support = ranked.filter((x) => x.st.id === 'support');
  // Only councils that are not struggling themselves are suggested as helpers.
  const spare = ranked.filter((x) => x.st.id !== 'support' && x.c.utilisation < 0.75).map((x) => x.c.short);
  const lines = ranked.map(({ c, st }) => html`<li style="justify-content:flex-start;gap:8px">${icon(st.id === 'healthy' ? 'check' : 'alert', 14)}<span><strong>${c.short}</strong> · ${STATUS[st.id].label}: ${st.reasons.join(', ')}.</span></li>`);
  const headline = support.length
    ? `${support.map((x) => x.c.short).join(' and ')} need${support.length === 1 ? 's' : ''} support this week.${spare.length ? ` ${spare.join(' and ')} ha${spare.length === 1 ? 's' : 've'} spare capacity that could help through a temporary loan of officers or contractor hours.` : ''}`
    : 'All councils are within normal limits this week.';
  return html`<p class="ai-headline">${headline}</p><ul class="reasons" style="gap:6px">${lines}</ul>`;
}

function kpis(t) {
  const atRisk = t.projects.filter((p) => p.level === 'risk').length;
  return html`<div class="grid grid-4">
    <div class="card stat"><div class="stat-label"><span class="stat-icon">${icon('check-square', 16)}</span>Open tasks</div><div class="stat-value">${t.openTasks}</div><div class="stat-foot">${t.officers} officers</div></div>
    <div class="card stat"><div class="stat-label"><span class="stat-icon ${t.overdue ? 'danger' : 'success'}">${icon('clock', 16)}</span>Overdue</div><div class="stat-value">${t.overdue}</div><div class="stat-foot">${t.highRisk} deadlines at high risk</div></div>
    <div class="card stat"><div class="stat-label"><span class="stat-icon ${atRisk ? 'warning' : 'success'}">${icon('folder', 16)}</span>Projects at risk</div><div class="stat-value">${atRisk}</div><div class="stat-foot">of ${t.projects.length} projects</div></div>
    <div class="card stat"><div class="stat-label"><span class="stat-icon ai">${icon('trend', 16)}</span>Team utilisation today</div><div class="stat-value">${pct(t.utilisation)}</div>${meter(t.utilisation, { label: 'Team utilisation today' })}</div>
  </div>`;
}

function comparison(list) {
  return html`<div class="table-wrap"><table class="table">
    <caption class="sr-only">Town Council comparison</caption>
    <thead><tr><th>Town Council</th><th>Status</th><th>Officers</th><th>Open tasks</th><th>Overdue</th><th>High risk</th><th>Utilisation</th><th title="Share of resident feedback answered within the target time">Feedback response</th><th>Projects at risk</th><th><span class="sr-only">Open</span></th></tr></thead>
    <tbody>${list.map((c) => {
      const st = statusOf(c);
      return html`<tr>
        <td style="white-space:nowrap"><strong>${c.short}</strong>${c.live ? html` <span class="badge badge-ai" title="Computed from SyncAI data">Live</span>` : ''}</td>
        <td>${statusBadge(st.id)}</td>
        <td>${c.officers}</td>
        <td>${c.openTasks}</td>
        <td class="${c.overdue ? 'delta-bad' : ''}">${c.overdue}</td>
        <td>${c.highRisk}</td>
        <td style="min-width:120px">${pct(c.utilisation)}${meter(c.utilisation, { label: `${c.short} utilisation` })}</td>
        <td>${pct(c.feedbackRate)}</td>
        <td>${c.projects.filter((p) => p.level === 'risk').length} / ${c.projects.length}</td>
        <td><button class="btn btn-sm" data-action="hub-council" data-value="${c.id}">View</button></td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

function councilProjects(c) {
  const order = { risk: 0, attention: 1, 'on-track': 2, done: 3 };
  return html`<ul class="list">${[...c.projects].sort((a, b) => order[a.level] - order[b.level]).map(
    (p) => html`<li class="list-item">
      <div class="grow"><div class="row wrap" style="justify-content:space-between"><strong>${p.name}</strong>${healthBadge(p.level)}</div>
        <div class="row small" style="gap:10px"><div style="flex:1">${progressBar(p.progress, 'var(--brand)')}</div><span class="muted" style="white-space:nowrap">${pct(p.progress)} done</span></div></div>
    </li>`,
  )}</ul>`;
}

function renderPage(s) {
  const all = COUNCILS.map((c) => councilStats(s, c));
  const one = all.find((c) => c.id === view.council);
  const list = one ? [one] : all;
  const tabs = [['all', 'All councils', null], ...all.map((c) => [c.id, c.short, null])];

  return html`
    <div class="page-head">
      <div><h1>EMS HQ overview</h1><p>Roll-ups across ${all.length} Town Councils. Northvale is live from SyncAI; the other councils show sample figures in this prototype.</p></div>
      <div class="actions"><a class="btn" href="#/sources">${icon('link', 16)}Data sources</a></div>
    </div>
    ${filterTabs('hub-council', 'Town Council', tabs, view.council)}

    <div class="mt">${kpis(totals(list))}</div>

    <div class="grid grid-main mt">
      <section class="card ai-card" aria-labelledby="hb-h">
        <div class="card-head"><h2 id="hb-h"><span class="ai-label">${icon('sparkles', 16)}${one ? `${one.short} briefing` : 'AI HQ briefing'}</span></h2>${one ? statusBadge(statusOf(one).id) : html`<span class="badge badge-ai">Generated locally · deterministic</span>`}</div>
        <div class="card-body">${briefing(list)}</div>
      </section>
      <section class="card" aria-labelledby="pv-h">
        <div class="card-head"><h2 id="pv-h">${icon('shield', 16)} What HQ can see</h2></div>
        <div class="card-body small stack" style="gap:8px">
          <p>Counts, risk, progress and utilisation for each Town Council.</p>
          <p>Individual officers' names, tasks, absences and schedules stay with each council's supervisors.</p>
          <p class="muted">In production this is enforced by Entra ID roles and Dataverse row-level security, not only by the screen.</p>
        </div>
      </section>
    </div>

    ${one
      ? html`<section class="card mt" aria-labelledby="cp-h">
          <div class="card-head"><h2 id="cp-h">${one.name} projects</h2><span class="muted small">${one.live ? 'Live from SyncAI' : 'Sample figures'}</span></div>
          <div class="card-body flush">${councilProjects(one)}</div>
        </section>`
      : html`<section class="card mt" aria-labelledby="cc-h">
          <div class="card-head"><h2 id="cc-h">Compare Town Councils</h2><span class="muted small">Select View to open a council</span></div>
          <div class="card-body flush">${comparison(all)}</div>
        </section>`}`;
}

export default {
  id: 'hub',
  title: 'HQ overview',
  icon: 'chart',
  roles: ['hq'],
  render: renderPage,
  actions: {
    'hub-council': (el) => {
      view.council = el.dataset.value;
      ctx.rerender();
      document.querySelector(`.filter-tabs [data-action="hub-council"][data-value="${el.dataset.value}"]`)?.focus();
    },
  },
};
