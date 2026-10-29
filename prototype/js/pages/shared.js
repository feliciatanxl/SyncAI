// Components and actions shared across pages: task form/detail dialogs,
// score explanations and reassignment recommendation cards.

import { CATEGORIES, PRIORITIES, STATUSES } from '../data.js';
import { estimateEffort, scoreTask } from '../ai.js';
import { assessRisk, plannedFinish } from '../planner.js';
import { applyReassignment, rankCandidates, recommendReassignments } from '../simulation.js';
import { getOfficer, getState, getTask, isOpen, isSupervisor, logActivity, nextId, officerName, update, visibleTasks } from '../state.js';
import { NOW, workDay, fmtDue, fmtHours, dt } from '../time.js';
import { settleTimer, startTimer } from '../timer.js';
import { html, icon, openModal, closeModal, confirmDialog, toast, priorityBadge, riskBadge, sourceTag, avatar } from '../ui.js';

// ---------- small pieces ----------

export function scorePill(s, t) {
  const { score, band } = scoreTask(s, t);
  return html`<button class="score ${band.id === 'now' ? 'now' : ''}" data-action="explain-score" data-id="${t.id}" title="${band.label} — click for explanation" aria-label="AI priority score ${score}, ${band.label}. Show explanation">${score}</button>`;
}

export function reasonList(reasons) {
  return html`<ul class="reasons">
    ${reasons.map((r) => html`<li><span>${r.label}</span><b class="${r.points < 0 ? 'neg' : ''}">${r.points > 0 ? '+' : ''}${r.points}</b></li>`)}
  </ul>`;
}

export function visibleRecs(s) {
  if (!isSupervisor(s)) return [];
  return recommendReassignments(s).filter((r) => !s.dismissed.includes(r.id));
}

export function recCard(s, rec) {
  const t = getTask(s, rec.taskId);
  if (!t) return '';
  return html`<article class="rec" aria-label="Recommendation">
    <div class="rec-head">
      <span class="icon-wrap warning">${icon('users', 16)}</span>
      <div class="grow">
        <div class="rec-title">Reassign “${t.title}”</div>
        <div class="meta"><span>${officerName(s, rec.fromId)}</span>${icon('arrow', 12)}<span><strong>${officerName(s, rec.toId)}</strong></span><span>· Due ${fmtDue(t.due)}</span><span>· ${fmtHours(t.effort)}</span></div>
      </div>
      <span class="badge badge-ai" title="Fit score">Fit ${rec.fit}</span>
    </div>
    <p class="why">${icon('sparkles', 14)}<span><strong>Why:</strong> ${rec.why} ${officerName(s, rec.toId).split(' ')[0]}: ${rec.reasons.join(', ')}.</span></p>
    <div class="rec-actions">
      <button class="btn btn-primary btn-sm" data-action="rec-accept" data-rec="${rec.id}">${icon('check', 14)}Accept</button>
      <button class="btn btn-sm" data-action="rec-modify" data-rec="${rec.id}">${icon('pencil', 14)}Modify</button>
      <button class="btn btn-subtle btn-sm" data-action="rec-dismiss" data-rec="${rec.id}">Dismiss</button>
    </div>
  </article>`;
}

// ---------- task timer ----------

const loggedTime = (h) => (h * 60 < 1 ? 'less than a minute' : fmtHours(h));

/** Start / stop button for an officer's own open task; empty for everyone else. */
export function timerButton(s, t, small = false) {
  if (isSupervisor(s) || t.ownerId !== s.currentOfficerId || !isOpen(t)) return '';
  const on = !!t.timerStart;
  return small
    ? html`<button class="icon-btn sm ${on ? 'timer-on' : ''}" data-action="${on ? 'timer-stop' : 'timer-start'}" data-id="${t.id}" aria-label="${on ? 'Stop' : 'Start'} timer for “${t.title}”" title="${on ? 'Stop timer' : 'Start timer'}">${icon(on ? 'stop' : 'play', 14)}</button>`
    : html`<button class="btn ${on ? 'btn-danger' : ''}" data-action="${on ? 'timer-stop' : 'timer-start'}" data-id="${t.id}">${icon(on ? 'stop' : 'play', 16)}${on ? 'Stop timer' : 'Start timer'}</button>`;
}

// ---------- task detail ----------

