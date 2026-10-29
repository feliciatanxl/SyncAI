// Projects (EMS 12h Project Tracker): projects broken into tasks, owners and
// deadlines, with progress and an explainable AI health check per project.

import { PROJECT_TEMPLATES, STATUSES } from '../data.js';
import { analyseOfficer, assessRisk } from '../planner.js';
import { getOfficer, getState, isOpen, isOverdue, isSupervisor, logActivity, nextId, officerName, update, visibleTasks } from '../state.js';
import { TODAY, NOW, workDay, dt, fmtDay, fmtDue, isoDate, parseDate } from '../time.js';
import { html, icon, avatar, priorityBadge, riskBadge, emptyState, filterTabs, openModal, closeModal, confirmDialog, toast, pct } from '../ui.js';
import { openTaskForm, recCard, visibleRecs } from './shared.js';
import { mountKanban, setStatus } from './tasks.js';
import { ctx } from '../ctx.js';

const view = { filter: 'all', mode: 'board' };
const DAY = 86400000;
const COLORS = ['#0f6cbd', '#5b5fc7', '#0e7a0d', '#b10e1c', '#8a4b00', '#00788a'];
const HEALTH = {
  done: { label: 'Complete', tone: 'success', rank: 0 },
  'on-track': { label: 'On track', tone: 'success', rank: 1 },
  attention: { label: 'Needs attention', tone: 'warning', rank: 2 },
  risk: { label: 'At risk', tone: 'danger', rank: 3 },
};

const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);
const addDays = (iso, n) => isoDate(new Date(parseDate(iso).getTime() + n * DAY));
const projectTasks = (s, p) => s.tasks.filter((t) => t.projectId === p.id);

/**
 * Project health: effort-weighted progress against time used, plus overdue
 * and high-risk tasks and owners who are overloaded or away. Reasons marked
 * `personal` name other officers and are shown to supervisors only.
 */
export function projectHealth(s, p) {
  const tasks = projectTasks(s, p);
  const open = tasks.filter(isOpen);
  const total = tasks.reduce((n, t) => n + t.effort, 0);
  const progress = total ? tasks.filter((t) => !isOpen(t)).reduce((n, t) => n + t.effort, 0) / total : 0;
  const expected = Math.min(Math.max(daysBetween(p.start, TODAY) / Math.max(daysBetween(p.start, p.due), 1), 0), 1);
  const out = { tasks, open, progress, expected, reasons: [] };
  if (tasks.length && !open.length) return { ...out, level: 'done', reasons: [{ text: 'Every task is complete.' }] };

  let level = 'on-track';
  const raise = (l, text, personal = false) => {
    out.reasons.push({ text, personal });
    if (HEALTH[l].rank > HEALTH[level].rank) level = l;
  };
  const overdue = open.filter(isOverdue);
  const risky = open.filter((t) => assessRisk(s, t).level === 'high');
  const behind = expected - progress;

  if (p.due < TODAY && open.length) raise('risk', `Past the project deadline with ${open.length} task(s) still open.`);
  if (overdue.length) raise('risk', `${overdue.length} task(s) overdue, starting with “${overdue[0].title}”.`);
  if (risky.length) raise(risky.length > 1 ? 'risk' : 'attention', `${risky.length} task(s) at high risk of missing their deadline.`);
  if (tasks.length && behind > 0.1) raise(behind > 0.25 ? 'risk' : 'attention', `Behind schedule: ${pct(progress)} of the work is done but ${pct(expected)} of the time has passed.`);
  for (const id of new Set(open.map((t) => t.ownerId))) {
    const a = analyseOfficer(s, id);
    if (a.status.id !== 'away' && a.status.id !== 'over') continue;
    const n = open.filter((t) => t.ownerId === id).length;
    raise('attention', `${a.officer.name} is ${a.status.id === 'away' ? 'unavailable' : 'overloaded'} and owns ${n} open task(s) here.`, true);
  }
  if (!tasks.length) out.reasons.push({ text: 'No tasks yet. Add tasks to start tracking progress.' });
  else if (!out.reasons.length) out.reasons.push({ text: `On schedule: ${pct(progress)} of the work is done with ${pct(expected)} of the time used.` });
  return { ...out, level };
}

