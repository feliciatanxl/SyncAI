import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createSeedState } from '../js/data.js';
import {
  setCurrentUser,
  createApprovalRequest,
  submitOperationalChangeApproval,
  decideApproval,
  getNotifications,
  requestApprovalInformation,
  submitApprovalInformation,
  getOutstandingApprovalInformation,
  getOperationalChangeVersions,
} from '../js/state.js';
import teamPage from '../js/pages/team.js';
import myRequestsPage, { myRequestsView } from '../js/pages/my-requests.js';
import approvalGovernancePage, {
  approvalGovernanceView,
  renderApprovalHistory,
  renderOperationalChangeVersionHistory,
  renderOperationalChangeVersionComparison,
  generateSimulatedApprovalAssessment,
  renderSimulatedApprovalAssessment,
} from '../js/pages/approval-governance.js';
import auditTrailPage, { auditTrailView, auditActionLabel, collectApprovalAuditEvents, parseAuditTrailRequestRoute } from '../js/pages/audit-trail.js';

const requestDetails = {
  unexpectedSituation: 'The inspection found additional damage behind the panel.',
  reason: 'The original repair scope will not resolve the reported issue.',
  proposedChanges: 'Extend the repair to include the damaged pipe section.',
  requestedScope: 'Authorise the additional pipe repair up to the stated quotation.',
  potentialCostImpact: 'Quotation pending.',
  potentialScheduleImpact: 'May require one extra working day.',
  potentialOperationalImpact: 'Temporary access coordination with the resident.',
  supportingEvidence: [{ id: 'evi-ref-1', title: 'Contractor quotation', fileName: 'quote.pdf' }],
};

function setupRequest() {
  const state = createSeedState();
  setCurrentUser(state, 'member');
  const task = state.tasks.find((item) => item.ownerId === state.currentOfficerId && item.caseId);
  assert.ok(task, 'seed should include an assigned task linked to a case');
  const originalTask = structuredClone(task);
  const originalCase = structuredClone(state.cases.find((item) => item.id === task.caseId));
  const result = submitOperationalChangeApproval(state, task.id, requestDetails);
  assert.equal(result.success, true);
  return { state, task, originalTask, originalCase, approval: result.approval };
}

test('operational change request is distinct, task-linked, pending, and does not change task or case', () => {
  const { state, task, originalTask, originalCase, approval } = setupRequest();
  assert.match(approval.id, /^appr-/);
  assert.equal(approval.requestType, 'operational_change');
  assert.equal(approval.taskId, task.id);
  assert.equal(approval.caseId, task.caseId);
  assert.equal(approval.status, 'pending');
  assert.equal(approval.requesterId, state.currentOfficerId);
  assert.equal(approval.submissionVersions.length, 1);
  assert.equal(approval.submissionVersions[0].version, 1);
  assert.equal(approval.submissionVersions[0].submittedById, state.currentOfficerId);
  assert.equal(approval.submissionVersions[0].submittedAt, approval.createdAt);
  assert.equal(approval.submissionVersions[0].request.reason, requestDetails.reason);
  assert.equal(approval.unexpectedSituation, requestDetails.unexpectedSituation);
  assert.equal(approval.reason, requestDetails.reason);
  assert.equal(approval.proposedChanges, requestDetails.proposedChanges);
  assert.equal(approval.requestedScope, requestDetails.requestedScope);
  assert.deepEqual(approval.supportingEvidence, requestDetails.supportingEvidence);
  assert.deepEqual(task, originalTask);
  assert.deepEqual(state.cases.find((item) => item.id === task.caseId), originalCase);
  assert.ok(approval.auditTrail.some((item) => item.action === 'SUBMITTED'));
});

test('simulated assessment uses request and task data, distinguishes relevant concerns, and is read-only', () => {
  const { approval, task, state } = setupRequest();
  const before = structuredClone({ approval, task, approvals: state.approvals, cases: state.cases });
  const assessment = generateSimulatedApprovalAssessment(approval, task);
  assert.ok(assessment);
  assert.ok(assessment.requestSummary.join(' ').includes(task.title));
  assert.ok(assessment.requestSummary.join(' ').includes(approval.proposedChanges));
  assert.ok(assessment.requestSummary.join(' ').includes(approval.reason));
  assert.ok(assessment.requestSummary.join(' ').includes(approval.caseId));
  assert.ok(assessment.riskIdentification.join(' ').includes('Quotation pending'));
  assert.ok(assessment.missingInformation.join(' ').toLowerCase().includes('uncertain'));
  assert.ok(assessment.suggestedNextActions.join(' ').toLowerCase().includes('budget'));
  assert.ok(assessment.riskIdentification.join(' ').includes('not been inspected or verified'));
  assert.match(String(renderSimulatedApprovalAssessment(assessment)), /Request Summary/);
  assert.match(String(renderSimulatedApprovalAssessment(assessment)), /Risk Identification/);
  assert.match(String(renderSimulatedApprovalAssessment(assessment)), /Missing Information/);
  assert.match(String(renderSimulatedApprovalAssessment(assessment)), /Suggested Next Actions/);
  assert.deepEqual({ approval, task, approvals: state.approvals, cases: state.cases }, before);
});

