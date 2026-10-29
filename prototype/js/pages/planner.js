import { parseDayPlanRequest, parseNaturalTask } from '../ai.js';
import { CATEGORIES } from '../data.js';
import {
  STRATEGIES,
  checkPlan,
  compareStrategies,
  dayCapacity,
  emergencyReschedule,
  generatePlan,
  meetingConflicts,
  planSignature,
  travelEstimate,
} from '../planner.js';
import { getOfficer, getState, getTask, isSupervisor, logActivity, nextId, officerName, openTasksFor, update, absenceLabel } from '../state.js';
import { TODAY, NOW, horizonDays, workDay, parseDate, dt, fmtDay, fmtDue, fmtTime, fmtHours, fmtLongDay, relDay, toMin, fromMin, timePart } from '../time.js';
import { html, icon, render, openModal, closeModal, toast, confirmDialog, priorityBadge } from '../ui.js';
import { ctx } from '../ctx.js';

const view = { officerId: null, mode: 'day', dayIdx: 0, loading: false, emergency: null };
const HOUR_PX = 64;
const weekdayName = (iso) => parseDate(iso).toLocaleDateString('en-SG', { weekday: 'long' });

function officerId(s) {
  if (!isSupervisor(s)) return s.currentOfficerId;
  if (!view.officerId || !getOfficer(s, view.officerId)) view.officerId = s.officers[0].id;
  return view.officerId;
}

function calendar(s, oid, days) {
  const plan = s.plans[oid];
  const st = s.settings;
  const startH = Math.floor(toMin(st.workStart) / 60);
  const endH = Math.ceil(toMin(st.workEnd) / 60);
  const top = (t) => ((toMin(t) - startH * 60) / 60) * HOUR_PX;
  const height = (a, b) => Math.max(((toMin(b) - toMin(a)) / 60) * HOUR_PX - 2, 18);
  const issues = plan ? checkPlan(s, oid, plan.blocks) : [];
  const flagged = new Set(issues.filter((i) => i.level === 'danger' && i.blockId).map((i) => i.blockId));
  const late = new Set((plan?.warnings || []).filter((w) => w.type === 'late' || w.type === 'overdue').map((w) => w.taskId));
  const officer = getOfficer(s, oid);
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  if (view.loading) {
    return html`<div class="loading-card" aria-busy="true" aria-label="Generating plan">
      <div class="row"><span class="ai-label">${icon('sparkles', 16)}SyncAI is analysing tasks, meetings and deadlines…</span></div>
      ${[80, 65, 90, 50, 70].map((w) => html`<div class="skeleton" style="width:${w}%"></div>`)}
    </div>`;
  }

  return html`<div class="cal" style="--days:${days.length};--hour:${HOUR_PX}px" role="grid" aria-label="Calendar">
    <div class="cal-corner"></div>
    ${days.map((d) => {
      const kind = officer.availability?.[d];
      return html`<div class="cal-head ${d === TODAY ? 'today' : ''}" role="columnheader">${d === TODAY ? 'Today · ' : ''}${fmtDay(d)}${kind ? html`<span class="badge badge-neutral">${absenceLabel(kind, isSupervisor(s))}</span>` : ''}</div>`;
    })}
    <div class="cal-hours" style="height:${(endH - startH) * HOUR_PX}px" aria-hidden="true">
      ${hours.map((h) => html`<span style="top:${(h - startH) * HOUR_PX}px">${String(h).padStart(2, '0')}:00</span>`)}
    </div>
    ${days.map((d) => {
      const cap = dayCapacity(s, oid, d);
      if (cap.unavailable) return html`<div class="cal-day away" style="height:${(endH - startH) * HOUR_PX}px"><span class="away-label">${absenceLabel(officer.availability[d], isSupervisor(s))}</span></div>`;
      const conflicts = meetingConflicts(s, oid, d);
      const conflictIds = new Set(conflicts.flat().map((m) => m.id));
      const secondIds = new Set(conflicts.map(([, b]) => b.id));
      const blocks = (plan?.blocks || []).filter((b) => b.date === d);
      return html`<div class="cal-day" style="height:${(endH - startH) * HOUR_PX}px" role="gridcell" aria-label="${fmtDay(d)}">
        <div class="offhours" style="top:0;height:${top(st.workStart)}px"></div>
        <div class="offhours" style="top:${top(st.workEnd)}px;bottom:0"></div>
        <div class="ev lunch" style="top:${top(st.lunchStart)}px;height:${height(st.lunchStart, st.lunchEnd)}px"><strong>Lunch</strong></div>
        ${cap.meetings.map(
          (m) => html`<div class="ev meeting ${conflictIds.has(m.id) ? `conflict half ${secondIds.has(m.id) ? 'second' : ''}` : ''}" style="top:${top(m.start)}px;height:${height(m.start, m.end)}px" title="${m.title} · ${m.start}–${m.end} · ${m.location}">
            <strong>${conflictIds.has(m.id) ? '⚠ ' : ''}${m.title}</strong><small>${fmtTime(m.start)}–${fmtTime(m.end)} · Outlook</small>
          </div>`,
        )}
        ${blocks.map((b) => {
          const t = getTask(s, b.taskId);
          if (!t) return '';
          const bad = flagged.has(b.id);
          return html`<button class="ev task ${plan.status} ${late.has(t.id) ? 'late' : ''} ${bad ? 'clash' : ''}" style="top:${top(b.start)}px;height:${height(b.start, b.end)}px" data-action="block-edit" data-block="${b.id}" aria-label="${t.title}, ${b.start} to ${b.end}, ${plan.status}${bad ? ', has a problem' : ''}. Edit time block">
            <strong>${b.manual ? '✎ ' : ''}${t.title}</strong><small>${fmtTime(b.start)}–${fmtTime(b.end)}${b.parts > 1 ? ` · part ${b.part}/${b.parts}` : ''} · ${t.priority}</small>
          </button>`;
        })}
      </div>`;
    })}
  </div>`;
}

