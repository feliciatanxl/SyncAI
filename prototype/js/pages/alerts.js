// Proactive alerts that would be delivered through Microsoft Teams in
// production (Phase 2). Computed from the same data as every other page.

import { analyseOfficer, assessRisk, meetingConflicts, planSignature, smartReminders, teamAnalysis } from '../planner.js';
import { getState, getTask, isOpen, isSupervisor, openTasksFor, update, absenceLabel } from '../state.js';
import { TODAY, NOW, fmtHours, fmtTime, timePart, toMin } from '../time.js';
import { html, icon, render } from '../ui.js';
import { visibleRecs } from './shared.js';

const TONE_ICON = { danger: 'alert', warning: 'clock', info: 'bell' };

export function computeAlerts(s) {
  const out = [];
  const add = (key, tone, title, body, href) => out.push({ key, tone, title, body, href });

  if (isSupervisor(s)) {
    const team = teamAnalysis(s);
    const recs = visibleRecs(s);
    const high = s.tasks.filter((t) => isOpen(t) && assessRisk(s, t).level === 'high');
    team
      .filter((a) => a.status.id === 'over')
      .forEach((a) => add(`over:${a.officer.id}`, 'danger', `${a.officer.name} is over capacity`, `${Math.round((a.today.util || 0) * 100)}% committed today, ${a.missing} task(s) can't be finished on time.`, '#/team'));
    team
      .filter((a) => a.status.id === 'away' && a.atRisk.length)
      .forEach((a) => add(`away:${a.officer.id}`, 'warning', `${a.officer.name} is away (${absenceLabel(a.today.kind, true)})`, `${a.atRisk.length} of their tasks need cover.`, '#/simulator'));
    if (recs.length) add(`recs:${recs.length}`, 'info', `${recs.length} reassignment${recs.length > 1 ? 's' : ''} awaiting approval`, 'SyncAI checked skills, availability and free time before each suggestion.', '#/team');
    s.activity
      .filter((a) => a.text.startsWith('Requested supervisor help'))
      .slice(0, 3)
      .forEach((a, i) => add(`help:${a.at}:${i}`, 'warning', `Help requested by ${a.actor}`, a.text.replace('Requested supervisor help with ', 'Needs help with '), '#/team'));
    add(`brief:${TODAY}:sup`, 'info', 'Daily team briefing', `${team.filter((a) => a.status.id === 'over').length} overloaded, ${team.filter((a) => a.status.id === 'away').length} away, ${high.length} high-risk deadlines.`, '#/insights');
    return out;
  }

  const me = s.currentOfficerId;
  const a = analyseOfficer(s, me);
  const open = openTasksFor(s, me);
  for (const t of open) {
    const r = assessRisk(s, t);
    const startBy = r.reasons.find((x) => x.includes('must start by'));
    if (r.level === 'high') add(`risk:${t.id}`, 'danger', `“${t.title}” is at risk`, r.reasons[0], '#/insights');
    else if (startBy) add(`start:${t.id}`, 'warning', `Start “${t.title}” soon`, startBy, '#/planner');
  }
  const load = a.today.dueMin / 60;
  const free = (a.today.workMin - a.today.meetingMin) / 60;
  if (!a.today.unavailable && load > free) add(`cap:${TODAY}`, 'danger', 'Today is over capacity', `${fmtHours(load)} of work due against ${fmtHours(free)} free. Consider moving or handing over lower-priority work.`, '#/planner');
  meetingConflicts(s, me, TODAY).forEach(([m1, m2]) => add(`clash:${m1.id}:${m2.id}`, 'warning', `Meeting clash at ${fmtTime(m2.start)}`, `“${m1.title}” overlaps “${m2.title}”.`, '#/planner'));
  const plan = s.plans[me];
  if (!plan) add(`plan:none:${TODAY}`, 'info', 'Your plan is ready to generate', `SyncAI can block time for ${open.length} tasks around today's meetings.`, '#/planner');
  else if (plan.signature !== planSignature(s, me)) add(`plan:stale:${plan.generatedAt}`, 'warning', 'Your plan is out of date', 'Tasks or meetings changed since it was generated.', '#/planner');
  else if (plan.status === 'draft') add(`plan:draft:${plan.generatedAt}`, 'info', 'Plan awaiting your approval', `${plan.blocks.length} time blocks proposed.`, '#/planner');
  smartReminders(s, me)
    .filter((r) => r.at.slice(0, 10) === TODAY && toMin(timePart(r.at)) - toMin(timePart(NOW)) <= 90)
    .forEach((r) => add(`rem:${r.taskId}`, 'info', `Reminder at ${fmtTime(timePart(r.at))}: ${getTask(s, r.taskId).title}`, `Latest start ${fmtTime(timePart(r.latest))} — ${r.why}.`, '#/dashboard'));
  add(`brief:${TODAY}:${me}`, 'info', 'Daily briefing', `${open.filter((t) => t.due.slice(0, 10) <= TODAY).length} tasks due today (${fmtHours(load)}) against ${fmtHours(free)} free.`, '#/dashboard');
  return out;
}

