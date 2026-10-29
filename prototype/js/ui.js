// Rendering helpers. `html` escapes every interpolated value unless it was
// produced by `html` itself or wrapped in `raw`, so user-entered text can
// never inject markup.

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

export const raw = (s) => new Raw(String(s));

export function escapeHtml(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return String(v); // for aria-pressed / aria-expanded
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  return escapeHtml(v);
}

export function html(strings, ...vals) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < vals.length) out += fmt(vals[i]);
  });
  return new Raw(out);
}

export function render(el, content) {
  el.innerHTML = fmt(content);
}

// ----- icons (paths adapted from Lucide, ISC licence) -----

const ICONS = {
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  'check-square': '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  sparkles: '<path d="M9.94 14.06 4 12l5.94-2.06L12 4l2.06 5.94L20 12l-5.94 2.06L12 20z"/><path d="M19 3v4M17 5h4"/>',
  flask: '<path d="M10 2v7.31L4.2 19.1A2 2 0 0 0 6 22h12a2 2 0 0 0 1.8-2.9L14 9.3V2"/><path d="M8.5 2h7M7 16h10"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M15 3v18"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  wand: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
};

export function icon(name, size = 18, cls = '') {
  return raw(
    `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`,
  );
}

// ----- small components -----

export function avatar(name, size = 'md') {
  const parts = name.split(/\s+/);
  const ini = (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return html`<span class="avatar avatar-${size}" style="--avatar-h:${h}" aria-hidden="true">${ini}</span>`;
}

const PRIORITY_CLASS = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'neutral' };
export function priorityBadge(p) {
  return html`<span class="badge badge-${PRIORITY_CLASS[p] || 'neutral'}"><span class="dot" aria-hidden="true"></span>${p}</span>`;
}

const RISK = { high: ['danger', 'High risk'], medium: ['warning', 'Medium risk'], low: ['success', 'On track'], none: ['neutral', 'Done'] };
export function riskBadge(level) {
  const [cls, label] = RISK[level] || RISK.low;
  return html`<span class="badge badge-${cls}">${icon(level === 'low' || level === 'none' ? 'check' : 'alert', 12)}${label}</span>`;
}

const STATUS_CLASS = { over: 'danger', near: 'warning', ok: 'success', spare: 'brand', away: 'neutral' };
export function capacityBadge(status) {
  return html`<span class="badge badge-${STATUS_CLASS[status.id]}"><span class="dot" aria-hidden="true"></span>${status.label}</span>`;
}

export function sourceTag(source) {
  return html`<span class="source source-${source.replace(/\s+/g, '').toLowerCase()}" title="Source: ${source}">${source}</span>`;
}

export function pct(v) {
  return v == null || !isFinite(v) ? '—' : `${Math.round(v * 100)}%`;
}

export function meter(value, { label = '', thresholds = [0.85, 1] } = {}) {
  const v = value == null ? 0 : value;
  const cls = v > thresholds[1] ? 'danger' : v >= thresholds[0] ? 'warning' : 'success';
  return html`<div class="meter meter-${cls}" role="meter" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${Math.round(v * 100)}" aria-label="${label}">
    <span style="width:${Math.min(v, 1.5) / 1.5 * 100}%"></span><i style="left:${100 / 1.5}%" aria-hidden="true"></i>
  </div>`;
}

export function emptyState(iconName, title, body, action = '') {
  return html`<div class="empty">
    <div class="empty-icon">${icon(iconName, 28)}</div>
    <h3>${title}</h3>
    <p>${body}</p>
    ${action}
  </div>`;
}

// ----- show more, filter tabs, pager -----

// Lists the user has expanded with "Show more", by key. Kept for the session so re-renders don't collapse them.
export const expanded = new Set();
export const limitTo = (key, items, n) => (expanded.has(key) ? items : items.slice(0, n));

/** "Show all (12)" / "Show less" toggle for a list cut by limitTo. Handled by the global `show-more` action. */
export function showMore(key, total, n, noun = 'items') {
  if (total <= n) return '';
  const open = expanded.has(key);
  return html`<div class="show-more"><button class="btn btn-subtle btn-sm" data-action="show-more" data-key="${key}" aria-expanded="${open}">
    ${open ? 'Show less' : `Show all ${total} ${noun}`}</button></div>`;
}

/** Row of filter tabs with counts. Each tab is a toggle button with data-value; `action` handles the click. */
export function filterTabs(action, label, tabs, active) {
  return html`<div class="filter-tabs" role="group" aria-label="${label}">
    ${tabs.map(([value, text, count]) => html`<button data-action="${action}" data-value="${value}" aria-pressed="${value === active}">
      ${text}${count == null ? '' : html`<span class="tab-count">${count}</span>`}</button>`)}
  </div>`;
}

/** Numbered pages with previous / next. `page` is 1-based; clicks send data-page to `action`. */
export function pager(action, page, pages, label = 'Pages') {
  if (pages <= 1) return '';
  const btn = (p, text, aria, disabled = false) =>
    html`<button class="pager-btn" data-action="${action}" data-page="${p}" aria-label="${aria}" ${p === page && !disabled ? html`aria-current="page"` : ''} ${disabled ? 'disabled' : ''}>${text}</button>`;
  return html`<nav class="pager" aria-label="${label}">
    ${btn(page - 1, '‹', 'Previous page', page === 1)}
    ${Array.from({ length: pages }, (_, i) => btn(i + 1, String(i + 1), `Page ${i + 1}`))}
    ${btn(page + 1, '›', 'Next page', page === pages)}
  </nav>`;
}

// ----- toasts -----

export function toast(message, kind = 'success') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = fmt(html`${icon(kind === 'error' ? 'alert' : kind === 'info' ? 'info' : 'check', 16)}<span>${message}</span>`);
  host.appendChild(el);
  setTimeout(() => el.classList.add('leaving'), 3600);
  setTimeout(() => el.remove(), 4000);
}

// ----- modal dialog -----

let lastFocus = null;

export function openModal(content, { wide = false, onClose } = {}) {
  closeModal();
  lastFocus = document.activeElement;
  const root = document.getElementById('modal-root');
  root.innerHTML = fmt(html`<div class="modal-backdrop" data-action="modal-close"></div>
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${content}</div>`);
  root.hidden = false;
  root._onClose = onClose;
  const first =
    root.querySelector('[autofocus]') ||
    root.querySelector('input:not([type="hidden"]), select, textarea, button:not([data-action="modal-close"])');
  (first || root.querySelector('.modal')).focus();
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root || root.hidden) return;
  root.hidden = true;
  root.innerHTML = '';
  if (root._onClose) root._onClose();
  root._onClose = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openModal(
      html`<header class="modal-head"><h2 id="modal-title">${title}</h2></header>
      <div class="modal-body"><p>${body}</p></div>
      <footer class="modal-foot">
        <button class="btn" data-confirm="no">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm="yes" autofocus>${confirmLabel}</button>
      </footer>`,
      { onClose: () => !answered && resolve(false) },
    );
    document.getElementById('modal-root').querySelectorAll('[data-confirm]').forEach((b) =>
      b.addEventListener('click', () => {
        answered = true;
        closeModal();
        resolve(b.dataset.confirm === 'yes');
      }),
    );
  });
}

/** Keep keyboard focus inside the open modal. */
export function trapFocus(e) {
  const root = document.getElementById('modal-root');
  if (root.hidden || e.key !== 'Tab') return;
  const items = [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}
