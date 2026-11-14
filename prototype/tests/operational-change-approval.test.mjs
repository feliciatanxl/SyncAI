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
} from '../js/state.js';
import teamPage from '../js/pages/team.js';
import myRequestsPage, { myRequestsView } from '../js/pages/my-requests.js';
import approvalGovernancePage, { approvalGovernanceView } from '../js/pages/approval-governance.js';

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
  assert.equal(approval.unexpectedSituation, requestDetails.unexpectedSituation);
  assert.equal(approval.reason, requestDetails.reason);
  assert.equal(approval.proposedChanges, requestDetails.proposedChanges);
  assert.equal(approval.requestedScope, requestDetails.requestedScope);
  assert.deepEqual(approval.supportingEvidence, requestDetails.supportingEvidence);
  assert.deepEqual(task, originalTask);
  assert.deepEqual(state.cases.find((item) => item.id === task.caseId), originalCase);
  assert.ok(approval.auditTrail.some((item) => item.action === 'SUBMITTED'));
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
