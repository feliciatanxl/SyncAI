// SyncAI prototype shell: routing, navigation, role switching and event
// delegation. Pages are plain modules that return escaped HTML.

import { loadState, getState, subscribe, update, storage, isSupervisor, getOfficer, openTasksFor, isOpen } from './state.js';
import { assessRisk } from './planner.js';
import { TODAY, NOW, fmtDay, fmtTime } from './time.js';
import { html, icon, render, avatar, closeModal, trapFocus, toast } from './ui.js';
import { ctx } from './ctx.js';
import { sharedActions, sharedSubmits } from './pages/shared.js';
import { assistantActions, assistantSubmits, openAssistant, closeAssistant, refreshAssistant } from './pages/assistant.js';
import { alertActions, closeAlerts, refreshAlerts, unreadCount } from './pages/alerts.js';
import dashboard from './pages/dashboard.js';
import tasks from './pages/tasks.js';
import planner from './pages/planner.js';
import team from './pages/team.js';
import insights from './pages/insights.js';
import simulator from './pages/simulator.js';
import settings from './pages/settings.js';

const PAGES = [dashboard, tasks, planner, team, insights, simulator, settings];
const NAV = [
  { section: 'Workspace', ids: ['dashboard', 'tasks', 'planner'] },
  { section: 'Team', ids: ['team', 'simulator'] },
  { section: 'Intelligence', ids: ['insights'] },
  { section: 'System', ids: ['settings'] },
];

let current = dashboard;
const el = (id) => document.getElementById(id);
const allowed = (page, s) => page.roles.includes(s.role);
const pageTitle = (page, s) => (page.titleFor ? page.titleFor(s) : page.title);

function navCounts(s) {
  const mine = isSupervisor(s) ? s.tasks.filter(isOpen) : openTasksFor(s, s.currentOfficerId);
  const risky = mine.filter((t) => assessRisk(s, t).level === 'high').length;
  return { tasks: [mine.length, false], insights: risky ? [risky, true] : null };
}

function renderNav(s) {
  const counts = navCounts(s);
  render(
    el('nav'),
    NAV.map(({ section, ids }) => {
      const pages = ids.map((id) => PAGES.find((p) => p.id === id)).filter((p) => allowed(p, s));
      if (!pages.length) return '';
      return html`<div class="nav-section">${section}</div>
        ${pages.map((p) => {
          const c = counts[p.id];
          return html`<a class="nav-link" href="#/${p.id}" ${p === current ? html`aria-current="page"` : ''} title="${pageTitle(p, s)}">
            ${icon(p.icon, 18)}<span class="nav-label">${pageTitle(p, s)}</span>
            ${c ? html`<span class="nav-count ${c[1] ? 'alert' : ''}" aria-label="${c[0]} ${c[1] ? 'at risk' : 'open'}">${c[0]}</span>` : ''}
          </a>`;
        })}`;
    }),
  );
  const who = isSupervisor(s) ? s.supervisor : getOfficer(s, s.currentOfficerId);
  render(
    el('sidebar-foot'),
    html`<div class="sidebar-user">${avatar(who.name)}<div><strong>${who.name}</strong><span>${isSupervisor(s) ? 'Supervisor' : who.title}</span></div></div>`,
  );
}

function renderTopbar(s) {
  const unread = unreadCount(s);
  render(
    el('topbar-title'),
    html`<strong>${pageTitle(current, s)}</strong><span>Demo clock · ${fmtDay(TODAY)}, ${fmtTime(NOW.slice(11, 16))}</span>`,
  );
  render(
    el('topbar-actions'),
    html`<div class="segmented" role="group" aria-label="Demo role">
        <button data-action="role" data-role="officer" aria-pressed="${s.role === 'officer'}">${icon('user', 14)}<span class="hide-sm">Officer</span></button>
        <button data-action="role" data-role="supervisor" aria-pressed="${s.role === 'supervisor'}">${icon('users', 14)}<span class="hide-sm">Supervisor</span></button>
      </div>
      <button class="icon-btn bell" data-action="alerts-open" aria-label="Alerts, ${unread} unread" aria-controls="alerts">${icon('bell', 18)}${unread ? html`<span class="bell-count" aria-hidden="true">${unread > 9 ? '9+' : unread}</span>` : ''}</button>
      <button class="btn btn-ai" data-action="assistant-open">${icon('sparkles', 16)}<span class="hide-sm">Ask SyncAI</span></button>`,
  );
  render(
    el('demo-banner'),
    html`${icon('info', 14)}<span>Prototype · fictional sample data · AI is simulated with local rules · Microsoft 365 integrations are mock.${storage.notice ? ` ${storage.notice}` : ''}</span>`,
  );
}