export function unreadCount(s) {
  const read = new Set(s.alertsRead || []);
  return computeAlerts(s).filter((a) => !read.has(a.key)).length;
}

function renderPanel() {
  const s = getState();
  const alerts = computeAlerts(s);
  const read = new Set(s.alertsRead || []);
  const teamsOn = !!s.integrations?.teams;
  render(
    document.getElementById('alerts'),
    html`<div class="assistant-head">
      <span class="stat-icon">${icon('bell', 16)}</span>
      <div style="flex:1"><h2>Alerts</h2><span class="muted small">${teamsOn ? 'Delivered via Microsoft Teams · simulated' : 'Teams delivery is off — in-app only'}</span></div>
      <button class="btn btn-subtle btn-sm" data-action="alerts-read-all">Mark all read</button>
      <button class="icon-btn" data-action="alerts-close" aria-label="Close alerts">${icon('x')}</button>
    </div>
    <ul class="alert-list">
      ${alerts.length
        ? alerts.map(
            (a) => html`<li class="alert-item ${read.has(a.key) ? '' : 'unread'}">
              <span class="stat-icon ${a.tone === 'info' ? 'ai' : a.tone}">${icon(TONE_ICON[a.tone], 14)}</span>
              <a href="${a.href}" data-action="alert-open" data-key="${a.key}" class="grow">
                <strong>${a.title}</strong><span>${a.body}</span>
              </a>
              ${read.has(a.key) ? '' : html`<span class="dot-unread" aria-label="Unread"></span>`}
            </li>`,
          )
        : html`<li class="alert-item"><span class="muted">You're all caught up.</span></li>`}
    </ul>`,
  );
}

export function openAlerts() {
  document.getElementById('alerts').hidden = false;
  renderPanel();
  document.querySelector('#alerts .alert-item a, #alerts button')?.focus();
}

export function closeAlerts() {
  const el = document.getElementById('alerts');
  if (el.hidden) return false;
  el.hidden = true;
  document.querySelector('[data-action="alerts-open"]')?.focus();
  return true;
}

export function refreshAlerts() {
  if (!document.getElementById('alerts').hidden) renderPanel();
}

const markRead = (keys) =>
  update((st) => {
    st.alertsRead = [...new Set([...(st.alertsRead || []), ...keys])].slice(-200);
  });

export const alertActions = {
  'alerts-open': () => (document.getElementById('alerts').hidden ? openAlerts() : closeAlerts()),
  'alerts-close': () => closeAlerts(),
  'alerts-read-all': () => markRead(computeAlerts(getState()).map((a) => a.key)),
  'alert-open': (el) => {
    markRead([el.dataset.key]);
    closeAlerts();
    location.hash = el.getAttribute('href');
  },
};