/** Officers see projects they own or have tasks in; supervisors see all. */
export function visibleProjects(s) {
  if (isSupervisor(s)) return s.projects;
  const me = s.currentOfficerId;
  return s.projects.filter((p) => p.ownerId === me || projectTasks(s, p).some((t) => t.ownerId === me));
}

/** Visible projects with their health, worst first, then by deadline. */
export function rankedProjects(s) {
  return visibleProjects(s)
    .map((p) => ({ p, h: projectHealth(s, p) }))
    .sort((a, b) => HEALTH[b.h.level].rank - HEALTH[a.h.level].rank || a.p.due.localeCompare(b.p.due));
}

export const healthBadge = (level) => html`<span class="badge badge-${HEALTH[level].tone}">${HEALTH[level].label}</span>`;
export const progressBar = (value, color) =>
  html`<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}" aria-label="Progress"><span style="width:${value * 100}%;background:${color}"></span></div>`;

function dueChip(iso, open = true) {
  const left = daysBetween(TODAY, iso);
  const late = open && left < 0;
  const text = !open ? `Ended ${fmtDay(iso)}` : late ? `${-left} day${left === -1 ? '' : 's'} late` : left === 0 ? 'Due today' : `${left} day${left === 1 ? '' : 's'} left`;
  return html`<span class="due-chip ${late ? 'late' : left <= 3 && open ? 'soon' : ''}" title="Due ${fmtDay(iso)}">${icon('clock', 12)}${text}</span>`;
}

function avatarStack(s, ids) {
  const list = [...new Set(ids)];
  return html`<span class="avatar-stack" aria-label="Team: ${list.map((id) => officerName(s, id)).join(', ')}">
    ${list.slice(0, 4).map((id) => html`<span title="${officerName(s, id)}">${avatar(officerName(s, id), 'sm')}</span>`)}
    ${list.length > 4 ? html`<span class="avatar avatar-sm more">+${list.length - 4}</span>` : ''}
  </span>`;
}

// ---------- projects list ----------

function listPage(s) {
  const sup = isSupervisor(s);
  const all = rankedProjects(s);
  const tabs = [['all', 'All'], ['risk', 'At risk'], ['attention', 'Needs attention'], ['on-track', 'On track'], ['done', 'Complete']];
  const shown = view.filter === 'all' ? all : all.filter((x) => x.h.level === view.filter);

  return html`
    <div class="page-head">
      <div><h1>Projects</h1><p>${sup ? 'Every Town Council project, its tasks and progress in one place.' : 'Projects you are working on.'}</p></div>
      ${sup ? html`<div class="actions"><button class="btn btn-primary" data-action="proj-new">${icon('plus', 16)}New project</button></div>` : ''}
    </div>
    ${filterTabs('proj-filter', 'Project health', tabs.map(([v, l]) => [v, l, v === 'all' ? all.length : all.filter((x) => x.h.level === v).length]), view.filter)}
    ${shown.length
      ? html`<div class="project-grid mt">${shown.map(({ p, h }) => projectCard(s, p, h))}</div>`
      : html`<div class="card mt">${emptyState('folder', all.length ? 'No projects with this status' : 'No projects yet', all.length ? 'Try another tab.' : sup ? 'Create a project from a template to get started.' : 'Projects you are part of will appear here.')}</div>`}`;
}

