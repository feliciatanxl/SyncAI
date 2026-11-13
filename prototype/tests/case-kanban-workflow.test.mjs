// Test Suite: Case Action Centre V5 — Functional Drag-and-Drop Kanban & Complete Case Workspace UX Refinement
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  KANBAN_COLUMNS,
  getCaseKanbanColumn,
  accessibleCase,
  visibleCases,
  requestCaseStageTransition,
  canTransitionCase,
  normalizeKanbanStage,
} from '../js/cases.js';
import { createSeedState } from '../js/data.js';
import casesPage, { caseView } from '../js/pages/cases.js';
import {
  loadState,
  replaceState,
  resetState,
  getCase,
  setCurrentUser,
  getCurrentUser,
  checkClosureReadiness,
  resolveCaseBlocker,
  getApprovals,
  getPendingApprovals,
  detectLooseEnds,
} from '../js/state.js';
import { TODAY } from '../js/time.js';

test('V5 Kanban: Valid stage transitions update real prototype shared state and timeline', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member'); // Aisyah Rahman (o1)

  const c4 = getCase(s, 'case-004');
  assert.equal(c4.status, 'Open');
  assert.equal(getCaseKanbanColumn(c4), 'open');
  const initialTimelineLength = c4.timeline.length;

  // 1. Move case-004 Open -> In Progress
  const res = requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1', 'Intake completed; starting joint lift inspection.');
  assert.equal(res.success, true);
  assert.equal(res.resultingStatus, 'in_progress');
  assert.equal(res.resultingStage, 'in_progress');
  assert.equal(c4.status, 'in_progress');
  assert.equal(getCaseKanbanColumn(c4), 'in_progress');

  // Verify timeline event added
  assert.equal(c4.timeline.length, initialTimelineLength + 1);
  const latestEvent = c4.timeline[0];
  assert.equal(latestEvent.type, 'status_change');
  assert.match(latestEvent.title, /Work started \(In Progress\)/);
  assert.match(latestEvent.summary, /starting joint lift inspection/);
  assert.equal(latestEvent.source, 'Case Action Centre');

  // Verify activity log recorded
  const lastActivity = s.activity[0];
  assert.match(lastActivity.text, /Case DEMO-004 transitioned to In Progress/);
});

test('V5 Kanban: Moving to Awaiting External requires a hold/blocker reason and creates blocker record', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');
  const c4 = getCase(s, 'case-004');
  c4.status = 'in_progress';

  // 1. Attempt transition without reason -> rejected
  const emptyReasonRes = requestCaseStageTransition(s, 'case-004', 'pending_external', 'o1', '   ');
  assert.equal(emptyReasonRes.success, false);
  assert.equal(emptyReasonRes.requiresReason, true);
  assert.match(emptyReasonRes.error, /minimum 4 characters/);
  assert.equal(c4.status, 'in_progress');

  // 2. Attempt transition with short reason (<4 chars) -> rejected
  const shortReasonRes = requestCaseStageTransition(s, 'case-004', 'pending_external', 'o1', 'abc');
  assert.equal(shortReasonRes.success, false);
  assert.equal(shortReasonRes.requiresReason, true);

  // 3. Valid transition with operational hold reason
  const validRes = requestCaseStageTransition(
    s,
    'case-004',
    'pending_external',
    'o1',
    'Awaiting BCA specialist technician vibration analysis report'
  );
  assert.equal(validRes.success, true);
  assert.equal(validRes.resultingStatus, 'pending_external');
  assert.equal(validRes.resultingStage, 'pending_external');
  assert.equal(c4.status, 'pending_external');

  // Blocker record created in case.blockers
  assert.equal(c4.blockers.length, 1);
  const newBlocker = c4.blockers[0];
  assert.match(newBlocker.title, /Awaiting BCA specialist technician/);
  assert.equal(newBlocker.resolved, false);
  assert.equal(newBlocker.category, 'Awaiting External / Specialist');

  // Kanban classifier assigns to pending_external
  assert.equal(getCaseKanbanColumn(c4), 'pending_external');
});

