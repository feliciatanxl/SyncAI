// "Ask SyncAI" — a simulated assistant that answers a fixed set of supported
// questions from local data. It never calls an external AI service.

import { effortAccuracy, explainScore, scoreTask } from '../ai.js';
import { analyseOfficer, assessRisk, dayCapacity, meetingConflicts, smartReminders, teamAnalysis } from '../planner.js';
import { ctx } from '../ctx.js';
import { getState, isOpen, isSupervisor, officerName, openTasksFor, absenceLabel } from '../state.js';
import { TODAY, fmtDue, fmtHours, fmtTime, fromMin, relDay, timePart } from '../time.js';
import { html, icon, render, pct } from '../ui.js';
import { visibleRecs } from './shared.js';
import { rankedProjects } from './projects.js';
import { QUESTIONS } from './insights.js';

const log = [];

const has = (q, ...words) => words.some((w) => q.includes(w));

function answer(s, raw) {
  const q = raw.toLowerCase();
  const sup = isSupervisor(s);
  const me = s.currentOfficerId;

  const named = s.officers.find((o) => q.includes(o.name.split(' ')[0].toLowerCase()));

  // Natural-language work planner: hand the request to the Smart Planner.
  if (/^(please\s+)?(plan|schedule|organi[sz]e)\b/.test(q)) {
    ctx.pending = { planText: raw };
    setTimeout(() => ctx.navigate('planner'), 0);
    return html`Opening the <a href="#/planner">Smart Planner</a> with a proposed schedule for “${raw}”. It stays a draft until you accept it.`;
  }

  if (has(q, 'remind')) {
    const list = smartReminders(s, sup && named ? named.id : me);
    if (!list.length) return html`No reminders needed — nothing is close to its latest start time.`;
    return html`Suggested reminders:<ul>${list.slice(0, 4).map((r) => html`<li>${relDay(r.at)} ${fmtTime(timePart(r.at))} — ${s.tasks.find((t) => t.id === r.taskId).title} (start by ${fmtTime(timePart(r.latest))}; ${r.why})</li>`)}</ul>Turn them on from the Dashboard.`;
  }

  if (has(q, 'urgent', 'emergency', 'incident', 'came in', 'comes in')) {
    return html`Use <strong>Urgent task arrived</strong> on the <a href="#/planner">Smart Planner</a>. SyncAI fits the new work in, keeps critical and same-day safety work in place, moves lower-priority tasks, and shows anything that becomes late before you approve.${sup ? ' For team-wide impact, use the <a href="#/simulator">What-If Simulator</a>.' : ''}`;
  }

  if (has(q, 'minutes', 'meeting notes', 'action item')) {
    return html`Open <a href="#/tasks">My Tasks</a> and choose <strong>From meeting minutes</strong>. Paste or upload the minutes, and SyncAI extracts action items with owners, deadlines and effort for you to review.`;
  }

  if (has(q, 'mc', 'sick', 'absent', 'leave', 'unavailable', 'away')) {
    if (!sup) return html`Absence planning is handled by supervisors. If you need to take leave, SyncAI will flag which of your tasks need cover once it is approved.`;
    const o = named || s.officers.find((x) => x.availability?.[TODAY]);
    if (!o) return html`Nobody is unavailable today. Use the <a href="#/simulator">What-If Simulator</a> to preview an absence.`;
    const open = openTasksFor(s, o.id).sort((a, b) => a.due.localeCompare(b.due));
    const due = open.filter((t) => t.due.slice(0, 10) <= TODAY || assessRisk(s, t).level === 'high');
    return html`${o.name} has ${open.length} open task${open.length === 1 ? '' : 's'}${o.availability?.[TODAY] ? ` and is currently on ${absenceLabel(o.availability[TODAY], true).toLowerCase()}` : ''}. If ${o.name.split(' ')[0]} is away today, these would be affected first:
      <ul>${(due.length ? due : open).slice(0, 4).map((t) => html`<li>${t.title} — due ${fmtDue(t.due)}</li>`)}</ul>
      Run the <a href="#/simulator">What-If Simulator</a> to see reassignment options before changing anything.`;
  }

  if (has(q, 'overload', 'spare', 'capacity', 'who has', 'busiest', 'free capacity', 'team')) {
    if (!sup) return html`Team workload is visible to supervisors only. I can tell you about <em>your</em> workload — try “Can I finish everything today?”`;
    const team = teamAnalysis(s);
    const wantSpare = has(q, 'spare', 'free', 'who has');
    const list = wantSpare ? team.filter((a) => a.status.id === 'spare' || a.status.id === 'ok') : team.filter((a) => a.status.id === 'over' || a.status.id === 'near');
    if (!list.length) return html`${wantSpare ? 'Nobody has meaningful spare capacity this week.' : 'Nobody is overloaded right now.'}`;
    return html`${wantSpare ? 'Officers with room this week:' : 'Officers under pressure:'}
      <ul>${list.map((a) => html`<li><strong>${a.officer.name}</strong> — ${a.status.label.toLowerCase()}, today ${pct(a.today.util)}, week ${pct(a.weekUtil)}${wantSpare ? `, ${fmtHours(a.freeHours)} free (${a.officer.skills.join(', ')})` : a.missing ? `, ${a.missing} task(s) can't be done on time` : ''}</li>`)}</ul>`;
  }

  if (has(q, 'reassign', 'redistribute', 'rebalance', 'move task')) {
    if (!sup) return html`Only supervisors can reassign work. Use “Ask supervisor” on a task in the Smart Planner to request help.`;
    const recs = visibleRecs(s);
    if (!recs.length) return html`No reassignments are needed right now.`;
    return html`I'd suggest:<ul>${recs.slice(0, 4).map((r) => html`<li>Move “${s.tasks.find((t) => t.id === r.taskId).title}” from ${officerName(s, r.fromId)} to <strong>${officerName(s, r.toId)}</strong> (${r.reasons.join(', ')})</li>`)}</ul>Approve them on <a href="#/team">Team Workload</a>.`;
  }

  if (has(q, 'project')) {
    const list = rankedProjects(s);
    if (!list.length) return html`You are not part of any projects yet.`;
    const label = { risk: 'at risk', attention: 'needs attention', 'on-track': 'on track', done: 'complete' };
    // Officers never see reasons that name other officers.
    const why = (h) => h.reasons.find((r) => sup || !r.personal)?.text || '';
    return html`${sup ? 'Projects' : 'Your projects'}, most urgent first:
      <ul>${list.map(({ p, h }) => html`<li><a href="#/projects/${p.id}"><strong>${p.name}</strong></a> — ${label[h.level]}, ${pct(h.progress)} done${h.level === 'risk' || h.level === 'attention' ? `. ${why(h)}` : ''}</li>`)}</ul>`;
  }

  if (has(q, 'risk', 'late', 'overdue', 'miss', 'deadline')) {
    const tasks = (sup ? s.tasks : s.tasks.filter((t) => t.ownerId === me)).filter(isOpen);
    const risky = tasks.map((t) => ({ t, r: assessRisk(s, t) })).filter((x) => x.r.level === 'high');
    if (!risky.length) return html`No deadlines are at high risk. 🎉`;
    return html`${risky.length} deadline${risky.length > 1 ? 's are' : ' is'} at high risk:
      <ul>${risky.slice(0, 5).map(({ t, r }) => html`<li><strong>${t.title}</strong>${sup ? ` (${officerName(s, t.ownerId)})` : ''} — ${r.reasons[0]}</li>`)}</ul>`;
  }

  if (has(q, 'first', 'priorit', 'focus', 'start', 'next', 'work on')) {
    const id = sup && named ? named.id : me;
    if (sup && !named) return html`Ask about a specific officer, e.g. “What should Marcus work on first?”`;
    const ranked = openTasksFor(s, id)
      .map((t) => ({ t, sc: scoreTask(s, t).score }))
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 3);
    if (!ranked.length) return html`There are no open tasks.`;
    return html`${sup ? `${officerName(s, id)}'s` : 'Your'} top priorities:
      <ol style="margin:6px 0 0;padding-left:18px">${ranked.map(({ t, sc }) => html`<li><strong>${t.title}</strong> (score ${sc}) — ${explainScore(s, t)}</li>`)}</ol>`;
  }

  if (has(q, 'free time', 'free today', 'when am i', 'gap', 'available time', 'my schedule', 'calendar')) {
    const id = sup && named ? named.id : me;
    const cap = dayCapacity(s, id, TODAY);
    if (cap.unavailable) return html`${officerName(s, id)} is unavailable today.`;
    const conflicts = meetingConflicts(s, id, TODAY);
    return html`Free windows today (after meetings, lunch and buffers):
      <ul>${cap.free.map((f) => html`<li>${fmtTime(fromMin(f.start))} – ${fmtTime(fromMin(f.end))} (${fmtHours((f.end - f.start) / 60)})</li>`)}</ul>
      ${conflicts.length ? html`⚠ ${conflicts.length} meeting clash${conflicts.length > 1 ? 'es' : ''} detected. ` : ''}Open the <a href="#/planner">Smart Planner</a> to block time.`;
  }

  if (has(q, 'finish', 'today', 'realistic', 'achievable', 'workload', 'can i')) {
    const id = sup && named ? named.id : me;
    if (sup && !named) return html`Ask about a specific officer, e.g. “Can Daniel finish everything today?” — or open <a href="#/team">Team Workload</a>.`;
    const a = analyseOfficer(s, id);
    if (a.today.unavailable) return html`${officerName(s, id)} is unavailable today.`;
    const load = a.today.dueMin / 60;
    const free = (a.today.workMin - a.today.meetingMin) / 60;
    const late = a.schedule.warnings.filter((w) => w.type === 'late').length + a.schedule.unscheduled.filter((u) => !u.beyondHorizon && s.tasks.find((t) => t.id === u.taskId)?.due.slice(0, 10) === TODAY).length;
    return load <= free && !late
      ? html`Yes — ${fmtHours(load)} of work is due today and you have ${fmtHours(free)} free after meetings, leaving about ${fmtHours(free - load)} of slack.`
      : html`Not comfortably. ${fmtHours(load)} of work is due today but there's only ${fmtHours(free)} free after meetings${late ? `, and ${late} task(s) would finish late` : ''}. Consider moving lower-priority work or asking for help.`;
  }

  if (has(q, 'estimate', 'how long', 'effort', 'accuracy', 'longer')) {
    const rows = effortAccuracy(s).sort((a, b) => b.ratio - a.ratio);
    return html`From completed tasks:<ul>${rows.slice(0, 4).map((r) => html`<li>${r.category}: actual ${r.ratio >= 1 ? `${Math.round((r.ratio - 1) * 100)}% longer` : `${Math.round((1 - r.ratio) * 100)}% shorter`} than estimated (${r.n} tasks)</li>`)}</ul>SyncAI applies these adjustments to new estimates.`;
  }

  return null;
}