function projectCard(s, p, h) {
  const done = h.tasks.length - h.open.length;
  return html`<a class="project-card" href="#/projects/${p.id}" style="--pc:${p.color}">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">
      <h2>${p.name}</h2>${healthBadge(h.level)}
    </div>
    <p class="muted small clamp-2">${p.description}</p>
    <div>
      <div class="row small" style="justify-content:space-between"><span class="muted">Progress</span><strong>${pct(h.progress)}</strong></div>
      ${progressBar(h.progress, p.color)}
    </div>
    <div class="project-foot">
      ${dueChip(p.due, h.level !== 'done')}
      <span class="muted small">${icon('check-square', 13)} ${done}/${h.tasks.length}</span>
      ${avatarStack(s, [p.ownerId, ...h.tasks.map((t) => t.ownerId)])}
    </div>
  </a>`;
}

// ---------- project page ----------

function detailPage(s, p) {
  const sup = isSupervisor(s);
  const h = projectHealth(s, p);
  const tasks = visibleTasks(s).filter((t) => t.projectId === p.id);
  const ids = new Set(h.tasks.map((t) => t.id));
  const recs = sup ? visibleRecs(s).filter((r) => ids.has(r.taskId)) : [];
  const reasons = h.reasons.filter((r) => sup || !r.personal);
  const next = p.milestones.find((m) => m.date >= TODAY);
  const canAdd = sup || p.ownerId === s.currentOfficerId || tasks.length > 0;

  return html`
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/projects">Projects</a><span aria-hidden="true">›</span><span aria-current="page">${p.name}</span></nav>
    <div class="page-head">
      <div><h1 class="row"><span class="color-dot" style="background:${p.color}" aria-hidden="true"></span>${p.name}</h1><p>${p.description}</p></div>
      <div class="actions">
        ${sup ? html`<button class="btn btn-subtle" data-action="proj-delete">${icon('trash', 16)}Delete</button><button class="btn" data-action="proj-edit">${icon('pencil', 16)}Edit project</button>` : ''}
        ${canAdd ? html`<button class="btn btn-primary" data-action="proj-add-task" data-status="todo">${icon('plus', 16)}Add task</button>` : ''}
      </div>
    </div>

    <div class="grid grid-4">
      <div class="card stat"><div class="stat-label"><span class="stat-icon">${icon('chart', 16)}</span>Progress</div><div class="stat-value">${pct(h.progress)}</div>${progressBar(h.progress, p.color)}<div class="stat-foot">${pct(h.expected)} of the time used</div></div>
      <div class="card stat"><div class="stat-label"><span class="stat-icon">${icon('check-square', 16)}</span>Tasks</div><div class="stat-value">${h.tasks.length - h.open.length}/${h.tasks.length}</div><div class="stat-foot">${h.open.length} open${h.open.filter(isOverdue).length ? ` · ${h.open.filter(isOverdue).length} overdue` : ''}</div></div>
      <div class="card stat"><div class="stat-label"><span class="stat-icon ${daysBetween(TODAY, p.due) < 0 && h.open.length ? 'danger' : ''}">${icon('calendar', 16)}</span>Deadline</div><div class="stat-value" style="font-size:20px">${fmtDay(p.due)}</div><div class="stat-foot">${next ? `Next milestone: ${next.name}, ${fmtDay(next.date)}` : 'No upcoming milestones'}</div></div>
      <div class="card stat"><div class="stat-label"><span class="stat-icon">${icon('user', 16)}</span>Project owner</div><div class="row" style="margin-top:6px">${avatar(officerName(s, p.ownerId))}<strong>${officerName(s, p.ownerId)}</strong></div><div class="stat-foot">Started ${fmtDay(p.start)}</div></div>
    </div>

    <section class="card ai-card mt" aria-labelledby="ph-h">
      <div class="card-head"><h2 id="ph-h"><span class="ai-label">${icon('sparkles', 16)}AI project health</span></h2>${healthBadge(h.level)}</div>
      <div class="card-body">
        <ul class="reasons" style="gap:6px">${reasons.map((r) => html`<li style="justify-content:flex-start;gap:8px">${icon(h.level === 'risk' ? 'alert' : 'info', 14)}<span>${r.text}</span></li>`)}</ul>
        ${recs.length ? html`<h3 class="mt">Suggested actions</h3><div class="stack mt-sm">${recs.slice(0, 2).map((r) => recCard(s, r))}</div>` : ''}
      </div>
    </section>

    <section class="card mt" aria-label="Project tasks">
      ${filterTabs('proj-view', 'Project view', [['board', 'Board'], ['list', 'List'], ['timeline', 'Timeline']], view.mode)}
      <div class="card-body">${{ board: boardView, list: listView, timeline: timelineView }[view.mode](s, p, tasks, canAdd)}</div>
    </section>`;
}