test('V5 Kanban: Blocked case cannot silently move to In Progress until blocker is resolved', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  // Test case-001 with its seeded active blocker
  const c1 = getCase(s, 'case-001');
  assert.equal(getCaseKanbanColumn(c1), 'pending_external');
  assert.ok((c1.blockers || []).some((b) => !b.resolved));

  // 1. Drag / transition to in_progress while blocker is active -> REJECTED
  const blockedRes1 = requestCaseStageTransition(s, 'case-001', 'in_progress', 'o1');
  assert.equal(blockedRes1.success, false);
  assert.match(blockedRes1.error, /active blocker unresolved/);
  assert.equal(blockedRes1.canResolveBlocker, true);
  // Blocker was NOT deleted silently!
  assert.equal(c1.blockers[0].resolved, false);

  // 2. Test case-004: Put on hold (status becomes 'pending_external' with a blocker)
  const c4 = getCase(s, 'case-004');
  requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1');
  requestCaseStageTransition(s, 'case-004', 'pending_external', 'o1', 'Awaiting hoist motor delivery');
  assert.equal(c4.status, 'pending_external');
  assert.equal(getCaseKanbanColumn(c4), 'pending_external');
  assert.equal(c4.blockers.length, 1);

  // Attempting to move case-004 back to In Progress while blocker unresolved -> REJECTED
  const blockedRes4 = requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1');
  assert.equal(blockedRes4.success, false);
  assert.match(blockedRes4.error, /active blocker unresolved/);

  // Resolve blocker explicitly
  const blockerId = c4.blockers[0].id;
  const resolveRes = resolveCaseBlocker(s, 'case-004', blockerId);
  assert.equal(resolveRes.success, true);
  assert.equal(c4.blockers[0].resolved, true);

  // 3. Now transition to in_progress -> SUCCEEDS
  const unblockedRes = requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1');
  assert.equal(unblockedRes.success, true);
  assert.equal(unblockedRes.resultingStatus, 'in_progress');
  assert.equal(unblockedRes.resultingStage, 'in_progress');
  assert.equal(c4.status, 'in_progress');
  assert.equal(getCaseKanbanColumn(c4), 'in_progress');
});

test('V5 Kanban: Active case cannot move to Closure Ready if checklist requirements are incomplete', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  const c4 = getCase(s, 'case-004');
  c4.status = 'in_progress';
  const readiness = checkClosureReadiness(s, c4);
  assert.equal(readiness.isReady, false);

  // 1. Move to ready_for_closure with incomplete checklist -> REJECTED
  const rej = requestCaseStageTransition(s, 'case-004', 'ready_for_closure', 'o1');
  assert.equal(rej.success, false);
  assert.match(rej.error, /Cannot move to Closure Ready/);
  assert.ok(rej.unresolvedItems.length > 0);
  assert.equal(c4.status, 'in_progress');

  // 2. Complete all required checkpoints
  c4.checkpoints.forEach((cp) => {
    cp.completed = true;
  });
  c4.evidence.forEach((e) => {
    e.verified = true;
    e.missing = false;
  });

  const readyCheck = checkClosureReadiness(s, c4);
  assert.equal(readyCheck.isReady, true);

  // 3. Move to ready_for_closure with satisfied checklist -> SUCCEEDS
  const successRes = requestCaseStageTransition(s, 'case-004', 'ready_for_closure', 'o1');
  assert.equal(successRes.success, true);
  assert.equal(successRes.resultingStatus, 'ready_for_closure');
  assert.equal(successRes.resultingStage, 'ready_for_closure');
  assert.equal(c4.status, 'ready_for_closure');
});