function restricted() {
  return html`<section class="card restricted">${html`<div class="empty">
    <div class="empty-icon">${icon('lock', 28)}</div>
    <h3>Supervisor access only</h3>
    <p>${current.title} shows other officers' workload, so it is limited to supervisors. Switch to the Supervisor role in the top bar to explore it in this demo.</p>
    <a class="btn btn-primary" href="#/dashboard">Back to dashboard</a>
  </div>`}</section>`;
}

function renderPage(s) {
  const page = el('page');
  try {
    if (!allowed(current, s)) {
      render(page, restricted());
      return;
    }
    render(page, current.render(s));
    current.mount?.(page, s);
  } catch (err) {
    console.error(err);
    render(
      page,
      html`<section class="card restricted"><div class="empty"><div class="empty-icon">${icon('alert', 28)}</div><h3>Something went wrong</h3>
        <p>This page could not be displayed. Resetting the demo data usually fixes it.</p>
        <button class="btn btn-primary" data-action="reset-demo-hard">Reset demo data</button></div></section>`,
    );
  }
}

function renderAll() {
  const s = getState();
  document.title = `${pageTitle(current, s)} · SyncAI`;
  renderNav(s);
  renderTopbar(s);
  renderPage(s);
  refreshAssistant();
  refreshAlerts();
}

function route() {
  const id = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const next = PAGES.find((p) => p.id === id);
  if (!next) {
    location.replace('#/dashboard');
    return;
  }
  const changed = next !== current;
  current = next;
  closeNav();
  renderAll();
  if (changed) {
    window.scrollTo(0, 0);
    el('page').focus({ preventScroll: true });
  }
}

function openNav() {
  el('app').classList.add('nav-open');
  el('scrim').hidden = false;
  el('nav').querySelector('a')?.focus();
}
function closeNav() {
  el('app').classList.remove('nav-open');
  el('scrim').hidden = true;
}

// ---------- event delegation ----------

const globalActions = {
  ...sharedActions,
  ...assistantActions,
  ...alertActions,
  'modal-close': () => closeModal(),
  'nav-open': () => openNav(),
  'nav-close': () => closeNav(),
  'nav-collapse': () => {
    update((s) => (s.prefs.sidebarCollapsed = !s.prefs.sidebarCollapsed));
    applyCollapse();
  },
  go: (target) => ctx.navigate(target.dataset.page),
  role: (target) => {
    const role = target.dataset.role;
    if (getState().role === role) return;
    update((s) => (s.role = role));
    toast(role === 'supervisor' ? 'Viewing as Jennifer Ong (Supervisor)' : 'Viewing as Aisyah Rahman (Officer)', 'info');
  },
  'reset-demo-hard': () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    location.reload();
  },
};
const globalSubmits = { ...sharedSubmits, ...assistantSubmits };

function applyCollapse() {
  const collapsed = !!getState().prefs.sidebarCollapsed;
  el('app').classList.toggle('collapsed', collapsed);
  const btn = el('collapse-btn');
  btn.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
  btn.setAttribute('aria-expanded', String(!collapsed));
}

function handler(map, name) {
  return current.actions?.[name] || map[name];
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const fn = handler(globalActions, target.dataset.action);
  if (!fn) return;
  if (target.tagName === 'BUTTON' || target.tagName === 'A') e.preventDefault();
  fn(target, e);
});

document.addEventListener('change', (e) => {
  const target = e.target.closest('[data-change]');
  if (!target) return;
  const fn = current.changes?.[target.dataset.change];
  if (fn) fn(target, e);
});

document.addEventListener('input', (e) => {
  const target = e.target.closest('[data-input]');
  if (target) current.inputs?.[target.dataset.input]?.(target, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  const name = form.dataset.submit;
  const fn = current.submits?.[name] || globalSubmits[name];
  fn?.(form, e);
});

document.addEventListener('keydown', (e) => {
  trapFocus(e);
  if (e.key !== 'Escape') return;
  if (!el('modal-root').hidden) closeModal();
  else if (closeAlerts()) return;
  else if (!el('assistant').hidden) closeAssistant();
  else if (el('app').classList.contains('nav-open')) closeNav();
});

// ---------- boot ----------

ctx.rerender = renderAll;
ctx.navigate = (id) => {
  if (location.hash === `#/${id}`) route();
  else location.hash = `#/${id}`;
};
ctx.openAssistant = openAssistant;

loadState();
// Demo links: ?role=supervisor or ?role=officer opens the app in that role.
const roleParam = new URLSearchParams(location.search).get('role');
if ((roleParam === 'supervisor' || roleParam === 'officer') && getState().role !== roleParam) update((s) => (s.role = roleParam));
applyCollapse();
subscribe(renderAll);
window.addEventListener('hashchange', route);
route();
if (storage.notice) toast(storage.notice, 'info');
