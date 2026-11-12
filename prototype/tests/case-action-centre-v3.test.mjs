// Test Suite: Case Action Centre V3 — Professional UX Refinement & Notification Improvements
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
import decidesPage from '../js/pages/decides.js';
import {
  getCases,
  getCase,
  detectLooseEnds,
  checkClosureReadiness,
  generateCaseBrief,
  setCurrentUser,
  getCommunications,
  getExplanationForFinding,
  getVisibleNotifications,
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../js/state.js';

test('V3 UI Refinement: EMS case prioritisation panel removed from Case Action Centre, How SyncAI decides intact', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  // Case Action Centre page MUST NOT contain the bottom prioritisation order panel
  const caseActionCentreHtml = casesPage.render(s).toString();
  assert.doesNotMatch(caseActionCentreHtml, /EMS case prioritisation order/);
  assert.doesNotMatch(caseActionCentreHtml, /case-priority-order/);

  // BUT CASE_PRIORITY_ORDER constant remains intact
  assert.deepEqual(CASE_PRIORITY_ORDER, ['Service', 'Safety', 'Residents’ well-being', 'Actual concern / urgency']);

  // And the dedicated "How SyncAI decides" page remains intact and renders the criteria
  const decidesHtml = decidesPage.render(s).toString();
  assert.match(decidesHtml, /Safety/);
  assert.match(decidesHtml, /Mandatory deadlines/);
  assert.match(decidesHtml, /Service impact/);
});

test('V3 Header & Metrics: Single summary presentation with 4 interactive metric cards and no duplicate stats', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  const rendered = casesPage.render(s).toString();

  // Header should be clean and not repeat summary metrics in the hero aside
  assert.match(rendered, /Case Action Centre/);
  assert.match(rendered, /Property Officer Workspace/);
  assert.match(rendered, /Fictional Demo Environment/);
  assert.doesNotMatch(rendered, /hero-stat/);

  // Section B has 4 interactive metric cards with filter triggers
  assert.match(rendered, /data-action="case-tab"\s+data-tab="open"/);
  assert.match(rendered, /Open Cases/);
  assert.match(rendered, /data-action="case-tab"\s+data-tab="radar"/);
  assert.match(rendered, /Outstanding Follow-Ups/);
  assert.match(rendered, /data-action="case-tab"\s+data-tab="blocked"/);
  assert.match(rendered, /Blocked Cases/);
  assert.match(rendered, /data-action="case-tab"\s+data-tab="ready"/);
  assert.match(rendered, /Ready to Close\?/);

  // Filter toolbar has accessible labels and clear reset button capability
  assert.match(rendered, /aria-label="Search cases by case number, title, estate, or resident"/);
  assert.match(rendered, /aria-label="Filter cases by estate or block"/);
  assert.match(rendered, /aria-label="Filter cases by urgency level"/);
});

test('V3 Drawer Redesign: Header with assigned officer, visible X close button, wrapped navigation without overflow', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  // Open drawer for case-001
  caseView.selectedCaseId = 'case-001';
  caseView.journeyTab = 'timeline';
  const drawerHtml = casesPage.render(s).toString();

  // Drawer header elements
  assert.match(drawerHtml, /drawer-panel/);
  assert.match(drawerHtml, /drawer-header/);
  assert.match(drawerHtml, /DEMO-001/);
  assert.match(drawerHtml, /Ceiling seepage at Blk 211/);
  assert.match(drawerHtml, /Assigned: <strong>Aisyah Rahman<\/strong>/);
  assert.match(drawerHtml, /class="drawer-close-btn" data-action="case-modal-close"/);
  assert.match(drawerHtml, /aria-label="Close drawer"/);

  // Responsive wrapped navigation (no overflowing single-row flex)
  assert.match(drawerHtml, /drawer-tabs-nav/);
  assert.match(drawerHtml, /drawer-tab-btn/);
  assert.match(drawerHtml, /Timeline &amp; Notes/);
  assert.match(drawerHtml, /Outstanding Follow-Ups/);
  assert.match(drawerHtml, /Blockers/);
  assert.match(drawerHtml, /Ready to Close\?/);
  assert.match(drawerHtml, /Communications/);
  assert.match(drawerHtml, /AI Case Brief/);

  // Context-aware drawer footer actions
  assert.match(drawerHtml, /drawer-footer/);
  assert.match(drawerHtml, /data-action="case-reassign-dialog"/);
  assert.match(drawerHtml, /data-action="case-plan-nav"/);
  assert.match(drawerHtml, /data-action="case-close-action"/);

  // Cleanup
  caseView.selectedCaseId = null;
});

test('V3 Compact Empty Timeline: Clean empty state text without excessive vertical whitespace', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  // Create or test a case with empty timeline
  const c = getCase(s, 'case-003');
  c.timeline = []; // clear timeline for test

  caseView.selectedCaseId = 'case-003';
  caseView.journeyTab = 'timeline';
  const drawerHtml = casesPage.render(s).toString();

  assert.match(drawerHtml, /No case updates have been recorded yet\./);
  assert.match(drawerHtml, /empty-state-compact/);

  // Cleanup
  caseView.selectedCaseId = null;
});