test('simulated assessments vary by request and do not flag irrelevant optional cost or evidence fields', () => {
  const { approval, task } = setupRequest();
  const alternate = {
    ...approval,
    unexpectedSituation: 'A resident needs a temporary access arrangement.',
    reason: 'The current access timing conflicts with a resident appointment.',
    proposedChanges: 'Move the visit to the afternoon.',
    requestedScope: 'Authorise this single schedule adjustment.',
    potentialCostImpact: '',
    potentialScheduleImpact: 'Move by two hours.',
    potentialOperationalImpact: 'Coordinate resident access.',
    supportingEvidence: [],
  };
  const first = generateSimulatedApprovalAssessment(approval, task);
  const second = generateSimulatedApprovalAssessment(alternate, task);
  assert.notDeepEqual(first, second);
  assert.ok(!second.missingInformation.some((item) => /cost estimate|quotation|cost document/i.test(item)));
  assert.ok(!second.missingInformation.some((item) => /supporting evidence|technical or inspection evidence/i.test(item)));
  assert.match(second.riskIdentification.join(' '), /schedule impact/i);
  assert.equal(generateSimulatedApprovalAssessment({ requestType: 'schedule_adjustment' }), null);
});

test('manager Audit Trail aggregates supported request audit events once, chronologically, and provides accurate summaries', () => {
  const state = { approvals: [
    { id: 'appr-op', requestType: 'operational_change', taskTitle: 'Repair damaged pipe', requesterName: 'Member One', auditTrail: [
      { at: '2025-01-02T03:00:00Z', actor: 'Manager One', action: 'INFORMATION_REQUESTED', details: 'Request an itemised quotation.' },
      { at: '2025-01-02T02:30:00Z', actor: 'SyncAI Notification Adapter', action: 'DISPATCHED', details: 'Clarification notice dispatched.' },
      { at: '2025-01-02T02:00:00Z', actor: 'Member One', action: 'SUBMITTED', details: 'Operational request submitted.' },
    ] },
    { id: 'appr-sched', requestType: 'schedule_adjustment', auditTrail: [
      { at: '2025-01-02T04:00:00Z', actor: 'Member Two', action: 'SUBMITTED', details: 'Schedule request submitted.' },
      { at: '2025-01-02T05:00:00Z', actor: 'Manager One', action: 'APPROVED', details: 'Approved the schedule change.' },
    ] },
    { id: 'appr-reassign', requestType: 'reassignment', auditTrail: [
      { at: '2025-01-02T06:00:00Z', actor: 'Member Three', action: 'SUBMITTED', details: 'Reassignment request submitted.' },
    ] },
    { id: 'appr-close', requestType: 'case_closure', auditTrail: [
      { at: '2025-01-02T07:00:00Z', actor: 'Manager Two', action: 'REJECTED', details: 'Closure evidence is incomplete.' },
      { at: '2025-01-02T06:30:00Z', actor: 'Member Four', action: 'SUBMITTED', details: 'Closure request submitted.' },
    ] },
    { id: 'appr-unsupported', requestType: 'internal_note', auditTrail: [{ at: '2025-01-02T01:00:00Z', action: 'SUBMITTED' }] },
  ] };
  const before = structuredClone(state.approvals);
  const events = collectApprovalAuditEvents(state.approvals);
  assert.equal(events.length, 8, 'each supported audit array entry is included exactly once');
  assert.deepEqual(events.map(({ event }) => event.details), [
    'Operational request submitted.',
    'Clarification notice dispatched.',
    'Request an itemised quotation.',
    'Schedule request submitted.',
    'Approved the schedule change.',
    'Reassignment request submitted.',
    'Closure request submitted.',
    'Closure evidence is incomplete.',
  ]);
  assert.deepEqual(new Set(events.map((item) => item.requestTypeLabel)), new Set([
    'Operational Change', 'Schedule Adjustment', 'Case Reassignment', 'Case Closure',
  ]));
  assert.equal(auditActionLabel('INFORMATION_REQUESTED'), 'Manager requested additional information');

  Object.assign(auditTrailView, { requestType: 'all', action: 'all', actor: 'all', date: '', requestId: '' });
  let page = String(auditTrailPage.render(state));
  assert.match(page, /Total audit events/);
  assert.match(page, /<strong>8<\/strong><span>Total audit events/);
  assert.match(page, /<strong>2<\/strong><span>Approval decisions/);
  assert.match(page, /<strong>4<\/strong><span>Request submissions/);
  assert.match(page, /<strong>1<\/strong><span>Clarification activities/);
  assert.match(page, /Request submitted/);
  assert.doesNotMatch(page, />INFORMATION_REQUESTED</, 'event identifiers are not shown as readable labels');
  assert.match(page, /data-action="audit-trail-open-request" data-id="appr-op"/);
  assert.doesNotMatch(page, /appr-unsupported/);
  assert.equal((page.match(/class="audit-event-card/g) || []).length, 7, 'every visible event has its own card');
  assert.match(page, />Approval Decision<|>Rejection</);
  assert.match(page, /audit-event-action-rejected/);
  assert.match(page, /audit-event-reference/);
  assert.doesNotMatch(page, /Clarification notice dispatched/, 'routine system notifications are hidden by default');
  assert.ok(page.indexOf('Closure evidence is incomplete.') < page.indexOf('Operational request submitted.'), 'the default feed is newest first by the stored timestamps');
  assert.match(page, /1 routine notification events are hidden by default/);

  auditTrailView.sortOrder = 'oldest';
  page = String(auditTrailPage.render(state));
  assert.ok(page.indexOf('Operational request submitted.') < page.indexOf('Closure evidence is incomplete.'), 'oldest-first uses parsed event timestamps');
  auditTrailView.sortOrder = 'newest';
  auditTrailView.includeNotifications = true;
  page = String(auditTrailPage.render(state));
  assert.match(page, /Clarification notice dispatched/);
  assert.match(page, /8 shown/);
  auditTrailView.includeNotifications = false;
  auditTrailView.action = 'DISPATCHED';
  assert.match(String(auditTrailPage.render(state)), /Clarification notice dispatched/, 'the event-type filter can reveal notification events without the toggle');
  auditTrailView.action = 'all';

  auditTrailView.requestType = 'case_closure';
  page = String(auditTrailPage.render(state));
  assert.match(page, /appr-close/);
  assert.doesNotMatch(page, /appr-op/);
  auditTrailView.requestType = 'all';
  auditTrailView.action = 'APPROVED';
  page = String(auditTrailPage.render(state));
  assert.match(page, /Approved the schedule change/);
  assert.doesNotMatch(page, /Request an itemised quotation/);
  auditTrailView.action = 'all';
  auditTrailView.actor = 'Manager Two';
  page = String(auditTrailPage.render(state));
  assert.match(page, /Closure evidence is incomplete/);
  assert.doesNotMatch(page, /Approved the schedule change/);
  auditTrailView.actor = 'all';
  auditTrailView.date = '2025-01-02';
  assert.match(String(auditTrailPage.render(state)), /7 shown/);
  auditTrailView.date = '';
  auditTrailView.requestId = 'APPR-REASSIGN';
  page = String(auditTrailPage.render(state));
  assert.match(page, /Reassignment request submitted/);
  assert.doesNotMatch(page, /Schedule request submitted/);
  Object.assign(auditTrailView, { scopedRequestId: 'appr-op', requestType: 'all', action: 'all', actor: 'all', date: '', requestId: 'appr-op', includeNotifications: true });
  page = String(auditTrailPage.render(state));
  assert.match(page, /Filtered to one request/);
  assert.match(page, /Repair damaged pipe/);
  assert.match(page, /Operational Change/);
  assert.match(page, /Member One/);
  assert.match(page, /Clear Filter \/ View All Events/);
  assert.match(page, /Request an itemised quotation/);
  assert.match(page, /Clarification notice dispatched/);
  assert.doesNotMatch(page, /appr-close|appr-sched|appr-reassign/);
  Object.assign(auditTrailView, { scopedRequestId: '', requestType: 'all', action: 'all', actor: 'all', date: '', requestId: '', includeNotifications: false });
  page = String(auditTrailPage.render(state));
  assert.match(page, /appr-close/);
  Object.assign(auditTrailView, { requestType: 'all', action: 'all', actor: 'all', date: '', requestId: '' });
  assert.deepEqual(state.approvals, before, 'aggregation and page rendering must not modify audit records');

  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /'audit-trail': \{ id: 'audit-trail', label: 'Audit Trail'/);
  assert.match(app, /'approval-governance', 'audit-trail'/);
  assert.match(app, /audit-trail-open-request/);
  assert.match(app, /audit-trail-sort/);
  assert.match(app, /audit-trail-toggle-notifications/);
  assert.match(app, /manager-governance-audit/);
  assert.match(app, /audit-trail-clear-scope/);
  assert.match(app, /scopedRequestId: approval\.id/);
  assert.match(app, /parseAuditTrailRequestRoute/);
  assert.equal(parseAuditTrailRequestRoute('#audit-trail/appr-op'), 'appr-op');
  assert.equal(parseAuditTrailRequestRoute('#audit-trail/appr%2Fspecial'), 'appr/special');
  assert.equal(parseAuditTrailRequestRoute('#audit-trail'), null);
  assert.match(app, /showManagerApprovalReview\(s, approval\)/);
  const memberSections = app.match(/\/\/ Member\s+return \[([^\]]+)\]/)?.[1] || '';
  assert.doesNotMatch(memberSections, /audit-trail/);
  assert.doesNotMatch(app, /renderApprovalHistory\(approval\)/, 'audit history is no longer embedded in manager request details');
});

test('required fields and assigned requester validation reject incomplete or unauthorized requests', () => {
  const state = createSeedState();
  setCurrentUser(state, 'member');
  const task = state.tasks.find((item) => item.ownerId !== state.currentOfficerId);
  const before = state.approvals.length;
  assert.equal(submitOperationalChangeApproval(state, task.id, requestDetails).success, false);
  const assigned = state.tasks.find((item) => item.ownerId === state.currentOfficerId);
  assert.match(submitOperationalChangeApproval(state, assigned.id, { ...requestDetails, requestedScope: '   ' }).error, /approval scope/i);
  assert.equal(state.approvals.length, before);
});

test('manager approve and reject decisions record comments and never apply operational changes', () => {
  const approved = setupRequest();
  const beforeApprovalTask = structuredClone(approved.task);
  const beforeApprovalCase = structuredClone(approved.state.cases.find((item) => item.id === approved.task.caseId));
  setCurrentUser(approved.state, 'manager');
  const approvedResult = decideApproval(approved.state, approved.approval.id, 'approved', 'Jennifer Ong', 'Approved within the submitted scope.');
  assert.equal(approvedResult.success, true);
  assert.equal(approved.approval.status, 'approved');
  assert.equal(approved.approval.decidedBy, 'Jennifer Ong');
  assert.equal(approved.approval.decision, 'Approved within the submitted scope.');
  assert.ok(approved.approval.decidedAt);
  assert.ok(approved.approval.auditTrail.some((item) => item.action === 'APPROVED' && item.details.includes(approved.approval.decision)));
  assert.deepEqual(approved.task, beforeApprovalTask);
  assert.deepEqual(approved.state.cases.find((item) => item.id === approved.task.caseId), beforeApprovalCase);
  assert.ok(getNotifications(approved.state).some((item) => item.approvalId === approved.approval.id));

  const rejected = setupRequest();
  setCurrentUser(rejected.state, 'manager');
  const rejectedResult = decideApproval(rejected.state, rejected.approval.id, 'rejected', 'Jennifer Ong', 'Quotation needs itemised pricing.');
  assert.equal(rejectedResult.success, true);
  assert.equal(rejected.approval.status, 'rejected');
  assert.equal(rejected.approval.decision, 'Quotation needs itemised pricing.');
});

test('requester cannot self-approve and operational-change requests are isolated to Approval Governance', () => {
  const { state, approval } = setupRequest();
  const selfDecision = decideApproval(state, approval.id, 'approved', 'Aisyah Rahman', 'Self approval attempt.');
  assert.equal(selfDecision.success, false);
  assert.equal(approval.status, 'pending');
  setCurrentUser(state, 'manager');
  const teamView = String(teamPage.render(state));
  const managerView = String(approvalGovernancePage.render(state));
  assert.doesNotMatch(teamView, new RegExp(approval.id));
  assert.match(managerView, new RegExp(approval.id));
  assert.match(managerView, /View Details/);
  assert.match(managerView, /View Audit/);
});

test('task detail preserves schedule change while My Requests owns operational-change submission', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const myRequests = readFileSync(new URL('../js/pages/my-requests.js', import.meta.url), 'utf8');
  const taskDetails = app.slice(app.indexOf('function showTaskDetailModal'), app.indexOf('function showManagerApprovalReview'));
  assert.match(taskDetails, /data-action="request-task-adjustment"[\s\S]*?Request Schedule Change/);
  assert.doesNotMatch(taskDetails, /Request Approval/);
  assert.match(app, /requestType: 'schedule_adjustment'/);
  assert.match(myRequests, /data-action="task-request-approval"/);
  assert.match(myRequests, /Submit Approval Request/);
  assert.match(app, /operational-change-approval-form/);
});

test('Approval Governance lists each confirmed manager-review type and supports type and status filters', () => {
  const state = createSeedState();
  setCurrentUser(state, 'member');
  const task = state.tasks.find((item) => item.ownerId === state.currentOfficerId);
  assert.ok(task);

  const added = [
    createApprovalRequest(state, { requestType: 'operational_change', taskId: task.id, taskTitle: task.title, requesterId: state.currentOfficerId, requesterName: 'Aisyah Rahman', reason: 'Operational change request.' }),
    createApprovalRequest(state, { requestType: 'reassign', taskId: task.id, taskTitle: 'Case reassignment request', caseId: task.caseId, requesterId: state.currentOfficerId, requesterName: 'Aisyah Rahman', proposedOwnerId: 'o2', reason: 'Recorded reassignment reason.' }),
    createApprovalRequest(state, { requestType: 'case_closure', taskId: task.id, taskTitle: 'Case closure request', caseId: task.caseId, requesterId: state.currentOfficerId, requesterName: 'Aisyah Rahman', reason: 'Recorded closure reason.' }),
  ];
  const legacySeed = state.approvals.find((item) => item.requestType === 'reassignment');
  const scheduleSeed = state.approvals.find((item) => item.requestType === 'schedule_adjustment');
  assert.ok(legacySeed);
  assert.ok(scheduleSeed);

  setCurrentUser(state, 'manager');
  approvalGovernanceView.typeFilter = 'all';
  approvalGovernanceView.statusFilter = 'all';
  const all = String(approvalGovernancePage.render(state));
  for (const request of [legacySeed, scheduleSeed, ...added]) assert.ok(all.includes(request.id));
  for (const label of ['Operational Change', 'Schedule Adjustment', 'Case Reassignment', 'Case Closure']) assert.ok(all.includes(label));
  assert.match(all, /Total Requests/);
  assert.match(all, /Pending/);
  assert.match(all, /Approved/);
  assert.match(all, /Rejected/);
  assert.match(all, /View Details/);
  assert.match(all, /data-action="manager-governance-audit"/);

  approvalGovernanceView.typeFilter = 'case_closure';
  const closureOnly = String(approvalGovernancePage.render(state));
  assert.ok(closureOnly.includes(added[2].id));
  assert.ok(!closureOnly.includes(added[0].id));
  assert.match(closureOnly, /Case Closure/);

  approvalGovernanceView.typeFilter = 'all';
  approvalGovernanceView.statusFilter = 'approved';
  const approvedOnly = String(approvalGovernancePage.render(state));
  assert.ok(approvedOnly.includes(scheduleSeed.id));
  assert.ok(!approvedOnly.includes(legacySeed.id));
  assert.match(approvedOnly, /hero-stat"><strong>1<\/strong><span>Total Requests/);
  assert.match(approvedOnly, /hero-stat"><strong>0<\/strong><span>Pending/);
  assert.match(approvedOnly, /hero-stat"><strong>1<\/strong><span>Approved/);

  approvalGovernanceView.typeFilter = 'all';
  approvalGovernanceView.statusFilter = 'all';
});

test('manager Request History renders stored events oldest first without changing audit records', () => {
  const auditTrail = [
    { at: '2025-03-02T10:00:00+08:00', actor: 'Jennifer Ong', action: 'APPROVED', channel: 'In-App', details: 'Approved within the requested scope.' },
    { at: '2025-03-02T09:00:00+08:00', actor: 'Aisyah Rahman', action: 'SUBMITTED', channel: 'In-App', details: 'Submitted for manager review.' },
    { at: '2025-03-02T09:01:00+08:00', actor: 'SyncAI Notification Adapter', action: 'DISPATCHED', channel: 'Teams (Proposed)', details: 'Sent approval card.' },
  ];
  const before = structuredClone(auditTrail);
  const history = String(renderApprovalHistory({ auditTrail }));
  assert.ok(history.indexOf('Request submitted') < history.indexOf('Notification dispatched'));
  assert.ok(history.indexOf('Notification dispatched') < history.indexOf('Request approved'));
  assert.ok(history.includes('Aisyah Rahman'));
  assert.ok(history.includes('SyncAI Notification Adapter'));
  assert.ok(history.includes('Jennifer Ong'));
  assert.ok(history.includes('Approved within the requested scope.'));
  assert.ok(history.includes('2025'));
  assert.deepEqual(auditTrail, before, 'rendering history must not mutate the stored audit array');
});

test('manager Request History handles operational, schedule, and reassignment records plus missing history data', () => {
  const seeded = createSeedState();
  const schedule = seeded.approvals.find((item) => item.requestType === 'schedule_adjustment');
  const reassignment = seeded.approvals.find((item) => item.requestType === 'reassignment');
  const closure = createApprovalRequest(seeded, { requestType: 'case_closure', taskTitle: 'Case closure request', caseId: 'case-history-test', reason: 'Recorded closure request.' });
  assert.ok(schedule);
  assert.ok(reassignment);
  assert.equal(schedule.submissionVersions, undefined, 'schedule-adjustment records do not receive operational-change snapshots');
  assert.equal(reassignment.submissionVersions, undefined, 'reassignment records do not receive operational-change snapshots');
  assert.match(String(renderApprovalHistory(schedule)), /Request approved/);
  assert.match(String(renderApprovalHistory(reassignment)), /Request submitted/);
  assert.match(String(renderApprovalHistory(closure)), /Request submitted/);

  const operational = setupRequest();
  setCurrentUser(operational.state, 'manager');
  assert.equal(decideApproval(operational.state, operational.approval.id, 'rejected', 'Jennifer Ong', 'Please provide a revised quotation.').success, true);
  const operationalHistory = String(renderApprovalHistory(operational.approval));
  assert.match(operationalHistory, /Request submitted/);
  assert.match(operationalHistory, /Request rejected/);
  assert.match(operationalHistory, /Please provide a revised quotation\./);

  assert.match(String(renderApprovalHistory({ auditTrail: [] })), /No history available yet\./);
  const partial = String(renderApprovalHistory({ auditTrail: [{ action: 'SUBMITTED', details: 'Timestamp and actor are absent.' }] }));
  assert.match(partial, /Request submitted/);
  assert.match(partial, /Timestamp and actor are absent\./);
  assert.doesNotMatch(partial, /Actor:|Not recorded/);

  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const managerDetails = app.slice(app.indexOf('function showManagerApprovalReview'), app.indexOf('function showRequesterApprovalRequestDetails'));
  assert.doesNotMatch(managerDetails, /renderApprovalHistory\(approval\)/);
  assert.match(managerDetails, /renderOperationalChangeVersionHistory\(approval\)/);
  assert.match(managerDetails, /manager-governance-decision-form/);
});

test('operational-change clarification supports repeated rounds on the same request and preserves original work', () => {
  const { state, task, originalTask, originalCase, approval } = setupRequest();
  const originalVersion = structuredClone(approval.submissionVersions[0]);
  const originalRequest = {
    unexpectedSituation: approval.unexpectedSituation,
    reason: approval.reason,
    proposedChanges: approval.proposedChanges,
    requestedScope: approval.requestedScope,
  };
  setCurrentUser(state, 'manager');
  assert.equal(requestApprovalInformation(state, approval.id, '   ').success, false, 'empty manager clarification is rejected');
  assert.equal(approval.status, 'pending');
  assert.equal(approval.submissionVersions.length, 1);

  const firstQuestion = 'Please attach the itemised contractor quotation.';
  assert.equal(requestApprovalInformation(state, approval.id, firstQuestion).success, true);
  assert.equal(approval.status, 'information_required');
  assert.equal(getOutstandingApprovalInformation(approval).details, firstQuestion);
  assert.equal(state.approvals.filter((item) => item.id === approval.id).length, 1);
  assert.ok(getNotifications(state).some((notification) => notification.approvalId === approval.id
    && notification.type === 'approval_information_required' && notification.recipientId === approval.requesterId));
  assert.deepEqual(task, originalTask);
  assert.deepEqual(state.cases.find((item) => item.id === task.caseId), originalCase);

  setCurrentUser(state, 'member');
  const memberView = String(myRequestsPage.render(state));
  assert.match(memberView, /Information Required/);
  assert.match(memberView, new RegExp(firstQuestion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(submitApprovalInformation(state, approval.id, '   ').success, false, 'empty requester response is rejected');
  assert.equal(approval.submissionVersions.length, 1);
  setCurrentUser(state, 'o2');
  assert.equal(submitApprovalInformation(state, approval.id, 'Unauthorised response.').success, false, 'another member cannot respond');
  assert.equal(approval.submissionVersions.length, 1);

  setCurrentUser(state, 'member');
  const firstResponse = 'The contractor quotation is attached as reference Q-421.';
  assert.equal(submitApprovalInformation(state, approval.id, firstResponse).success, true);
  assert.equal(approval.status, 'pending');
  assert.equal(approval.submissionVersions.length, 2);
  assert.equal(approval.submissionVersions[1].version, 2);
  assert.equal(approval.submissionVersions[1].supplementaryResponse, firstResponse);
  assert.equal(approval.submissionVersions[1].clarificationQuestion, firstQuestion);
  assert.equal(approval.submissionVersions[1].submittedById, approval.requesterId);
  assert.deepEqual(approval.submissionVersions[0], originalVersion, 'Version 1 remains unchanged after the first response');
  assert.equal(getOutstandingApprovalInformation(approval), null);
  assert.ok(getNotifications(state).some((notification) => notification.approvalId === approval.id
    && notification.type === 'approval_information_provided' && notification.recipientId === approval.assignedManagerId));
  assert.deepEqual({
    unexpectedSituation: approval.unexpectedSituation,
    reason: approval.reason,
    proposedChanges: approval.proposedChanges,
    requestedScope: approval.requestedScope,
  }, originalRequest);

  setCurrentUser(state, 'manager');
  const secondQuestion = 'Please confirm whether the quote includes disposal.';
  assert.equal(requestApprovalInformation(state, approval.id, secondQuestion).success, true);
  setCurrentUser(state, 'member');
  const secondResponse = 'Disposal is included in the quotation.';
  assert.equal(submitApprovalInformation(state, approval.id, secondResponse).success, true);
  assert.equal(state.approvals.filter((item) => item.id === approval.id).length, 1);
  assert.equal(approval.status, 'pending');
  assert.equal(approval.submissionVersions.length, 3, 'one response creates exactly one version');
  assert.deepEqual(approval.submissionVersions.map((version) => version.version), [1, 2, 3]);
  assert.equal(approval.submissionVersions[2].supplementaryResponse, secondResponse);
  assert.equal(approval.submissionVersions[2].clarificationQuestion, secondQuestion);
  assert.deepEqual(approval.submissionVersions[0], originalVersion, 'Version 1 remains unchanged after repeated responses');
  assert.deepEqual(task, originalTask);
  assert.deepEqual(state.cases.find((item) => item.id === task.caseId), originalCase);

  const history = String(renderApprovalHistory(approval));
  for (const eventText of [firstQuestion, firstResponse, secondQuestion, secondResponse]) assert.ok(history.includes(eventText));
  assert.ok(history.includes('Manager requested additional information'));
  assert.ok(history.includes('Requester submitted additional information'));
  assert.ok(history.indexOf(firstQuestion) < history.indexOf(firstResponse));
  assert.ok(history.indexOf(firstResponse) < history.indexOf(secondQuestion));
  assert.ok(history.indexOf(secondQuestion) < history.indexOf(secondResponse));
  assert.ok(history.includes('Jennifer Ong'));
  assert.ok(history.includes('Aisyah Rahman'));
  for (const event of approval.auditTrail.filter((item) => ['INFORMATION_REQUESTED', 'INFORMATION_PROVIDED'].includes(item.action))) {
    assert.ok(history.includes(new Date(event.at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })));
  }

  const versionHistory = String(renderOperationalChangeVersionHistory(approval));
  assert.match(versionHistory, /Version 1 - Original submission/);
  assert.match(versionHistory, /Version 3 - Current submission/);
  assert.match(versionHistory, /Submitted by:/);
  assert.match(versionHistory, /Disposal is included in the quotation/);
  assert.doesNotMatch(versionHistory, /<textarea|<input|<button/);
  assert.match(String(renderOperationalChangeVersionComparison(approval)), /Newly added information/);
  assert.match(String(renderOperationalChangeVersionComparison(approval)), /Unchanged information/);
  assert.deepEqual(getOperationalChangeVersions(approval), approval.submissionVersions);

  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /manager-request-approval-information/);
  assert.match(app, /request-approval-information-form/);
  assert.match(app, /requester-approval-information-form/);
});

test('operational-change version comparison reports additions, changes, unchanged fields, and ignores missing latest values', () => {
  const comparison = String(renderOperationalChangeVersionComparison({
    requestType: 'operational_change',
    submissionVersions: [
      { version: 1, request: { unexpectedSituation: 'Same situation', reason: 'Original reason', proposedChanges: '', requestedScope: 'Existing scope' } },
      { version: 2, request: { unexpectedSituation: 'Same situation', reason: 'Updated reason', proposedChanges: 'New proposed work', requestedScope: '' }, supplementaryResponse: 'Added response' },
    ],
  }));
  assert.match(comparison, /Newly added information/);
  assert.match(comparison, /New proposed work/);
  assert.match(comparison, /Added response/);
  assert.match(comparison, /Changed information/);
  assert.match(comparison, /Original reason/);
  assert.match(comparison, /Updated reason/);
  assert.match(comparison, /Unchanged information/);
  assert.match(comparison, /Same situation/);
  assert.doesNotMatch(comparison, /Requested approval scope:/, 'a missing latest value is not classified as changed');
});

test('My Requests shows the member task picker and submitted record while Approval Governance sees the same record', () => {
  const { state, task, approval } = setupRequest();
  const requestTotal = state.approvals.filter((item) => item.id === approval.id).length;
  const memberView = String(myRequestsPage.render(state));
  assert.equal(requestTotal, 1);
  assert.match(memberView, new RegExp(`value="${task.id}"`));
  assert.match(memberView, new RegExp(approval.id));
  assert.match(memberView, /data-action="task-request-approval"/);
  assert.match(memberView, /Submit Approval Request/);

  setCurrentUser(state, 'manager');
  const managerView = String(approvalGovernancePage.render(state));
  assert.match(managerView, new RegExp(approval.id));
});

test('My Requests filters both request types by status and requester without changing shared records', () => {
  const state = createSeedState();
  setCurrentUser(state, 'member');
  const task = state.tasks.find((item) => item.ownerId === state.currentOfficerId);
  assert.ok(task);
  const originalTask = structuredClone(task);
  const records = {};
  const types = ['operational_change', 'schedule_adjustment'];
  for (const type of types) {
    for (const status of ['pending', 'approved', 'rejected']) {
      records[`${type}-${status}`] = createApprovalRequest(state, {
        requestType: type,
        taskId: task.id,
        taskTitle: task.title,
        requesterId: state.currentOfficerId,
        requesterName: 'Aisyah Rahman',
        requesterRole: 'team_member',
        originalSchedule: 'Recorded original schedule: today at 17:00',
        proposedSchedule: 'Recorded requested schedule: next working day at 10:00',
        reason: 'Submitted change request with a recorded reason.',
        unexpectedSituation: 'Additional situation details recorded.',
        proposedChanges: 'Recorded proposed changes.',
        requestedScope: 'Recorded requested scope.',
      });
    }
  }
  const privateRecord = createApprovalRequest(state, {
    requestType: 'schedule_adjustment',
    taskId: task.id,
    taskTitle: task.title,
    requesterId: 'o3',
    requesterName: 'Priya Nair',
    requesterRole: 'team_member',
    reason: 'Another member private request.',
  });

  setCurrentUser(state, 'manager');
  for (const [key, approval] of Object.entries(records)) {
    const status = key.endsWith('-approved') ? 'approved' : key.endsWith('-rejected') ? 'rejected' : null;
    if (status) assert.equal(decideApproval(state, approval.id, status, 'Jennifer Ong', `Decision for ${status}.`).success, true);
  }
  setCurrentUser(state, 'member');

  myRequestsView.typeFilter = 'all';
  const all = String(myRequestsPage.render(state));
  for (const approval of Object.values(records)) assert.ok(all.includes(approval.id));
  assert.ok(all.includes('Operational Change'));
  assert.ok(all.includes('Schedule Adjustment'));
  assert.ok(!all.includes(privateRecord.id), 'a different requester\'s record must stay private');
  assert.match(all, /hero-stat"><strong>2<\/strong><span>Pending/);
  assert.match(all, /hero-stat"><strong>3<\/strong><span>Approved/);
  assert.match(all, /hero-stat"><strong>2<\/strong><span>Rejected/);

  myRequestsView.typeFilter = 'operational_change';
  const operational = String(myRequestsPage.render(state));
  for (const [key, approval] of Object.entries(records)) {
    assert.equal(operational.includes(approval.id), key.startsWith('operational_change-'));
  }
  myRequestsView.typeFilter = 'schedule_adjustment';
  const schedule = String(myRequestsPage.render(state));
  for (const [key, approval] of Object.entries(records)) {
    assert.equal(schedule.includes(approval.id), key.startsWith('schedule_adjustment-'));
  }
  myRequestsView.typeFilter = 'all';

  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /Original schedule:<\/strong><p>\$\{originalSchedule\}/);
  assert.match(app, /Requested schedule:<\/strong><p>\$\{requestedSchedule\}/);
  assert.match(app, /Manager decision/);
  assert.deepEqual(task, originalTask);
});