function planBar(s, oid) {
  const plan = s.plans[oid];
  const whose = isSupervisor(s) ? `${officerName(s, oid)}'s` : 'your';
  if (!plan) {
    return html`<div class="plan-bar draft" role="status">
      ${icon('sparkles', 18)}
      <div style="flex:1;min-width:220px"><strong>No plan yet.</strong> <span class="muted">SyncAI will block time for ${whose} tasks around Outlook meetings, lunch and ${s.settings.bufferMin}-minute buffers. You review it before anything is saved.</span></div>
      <button class="btn btn-ai" data-action="plan-generate">${icon('sparkles', 16)}Generate ${isSupervisor(s) ? 'plan' : 'my plan'}</button>
    </div>`;
  }
  const label = plan.strategy === 'manual' ? 'Manual plan' : plan.strategy === 'emergency' ? 'Emergency re-plan' : `${STRATEGIES[plan.strategy]?.label || 'Balanced'} plan`;
  const note = html`<div class="small muted" style="margin-top:2px">${label}${plan.note ? ` · ${plan.note}` : ''}${plan.edited ? ' · edited by hand' : ''}</div>`;
  if (plan.signature !== planSignature(s, oid)) {
    return html`<div class="plan-bar stale" role="status">
      ${icon('alert', 18)}
      <div style="flex:1;min-width:220px"><strong>Plan out of date.</strong> <span>Tasks, meetings or availability changed after this plan was generated.</span>${note}</div>
      <button class="btn btn-ai" data-action="plan-generate">${icon('refresh', 16)}Regenerate</button>
      <button class="btn btn-subtle" data-action="plan-discard">Clear plan</button>
    </div>`;
  }
  if (plan.status === 'draft') {
    return html`<div class="plan-bar draft" role="status">
      ${icon('sparkles', 18)}
      <div style="flex:1;min-width:220px"><strong>Draft plan — review before accepting.</strong> <span class="muted">${plan.blocks.length} time blocks. Click any block to move or resize it. Nothing has been written to Outlook.</span>${note}</div>
      <button class="btn btn-primary" data-action="plan-accept">${icon('check', 16)}Accept plan</button>
      <button class="btn" data-action="plan-alternatives">Alternatives</button>
      <button class="btn btn-subtle" data-action="plan-discard">Discard</button>
    </div>`;
  }
  return html`<div class="plan-bar accepted" role="status">
    ${icon('check', 18)}
    <div style="flex:1;min-width:220px"><strong>Plan accepted.</strong> <span>${plan.blocks.length} blocks would be added to Outlook as tentative events (simulated).</span>${note}</div>
    <button class="btn" data-action="plan-generate">${icon('refresh', 16)}Regenerate</button>
    <button class="btn btn-subtle" data-action="plan-discard">Clear plan</button>
  </div>`;
}

function scheduleCheck(s, oid) {
  const plan = s.plans[oid];
  if (!plan) return '';
  const issues = checkPlan(s, oid, plan.blocks);
  const danger = issues.filter((i) => i.level === 'danger').length;
  return html`<section class="card" aria-labelledby="chk-h">
    <div class="card-head"><h2 id="chk-h">${icon(issues.length ? 'alert' : 'check', 16)}Schedule check</h2>
      ${issues.length ? html`<span class="badge ${danger ? 'badge-danger' : 'badge-warning'}">${issues.length} issue${issues.length > 1 ? 's' : ''}</span>` : html`<span class="badge badge-success">Realistic</span>`}</div>
    <div class="card-body stack" style="gap:8px">
      ${issues.length
        ? html`${issues.slice(0, 6).map((i) => html`<p class="notice notice-${i.level}">${icon(i.level === 'danger' ? 'alert' : 'info', 16)}<span class="grow">${i.message}</span>${i.blockId ? html`<button class="btn btn-sm" data-action="block-edit" data-block="${i.blockId}">Fix</button>` : ''}</p>`)}
            ${issues.length > 6 ? html`<p class="small muted">+ ${issues.length - 6} more</p>` : ''}
            <p class="small muted">SyncAI can suggest a realistic alternative that keeps your priorities in order.</p>
            <div class="row wrap"><button class="btn btn-ai btn-sm" data-action="plan-alternatives">${icon('sparkles', 14)}Suggest alternative schedules</button></div>`
        : html`<p class="small muted">Within working hours, no clashes, every task due this week is planned before its deadline and in priority order.</p>`}
    </div>
  </section>`;
}

