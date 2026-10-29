import { WEEKLY_TREND } from '../data.js';
import { effortAccuracy, scoreTask, explainScore } from '../ai.js';
import { analyseOfficer, assessRisk, meetingConflicts, teamAnalysis } from '../planner.js';
import { isOpen, isSupervisor, officerName, openTasksFor, visibleTasks, getOfficer, absenceLabel } from '../state.js';
import { TODAY, NOW, horizonDays, workDay, datePart, fmtDay, fmtDue, fmtHours, fmtTime } from '../time.js';
import { html, icon, pct, riskBadge, emptyState, limitTo, showMore } from '../ui.js';
import { ctx } from '../ctx.js';
import { visibleRecs } from './shared.js';

const view = { period: 'daily', riskFilter: 'high' };

function bullets(items) {
  return html`<ul class="reasons" style="gap:6px">${items.map((i) => html`<li style="justify-content:flex-start;gap:8px">${icon(i.icon, 14)}<span>${i.text}</span></li>`)}</ul>`;
}

function officerBriefing(s) {
  const me = s.currentOfficerId;
  const a = analyseOfficer(s, me);
  const open = openTasksFor(s, me);
  const ranked = open.map((t) => ({ t, sc: scoreTask(s, t).score })).sort((x, y) => y.sc - x.sc);
  const risks = open.filter((t) => assessRisk(s, t).level === 'high');
  if (view.period === 'daily') {
    const load = a.today.dueMin / 60;
    const free = (a.today.workMin - a.today.meetingMin) / 60;
    const conflicts = meetingConflicts(s, me, TODAY);
    return {
      headline: load <= free ? `Today is achievable: ${fmtHours(load)} of work due against ${fmtHours(free)} of free time.` : `Today is over-committed: ${fmtHours(load)} of work due but only ${fmtHours(free)} free.`,
      items: [
        ...ranked.slice(0, 3).map(({ t }, i) => ({ icon: 'zap', text: `${i + 1}. ${t.title} — ${explainScore(s, t)}` })),
        ...conflicts.map(([m1, m2]) => ({ icon: 'calendar', text: `Meeting clash: “${m1.title}” overlaps “${m2.title}” at ${fmtTime(m2.start)}.` })),
        ...risks.map((t) => ({ icon: 'alert', text: `At risk: ${t.title} — ${assessRisk(s, t).reasons[0]}` })),
      ],
    };
  }
  const days = horizonDays();
  const dueWeek = open.filter((t) => datePart(t.due) <= days[days.length - 1]);
  return {
    headline: `This week you have ${dueWeek.length} tasks due (${fmtHours(a.loadHours)}) and ${fmtHours(a.meetingHours)} of meetings — ${pct(a.weekUtil)} of your working time.`,
    items: [
      ...a.perDay.map((p) => ({ icon: p.unavailable ? 'user' : 'calendar', text: `${fmtDay(p.date)}: ${p.unavailable ? 'unavailable' : `${pct(p.util)} committed (${fmtHours(p.meetingMin / 60)} meetings, ${fmtHours(p.dueMin / 60)} work due)`}` })),
      { icon: 'sparkles', text: a.weekUtil < 0.7 ? 'You have room this week — consider pulling forward low-priority admin work.' : 'Your week is busy — keep low-priority admin for Friday.' },
    ],
  };
}

