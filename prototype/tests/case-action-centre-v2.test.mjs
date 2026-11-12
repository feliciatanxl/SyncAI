// Test Suite: Case Action Centre V2 — UI Redesign, Evidence Intelligence & Communications
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CASE_PRIORITY_ORDER,
  KANBAN_COLUMNS,
  getCaseKanbanColumn,
  accessibleCase,
  tasksForCase,
  visibleCases,
} from '../js/cases.js';
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
  getCommunications,
  addCommunication,
  acknowledgeCommunication,
  generateDraftReply,
  extractTaskDraftFromMessage,
  getExplanationForFinding,
  getVisibleNotifications,
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  resetState,
  loadState,
} from '../js/state.js';
import { TODAY } from '../js/time.js';

test('V2 Kanban: Single-column deterministic classification eliminates case duplication', () => {
  const s = createSeedState();
  setCurrentUser(s, 'manager');
  const allCases = visibleCases(s);
  assert.equal(allCases.length, 4, 'Manager sees 4 cases');

  // Verify columns definition
  assert.equal(KANBAN_COLUMNS.length, 5, 'Must have 5 Kanban columns');
  const expectedColIds = ['open', 'in_progress', 'pending_external', 'ready_for_closure', 'closed'];
  assert.deepEqual(KANBAN_COLUMNS.map((c) => c.id), expectedColIds);

  // Classify each case
  const columnAssignments = new Map();
  for (const c of allCases) {
    const col = getCaseKanbanColumn(c);
    assert.ok(expectedColIds.includes(col), `Column ${col} is a valid column`);
    columnAssignments.set(c.id, col);
  }

  // Critical regression test: case-001 (ceiling seepage at Blk 211) has status "In progress"
  // BUT also has an active unresolved blocker (upper unit resident unreachable).
  // It MUST be classified ONLY into "pending_external" (Awaiting External / Blocked), NEVER in "in_progress"!
  const case001 = getCase(s, 'case-001');
  assert.equal(case001.status, 'In progress');
  assert.ok((case001.blockers || []).some((b) => !b.resolved), 'case-001 has active blocker');
  assert.equal(getCaseKanbanColumn(case001), 'pending_external', 'Must classify into Awaiting External / Blocked');

  // Verify each case appears in EXACTLY one column
  const partitionCounts = new Map(expectedColIds.map((id) => [id, 0]));
  for (const c of allCases) {
    const col = getCaseKanbanColumn(c);
    partitionCounts.set(col, partitionCounts.get(col) + 1);
  }
  const totalCount = Array.from(partitionCounts.values()).reduce((sum, count) => sum + count, 0);
  assert.equal(totalCount, allCases.length, 'Every case belongs to exactly one column partition');

  // Dynamic reclassification when blocker is resolved:
  case001.blockers[0].resolved = true;
  assert.equal(getCaseKanbanColumn(case001), 'in_progress', 'Resolving blocker moves case to In Progress');

  // Dynamic reclassification when ready for closure:
  case001.status = 'ready_for_closure';
  assert.equal(getCaseKanbanColumn(case001), 'ready_for_closure', 'Ready for closure status classified correctly');

  // Dynamic reclassification when closed:
  case001.status = 'closed';
  assert.equal(getCaseKanbanColumn(case001), 'closed', 'Closed status classified correctly');
});