test('V3 User-Friendly Terminology: Outstanding Follow-Ups, Why was this flagged?, Ready to Close?, Supporting Record', () => {
  const s = createSeedState();
  setCurrentUser(s, 'member');

  caseView.selectedCaseId = 'case-001';
  caseView.journeyTab = 'loose_ends';
  caseView.activeExplanationRuleId = null;
  const looseEndsHtml = casesPage.render(s).toString();

  // Terminology in Follow-ups tab
  assert.match(looseEndsHtml, /Outstanding Follow-Ups/);
  assert.match(looseEndsHtml, /Why was this flagged\?/);
  assert.match(looseEndsHtml, /Supporting Record:/);

  // Terminology in Explanation panel (#117)
  caseView.activeExplanationRuleId = 'resident_followup';
  const explanationHtml = casesPage.render(s).toString();

  assert.match(explanationHtml, /← Back to Follow-Ups List/);
  assert.match(explanationHtml, /Responsible AI Disclosure: Deterministic Rule-Based Finding/);
  assert.match(explanationHtml, /1\. Verified Recorded Facts/);
  assert.match(explanationHtml, /2\. Rule-Based Deductions/);
  assert.match(explanationHtml, /3\. Missing Information/);
  assert.match(explanationHtml, /4\. Proposed Recommendations/);
  assert.match(explanationHtml, /View Supporting Record →/);

  // Cleanup
  caseView.selectedCaseId = null;
  caseView.activeExplanationRuleId = null;
});

test('V3 Notification Centre: 14 rich operational notifications covering all required event types across roles', () => {
  const s = createSeedState();

  // Verify total seeded count
  assert.ok(s.notifications.length >= 14, `Must have at least 14 notifications, found ${s.notifications.length}`);

  // Required types check
  const types = s.notifications.map((n) => n.type);
  assert.ok(types.includes('resident_callback_due'), 'Has resident_callback_due');
  assert.ok(types.includes('overdue_followup'), 'Has overdue_followup');
  assert.ok(types.includes('contractor_confirmation_pending'), 'Has contractor_confirmation_pending');
  assert.ok(types.includes('repair_appointment_approaching'), 'Has repair_appointment_approaching');
  assert.ok(types.includes('missing_inspection_evidence'), 'Has missing_inspection_evidence');
  assert.ok(types.includes('blocker_identified'), 'Has blocker_identified');
  assert.ok(types.includes('reassignment_awaiting_approval'), 'Has reassignment_awaiting_approval');
  assert.ok(types.includes('reassignment_approved'), 'Has reassignment_approved');
  assert.ok(types.includes('new_case_assigned'), 'Has new_case_assigned');
  assert.ok(types.includes('sla_deadline_approaching'), 'Has sla_deadline_approaching');
  assert.ok(types.includes('case_handover_recorded'), 'Has case_handover_recorded');
  assert.ok(types.includes('closure_review_requested'), 'Has closure_review_requested');
  assert.ok(types.includes('urgent_safety_incident'), 'Has urgent_safety_incident');
  assert.ok(types.includes('governance_compliance_audit'), 'Has governance_compliance_audit');

  // Verify role isolation:
  // 1. Team member (Aisyah)
  setCurrentUser(s, 'member');
  const aisyahNotifs = getVisibleNotifications(s);
  assert.ok(aisyahNotifs.length >= 7, 'Aisyah has her operational notifications');
  assert.ok(!aisyahNotifs.some((n) => n.type === 'governance_compliance_audit'), 'Aisyah cannot see admin governance audit');

  // 2. Manager (Jennifer)
  setCurrentUser(s, 'manager');
  const jenniferNotifs = getVisibleNotifications(s);
  assert.ok(jenniferNotifs.length >= 7, 'Jennifer sees manager & team notifications');
  assert.ok(jenniferNotifs.some((n) => n.type === 'reassignment_awaiting_approval'), 'Jennifer sees reassignment approval requests');
  assert.ok(jenniferNotifs.some((n) => n.type === 'closure_review_requested'), 'Jennifer sees closure reviews');

  // 3. Admin (Alex Tan)
  setCurrentUser(s, 'admin');
  const alexNotifs = getVisibleNotifications(s);
  assert.ok(alexNotifs.some((n) => n.type === 'governance_compliance_audit'), 'Alex sees governance compliance audits');
  assert.ok(!alexNotifs.some((n) => n.type === 'resident_callback_due'), 'Alex does not see raw resident casework');
});

test('V3 Role Consistency: Manager visible cases, loose ends, and blocker counts align deterministically', () => {
  const s = createSeedState();
  setCurrentUser(s, 'manager');

  const cases = visibleCases(s);
  assert.equal(cases.length, 4, 'Jennifer manages 4 cases across Zones A, B, and C');

  const openCases = cases.filter((c) => c.status !== 'closed' && c.status !== 'Closed');
  assert.equal(openCases.length, 4, 'All 4 cases are initially active/open');

  const allLooseEnds = [];
  cases.forEach((c) => {
    const ends = detectLooseEnds(s, c);
    ends.forEach((e) => allLooseEnds.push(e));
  });
  assert.equal(allLooseEnds.length, 5, 'Manager detects exactly 5 outstanding operational follow-ups');

  const blockedCases = cases.filter((c) => (c.blockers || []).some((b) => !b.resolved) || c.status === 'pending_external');
  assert.equal(blockedCases.length, 1, 'Manager has exactly 1 blocked case (case-001)');

  const readyCases = cases.filter((c) => c.status === 'ready_for_closure');
  assert.equal(readyCases.length, 0, 'No cases initially ready for closure without completed checkpoints');
});