function helpText(s) {
  const qs = QUESTIONS[isSupervisor(s) ? 'supervisor' : 'officer'];
  return html`I'm a simulated assistant that answers questions from SyncAI's local data. Try:<ul>${qs.map((q) => html`<li>${q}</li>`)}</ul>`;
}

function renderPanel() {
  const s = getState();
  const el = document.getElementById('assistant');
  const qs = QUESTIONS[isSupervisor(s) ? 'supervisor' : 'officer'];
  render(
    el,
    html`<div class="assistant-head">
      <span class="stat-icon ai">${icon('sparkles', 16)}</span>
      <div style="flex:1"><h2>Ask SyncAI</h2><span class="muted small">Simulated · answers from local data only</span></div>
      <button class="icon-btn" data-action="assistant-close" aria-label="Close assistant">${icon('x')}</button>
    </div>
    <div class="assistant-log" id="assistant-log" aria-live="polite">
      ${log.length ? '' : html`<div class="msg bot">${helpText(s)}</div>`}
      ${log.map((m) => html`<div class="msg ${m.who}">${m.body}${m.foot ? html`<div class="msg-foot">${m.foot}</div>` : ''}</div>`)}
    </div>
    <div class="assistant-chips">${qs.map((q) => html`<button class="chip" data-action="ask" data-q="${q}">${q}</button>`)}</div>
    <form class="assistant-form" data-submit="assistant-ask">
      <label class="sr-only" for="ask-input">Ask a question</label>
      <input class="input" id="ask-input" name="q" maxlength="200" autocomplete="off" placeholder="Ask about priorities, risks, workload…" />
      <button class="btn btn-ai" type="submit" aria-label="Send">${icon('send', 16)}</button>
    </form>`,
  );
  const logEl = document.getElementById('assistant-log');
  logEl.scrollTop = logEl.scrollHeight;
}