export function openTaskDetail(id) {
  const s = getState();
  const t = getTask(s, id);
  if (!t) return toast('That task no longer exists.', 'error');
  const sc = scoreTask(s, t);
  const risk = assessRisk(s, t);
  const fin = isOpen(t) ? plannedFinish(s, t) : null;
  const deps = t.dependsOn.map((d) => getTask(s, d)).filter(Boolean);
  const canEdit = isSupervisor(s) || t.ownerId === s.currentOfficerId;
  const project = s.projects.find((p) => p.id === t.projectId);
  const checklist = t.checklist || []; // tasks created by older flows may have none

  openModal(
    html`<header class="modal-head">
        <h2 id="modal-title">${t.title}</h2>
        <button class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button>
      </header>
      <div class="modal-body stack">
        <div class="row wrap">${priorityBadge(t.priority)} ${riskBadge(risk.level)} ${sourceTag(t.source)} ${t.safety ? html`<span class="badge badge-danger">${icon('shield', 12)}Safety</span>` : ''}
          <span class="badge badge-neutral">${t.category}</span></div>
        ${t.description ? html`<p>${t.description}</p>` : ''}
        <div class="grid grid-2">
          <div class="stack" style="gap:6px">
            <div class="meta"><span>${icon('user', 14)}${officerName(s, t.ownerId)}</span></div>
            <div class="meta"><span>${icon('clock', 14)}Due ${fmtDue(t.due)}</span></div>
            <div class="meta"><span>${icon('calendar', 14)}${fin ? `Planned finish ${fmtDue(fin)}` : isOpen(t) ? 'Not in the projected schedule' : `Completed ${fmtDue(t.completedAt || NOW)}`}</span></div>
          </div>
          <div class="stack" style="gap:6px">
            <div class="meta"><span>${icon('pin', 14)}${t.location || 'No location'}</span></div>
            <div class="meta"><span>${icon('chart', 14)}Effort ${fmtHours(t.effort)}${t.spent ? ` · ${fmtHours(t.spent)} spent` : ''}${t.actual ? ` · actual ${fmtHours(t.actual)}` : ''}</span></div>
            ${deps.length ? html`<div class="meta"><span>${icon('link', 14)}Depends on: ${deps.map((d) => d.title).join(', ')}</span></div>` : ''}
            ${project ? html`<div class="meta"><span>${icon('folder', 14)}Project: <a href="#/projects/${project.id}" data-action="modal-close-go" data-href="#/projects/${project.id}">${project.name}</a></span></div>` : ''}
          </div>
        </div>
        ${checklist.length || canEdit
          ? html`<section>
              <h3>Checklist ${checklist.length ? html`<span class="muted small">${checklist.filter((c) => c.done).length}/${checklist.length} done</span>` : ''}</h3>
              <ul class="checklist">${checklist.map(
                (c, i) => html`<li><label class="check"><input type="checkbox" data-action="checklist-toggle" data-id="${t.id}" data-i="${i}" ${c.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'} /> <span class="${c.done ? 'is-done' : ''}">${c.text}</span></label>
                  ${canEdit ? html`<button class="icon-btn sm" data-action="checklist-remove" data-id="${t.id}" data-i="${i}" aria-label="Remove “${c.text}”">${icon('x', 14)}</button>` : ''}</li>`,
              )}</ul>
              ${canEdit
                ? html`<form class="row mt-sm" data-submit="checklist-add" novalidate>
                    <input type="hidden" name="id" value="${t.id}" />
                    <label class="sr-only" for="cl-new">New checklist item</label>
                    <input class="input" id="cl-new" name="text" maxlength="120" placeholder="Add a checklist item" style="flex:1" />
                    <button class="btn btn-sm" type="submit">${icon('plus', 14)}Add</button>
                  </form>`
                : ''}
            </section>`
          : ''}
        ${isOpen(t)
          ? html`<section>
              <h3 class="row">${icon('sparkles', 16)} AI priority score: ${sc.score} · ${sc.band.label}</h3>
              ${reasonList(sc.reasons)}
            </section>
            <section>
              <h3>Deadline risk</h3>
              <ul class="reasons">${risk.reasons.map((r) => html`<li><span>${r}</span></li>`)}</ul>
            </section>`
          : ''}
      </div>
      <footer class="modal-foot">
        ${canEdit ? html`<button class="btn btn-subtle" data-action="task-delete" data-id="${t.id}">${icon('trash', 16)}Delete</button>` : ''}
        <span class="spacer"></span>
        ${timerButton(s, t)}
        ${canEdit ? html`<button class="btn" data-action="task-toggle" data-id="${t.id}">${icon('check', 16)}${isOpen(t) ? 'Mark complete' : 'Reopen'}</button>` : ''}
        ${canEdit ? html`<button class="btn btn-primary" data-action="task-edit" data-id="${t.id}">${icon('pencil', 16)}Edit</button>` : ''}
      </footer>`,
    { wide: true },
  );
}

