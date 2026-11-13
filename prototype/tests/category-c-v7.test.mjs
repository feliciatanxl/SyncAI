// Category C V7 Comprehensive Test Suite
// Covers:
// 1. #021 — Smart Deadline Countdown (SGT local time, overdue/due soon/upcoming/none, clock injection)
// 2. #024 + #029 — Assignee History and Task Change Comparison (snapshots, requester/approver, task sync, empty state)
// 3. #027 — Evidence Attachments & Verification (metadata, validation, manager-only verification, closure readiness)
// 4. Human-Readable AI Case Brief (dynamic zone derivation, missing-field fallback, copy button compatibility)
// 5. Accessible Modals & 7-Step Closure Sign-Off Workflow

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  loadState,
  getCase,
  getTasks,
  getCurrentUser,
  setCurrentUser,
  requestCaseReassignment,
  decideApproval,
  requestCaseStageTransition,
  canTransitionCase,
  getOfficerZone,
  generateCaseBrief,
  getStructuredCaseBrief,
  getCaseEvidence,
  addCaseEvidence,
  verifyCaseEvidence,
  getEvidenceTypeLabel,
  recordCaseChange,
  getCaseChangeHistory,
  getCaseAssigneeHistory,
  syncDeadlineNotifications,
  checkClosureReadiness,
  detectLooseEnds,
} from '../js/state.js';
import { getDeadlineCountdown, TODAY } from '../js/time.js';
import { createSeedState } from '../js/data.js';
import casesPage, { caseView, renderDeadlineBadge } from '../js/pages/cases.js';

const appSource = readFileSync(join(process.cwd(), 'prototype/js/app.js'), 'utf8');
const caseSource = readFileSync(join(process.cwd(), 'prototype/js/pages/cases.js'), 'utf8');
const css = readFileSync(join(process.cwd(), 'prototype/css/style.css'), 'utf8');

// ============================================================================
// 1. #021 — Smart Deadline Countdown Engine
// ============================================================================

test('#021: Smart Deadline Countdown calculates overdue, due soon, upcoming, and none states with clock injection', () => {
  const fixedNow = '2026-11-13T08:30:00+08:00';

  // 1. Overdue (> 0 ms in past)
  const pastTarget = '2026-11-13T06:30:00+08:00'; // 2 hours ago
  const overdueRes = getDeadlineCountdown(pastTarget, fixedNow);
  assert.equal(overdueRes.isOverdue, true);
  assert.equal(overdueRes.state, 'overdue');
  assert.match(overdueRes.text, /Overdue by 2 hours/i);

  // 2. Due soon (< 24 hours in future)
  const soonTarget = '2026-11-13T12:30:00+08:00'; // 4 hours later
  const soonRes = getDeadlineCountdown(soonTarget, fixedNow);
  assert.equal(soonRes.isDueSoon, true);
  assert.equal(soonRes.state, 'due_soon');
  assert.match(soonRes.text, /Due in 4 hours/i);

  // 3. Due tomorrow (< 48 hours in future)
  const tomorrowTarget = '2026-11-14T14:00:00+08:00';
  const tomorrowRes = getDeadlineCountdown(tomorrowTarget, fixedNow);
  assert.equal(tomorrowRes.isDueSoon, true);
  assert.match(tomorrowRes.text, /Due tomorrow/i);

  // 4. Upcoming (>= 48 hours in future)
  const upcomingTarget = '2026-11-17T08:30:00+08:00'; // 4 days later
  const upcomingRes = getDeadlineCountdown(upcomingTarget, fixedNow);
  assert.equal(upcomingRes.isUpcoming, true);
  assert.equal(upcomingRes.state, 'upcoming');
  assert.match(upcomingRes.text, /Due in 4 days/i);

  // 5. None / Invalid target
  const noneRes = getDeadlineCountdown(null, fixedNow);
  assert.equal(noneRes.state, 'none');
  assert.equal(noneRes.text, 'No deadline recorded');
});

test('#021: Singapore SGT local time offset parsing works deterministically', () => {
  const sgtClock = '2026-11-13T14:00:00';
  const targetWithOffset = '2026-11-13T17:00:00+08:00';
  const res = getDeadlineCountdown(targetWithOffset, `${sgtClock}+08:00`);
  assert.equal(res.isDueSoon, true);
  assert.match(res.text, /Due in 3 hours/i);
});

