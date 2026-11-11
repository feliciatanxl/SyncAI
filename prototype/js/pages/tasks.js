// Tasks Page — Operational Work Tasks + Simulated Microsoft To Do
import { html, raw, icon, priorityBadge, riskBadge, emptyState } from '../ui.js';
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  sampleToDoData,
} from '../data.js';
import { scoreTask } from '../ai.js';
import { assessRisk } from '../planner.js';
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

const view = {
  q: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  owner: 'all',
  selectedToDoList: 'l1',
  toDoBusy: false,
};

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
    const user = getCurrentUser(s);
    const mgr = isManager(s);
    const baseTasks = visibleTasks(s);

    const totalOpen = baseTasks.filter((t) => isOpen(t)).length;
    const dueToday = baseTasks.filter((t) => isOpen(t) && t.due.slice(0, 10) === TODAY).length;
    const highRisk = baseTasks.filter((t) => isOpen(t) && assessRisk(s, t).level === 'high').length;

    // Filter tasks
    const filtered = filterTasks(s, baseTasks);

    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('tasks', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Task Intelligence & Management</p>
          <h1>My Tasks <span class="hero-badge">PS 12i Smart Planner</span></h1>
          <p>
            Ranked by genuine resident safety, statutory compliance and long-term consequences. Compare operational tasks alongside your simulated Microsoft To Do list.
          </p>
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

      <!-- Simulated Microsoft To Do Card -->
      ${renderMicrosoftToDo(s)}

      <!-- SyncAI Operational Tasks -->
      <section class="panel" aria-labelledby="tasks-h">
        <div class="panel-head">
          <div>
            <h2 id="tasks-h">SyncAI Operational Work Orders</h2>
            <p class="muted small" style="margin-top: 2px;">
              ${mgr ? 'All team tasks across Zone A, B, and C.' : 'Your assigned operational tasks.'}
            </p>
          </div>
          <div class="panel-tools">
            <button type="button" class="btn-primary btn-sm" data-action="task-create-dialog">
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
              ['today', 'Today', baseTasks.filter((t) => isOpen(t) && t.due.slice(0, 10) === TODAY).length],
              ['overdue', 'Overdue', baseTasks.filter((t) => isOverdue(t)).length],
              ['risk', 'At risk', baseTasks.filter((t) => isOpen(t) && assessRisk(s, t).level === 'high').length],
              ['done', 'Done', baseTasks.filter((t) => !isOpen(t)).length],
            ].map(
              ([key, label, count]) => html`
                <button
                  type="button"
                  class="filter-tab ${view.status === key ? 'active' : ''}"
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
            >
              <option value="all" ${view.category === 'all' ? 'selected' : ''}>All Categories</option>
              ${CATEGORIES.map(
                (c) => html`
                  <option value="${c}" ${view.category === c ? 'selected' : ''}>${c}</option>
                `,
              )}
            </select>

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
          ? html`<div class="empty">${icon('check', 24)}<p>No tasks match the selected filters.</p></div>`
          : html`
              <div class="table-wrap">
                <table class="data-table" aria-label="Operational tasks">
                  <thead>
                    <tr>
                      <th style="width: 38px;">Done</th>
                      <th>Task title & Location</th>
                      ${mgr ? html`<th>Owner</th>` : ''}
                      <th>Category</th>
                      <th>Priority</th>
                      <th title="SyncAI Consequence-Aware Priority Score (0–100)">AI Score</th>
                      <th>Deadline & SLA</th>
                      <th>Risk</th>
                      <th style="text-align: right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((t) => renderTaskRow(s, t, mgr))}
                  </tbody>
                </table>
              </div>
            `}
      </section>
    `;
  },
};