test('V2 Evidence-Linked Explanations: 4-part breakdown and clickable references', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');
  const c = getCase(s, 'case-001');

  const looseEnds = detectLooseEnds(s, c);
  assert.ok(looseEnds.length > 0, 'Detects loose ends for case-001');

  const residentFinding = looseEnds.find((f) => f.ruleId === 'resident_followup');
  assert.ok(residentFinding, 'Finds resident_followup rule');

  // Verify Responsible AI fields
  assert.equal(residentFinding.ruleCode, 'EMS-LE-01');
  assert.equal(residentFinding.ruleName, 'Resident Follow-up Commitment');
  assert.ok(residentFinding.whyDetected, 'Contains detailed whyDetected narrative');
  assert.ok(Array.isArray(residentFinding.verifiedFacts), 'Contains verified facts array');
  assert.ok(residentFinding.verifiedFacts.length >= 2, 'Has at least 2 verified recorded facts');
  assert.ok(Array.isArray(residentFinding.ruleDeductions), 'Contains rule deductions array');
  assert.ok(residentFinding.missingInfo, 'Specifies missing information');
  assert.ok(residentFinding.suggestedAction, 'Provides proposed recommendations');
  assert.match(residentFinding.disclaimer, /Deterministic rule-based finding — human review required/);
  assert.match(residentFinding.disclaimer, /Not an autonomous AI prediction/);

  // Verify clickable evidence reference resolution
  assert.ok(residentFinding.sourceRecordType, 'Identifies source record type');
  assert.ok(residentFinding.sourceRecordId, 'Points to real source record ID');
  assert.ok(residentFinding.sourceRecordRef, 'Provides human-readable reference');

  // Verify explanation resolver
  const explanation = getExplanationForFinding(s, 'case-001', 'resident_followup');
  assert.ok(explanation);
  assert.equal(explanation.ruleCode, 'EMS-LE-01');
});

test('V2 Role-Based Visibility: Strict data minimisation and segregation', () => {
  const s = createSeedState();

  // 1. Team member (Aisyah) - only sees her assigned cases (case-001, case-004)
  setCurrentUser(s, 'member');
  const memberCases = visibleCases(s);
  assert.deepEqual(memberCases.map((c) => c.id).sort(), ['case-001', 'case-004']);
  assert.equal(accessibleCase(s, 'case-002'), undefined, 'Cannot access case-002');
  assert.equal(accessibleCase(s, 'case-003'), undefined, 'Cannot access case-003');

  // 2. Manager (Jennifer) - sees all managed team cases
  setCurrentUser(s, 'manager');
  const mgrCases = visibleCases(s);
  assert.equal(mgrCases.length, 4, 'Manager sees all 4 operational cases');

  // 3. Admin (Alex Tan) - governance only, no raw casework
  setCurrentUser(s, 'admin');
  assert.deepEqual(visibleCases(s), [], 'Admin has 0 raw cases under data minimisation');
  const adminHtml = casesPage.render(s).toString();
  assert.match(adminHtml, /Operational Governance/);
  assert.match(adminHtml, /Admin Summary/);
  assert.match(adminHtml, /Data Minimisation Policy/);

  // 4. Inactive accounts (David, Siti)
  for (const role of ['pending', 'disabled']) {
    setCurrentUser(s, role);
    assert.deepEqual(visibleCases(s), []);
    const restrictedHtml = casesPage.render(s).toString();
    assert.match(restrictedHtml, /Restricted/);
  }
});

test('V2 Actionable Notifications: Filtering, read/unread states, and bulk actions', () => {
  const s = createSeedState();

  // Team member notifications
  setCurrentUser(s, 'member');
  const memberNotifs = getVisibleNotifications(s);
  assert.ok(memberNotifs.length > 0, 'Team member has notifications');
  for (const n of memberNotifs) {
    assert.ok(n.title, 'Notification has title');
    assert.ok(n.summary, 'Notification has summary');
    assert.ok(n.timestamp, 'Notification has timestamp');
    assert.ok(n.channelLabel, 'Notification has channel label');
  }

  const initialUnread = getUnreadNotifications(s).length;
  assert.ok(initialUnread > 0, 'Has unread notifications');

  // Mark single notification read
  const firstNotif = memberNotifs.find((n) => !n.read);
  assert.ok(firstNotif);
  markNotificationRead(s, firstNotif.id);
  assert.equal(firstNotif.read, true);

  // Mark all read
  markAllNotificationsRead(s);
  const remainingUnread = getUnreadNotifications(s).filter((n) => memberNotifs.some((mn) => mn.id === n.id));
  assert.equal(remainingUnread.length, 0, 'All member notifications marked as read');
});

