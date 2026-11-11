// Automated Test Suite — Category C: Task Visibility & Case Action Centre
import test from 'node:test';
import assert from 'node:assert/strict';

import { createSeedState } from '../js/data.js';
import {
  getCases,
  getCase,
  visibleCases,
  detectLooseEnds,
  checkClosureReadiness,
  generateCaseBrief,
  closeCase,
  requestCaseReassignment,
  decideApproval,
  getTask,
  setCurrentUser,
} from '../js/state.js';

import casesPage, { caseView } from '../js/pages/cases.js';

test('1. Role-based Case Visibility & Boundary Enforcement', () => {
  const s = createSeedState();

  // A. Team Member (Aisyah o1): Only sees own assigned cases
  setCurrentUser(s, 'member');
  const memberCases = visibleCases(s);
  assert.ok(memberCases.length > 0, 'Member should see assigned cases');
  assert.equal(memberCases.length, 4, 'Aisyah should have exactly 4 assigned cases in seed data');
  for (const c of memberCases) {
    assert.equal(c.ownerId, 'o1', `Case ${c.caseNumber} must belong to o1`);
  }

  // B. Manager (Jennifer s1): Sees cases for supervised team members
  setCurrentUser(s, 'manager');
  const managerCases = visibleCases(s);
  assert.equal(managerCases.length, 7, 'Manager should see all 7 team cases');
  assert.ok(managerCases.some((c) => c.ownerId === 'o1'), 'Manager sees Zone A cases');
  assert.ok(managerCases.some((c) => c.ownerId === 'o2'), 'Manager sees Zone B cases');

  // C. Admin (Alex Tan a1): Data minimisation guardrail — zero operational resident casework
  setCurrentUser(s, 'admin');
  const adminCases = visibleCases(s);
  assert.equal(adminCases.length, 0, 'Admin must not have access to individual casework PII');

  // D. Pending & Disabled accounts: Zero operational access
  setCurrentUser(s, 'pending');
  assert.equal(visibleCases(s).length, 0, 'Pending user must not see operational cases');

  setCurrentUser(s, 'disabled');
  assert.equal(visibleCases(s).length, 0, 'Disabled user must not see operational cases');
});

test('2. Operational Loose-End Detector: 8 Deterministic Rule Verifications', () => {
  const s = createSeedState();

  // Rule 1 & Rule 8: CASE-2026-0814 (Ceiling Seepage)
  // Has unfulfilled resident callback & approaching tenant appointment
  const seepageCase = getCase(s, 'CASE-2026-0814');
  assert.ok(seepageCase, 'Seepage case must exist');
  const seepageEnds = detectLooseEnds(s, seepageCase);
  assert.ok(seepageEnds.length >= 2, 'Seepage case should detect resident callback and tenant appointment');
  const hasCallbackEnd = seepageEnds.some((e) => e.ruleId === 'resident_followup');
  const hasApptEnd = seepageEnds.some((e) => e.ruleId === 'unconfirmed_appointment');
  assert.ok(hasCallbackEnd, 'Rule 1: Resident follow-up promised must be flagged');
  assert.ok(hasApptEnd, 'Rule 8: Approaching unconfirmed repair appointment must be flagged');

  // Rule 2: CASE-2026-0822 (Corridor Lighting) — Contractor quotation pending > 3 days
  const lightingCase = getCase(s, 'CASE-2026-0822');
  const lightingEnds = detectLooseEnds(s, lightingCase);
  const hasContractorEnd = lightingEnds.some((e) => e.ruleId === 'contractor_pending');
  assert.ok(hasContractorEnd, 'Rule 2: Contractor response pending past threshold must be flagged');

  // Rule 3: CASE-2026-0819 (Lift Vibration) — Inspection completed without documented findings
  const liftCase = getCase(s, 'CASE-2026-0819');
  const liftEnds = detectLooseEnds(s, liftCase);
  const hasInspectionEnd = liftEnds.some((e) => e.ruleId === 'inspection_outcome');
  assert.ok(hasInspectionEnd, 'Rule 3: Inspection without documented outcome must be flagged');

  // Rule 4: CASE-2026-0825 (Refuse Chute Hopper) — Stale case > 48h without update
  const chuteCase = getCase(s, 'CASE-2026-0825');
  const chuteEnds = detectLooseEnds(s, chuteCase);
  const hasStaleEnd = chuteEnds.some((e) => e.ruleId === 'stale_case');
  assert.ok(hasStaleEnd, 'Rule 4: Inactive case > 48h must be flagged');

  // Rule 5 & Rule 6: CASE-2026-0834 (Roof Waterproofing) — Missing evidence & closure requested with incomplete checkpoints
  const roofCase = getCase(s, 'CASE-2026-0834');
  const roofEnds = detectLooseEnds(s, roofCase);
  const hasEvidenceEnd = roofEnds.some((e) => e.ruleId === 'missing_evidence');
  const hasClosureEnd = roofEnds.some((e) => e.ruleId === 'unresolved_closure');
  assert.ok(hasEvidenceEnd, 'Rule 5: Missing supporting evidence must be flagged');
  assert.ok(hasClosureEnd, 'Rule 6: Premature closure with open checkpoints must be flagged');

  // Rule 7: CASE-2026-0841 (Spalling Concrete) — Unacknowledged reassignment handover
  const spallingCase = getCase(s, 'CASE-2026-0841');
  const spallingEnds = detectLooseEnds(s, spallingCase);
  const hasHandoverEnd = spallingEnds.some((e) => e.ruleId === 'pending_handover');
  assert.ok(hasHandoverEnd, 'Rule 7: Reassignment without completed handover must be flagged');

  // Verify structure of detections
  for (const end of seepageEnds) {
    assert.ok(end.caseNumber, 'Finding must specify caseNumber');
    assert.ok(end.title, 'Finding must have title');
    assert.ok(end.explanation, 'Finding must explain why it matters');
    assert.ok(end.sourceEvidence, 'Finding must cite source evidence or field');
    assert.ok(end.suggestedAction, 'Finding must suggest actionable next step');
    assert.ok(end.severity, 'Finding must have severity rating');
  }
});