function sidePanel(s, oid, days) {
  const plan = s.plans[oid];
  const caps = days.map((d) => dayCapacity(s, oid, d));
  const avail = caps.filter((c) => !c.unavailable);
  const workMin = avail.reduce((n, c) => n + c.workMin, 0);
  const meetMin = avail.reduce((n, c) => n + c.meetingMin, 0);
  const shownBlocks = (plan?.blocks || []).filter((b) => days.includes(b.date));
  const taskMin = shownBlocks.reduce((n, b) => n + toMin(b.end) - toMin(b.start), 0);
  const travel = plan ? travelEstimate(s, shownBlocks) : null;
  const conflicts = days.flatMap((d) => meetingConflicts(s, oid, d).map((c) => ({ d, c })));
  const unscheduled = plan?.unscheduled || [];

  return html`<div class="stack">
    <section class="card" aria-labelledby="sum-h">
      <div class="card-head"><h2 id="sum-h">${view.mode === 'day' ? fmtDay(days[0]) : 'This week'} at a glance</h2></div>
      <div class="card-body">
        <div class="kv"><span>Working time</span><b>${fmtHours(workMin / 60)}</b></div>
        <div class="kv"><span>Outlook meetings</span><b>${fmtHours(meetMin / 60)}</b></div>
        <div class="kv"><span>Planned task time</span><b>${plan ? fmtHours(taskMin / 60) : '—'}</b></div>
        <div class="kv"><span>Unallocated</span><b>${plan ? fmtHours(Math.max(0, workMin - meetMin - taskMin) / 60) : '—'}</b></div>
        <div class="kv"><span>Estimated site travel</span><b>${travel ? `${travel.minutes}m · ${travel.trips} trip${travel.trips === 1 ? '' : 's'}` : '—'}</b></div>
      </div>
    </section>

    ${scheduleCheck(s, oid)}

    ${conflicts.length
      ? html`<section class="card" aria-labelledby="conf-h">
          <div class="card-head"><h2 id="conf-h">${icon('calendar', 16)}Meeting clashes</h2></div>
          <div class="card-body stack" style="gap:8px">
            ${conflicts.map(({ d, c: [a, b] }) => html`<p class="notice notice-danger">${icon('calendar', 16)}<span class="grow"><strong>${fmtDay(d)}:</strong> “${a.title}” (${fmtTime(a.start)}–${fmtTime(a.end)}) overlaps “${b.title}” (${fmtTime(b.start)}–${fmtTime(b.end)}). SyncAI keeps this window free of tasks.</span></p>`)}
          </div>
        </section>`
      : ''}

    ${plan && unscheduled.length
      ? html`<section class="card" aria-labelledby="un-h">
          <div class="card-head"><h2 id="un-h">Couldn't fit <span class="sub">${unscheduled.length} task${unscheduled.length === 1 ? '' : 's'}</span></h2></div>
          <div class="card-body flush"><ul class="list">
            ${unscheduled.map((u) => {
              const t = getTask(s, u.taskId);
              if (!t) return '';
              return html`<li class="list-item" style="align-items:flex-start"><span class="stat-icon ${u.beyondHorizon ? 'warning' : 'danger'}">${icon('alert', 14)}</span><div class="grow">
                <button class="task-title title" data-action="task-view" data-id="${t.id}">${t.title}</button>
                <p class="why mt-sm">${u.reason}</p>
                <div class="row mt-sm wrap">
                  <button class="btn btn-sm" data-action="task-edit" data-id="${t.id}">Adjust deadline or effort</button>
                  ${isSupervisor(s) ? html`<a class="btn btn-sm btn-subtle" href="#/team">Reassign</a>` : html`<button class="btn btn-sm btn-subtle" data-action="ask-help" data-id="${t.id}">Ask supervisor</button>`}
                </div>
              </div></li>`;
            })}
          </ul></div>
        </section>`
      : ''}

    <section class="card" aria-labelledby="rules-h">
      <div class="card-head"><h2 id="rules-h">How SyncAI plans</h2></div>
      <div class="card-body small muted">
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
          <li>“Do now” work first, then by deadline and AI score; dependencies go before the tasks they unblock.</li>
          <li>Working hours ${s.settings.workStart}–${s.settings.workEnd}, lunch ${s.settings.lunchStart}–${s.settings.lunchEnd}, ${s.settings.bufferMin}-minute buffers, blocks of at least ${s.settings.minChunkMin} minutes.</li>
          <li>Never overlaps Outlook meetings, and flags work that would finish late.</li>
          <li>You can move any block; SyncAI re-checks the plan and suggests alternatives if it becomes unrealistic.</li>
        </ul>
      </div>
    </section>
  </div>`;
}

function nlPlanner() {
  const examples = [`Plan my ${weekdayName(workDay(3))}, prioritise lift inspections`, 'Plan tomorrow, focus on resident follow-ups', 'Plan today, start with the contractor report'];
  return html`<section class="card ai-card mt" aria-labelledby="nlp-h">
    <div class="card-body">
      <h2 id="nlp-h" class="ai-label" style="font-size:14px">${icon('wand', 16)}Natural-language work planner</h2>
      <form class="row wrap mt-sm" data-submit="plan-nl" novalidate>
        <label class="sr-only" for="plan-nl-text">Describe how to plan your day</label>
        <input class="input" id="plan-nl-text" name="text" style="flex:1;min-width:240px" maxlength="160" placeholder="e.g. Plan my Thursday, prioritise lift inspections" />
        <button class="btn btn-ai" type="submit">${icon('sparkles', 16)}Propose schedule</button>
      </form>
      <div class="row wrap mt-sm"><span class="muted small">Try:</span>${examples.map((e) => html`<button class="chip" data-action="plan-nl-example" data-text="${e}">${e}</button>`)}</div>
    </div>
  </section>`;
}