test('V5 Kanban: Team Member cannot close case directly; creates manager closure approval request', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member'); // Aisyah Rahman

  const c4 = getCase(s, 'case-004');
  c4.status = 'ready_for_closure';
  const initialApprovalsCount = getApprovals(s).length;

  // Team Member attempts to drop / move case into closed
  const memberCloseRes = requestCaseStageTransition(
    s,
    'case-004',
    'closed',
    'o1',
    'All lift safety testing completed with Schindler technician. Requesting manager sign-off.'
  );

  assert.equal(memberCloseRes.success, true);
  assert.equal(memberCloseRes.requiresApproval, true);
  assert.ok(memberCloseRes.approvalId);
  // Case is NOT closed directly!
  assert.equal(c4.status, 'ready_for_closure');
  assert.equal(getCaseKanbanColumn(c4), 'ready_for_closure');

  // An approval request was created
  assert.equal(getApprovals(s).length, initialApprovalsCount + 1);
  const approval = getApprovals(s)[0];
  assert.equal(approval.requestType, 'case_closure');
  assert.equal(approval.caseId, 'case-004');
  assert.equal(approval.status, 'pending');

  // Now switch to Manager (Jennifer Ong)
  setCurrentUser(s, 'manager');

  // Attempting to close with incomplete checklist and no reason -> rejects requiring exception reason
  const mgrNoReasonClose = requestCaseStageTransition(s, 'case-004', 'closed', 's1', '');
  assert.equal(mgrNoReasonClose.success, false);
  assert.equal(mgrNoReasonClose.requiresReason, true);
  assert.match(mgrNoReasonClose.error, /auditable manager exception reason/);

  // Closing with auditable manager exception reason -> SUCCEEDS
  const mgrCloseRes = requestCaseStageTransition(
    s,
    'case-004',
    'closed',
    's1',
    'Authorized manager closure: on-site physical inspection verified by Jennifer Ong.'
  );
  assert.equal(mgrCloseRes.success, true);
  assert.equal(mgrCloseRes.resultingStatus, 'closed');
  assert.equal(mgrCloseRes.resultingStage, 'closed');
  assert.equal(c4.status, 'closed');
  assert.equal(getCaseKanbanColumn(c4), 'closed');
});

test('V5 Kanban: Closed case reopen restrictions enforced between Member and Manager', () => {
  const s = createSeedState();
  const c4 = getCase(s, 'case-004');
  c4.status = 'closed';
  c4.closedAt = TODAY;
  c4.closedBy = 'Jennifer Ong';

  // 1. Team member tries to reopen closed case -> REJECTED
  setCurrentUser(s, 'member');
  const memberReopen = requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1', 'Reopening case');
  assert.equal(memberReopen.success, false);
  assert.match(memberReopen.error, /cannot be reopened by Team Members/);
  assert.equal(c4.status, 'closed');

  // 2. Manager tries to reopen without auditable reason -> REJECTED
  setCurrentUser(s, 'manager');
  const mgrNoReason = requestCaseStageTransition(s, 'case-004', 'in_progress', 's1', '');
  assert.equal(mgrNoReason.success, false);
  assert.equal(mgrNoReason.requiresReason, true);
  assert.match(mgrNoReason.error, /auditable reason/);

  // 3. Manager reopens with auditable reason -> SUCCEEDS
  const mgrValidReopen = requestCaseStageTransition(
    s,
    'case-004',
    'in_progress',
    's1',
    'Resident reported secondary jolt between 4th and 6th floors; reopening for re-inspection.'
  );
  assert.equal(mgrValidReopen.success, true);
  assert.equal(mgrValidReopen.resultingStatus, 'in_progress');
  assert.equal(mgrValidReopen.resultingStage, 'in_progress');
  assert.equal(c4.status, 'in_progress');
  assert.equal(c4.closedAt, null);

  // Reopen audit event logged in timeline
  const reopenEvent = c4.timeline[0];
  assert.equal(reopenEvent.type, 'reopened');
  assert.match(reopenEvent.title, /Case reopened to In Progress/);
  assert.match(reopenEvent.summary, /Resident reported secondary jolt/);
});