test('3. Case Journey Intelligence: Chronological Timeline & Evidence Tracking', () => {
  const s = createSeedState();
  const c = getCase(s, 'CASE-2026-0814');

  assert.ok(c.timeline && c.timeline.length > 0, 'Case must have timeline events');
  const eventTypes = new Set(c.timeline.map((e) => e.type));
  assert.ok(eventTypes.has('reported'), 'Must track case reported event');
  assert.ok(eventTypes.has('inspection'), 'Must track inspection event');
  assert.ok(eventTypes.has('assignment'), 'Must track assignment event');

  // Check chronological order capability
  const sorted = [...c.timeline].sort((a, b) => (a.at > b.at ? 1 : -1));
  assert.equal(sorted[0].type, 'reported', 'First event in chronological sequence must be initial reported');
});

test('4. Closure Readiness Checker: Enforces Prerequisite Checkpoints', () => {
  const s = createSeedState();

  // Test Case A: CASE-2026-0834 (Incomplete prerequisites)
  const incompleteCase = getCase(s, 'CASE-2026-0834');
  const readinessIncomplete = checkClosureReadiness(s, incompleteCase);
  assert.equal(readinessIncomplete.isReady, false, 'Case with unresolved checkpoints must NOT be ready');
  assert.ok(readinessIncomplete.unresolvedItems.length > 0, 'Must list specific blocking items');

  // Attempt closure by Member should fail
  setCurrentUser(s, 'member');
  const closeResult = closeCase(s, 'CASE-2026-0834');
  assert.equal(closeResult.success, false, 'Member cannot close a case that is not ready');

  // Test Case B: CASE-2026-0830 (False fire alarm) — Satisfy supervisory sign-off
  const readyCase = getCase(s, 'CASE-2026-0830');
  const managerCp = readyCase.checkpoints.find((cp) => cp.requiresManager);
  assert.ok(managerCp, 'Must have supervisory sign-off checkpoint');
  managerCp.completed = true;
  managerCp.completedAt = '2026-11-11T14:00:00';

  const readinessReady = checkClosureReadiness(s, readyCase);
  assert.equal(readinessReady.isReady, true, 'Fully completed case must be ready for closure');

  // Closure succeeds
  const readyClose = closeCase(s, 'CASE-2026-0830');
  assert.equal(readyClose.success, true, 'Ready case should close successfully');
  assert.equal(readyCase.status, 'closed', 'Case status must update to closed');
  assert.ok(readyCase.timeline.some((e) => e.type === 'closure'), 'Timeline must record closure event');
});

test('5. Evidence-Linked Case Brief Generation', () => {
  const s = createSeedState();
  const c = getCase(s, 'CASE-2026-0814');

  const brief = generateCaseBrief(s, c);
  assert.ok(typeof brief === 'string', 'Brief must be a string');
  assert.ok(brief.includes(c.caseNumber), 'Brief must include case number');
  assert.ok(brief.includes(c.title), 'Brief must include case title');
  assert.ok(brief.includes('[CURRENT STATUS]'), 'Brief must have status section');
  assert.ok(brief.includes('[OUTSTANDING COMMITMENTS & LOOSE ENDS]'), 'Brief must highlight loose ends');
  assert.ok(brief.includes('[CLOSURE READINESS CHECK]'), 'Brief must evaluate closure readiness');
  assert.ok(brief.includes('[RECOMMENDED NEXT ACTIONS]'), 'Brief must recommend next actions');
  assert.ok(brief.includes('Deterministic Prototype Simulator'), 'Brief must have simulator calibration disclaimer');
});

