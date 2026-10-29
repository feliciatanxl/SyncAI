import { explainScore, scoreTask } from '../ai.js';
import { analyseOfficer, assessRisk, meetingConflicts, schedule, smartReminders, teamAnalysis } from '../planner.js';
import { getOfficer, getTask, isOpen, isSupervisor, openTasksFor, officerName, update, absenceLabel } from '../state.js';
import { TODAY, NOW, datePart, fmtDue, fmtHours, fmtTime, fmtLongDay, relDay, timePart, toMin } from '../time.js';
import { html, icon, avatar, priorityBadge, riskBadge, capacityBadge, meter, pct, emptyState, sourceTag, toast } from '../ui.js';
import { ctx } from '../ctx.js';
import { recCard, scorePill, visibleRecs } from './shared.js';

const greeting = () => {
  const h = toMin(NOW.slice(11, 16)) / 60;
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

function stat(iconName, tone, label, value, foot) {
  return html`<div class="card stat">
    <div class="stat-label"><span class="stat-icon ${tone}">${icon(iconName, 16)}</span>${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-foot">${foot}</div>
  </div>`;
}

function briefingItem(s, key, tone, iconName, title, why, actions) {
  if (s.dismissed.includes(key)) return '';
  return html`<article class="rec">
    <div class="rec-head"><span class="icon-wrap ${tone}">${icon(iconName, 16)}</span><div class="rec-title">${title}</div></div>
    <p class="why">${icon('info', 14)}<span>${why}</span></p>
    <div class="rec-actions">${actions}<button class="btn btn-subtle btn-sm" data-action="dismiss" data-key="${key}">Dismiss</button></div>
  </article>`;
}

/** Today's agenda: meetings, lunch and planned (or suggested) task blocks. */
function agenda(s, officerId) {
  const plan = s.plans[officerId];
  const blocks = plan ? plan.blocks : schedule(s, officerId).blocks;
  const items = [
    ...blocks.filter((b) => b.date === TODAY).map((b) => ({ kind: 'task', start: b.start, end: b.end, b })),
    ...schedule(s, officerId).caps[0].meetings.map((m) => ({ kind: 'meeting', start: m.start, end: m.end, m })),
    { kind: 'lunch', start: s.settings.lunchStart, end: s.settings.lunchEnd },
  ].sort((a, b) => a.start.localeCompare(b.start));
  const conflicts = new Set(meetingConflicts(s, officerId, TODAY).flat().map((m) => m.id));

  return html`
    ${plan ? '' : html`<p class="notice notice-info small" style="margin:0 18px 8px">${icon('sparkles', 14)}<span>Task blocks below are SyncAI suggestions. Generate and accept a plan to confirm them.</span></p>`}
    <ul class="timeline">
      ${items.map((it) => {
        if (it.kind === 'lunch') return html`<li><time>${it.start}</time><div class="slot lunch"><strong>Lunch break</strong></div></li>`;
        if (it.kind === 'meeting')
          return html`<li><time>${it.start}</time><div class="slot meeting">
            <strong>${it.m.title}</strong>
            <div class="meta"><span>${fmtTime(it.start)}–${fmtTime(it.end)}</span><span>${it.m.location}</span>${sourceTag('Outlook')}${conflicts.has(it.m.id) ? html`<span class="badge badge-danger">${icon('alert', 12)}Clash</span>` : ''}</div>
          </div></li>`;
        const t = getTask(s, it.b.taskId);
        if (!t) return '';
        return html`<li><time>${it.start}</time><button class="slot task" style="text-align:left;width:100%;border-top:0;border-right:0;border-bottom:0;cursor:pointer" data-action="task-view" data-id="${t.id}">
          <strong>${t.title}${it.b.parts > 1 ? ` (part ${it.b.part}/${it.b.parts})` : ''}</strong>
          <div class="meta"><span>${fmtTime(it.start)}–${fmtTime(it.end)}</span>${priorityBadge(t.priority)}<span class="badge ${plan?.status === 'accepted' ? 'badge-success' : 'badge-ai'}">${plan?.status === 'accepted' ? 'Accepted' : plan ? 'Draft' : 'Suggested'}</span></div>
        </button></li>`;
      })}
    </ul>`;
}

function remindersCard(s, me) {
  const list = smartReminders(s, me);
  if (!list.length) return '';
  const set = new Set(s.reminders || []);
  return html`<section class="card" aria-labelledby="rem-h">
    <div class="card-head"><h2 id="rem-h"><span class="ai-label">${icon('bell', 16)}Smart reminders</span></h2><span class="muted small">Based on importance and prep time</span></div>
    <div class="card-body flush"><ul class="list">
      ${list.map((r) => {
        const t = getTask(s, r.taskId);
        const on = set.has(r.key);
        return html`<li class="list-item" style="align-items:flex-start">
          <span class="stat-icon ${on ? 'success' : 'ai'}">${icon(on ? 'check' : 'clock', 14)}</span>
          <div class="grow">
            <strong class="title">${relDay(r.at)}, ${fmtTime(timePart(r.at))} · ${t.title}</strong>
            <div class="meta"><span>Start by ${fmtTime(timePart(r.latest))} to finish on time</span><span>${r.why}</span></div>
          </div>
          <button class="btn btn-sm ${on ? 'btn-subtle' : ''}" data-action="reminder-toggle" data-key="${r.key}" aria-pressed="${on}">${on ? 'Set ✓' : 'Remind me'}</button>
        </li>`;
      })}
    </ul></div>
  </section>`;
}

function officerView(s) {
  const me = s.currentOfficerId;
  const officer = getOfficer(s, me);
  const a = analyseOfficer(s, me);
  const open = openTasksFor(s, me);
  const dueToday = open.filter((t) => datePart(t.due) <= TODAY);
  const loadToday = a.today.dueMin / 60;
  const freeToday = (a.today.workMin - a.today.meetingMin) / 60;
  const ranked = open.map((t) => ({ t, sc: scoreTask(s, t) })).sort((x, y) => y.sc.score - x.sc.score);
  const risks = open.map((t) => ({ t, r: assessRisk(s, t) }));
  const high = risks.filter((x) => x.r.level === 'high');
  const conflicts = meetingConflicts(s, me, TODAY);
  const plan = s.plans[me];
  const top = ranked[0]?.t;
  const blocked = open.filter((t) => t.dependsOn.some((d) => isOpen(getTask(s, d) || { status: 'done' })));

  let headline;
  if (a.today.unavailable) headline = 'You are marked unavailable today. Your supervisor can see which tasks need cover.';
  else if (!open.length) headline = 'You have no open tasks. Enjoy the breathing room, or pick up something from your backlog.';
  else if (loadToday <= freeToday && !high.length)
    headline = `Your ${dueToday.length} task${dueToday.length === 1 ? '' : 's'} due today (${fmtHours(loadToday)}) fit within your ${fmtHours(freeToday)} of free time. Start with “${top.title}”.`;
  else if (loadToday > freeToday)
    headline = `You have ${fmtHours(loadToday)} of work due today but only ${fmtHours(freeToday)} free after meetings. Some work may slip — SyncAI suggests focusing on “${top.title}” first.`;
  else headline = `Today's work fits, but ${high.length} deadline${high.length > 1 ? 's are' : ' is'} at risk. Start with “${top.title}”.`;

  const planLabel = plan ? (plan.status === 'accepted' ? 'Accepted' : 'Draft') : 'Not generated';

  return html`
    <div class="page-head">
      <div>
        <h1>${greeting()}, ${officer.name.split(' ')[0]}</h1>
        <p>${fmtLongDay(TODAY)} · Let's make your workday manageable.</p>
      </div>
      <div class="actions">
        <button class="btn" data-action="task-new">${icon('plus', 16)}Add task</button>
        <button class="btn btn-ai" data-action="go-generate">${icon('sparkles', 16)}Generate my plan</button>
      </div>
    </div>

    <div class="grid grid-4">
      ${stat('check-square', '', 'Open tasks', open.length, `${dueToday.length} due today`)}
      ${stat('clock', loadToday > freeToday ? 'danger' : 'success', "Today's workload", html`${fmtHours(loadToday)} <small>/ ${fmtHours(freeToday)} free</small>`, meter(freeToday ? loadToday / freeToday : 0, { label: "Today's workload vs free time" }))}
      ${stat('alert', high.length ? 'danger' : 'success', 'At-risk deadlines', high.length, high.length ? 'Need attention today' : 'All deadlines on track')}
      ${stat('calendar', plan?.status === 'accepted' ? 'success' : 'ai', 'Plan status', html`<span style="font-size:20px">${planLabel}</span>`, plan ? `Generated ${fmtTime(plan.generatedAt.slice(11, 16))}` : 'Generate to block time')}
    </div>

    <div class="grid grid-main mt">
      <div class="stack">
        <section class="card ai-card" aria-labelledby="brief-h">
          <div class="card-head"><h2 id="brief-h"><span class="ai-label">${icon('sparkles', 16)}Your AI Daily Briefing</span></h2><span class="badge badge-ai">Explainable</span></div>
          <div class="card-body">
            <p class="ai-headline">${headline}</p>
            ${top
              ? briefingItem(s, `brief:top:${top.id}`, '', 'zap', `Start with “${top.title}”`, explainScore(s, top), html`<button class="btn btn-primary btn-sm" data-action="task-view" data-id="${top.id}">View task</button>`)
              : ''}
            ${conflicts.map(([m1, m2]) =>
              briefingItem(s, `brief:clash:${m1.id}:${m2.id}`, 'danger', 'calendar', `Meeting clash at ${fmtTime(m2.start)}`, `“${m1.title}” (${fmtTime(m1.start)}–${fmtTime(m1.end)}) overlaps “${m2.title}”. Decline or reschedule one in Outlook — SyncAI will not plan work in this window.`, html`<button class="btn btn-sm" data-action="go" data-page="planner">Open planner</button>`),
            )}
            ${blocked.slice(0, 1).map((t) => {
              const dep = getTask(s, t.dependsOn[0]);
              return briefingItem(s, `brief:dep:${t.id}`, 'warning', 'link', `Finish “${dep.title}” first`, `It unblocks “${t.title}”, due ${fmtDue(t.due)}.`, html`<button class="btn btn-sm" data-action="task-view" data-id="${dep.id}">View task</button>`);
            })}
            ${high.slice(0, 2).map(({ t, r }) =>
              briefingItem(s, `brief:risk:${t.id}`, 'danger', 'alert', `“${t.title}” is at risk`, r.reasons[0], html`<button class="btn btn-sm" data-action="task-edit" data-id="${t.id}">Adjust task</button>`),
            )}
            ${!plan
              ? briefingItem(s, 'brief:plan', '', 'calendar', 'Block time for your tasks', `SyncAI can schedule ${open.length} tasks around ${a.today.meetingMin ? 'your Outlook meetings' : 'your day'}, lunch and ${s.settings.bufferMin}-minute buffers. You review it before anything is saved.`, html`<button class="btn btn-ai btn-sm" data-action="go-generate">${icon('sparkles', 14)}Generate my plan</button>`)
              : ''}
          </div>
        </section>

        <section class="card" aria-labelledby="prio-h">
          <div class="card-head"><h2 id="prio-h">Top priorities <span class="sub">ranked by SyncAI score</span></h2><a class="btn btn-subtle btn-sm" href="#/tasks">View all</a></div>
          <div class="card-body flush">
            ${ranked.length
              ? html`<ul class="list">
                  ${ranked.slice(0, 5).map(({ t }) => {
                    const r = assessRisk(s, t);
                    return html`<li class="list-item">
                      <button class="complete-btn" data-action="task-toggle" data-id="${t.id}" aria-label="Mark “${t.title}” complete">${icon('check', 12)}</button>
                      <div class="grow">
                        <button class="task-title title" data-action="task-view" data-id="${t.id}">${t.title}</button>
                        <div class="meta"><span>${icon('clock', 12)}${fmtDue(t.due)}</span><span>${fmtHours(t.effort)}</span>${t.location ? html`<span>${icon('pin', 12)}${t.location}</span>` : ''}</div>
                      </div>
                      <span class="hide-sm">${riskBadge(r.level)}</span>
                      ${scorePill(s, t)}
                    </li>`;
                  })}
                </ul>`
              : emptyState('check-square', 'No open tasks', 'Add a task or describe one in plain language on My Tasks.')}
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card" aria-labelledby="sched-h">
          <div class="card-head"><h2 id="sched-h">Today's schedule</h2><a class="btn btn-subtle btn-sm" href="#/planner">Open planner</a></div>
          <div class="card-body flush">${a.today.unavailable ? emptyState('calendar', 'Unavailable today', 'No schedule is planned while you are away.') : agenda(s, me)}</div>
        </section>
        ${remindersCard(s, me)}
        <section class="card" aria-labelledby="dl-h">
          <div class="card-head"><h2 id="dl-h">Upcoming deadlines</h2></div>
          <div class="card-body flush">
            <ul class="list">
              ${[...open]
                .sort((x, y) => x.due.localeCompare(y.due))
                .slice(0, 5)
                .map(
                  (t) => html`<li class="list-item">
                    <div class="grow"><button class="task-title title" data-action="task-view" data-id="${t.id}">${t.title}</button>
                    <div class="meta"><span>${fmtDue(t.due)}</span>${sourceTag(t.source)}</div></div>
                    ${priorityBadge(t.priority)}
                  </li>`,
                )}
            </ul>
          </div>
        </section>
      </div>
    </div>`;
}

function supervisorView(s) {
  const team = teamAnalysis(s);
  const recs = visibleRecs(s);
  const open = s.tasks.filter(isOpen);
  const risks = open.map((t) => ({ t, r: assessRisk(s, t) })).filter((x) => x.r.level === 'high').sort((a, b) => a.t.due.localeCompare(b.t.due));
  const avail = team.filter((a) => !a.today.unavailable);
  const avgUtil = avail.reduce((n, a) => n + a.today.util, 0) / (avail.length || 1);
  const over = team.filter((a) => a.status.id === 'over');
  const away = team.filter((a) => a.status.id === 'away');
  const spare = team.filter((a) => a.status.id === 'spare');

  const parts = [];
  if (over.length) parts.push(`${over.map((a) => a.officer.name.split(' ')[0]).join(' and ')} ${over.length > 1 ? 'are' : 'is'} overloaded`);
  if (away.length) parts.push(`${away.map((a) => a.officer.name.split(' ')[0]).join(', ')} ${away.length > 1 ? 'are' : 'is'} unavailable today`);
  const headline = `${parts.length ? parts.join(', and ') + '. ' : 'The team is balanced today. '}${risks.length} deadline${risks.length === 1 ? ' is' : 's are'} at high risk.${recs.length ? ` SyncAI has ${recs.length} reassignment suggestion${recs.length > 1 ? 's' : ''}${spare.length ? `, mainly towards ${spare.map((a) => a.officer.name.split(' ')[0]).join(' and ')} who ${spare.length > 1 ? 'have' : 'has'} spare capacity` : ''}.` : ''}`;

  return html`
    <div class="page-head">
      <div>
        <h1>${greeting()}, ${s.supervisor.name.split(' ')[0]}</h1>
        <p>${fmtLongDay(TODAY)} · Team overview for ${s.officers.length} officers.</p>
      </div>
      <div class="actions">
        <a class="btn" href="#/team">${icon('users', 16)}Team workload</a>
        <a class="btn btn-ai" href="#/simulator">${icon('flask', 16)}Run what-if</a>
      </div>
    </div>

    <div class="grid grid-4">
      ${stat('chart', avgUtil > 0.85 ? 'warning' : '', 'Team utilisation today', pct(avgUtil), meter(avgUtil, { label: 'Team utilisation today' }))}
      ${stat('alert', over.length ? 'danger' : 'success', 'Overloaded officers', over.length, over.length ? over.map((a) => a.officer.name).join(', ') : 'None today')}
      ${stat('clock', risks.length ? 'danger' : 'success', 'High-risk deadlines', risks.length, `${open.length} open tasks across team`)}
      ${stat('user', away.length ? 'warning' : 'success', 'Unavailable today', away.length, away.length ? away.map((a) => `${a.officer.name} (${absenceLabel(a.today.kind, true)})`).join(', ') : 'Full team available')}
    </div>

    <div class="grid grid-main mt">
      <div class="stack">
        <section class="card ai-card" aria-labelledby="tb-h">
          <div class="card-head"><h2 id="tb-h"><span class="ai-label">${icon('sparkles', 16)}AI Team Briefing</span></h2><span class="badge badge-ai">Needs your approval</span></div>
          <div class="card-body">
            <p class="ai-headline">${headline}</p>
            ${recs.length ? recs.slice(0, 3).map((r) => recCard(s, r)) : html`<p class="notice notice-success">${icon('check', 16)}No reassignments needed right now.</p>`}
            ${recs.length > 3 ? html`<a class="btn btn-subtle btn-sm mt-sm" href="#/team">View all ${recs.length} suggestions</a>` : ''}
          </div>
        </section>

        <section class="card" aria-labelledby="cap-h">
          <div class="card-head"><h2 id="cap-h">Team capacity today</h2><a class="btn btn-subtle btn-sm" href="#/team">Details</a></div>
          <div class="card-body flush">
            <ul class="list">
              ${team.map(
                (a) => html`<li class="list-item">
                  ${avatar(a.officer.name)}
                  <div class="grow"><strong class="title">${a.officer.name}</strong><div class="meta"><span>${a.officer.title}</span><span>${a.openCount} open</span>${a.atRisk.length ? html`<span class="delta-bad">${a.atRisk.length} at risk</span>` : ''}</div></div>
                  <div style="width:160px" class="hide-sm">${a.today.unavailable ? html`<span class="muted small">Away</span>` : meter(a.today.util, { label: `${a.officer.name} today` })}</div>
                  <span class="small hide-sm" style="width:42px;text-align:right">${a.today.unavailable ? '' : pct(a.today.util)}</span>
                  ${capacityBadge(a.status)}
                </li>`,
              )}
            </ul>
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="card" aria-labelledby="risk-h">
          <div class="card-head"><h2 id="risk-h">Deadlines at risk</h2><a class="btn btn-subtle btn-sm" href="#/insights">AI Insights</a></div>
          <div class="card-body flush">
            ${risks.length
              ? html`<ul class="list">${risks.slice(0, 6).map(
                  ({ t, r }) => html`<li class="list-item"><div class="grow">
                    <button class="task-title title" data-action="task-view" data-id="${t.id}">${t.title}</button>
                    <div class="meta"><span>${officerName(s, t.ownerId)}</span><span>${fmtDue(t.due)}</span></div>
                    <p class="why mt-sm">${icon('info', 12)}<span>${r.reasons[0]}</span></p>
                  </div></li>`,
                )}</ul>`
              : emptyState('check', 'All deadlines on track', 'SyncAI found no high-risk deadlines.')}
          </div>
        </section>
        <section class="card" aria-labelledby="act-h">
          <div class="card-head"><h2 id="act-h">Recent activity</h2></div>
          <div class="card-body flush">
            <ul class="activity">${s.activity.slice(0, 5).map((x) => html`<li><time>${fmtTime(x.at.slice(11, 16))}</time><span><strong>${x.actor}</strong> · ${x.text}</span></li>`)}</ul>
          </div>
        </section>
      </div>
    </div>`;
}

export default {
  id: 'dashboard',
  title: 'Dashboard',
  icon: 'dashboard',
  roles: ['officer', 'supervisor'],
  render: (s) => (isSupervisor(s) ? supervisorView(s) : officerView(s)),
  actions: {
    dismiss: (el) => update((st) => st.dismissed.push(el.dataset.key)),
    'reminder-toggle': (el) => {
      const key = el.dataset.key;
      let on = false;
      update((st) => {
        st.reminders ||= [];
        on = !st.reminders.includes(key);
        st.reminders = on ? [...st.reminders, key] : st.reminders.filter((k) => k !== key);
      });
      toast(on ? 'Reminder set — it would arrive in Microsoft Teams (simulated).' : 'Reminder removed', on ? 'success' : 'info');
    },
    'go-generate': () => {
      ctx.pending = 'generate-plan';
      ctx.navigate('planner');
    },
  },
};

