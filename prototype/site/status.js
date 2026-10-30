// HTTP status code pages: status.html lists every code, status.html?code=NNN shows one.

import { CLASSES, CODES, findCode } from './status-codes.js';

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

const link = (c) => `status.html?code=${c.code}`;

function showCode(param) {
  const view = $('[data-view="code"]');
  const c = findCode(param);
  view.hidden = false;
  if (!c) {
    $('[data-num]', view).textContent = '?';
    $('[data-name]', view).textContent = 'Unknown status code';
    $('[data-summary]', view).textContent = `"${param}" is not a registered HTTP status code.`;
    $('[data-class]', view).hidden = true;
    document.title = 'Unknown status code · SyncAI';
    return;
  }
  const cls = CLASSES[c.cls];
  view.dataset.tone = cls.tone;
  $('[data-num]', view).textContent = c.code;
  $('[data-name]', view).textContent = c.name;
  $('[data-summary]', view).textContent = c.summary;
  $('[data-blurb]', view).textContent = `${c.cls}xx ${cls.name}: ${cls.blurb}${c.note ? ` Not part of core HTTP (${c.note}).` : ''}`;
  const badge = $('[data-class]', view);
  badge.className = `badge badge-${cls.tone}`;
  badge.textContent = `${c.cls}xx · ${cls.name}`;
  document.title = `${c.code} ${c.name} · SyncAI`;

  const i = CODES.indexOf(c);
  for (const [sel, other, arrow] of [['[data-prev]', CODES[i - 1], '←'], ['[data-next]', CODES[i + 1], '→']]) {
    if (!other) continue;
    const a = $(sel, view);
    a.hidden = false;
    a.href = link(other);
    a.textContent = arrow === '←' ? `← ${other.code} ${other.name}` : `${other.code} ${other.name} →`;
  }
}

function showList() {
  $('[data-view="list"]').hidden = false;
  const groups = $('[data-groups]');
  const jump = $('[data-jump]');

  for (const [n, cls] of Object.entries(CLASSES)) {
    const codes = CODES.filter((c) => c.cls === Number(n));
    jump.append(el('a', { className: `badge badge-${cls.tone}`, href: `#class-${n}`, textContent: `${n}xx ${cls.name}` }));
    const cards = codes.map((c) => {
      const card = el(
        'a',
        { className: 'status-card', href: link(c) },
        el('span', { className: 'status-card-num', textContent: c.code }),
        el('strong', { textContent: c.name }),
        el('span', { className: 'status-card-sum', textContent: c.summary }),
        ...(c.note ? [el('span', { className: 'badge badge-neutral', textContent: c.note })] : []),
      );
      card.dataset.search = `${c.code} ${c.name}`.toLowerCase();
      return card;
    });
    const section = el(
      'section',
      { className: 'status-group', id: `class-${n}` },
      el('h2', { textContent: `${n}xx ${cls.name}` }),
      el('p', { className: 'status-blurb', textContent: cls.blurb }),
      el('div', { className: 'status-grid' }, ...cards),
    );
    section.dataset.tone = cls.tone;
    groups.append(section);
  }

  $('#status-filter').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let shown = 0;
    for (const section of groups.children) {
      let inGroup = 0;
      for (const card of $('.status-grid', section).children) {
        card.hidden = !card.dataset.search.includes(q);
        if (!card.hidden) inGroup++;
      }
      section.hidden = !inGroup;
      shown += inGroup;
    }
    $('[data-empty]').hidden = shown > 0;
  });
}

const code = new URLSearchParams(location.search).get('code');
if (code) showCode(code);
else showList();
