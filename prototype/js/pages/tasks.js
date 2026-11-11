// Tasks Page — Operational Work Tasks + Simulated Microsoft To Do
import { html, raw, icon, priorityBadge, riskBadge, emptyState } from '../ui.js';
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  sampleToDoData,
} from '../data.js';
import { assessRisk } from '../planner.js';
import { accessibleCase } from '../cases.js';
import { CAPTURE_STATUSES, canCapture, taskDateInput, taskDuration } from '../taskCapture.js';
import { deadlineAlert } from '../taskIntelligence.js';
import { traceDownstream, traceUpstream } from '../ripple.js';
import {
  getOfficer,
  getState,
  getTask,
  isOpen,
  isOverdue,
  isManager,
  isAdmin,
  getCurrentUser,
  officerName,
  update,
  visibleTasks,
} from '../state.js';
import { TODAY, NOW, fmtDue, fmtHours, dt, workDay } from '../time.js';

export const tasksView = {
  q: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  tag: '',
  owner: 'all',
  dueDate: '',
  selectedToDoList: 'l1',
  toDoOpen: false,
  page: 1,
  pageSize: 5,
};
const view = tasksView;

export function mountKanban() {}
export function setStatus() {}

export function groupTasks(s, rows, by) {
  const keyOf = {
    status: (t) => t.status,
    priority: (t) => t.priority,
    category: (t) => t.category,
    owner: (t) => t.ownerId,
    project: (t) => t.projectId || '',
  }[by];
  const labelOf = {
    status: (k) => (STATUSES.find((x) => x.id === k) || { label: k }).label,
    priority: (k) => k,
    category: (k) => k,
    owner: (k) => officerName(s, k),
    project: (k) => (s.projects || []).find((p) => p.id === k)?.name || 'No project',
  }[by];
  const order = { status: STATUSES.map((x) => x.id), priority: PRIORITIES, category: CATEGORIES }[by];
  const groups = new Map();
  for (const r of rows) {
    const k = keyOf(r.t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups]
    .map(([key, items]) => ({ key, label: labelOf(key), rows: items }))
    .sort((a, b) => (order ? order.indexOf(a.key) - order.indexOf(b.key) : (a.key === '') - (b.key === '') || a.label.localeCompare(b.label)));
}

export default {
  render(s) {
    const mgr = isManager(s);
    const baseTasks = canCapture(s) ? visibleTasks(s) : [];
    const tags = new Map();
    for (const task of baseTasks) {
      for (const tag of task.tags || []) tags.set(tag.toLowerCase(), tag);
    }
    if (view.tag && !tags.has(view.tag)) tags.set(view.tag, view.tag);

    const totalOpen = baseTasks.filter((t) => isOpen(t)).length;
    const dueToday = baseTasks.filter((t) => isOpen(t) && t.due.slice(0, 10) === TODAY).length;
    const highRisk = baseTasks.filter((t) => isOpen(t) && assessRisk(s, t).level === 'high').length;

    // Filter tasks & pagination
    const filtered = filterTasks(s, baseTasks);
    const totalPages = Math.max(1, Math.ceil(filtered.length / view.pageSize));
    if (view.page > totalPages) view.page = totalPages;
    const startIndex = (view.page - 1) * view.pageSize;
    const paged = filtered.slice(startIndex, startIndex + view.pageSize);

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('tasks', 28)}</span>
        <div class="page-hero-text">
          <h1>My Tasks</h1>
          <p>Create and track SyncAI work orders. Link a task to a case when it is part of a follow-up.</p>
        </div>
        <div class="page-hero-aside">
          <div class="hero-stat">
            <strong>${totalOpen}</strong>
            <span>Active tasks</span>
          </div>
          <div class="hero-stat">
            <strong>${dueToday}</strong>
            <span>Due today</span>
          </div>
          <div class="hero-stat ${highRisk > 0 ? 'hero-stat-warn' : ''}">
            <strong>${highRisk}</strong>
            <span>SLA attention</span>
          </div>
        </div>
      </header>

      <!-- SyncAI Operational Tasks -->
      <section class="panel" aria-labelledby="tasks-h">
        <div class="panel-head">
          <div>
            <h2 id="tasks-h">SyncAI work orders</h2>
            <p class="muted small" style="margin-top: 2px;">
              ${mgr ? 'All team tasks across Zone A, B, and C.' : 'Your assigned operational tasks.'}
            </p>
          </div>
          <div class="panel-tools">
            <button type="button" class="btn-primary btn-sm" data-action="task-create-dialog" ${canCapture(s) ? '' : 'disabled'}>
              ${icon('plus', 14)} Add task
            </button>
          </div>
        </div>

        <!-- Toolbar: Search and Filter Tabs -->
        <div class="toolbar-wrap">
          <div class="filter-tabs" role="group" aria-label="Status filter">
            ${[
              ['all', 'All', baseTasks.length],
              ['open', 'Open', baseTasks.filter((t) => isOpen(t)).length],
              ...CAPTURE_STATUSES.slice(0, 2).map(({ id, label }) => [id, label, baseTasks.filter((t) => t.status === id).length]),
              ['today', 'Today', baseTasks.filter((t) => isOpen(t) && t.due.slice(0, 10) === TODAY).length],
              ['overdue', 'Overdue', baseTasks.filter((t) => isOverdue(t)).length],
              ['risk', 'At risk', baseTasks.filter((t) => isOpen(t) && assessRisk(s, t).level === 'high').length],
              ['done', 'Completed', baseTasks.filter((t) => !isOpen(t)).length],
            ].map(
              ([key, label, count]) => html`
                <button
                  type="button"
                  class="filter-tab ${view.status === key ? 'active' : ''}"
                  aria-pressed="${view.status === key}"
                  data-action="tasks-filter-status"
                  data-status="${key}"
                >
                  ${label} <span class="muted small">(${count})</span>
                </button>
              `,
            )}
          </div>

          <div class="toolbar-actions">
            ${mgr
              ? html`
                  <select
                    class="filter-tab"
                    style="border: 1px solid var(--colorNeutralStroke1); border-radius: 6px;"
                    data-action="tasks-filter-owner"
                    aria-label="Filter by assigned officer"
                  >
                    <option value="all" ${view.owner === 'all' ? 'selected' : ''}>All Officers</option>
                    ${s.officers.map(
                      (o) => html`
                        <option value="${o.id}" ${view.owner === o.id ? 'selected' : ''}>${o.name}</option>
                      `,
                    )}
                  </select>
                `
              : ''}

            <select
              class="filter-tab"
              style="border: 1px solid var(--colorNeutralStroke1); border-radius: 6px;"
              data-action="tasks-filter-category"
              aria-label="Filter by category"
            >
              <option value="all" ${view.category === 'all' ? 'selected' : ''}>All Categories</option>
              ${CATEGORIES.map(
                (c) => html`
                  <option value="${c}" ${view.category === c ? 'selected' : ''}>${c}</option>
                `,
              )}
            </select>
            <select class="capture-filter" data-action="tasks-filter-tag" aria-label="Filter by tag">
              <option value="">All tags</option>
              ${[...tags].sort((a, b) => a[1].localeCompare(b[1])).map(([key, tag]) => html`
                <option value="${key}" ${view.tag === key ? 'selected' : ''}>${tag}</option>`)}
            </select>

            <select class="capture-filter" data-action="tasks-filter-priority" aria-label="Filter by priority">
              <option value="all">All priorities</option>
              ${PRIORITIES.map((priority) => html`<option value="${priority}" ${view.priority === priority ? 'selected' : ''}>${priority}</option>`)}
            </select>
            <label class="capture-date-filter">Due date (SGT)
              <input class="capture-filter" type="date" value="${view.dueDate}" data-action="tasks-filter-date" />
            </label>

            <div class="search-input">
              ${icon('search', 16)}
              <input
                type="search"
                placeholder="Search tasks, locations..."
                value="${view.q}"
                data-action="tasks-search"
                aria-label="Search operational tasks"
              />
            </div>
          </div>
        </div>

        <!-- Table View -->
        ${filtered.length === 0
          ? html`<div class="empty" role="status">${icon('check', 24)}<p>${baseTasks.length ? 'No tasks match the selected filters.' : 'No tasks yet.'}</p></div>`
          : html`
              <div class="table-wrap">
                <table class="data-table capture-table" aria-label="Operational tasks">
                  <thead>
                    <tr>
                      <th>Task title & Location</th>
                      <th>Assigned officer</th>
                      <th style="width: 100px;">Category</th>
                      <th style="width: 120px;">Priority</th>
                      <th style="width: 150px;">Deadline & SLA</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th style="width: 125px; white-space: nowrap;">Risk</th>
                      <th style="text-align: right; width: 80px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paged.map((t) => renderTaskRow(s, t))}
                  </tbody>
                </table>
                <div class="pagination-bar">
                  <span class="pagination-info">
                    Showing ${filtered.length === 0 ? 0 : startIndex + 1}–${Math.min(startIndex + view.pageSize, filtered.length)} of ${filtered.length} tasks
                  </span>
                  ${totalPages > 1
                    ? html`
                        <div class="pagination-controls" role="navigation" aria-label="Tasks pagination">
                          <button
                            type="button"
                            class="pagination-btn"
                            data-action="tasks-page"
                            data-page="${view.page - 1}"
                            ${view.page <= 1 ? 'disabled' : ''}
                            aria-label="Previous page"
                          >
                            ‹ Prev
                          </button>
                          ${Array.from({ length: totalPages }, (_, i) => i + 1).map(
                            (p) => html`
                              <button
                                type="button"
                                class="pagination-btn ${p === view.page ? 'active' : ''}"
                                data-action="tasks-page"
                                data-page="${p}"
                                aria-current="${p === view.page ? 'page' : 'false'}"
                              >
                                ${p}
                              </button>
                            `,
                          )}
                          <button
                            type="button"
                            class="pagination-btn"
                            data-action="tasks-page"
                            data-page="${view.page + 1}"
                            ${view.page >= totalPages ? 'disabled' : ''}
                            aria-label="Next page"
                          >
                            Next ›
                          </button>
                        </div>
                      `
                    : ''}
                </div>
              </div>
            `}
      </section>
      ${renderMicrosoftToDo(s)}
    `;
  },
};

function filterTasks(s, list) {
  return list.filter((t) => {
    if (view.status === 'open' && !isOpen(t)) return false;
    if (['todo', 'in_progress', 'done'].includes(view.status) && t.status !== view.status) return false;
    if (view.status === 'today' && (!isOpen(t) || t.due.slice(0, 10) !== TODAY)) return false;
    if (view.status === 'overdue' && !isOverdue(t)) return false;
    if (view.status === 'risk' && (!isOpen(t) || assessRisk(s, t).level !== 'high')) return false;
    if (view.priority !== 'all' && t.priority !== view.priority) return false;
    if (view.category !== 'all' && t.category !== view.category) return false;
    if (view.tag && !(t.tags || []).some((tag) => tag.toLowerCase() === view.tag)) return false;
    if (view.owner !== 'all' && t.ownerId !== view.owner) return false;
    if (view.dueDate && taskDateInput(t.dueAt || t.due).slice(0, 10) !== view.dueDate) return false;

    if (view.q.trim()) {
      const q = view.q.trim().toLowerCase();
      const match =
        t.title.toLowerCase().includes(q) ||
        (t.location && t.location.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });
}

function renderTaskRow(s, t) {
  const risk = assessRisk(s, t);
  const done = !isOpen(t);
  const relatedCase = accessibleCase(s, t.caseId);
  const deadline = deadlineAlert(t);

  return html`
    <tr class="${done ? 'done-row' : ''}">
      <td>
        <button type="button" class="task-link-btn" data-action="task-inspect" data-id="${t.id}">
          ${t.title}
        </button>
        ${relatedCase ? html`<a class="task-case-link" href="#cases/${relatedCase.id}" aria-label="View case ${relatedCase.number} · ${relatedCase.title}">Case ${relatedCase.number}</a>` : ''}
        ${t.location
          ? html`<span class="small muted" style="display: flex; align-items: center; gap: 4px; margin-top: 3px;">${icon('pin', 12)} ${t.location}</span>`
          : ''}
        ${t.appointmentTime
          ? html`<span class="tag tag-brand small" style="margin-top: 4px;">${t.appointmentTime}</span>`
          : ''}
      </td>
      <td data-label="Assigned officer">${officerName(s, t.ownerId)}</td>
      <td data-label="Category">
        <div class="task-tag-list"><span class="tag tag-brand">${t.category}</span>
          ${(t.tags || []).map((tag) => html`<span class="tag tag-neutral">${tag}</span>`)}
        </div>
      </td>
      <td data-label="Priority">
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
          ${priorityBadge(t.priority)}
          ${t.safety ? html`<span class="tag tag-danger small">Safety</span>` : ''}
          ${t.statutory ? html`<span class="tag tag-warning small">Statutory</span>` : ''}
        </div>
      </td>
      <td data-label="Deadline">
        <span class="due-text" style="display: block;">${fmtDue(taskDateInput(t.dueAt || t.due))}</span>
        ${deadline ? html`<span class="tag tag-${deadline.tone}" title="Demo deadline reminder">${deadline.label}</span>` : ''}
        ${t.slaType ? html`<span class="sla-label muted small" style="display: block; margin-top: 2px;">${t.slaType}</span>` : ''}
      </td>
      <td class="capture-duration" data-label="Duration">${taskDuration(t)} min</td>
      <td data-label="Status">
        <select class="capture-filter" data-action="capture-status" data-id="${t.id}" aria-label="Status for ${t.title}">
          ${t.status === 'review' ? html`<option value="review" selected disabled>In review</option>` : ''}
          ${CAPTURE_STATUSES.map(({ id, label }) => html`<option value="${id}" ${t.status === id ? 'selected' : ''}>${label}</option>`)}
        </select>
      </td>
      <td data-label="Risk">
        ${riskBadge(risk.level)}
      </td>
      <td>
        <div class="capture-row-actions">
          <button type="button" class="btn-secondary btn-sm" data-action="capture-edit" data-id="${t.id}" aria-label="Edit ${t.title}">Edit</button>
          ${t.manualCapture ? html`<button type="button" class="btn-ghost btn-sm" data-action="capture-delete" data-id="${t.id}" aria-label="Delete ${t.title}">Delete</button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

function renderMicrosoftToDo(s) {
  const todoData = s.todo || sampleToDoData();
  const currentListId = view.selectedToDoList || todoData.lists[0].id;
  const currentTasks = todoData.tasks?.[currentListId] || [];

  return html`
    <details class="panel todo-preview" id="todo-preview" ${view.toDoOpen ? 'open' : ''}>
      <summary>Microsoft To Do <span class="tag tag-neutral">Simulated</span></summary>
      <p class="muted small">Preview the fictional Microsoft To Do lists.</p>

      <div class="cal-bar">
        <span class="cal-bar-text">
          <label for="todo-list-select" class="small muted">List:</label>
          <select id="todo-list-select" data-action="todo-select-list">
            ${todoData.lists.map(
              (l) => html`
                <option value="${l.id}" ${l.id === currentListId ? 'selected' : ''}>${l.name}</option>
              `,
            )}
          </select>
        </span>
        <button type="button" class="btn-secondary btn-sm" data-action="todo-refresh">
          ${icon('refresh', 14)} Refresh To Do
        </button>
      </div>

      <ol class="cal-list">
        ${currentTasks.map(
          (item) => html`
            <li class="cal-item ${item.done ? 'todo-done' : ''}">
              <span class="cal-when">
                <time datetime="${item.due}">${fmtDue(item.due)}</time>
                <span>${item.due.slice(11, 16)}</span>
              </span>
              <span class="cal-what">
                <strong>${item.title}</strong>
              </span>
              <span class="cal-meta">
                <span class="tag ${item.importance === 'high' ? 'tag-danger' : 'tag-neutral'}">
                  ${item.importance.toUpperCase()}
                </span>
                <span class="tag ${item.status === 'completed' ? 'tag-success' : 'tag-neutral'}">
                  ${item.status === 'completed' ? 'Completed' : 'In Progress'}
                </span>
              </span>
            </li>
          `,
        )}
      </ol>
    </details>
  `;
}
