// Quick search (Ctrl+K / Cmd+K): pages, projects and tasks the signed-in role may see.

import { isHQ, isOpen, visibleTasks } from './state.js';
import { fmtDue } from './time.js';
import { html, icon, render, openModal, closeModal } from './ui.js';
import { openTaskDetail } from './pages/shared.js';
import { visibleProjects } from './pages/projects.js';
import { ctx } from './ctx.js';

const LIMIT = 8;

function results(s, pages, q) {
  const needle = q.trim().toLowerCase();
  const match = (text) => !needle || text.toLowerCase().includes(needle);
  const out = pages.filter((p) => match(p.label)).map((p) => ({ kind: 'Page', icon: p.icon, label: p.label, go: () => ctx.navigate(p.id) }));
  if (!isHQ(s)) {
    visibleProjects(s)
      .filter((p) => match(p.name))
      .forEach((p) => out.push({ kind: 'Project', icon: 'folder', label: p.name, go: () => ctx.navigate(`projects/${p.id}`) }));
    // Tasks only once the user types, so the empty list stays short.
    if (needle)
      visibleTasks(s)
        .filter((t) => match(`${t.title} ${t.location} ${t.category}`))
        .sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || a.due.localeCompare(b.due)) // open work first
        .forEach((t) => out.push({ kind: 'Task', icon: 'check-square', label: t.title, meta: `Due ${fmtDue(t.due)}`, go: () => openTaskDetail(t.id), keepModal: true }));
  }
  return out.slice(0, LIMIT);
}

/** Open the search dialog. `pages` is [{ id, label, icon }] for pages this role can open. */
export function openSearch(s, pages) {
  openModal(
    html`<header class="modal-head"><h2 id="modal-title">${icon('search', 18)} Search SyncAI</h2>
      <button class="icon-btn" data-action="modal-close" aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body">
      <label class="sr-only" for="qs-input">Search pages, projects and tasks</label>
      <input class="input" id="qs-input" type="search" autocomplete="off" placeholder="Search pages, projects and tasks…" aria-controls="qs-results" aria-describedby="qs-hint" autofocus />
      <p class="muted small mt-sm" id="qs-hint">↑ ↓ to move · Enter to open · Esc to close</p>
      <ul class="qs-results" id="qs-results" aria-live="polite"></ul>
    </div>`,
  );
  const input = document.getElementById('qs-input');
  const list = document.getElementById('qs-results');
  let items = [];
  const draw = () => {
    items = results(s, pages, input.value);
    render(
      list,
      items.length
        ? items.map((r, i) => html`<li><button class="qs-item" data-i="${i}">${icon(r.icon, 16)}<span class="grow">${r.label}${r.meta ? html`<span class="muted small"> · ${r.meta}</span>` : ''}</span><span class="badge badge-neutral">${r.kind}</span></button></li>`)
        : html`<li class="muted small" style="padding:10px 4px">No matches for “${input.value}”.</li>`,
    );
  };
  const open = (i) => {
    const r = items[i];
    if (!r) return;
    if (!r.keepModal) closeModal();
    r.go();
  };
  const buttons = () => [...list.querySelectorAll('.qs-item')];
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') open(0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons()[0]?.focus();
    }
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.qs-item');
    if (b) open(Number(b.dataset.i));
  });
  list.addEventListener('keydown', (e) => {
    const all = buttons();
    const i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') all[i + 1]?.focus();
    else if (e.key === 'ArrowUp') (i > 0 ? all[i - 1] : input).focus();
    else return;
    e.preventDefault();
  });
  draw();
}