function renderPage(s) {
  const oid = officerId(s);
  const days = horizonDays();
  view.dayIdx = Math.min(Math.max(view.dayIdx, 0), days.length - 1);
  const shown = view.mode === 'day' ? [days[view.dayIdx]] : days;

  return html`
    <div class="page-head">
      <div><h1>Smart Planner</h1><p>${isSupervisor(s) ? `Viewing ${officerName(s, oid)}'s plan.` : 'AI time-blocking around your Outlook calendar. You review and confirm every change.'}</p></div>
      <div class="actions">
        ${isSupervisor(s)
          ? html`<label class="sr-only" for="plan-officer">Officer</label><select class="select" id="plan-officer" data-change="plan-officer" style="width:auto">${s.officers.map((o) => html`<option value="${o.id}" ${o.id === oid ? 'selected' : ''}>${o.name}</option>`)}</select>`
          : ''}
        <button class="btn" data-action="emergency-open">${icon('zap', 16)}Urgent task arrived</button>
        <button class="btn" data-action="block-new">${icon('plus', 16)}Add time block</button>
        <button class="btn hide-sm" data-action="appt-new">${icon('calendar', 16)}Add appointment</button>
        <button class="btn btn-ai" data-action="plan-generate">${icon('sparkles', 16)}${s.plans[oid] ? 'Regenerate' : 'Generate my plan'}</button>
      </div>
    </div>

    <div id="plan-bar">${planBar(s, oid)}</div>
    ${nlPlanner()}

    <div class="grid grid-main mt">
      <section class="card" aria-labelledby="cal-h">
        <div class="card-head">
          <h2 id="cal-h">${view.mode === 'day' ? fmtLongDay(shown[0]) : `${fmtDay(days[0])} – ${fmtDay(days[days.length - 1])}`}</h2>
          <div class="row">
            ${view.mode === 'day'
              ? html`<button class="icon-btn" data-action="day-prev" aria-label="Previous day" ${view.dayIdx === 0 ? 'disabled' : ''}>${icon('chevron-left')}</button>
                  <button class="btn btn-sm" data-action="day-today">Today</button>
                  <button class="icon-btn" data-action="day-next" aria-label="Next day" ${view.dayIdx === days.length - 1 ? 'disabled' : ''}>${icon('chevron-right')}</button>`
              : ''}
            <div class="segmented" role="group" aria-label="Calendar view">
              <button data-action="cal-mode" data-mode="day" aria-pressed="${view.mode === 'day'}">Day</button>
              <button data-action="cal-mode" data-mode="week" aria-pressed="${view.mode === 'week'}">Week</button>
            </div>
          </div>
        </div>
        <div class="card-body" style="padding-bottom:10px">
          <div class="legend"><span><i class="l-meeting"></i>Outlook meeting</span><span><i class="l-draft"></i>Draft AI block</span><span><i class="l-accepted"></i>Accepted block</span><span><i class="l-conflict"></i>Conflict / problem</span><span><i class="l-lunch"></i>Lunch</span><span>✎ Edited by hand</span></div>
        </div>
        <div id="cal-wrap">${calendar(s, oid, shown)}</div>
      </section>
      ${sidePanel(s, oid, shown)}
    </div>`;
}

// ---------- generate ----------

function generate(opts = {}, after) {
  const s = getState();
  const oid = officerId(s);
  view.loading = true;
  const wrap = document.getElementById('cal-wrap');
  if (wrap) render(wrap, calendar(s, oid, []));
  document.getElementById('page').setAttribute('aria-busy', 'true');
  setTimeout(() => {
    view.loading = false;
    document.getElementById('page').setAttribute('aria-busy', 'false');
    let plan = null;
    update((st) => {
      st.plans[oid] = generatePlan(st, oid, opts);
      plan = st.plans[oid];
      logActivity(st, `Generated a ${STRATEGIES[plan.strategy]?.label.toLowerCase() || ''} draft plan for ${officerName(st, oid)} (${plan.blocks.length} blocks)${opts.note ? `: ${opts.note}` : ''}.`, 'SyncAI');
    });
    if (after) return after(plan);
    const n = plan.unscheduled.filter((u) => !u.beyondHorizon).length;
    toast(n ? `Draft plan ready — ${n} task${n > 1 ? 's' : ''} could not fit before the deadline` : 'Draft plan ready — review and accept it', n ? 'info' : 'success');
  }, 700);
}

function planFromText(text) {
  const req = parseDayPlanRequest(text);
  if (!req) return toast('Start with “Plan…”, e.g. “Plan my Thursday, prioritise lift inspections”.', 'error');
  const days = horizonDays();
  const idx = days.indexOf(req.date);
  if (idx < 0) return toast('SyncAI can plan the next five working days only.', 'error');
  const s = getState();
  const oid = officerId(s);
  const label = req.date === TODAY ? 'today' : weekdayName(req.date);
  const note = req.terms.length ? `${label}, prioritising “${req.phrase}”` : `focused on ${label}`;
  const boost = req.terms.length ? { terms: req.terms, date: req.date } : undefined;
  view.mode = 'day';
  view.dayIdx = idx;
  generate({ boost, note }, (plan) => {
    const st = getState();
    const words = (t) => `${t.title} ${t.category}`.toLowerCase();
    const matched = openTasksFor(st, oid).filter((t) => req.terms.some((w) => w.every((x) => words(t).includes(x))));
    const onDay = matched.filter((t) => plan.blocks.some((b) => b.taskId === t.id && b.date === req.date));
    const earlier = matched.filter((t) => t.due.slice(0, 10) < req.date);
    let msg = `Proposed ${label === 'today' ? "today's" : `${label}'s`} schedule`;
    if (req.terms.length) msg += matched.length ? ` with ${onDay.length} matching task${onDay.length === 1 ? '' : 's'} first` : ` — no open tasks match “${req.phrase}”`;
    if (earlier.length) msg += `. ${earlier.length} due before ${label} stay${earlier.length === 1 ? 's' : ''} earlier so ${earlier.length === 1 ? 'it isn’t' : 'they aren’t'} late`;
    toast(`${msg}. Review, then accept.`, 'info');
  });
}

// ---------- manual editing ----------

function blockForm({ title, block, tasks, days }) {
  return html`<form data-submit="block-save" novalidate>
    <header class="modal-head"><h2 id="modal-title">${title}</h2>
      <button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body">
      <input type="hidden" name="blockId" value="${block?.id || ''}" />
      <div class="form-grid">
        ${tasks
          ? html`<div class="field full"><label for="b-task">Task</label><select class="select" id="b-task" name="taskId">${tasks.map((t) => html`<option value="${t.id}">${t.title} · due ${fmtDue(t.due)}</option>`)}</select></div>`
          : html`<input type="hidden" name="taskId" value="${block.taskId}" />`}
        <div class="field full"><label for="b-date">Date</label><select class="select" id="b-date" name="date">${days.map((d) => html`<option value="${d}" ${d === (block?.date || days[view.dayIdx]) ? 'selected' : ''}>${relDay(d)} · ${fmtDay(d)}</option>`)}</select></div>
        <div class="field" data-field="start"><label for="b-start">Start</label><input class="input" type="time" step="300" id="b-start" name="start" value="${block?.start || '14:00'}" required autofocus /><span class="error-text" id="e-start"></span></div>
        <div class="field" data-field="end"><label for="b-end">End</label><input class="input" type="time" step="300" id="b-end" name="end" value="${block?.end || '15:00'}" required /><span class="error-text" id="e-end"></span></div>
      </div>
      <p class="small muted mt-sm">SyncAI re-checks the whole plan after your change and flags anything unrealistic, such as work outside working hours, clashes, overbooked days, missed deadlines or priority order.</p>
    </div>
    <footer class="modal-foot">
      ${block ? html`<button type="button" class="btn btn-subtle" data-action="block-remove" data-block="${block.id}">${icon('trash', 16)}Remove block</button><button type="button" class="btn btn-subtle" data-action="task-view" data-id="${block.taskId}">View task</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-action="modal-close">Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button>
    </footer>
  </form>`;
}

function saveBlock(form) {
  const fd = new FormData(form);
  const start = String(fd.get('start') || '');
  const end = String(fd.get('end') || '');
  const date = String(fd.get('date'));
  const taskId = String(fd.get('taskId'));
  const blockId = String(fd.get('blockId') || '');
  const err = (f, m) => {
    form.querySelector(`[data-field="${f}"]`)?.classList.toggle('invalid', !!m);
    form.querySelector(`#e-${f}`).textContent = m;
  };
  const ok = (t) => /^\d{2}:\d{2}$/.test(t);
  err('start', ok(start) ? '' : 'Enter a start time.');
  err('end', !ok(end) ? 'Enter an end time.' : end <= start ? 'End must be after start.' : toMin(end) - toMin(start) < 15 ? 'Blocks must be at least 15 minutes.' : '');
  if (form.querySelector('.invalid')) return;
  const s = getState();
  const oid = officerId(s);
  if (!horizonDays().includes(date) || !getTask(s, taskId)) return toast('Choose a valid task and date.', 'error');

  let issues = [];
  update((st) => {
    let plan = st.plans[oid];
    if (!plan) {
      plan = st.plans[oid] = { status: 'draft', generatedAt: NOW, signature: planSignature(st, oid), strategy: 'manual', note: null, blocks: [], unscheduled: [], warnings: [] };
    }
    const fields = { taskId, date, start: fromMin(toMin(start)), end: fromMin(toMin(end)), manual: true, part: 1, parts: 1 };
    const existing = plan.blocks.find((b) => b.id === blockId);
    if (existing) Object.assign(existing, fields);
    else plan.blocks.push({ id: nextId(st, 'blk'), ...fields });
    plan.blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    plan.edited = true;
    if (plan.status === 'accepted') plan.status = 'draft';
    issues = checkPlan(st, oid, plan.blocks);
    logActivity(st, `${existing ? 'Moved' : 'Added'} a time block for “${getTask(st, taskId).title}” (${fmtDay(date)} ${fields.start}–${fields.end}).`);
  });
  closeModal();
  const danger = issues.filter((i) => i.level === 'danger').length;
  toast(issues.length ? `Saved. Schedule check found ${issues.length} issue${issues.length > 1 ? 's' : ''}${danger ? ` (${danger} serious)` : ''} — see the side panel.` : 'Saved. The plan is still realistic — accept it when ready.', issues.length ? 'info' : 'success');
}

// ---------- alternatives ----------

function openAlternatives() {
  const s = getState();
  const oid = officerId(s);
  const options = compareStrategies(s, oid);
  const plan = s.plans[oid];
  const current = plan ? checkPlan(s, oid, plan.blocks) : null;
  const best = Math.min(...options.map((o) => o.late));
  openModal(
    html`<header class="modal-head"><h2 id="modal-title">Alternative schedules</h2>
      <button class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body stack">
      <p class="muted">SyncAI generated three realistic options from the same tasks and calendar. Pick one to load it as a draft — you can still edit it before accepting.</p>
      ${current ? html`<p class="notice ${current.length ? 'notice-warning' : 'notice-success'}">${icon('info', 16)}<span class="grow">Current plan: ${current.length ? `${current.length} issue${current.length > 1 ? 's' : ''} found by the schedule check.` : 'no issues found.'}</span></p>` : ''}
      <div class="grid grid-3">
        ${options.map(
          (o) => html`<div class="compare-col ${o.id === 'balanced' ? 'after' : ''}">
            <h4>${o.label}${o.id === 'balanced' ? ' · recommended' : ''}</h4>
            <p class="small muted" style="min-height:48px">${o.desc}</p>
            <div class="kv"><span>Tasks planned</span><b>${o.scheduled}</b></div>
            <div class="kv"><span>Late or won't fit</span><b class="${o.late > best ? 'delta-bad' : 'delta-good'}">${o.late}</b></div>
            <div class="kv"><span>Site travel</span><b>${o.travel.minutes}m</b></div>
            <div class="kv"><span>Site trips</span><b>${o.travel.trips}</b></div>
            <button class="btn ${o.id === 'balanced' ? 'btn-primary' : ''} btn-sm mt-sm" style="width:100%" data-action="plan-use" data-strategy="${o.id}">Use this plan</button>
          </div>`,
        )}
      </div>
      <p class="small muted">Travel is estimated from block numbers: 15 minutes to a new area, 5 minutes within an area. “Fewer site trips” is the field visit optimiser — it may trade a little deadline slack for less travel.</p>
    </div>`,
    { wide: true },
  );
}

// ---------- emergency rescheduling ----------

function emergencyForm(prefill = {}) {
  const f = { title: '', effort: 1.5, dueTime: fromMin(Math.min(toMin('17:00'), toMin(timePart(NOW)) + 240)), location: '', category: 'Maintenance', safety: true, ...prefill };
  return html`<form data-submit="emergency-preview" novalidate>
    <header class="modal-head"><h2 id="modal-title">${icon('zap', 18)} Urgent task arrived</h2>
      <button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body stack">
      <p class="muted">SyncAI fits the urgent work in, protects critical and same-day safety work, and moves lower-priority tasks. You see the impact before anything changes.</p>
      <div class="row wrap">
        <label class="sr-only" for="em-desc">Describe the urgent task</label>
        <input class="input" id="em-desc" name="desc" style="flex:1;min-width:220px" placeholder="e.g. Water leak from ceiling at Blk 210 lift lobby, about 1.5h" />
        <button type="button" class="btn btn-sm" data-action="emergency-parse">${icon('sparkles', 14)}Fill from description</button>
      </div>
      <div class="form-grid">
        <div class="field full" data-field="title"><label for="em-title">Title <span class="req">*</span></label><input class="input" id="em-title" name="title" value="${f.title}" maxlength="120" required autofocus /><span class="error-text" id="e-title"></span></div>
        <div class="field"><label for="em-cat">Category</label><select class="select" id="em-cat" name="category">${CATEGORIES.map((c) => html`<option ${c === f.category ? 'selected' : ''}>${c}</option>`)}</select></div>
        <div class="field" data-field="effort"><label for="em-effort">Effort (hours)</label><input class="input" type="number" min="0.25" max="8" step="0.25" id="em-effort" name="effort" value="${f.effort}" /><span class="error-text" id="e-effort"></span></div>
        <div class="field" data-field="dueTime"><label for="em-due">Must be done today by</label><input class="input" type="time" step="900" id="em-due" name="dueTime" value="${f.dueTime}" /><span class="error-text" id="e-dueTime"></span></div>
        <div class="field"><label for="em-loc">Location</label><input class="input" id="em-loc" name="location" value="${f.location}" maxlength="60" placeholder="Blk 210" /></div>
        <label class="check full"><input type="checkbox" name="safety" ${f.safety ? 'checked' : ''} /> Safety-related (residents could be at risk)</label>
      </div>
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">Cancel</button><button class="btn btn-ai" type="submit">${icon('sparkles', 16)}Preview new schedule</button></footer>
  </form>`;
}

function emergencyPreview(s, r) {
  const em = r.after.blocks.filter((b) => b.taskId === r.task.id);
  const lateTasks = r.newlyLate.map((id) => getTask(r.sim, id)).filter(Boolean);
  return html`<header class="modal-head"><h2 id="modal-title">${icon('zap', 18)} Emergency re-plan preview</h2>
      <button class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body stack">
      <p class="notice ${em.length ? 'notice-info' : 'notice-danger'}">${icon('zap', 16)}<span class="grow"><strong>${r.task.title}</strong> — ${em.length ? `scheduled ${em.map((b) => `${relDay(b.date)} ${fmtTime(b.start)}–${fmtTime(b.end)}`).join(', ')}` : 'could not be fitted before the deadline. Ask your supervisor for help immediately.'}</span></p>
      ${r.protectedIds.length ? html`<div><h3>${icon('shield', 14)} Protected (kept in place)</h3><ul class="reasons">${r.protectedIds.map((id) => html`<li><span>${getTask(r.sim, id).title}</span>${priorityBadge(getTask(r.sim, id).priority)}</li>`)}</ul></div>` : ''}
      <div><h3>Moved to make room</h3>
        ${r.moved.length
          ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Task</th><th>Was</th><th>Now</th></tr></thead><tbody>${r.moved.map((m) => html`<tr><td>${m.title}</td><td>${m.from}</td><td class="${m.dropped || r.newlyLate.includes(m.taskId) ? 'delta-bad' : ''}"><strong>${m.to}</strong></td></tr>`)}</tbody></table></div>`
          : html`<p class="muted small">No other work needs to move.</p>`}
      </div>
      ${lateTasks.length
        ? html`<p class="notice notice-warning">${icon('alert', 16)}<span class="grow"><strong>Now at risk:</strong> ${lateTasks.map((t) => `“${t.title}” (due ${fmtDue(t.due)})`).join(', ')}. Approving will also ask your supervisor in Teams to consider reassigning ${lateTasks.length > 1 ? 'them' : 'it'} (simulated).</span></p>`
        : html`<p class="notice notice-success">${icon('check', 16)}<span class="grow">All other deadlines are still met.</span></p>`}
    </div>
    <footer class="modal-foot"><button class="btn" data-action="emergency-back">Back</button><button class="btn btn-primary" data-action="emergency-approve">${icon('check', 16)}Approve new schedule</button></footer>`;
}

function runEmergency(form) {
  const fd = new FormData(form);
  const title = String(fd.get('title') || '').trim();
  const effort = Number(fd.get('effort'));
  const dueTime = String(fd.get('dueTime') || '');
  const err = (f, m) => {
    form.querySelector(`[data-field="${f}"]`)?.classList.toggle('invalid', !!m);
    form.querySelector(`#e-${f}`).textContent = m;
  };
  err('title', title.length < 3 ? 'Describe the urgent task.' : '');
  err('effort', effort >= 0.25 && effort <= 8 ? '' : 'Between 0.25 and 8 hours.');
  err('dueTime', /^\d{2}:\d{2}$/.test(dueTime) && dueTime > timePart(NOW) ? '' : `Choose a time after ${fmtTime(timePart(NOW))}.`);
  if (form.querySelector('.invalid')) return;
  const s = getState();
  const fields = {
    title,
    category: String(fd.get('category')),
    priority: 'Critical',
    due: dt(TODAY, dueTime),
    effort,
    location: String(fd.get('location') || '').trim(),
    safety: fd.get('safety') === 'on',
  };
  view.emergency = { fields, result: emergencyReschedule(s, officerId(s), fields) };
  openModal(emergencyPreview(s, view.emergency.result), { wide: true });
}

