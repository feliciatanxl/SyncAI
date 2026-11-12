import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appSource = readFileSync(join(process.cwd(), 'prototype/js/app.js'), 'utf8');
const caseSource = readFileSync(join(process.cwd(), 'prototype/js/pages/cases.js'), 'utf8');
const css = readFileSync(join(process.cwd(), 'prototype/css/style.css'), 'utf8');

test('case workspace controls bubble to delegated click handlers', () => {
  assert.doesNotMatch(caseSource, /onclick="event\.stopPropagation\(\)"/);
  assert.match(appSource, /button\[data-action="case-modal-close"\]/);
  assert.match(appSource, /button\[data-action="case-move-stage-close"\]/);
  assert.match(appSource, /button\[data-action="case-transition-cancel"\]/);
  assert.match(appSource, /data-action="case-journey-tab"/);
});

test('case workspace close button remains visible at compact widths', () => {
  assert.match(css, /\.case-detail-workspace\s*\{[^}]*box-sizing:\s*border-box/s);
  assert.match(css, /\.case-detail-header\s*>\s*\.drawer-close-btn\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)[\s\S]*\.case-detail-main\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test('reassignment replaces the case workspace with a reason dialog', () => {
  const handlerStart = appSource.indexOf("const caseReassignBtn = e.target.closest('[data-action=\"case-reassign-dialog\"]')");
  const modalStart = appSource.indexOf('function showCaseReassignModal');
  assert.ok(handlerStart >= 0);
  assert.ok(modalStart > handlerStart);

  const handler = appSource.slice(handlerStart, modalStart);
  assert.match(handler, /caseView\.selectedCaseId\s*=\s*null/);
  assert.match(handler, /renderApp\(\);\s*showCaseReassignModal/);

  const modal = appSource.slice(modalStart);
  assert.match(modal, /id="reassign-reason-input"/);
  assert.match(modal, /required minlength="4"/);
  assert.match(modal, /aria-label="Close reassignment dialog"/);
});