// ---------- task form ----------

function ownerOptions(s, selected) {
  if (!isSupervisor(s)) return html`<option value="${s.currentOfficerId}">${officerName(s, s.currentOfficerId)}</option>`;
  return s.officers.map((o) => html`<option value="${o.id}" ${o.id === selected ? 'selected' : ''}>${o.name}</option>`);
}

/** Officers can file work only under projects they own or already have tasks in (plus the task's current project). */
function projectChoicesFor(s, currentId) {
  if (isSupervisor(s)) return s.projects;
  const me = s.currentOfficerId;
  return s.projects.filter((p) => p.id === currentId || p.ownerId === me || s.tasks.some((x) => x.projectId === p.id && x.ownerId === me));
}

export function openTaskForm(existing = null, prefill = {}) {
  const s = getState();
  const t = existing
    ? { ...existing }
    : {
        title: '',
        description: '',
        category: 'Inspection',
        priority: 'Medium',
        ownerId: s.currentOfficerId,
        due: dt(workDay(1), '17:00'),
        effort: 1,
        location: '',
        dependsOn: [],
        safety: false,
        impact: 'medium',
        status: 'todo',
        source: 'SyncAI',
        ...prefill,
      };
  const depChoices = visibleTasks(s).filter((x) => isOpen(x) && x.id !== t.id);
  const projectChoices = projectChoicesFor(s, t.projectId);

  openModal(
    html`<form data-submit="task-save" novalidate>
      <header class="modal-head">
        <h2 id="modal-title">${existing ? 'Edit task' : 'New task'}</h2>
        <button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button>
      </header>
      <div class="modal-body">
        <input type="hidden" name="id" value="${existing?.id || ''}" />
        <div class="form-grid">
          <div class="field full" data-field="title">
            <label for="f-title">Title <span class="req" aria-hidden="true">*</span></label>
            <input class="input" id="f-title" name="title" value="${t.title}" maxlength="120" required autofocus aria-describedby="e-title" />
            <span class="error-text" id="e-title" aria-live="polite"></span>
          </div>
          <div class="field">
            <label for="f-category">Category</label>
            <select class="select" id="f-category" name="category">${CATEGORIES.map((c) => html`<option ${c === t.category ? 'selected' : ''}>${c}</option>`)}</select>
          </div>
          <div class="field">
            <label for="f-priority">Priority</label>
            <select class="select" id="f-priority" name="priority">${PRIORITIES.map((p) => html`<option ${p === t.priority ? 'selected' : ''}>${p}</option>`)}</select>
          </div>
          <div class="field">
            <label for="f-owner">Owner</label>
            <select class="select" id="f-owner" name="ownerId" ${isSupervisor(s) ? '' : 'disabled'}>${ownerOptions(s, t.ownerId)}</select>
            ${isSupervisor(s) ? '' : html`<span class="hint">Officers create tasks for themselves.</span>`}
          </div>
          <div class="field">
            <label for="f-status">Status</label>
            <select class="select" id="f-status" name="status">${STATUSES.map((x) => html`<option value="${x.id}" ${x.id === t.status ? 'selected' : ''}>${x.label}</option>`)}</select>
          </div>
          <div class="field">
            <label for="f-project">Project</label>
            <select class="select" id="f-project" name="projectId"><option value="">No project</option>${projectChoices.map((p) => html`<option value="${p.id}" ${p.id === t.projectId ? 'selected' : ''}>${p.name}</option>`)}</select>
          </div>
          <div class="field" data-field="due">
            <label for="f-due">Deadline <span class="req" aria-hidden="true">*</span></label>
            <input class="input" type="datetime-local" id="f-due" name="due" value="${t.due}" required aria-describedby="e-due" />
            <span class="error-text" id="e-due" aria-live="polite"></span>
          </div>
          <div class="field" data-field="effort">
            <label for="f-effort">Estimated effort (hours) <span class="req" aria-hidden="true">*</span></label>
            <div class="row">
              <input class="input" type="number" id="f-effort" name="effort" min="0.25" max="40" step="0.25" value="${t.effort}" required aria-describedby="e-effort" />
              <button type="button" class="btn btn-sm" data-action="suggest-estimate" title="Estimate from category, wording and team history">${icon('sparkles', 14)}Suggest</button>
            </div>
            <span class="error-text" id="e-effort" aria-live="polite"></span>
          </div>
          <div class="full" id="estimate-out" aria-live="polite"></div>
          <div class="field">
            <label for="f-location">Location</label>
            <input class="input" id="f-location" name="location" value="${t.location}" maxlength="80" placeholder="e.g. Blk 208" />
          </div>
          <div class="field">
            <span class="label">Flags</span>
            <label class="check"><input type="checkbox" name="safety" ${t.safety ? 'checked' : ''} /> Safety-related</label>
            <label class="check"><input type="checkbox" name="impactHigh" ${t.impact === 'high' ? 'checked' : ''} /> High resident impact</label>
          </div>
          <div class="field full" data-field="deps">
            <span class="label" id="deps-label">Depends on</span>
            ${depChoices.length
              ? html`<div class="dep-list" role="group" aria-labelledby="deps-label">
                  ${depChoices.map((d) => html`<label class="check small"><input type="checkbox" name="dependsOn" value="${d.id}" ${t.dependsOn.includes(d.id) ? 'checked' : ''} /> ${d.title} <span class="muted">· ${officerName(s, d.ownerId)}</span></label>`)}
                </div>`
              : html`<span class="hint">No other open tasks.</span>`}
            <span class="error-text" id="e-deps" aria-live="polite"></span>
          </div>
          <div class="field full">
            <label for="f-desc">Notes</label>
            <textarea class="textarea" id="f-desc" name="description" maxlength="600">${t.description}</textarea>
          </div>
        </div>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Create task'}</button>
      </footer>
    </form>`,
    { wide: true },
  );
}