// ---------- appointments ----------

function openAppointment() {
  const s = getState();
  const days = horizonDays();
  openModal(html`<form data-submit="appt-save" novalidate>
    <header class="modal-head"><h2 id="modal-title">Add Outlook appointment (simulated)</h2>
      <button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body">
      <p class="muted small" style="margin-bottom:12px">Use this to see how SyncAI detects clashes with an existing plan. In production this would come from Outlook via Microsoft Graph.</p>
      <div class="form-grid">
        <div class="field full" data-field="title"><label for="a-title">Title <span class="req">*</span></label><input class="input" id="a-title" name="title" maxlength="80" required autofocus /><span class="error-text" id="e-title"></span></div>
        <div class="field"><label for="a-date">Date</label><select class="select" id="a-date" name="date">${days.map((d) => html`<option value="${d}" ${d === days[view.dayIdx] ? 'selected' : ''}>${fmtDay(d)}</option>`)}</select></div>
        <div class="field"><label for="a-loc">Location</label><input class="input" id="a-loc" name="location" maxlength="60" placeholder="Microsoft Teams" /></div>
        <div class="field" data-field="start"><label for="a-start">Start</label><input class="input" type="time" id="a-start" name="start" value="11:00" step="900" required /><span class="error-text" id="e-start"></span></div>
        <div class="field" data-field="end"><label for="a-end">End</label><input class="input" type="time" id="a-end" name="end" value="12:00" step="900" required /><span class="error-text" id="e-end"></span></div>
      </div>
      ${isSupervisor(s) ? html`<p class="muted small mt-sm">Added to ${officerName(s, officerId(s))}'s calendar.</p>` : ''}
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">Cancel</button><button class="btn btn-primary" type="submit">Add appointment</button></footer>
  </form>`);
}

function saveAppointment(form) {
  const fd = new FormData(form);
  const title = String(fd.get('title') || '').trim();
  const start = String(fd.get('start') || '');
  const end = String(fd.get('end') || '');
  const date = String(fd.get('date'));
  const err = (f, m) => {
    form.querySelector(`[data-field="${f}"]`)?.classList.toggle('invalid', !!m);
    const e = form.querySelector(`#e-${f}`);
    if (e) e.textContent = m;
  };
  err('title', title.length < 2 ? 'Enter a title.' : '');
  const validTime = (t) => /^\d{2}:\d{2}$/.test(t);
  err('start', !validTime(start) || start < '07:00' ? 'Start between 07:00 and 20:00.' : '');
  err('end', !validTime(end) || end <= start || end > '20:00' ? 'End must be after start (by 20:00).' : '');
  if (form.querySelector('.invalid')) return;
  if (!horizonDays().includes(date)) return toast('Choose a date in this week.', 'error');

  const s = getState();
  const oid = officerId(s);
  update((st) => {
    st.meetings.push({ id: nextId(st, 'm'), title, date, start: fromMin(toMin(start)), end: fromMin(toMin(end)), ownerIds: [oid], location: String(fd.get('location') || '').trim() || 'Microsoft Teams', source: 'Outlook' });
    logActivity(st, `Added appointment “${title}” on ${fmtDay(date)} (simulated Outlook).`);
  });
  closeModal();
  const plan = getState().plans[oid];
  const clashes = plan ? checkPlan(getState(), oid, plan.blocks).filter((i) => i.message.includes(`“${title}”`)).length : 0;
  toast(clashes ? `Appointment added — ${clashes} planned block${clashes > 1 ? 's' : ''} now clash. Regenerate or move them.` : 'Appointment added', clashes ? 'info' : 'success');
}