function supervisorBriefing(s) {
  const team = teamAnalysis(s);
  const recs = visibleRecs(s);
  const over = team.filter((a) => a.status.id === 'over');
  const away = team.filter((a) => a.status.id === 'away');
  const spare = team.filter((a) => a.status.id === 'spare');
  const risks = s.tasks.filter((t) => isOpen(t) && assessRisk(s, t).level === 'high');
  if (view.period === 'daily') {
    return {
      headline: `${over.length} overloaded, ${away.length} unavailable and ${spare.length} with spare capacity. ${risks.length} deadlines are at high risk today.`,
      items: [
        ...over.map((a) => ({ icon: 'alert', text: `${a.officer.name} is at ${pct(a.today.util)} today with ${a.missing} task(s) that cannot be completed on time.` })),
        ...away.map((a) => ({ icon: 'user', text: `${a.officer.name} is unavailable (${absenceLabel(a.today.kind, true)}) — ${a.atRisk.length} of their tasks need cover.` })),
        ...spare.map((a) => ({ icon: 'check', text: `${a.officer.name} has ${fmtHours(a.freeHours)} spare this week (${a.officer.skills.join(', ')}).` })),
        ...team.flatMap((a) => {
          const peak = a.perDay.slice(1).find((p) => !p.unavailable && p.util >= 0.8);
          return peak ? [{ icon: 'trend', text: `Forecast: ${a.officer.name} is likely to be stretched on ${fmtDay(peak.date)} (${pct(peak.util)} committed).` }] : [];
        }),
        { icon: 'sparkles', text: recs.length ? `${recs.length} reassignment(s) would reduce high-risk deadlines — review them in Team Workload.` : 'No reassignments needed right now.' },
      ],
    };
  }
  const t = WEEKLY_TREND;
  const n = t.created.length;
  const backlog = t.created.slice(-3).reduce((a, b) => a + b, 0) - t.completed.slice(-3).reduce((a, b) => a + b, 0);
  const avgUtil = team.filter((a) => a.weekUtil != null && a.status.id !== 'away');
  const projected = avgUtil.reduce((x, a) => x + a.weekUtil, 0) / (avgUtil.length || 1);
  return {
    headline: `Utilisation averaged ${t.utilisation[n - 1]}% last week; this week is projected at ${pct(projected)} on the work already scheduled. The backlog grew by ${backlog} tasks over the last three weeks.`,
    items: [
      { icon: 'trend', text: `Tasks created outpaced tasks completed in ${t.created.filter((c, i) => c > t.completed[i]).length} of the last ${n} weeks.` },
      { icon: 'chart', text: `Peak utilisation was ${Math.max(...t.utilisation)}% (${t.labels[t.utilisation.indexOf(Math.max(...t.utilisation))]}).` },
      ...team.filter((a) => a.perDay.some((p) => p.unavailable)).map((a) => ({ icon: 'user', text: `${a.officer.name} away on ${a.perDay.filter((p) => p.unavailable).map((p) => fmtDay(p.date)).join(', ')}.` })),
    ],
  };
}

function riskAlerts(s) {
  const sup = isSupervisor(s);
  const rows = visibleTasks(s)
    .filter(isOpen)
    .map((t) => ({ t, r: assessRisk(s, t) }))
    .filter(({ r }) => (view.riskFilter === 'all' ? r.level !== 'low' : r.level === view.riskFilter))
    .sort((a, b) => (a.r.level === b.r.level ? a.t.due.localeCompare(b.t.due) : a.r.level === 'high' ? -1 : 1));
  if (!rows.length) return emptyState('check', 'No deadlines at this risk level', 'SyncAI re-checks risks whenever tasks, meetings or availability change.');
  const key = `ins-risk-${view.riskFilter}`;
  return html`<ul class="list">${limitTo(key, rows, 5).map(
    ({ t, r }) => html`<li class="list-item" style="align-items:flex-start">
      <span class="stat-icon ${r.level === 'high' ? 'danger' : 'warning'}">${icon('alert', 14)}</span>
      <div class="grow">
        <div class="row wrap"><button class="task-title" data-action="task-view" data-id="${t.id}">${t.title}</button>${riskBadge(r.level)}</div>
        <div class="meta"><span>Due ${fmtDue(t.due)}</span>${sup ? html`<span>${officerName(s, t.ownerId)}</span>` : ''}<span>${fmtHours(t.effort)}</span></div>
        <ul class="reasons">${r.reasons.map((x) => html`<li><span>${x}</span></li>`)}</ul>
        <div class="row wrap mt-sm">
          <button class="btn btn-sm" data-action="task-edit" data-id="${t.id}">Adjust task</button>
          <a class="btn btn-sm btn-subtle" href="#/planner">Open planner</a>
          ${sup ? html`<a class="btn btn-sm btn-subtle" href="#/team">Reassign</a>` : ''}
        </div>
      </div>
    </li>`,
  )}</ul>${showMore(key, rows.length, 5, 'alerts')}`;
}

