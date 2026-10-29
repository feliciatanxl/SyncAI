// SyncAI prototype shell: routing, navigation, sign-in gate and event
// delegation. Pages are plain modules that return escaped HTML.

import { loadState, getState, subscribe, update, storage, isSupervisor, isHQ, getOfficer, openTasksFor, isOpen } from './state.js';
import { COUNCILS } from './data.js';
import { assessRisk } from './planner.js';
import { TODAY, NOW, fmtDay, fmtTime } from './time.js';
import { html, icon, render, avatar, closeModal, trapFocus, toast, expanded } from './ui.js';
import { ctx } from './ctx.js';
import { openSearch } from './search.js';
import { fmtClock, runningTimer } from './timer.js';
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
import projects from './pages/projects.js';
import hub from './pages/hub.js';
import sources from './pages/sources.js';

const PAGES = [hub, dashboard, tasks, projects, planner, team, insights, simulator, sources, settings];
// Bottom tab bar on phones: the four most-used pages for each role, plus Menu.
const TABS = { officer: ['dashboard', 'tasks', 'projects', 'planner'], supervisor: ['dashboard', 'tasks', 'projects', 'team'], hq: ['hub', 'sources'] };
const TAB_LABEL = { dashboard: 'Home', tasks: 'Tasks', projects: 'Projects', planner: 'Planner', team: 'Team', hub: 'Overview', sources: 'Sources' };
const NAV = [
  { section: 'Workspace', ids: ['hub', 'dashboard', 'tasks', 'projects', 'planner'] },
  { section: 'Team', ids: ['team', 'simulator'] },
  { section: 'Intelligence', ids: ['insights'] },
  { section: 'System', ids: ['sources', 'settings'] },
];

// Set by site/login.html. The portal always runs as the signed-in role; without one it sends you to sign in.
const SESSION_KEY = 'syncai.session';
function readSession() {
  try {
    const role = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return ['officer', 'supervisor', 'hq'].includes(role) ? role : null;
  } catch {
    return null;
  }
}
const signedInRole = readSession();

let current = dashboard;
const el = (id) => document.getElementById(id);
const allowed = (page, s) => page.roles.includes(s.role);
const pageTitle = (page, s) => (page.titleFor ? page.titleFor(s) : page.title);
// Top bar and tab title can be more specific than the menu label, e.g. a project's name.
const heading = (page, s) => page.headingFor?.(s) || pageTitle(page, s);

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
  render(
    el('tabbar'),
    html`${TABS[s.role].map((id) => {
      const p = PAGES.find((x) => x.id === id);
      return html`<a href="#/${id}" ${p === current ? html`aria-current="page"` : ''}>${icon(p.icon, 20)}<span>${TAB_LABEL[id]}</span></a>`;
    })}<button data-action="nav-open" aria-controls="sidebar">${icon('menu', 20)}<span>Menu</span></button>`,
  );
  const who = isHQ(s) ? s.hq : isSupervisor(s) ? s.supervisor : getOfficer(s, s.currentOfficerId);
  render(
    el('sidebar-foot'),
    html`<div class="sidebar-user">${avatar(who.name)}<div><strong>${who.name}</strong><span>${isHQ(s) ? 'EMS HQ' : isSupervisor(s) ? 'Supervisor' : who.title}</span></div></div>
      <button class="signout-btn" data-action="sign-out" aria-label="Sign out" title="Sign out">${icon('logout', 16)}<span class="nav-label">Sign out</span></button>`,
  );
}

function renderTopbar(s) {
  const unread = isHQ(s) ? 0 : unreadCount(s);
  render(
    el('topbar-title'),
    html`<strong>${heading(current, s)}</strong><span>${isHQ(s) ? 'All Town Councils' : COUNCILS.find((c) => c.id === s.council).name} · Demo clock · ${fmtDay(TODAY)}, ${fmtTime(NOW.slice(11, 16))}</span>`,
  );
  const timer = isSupervisor(s) || isHQ(s) ? null : runningTimer(s, s.currentOfficerId);
  // HQ sees roll-ups only, so it has no personal alerts or assistant.
  render(
    el('topbar-actions'),
    html`${timer
      ? html`<span class="timer-chip" role="status">
          <span class="timer-dot" aria-hidden="true"></span>
          <button class="timer-title hide-sm" data-action="task-view" data-id="${timer.id}" title="${timer.title}">${timer.title}</button>
          <span class="timer-clock" data-timer-start="${timer.timerStart}" aria-label="Timer running">${fmtClock(Date.now() - timer.timerStart)}</span>
          <button class="icon-btn sm" data-action="timer-stop" data-id="${timer.id}" aria-label="Stop timer for “${timer.title}”" title="Stop timer">${icon('stop', 14)}</button>
        </span>`
      : ''}<button class="icon-btn" data-action="search-open" aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)">${icon('search', 18)}</button>
    ${isHQ(s)
      ? ''
      : html`<button class="icon-btn bell" data-action="alerts-open" aria-label="Alerts, ${unread} unread" aria-controls="alerts">${icon('bell', 18)}${unread ? html`<span class="bell-count" aria-hidden="true">${unread > 9 ? '9+' : unread}</span>` : ''}</button>
      <button class="btn btn-ai" data-action="assistant-open">${icon('sparkles', 16)}<span class="hide-sm">Ask SyncAI</span></button>`}`,
  );
  render(
    el('demo-banner'),
    html`${icon('info', 14)}<span>Prototype · fictional sample data · AI is simulated with local rules · Microsoft 365 integrations are mock.${storage.notice ? ` ${storage.notice}` : ''}</span>`,
  );
}

