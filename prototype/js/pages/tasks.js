import { CATEGORIES, PRIORITIES, STATUSES, sampleMinutes } from '../data.js';
import { extractActionItems, parseNaturalTask, scoreTask } from '../ai.js';
import { assessRisk } from '../planner.js';
import { getOfficer, getState, getTask, isOpen, isOverdue, isSupervisor, logActivity, nextId, officerName, update, visibleTasks } from '../state.js';
import { NOW, fmtDue, fmtHours } from '../time.js';
import { html, icon, render, priorityBadge, riskBadge, sourceTag, emptyState, avatar, toast, openModal, closeModal } from '../ui.js';
import { openTaskForm, scorePill } from './shared.js';
import { ctx } from '../ctx.js';

const view = { q: '', status: 'open', priority: 'all', category: 'all', owner: 'all', sort: 'score', nl: null, nlText: '' };
const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const EXAMPLES = [
  'Urgent: lift fault at Blk 214 trapping resident, today 2pm',
  'Follow up with resident on corridor lights Blk 209 tomorrow, 30 min',
  'Prepare monthly defect summary by Friday, low priority',
];

function filtered(s) {
  const q = view.q.trim().toLowerCase();
  const rows = visibleTasks(s)
    .filter((t) => {
      if (view.status === 'open' && !isOpen(t)) return false;
      if (view.status !== 'open' && view.status !== 'all' && t.status !== view.status) return false;
      if (view.priority !== 'all' && t.priority !== view.priority) return false;
      if (view.category !== 'all' && t.category !== view.category) return false;
      if (view.owner !== 'all' && t.ownerId !== view.owner) return false;
      if (q && !`${t.title} ${t.location} ${t.category} ${t.description} ${officerName(s, t.ownerId)}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .map((t) => ({ t, score: scoreTask(s, t).score }));

  const cmp = {
    score: (a, b) => b.score - a.score,
    due: (a, b) => a.t.due.localeCompare(b.t.due),
    priority: (a, b) => PRIORITY_RANK[a.t.priority] - PRIORITY_RANK[b.t.priority] || b.score - a.score,
    effort: (a, b) => b.t.effort - a.t.effort,
    title: (a, b) => a.t.title.localeCompare(b.t.title),
  }[view.sort];
  return rows.sort(cmp);
}

function listView(s, rows) {
  const sup = isSupervisor(s);
  return html`<div class="table-wrap"><table class="table">
    <caption class="sr-only">Tasks, sorted by ${view.sort}</caption>
    <thead><tr>
      <th style="width:36px"><span class="sr-only">Complete</span></th>
      <th>Task</th>
      ${sup ? html`<th class="hide-sm">Owner</th>` : ''}
      <th>Priority</th>
      <th title="SyncAI priority score (0–100)">AI score</th>
      <th>Due</th>
      <th class="hide-sm">Effort</th>
      <th class="hide-sm">Risk</th>
      <th><span class="sr-only">Actions</span></th>
    </tr></thead>
    <tbody>
      ${rows.map(({ t }) => {
        const risk = assessRisk(s, t);
        const done = !isOpen(t);
        return html`<tr class="${done ? 'done' : ''}">
          <td><button class="complete-btn ${done ? 'is-done' : ''}" data-action="task-toggle" data-id="${t.id}" aria-label="${done ? 'Reopen' : 'Complete'} “${t.title}”" aria-pressed="${done}">${icon('check', 12)}</button></td>
          <td style="min-width:240px">
            <button class="task-title" data-action="task-view" data-id="${t.id}">${t.title}</button>
            <div class="meta">
              <span>${t.category}</span>
              ${t.location ? html`<span>${icon('pin', 12)}${t.location}</span>` : ''}
              ${sourceTag(t.source)}
              ${t.safety ? html`<span class="badge badge-danger" style="padding:0 6px">${icon('shield', 11)}Safety</span>` : ''}
              ${t.dependsOn.length ? html`<span title="Has dependencies">${icon('link', 12)}${t.dependsOn.length}</span>` : ''}
              ${t.status === 'in_progress' ? html`<span class="badge badge-info" style="padding:0 6px">In progress</span>` : ''}
              ${t.status === 'review' ? html`<span class="badge badge-neutral" style="padding:0 6px">In review</span>` : ''}
            </div>
          </td>
          ${sup ? html`<td class="hide-sm"><span class="row">${avatar(officerName(s, t.ownerId), 'sm')}${officerName(s, t.ownerId)}</span></td>` : ''}
          <td>${priorityBadge(t.priority)}</td>
          <td>${done ? '—' : scorePill(s, t)}</td>
          <td style="white-space:nowrap" class="${isOverdue(t) ? 'delta-bad' : ''}">${fmtDue(t.due)}${isOverdue(t) ? html`<div class="small">Overdue</div>` : ''}</td>
          <td class="hide-sm">${fmtHours(t.effort)}</td>
          <td class="hide-sm">${riskBadge(risk.level)}</td>
          <td><div class="cell-actions">
            <button class="icon-btn sm" data-action="task-edit" data-id="${t.id}" aria-label="Edit “${t.title}”">${icon('pencil', 15)}</button>
            <button class="icon-btn sm" data-action="task-delete" data-id="${t.id}" aria-label="Delete “${t.title}”">${icon('trash', 15)}</button>
          </div></td>
        </tr>`;
      })}
    </tbody>
  </table></div>`;
}

function kanbanView(s, rows) {
  const statuses = view.status === 'open' ? STATUSES.filter((x) => x.id !== 'done') : STATUSES;
  return html`<div class="kanban" style="grid-template-columns:repeat(${statuses.length}, minmax(240px, 1fr))">
    ${statuses.map((col) => {
      const items = rows.filter(({ t }) => t.status === col.id);
      return html`<section class="kanban-col" data-status="${col.id}" aria-label="${col.label}">
        <h3>${col.label} <span class="badge badge-neutral">${items.length}</span></h3>
        ${items.map(
          ({ t }) => html`<article class="kanban-card" draggable="true" data-id="${t.id}">
            <div class="row">${priorityBadge(t.priority)}${col.id !== 'done' ? scorePill(s, t) : ''}</div>
            <button class="task-title" data-action="task-view" data-id="${t.id}">${t.title}</button>
            <div class="meta"><span>${icon('clock', 12)}${fmtDue(t.due)}</span><span>${fmtHours(t.effort)}</span>${sourceTag(t.source)}</div>
            ${isSupervisor(s) ? html`<div class="meta">${avatar(officerName(s, t.ownerId), 'sm')}<span>${officerName(s, t.ownerId)}</span></div>` : ''}
            <label class="sr-only" for="st-${t.id}">Move “${t.title}” to</label>
            <select class="select" id="st-${t.id}" data-change="task-status" data-id="${t.id}">
              ${STATUSES.map((x) => html`<option value="${x.id}" ${x.id === t.status ? 'selected' : ''}>${x.label}</option>`)}
            </select>
          </article>`,
        )}
        ${items.length ? '' : html`<p class="muted small" style="text-align:center;padding:16px 0">Drop tasks here</p>`}
      </section>`;
    })}
  </div>`;
}

function results(s) {
  const rows = filtered(s);
  if (!rows.length) {
    const any = visibleTasks(s).length;
    return emptyState(
      'search',
      any ? 'No tasks match these filters' : 'No tasks yet',
      any ? 'Try clearing the search or changing filters.' : 'Create a task or describe one in plain language above.',
      any ? html`<button class="btn" data-action="task-clear-filters">Clear filters</button>` : html`<button class="btn btn-primary" data-action="task-new">${icon('plus', 16)}New task</button>`,
    );
  }
  return html`<p class="sr-only" aria-live="polite">${rows.length} tasks shown</p>${s.prefs.taskView === 'kanban' ? kanbanView(s, rows) : listView(s, rows)}`;
}

function nlPreview(s) {
  if (!view.nl) return '';
  const { task, found } = view.nl;
  return html`<div class="estimate-box mt" style="background:#fff">
    <div class="row wrap"><span class="ai-label">${icon('sparkles', 14)}SyncAI extracted</span><span class="muted small">Review before saving — nothing has been created yet.</span></div>
    <table class="table mt-sm"><thead><tr><th>Field</th><th>Value</th><th>Why</th></tr></thead><tbody>
      <tr><td>Title</td><td><strong>${task.title}</strong></td><td class="muted">Remaining words after removing dates, times and priority cues</td></tr>
      ${found.map((f) => html`<tr><td>${f.field}</td><td><strong>${f.value}</strong></td><td class="muted">${f.why}</td></tr>`)}
      ${isSupervisor(s) && !found.some((f) => f.field === 'Owner') ? html`<tr><td>Owner</td><td><strong>${officerName(s, task.ownerId)}</strong></td><td class="muted">No officer named — add “for &lt;name&gt;” to assign</td></tr>` : ''}
    </tbody></table>
    <div class="row wrap mt-sm">
      <button class="btn btn-primary btn-sm" data-action="nl-create">${icon('check', 14)}Accept & create</button>
      <button class="btn btn-sm" data-action="nl-edit">${icon('pencil', 14)}Modify</button>
      <button class="btn btn-subtle btn-sm" data-action="nl-clear">Dismiss</button>
    </div>
  </div>`;
}

function select(name, label, value, options) {
  return html`<label class="sr-only" for="flt-${name}">${label}</label>
    <select class="select" id="flt-${name}" data-change="task-filter" name="${name}">
      ${options.map(([v, l]) => html`<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`)}
    </select>`;
}

function renderPage(s) {
  const sup = isSupervisor(s);
  const mode = s.prefs.taskView;
  return html`
    <div class="page-head">
      <div><h1>${sup ? 'Team Tasks' : 'My Tasks'}</h1><p>${sup ? 'All officer tasks with AI priority and deadline risk.' : 'Your tasks, ranked and explained by SyncAI.'}</p></div>
      <div class="actions">
        <button class="btn" data-action="minutes-open">${icon('folder', 16)}From meeting minutes</button>
        <button class="btn btn-primary" data-action="task-new">${icon('plus', 16)}New task</button>
      </div>
    </div>

    <section class="card ai-card" aria-labelledby="nl-h">
      <div class="card-body">
        <h2 id="nl-h" class="ai-label" style="font-size:14px">${icon('wand', 16)}Describe a task in plain language</h2>
        <form class="row wrap mt-sm" data-submit="nl-parse" novalidate>
          <label class="sr-only" for="nl-text">Task description</label>
          <input class="input" id="nl-text" name="text" style="flex:1;min-width:240px" maxlength="240" value="${view.nlText}" placeholder="e.g. Urgent: inspect lift fault at Blk 214 tomorrow 10am, about 2h" />
          <button class="btn btn-ai" type="submit">${icon('sparkles', 16)}Extract</button>
        </form>
        <div class="row wrap mt-sm"><span class="muted small">Try:</span>${EXAMPLES.map((e) => html`<button class="chip" data-action="nl-example" data-text="${e}">${e}</button>`)}</div>
        <div id="nl-preview" aria-live="polite">${nlPreview(s)}</div>
      </div>
    </section>

    <section class="card mt" aria-label="Task list">
      <div class="toolbar">
        <div class="search-box">${icon('search', 16)}<label class="sr-only" for="task-q">Search tasks</label><input class="input" id="task-q" type="search" placeholder="Search tasks, blocks, officers…" value="${view.q}" data-input="task-search" /></div>
        ${select('status', 'Status', view.status, [['open', 'Open tasks'], ['all', 'All statuses'], ...STATUSES.map((x) => [x.id, x.label])])}
        ${select('priority', 'Priority', view.priority, [['all', 'All priorities'], ...PRIORITIES.map((p) => [p, p])])}
        ${select('category', 'Category', view.category, [['all', 'All categories'], ...CATEGORIES.map((c) => [c, c])])}
        ${sup ? select('owner', 'Owner', view.owner, [['all', 'All officers'], ...s.officers.map((o) => [o.id, o.name])]) : ''}
        ${select('sort', 'Sort by', view.sort, [['score', 'Sort: AI score'], ['due', 'Sort: Deadline'], ['priority', 'Sort: Priority'], ['effort', 'Sort: Effort'], ['title', 'Sort: Title']])}
        <span class="spacer"></span>
        <div class="segmented" role="group" aria-label="View">
          <button data-action="task-mode" data-mode="list" aria-pressed="${mode === 'list'}">${icon('list', 15)}List</button>
          <button data-action="task-mode" data-mode="kanban" aria-pressed="${mode === 'kanban'}">${icon('columns', 15)}Board</button>
        </div>
      </div>
      <div id="task-results">${results(s)}</div>
    </section>`;
}

function refreshResults() {
  const el = document.getElementById('task-results');
  if (el) {
    render(el, results(getState()));
    mountKanban(el);
  }
}

function mountKanban(root) {
  let dragId = null;
  root.querySelectorAll('.kanban-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  root.querySelectorAll('.kanban-col').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain') || dragId;
      setStatus(id, col.dataset.status);
    });
  });
}

function setStatus(id, status) {
  const t = getTask(getState(), id);
  if (!t || t.status === status || !STATUSES.some((x) => x.id === status)) return;
  update((st) => {
    const x = getTask(st, id);
    x.status = status;
    if (status === 'done') {
      x.completedAt = NOW;
      x.actual = x.actual || Math.max(x.effort, x.spent || 0);
    } else x.completedAt = null;
    logActivity(st, `Moved “${x.title}” to ${STATUSES.find((y) => y.id === status).label}.`);
  });
  toast(`Moved to ${STATUSES.find((y) => y.id === status).label}`);
}

// ---------- meeting minutes → tasks ----------

let minutes = null; // { text, items, selected:Set, owners:{} }

function minutesInput(text = '') {
  return html`<form data-submit="minutes-extract" novalidate>
    <header class="modal-head"><h2 id="modal-title">${icon('folder', 18)} AI meeting-to-task generator</h2>
      <button type="button" class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body stack">
      <p class="muted">Paste meeting minutes or upload a text file. In production these would come from SharePoint / OneDrive with the officer's permission; nothing leaves this browser here.</p>
      <div class="row wrap">
        <label class="btn btn-sm" for="minutes-file">${icon('folder', 14)}Upload .txt or .md</label>
        <input class="sr-only" type="file" id="minutes-file" accept=".txt,.md,text/plain,text/markdown" data-change="minutes-file" />
        <button type="button" class="btn btn-sm" data-action="minutes-sample">Load sample minutes</button>
      </div>
      <div class="field" data-field="minutes">
        <label for="minutes-text">Minutes</label>
        <textarea class="textarea" id="minutes-text" name="text" rows="12" maxlength="20000" style="font-family:var(--mono);font-size:12.5px">${text}</textarea>
        <span class="error-text" id="e-minutes"></span>
      </div>
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-action="modal-close">Cancel</button><button class="btn btn-ai" type="submit">${icon('sparkles', 16)}Extract action items</button></footer>
  </form>`;
}

function minutesReview(s) {
  const sup = isSupervisor(s);
  const me = s.currentOfficerId;
  return html`<header class="modal-head"><h2 id="modal-title">${icon('sparkles', 18)} ${minutes.items.length} action item${minutes.items.length === 1 ? '' : 's'} found</h2>
      <button class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body stack">
      <p class="muted small">Review each suggestion. Untick anything that isn't a real action. ${sup ? 'Choose an owner for unassigned items.' : 'Items for other officers are shown for context — your supervisor imports those.'}</p>
      ${minutes.items.map((it) => {
        const owner = minutes.owners[it.id] || null;
        const mine = sup || owner === me || (!owner && !sup);
        const checked = minutes.selected.has(it.id) && mine;
        return html`<div class="rec">
          <div class="rec-head">
            <input type="checkbox" data-change="minutes-pick" value="${it.id}" ${checked ? 'checked' : ''} ${mine ? '' : 'disabled'} aria-label="Import ${it.task.title}" style="width:18px;height:18px;margin-top:3px" />
            <div class="grow" style="flex:1">
              <div class="rec-title">${it.task.title}</div>
              <div class="meta"><span>Due ${fmtDue(it.task.due)}</span>${priorityBadge(it.task.priority)}<span>${it.task.category}</span><span>${fmtHours(it.task.effort)}</span>${it.task.location ? html`<span>${icon('pin', 12)}${it.task.location}</span>` : ''}</div>
              <p class="why mt-sm">${icon('info', 12)}<span>“${it.source}” — ${it.why}. ${it.found.slice(1).map((f) => `${f.field}: ${f.why.toLowerCase()}`).join('; ')}.</span></p>
            </div>
            ${sup
              ? html`<label class="sr-only" for="own-${it.id}">Owner</label><select class="select" id="own-${it.id}" data-change="minutes-owner" data-item="${it.id}" style="width:auto"><option value="">Choose owner…</option>${s.officers.map((o) => html`<option value="${o.id}" ${o.id === owner ? 'selected' : ''}>${o.name}</option>`)}</select>`
              : html`<span class="badge ${owner === me ? 'badge-brand' : owner ? 'badge-neutral' : 'badge-warning'}">${owner ? (owner === me ? 'You' : getOfficer(s, owner).name) : 'No owner — assigned to you'}</span>`}
          </div>
        </div>`;
      })}
    </div>
    <footer class="modal-foot"><button class="btn" data-action="minutes-back">Back</button><button class="btn btn-primary" data-action="minutes-import">${icon('check', 16)}Create selected tasks</button></footer>`;
}

function extractMinutes(text) {
  const s = getState();
  const items = extractActionItems(s, text, s.currentOfficerId);
  minutes = { text, items, selected: new Set(items.map((i) => i.id)), owners: Object.fromEntries(items.map((i) => [i.id, i.task.ownerId])) };
  if (!items.length) {
    openModal(minutesInput(text), { wide: true });
    const out = document.getElementById('e-minutes');
    if (out) out.textContent = 'No action items found. Lines like “Action: Aisyah to inspect Blk 214 by Friday” work best.';
    return;
  }
  openModal(minutesReview(s), { wide: true });
}

function parse(text) {
  const s = getState();
  view.nlText = text;
  if (text.trim().length < 4) {
    view.nl = null;
    toast('Describe the task in a few more words.', 'error');
    return;
  }
  view.nl = parseNaturalTask(s, text, s.currentOfficerId);
  if (!isSupervisor(s)) view.nl.task.ownerId = s.currentOfficerId;
  render(document.getElementById('nl-preview'), nlPreview(s));
}

export default {
  id: 'tasks',
  title: 'My Tasks',
  titleFor: (s) => (isSupervisor(s) ? 'Team Tasks' : 'My Tasks'),
  icon: 'check-square',
  roles: ['officer', 'supervisor'],
  render: renderPage,
  mount: (root) => mountKanban(root),
  actions: {
    'task-mode': (el) => update((st) => (st.prefs.taskView = el.dataset.mode)),
    'task-clear-filters': () => {
      Object.assign(view, { q: '', status: 'open', priority: 'all', category: 'all', owner: 'all' });
      ctx.rerender();
    },
    'minutes-open': () => openModal(minutesInput(minutes?.text || ''), { wide: true }),
    'minutes-sample': () => {
      const ta = document.getElementById('minutes-text');
      if (ta) ta.value = sampleMinutes();
    },
    'minutes-back': () => openModal(minutesInput(minutes?.text || ''), { wide: true }),
    'minutes-import': () => {
      const s = getState();
      const sup = isSupervisor(s);
      const picked = minutes.items.filter((it) => minutes.selected.has(it.id));
      const ready = picked.filter((it) => (sup ? minutes.owners[it.id] : !minutes.owners[it.id] || minutes.owners[it.id] === s.currentOfficerId));
      if (sup && ready.length < picked.length) return toast('Choose an owner for every selected item.', 'error');
      if (!ready.length) return toast('Select at least one action item.', 'error');
      update((st) => {
        ready.forEach((it) => {
          st.tasks.push({
            id: nextId(st, 't'), description: `From meeting minutes: “${it.source}”`, status: 'todo', spent: 0, dependsOn: [], source: 'SharePoint',
            createdAt: NOW, completedAt: null, actual: null, ...it.task, ownerId: sup ? minutes.owners[it.id] : st.currentOfficerId,
          });
        });
        logActivity(st, `Created ${ready.length} task(s) from meeting minutes.`);
      });
      minutes = null;
      closeModal();
      toast(`${ready.length} task${ready.length > 1 ? 's' : ''} created from the minutes`);
    },
    'nl-example': (el) => {
      const input = document.getElementById('nl-text');
      input.value = el.dataset.text;
      parse(el.dataset.text);
    },
    'nl-clear': () => {
      view.nl = null;
      view.nlText = '';
      const input = document.getElementById('nl-text');
      if (input) input.value = '';
      render(document.getElementById('nl-preview'), '');
    },
    'nl-edit': () => {
      if (!view.nl) return;
      const prefill = { ...view.nl.task };
      view.nl = null;
      view.nlText = '';
      openTaskForm(null, prefill);
    },
    'nl-create': () => {
      if (!view.nl) return;
      const fields = view.nl.task;
      update((st) => {
        st.tasks.push({ id: nextId(st, 't'), description: `Created from: “${view.nlText}”`, status: 'todo', spent: 0, dependsOn: [], source: 'SyncAI', createdAt: NOW, completedAt: null, actual: null, ...fields });
        logActivity(st, `Created “${fields.title}” from natural-language input.`);
      });
      view.nl = null;
      view.nlText = '';
      toast(`Created “${fields.title}”`);
    },
  },
  changes: {
    'task-filter': (el) => {
      view[el.name] = el.value;
      refreshResults();
    },
    'task-status': (el) => setStatus(el.dataset.id, el.value),
    'minutes-pick': (el) => (el.checked ? minutes.selected.add(el.value) : minutes.selected.delete(el.value)),
    'minutes-owner': (el) => (minutes.owners[el.dataset.item] = el.value || null),
    'minutes-file': (el) => {
      const file = el.files?.[0];
      if (!file) return;
      if (file.size > 200 * 1024) return toast('That file is larger than 200 KB. Paste the relevant section instead.', 'error');
      if (!/\.(txt|md)$/i.test(file.name) && !/^text\//.test(file.type)) return toast('Upload a plain-text (.txt or .md) file.', 'error');
      const reader = new FileReader();
      reader.onload = () => {
        const ta = document.getElementById('minutes-text');
        if (ta) ta.value = String(reader.result).slice(0, 20000);
      };
      reader.onerror = () => toast('The file could not be read.', 'error');
      reader.readAsText(file);
    },
  },
  inputs: {
    'task-search': (el) => {
      view.q = el.value;
      refreshResults();
    },
  },
  submits: {
    'nl-parse': (form) => parse(String(new FormData(form).get('text') || '')),
    'minutes-extract': (form) => {
      const text = String(new FormData(form).get('text') || '').trim();
      if (text.length < 20) {
        form.querySelector('[data-field="minutes"]').classList.add('invalid');
        form.querySelector('#e-minutes').textContent = 'Paste the minutes or load the sample first.';
        return;
      }
      extractMinutes(text);
    },
  },
};