function accuracyChart(s) {
  const rows = effortAccuracy(s);
  const max = Math.max(...rows.map((r) => Math.max(r.est, r.actual) / r.n), 1);
  return html`<div class="bars">
    ${rows.map((r) => {
      const est = r.est / r.n;
      const act = r.actual / r.n;
      const diff = Math.round((r.ratio - 1) * 100);
      return html`<div class="bar-row">
        <span>${r.category}</span>
        <div class="bar-track" role="img" aria-label="${r.category}: estimated ${fmtHours(est)}, actual ${fmtHours(act)} on average">
          <div class="bar-fill est" style="width:${(est / max) * 100}%"></div>
          <div class="bar-fill act ${r.ratio > 1.15 ? 'over' : ''}" style="width:${(act / max) * 100}%"></div>
        </div>
        <span class="small ${diff > 15 ? 'delta-bad' : diff < -5 ? 'delta-good' : ''}">${diff > 0 ? '+' : ''}${diff}%</span>
      </div>`;
    })}
  </div>
  <div class="legend mt"><span><i style="background:#b8d4f0;border-color:#b8d4f0"></i>Estimated (avg)</span><span><i style="background:var(--brand);border-color:var(--brand)"></i>Actual (avg)</span><span><i style="background:#d13438;border-color:#d13438"></i>&gt;15% over</span></div>`;
}