test('#021: renderDeadlineBadge generates accessible badges with standard classes', () => {
  const overdueBadge = renderDeadlineBadge({ state: 'overdue', isOverdue: true, text: 'Overdue by 2 hours' }).toString();
  assert.match(overdueBadge, /deadline-badge-overdue/);
  assert.match(overdueBadge, /Overdue by 2 hours/);

  const soonBadge = renderDeadlineBadge({ state: 'due_soon', isDueSoon: true, text: 'Due in 3 hours' }).toString();
  assert.match(soonBadge, /deadline-badge-soon/);
  assert.match(soonBadge, /Due in 3 hours/);

  const noneBadge = renderDeadlineBadge({ state: 'none', isNone: true, text: 'No deadline recorded' }).toString();
  assert.match(noneBadge, /deadline-badge-none/);
});

// ============================================================================
// 2. #024 + #029 — Assignee History and Task Change Comparison
// ============================================================================

test('#024: Empty state displays "No previous reassignment recorded." when case has no history', () => {
  const s = createSeedState();
  const c = getCase(s, 'case-003');
  c.changeHistory = [];

  const history = getCaseAssigneeHistory(s, 'case-003');
  assert.equal(history.length, 0);

  caseView.selectedCaseId = 'case-003';
  caseView.journeyTab = 'history';
  const rendered = casesPage.render(s).toString();
  assert.match(rendered, /No previous reassignment recorded\./);
  caseView.selectedCaseId = null;
});

test('#024: requestCaseReassignment records pending change snapshot in case changeHistory', () => {
  const s = createSeedState();
  setCurrentUser(s, 'o1'); // Aisyah Rahman

  const c = getCase(s, 'case-001');
  const prevOwnerId = c.ownerId; // o1

  const approval = requestCaseReassignment(s, 'case-001', 'o2', 'Covering inspection during emergency plumbing surge');
  assert.ok(approval, 'Approval request created');

  const history = getCaseAssigneeHistory(s, 'case-001');
  assert.ok(history.length > 0, 'Change history contains reassignment');
  const record = history[0];
  assert.equal(record.changeType, 'reassignment');
  assert.equal(record.approvalStatus, 'pending');
  assert.equal(record.before.assigneeId, prevOwnerId);
  assert.equal(record.after.assigneeId, 'o2');
  assert.match(record.reason, /emergency plumbing surge/i);
});

test('#024 + #029: Manager approval synchronizes case owner AND linked task owners with change audit', () => {
  const s = createSeedState();
  setCurrentUser(s, 'o1'); // requester
  const approval = requestCaseReassignment(s, 'case-001', 'o2', 'Workload rebalance');

  // Manager Jennifer Ong approves
  setCurrentUser(s, 'manager');
  const res = decideApproval(s, approval.id, 'approved', 'Jennifer Ong', 'Authorized handover for Zone B coverage.');
  assert.equal(res.success, true);
  assert.equal(res.status, 'approved');

  // 1. Case owner synchronized to o2
  const c = getCase(s, 'case-001');
  assert.equal(c.ownerId, 'o2');

  // 2. Linked tasks synchronized to o2
  const linkedTasks = (s.tasks || []).filter((t) => t.caseId === 'case-001');
  assert.ok(linkedTasks.length > 0);
  for (const t of linkedTasks) {
    assert.equal(t.ownerId, 'o2', `Task ${t.id} owner must sync to o2`);
  }

  // 3. Change history record marked approved with decidedAt and approver
  const changeRecord = c.changeHistory.find((ch) => ch.approvalId === approval.id);
  assert.ok(changeRecord);
  assert.equal(changeRecord.approvalStatus, 'approved');
  assert.equal(changeRecord.approver, 'Jennifer Ong');
  assert.ok(changeRecord.decidedAt);
  assert.equal(changeRecord.decisionNote, 'Authorized handover for Zone B coverage.');
});

test('#024: Manager rejection preserves original owner and updates audit status', () => {
  const s = createSeedState();
  setCurrentUser(s, 'o1');
  const approval = requestCaseReassignment(s, 'case-001', 'o2', 'Routine handover');

  setCurrentUser(s, 'manager');
  const res = decideApproval(s, approval.id, 'rejected', 'Jennifer Ong', 'Declined: Officer o2 is currently at capacity.');
  assert.equal(res.success, true);
  assert.equal(res.status, 'rejected');

  const c = getCase(s, 'case-001');
  assert.equal(c.ownerId, 'o1', 'Owner must remain original officer o1');

  const changeRecord = c.changeHistory.find((ch) => ch.approvalId === approval.id);
  assert.ok(changeRecord);
  assert.equal(changeRecord.approvalStatus, 'rejected');
  assert.equal(changeRecord.decisionNote, 'Declined: Officer o2 is currently at capacity.');
});