function filterTasks(s, list) {
  return list.filter((t) => {
    if (view.status === 'open' && !isOpen(t)) return false;
    if (view.status === 'today' && (!isOpen(t) || t.due.slice(0, 10) !== TODAY)) return false;
    if (view.status === 'overdue' && !isOverdue(t)) return false;
    if (view.status === 'risk' && (!isOpen(t) || assessRisk(s, t).level !== 'high')) return false;
    if (view.status === 'done' && isOpen(t)) return false;

    if (view.priority !== 'all' && t.priority !== view.priority) return false;
    if (view.category !== 'all' && t.category !== view.category) return false;
    if (view.owner !== 'all' && t.ownerId !== view.owner) return false;

    if (view.q) {
      const q = view.q.toLowerCase();
      const match =
        t.title.toLowerCase().includes(q) ||
        (t.location && t.location.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });
}

function renderTaskRow(s, t, mgr) {
  const scored = scoreTask(s, t);
  const risk = assessRisk(s, t);
  const done = !isOpen(t);
  const scoreClass = scored.score >= 70 ? 'hi' : scored.score >= 40 ? 'md' : 'lo';

  return html`
    <tr class="${done ? 'done-row' : ''}">
      <td>
        <input
          type="checkbox"
          ${done ? 'checked' : ''}
          data-action="task-toggle"
          data-id="${t.id}"
          aria-label="Toggle completion for ${t.title}"
        />
      </td>
      <td>
        <button type="button" class="task-link-btn" data-action="task-inspect" data-id="${t.id}">
          ${t.title}
        </button>
        ${t.location
          ? html`<span class="small muted" style="display: block;">${icon('pin', 12)} ${t.location}</span>`
          : ''}
        ${t.appointmentTime
          ? html`<span class="tag tag-brand" style="margin-top: 4px;">${t.appointmentTime}</span>`
          : ''}
      </td>
      ${mgr
        ? html`
            <td>
              <span class="small">${officerName(s, t.ownerId)}</span>
            </td>
          `
        : ''}
      <td>
        <span class="tag tag-neutral">${t.category}</span>
      </td>
      <td>
        ${priorityBadge(t.priority)}
        ${t.safety ? html`<span class="tag tag-danger" style="margin-left: 4px;">Safety</span>` : ''}
        ${t.statutory ? html`<span class="tag tag-warning" style="margin-left: 4px;">Statutory</span>` : ''}
      </td>
      <td>
        <span class="score-pill ${scoreClass}">
          ${scored.score}
        </span>
      </td>
      <td>
        <span class="small">${fmtDue(t.due)}</span>
        ${t.slaType ? html`<span class="small muted" style="display: block;">${t.slaType}</span>` : ''}
      </td>
      <td>
        ${riskBadge(risk.level)}
      </td>
      <td style="text-align: right; white-space: nowrap;">
        <button
          type="button"
          class="btn-subtle btn-sm"
          data-action="task-inspect"
          data-id="${t.id}"
          title="Inspect AI score, dependencies and consequences"
        >
          Inspect
        </button>
      </td>
    </tr>
  `;
}

function renderMicrosoftToDo(s) {
  const todoData = s.todo || sampleToDoData();
  const currentListId = view.selectedToDoList || todoData.lists[0].id;
  const currentTasks = todoData.tasks?.[currentListId] || [];

  return html`
    <section class="panel cal-panel" aria-labelledby="todo-h">
      <div class="cal-head">
        <span class="card-icon" aria-hidden="true">${icon('check-square', 24)}</span>
        <div class="cal-head-text">
          <h2 id="todo-h">Microsoft To Do (Simulated Integration)</h2>
          <p class="muted">
            Reads personal and flagged tasks from Microsoft Graph. Tasks here run independently from Town Council work orders.
          </p>
        </div>
        <span class="tag tag-brand">Demo data — no live Microsoft connection</span>
      </div>

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
      <p class="cal-foot small muted">
        Demo data — Microsoft Graph read-only simulation. Changes do not alter live Microsoft 365 accounts.
      </p>
    </section>
  `;
}
