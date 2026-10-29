// Shared application state with localStorage persistence. Every page reads
// from the same object so dashboards, tasks, plans and simulations agree.

import { createSeedState, DATA_VERSION } from './data.js';
import { TODAY, NOW } from './time.js';

const STORAGE_KEY = 'syncai.prototype.state';

let state = null;
let revCounter = 0;
const listeners = new Set();

export const storage = { ok: true, notice: null };

/** Give a state object a fresh revision so memoised calculations recompute. */
export function bumpRev(s) {
  s.rev = ++revCounter;
  return s;
}

export function loadState() {
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    storage.ok = false;
    storage.notice = 'Browser storage is unavailable, so changes will not be kept after you close this tab.';
  }
  if (saved && saved.version === DATA_VERSION && saved.seededFor === TODAY) {
    state = saved;
  } else {
    state = createSeedState();
    if (saved) storage.notice = 'Demo data was refreshed so dates line up with today.';
    persist();
  }
  return bumpRev(state);
}

function persist() {
  if (!storage.ok) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storage.ok = false;
    storage.notice = 'Could not save to browser storage. Changes will be lost on reload.';
  }
}

export const getState = () => state;

/** Apply a mutation, persist, and re-render subscribers. */
export function update(mutator) {
  mutator(state);
  bumpRev(state);
  persist();
  listeners.forEach((fn) => fn(state));
}

export function replaceState(next) {
  state = next;
  bumpRev(state);
  persist();
  listeners.forEach((fn) => fn(state));
}

export function resetState() {
  const keepRole = state?.role;
  state = createSeedState();
  if (keepRole) state.role = keepRole;
  bumpRev(state);
  persist();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function nextId(s, prefix = 't') {
  s.nextId += 1;
  return `${prefix}${s.nextId}`;
}

export function logActivity(s, text, actor) {
  s.activity.unshift({ at: NOW, actor: actor || actorName(s), text });
  s.activity = s.activity.slice(0, 40);
}

// ----- selectors -----

export const isSupervisor = (s) => s.role === 'supervisor';
export const isHQ = (s) => s.role === 'hq';

export function actorName(s) {
  return isSupervisor(s) ? s.supervisor.name : getOfficer(s, s.currentOfficerId).name;
}

export function getOfficer(s, id) {
  return s.officers.find((o) => o.id === id);
}

export function officerName(s, id) {
  return getOfficer(s, id)?.name || 'Unassigned';
}

export function getTask(s, id) {
  return s.tasks.find((t) => t.id === id);
}

export const isOpen = (t) => t.status !== 'done';

export function openTasksFor(s, officerId) {
  return s.tasks.filter((t) => t.ownerId === officerId && isOpen(t));
}

/** Tasks the current role is allowed to see. Officers only see their own. */
export function visibleTasks(s) {
  return isSupervisor(s) ? s.tasks : s.tasks.filter((t) => t.ownerId === s.currentOfficerId);
}

export function meetingsFor(s, officerId, date) {
  return s.meetings
    .filter((m) => m.ownerIds.includes(officerId) && (!date || m.date === date))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function availabilityOn(officer, date) {
  return officer.availability?.[date] || null;
}

export const isUnavailable = (officer, date) => !!availabilityOn(officer, date);

/** Absence labels never reveal medical details. */
export function absenceLabel(kind, supervisorView) {
  if (!kind) return '';
  if (!supervisorView) return 'Unavailable';
  return { mc: 'Medical leave', leave: 'Annual leave', training: 'Training', sim: 'Unavailable (simulated)' }[kind] || 'Unavailable';
}

export function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export const remainingHours = (t) => Math.max(t.effort - (t.spent || 0), 0.25);

export const isOverdue = (t) => isOpen(t) && t.due < NOW;
