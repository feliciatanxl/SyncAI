// Proactive alerts that would be delivered through Microsoft Teams in
// production (Phase 2). Computed from the same data as every other page.

import { analyseOfficer, assessRisk, meetingConflicts, planSignature, smartReminders, teamAnalysis } from '../planner.js';
import { getState, getTask, isOpen, isSupervisor, openTasksFor, update, absenceLabel, getNotifications, markNotificationRead } from '../state.js';
import { TODAY, NOW, fmtHours, fmtTime, timePart, toMin, fmtDue } from '../time.js';
import { html, icon, render } from '../ui.js';
import { visibleRecs, openApprovalDetail } from './shared.js';

let channelFilter = 'all';

const TONE_ICON = { danger: 'alert', warning: 'clock', info: 'bell' };

export function computeAlerts(s) {
  const out = [];
  const add = (key, tone, title, body, href, extra = {}) => out.push({ key, tone, title, body, href, channel: extra.channel || 'in_app', channelLabel: extra.channelLabel || 'In-App', approvalId: extra.approvalId || null });

  // 1. Structured simulated notifications (WhatsApp, Teams, In-App)
  const notifs = getNotifications(s);
  for (const n of notifs) {
    add(
      `notif:${n.id}`,
      n.type === 'urgent_assignment' ? 'danger' : n.type === 'sla_warning' ? 'warning' : 'info',
      n.title,
      `${n.summary} [Channel: ${n.channelLabel}]`,
      n.approvalId ? `#/team` : n.secureLink ? n.secureLink.replace('syncai://', '#/') : '#/dashboard',
      { channel: n.channel, channelLabel: n.channelLabel, approvalId: n.approvalId },
    );
  }

  // Mandatory / statutory deadline alerts across open tasks
  const mand = (isSupervisor(s) ? s.tasks : openTasksFor(s, s.currentOfficerId))
    .filter((t) => t.statutory && isOpen(t));
  for (const t of mand) {
    const risk = assessRisk(s, t);
    if (risk.level === 'high') {
      add(`stat:high:${t.id}`, 'danger', `Statutory deadline at risk: ${t.title}`, `Mandatory compliance cut-off cannot slip. ${risk.reasons[0]}`, '#/planner');
    }
  }

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
  const allAlerts = computeAlerts(s);
  const alerts = channelFilter === 'all'
    ? allAlerts
    : allAlerts.filter((a) => a.channel === channelFilter);
  const read = new Set(s.alertsRead || []);

  render(
    document.getElementById('alerts'),
    html`<div class="assistant-head">
      <span class="stat-icon">${icon('bell', 16)}</span>
      <div style="flex:1"><h2>Alerts &amp; Notifications</h2><span class="muted small">Auditable multi-channel dispatch · simulated</span></div>
      <button class="btn btn-subtle btn-sm" data-action="alerts-read-all">Mark read</button>
      <button class="icon-btn" data-action="alerts-close" aria-label="Close alerts">${icon('x')}</button>
    </div>
    <div class="row" style="padding:8px 12px;gap:6px;border-bottom:1px solid var(--border);background:var(--surface-2)">
      <button class="btn btn-sm ${channelFilter === 'all' ? 'btn-primary' : 'btn-subtle'}" data-action="alerts-channel" data-ch="all">All (${allAlerts.length})</button>
      <button class="btn btn-sm ${channelFilter === 'whatsapp' ? 'btn-primary' : 'btn-subtle'}" data-action="alerts-channel" data-ch="whatsapp">WhatsApp</button>
      <button class="btn btn-sm ${channelFilter === 'teams' ? 'btn-primary' : 'btn-subtle'}" data-action="alerts-channel" data-ch="teams">Teams</button>
      <button class="btn btn-sm ${channelFilter === 'in_app' ? 'btn-primary' : 'btn-subtle'}" data-action="alerts-channel" data-ch="in_app">In-App</button>
    </div>
    <div class="notice notice-info small" style="margin:8px 12px">
      ${icon('info', 12)}<span><strong>Auditable Notification Adapter:</strong> Demonstrates proposed WhatsApp and Teams notifications with secure verification links. No Meta credentials or live external APIs are used. Ordinary WhatsApp group chats are not automatically captured by SyncAI.</span>
    </div>
    <ul class="alert-list">
      ${alerts.length
        ? alerts.map(
            (a) => html`<li class="alert-item ${read.has(a.key) ? '' : 'unread'}">
              <span class="stat-icon ${a.tone === 'info' ? 'ai' : a.tone}">${icon(TONE_ICON[a.tone], 14)}</span>
              <div class="grow" style="cursor:pointer" data-action="alert-open" data-key="${a.key}" data-href="${a.href}" data-approval="${a.approvalId || ''}">
                <div class="row" style="justify-content:space-between">
                  <strong>${a.title}</strong>
                  <span class="badge ${a.channel === 'whatsapp' ? 'badge-success' : a.channel === 'teams' ? 'badge-ai' : 'badge-neutral'}" style="font-size:10px">${a.channelLabel || a.channel}</span>
                </div>
                <span>${a.body}</span>
                ${a.approvalId ? html`<div class="mt-xs"><span class="badge badge-warning" style="font-size:10.5px">${icon('shield', 10)}Tap to view approval record (${a.approvalId})</span></div>` : ''}
              </div>
              ${read.has(a.key) ? '' : html`<span class="dot-unread" aria-label="Unread"></span>`}
            </li>`,
          )
        : html`<li class="alert-item"><span class="muted">No alerts in this channel.</span></li>`}
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
  'alerts-channel': (el) => {
    channelFilter = el.dataset.ch;
    renderPanel();
  },
  'alerts-read-all': () => markRead(computeAlerts(getState()).map((a) => a.key)),
  'alert-open': (el) => {
    const key = el.dataset.key;
    const approvalId = el.dataset.approval;
    const href = el.dataset.href;
    if (key) markRead([key]);
    closeAlerts();
    if (approvalId) {
      openApprovalDetail(approvalId);
    } else if (href) {
      location.hash = href;
    }
  },
};