test('V5 Kanban: Role-based access control enforces data segregation and permissions', () => {
  const s = createSeedState();

  // 1. Team Member (Aisyah, o1) can modify own case (case-004)
  setCurrentUser(s, 'member');
  const ownRes = requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1', 'Valid move');
  assert.equal(ownRes.success, true);

  // 2. Team Member cannot modify another officer's case (case-002 owned by o2 Marcus Tan)
  const otherRes = requestCaseStageTransition(s, 'case-002', 'in_progress', 'o1');
  assert.equal(otherRes.success, false);
  assert.match(otherRes.error, /Team members can only modify their own assigned cases/);

  // 3. Admin user (Alex Tan) has view-only access, cannot transition casework
  setCurrentUser(s, 'admin');
  const adminRes = requestCaseStageTransition(s, 'case-004', 'open', 'a1');
  assert.equal(adminRes.success, false);
  assert.match(adminRes.error, /Administrators have governance view-only access/);

  // 4. Pending account denied
  setCurrentUser(s, 'pending');
  const pendingRes = requestCaseStageTransition(s, 'case-004', 'open');
  assert.equal(pendingRes.success, false);
  assert.match(pendingRes.error, /Operational case access is restricted/);

  // 5. Disabled account denied
  setCurrentUser(s, 'disabled');
  const disabledRes = requestCaseStageTransition(s, 'case-004', 'open');
  assert.equal(disabledRes.success, false);
  assert.match(disabledRes.error, /Operational case access is restricted/);
});

test('V5 Kanban: Deterministic classification eliminates duplication and updates counts accurately', () => {
  const s = createSeedState();
  setCurrentUser(s, 'manager'); // Manager sees 4 cases (case-001, case-002, case-003, case-004)
  const cases = visibleCases(s);
  assert.equal(cases.length, 4);

  // Initial column assignments
  const getCounts = () => {
    const counts = {};
    KANBAN_COLUMNS.forEach((col) => {
      counts[col.id] = cases.filter((c) => getCaseKanbanColumn(c) === col.id).length;
    });
    return counts;
  };

  const initialCounts = getCounts();
  const initialTotal = Object.values(initialCounts).reduce((a, b) => a + b, 0);
  assert.equal(initialTotal, 4, 'Total cases across columns must equal visible cases');

  // Move case-004 from open to in_progress
  const moveRes = requestCaseStageTransition(s, 'case-004', 'in_progress', 's1');
  assert.equal(moveRes.success, true);

  const updatedCounts = getCounts();
  assert.equal(updatedCounts.open, initialCounts.open - 1);
  assert.equal(updatedCounts.in_progress, initialCounts.in_progress + 1);

  const updatedTotal = Object.values(updatedCounts).reduce((a, b) => a + b, 0);
  assert.equal(updatedTotal, 4, 'Total cases remains strictly 4 with zero card duplication');

  // Verify that case-004 appears in EXACTLY one column
  const occurrences = KANBAN_COLUMNS.filter((col) => {
    return cases.filter((c) => c.id === 'case-004' && getCaseKanbanColumn(c) === col.id).length > 0;
  });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].id, 'in_progress');
});

test('V5 Kanban: Persistence across reload and Demo Reset restores initial seed stages', () => {
  const original = globalThis.localStorage;
  let saved;
  globalThis.localStorage = {
    getItem: () => saved,
    setItem: (_key, value) => {
      saved = value;
    },
  };

  try {
    const s = createSeedState();
    setCurrentUser(s, 'member');

    // Move case-004 to in_progress and save
    requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1');
    replaceState(s);

    // Reload state: case-004 retains in_progress
    const reloaded = loadState();
    const c4Reloaded = getCase(reloaded, 'case-004');
    assert.equal(c4Reloaded.status, 'in_progress');
    assert.equal(getCaseKanbanColumn(c4Reloaded), 'in_progress');

    // Reset demo state
    resetState();
    const reset = loadState();
    const c4Reset = getCase(reset, 'case-004');
    assert.equal(c4Reset.status, 'Open');
    assert.equal(getCaseKanbanColumn(c4Reset), 'open');

    const c1Reset = getCase(reset, 'case-001');
    assert.equal(getCaseKanbanColumn(c1Reset), 'pending_external');
  } finally {
    globalThis.localStorage = original;
  }
});