test('V2 Case Communication Hub: Multi-channel timeline, manual log, and draft generation', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  // Retrieve seeded communications for case-001
  const comms001 = getCommunications(s, 'case-001');
  assert.ok(comms001.length >= 3, 'case-001 has at least 3 initial communication records');

  // Check channel tags
  const channels = comms001.map((m) => m.channel);
  assert.ok(channels.includes('in_app'), 'Has in_app communication');
  assert.ok(channels.includes('whatsapp'), 'Has whatsapp communication');
  assert.ok(channels.includes('teams'), 'Has teams communication');

  // Acknowledge communication
  const unackComm = comms001.find((m) => !m.acknowledged);
  assert.ok(unackComm, 'Has unacknowledged communication');
  acknowledgeCommunication(s, unackComm.id);
  assert.equal(unackComm.acknowledged, true, 'Communication becomes acknowledged');
  assert.ok(unackComm.acknowledgedAt, 'Records acknowledgement timestamp');

  // Add new manual communication
  const newRecord = addCommunication(s, {
    caseId: 'case-001',
    channel: 'whatsapp',
    category: 'Inspection Scheduling',
    content: 'Contacted upper unit resident to arrange joint inspection.',
    sourceLabel: 'Manually recorded',
  });
  assert.ok(newRecord.id);
  const updatedComms = getCommunications(s, 'case-001');
  assert.ok(updatedComms.some((m) => m.id === newRecord.id), 'New record added to case communications');

  // Check timeline updated
  const c = getCase(s, 'case-001');
  assert.ok(c.timeline.some((ev) => ev.title.includes('WhatsApp')), 'Added timeline event for communication');

  // Contextual Draft Reply Generator
  const draftReply = generateDraftReply(s, 'case-001');
  assert.ok(draftReply.length > 40, 'Generates comprehensive draft reply');
  assert.match(draftReply, /Tan/);
  assert.match(draftReply, /DEMO-001/);
});

test('V2 Communication-to-Task Drafting (#076): Deterministic extraction and verification', () => {
  const sampleMessage = 'Hi Officer Aisyah, Eng Seng Plumbing here regarding Blk 211 seepage. We need joint access to #06-12 tomorrow at 14:00 to verify floor trap seal before quote approval.';
  const draft = extractTaskDraftFromMessage(sampleMessage, 'case-001');

  assert.equal(draft.caseId, 'case-001', 'Extracts case reference');
  assert.equal(draft.priority, 'High', 'Identifies high priority for seepage/plumbing');
  assert.equal(draft.requiresHumanVerification, true, 'Requires human verification flag');
  assert.match(draft.disclaimer, /Prototype simulation — requires human verification/);
  assert.ok(draft.title, 'Generates task title');
  assert.ok(draft.due, 'Extracts due date');
});

test('V2 Page Rendering Resilience: Renders Case Action Centre cleanly across all roles', () => {
  const s = createSeedState();

  // Test Member
  setCurrentUser(s, 'member');
  caseView.viewMode = 'list';
  const memberListHtml = casesPage.render(s).toString();
  assert.match(memberListHtml, /Operational cases/);
  assert.match(memberListHtml, /Open Cases/);
  assert.match(memberListHtml, /Follow-Up Radar/);

  // Test Kanban view
  caseView.viewMode = 'kanban';
  const memberKanbanHtml = casesPage.render(s).toString();
  assert.match(memberKanbanHtml, /Open \/ Intake/);
  assert.match(memberKanbanHtml, /In Progress/);
  assert.match(memberKanbanHtml, /Awaiting External \/ Blocked/);
  assert.match(memberKanbanHtml, /Closure Ready/);
  assert.match(memberKanbanHtml, /Closed &amp; Audited/);

  // Test Manager
  setCurrentUser(s, 'manager');
  const mgrHtml = casesPage.render(s).toString();
  assert.match(mgrHtml, /Manager Workspace/);

  // Test Admin
  setCurrentUser(s, 'admin');
  const adminHtml = casesPage.render(s).toString();
  assert.match(adminHtml, /Governance Mode/);

  // Test Case Details modal/drawer
  setCurrentUser(s, 'member');
  const detailHtml = casesPage.render(s, 'case-001').toString();
  assert.match(detailHtml, /Case information/);
  assert.match(detailHtml, /Associated tasks/);
});