function boardView(s, p, tasks, canAdd) {
  return html`<div class="kanban proj-board">
    ${STATUSES.map((col) => {
      const items = tasks.filter((t) => t.status === col.id).sort((a, b) => a.due.localeCompare(b.due));
      return html`<section class="kanban-col" data-status="${col.id}" aria-label="${col.label}">
        <h3>${col.label} <span class="badge badge-neutral">${items.length}</span></h3>
        ${items.map((t) => boardCard(s, t))}
        ${canAdd ? html`<button class="add-card" data-action="proj-add-task" data-status="${col.id}">${icon('plus', 14)}Add task</button>` : ''}
      </section>`;
    })}
  </div>`;
}

function boardCard(s, t) {
  const checks = t.checklist || [];
  const done = checks.filter((c) => c.done).length;
  return html`<article class="kanban-card trello-card prio-${t.priority.toLowerCase()}" draggable="true" data-id="${t.id}">
    <button class="task-title" data-action="task-view" data-id="${t.id}">${t.title}</button>
    <div class="meta">
      ${priorityBadge(t.priority)}
      ${isOpen(t) ? dueChip(t.due.slice(0, 10)) : html`<span class="due-chip done">${icon('check', 12)}Done</span>`}
      ${checks.length ? html`<span class="due-chip ${done === checks.length ? 'done' : ''}" title="Checklist">${icon('check-square', 12)}${done}/${checks.length}</span>` : ''}
      ${t.safety ? html`<span class="badge badge-danger" style="padding:0 6px">${icon('shield', 11)}Safety</span>` : ''}
    </div>
    <div class="row" style="justify-content:space-between">
      <span class="row small muted">${avatar(officerName(s, t.ownerId), 'sm')}${officerName(s, t.ownerId).split(' ')[0]}</span>
      <label class="sr-only" for="ps-${t.id}">Move “${t.title}” to</label>
      <select class="select select-sm" id="ps-${t.id}" data-change="proj-status" data-id="${t.id}">
        ${STATUSES.map((x) => html`<option value="${x.id}" ${x.id === t.status ? 'selected' : ''}>${x.label}</option>`)}
      </select>
    </div>
  </article>`;
}

function listView(s, p, tasks) {
  if (!tasks.length) return emptyState('check-square', 'No tasks', 'Add a task to this project.');
  const rows = [...tasks].sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || a.due.localeCompare(b.due));
  return html`<div class="table-wrap"><table class="table">
    <caption class="sr-only">Project tasks</caption>
    <thead><tr><th>Task</th><th>Owner</th><th>Status</th><th>Due</th><th>Checklist</th><th>Risk</th></tr></thead>
    <tbody>${rows.map((t) => {
      const checks = t.checklist || [];
      return html`<tr class="${isOpen(t) ? '' : 'done'}">
        <td style="min-width:200px"><button class="task-title" data-action="task-view" data-id="${t.id}">${t.title}</button></td>
        <td><span class="row" style="white-space:nowrap">${avatar(officerName(s, t.ownerId), 'sm')}${officerName(s, t.ownerId)}</span></td>
        <td><span class="badge badge-neutral">${STATUSES.find((x) => x.id === t.status).label}</span></td>
        <td style="white-space:nowrap" class="${isOverdue(t) ? 'delta-bad' : ''}">${fmtDue(t.due)}</td>
        <td>${checks.length ? `${checks.filter((c) => c.done).length}/${checks.length}` : '—'}</td>
        <td>${riskBadge(assessRisk(s, t).level)}</td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