function setError(form, field, msg) {
  const wrap = form.querySelector(`[data-field="${field}"]`);
  const out = form.querySelector(`#e-${field}`);
  if (wrap) wrap.classList.toggle('invalid', !!msg);
  if (out) out.textContent = msg || '';
  const input = wrap?.querySelector('input, select');
  if (input && input.type !== 'checkbox') input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function createsCycle(s, taskId, deps) {
  if (!taskId) return false;
  const seen = new Set();
  const stack = [...deps];
  while (stack.length) {
    const id = stack.pop();
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = getTask(s, id);
    if (t) stack.push(...t.dependsOn);
  }
  return false;
}

function saveTask(form) {
  const s = getState();
  const fd = new FormData(form);
  const id = fd.get('id');
  const title = String(fd.get('title') || '').trim();
  const due = String(fd.get('due') || '');
  const effort = Number(fd.get('effort'));
  const deps = fd.getAll('dependsOn').map(String);
  let ok = true;
  const check = (field, msg) => {
    setError(form, field, msg);
    if (msg) ok = false;
  };

  check('title', title.length < 3 ? 'Enter a title of at least 3 characters.' : '');
  check('due', !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(due) ? 'Choose a valid deadline.' : '');
  check('effort', !(effort >= 0.25 && effort <= 40) ? 'Effort must be between 0.25 and 40 hours.' : '');
  check('deps', createsCycle(s, id, deps) ? 'These dependencies would create a loop.' : '');
  if (!ok) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const fields = {
    title,
    description: String(fd.get('description') || '').trim(),
    category: String(fd.get('category')),
    priority: String(fd.get('priority')),
    ownerId: isSupervisor(s) ? String(fd.get('ownerId')) : s.currentOfficerId,
    status: String(fd.get('status')),
    due,
    effort: Math.round(effort * 4) / 4,
    location: String(fd.get('location') || '').trim(),
    safety: fd.get('safety') === 'on',
    impact: fd.get('impactHigh') === 'on' ? 'high' : 'medium',
    dependsOn: deps,
    projectId: String(fd.get('projectId') || '') || null,
  };
  if (!CATEGORIES.includes(fields.category) || !PRIORITIES.includes(fields.priority) || !getOfficer(s, fields.ownerId) || (fields.projectId && !projectChoicesFor(s, getTask(s, id)?.projectId).some((p) => p.id === fields.projectId))) {
    toast('Some fields have invalid values.', 'error');
    return;
  }

  update((st) => {
    if (id) {
      const t = getTask(st, id);
      const wasOpen = isOpen(t);
      if (fields.status === 'done') settleTimer(t, Date.now());
      Object.assign(t, fields);
      if (wasOpen && !isOpen(t)) t.completedAt = NOW;
      if (!isOpen(t) && !t.actual) t.actual = t.effort;
      if (isOpen(t)) {
        t.completedAt = null;
      }
      logActivity(st, `Updated task “${title}”.`);
    } else {
      st.tasks.push({ id: nextId(st, 't'), spent: 0, source: 'SyncAI', checklist: [], createdAt: NOW, completedAt: fields.status === 'done' ? NOW : null, actual: fields.status === 'done' ? fields.effort : null, ...fields });
      logActivity(st, `Created task “${title}” for ${officerName(st, fields.ownerId)}.`);
    }
  });
  closeModal();
  toast(id ? 'Task updated' : 'Task created');
}

// ---------- reassignment modify dialog ----------

export function openReassignDialog(rec) {
  const s = getState();
  const t = getTask(s, rec.taskId);
  const ranked = rankCandidates(s, t, { exclude: [t.ownerId] });
  openModal(html`<form data-submit="reassign-save">
    <header class="modal-head">
      <h2 id="modal-title">Reassign “${t.title}”</h2>
      <button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button>
    </header>
    <div class="modal-body stack">
      <p class="muted">Currently with ${officerName(s, t.ownerId)} · due ${fmtDue(t.due)} · ${fmtHours(t.effort)}. Candidates are ranked by skills, spare capacity and availability.</p>
      <input type="hidden" name="taskId" value="${t.id}" />
      <input type="hidden" name="recId" value="${rec.id}" />
      <fieldset class="stack" style="border:0;padding:0;margin:0;gap:8px">
        <legend class="sr-only">Choose an officer</legend>
        ${ranked.map(
          (c, i) => html`<label class="rec" style="cursor:pointer">
            <span class="row"><input type="radio" name="toId" value="${c.officer.id}" ${c.officer.id === rec.toId || (!ranked.some((r) => r.officer.id === rec.toId) && i === 0) ? 'checked' : ''} />
              ${avatar(c.officer.name, 'sm')}<strong>${c.officer.name}</strong><span class="muted small">${c.officer.title}</span><span class="spacer"></span><span class="badge badge-ai">Fit ${c.score}</span></span>
            <span class="why" style="padding-left:24px">${c.reasons.join(' · ')}</span>
          </label>`,
        )}
        ${ranked.length ? '' : html`<p class="notice notice-warning">${icon('alert', 16)}No officers are available before this deadline.</p>`}
      </fieldset>
    </div>
    <footer class="modal-foot">
      <button type="button" class="btn" data-action="modal-close">Cancel</button>
      <button type="submit" class="btn btn-primary" ${ranked.length ? '' : 'disabled'}>Reassign task</button>
    </footer>
  </form>`);
}

function findRec(id) {
  return recommendReassignments(getState()).find((r) => r.id === id);
}

// ---------- actions ----------

export const sharedActions = {
  'task-new': () => openTaskForm(),
  'task-view': (el) => openTaskDetail(el.dataset.id),
  'checklist-toggle': (el) => {
    const { id, i } = el.dataset;
    update((st) => {
      const item = getTask(st, id)?.checklist?.[Number(i)];
      if (item) item.done = !item.done;
    });
    openTaskDetail(id);
    document.querySelector(`[data-action="checklist-toggle"][data-i="${i}"]`)?.focus();
  },
  'timer-start': (el) => {
    const id = el.dataset.id;
    let title = '';
    update((st) => {
      const t = startTimer(st, id, Date.now());
      title = t?.title || '';
      if (t) logActivity(st, `Started a timer on “${title}”.`);
    });
    toast(`Timer started: ${title}`, 'info');
    if (el.closest('.modal')) openTaskDetail(id);
  },
  'timer-stop': (el) => {
    const id = el.dataset.id;
    let h = 0;
    let title = '';
    update((st) => {
      const t = getTask(st, id);
      title = t?.title || '';
      h = settleTimer(t, Date.now());
      if (t) logActivity(st, `Logged ${loggedTime(h)} on “${title}”.`);
    });
    toast(`Logged ${loggedTime(h)} on ${title}`);
    if (el.closest('.modal')) openTaskDetail(id);
  },
  'checklist-remove': (el) => {
    const { id, i } = el.dataset;
    update((st) => getTask(st, id)?.checklist?.splice(Number(i), 1));
    openTaskDetail(id);
    document.getElementById('cl-new')?.focus();
  },
  'modal-close-go': (el) => {
    closeModal();
    location.hash = el.dataset.href;
  },
  'task-edit': (el) => {
    const t = getTask(getState(), el.dataset.id);
    if (t) openTaskForm(t);
  },
  'task-toggle': (el) => {
    const id = el.dataset.id;
    let nowDone = false;
    let title = '';
    update((st) => {
      const t = getTask(st, id);
      if (!t) return;
      title = t.title;
      if (isOpen(t)) {
        settleTimer(t, Date.now());
        t.status = 'done';
        t.completedAt = NOW;
        t.actual = t.actual || Math.max(t.effort, t.spent || 0);
        nowDone = true;
      } else {
        t.status = 'todo';
        t.completedAt = null;
      }
      logActivity(st, `${nowDone ? 'Completed' : 'Reopened'} “${t.title}”.`);
    });
    closeModal();
    toast(nowDone ? `Completed “${title}”` : `Reopened “${title}”`);
  },
  'task-delete': async (el) => {
    const s = getState();
    const t = getTask(s, el.dataset.id);
    if (!t) return;
    const dependants = s.tasks.filter((x) => x.dependsOn.includes(t.id));
    const ok = await confirmDialog({
      title: 'Delete task?',
      body: `“${t.title}” will be removed from the prototype.${dependants.length ? ` ${dependants.length} task(s) depending on it will have the dependency removed.` : ''}`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    update((st) => {
      st.tasks = st.tasks.filter((x) => x.id !== t.id);
      st.tasks.forEach((x) => (x.dependsOn = x.dependsOn.filter((d) => d !== t.id)));
      logActivity(st, `Deleted task “${t.title}”.`);
    });
    toast('Task deleted');
  },
  'explain-score': (el) => openTaskDetail(el.dataset.id),
  'suggest-estimate': (el) => {
    const form = el.closest('form');
    const s = getState();
    const title = form.querySelector('[name="title"]').value;
    const category = form.querySelector('[name="category"]').value;
    const est = estimateEffort(s, { category, title });
    form.querySelector('[name="effort"]').value = est.hours;
    const out = form.querySelector('#estimate-out');
    out.innerHTML = String(html`<div class="estimate-box"><span class="ai-label">${icon('sparkles', 14)}SyncAI estimate: ${fmtHours(est.hours)}</span><ul>${est.reasons.map((r) => html`<li>${r}</li>`)}</ul></div>`);
  },
  'rec-accept': (el) => {
    const rec = findRec(el.dataset.rec);
    if (!rec) return toast('This recommendation is no longer valid.', 'info');
    const s = getState();
    const title = getTask(s, rec.taskId).title;
    update((st) => {
      applyReassignment(st, rec);
      logActivity(st, `Approved reassignment of “${title}” from ${officerName(st, rec.fromId)} to ${officerName(st, rec.toId)}.`);
    });
    toast(`Reassigned to ${officerName(getState(), rec.toId)}. Both officers would be notified in Teams (simulated).`);
  },
  'rec-modify': (el) => {
    const rec = findRec(el.dataset.rec);
    if (rec) openReassignDialog(rec);
  },
  'rec-dismiss': (el) => {
    update((st) => {
      st.dismissed.push(el.dataset.rec);
    });
    toast('Recommendation dismissed', 'info');
  },
};

export const sharedSubmits = {
  'task-save': saveTask,
  'checklist-add': (form) => {
    const id = String(new FormData(form).get('id'));
    const text = String(new FormData(form).get('text') || '').trim().slice(0, 120);
    if (!text) return toast('Type a checklist item first.', 'error');
    update((st) => {
      const t = getTask(st, id);
      if (t) (t.checklist ||= []).push({ text, done: false });
    });
    openTaskDetail(id);
    document.getElementById('cl-new')?.focus();
  },
  'reassign-save': (form) => {
    const fd = new FormData(form);
    const taskId = String(fd.get('taskId'));
    const toId = String(fd.get('toId') || '');
    const s = getState();
    const t = getTask(s, taskId);
    if (!t || !getOfficer(s, toId)) return toast('Choose an officer.', 'error');
    const fromId = t.ownerId;
    update((st) => {
      applyReassignment(st, { taskId, toId });
      logActivity(st, `Reassigned “${t.title}” from ${officerName(st, fromId)} to ${officerName(st, toId)} (modified recommendation).`);
    });
    closeModal();
    toast(`Reassigned to ${officerName(getState(), toId)}`);
  },
};