const ROLE_NAME = { officer: 'Officer', supervisor: 'Supervisor', hq: 'EMS HQ' };

function restricted(s) {
  const hq = isHQ(s);
  const who = current.roles.map((r) => ROLE_NAME[r]).join(' and ');
  return html`<section class="card restricted">${html`<div class="empty">
    <div class="empty-icon">${icon('lock', 28)}</div>
    <h3>${hq ? 'Not available for HQ accounts' : `${who} access only`}</h3>
    <p>${hq
      ? `${current.title} shows individual officers' work. EMS HQ sees council roll-ups only.`
      : `${current.title} is limited to ${who} accounts. Sign out and sign in with one of those accounts to view it.`}</p>
    <a class="btn btn-primary" href="#/">${hq ? 'Back to HQ overview' : 'Back to dashboard'}</a>
  </div>`}</section>`;
}

function renderPage(s) {
  const page = el('page');
  try {
    if (!allowed(current, s)) {
      render(page, restricted(s));
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
  document.title = `${heading(current, s)} · SyncAI`;
  renderNav(s);
  renderTopbar(s);
  renderPage(s);
  refreshAssistant();
  refreshAlerts();
}

function route() {
  // '#/projects/p1' → page 'projects', param 'p1'.
  const [id = isHQ(getState()) ? 'hub' : 'dashboard', param = null] = location.hash.replace(/^#\/?/, '').split('/').map((x) => x || undefined);
  const next = PAGES.find((p) => p.id === id);
  if (!next) {
    location.replace('#/');
    return;
  }
  const changed = next !== current || param !== ctx.param;
  current = next;
  ctx.param = param;
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
  'search-open': () => openSearchDialog(),
  'show-more': (target) => {
    const key = target.dataset.key;
    if (!expanded.delete(key)) expanded.add(key);
    renderAll();
    document.querySelector(`[data-action="show-more"][data-key="${CSS.escape(key)}"]`)?.focus();
  },
  'sign-out': () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    location.href = 'site/login.html';
  },
  'reset-demo-hard': () => {
    try {
      // Keep a remembered sign-in; only the demo data is reset.
      const session = localStorage.getItem(SESSION_KEY);
      localStorage.clear();
      if (session) localStorage.setItem(SESSION_KEY, session);
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

function openSearchDialog() {
  const s = getState();
  openSearch(s, PAGES.filter((p) => allowed(p, s)).map((p) => ({ id: p.id, label: pageTitle(p, s), icon: p.icon })));
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openSearchDialog();
    return;
  }
  trapFocus(e);
  if (e.key !== 'Escape') return;
  if (!el('modal-root').hidden) closeModal();
  else if (closeAlerts()) return;
  else if (!el('assistant').hidden) closeAssistant();
  else if (el('app').classList.contains('nav-open')) closeNav();
});

// ---------- boot ----------

ctx.rerender = renderAll;
// Tick running timer clocks without re-rendering the page.
setInterval(() => {
  document.querySelectorAll('[data-timer-start]').forEach((c) => (c.textContent = fmtClock(Date.now() - Number(c.dataset.timerStart))));
}, 1000);
ctx.navigate = (id) => {
  if (location.hash === `#/${id}`) route();
  else location.hash = `#/${id}`;
};
ctx.openAssistant = openAssistant;

if (!signedInRole) {
  location.replace('site/login.html');
} else {
  loadState();
  if (getState().role !== signedInRole) update((s) => (s.role = signedInRole));
  applyCollapse();
  subscribe(renderAll);
  window.addEventListener('hashchange', route);
  route();
  if (storage.notice) toast(storage.notice, 'info');
}