export default {
  id: 'planner',
  title: 'Smart Planner',
  icon: 'calendar',
  roles: ['officer', 'supervisor'],
  render: renderPage,
  mount: () => {
    if (ctx.pending === 'generate-plan') {
      ctx.pending = null;
      generate();
    } else if (ctx.pending?.planText) {
      const text = ctx.pending.planText;
      ctx.pending = null;
      planFromText(text);
    }
  },
  actions: {
    'plan-generate': () => generate(),
    'plan-accept': () => {
      const oid = officerId(getState());
      const issues = checkPlan(getState(), oid, getState().plans[oid].blocks).filter((i) => i.level === 'danger');
      update((st) => {
        st.plans[oid].status = 'accepted';
        logActivity(st, `Accepted plan for ${officerName(st, oid)} — ${st.plans[oid].blocks.length} blocks marked for Outlook (simulated)${issues.length ? ` despite ${issues.length} flagged issue(s)` : ''}.`);
      });
      toast(issues.length ? `Plan accepted with ${issues.length} unresolved issue${issues.length > 1 ? 's' : ''} noted in the log.` : 'Plan accepted. Blocks would be added to Outlook as tentative events (simulated).', issues.length ? 'info' : 'success');
    },
    'plan-discard': async () => {
      const ok = await confirmDialog({ title: 'Remove this plan?', body: 'Your tasks are not affected. You can generate a new plan at any time.', confirmLabel: 'Remove plan' });
      if (!ok) return;
      const oid = officerId(getState());
      update((st) => {
        delete st.plans[oid];
        logActivity(st, `Cleared plan for ${officerName(st, oid)}.`);
      });
      toast('Plan removed', 'info');
    },
    'plan-alternatives': () => openAlternatives(),
    'plan-use': (el) => {
      closeModal();
      generate({ strategy: el.dataset.strategy });
    },
    'plan-nl-example': (el) => {
      const input = document.getElementById('plan-nl-text');
      if (input) input.value = el.dataset.text;
      planFromText(el.dataset.text);
    },
    'block-edit': (el) => {
      const s = getState();
      const plan = s.plans[officerId(s)];
      const block = plan?.blocks.find((b) => b.id === el.dataset.block);
      if (!block) return;
      const t = getTask(s, block.taskId);
      openModal(blockForm({ title: `Edit block · ${t?.title || 'Task'}`, block, days: horizonDays() }));
    },
    'block-new': () => {
      const s = getState();
      const tasks = openTasksFor(s, officerId(s)).sort((a, b) => a.due.localeCompare(b.due));
      if (!tasks.length) return toast('There are no open tasks to schedule.', 'info');
      openModal(blockForm({ title: 'Add time block', tasks, days: horizonDays() }));
    },
    'block-remove': (el) => {
      const oid = officerId(getState());
      update((st) => {
        const plan = st.plans[oid];
        plan.blocks = plan.blocks.filter((b) => b.id !== el.dataset.block);
        plan.edited = true;
        if (plan.status === 'accepted') plan.status = 'draft';
        logActivity(st, 'Removed a time block from the plan.');
      });
      closeModal();
      toast('Block removed — check the side panel for anything now unplanned.', 'info');
    },
    'emergency-open': () => openModal(emergencyForm(), { wide: true }),
    'emergency-parse': (el) => {
      const form = el.closest('form');
      const text = form.querySelector('[name="desc"]').value.trim();
      if (text.length < 4) return toast('Describe the urgent task first.', 'error');
      const { task } = parseNaturalTask(getState(), text, officerId(getState()));
      const set = (n, v) => (form.querySelector(`[name="${n}"]`).value = v);
      set('title', task.title);
      set('category', task.category);
      set('effort', task.effort);
      set('location', task.location);
      if (task.due.slice(0, 10) === TODAY && task.due.slice(11) > timePart(NOW)) set('dueTime', task.due.slice(11));
      form.querySelector('[name="safety"]').checked = task.safety;
    },
    'emergency-back': () => openModal(emergencyForm({ ...view.emergency.fields, dueTime: view.emergency.fields.due.slice(11) }), { wide: true }),
    'emergency-approve': () => {
      const r = view.emergency?.result;
      if (!r) return;
      const oid = officerId(getState());
      const late = r.newlyLate.map((id) => getTask(r.sim, id)?.title).filter(Boolean);
      update((st) => {
        st.tasks.push(r.task);
        st.nextId = Math.max(st.nextId, r.sim.nextId);
        st.plans[oid] = {
          status: 'accepted',
          generatedAt: NOW,
          signature: planSignature(st, oid),
          strategy: 'emergency',
          note: `made room for “${r.task.title}”`,
          blocks: r.after.blocks.map(({ protected: _p, ...b }) => b),
          unscheduled: r.after.unscheduled,
          warnings: r.after.warnings,
        };
        logActivity(st, `Approved emergency re-plan for “${r.task.title}”: ${r.moved.length} task(s) moved, ${r.protectedIds.length} protected.`);
        if (late.length) logActivity(st, `Requested supervisor help with ${late.map((x) => `“${x}”`).join(', ')} after an emergency.`);
      });
      view.emergency = null;
      closeModal();
      toast(late.length ? `Schedule updated. Your supervisor was asked in Teams to help with ${late.length} at-risk task${late.length > 1 ? 's' : ''} (simulated).` : 'Schedule updated around the urgent task.', late.length ? 'info' : 'success');
    },
    'cal-mode': (el) => {
      view.mode = el.dataset.mode;
      ctx.rerender();
    },
    'day-prev': () => {
      view.dayIdx -= 1;
      ctx.rerender();
    },
    'day-next': () => {
      view.dayIdx += 1;
      ctx.rerender();
    },
    'day-today': () => {
      view.dayIdx = 0;
      ctx.rerender();
    },
    'appt-new': () => openAppointment(),
    'ask-help': (el) => {
      const t = getTask(getState(), el.dataset.id);
      update((st) => logActivity(st, `Requested supervisor help with “${t.title}”.`));
      toast(`Your supervisor would be notified in Teams about “${t.title}” (simulated).`, 'info');
    },
  },
  changes: {
    'plan-officer': (el) => {
      view.officerId = el.value;
      ctx.rerender();
    },
  },
  submits: {
    'appt-save': saveAppointment,
    'block-save': saveBlock,
    'plan-nl': (form) => planFromText(String(new FormData(form).get('text') || '')),
    'emergency-preview': runEmergency,
  },
};
