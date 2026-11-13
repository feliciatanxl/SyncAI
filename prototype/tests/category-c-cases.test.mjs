import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeedState } from '../js/data.js';
import casesPage, { caseView } from '../js/pages/cases.js';
import {
  getCases,
  getCase,
  detectLooseEnds,
  checkClosureReadiness,
  generateCaseBrief,
  closeCase,
  requestCaseReassignment,
  setCurrentUser,
  visibleCases,
  decideApproval,
} from '../js/state.js';

test('Category C: Case Action Centre renders role-aware views', () => {
  const s = createSeedState();

  // 1. Member view (Aisyah)
  setCurrentUser(s, 'member');
  const memberHtml = casesPage.render(s).toString();
  assert.match(memberHtml, /Case Action Centre/);
  assert.match(memberHtml, /Property Officer/);
  assert.match(memberHtml, /Operational Loose-End Detector/);
  assert.match(memberHtml, /Fictional demo cases/);

  // 2. Manager view (Jennifer)
  setCurrentUser(s, 'manager');
  const managerHtml = casesPage.render(s).toString();
  assert.match(managerHtml, /Manager Workspace/);
  assert.match(managerHtml, /Follow-Up Radar/);

  // 3. Admin view (Alex Tan) - governance only, no operational resident casework
  setCurrentUser(s, 'admin');
  const adminHtml = casesPage.render(s).toString();
  assert.match(adminHtml, /Operational Governance/);
  assert.match(adminHtml, /Admin Summary/);
  assert.match(adminHtml, /Data Minimisation Policy/);
  assert.doesNotMatch(adminHtml, /Ceiling seepage at Blk 211/);

  // 4. Inactive accounts (David, Siti) - access restricted
  setCurrentUser(s, 'pending');
  assert.match(casesPage.render(s).toString(), /Restricted/);
  setCurrentUser(s, 'disabled');
  assert.match(casesPage.render(s).toString(), /Restricted/);
});

test('Category C: Loose-End Detector finds unfulfilled operational commitments', () => {
  const s = createSeedState();
  setCurrentUser(s, 'manager');
  const c = getCase(s, 'case-001');
  assert.ok(c, 'case-001 exists');

  const looseEnds = detectLooseEnds(s, c);
  assert.ok(Array.isArray(looseEnds));
  // case-001 has resident follow-up and missing document loose ends
  assert.ok(looseEnds.length > 0, 'Should detect loose ends');
  for (const end of looseEnds) {
    assert.ok(end.title, 'Each finding has a title');
    assert.ok(end.explanation, 'Each finding explains why it matters');
    assert.ok(end.sourceEvidence, 'Each finding cites source evidence');
    assert.ok(end.suggestedAction, 'Each finding suggests a next action');
  }
});

test('Category C: Closure Readiness Checker validates required checkpoints', () => {
  const s = createSeedState();
  const c = getCase(s, 'case-001');

  // Initially incomplete checkpoints prevent normal closure
  setCurrentUser(s, 'member');
  const closeResult = closeCase(s, 'case-001');
  assert.equal(closeResult.success, false, 'Incomplete case should not close for member');
  assert.ok(closeResult.error, 'Returns helpful closure blockage error');

  // Readiness checker output
  const readiness = checkClosureReadiness(s, c);
  assert.equal(readiness.isReady, false);
  assert.ok(readiness.unresolvedItems.length > 0);
});

test('Category C: AI Case Brief template generates factual simulated summary', () => {
  const s = createSeedState();
  const c = getCase(s, 'case-001');
  const brief = generateCaseBrief(s, c);

  assert.match(brief, /SIMULATED CASE BRIEF/);
  assert.match(brief, /Ceiling seepage at Blk 211/);
  assert.match(brief, /CURRENT STATUS/);
  assert.match(brief, /OUTSTANDING COMMITMENTS & LOOSE ENDS/);
  assert.match(brief, /RECOMMENDED NEXT ACTIONS/);
});

test('Category C: Reassignment request connects to Approvals workflow', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');
  const approval = requestCaseReassignment(s, 'case-001', 'o3', 'Workload balancing');
  assert.ok(approval, 'Creates approval request');
  assert.equal(approval.requestType, 'reassign');

  // Manager approves
  setCurrentUser(s, 'manager');
  decideApproval(s, approval.id, 'approve', 'Jennifer Ong');
  const updatedCase = getCase(s, 'case-001');
  assert.equal(updatedCase.ownerId, 'o3', 'Case ownership transferred on manager approval');
});