// ============================================================================
// 3. #027 — Evidence Attachments & Verification Engine
// ============================================================================

test('#027: Seed evidence data contains required rich metadata across cases', () => {
  const s = createSeedState();
  const c1 = getCase(s, 'case-001');
  assert.ok(Array.isArray(c1.evidence));
  assert.ok(c1.evidence.length >= 2);

  const e1 = c1.evidence[0];
  assert.equal(e1.caseId, 'case-001');
  assert.equal(e1.status, 'verified');
  assert.equal(e1.verified, true);
  assert.ok(e1.fileSize);
  assert.ok(e1.uploadedBy);
  assert.ok(e1.verifiedBy);
});

test('#027: addCaseEvidence validates title and adds pending evidence record', () => {
  const s = createSeedState();
  setCurrentUser(s, 'u1');

  // Short title rejected
  const failRes = addCaseEvidence(s, 'case-001', { title: 'ab' });
  assert.equal(failRes.success, false);
  assert.match(failRes.error, /at least 3 characters/i);

  // Valid evidence added
  const okRes = addCaseEvidence(s, 'case-001', {
    title: 'Moisture Meter Wall Penetration Scan',
    type: 'inspection_report',
    fileSize: '2.1 MB',
    description: 'Joint wall scan reading showing 18% moisture level.',
  });
  assert.equal(okRes.success, true);
  assert.equal(okRes.evidence.status, 'pending_review');
  assert.equal(okRes.evidence.verified, false);
  assert.equal(okRes.evidence.typeLabel, 'Inspection Report');

  const evidenceList = getCaseEvidence(s, 'case-001');
  assert.ok(evidenceList.some((e) => e.title === 'Moisture Meter Wall Penetration Scan'));
});

test('#027: verifyCaseEvidence enforces manager-only authorization', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member'); // Team Member

  addCaseEvidence(s, 'case-001', {
    title: 'Test Contractor Memo',
    type: 'completion_record',
  });
  const evi = getCaseEvidence(s, 'case-001').find((e) => e.title === 'Test Contractor Memo');

  // Team member tries to verify -> DENIED
  const memberRes = verifyCaseEvidence(s, 'case-001', evi.id, 'verify', 'Aisyah Rahman');
  assert.equal(memberRes.success, false);
  assert.match(memberRes.error, /Only authorized Estate Managers/i);

  // Manager verifies -> GRANTED
  setCurrentUser(s, 'manager'); // Manager Jennifer Ong
  const mgrRes = verifyCaseEvidence(s, 'case-001', evi.id, 'verify', 'Jennifer Ong', 'Verified against site contractor invoice.');
  assert.equal(mgrRes.success, true);
  assert.equal(mgrRes.status, 'verified');
  assert.equal(evi.verified, true);
  assert.equal(evi.verifiedBy, 'Jennifer Ong');
});

test('#027: verifyCaseEvidence rejection requires minimum 4 characters reason', () => {
  const s = createSeedState();
  setCurrentUser(s, 'manager'); // Manager

  addCaseEvidence(s, 'case-001', {
    title: 'Blurry Handheld Photo',
    type: 'photo',
  });
  const evi = getCaseEvidence(s, 'case-001').find((e) => e.title === 'Blurry Handheld Photo');

  // Short rejection note fails
  const shortFail = verifyCaseEvidence(s, 'case-001', evi.id, 'reject', 'Jennifer Ong', 'bad');
  assert.equal(shortFail.success, false);
  assert.match(shortFail.error, /minimum 4 characters/i);

  // Valid rejection succeeds
  const okReject = verifyCaseEvidence(s, 'case-001', evi.id, 'reject', 'Jennifer Ong', 'Photo is blurred and lacks date/timestamp metadata.');
  assert.equal(okReject.success, true);
  assert.equal(evi.status, 'rejected');
  assert.equal(evi.verified, false);
  assert.equal(evi.rejectedBy, 'Jennifer Ong');
  assert.match(evi.rejectionReason, /blurred/i);
});

// ============================================================================
// 4. Human-Readable AI Case Brief & Zone Derivation
// ============================================================================

test('AI Case Brief: getOfficerZone derives dynamic officer zone from team estate coverage', () => {
  const s = createSeedState();
  const c1 = getCase(s, 'case-001'); // owner: u1 (Aisyah Rahman) -> Team East -> Bedok South -> Zone A
  const c2 = getCase(s, 'case-002'); // owner: u2 (Tan Wei Ming) -> Team West -> Jurong West -> Zone B

  const zone1 = getOfficerZone(s, c1.ownerId, c1);
  const zone2 = getOfficerZone(s, c2.ownerId, c2);

  assert.equal(zone1, 'Zone A');
  assert.equal(zone2, 'Zone B');
});

