import { CATEGORIES } from '../data.js';
import { assessRisk, teamAnalysis } from '../planner.js';
import { getState, getTask, isOpen, openTasksFor, remainingHours, logActivity, officerName, update, absenceLabel } from '../state.js';
import { applyReassignment, rankCandidates } from '../simulation.js';
import { NOW, fmtDay, fmtDue, fmtHours } from '../time.js';
import { html, icon, avatar, capacityBadge, meter, pct, riskBadge, priorityBadge, emptyState, toast, confirmDialog, limitTo, showMore } from '../ui.js';
import { ctx } from '../ctx.js';
import { openReassignDialog, recCard, visibleRecs } from './shared.js';

const view = { selected: null };

function heatClass(u) {
  if (u == null) return 'heat-away';
  if (u < 0.5) return 'heat-0';
  if (u < 0.75) return 'heat-1';
  if (u < 0.9) return 'heat-2';
  if (u <= 1) return 'heat-3';
  return 'heat-4';
}

/** Why an officer is falling behind — overdue work, late plans, overruns, meetings. */
function delayDrivers(s, a) {
  const out = [];
  const open = openTasksFor(s, a.officer.id);
  const overdue = open.filter((t) => t.due < NOW).length;
  if (overdue) out.push(`${overdue} overdue task${overdue > 1 ? 's' : ''}`);
  if (a.missing) out.push(`${a.missing} task${a.missing > 1 ? 's' : ''} won't finish on time`);
  const done = s.tasks.filter((t) => t.ownerId === a.officer.id && t.status === 'done' && t.actual);
  const ratio = done.reduce((n, t) => n + t.actual, 0) / (done.reduce((n, t) => n + t.effort, 0) || 1);
  if (done.length >= 2 && ratio > 1.15) out.push(`work runs ${Math.round((ratio - 1) * 100)}% over estimate`);
  if (!a.today.unavailable && a.today.meetingMin / a.today.workMin > 0.3) out.push(`${Math.round((a.today.meetingMin / a.today.workMin) * 100)}% of today in meetings`);
  return out;
}

function heatmap(team) {
  const days = team[0].perDay.map((p) => p.date);
  return html`<div class="table-wrap"><table class="heatmap">
    <caption class="sr-only">Daily utilisation by officer. Values above 100% mean demand exceeds working time.</caption>
    <thead><tr><th scope="col">Officer</th>${days.map((d, i) => html`<th scope="col">${i === 0 ? 'Today' : fmtDay(d)}</th>`)}<th scope="col">Week</th></tr></thead>
    <tbody>
      ${team.map(
        (a) => html`<tr>
          <th scope="row"><button class="task-title" data-action="team-select" data-id="${a.officer.id}">${a.officer.name}</button></th>
          ${a.perDay.map(
            (p) => html`<td class="cell ${heatClass(p.util)}" title="${a.officer.name}, ${fmtDay(p.date)}: ${p.unavailable ? 'unavailable' : `${pct(p.util)} — ${fmtHours(p.meetingMin / 60)} meetings + ${fmtHours(p.dueMin / 60)} task work due`}">
              ${p.unavailable ? 'Away' : pct(p.util)}${p.util > 1 ? html`<span class="sr-only"> overloaded</span>` : ''}
            </td>`,
          )}
          <td class="cell ${heatClass(a.weekUtil)}" style="outline:2px solid rgba(0,0,0,.08)" title="${a.officer.name}, whole week: ${pct(a.weekUtil)}">${a.weekUtil == null ? 'Away' : pct(a.weekUtil)}</td>
        </tr>`,
      )}
    </tbody>
  </table></div>
  <div class="heat-scale mt-sm" aria-hidden="true"><span>Scale:</span><span class="heat-0">&lt;50%</span><span class="heat-1">50–74%</span><span class="heat-2">75–89%</span><span class="heat-3">90–100%</span><span class="heat-4">&gt;100%</span><span class="heat-away">Away</span></div>`;
}