test('V5 Workspace UI: Kanban and Table render accessible Move to Stage controls and valid cards', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  // 1. Render Table / List View
  caseView.viewMode = 'list';
  const tableHtml = casesPage.render(s).toString();

  assert.match(tableHtml, /case-table-row/);
  assert.match(tableHtml, /data-action="case-row-click"/);
  assert.match(tableHtml, /data-action="case-move-stage-dialog"/);
  assert.match(tableHtml, /Move to Stage/);
  assert.match(tableHtml, /View Case/);

  // 2. Render Kanban View
  caseView.viewMode = 'kanban';
  const kanbanHtml = casesPage.render(s).toString();

  assert.match(kanbanHtml, /kanban-board/);
  assert.match(kanbanHtml, /kanban-col/);
  assert.match(kanbanHtml, /data-col-id="open"/);
  assert.match(kanbanHtml, /data-col-id="in_progress"/);
  assert.match(kanbanHtml, /data-col-id="pending_external"/);
  assert.match(kanbanHtml, /data-col-id="ready_for_closure"/);
  assert.match(kanbanHtml, /data-col-id="closed"/);

  // Card draggable attribute and affordance
  assert.match(kanbanHtml, /draggable="true"/);
  assert.match(kanbanHtml, /kanban-card-drag-affordance/);
  assert.match(kanbanHtml, /data-action="case-card-surface"/);
  assert.match(kanbanHtml, /data-action="case-move-stage-dialog"/);

  // 3. Render Move to Stage Dialog
  caseView.moveStageModalCaseId = 'case-004';
  const dialogHtml = casesPage.render(s).toString();

  assert.match(dialogHtml, /case-move-stage-dialog/);
  assert.match(dialogHtml, /Move Case to Stage/);
  assert.match(dialogHtml, /DEMO-004/);
  assert.match(dialogHtml, /Select Destination Workflow Stage:/);
  assert.match(dialogHtml, /data-action="case-select-move-stage"/);
  assert.match(dialogHtml, /data-action="case-move-stage-close"/);

  // 4. Render Consequential Transition Confirmation Modal
  caseView.moveStageModalCaseId = null;
  caseView.transitionModal = {
    caseId: 'case-004',
    targetStage: 'pending_external',
    currentStage: 'open',
    requiresReason: true,
    requiresApproval: false,
    isException: false,
  };
  const confirmModalHtml = casesPage.render(s).toString();

  assert.match(confirmModalHtml, /case-transition-confirm-dialog/);
  assert.match(confirmModalHtml, /Place Case on Hold \(Awaiting External\)/);
  assert.match(confirmModalHtml, /id="case-transition-reason-input"/);
  assert.match(confirmModalHtml, /data-action="case-transition-confirm"/);
  assert.match(confirmModalHtml, /data-action="case-transition-cancel"/);

  // Reset modal state
  caseView.transitionModal = null;
});

test('V5 Workspace UI: Stage transition updates Drawer state immediately', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  // Move case-004 to in_progress
  requestCaseStageTransition(s, 'case-004', 'in_progress', 'o1');

  // Open drawer for case-004
  caseView.selectedCaseId = 'case-004';
  caseView.journeyTab = 'timeline';
  const drawerHtml = casesPage.render(s).toString();

  assert.match(drawerHtml, /drawer-panel/);
  assert.match(drawerHtml, /DEMO-004/);
  assert.match(drawerHtml, /in_progress/);
  assert.match(drawerHtml, /Work started \(In Progress\)/);

  // Reset drawer state
  caseView.selectedCaseId = null;
});