function timelineView(s, p, tasks) {
  if (!tasks.length) return emptyState('calendar', 'Nothing to show yet', 'Tasks appear on the timeline once they have deadlines.');
  const end = [p.due, ...tasks.map((t) => t.due.slice(0, 10))].sort().at(-1);
  const span = daysBetween(p.start, end) + 1;
  const pos = (iso) => (Math.min(Math.max(daysBetween(p.start, iso), 0), span) / span) * 100;
  const ticks = Array.from({ length: 6 }, (_, i) => addDays(p.start, Math.round(((span - 1) * i) / 5)));
  const rows = [...tasks].sort((a, b) => a.due.localeCompare(b.due));
  const todayPos = TODAY >= p.start && TODAY <= end ? pos(TODAY) : null;

  return html`<div class="gantt-wrap"><div class="gantt">
    <div class="gantt-row gantt-head"><span></span><div class="gantt-track">
      ${ticks.map((d) => html`<span class="gantt-tick" style="left:${pos(d)}%">${fmtDay(d)}</span>`)}
    </div></div>
    <div class="gantt-row"><span class="gantt-label muted small">Milestones</span><div class="gantt-track">
      ${p.milestones.map((m) => html`<span class="milestone" style="left:${pos(m.date)}%" title="${m.name} · ${fmtDay(m.date)}"><span class="sr-only">${m.name}, ${fmtDay(m.date)}</span></span>`)}
      ${todayPos == null ? '' : html`<span class="gantt-today" style="left:${todayPos}%"></span>`}
    </div></div>
    ${rows.map((t) => {
      const start = [p.start, t.createdAt.slice(0, 10)].sort().at(-1);
      const due = t.due.slice(0, 10);
      const state = !isOpen(t) ? 'done' : isOverdue(t) ? 'late' : assessRisk(s, t).level === 'high' ? 'risk' : 'open';
      return html`<div class="gantt-row">
        <button class="gantt-label task-title" data-action="task-view" data-id="${t.id}" title="${t.title}">${t.title}<span class="muted"> · ${officerName(s, t.ownerId).split(' ')[0]}</span></button>
        <div class="gantt-track">
          <span class="gantt-bar ${state}" style="left:${pos(start)}%;width:${Math.max(pos(due) - pos(start), 1.5)}%;--pc:${p.color}" title="${fmtDay(start)} → ${fmtDay(due)}"><span class="sr-only">${fmtDay(start)} to ${fmtDay(due)}, ${state}</span></span>
          ${todayPos == null ? '' : html`<span class="gantt-today" style="left:${todayPos}%"></span>`}
        </div>
      </div>`;
    })}
  </div></div>
  <p class="muted small mt-sm">Bars run from when a task was created to its deadline. ◆ milestones · red line today · faded bars are done, red bars are overdue, amber bars are at risk.</p>`;
}

// ---------- new project ----------