test('6. Cross-Workstream Integrations: Tasks, Smart Planner, Ripple, and Approvals', () => {
  const s = createSeedState();

  // A. Tasks linkage: Task t103 links to CASE-2026-0814
  const t103 = getTask(s, 't103');
  assert.equal(t103.caseId, 'CASE-2026-0814', 'Task t103 must link directly to CASE-2026-0814');

  // B. Approvals workflow integration: Request case reassignment
  setCurrentUser(s, 'member');
  const req = requestCaseReassignment(
    s,
    'CASE-2026-0814',
    'o2',
    'Zone A inspection schedule conflict due to urgent lift check.',
  );
  assert.ok(req, 'Reassignment request must be created');
  assert.equal(req.caseId, 'CASE-2026-0814', 'Approval must reference caseId');
  assert.equal(req.status, 'pending', 'Approval must start in pending state');

  // Verify timeline recorded the handover request
  const c = getCase(s, 'CASE-2026-0814');
  assert.ok(
    c.timeline.some((e) => e.type === 'assignment' && e.title.includes('Reassignment requested')),
    'Case timeline must record reassignment request',
  );

  // C. Manager Review & Approval Execution
  setCurrentUser(s, 'manager');
  const decision = decideApproval(s, req.id, 'approved', 'Jennifer Ong', 'Approved. Marcus has afternoon inspection capacity.');
  assert.equal(decision.status, 'approved', 'Approval decision must be approved');

  // Bidirectional sync check: Case owner updated to Marcus (o2)
  assert.equal(c.ownerId, 'o2', 'Case owner must update to o2 upon approval');
  // Primary task owner updated
  assert.equal(t103.ownerId, 'o2', 'Linked task owner must update to o2');
  // Case timeline logs approved handover
  assert.ok(
    c.timeline.some((e) => e.title.includes('Reassignment approved')),
    'Case timeline must record manager approval',
  );
});

test('7. Page Rendering Resilience across Personas, Views and Tabs', () => {
  const s = createSeedState();

  // A. Team Member (Aisyah): List View
  setCurrentUser(s, 'member');
  caseView.viewMode = 'list';
  caseView.activeTab = 'all';
  caseView.selectedCaseId = null;
  let htmlOutput = String(casesPage.render(s));
  assert.ok(htmlOutput.includes('Case Action Centre'), 'Render must include page header');
  assert.ok(htmlOutput.includes('CASE-2026-0814'), 'Aisyah must see CASE-2026-0814 in list view');

  // B. Team Member: Kanban View
  caseView.viewMode = 'kanban';
  htmlOutput = String(casesPage.render(s));
  assert.ok(htmlOutput.includes('kanban-board'), 'Render must output kanban board');
  assert.ok(htmlOutput.includes('CASE-2026-0814'), 'Kanban must render assigned case card');

  // C. Case Journey Drawer / Modal with all 4 tabs
  caseView.selectedCaseId = 'CASE-2026-0814';
  const tabs = ['timeline', 'loose_ends', 'readiness', 'brief'];
  for (const tab of tabs) {
    caseView.journeyTab = tab;
    htmlOutput = String(casesPage.render(s));
    assert.ok(htmlOutput.includes('modal-surface'), `Modal must render for tab ${tab}`);
    assert.ok(htmlOutput.includes('CASE-2026-0814'), `Modal must display case title for tab ${tab}`);
  }
  caseView.selectedCaseId = null;

  // D. Manager View (Jennifer): Sees full team radar and cases
  setCurrentUser(s, 'manager');
  htmlOutput = String(casesPage.render(s));
  assert.ok(htmlOutput.includes('Follow-Up Radar'), 'Manager must see Follow-Up Radar');
  assert.ok(htmlOutput.includes('CASE-2026-0825'), 'Manager must see Zone B cases');

  // E. Admin Persona (Alex Tan): Governance summary, zero resident PII
  setCurrentUser(s, 'admin');
  htmlOutput = String(casesPage.render(s));
  assert.ok(htmlOutput.includes('Admin Summary'), 'Admin must see Governance Summary view');
  assert.ok(!htmlOutput.includes('Mr. Tan Ah Seng'), 'Admin must NOT see resident PII');

  // F. Pending & Disabled Persona: Restricted access notice
  setCurrentUser(s, 'pending');
  htmlOutput = String(casesPage.render(s));
  assert.ok(htmlOutput.includes('Restricted'), 'Pending account must see restricted banner');

  setCurrentUser(s, 'disabled');
  htmlOutput = String(casesPage.render(s));
  assert.ok(htmlOutput.includes('Restricted'), 'Disabled account must see restricted banner');
});