function officerDetail(s, a) {
  const open = openTasksFor(s, a.officer.id).sort((x, y) => x.due.localeCompare(y.due));
  const byCat = CATEGORIES.map((c) => ({ c, h: open.filter((t) => t.category === c).reduce((n, t) => n + remainingHours(t), 0) })).filter((x) => x.h > 0);
  const maxH = Math.max(...byCat.map((x) => x.h), 1);
  return html`<section class="card mt" aria-labelledby="od-h">
    <div class="card-head">
      <h2 id="od-h" class="row">${avatar(a.officer.name)}${a.officer.name} <span class="sub">${a.officer.title} · ${a.officer.zone}</span></h2>
      <div class="row wrap">
        ${capacityBadge(a.status)}
        <button class="btn btn-sm" data-action="team-preview-absence" data-id="${a.officer.id}">${icon('flask', 14)}Preview absence impact</button>
        <button class="icon-btn" data-action="team-select" data-id="" aria-label="Close officer details">${icon('x')}</button>
      </div>
    </div>
    <div class="card-body grid grid-2">
      <div>
        <h3>Workload by category</h3>
        <div class="bars mt-sm">
          ${byCat.length
            ? byCat.map((x) => html`<div class="bar-row"><span>${x.c}</span><div class="bar-track"><div class="bar-fill est" style="width:${(x.h / maxH) * 100}%;background:var(--brand)"></div></div><span class="small">${fmtHours(x.h)}</span></div>`)
            : html`<p class="muted">No open work.</p>`}
        </div>
        ${delayDrivers(s, a).length ? html`<h3 class="mt">What's causing delays</h3><ul class="reasons">${delayDrivers(s, a).map((d) => html`<li><span>${d}</span></li>`)}</ul>` : ''}
        <div class="kv mt"><span>Skills</span><span>${a.officer.skills.join(', ')}</span></div>
        <div class="kv"><span>Week demand</span><b>${fmtHours(a.loadHours + a.meetingHours)} / ${fmtHours(a.workHours)}</b></div>
        <div class="kv"><span>Absences this week</span><span>${a.perDay.filter((p) => p.unavailable).map((p) => `${fmtDay(p.date)} (${absenceLabel(p.kind, true)})`).join(', ') || 'None'}</span></div>
      </div>
      <div>
        <h3>Open tasks</h3>
        <ul class="list mt-sm" style="border:1px solid var(--border);border-radius:8px">
          ${open.length
            ? limitTo(`team-open-${a.officer.id}`, open, 5).map((t) => {
                const r = assessRisk(s, t);
                return html`<li class="list-item" style="padding:8px 12px"><div class="grow">
                  <button class="task-title title" data-action="task-view" data-id="${t.id}">${t.title}</button>
                  <div class="meta"><span>${fmtDue(t.due)}</span><span>${fmtHours(t.effort)}</span>${priorityBadge(t.priority)}</div>
                </div>${riskBadge(r.level)}<button class="btn btn-sm" data-action="team-reassign" data-id="${t.id}">Reassign</button></li>`;
              })
            : html`<li class="list-item">No open tasks.</li>`}
        </ul>
        ${showMore(`team-open-${a.officer.id}`, open.length, 5, 'open tasks')}
      </div>
    </div>
  </section>`;
}

function renderPage(s) {
  const team = teamAnalysis(s);
  const recs = visibleRecs(s);
  const avail = team.filter((a) => a.status.id !== 'away');
  const cap = avail.reduce((n, a) => n + a.workHours, 0);
  const demand = avail.reduce((n, a) => n + a.loadHours + a.meetingHours, 0);
  const selected = team.find((a) => a.officer.id === view.selected);
  const todayCap = avail.reduce((n, a) => n + a.today.workMin, 0);
  const todayUtil = avail.reduce((n, a) => n + a.today.meetingMin + a.today.dueMin, 0) / (todayCap || 1);

  return html`
    <div class="page-head">
      <div><h1>Team Workload</h1><p>Capacity, overload and skill-aware reassignment across ${s.officers.length} officers this week.</p></div>
      <div class="actions"><a class="btn btn-ai" href="#/simulator">${icon('flask', 16)}What-if simulator</a></div>
    </div>

    <div class="grid grid-4">
      <div class="card stat"><div class="stat-label"><span class="stat-icon">${icon('clock', 16)}</span>Available capacity</div><div class="stat-value">${fmtHours(cap)}</div><div class="stat-foot">${avail.length} officers available today</div></div>
      <div class="card stat"><div class="stat-label"><span class="stat-icon ai">${icon('chart', 16)}</span>Demand this week</div><div class="stat-value">${fmtHours(demand)}</div><div class="stat-foot">Meetings + task work due</div></div>
      <div class="card stat"><div class="stat-label"><span class="stat-icon ${todayUtil > 0.85 ? 'warning' : 'success'}">${icon('trend', 16)}</span>Team utilisation today</div><div class="stat-value">${pct(todayUtil)}</div>${meter(todayUtil, { label: 'Team utilisation today' })}</div>
      <div class="card stat"><div class="stat-label"><span class="stat-icon ${recs.length ? 'warning' : 'success'}">${icon('users', 16)}</span>Suggested reassignments</div><div class="stat-value">${recs.length}</div><div class="stat-foot">Awaiting your approval</div></div>
    </div>

    <div class="grid grid-main mt">
      <section class="card" aria-labelledby="hm-h">
        <div class="card-head"><h2 id="hm-h">Workload heatmap <span class="sub">meetings + work due ÷ working time</span></h2></div>
        <div class="card-body">${heatmap(team)}</div>
      </section>

      <section class="card" aria-labelledby="rc-h">
        <div class="card-head"><h2 id="rc-h"><span class="ai-label">${icon('sparkles', 16)}Reassignment recommendations</span></h2>
          ${recs.length > 1 ? html`<button class="btn btn-sm" data-action="rec-accept-all">Accept all</button>` : ''}</div>
        <div class="card-body">
          ${recs.length ? html`${limitTo('team-recs', recs, 3).map((r) => recCard(s, r))}${showMore('team-recs', recs.length, 3, 'recommendations')}` : emptyState('check', 'No reassignments needed', 'SyncAI will suggest moves when an officer is overloaded or unavailable.')}
        </div>
      </section>
    </div>

    <section class="card mt" aria-labelledby="ot-h">
      <div class="card-head"><h2 id="ot-h">Officers</h2><span class="muted small">Select an officer for a task breakdown</span></div>
      <div class="card-body flush table-wrap">
        <table class="table">
          <thead><tr><th>Officer</th><th>Status</th><th>Today</th><th class="hide-sm">This week</th><th class="hide-sm">Open</th><th>At risk</th><th>Falling behind?</th><th class="hide-sm">Skills</th></tr></thead>
          <tbody>
            ${team.map(
              (a) => html`<tr>
                <td><button class="task-title row" data-action="team-select" data-id="${a.officer.id}" aria-expanded="${view.selected === a.officer.id}">${avatar(a.officer.name, 'sm')}${a.officer.name}</button><div class="meta">${a.officer.title} · ${a.officer.zone}</div></td>
                <td>${capacityBadge(a.status)}</td>
                <td style="min-width:140px">${a.today.unavailable ? html`<span class="muted">${absenceLabel(a.today.kind, true)}</span>` : html`<div class="row">${meter(a.today.util, { label: `${a.officer.name} today` })}<span class="small">${pct(a.today.util)}</span></div>`}</td>
                <td class="hide-sm">${pct(a.weekUtil)}</td>
                <td class="hide-sm">${a.openCount}</td>
                <td>${a.atRisk.length ? html`<span class="badge badge-danger">${a.atRisk.length}</span>` : html`<span class="muted">0</span>`}</td>
                <td class="small" style="max-width:240px">${(() => {
                  const d = delayDrivers(s, a);
                  return d.length ? html`<span class="delta-bad">${d[0]}</span>${d.length > 1 ? html`<span class="muted"> +${d.length - 1} more</span>` : ''}` : html`<span class="muted">On track</span>`;
                })()}</td>
                <td class="hide-sm small muted">${a.officer.skills.join(', ')}</td>
              </tr>`,
            )}
          </tbody>
        </table>
      </div>
    </section>

    ${selected ? officerDetail(s, selected) : ''}`;
}

export default {
  id: 'team',
  title: 'Team Workload',
  icon: 'users',
  roles: ['supervisor'],
  render: renderPage,
  actions: {
    'team-select': (el) => {
      view.selected = el.dataset.id === view.selected ? null : el.dataset.id || null;
      ctx.rerender();
      if (view.selected) document.getElementById('od-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'team-reassign': (el) => {
      const s = getState();
      const t = getTask(s, el.dataset.id);
      const best = rankCandidates(s, t, { exclude: [t.ownerId] })[0];
      openReassignDialog({ id: `manual:${t.id}`, taskId: t.id, toId: best?.officer.id || null });
    },
    'team-preview-absence': (el) => {
      ctx.pending = { simulate: { absent: [el.dataset.id] } };
      ctx.navigate('simulator');
    },
    'rec-accept-all': async () => {
      const s = getState();
      const recs = visibleRecs(s);
      const ok = await confirmDialog({
        title: `Approve ${recs.length} reassignments?`,
        body: recs.map((r) => `“${getTask(s, r.taskId).title}” → ${officerName(s, r.toId)}`).join(' · '),
        confirmLabel: 'Approve all',
      });
      if (!ok) return;
      update((st) => {
        recs.forEach((r) => {
          if (getTask(st, r.taskId) && isOpen(getTask(st, r.taskId))) applyReassignment(st, r);
        });
        logActivity(st, `Approved ${recs.length} reassignment recommendations.`);
      });
      toast(`${recs.length} tasks reassigned. Officers would be notified in Teams (simulated).`);
    },
  },
};
