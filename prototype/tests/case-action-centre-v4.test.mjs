// Test Suite: Case Action Centre V4 — Content Layout, Spacing & Readability
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSeedState } from '../js/data.js';
import casesPage, { caseView, fmtCompactDeadline } from '../js/pages/cases.js';
import {
  getCases,
  getCase,
  detectLooseEnds,
  setCurrentUser,
} from '../js/state.js';

test('V4 Header: Clean structure with dedicated title row, badge cluster, and no clustered text', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  const rendered = casesPage.render(s).toString();

  assert.match(rendered, /case-action-hero/);
  assert.match(rendered, /case-hero-title-row/);
  assert.match(rendered, /case-hero-badges/);
  assert.match(rendered, /Property Officer Workspace/);
  assert.match(rendered, /Fictional Demo Environment/);
  assert.match(rendered, /case-hero-description/);
  assert.match(rendered, /Proactively detects unresolved resident follow-ups/);
});

test('V4 Compact Deadlines: Formats Singapore timestamps into compact readable date strings', () => {
  const formatted = fmtCompactDeadline('2026-11-11T17:00');
  assert.equal(formatted, '11 Nov 2026 · 5:00 PM');

  const morning = fmtCompactDeadline('2026-11-12T09:30');
  assert.equal(morning, '12 Nov 2026 · 9:30 AM');

  const s = createSeedState();
  setCurrentUser(s, 'member');
  const rendered = casesPage.render(s).toString();

  assert.match(rendered, /deadline-item/);
  assert.match(rendered, /deadline-label/);
  assert.match(rendered, /deadline-val/);
  assert.match(rendered, /Response due/);
});

test('V4 Follow-Up Radar: Redesigned internal card layout with distinct Header, Explanation, Evidence, and Actions', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  const rendered = casesPage.render(s).toString();

  // Radar panel structure
  assert.match(rendered, /radar-panel/);
  assert.match(rendered, /radar-panel-header/);
  assert.match(rendered, /radar-header-title-group/);
  assert.match(rendered, /radar-header-icon/);
  assert.match(rendered, /radar-filter-bar/);
  assert.match(rendered, /radar-filter-tabs/);
  assert.match(rendered, /radar-grid/);

  // Radar card internal sections
  assert.match(rendered, /loose-end-card/);
  assert.match(rendered, /radar-card-header/);
  assert.match(rendered, /radar-card-top-row/);
  assert.match(rendered, /radar-case-link/);
  assert.match(rendered, /radar-card-title/);
  assert.match(rendered, /radar-card-explanation/);
  assert.match(rendered, /Why it matters:/);
  assert.match(rendered, /radar-card-evidence/);
  assert.match(rendered, /radar-evidence-label/);
  assert.match(rendered, /Supporting Record:/);
  assert.match(rendered, /radar-evidence-value/);
  assert.match(rendered, /radar-card-actions/);
  assert.match(rendered, /radar-btn-explain/);
  assert.match(rendered, /Why was this flagged\?/);
  assert.match(rendered, /radar-btn-act/);
  assert.match(rendered, /Take Action/);
});

test('V4 Filter Toolbar: Two-row structured toolbar with status tabs, search, and visible dropdown labels', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  const rendered = casesPage.render(s).toString();

  assert.match(rendered, /case-toolbar-container/);
  assert.match(rendered, /case-toolbar-row-primary/);
  assert.match(rendered, /case-status-tabs/);
  assert.match(rendered, /case-toolbar-row-secondary/);
  assert.match(rendered, /case-filter-search/);
  assert.match(rendered, /case-filter-dropdowns/);
  assert.match(rendered, /Estate \/ Block:/);
  assert.match(rendered, /Urgency:/);
});

test('V4 Case Table: Clear column order with mobile data-label attributes for responsive stacked cards', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  const rendered = casesPage.render(s).toString();

  // Column order in header
  assert.match(rendered, /Case \/ Location/);
  assert.match(rendered, /Category/);
  assert.match(rendered, /Status/);
  assert.match(rendered, /Assigned Officer/);
  assert.match(rendered, /Deadlines \(SGT\)/);
  assert.match(rendered, /Actions/);

  // Data labels for mobile stacked card transformation
  assert.match(rendered, /data-label="Case \/ Location"/);
  assert.match(rendered, /data-label="Category"/);
  assert.match(rendered, /data-label="Status"/);
  assert.match(rendered, /data-label="Assigned officer"/);
  assert.match(rendered, /data-label="Deadlines \(SGT\)"/);
  assert.match(rendered, /data-label="Actions"/);
});

test('V4 CSS & Responsive Rules: Style definitions exist for V4 layout, cards, and media queries', () => {
  const css = readFileSync(join(process.cwd(), 'prototype/css/style.css'), 'utf-8');

  // Hero banner & cards
  assert.match(css, /\.case-action-hero/);
  assert.match(css, /\.case-overview-grid/);
  assert.match(css, /\.case-stat-card/);

  // Radar & internal cards
  assert.match(css, /\.radar-grid/);
  assert.match(css, /\.loose-end-card/);
  assert.match(css, /\.radar-card-header/);
  assert.match(css, /\.radar-card-explanation/);
  assert.match(css, /\.radar-card-evidence/);
  assert.match(css, /\.radar-card-actions/);

  // Table & mobile card transformation
  assert.match(css, /\.case-table/);
  assert.match(css, /\.case-cell-primary/);
  assert.match(css, /\.case-table\s+td\[data-label\]::before/);

  // Media queries
  assert.match(css, /@media\s*\(max-width:\s*1024px\)/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
});