function openProjectForm(p = null) {
  const s = getState();
  openModal(
    html`<form data-submit="proj-save" novalidate>
      <input type="hidden" name="id" value="${p?.id || ''}" />
      <header class="modal-head"><h2 id="modal-title">${icon('folder', 18)} ${p ? 'Edit project' : 'New project'}</h2>
        <button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
      <div class="modal-body"><div class="form-grid">
        <div class="field full" data-field="name"><label for="pj-name">Project name <span class="req" aria-hidden="true">*</span></label>
          <input class="input" id="pj-name" name="name" maxlength="80" value="${p?.name || ''}" required autofocus aria-describedby="e-name" /><span class="error-text" id="e-name" aria-live="polite"></span></div>
        ${p
          ? ''
          : html`<div class="field"><label for="pj-template">Start from template</label>
          <select class="select" id="pj-template" name="template">${Object.entries(PROJECT_TEMPLATES).map(([k, t]) => html`<option value="${k}">${t.label}${t.tasks.length ? ` (${t.tasks.length} tasks)` : ''}</option>`)}</select></div>`}
        <div class="field"><label for="pj-owner">Project owner</label>
          <select class="select" id="pj-owner" name="ownerId">${s.officers.map((o) => html`<option value="${o.id}" ${o.id === p?.ownerId ? 'selected' : ''}>${o.name}</option>`)}</select></div>
        <div class="field" data-field="start"><label for="pj-start">Start date</label>
          <input class="input" type="date" id="pj-start" name="start" value="${p?.start || TODAY}" required aria-describedby="e-start" /><span class="error-text" id="e-start" aria-live="polite"></span></div>
        <div class="field" data-field="due"><label for="pj-due">Deadline</label>
          <input class="input" type="date" id="pj-due" name="due" value="${p?.due || workDay(10)}" required aria-describedby="e-due" /><span class="error-text" id="e-due" aria-live="polite"></span></div>
        <div class="field full"><label for="pj-desc">Description</label>
          <textarea class="textarea" id="pj-desc" name="description" maxlength="300">${p?.description || ''}</textarea></div>
        ${p ? '' : html`<p class="full muted small">Template tasks are spread across the project dates and assigned to the project owner. You can reassign or edit them afterwards.</p>`}
      </div></div>
      <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">Cancel</button><button type="submit" class="btn btn-primary">${p ? 'Save changes' : 'Create project'}</button></footer>
    </form>`,
    { wide: true },
  );
}

function saveProject(form) {
  const s = getState();
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const start = String(fd.get('start') || '');
  const due = String(fd.get('due') || '');
  const editId = String(fd.get('id') || '');
  const template = editId ? PROJECT_TEMPLATES.blank : PROJECT_TEMPLATES[String(fd.get('template'))];
  const ownerId = String(fd.get('ownerId'));
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const errors = {
    name: name.length < 3 ? 'Enter a project name of at least 3 characters.' : '',
    start: isDate(start) ? '' : 'Choose a start date.',
    due: !isDate(due) ? 'Choose a deadline.' : isDate(start) && due <= start ? 'The deadline must be after the start date.' : '',
  };
  for (const [k, msg] of Object.entries(errors)) {
    form.querySelector(`[data-field="${k}"]`).classList.toggle('invalid', !!msg);
    form.querySelector(`#e-${k}`).textContent = msg;
  }
  if (Object.values(errors).some(Boolean)) return form.querySelector('.invalid input')?.focus();
  if (!template || !getOfficer(s, ownerId) || !isSupervisor(s)) return toast('Some fields have invalid values.', 'error');

  const description = String(fd.get('description') || '').trim();
  if (editId) {
    update((st) => {
      const p = st.projects.find((x) => x.id === editId);
      Object.assign(p, { name, ownerId, start, due, description: description || p.description });
      logActivity(st, `Updated project “${name}”.`);
    });
    closeModal();
    return toast('Project updated');
  }

  let id;
  update((st) => {
    id = nextId(st, 'p');
    const span = daysBetween(start, due);
    st.projects.push({ id, name, ownerId, start, due, color: COLORS[st.projects.length % COLORS.length], description: description || `${template.label} project.`, milestones: [{ name: 'Project deadline', date: due }] });
    for (const [title, category, effort, share] of template.tasks) {
      st.tasks.push({
        id: nextId(st, 't'), ownerId, title, description: `From the ${template.label} template.`, category, priority: 'Medium',
        due: dt(addDays(start, Math.round(span * share)), '17:00'), effort, spent: 0, status: 'todo', location: '', dependsOn: [], source: 'SyncAI',
        safety: false, impact: 'medium', createdAt: NOW, completedAt: null, actual: null, projectId: id, checklist: [],
      });
    }
    logActivity(st, `Created project “${name}” with ${template.tasks.length} task(s) for ${officerName(st, ownerId)}.`);
  });
  closeModal();
  toast(`Project “${name}” created`);
  ctx.navigate(`projects/${id}`);
}