test('AI Case Brief: missing responsibleParty falls back safely to "Responsible party not yet recorded."', () => {
  const s = createSeedState();
  const c = getCase(s, 'case-001');
  c.blockers = [
    {
      id: 'b-test-1',
      title: 'Upper floor resident unavailable',
      resolved: false,
      responsibleParty: '', // missing
    },
  ];

  const brief = generateCaseBrief(s, c);
  assert.match(brief, /Responsible party not yet recorded\./);

  const structured = getStructuredCaseBrief(s, c);
  assert.equal(structured.activeBlockers[0].responsibleParty, 'Responsible party not yet recorded.');
});

test('AI Case Brief: distinguishes verified completion vs unverified on-site recording', () => {
  const s = createSeedState();
  const c = getCase(s, 'case-001');

  const structured = getStructuredCaseBrief(s, c);
  assert.ok(structured.completedWork.length > 0);
  for (const item of structured.completedWork) {
    assert.ok(typeof item.isVerified === 'boolean');
    assert.ok(item.note.includes('Verified') || item.note.includes('on-site') || item.note.includes('system'));
  }
});

// ============================================================================
// 5. Accessible Modals & 7-Step Closure Sign-Off Workflow
// ============================================================================

test('Modals: Move Stage modal provides guided cards and "Request Approval" for manager sign-off', () => {
  const s = createSeedState();
  setCurrentUser(s, 'u1'); // Team Member

  caseView.moveStageModalCaseId = 'case-001';
  const modalHtml = casesPage.render(s).toString();

  // Dialog semantics
  assert.match(modalHtml, /role="dialog"/);
  assert.match(modalHtml, /aria-labelledby="move-stage-title"/);
  assert.match(modalHtml, /Move Case to Stage/);

  // Closed stage for team member requires manager sign-off: button says "Request Approval"
  assert.match(modalHtml, /Request Approval/);

  // Clean up
  caseView.moveStageModalCaseId = null;
});

test('Modals: 7-step readable workflow renders in Transition / Closure Sign-Off modal', () => {
  const s = createSeedState();
  setCurrentUser(s, 'u1');

  // Trigger closure transition modal
  caseView.transitionModal = {
    caseId: 'case-001',
    currentStage: 'ready_for_closure',
    targetStage: 'closed',
    requiresApproval: true,
  };

  const modalHtml = casesPage.render(s).toString();

  // Step 1: Case Summary
  assert.match(modalHtml, /transition-step-summary/);
  assert.match(modalHtml, /DEMO-001/);

  // Step 2: Stage Progression
  assert.match(modalHtml, /transition-step-progression/);
  assert.match(modalHtml, /Current Stage/);
  assert.match(modalHtml, /Target Stage/);

  // Step 3: Statutory & Compliance Justification Banner
  assert.match(modalHtml, /Manager Sign-Off Required/);

  // Step 4: Checklist & Prerequisites Inspection
  assert.match(modalHtml, /transition-step-requirements/);
  assert.match(modalHtml, /Prerequisites &amp; Statutory Checklist/);

  // Step 5: Auditable Memo / Reason Input
  assert.match(modalHtml, /id="case-transition-reason-input"/);

  // Step 6: Post-Submission Explanation
  assert.match(modalHtml, /transition-step-post-submission/);
  assert.match(modalHtml, /Post-Submission Effect/);

  // Step 7: Action Controls
  assert.match(modalHtml, /data-action="case-transition-confirm"/);
  assert.match(modalHtml, /Submit for Approval/);
  assert.match(modalHtml, /data-action="case-transition-cancel"/);

  // Clean up
  caseView.transitionModal = null;
});

// ============================================================================
// 6. UI & CSS Integrity
// ============================================================================

test('CSS: Integrity of required selectors and media queries preserved', () => {
  // Category C V7 additions
  assert.match(css, /\.deadline-badge\s*\{/);
  assert.match(css, /\.deadline-badge-overdue\s*\{/);
  assert.match(css, /\.evidence-card\s*\{/);
  assert.match(css, /\.before-after-grid\s*\{/);

  // Existing modal control assertions
  assert.match(css, /\.case-detail-workspace\s*\{[^}]*box-sizing:\s*border-box/s);
  assert.match(css, /\.case-detail-header\s*>\s*\.drawer-close-btn\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)[\s\S]*\.case-detail-main\s*\{[^}]*grid-template-columns:\s*1fr/);
});
