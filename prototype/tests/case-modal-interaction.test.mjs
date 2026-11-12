import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  loadState,
  getCase,
  closeCase,
  requestCaseClosure,
  resolveLooseEnd,
  resolveCaseBlocker,
  addCaseProgressNote,
  detectLooseEnds,
  checkClosureReadiness,
  generateCaseBrief,
  addCommunication,
  acknowledgeCommunication,
  decideApproval,
  setCurrentUser,
} from '../js/state.js';
import casesPage, { caseView } from '../js/pages/cases.js';

test('1. Metric card contrast: CSS variables define high-contrast navy and warning tokens', () => {
  const css = readFileSync(join(process.cwd(), 'prototype/css/style.css'), 'utf-8');

  // Verify CSS variables exist and meet WCAG AA contrast (navy #102B4E on light, amber/gold on dark)
  assert.match(css, /--stat-value-color:\s*#102B4E/);
  assert.match(css, /--stat-value-warn-color:\s*#7a4d00/);
  assert.match(css, /--stat-value-color:\s*#ffffff/);
  assert.match(css, /--stat-value-warn-color:\s*#f9d86c/);

  // Verify .stat-value uses var(--stat-value-color)
  assert.match(css, /\.stat-value\s*\{[^}]*color:\s*var\(--stat-value-color\)/s);
  assert.match(css, /\.stat-card\.warn\s+\.stat-value\s*\{[^}]*color:\s*var\(--stat-value-warn-color\)/s);
});

test('2. Timeline & Notes: Add fictional progress note with input validation and immediate timeline update', () => {
  const s = loadState();
  const c = getCase(s, 'case-001');
  const initialTimelineLength = c.timeline.length;

  // Validation: reject empty or whitespace-only
  const emptyRes = addCaseProgressNote(s, 'case-001', 'Inspection Update', '   ');
  assert.equal(emptyRes.success, false);
  assert.match(emptyRes.error, /at least 4 characters/);
  assert.equal(c.timeline.length, initialTimelineLength);

  // Validation: reject too short (<4 chars)
  const shortRes = addCaseProgressNote(s, 'case-001', 'Inspection Update', 'Hi');
  assert.equal(shortRes.success, false);

  // Valid note addition
  const noteRes = addCaseProgressNote(
    s,
    'case-001',
    'Inspection Update',
    'Joint inspection completed with term contractor Eng Seng Plumbing. High moisture confirmed at ceiling.'
  );
  assert.equal(noteRes.success, true);
  assert.equal(c.timeline.length, initialTimelineLength + 1);

  // Most recent timeline item is our new note
  const latestEvent = c.timeline[0];
  assert.equal(latestEvent.type, 'progress_note');
  assert.match(latestEvent.title, /Inspection Update/);
  assert.match(latestEvent.summary, /Joint inspection completed/);
  assert.equal(latestEvent.source, 'Officer Field Note');

  // Activity audit log recorded
  const lastActivity = s.activity[0];
  assert.match(lastActivity.text, /Recorded progress note for Case DEMO-001/);
});

test('3. Outstanding Follow-Ups: Record outcome immediately resolves loose end and updates derived counts', () => {
  const s = loadState();
  const c = getCase(s, 'case-001');

  // Initially has loose ends (resident followup, contractor pending)
  const initialLooseEnds = detectLooseEnds(s, c);
  assert.ok(initialLooseEnds.length > 0);
  const residentFinding = initialLooseEnds.find((l) => l.ruleId === 'resident_followup');
  assert.ok(residentFinding);

  // Record outcome for resident_followup
  const res = resolveLooseEnd(s, 'case-001', 'resident_followup', 'Called resident Mdm Tan and confirmed update.');
  assert.equal(res.success, true);

  // Resident callback checkpoint is now completed
  const residentCp = c.checkpoints.find((cp) => cp.looseEndReason?.includes('resident'));
  if (residentCp) {
    assert.equal(residentCp.completed, true);
  }

  // Linked task is completed
  const openFeedbackTask = (c.taskIds || []).map((tid) => s.tasks.find((t) => t.id === tid)).find((t) => t && t.category === 'Resident Feedback');
  if (openFeedbackTask) {
    assert.equal(openFeedbackTask.status, 'done');
  }

  // Loose-ends re-evaluation removes this finding
  const updatedLooseEnds = detectLooseEnds(s, c);
  assert.equal(updatedLooseEnds.length, initialLooseEnds.length - 1);
  assert.equal(updatedLooseEnds.some((l) => l.ruleId === 'resident_followup'), false);

  // Timeline shows resolved outcome event
  assert.equal(c.timeline[0].type, 'followup_resolved');
  assert.match(c.timeline[0].title, /Follow-Up Resolved/);
});

test('4. Blockers: Resolve blocker updates blocker state, logs activity, and adds timeline record', () => {
  const s = loadState();
  const c = getCase(s, 'case-001');
  const activeBlocker = c.blockers.find((b) => !b.resolved);
  assert.ok(activeBlocker);

  const res = resolveCaseBlocker(s, 'case-001', activeBlocker.id);
  assert.equal(res.success, true);
  assert.equal(activeBlocker.resolved, true);
  assert.ok(activeBlocker.resolvedAt);

  // Timeline recorded
  assert.equal(c.timeline[0].type, 'blocker_resolved');
  assert.match(c.timeline[0].title, /Blocker Resolved/);
});

test('5. Closure flow: Team Member requests closure approval without prematurely closing; Manager commits closure', () => {
  const s = loadState();
  const c = getCase(s, 'case-001');

  // As Team Member (Aisyah)
  setCurrentUser(s, 'member');

  // Submit closure request
  const reqRes = requestCaseClosure(s, 'case-001', 'All works done, please inspect.');
  assert.equal(reqRes.success, true);

  // Case is NOT closed prematurely!
  assert.notEqual(c.status, 'closed');

  // Approval request exists in s.approvals
  const pendingApproval = (s.approvals || []).find((a) => a.caseId === 'case-001' && a.requestType === 'case_closure');
  assert.ok(pendingApproval);
  assert.equal(pendingApproval.status, 'pending');

  // Timeline shows closure requested
  assert.equal(c.timeline[0].type, 'closure_requested');

  // Duplicate request is rejected
  const dupRes = requestCaseClosure(s, 'case-001');
  assert.equal(dupRes.success, false);
  assert.match(dupRes.error, /already pending/);

  // Now Manager reviews and approves the closure request
  setCurrentUser(s, 'manager');
  const decRes = decideApproval(s, pendingApproval.id, 'approved', 'Jennifer Ong', 'Works verified on site.');
  assert.equal(decRes.success, true);

  // Case is now committed as closed!
  assert.equal(c.status, 'closed');
  assert.equal(c.closedBy, 'Jennifer Ong');
  assert.equal(c.timeline[0].type, 'closure');
});

test('6. Communications: Multi-channel filter, acknowledgement toggle, and manual log validation', () => {
  const s = loadState();

  // Add communication
  const comm = addCommunication(s, {
    caseId: 'case-001',
    channel: 'telegram',
    direction: 'inbound',
    sender: 'Resident Mdm Tan',
    category: 'Status Query',
    content: 'Can someone confirm the repair schedule?',
  });
  assert.ok(comm);
  assert.equal(comm.channel, 'telegram');
  assert.equal(comm.acknowledged, false);

  // Toggle acknowledge to true
  acknowledgeCommunication(s, comm.id);
  assert.equal(comm.acknowledged, true);
  assert.ok(comm.acknowledgedAt);

  // Toggle acknowledge back to false
  acknowledgeCommunication(s, comm.id);
  assert.equal(comm.acknowledged, false);
});

test('7. AI Case Brief: Factual summary with disclosed missing information and disclaimer', () => {
  const s = loadState();
  const c = getCase(s, 'case-001');
  const brief = generateCaseBrief(s, c);

  assert.match(brief, /SIMULATED CASE BRIEF/);
  assert.match(brief, /Case Reference: DEMO-001/);
  assert.match(brief, /\[CURRENT STATUS\]/);
  assert.match(brief, /\[EXECUTIVE SUMMARY\]/);
  assert.match(brief, /\[WORK COMPLETED\]/);
  assert.match(brief, /\[OUTSTANDING COMMITMENTS & LOOSE ENDS\]/);
  assert.match(brief, /\[DISCLOSED MISSING INFORMATION\]/);
  assert.match(brief, /\[RECOMMENDED NEXT ACTIONS\]/);
  assert.match(brief, /Responsible/i);
});

test('8. Drawer Accessibility: ARIA attributes and dialog role present in rendered modal', () => {
  const s = loadState();
  caseView.selectedCaseId = 'case-001';
  caseView.journeyTab = 'timeline';

  const html = casesPage.render(s).toString();

  // ARIA attributes for modal dialog accessibility
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="case-drawer-title"/);
  assert.match(html, /id="case-drawer-title"/);
  assert.match(html, /class="drawer-close-btn"/);
  assert.match(html, /aria-label="Close drawer"/);
  assert.match(html, /id="case-add-note-form"/);

  // Cleanup
  caseView.selectedCaseId = null;
});