// ---------- page ----------

const currentProject = (s) => (ctx.param ? visibleProjects(s).find((p) => p.id === ctx.param) : null);

export default {
  id: 'projects',
  title: 'Projects',
  headingFor: (s) => currentProject(s)?.name,
  icon: 'folder',
  roles: ['officer', 'supervisor'],
  render: (s) => {
    if (!ctx.param) return listPage(s);
    const p = currentProject(s);
    return p ? detailPage(s, p) : html`<section class="card">${emptyState('folder', 'Project not found', 'It may have been removed, or you may not be part of it.', html`<a class="btn btn-primary" href="#/projects">All projects</a>`)}</section>`;
  },
  mount: (root, s) => {
    selfTest(s);
    if (ctx.param && view.mode === 'board') mountKanban(root);
  },
  actions: {
    'proj-filter': (el) => {
      view.filter = el.dataset.value;
      ctx.rerender();
      document.querySelector(`[data-action="proj-filter"][data-value="${el.dataset.value}"]`)?.focus();
    },
    'proj-view': (el) => {
      view.mode = el.dataset.value;
      ctx.rerender();
      document.querySelector(`[data-action="proj-view"][data-value="${el.dataset.value}"]`)?.focus();
    },
    'proj-new': () => openProjectForm(),
    'proj-edit': () => openProjectForm(currentProject(getState())),
    'proj-delete': async () => {
      const p = currentProject(getState());
      const n = projectTasks(getState(), p).length;
      const ok = await confirmDialog({ title: `Delete “${p.name}”?`, body: `The project is removed. Its ${n} task(s) are kept and stay with their owners, but no longer belong to a project.`, confirmLabel: 'Delete project', danger: true });
      if (!ok) return;
      update((st) => {
        st.tasks.forEach((t) => t.projectId === p.id && (t.projectId = null));
        st.projects = st.projects.filter((x) => x.id !== p.id);
        logActivity(st, `Deleted project “${p.name}”; ${n} task(s) kept.`);
      });
      toast('Project deleted');
      ctx.navigate('projects');
    },
    'proj-add-task': (el) => {
      const s = getState();
      openTaskForm(null, { projectId: ctx.param, status: el.dataset.status || 'todo', ownerId: isSupervisor(s) ? currentProject(s)?.ownerId : s.currentOfficerId });
    },
  },
  changes: {
    'proj-status': (el) => setStatus(el.dataset.id, el.value),
  },
  submits: { 'proj-save': saveProject },
};

// Self-check: add ?selftest to the portal URL and open Projects; results go to the console.
let selfTested = false;
function selfTest(s) {
  if (selfTested || !new URLSearchParams(location.search).has('selftest')) return;
  selfTested = true;
  const fake = { id: 'px', start: workDay(-10), due: workDay(10), milestones: [] };
  const base = { ...s.tasks[0], projectId: 'px' };
  console.assert(projectHealth({ ...s, tasks: [] }, fake).level === 'on-track', 'empty project is on track');
  console.assert(projectHealth({ ...s, tasks: [{ ...base, status: 'done' }] }, fake).level === 'done', 'all-done project is complete');
  console.assert(projectHealth({ ...s, tasks: [{ ...base, status: 'todo', due: dt(workDay(-1), '17:00') }] }, fake).level === 'risk', 'overdue task puts project at risk');
  console.assert(projectHealth(s, { ...fake, due: workDay(-1) }).level === 'on-track', 'project with no tasks has nothing to be late on');
  console.info('projects.js self-test done');
}