function trendChart() {
  const t = WEEKLY_TREND;
  const W = 400;
  const H = 210;
  const P = { l: 30, r: 14, t: 12, b: 40 };
  const max = 60;
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (t.labels.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return html`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tasks created versus completed over the last six weeks">
    ${[0, 20, 40, 60].map((v) => html`<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e1e3e8" /><text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`)}
    <path d="${line(t.created)}" fill="none" stroke="#e08a00" stroke-width="2.5" />
    <path d="${line(t.completed)}" fill="none" stroke="#0f6cbd" stroke-width="2.5" />
    ${t.created.map((v, i) => html`<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#e08a00" />`)}
    ${t.completed.map((v, i) => html`<rect x="${x(i) - 3.5}" y="${y(v) - 3.5}" width="7" height="7" fill="#0f6cbd" />`)}
    ${t.labels.map((l, i) => html`<text x="${x(i)}" y="${H - 22}" text-anchor="middle">${l}</text><text x="${x(i)}" y="${H - 6}" text-anchor="middle" style="font-weight:600">${t.utilisation[i]}%</text>`)}
  </svg>
  <div class="legend"><span><i style="background:#e08a00;border-color:#e08a00"></i>Created (●)</span><span><i style="background:#0f6cbd;border-color:#0f6cbd"></i>Completed (■)</span><span>Bottom row: team utilisation</span></div>`;
}

/** Summary of the past week: what got done, recurring delays, what to change. */
function weeklyReflection(s) {
  const sup = isSupervisor(s);
  const since = `${workDay(-5)}T00:00`;
  const scope = sup ? s.tasks : s.tasks.filter((t) => t.ownerId === s.currentOfficerId);
  const done = scope.filter((t) => t.status === 'done' && t.completedAt && t.completedAt >= since);
  const est = done.reduce((n, t) => n + t.effort, 0);
  const act = done.reduce((n, t) => n + (t.actual || t.effort), 0);
  const onTime = done.filter((t) => t.completedAt <= t.due).length;
  const overruns = done.filter((t) => t.actual && t.actual > t.effort * 1.15);
  const byCat = {};
  overruns.forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + 1));
  const recurring = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const overdue = scope.filter((t) => isOpen(t) && t.due < NOW);
  const improvements = [];
  if (recurring.length) improvements.push(`Plan extra time for ${recurring[0][0].toLowerCase()} work — ${recurring[0][1]} task(s) overran last week.`);
  if (overdue.length) improvements.push(`Clear ${overdue.length} overdue task(s) first thing, or agree new dates.`);
  improvements.push(sup ? 'Review the heatmap on Monday and rebalance before officers fall behind.' : 'Accept your plan each morning so your time is protected in Outlook.');
  return html`<section class="card ai-card" aria-labelledby="wr-h">
    <div class="card-head"><h2 id="wr-h"><span class="ai-label">${icon('sparkles', 16)}AI weekly reflection</span></h2><span class="muted small">Last 5 working days</span></div>
    <div class="card-body">
      <div class="grid grid-3" style="gap:10px">
        <div class="compare-col"><h4>Completed</h4><div class="stat-value">${done.length}</div><div class="small muted">${fmtHours(act)} spent</div></div>
        <div class="compare-col"><h4>On time</h4><div class="stat-value">${done.length ? pct(onTime / done.length) : '—'}</div><div class="small muted">${onTime} of ${done.length}</div></div>
        <div class="compare-col"><h4>Estimate accuracy</h4><div class="stat-value">${est ? pct(act / est) : '—'}</div><div class="small muted">actual ÷ estimated</div></div>
      </div>
      <h3 class="mt">Recurring delays</h3>
      ${recurring.length ? bullets(recurring.map(([c, n]) => ({ icon: 'clock', text: `${c}: ${n} task(s) took more than 15% longer than estimated.` }))) : html`<p class="small muted">No recurring overruns.</p>`}
      <h3 class="mt">Improvements for next week</h3>
      ${bullets(improvements.map((text) => ({ icon: 'check', text })))}
    </div>
  </section>`;
}

function correctiveActions(s) {
  const out = [];
  effortAccuracy(s)
    .filter((r) => r.ratio > 1.15)
    .forEach((r) => out.push({ icon: 'clock', text: `${r.category} tasks run ${Math.round((r.ratio - 1) * 100)}% over estimate. SyncAI now adds this margin to new ${r.category.toLowerCase()} estimates; consider updating SOP time standards.` }));
  if (isSupervisor(s)) {
    const recs = visibleRecs(s);
    if (recs.length) out.push({ icon: 'users', text: `Approve ${recs.length} suggested reassignment(s) to clear high-risk deadlines.`, href: '#/team', cta: 'Review' });
    s.officers.forEach((o) => {
      horizonDays()
        .slice(1)
        .forEach((d) => {
          if (!o.availability?.[d]) return;
          const due = openTasksFor(s, o.id).filter((t) => datePart(t.due) === d);
          if (due.length) out.push({ icon: 'calendar', text: `${o.name} is away on ${fmtDay(d)} with ${due.length} task(s) due that day — bring forward or reassign.`, href: '#/simulator', cta: 'Simulate' });
        });
    });
    const t = WEEKLY_TREND;
    if (t.created.slice(-3).every((c, i) => c > t.completed.slice(-3)[i])) out.push({ icon: 'trend', text: 'Intake has exceeded completions for three weeks. Review contractor support or defer low-priority admin.' });
  } else {
    const me = getOfficer(s, s.currentOfficerId);
    const conflicts = horizonDays().flatMap((d) => meetingConflicts(s, me.id, d));
    if (conflicts.length) out.push({ icon: 'calendar', text: `Resolve ${conflicts.length} meeting clash(es) in Outlook so SyncAI can use that time.`, href: '#/planner', cta: 'Planner' });
    if (!s.plans[me.id]) out.push({ icon: 'sparkles', text: 'Generate and accept a plan so your time is protected in Outlook.', href: '#/planner', cta: 'Plan' });
  }
  return out;
}

const QUESTIONS = {
  officer: ['What should I work on first?', 'Can I finish everything today?', 'Plan tomorrow, prioritise inspections', 'Which deadlines are at risk?', 'How are my projects doing?', 'When am I free today?'],
  supervisor: ['Who is overloaded?', 'Who has spare capacity?', 'What happens if Ravi is on MC?', 'Which deadlines are at risk?', 'Which projects are at risk?'],
};

function renderPage(s) {
  const sup = isSupervisor(s);
  const brief = sup ? supervisorBriefing(s) : officerBriefing(s);
  const actions = correctiveActions(s);
  return html`
    <div class="page-head">
      <div><h1>AI Insights</h1><p>${sup ? 'Operational briefings, risks and trends across the team.' : 'Your briefings, deadline risks and effort patterns.'}</p></div>
      <div class="segmented" role="group" aria-label="Briefing period">
        <button data-action="ins-period" data-period="daily" aria-pressed="${view.period === 'daily'}">Daily</button>
        <button data-action="ins-period" data-period="weekly" aria-pressed="${view.period === 'weekly'}">Weekly</button>
      </div>
    </div>

    <div class="grid grid-main">
      <div class="stack">
        <section class="card ai-card" aria-labelledby="ib-h">
          <div class="card-head"><h2 id="ib-h"><span class="ai-label">${icon('sparkles', 16)}${view.period === 'daily' ? 'Daily' : 'Weekly'} operational briefing</span></h2><span class="badge badge-ai">Generated locally · deterministic</span></div>
          <div class="card-body"><p class="ai-headline">${brief.headline}</p>${bullets(brief.items)}</div>
        </section>

        <section class="card" aria-labelledby="ra-h">
          <div class="card-head"><h2 id="ra-h">Deadline risk alerts</h2>
            <div class="segmented" role="group" aria-label="Risk level">
              ${[['high', 'High'], ['medium', 'Medium'], ['all', 'All']].map(([v, l]) => html`<button data-action="ins-risk" data-level="${v}" aria-pressed="${view.riskFilter === v}">${l}</button>`)}
            </div>
          </div>
          <div class="card-body flush">${riskAlerts(s)}</div>
        </section>

        ${view.period === 'weekly' ? weeklyReflection(s) : ''}

        <section class="card" aria-labelledby="ea-h">
          <div class="card-head"><h2 id="ea-h">Estimated vs actual effort <span class="sub">completed tasks, by category</span></h2></div>
          <div class="card-body">${accuracyChart(s)}</div>
        </section>
      </div>

      <div class="stack">
        <section class="card" aria-labelledby="ca-h">
          <div class="card-head"><h2 id="ca-h">Suggested corrective actions</h2></div>
          <div class="card-body flush">
            ${actions.length
              ? html`<ul class="list">${actions.map((a) => html`<li class="list-item" style="align-items:flex-start"><span class="stat-icon ai">${icon(a.icon, 14)}</span><span class="grow">${a.text}</span>${a.href ? html`<a class="btn btn-sm" href="${a.href}">${a.cta}</a>` : ''}</li>`)}</ul>`
              : emptyState('check', 'Nothing to correct', 'Workload and estimates look healthy.')}
          </div>
        </section>

        ${sup
          ? html`<section class="card" aria-labelledby="tr-h">
              <div class="card-head"><h2 id="tr-h">Workload trend <span class="sub">sample history, last 6 weeks</span></h2></div>
              <div class="card-body">${trendChart()}</div>
            </section>`
          : html`<section class="card" aria-labelledby="tr-h">
              <div class="card-head"><h2 id="tr-h">Team-level trends</h2></div>
              <div class="card-body">${emptyState('lock', 'Visible to supervisors', 'Team utilisation and other officers’ workloads are restricted to supervisors.')}</div>
            </section>`}

        <section class="card ai-card" aria-labelledby="ask-h">
          <div class="card-head"><h2 id="ask-h"><span class="ai-label">${icon('message', 16)}Ask SyncAI</span></h2></div>
          <div class="card-body">
            <p class="muted small">The assistant answers supported questions using local prototype data only.</p>
            <div class="row wrap mt-sm">${QUESTIONS[sup ? 'supervisor' : 'officer'].map((q) => html`<button class="chip" data-action="ask" data-q="${q}">${q}</button>`)}</div>
          </div>
        </section>
      </div>
    </div>`;
}

export default {
  id: 'insights',
  title: 'AI Insights',
  icon: 'sparkles',
  roles: ['officer', 'supervisor'],
  render: renderPage,
  actions: {
    'ins-period': (el) => {
      view.period = el.dataset.period;
      ctx.rerender();
    },
    'ins-risk': (el) => {
      view.riskFilter = el.dataset.level;
      ctx.rerender();
    },
  },
};

export { QUESTIONS };