export function openAssistant(question) {
  const el = document.getElementById('assistant');
  el.hidden = false;
  renderPanel();
  if (question) ask(question);
  else document.getElementById('ask-input')?.focus();
}

export function closeAssistant() {
  const el = document.getElementById('assistant');
  if (el.hidden) return;
  el.hidden = true;
  document.querySelector('[data-action="assistant-open"]')?.focus();
}

export function refreshAssistant() {
  if (!document.getElementById('assistant').hidden) renderPanel();
}

function ask(question) {
  const q = question.trim();
  if (!q) return;
  log.push({ who: 'user', body: html`${q}` });
  log.push({ who: 'bot', body: html`<span class="typing" aria-label="SyncAI is thinking"><i></i><i></i><i></i></span>` });
  renderPanel();
  setTimeout(() => {
    const s = getState();
    const result = answer(s, q);
    log.pop();
    log.push(
      result
        ? { who: 'bot', body: result, foot: 'Based on current tasks, calendars and rules — not a live AI model.' }
        : { who: 'bot', body: html`I can't answer that in this prototype yet. ${helpText(s)}` },
    );
    if (log.length > 40) log.splice(0, log.length - 40);
    renderPanel();
    document.getElementById('ask-input')?.focus();
  }, 450);
}

export const assistantActions = {
  'assistant-open': () => openAssistant(),
  'assistant-close': () => closeAssistant(),
  ask: (el) => openAssistant(el.dataset.q),
};

export const assistantSubmits = {
  'assistant-ask': (form) => {
    const q = String(new FormData(form).get('q') || '');
    form.reset();
    ask(q);
  },
};
