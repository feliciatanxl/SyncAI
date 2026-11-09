// Tests for EM Services PS 12i Client-Informed Requirements:
// Prioritisation criteria, SLAs, appointments, hierarchical approvals,
// self-approval restrictions, auditable notifications, and simulation isolation.
// Run from repo root: node --test prototype/tests/client-requirements.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../js/data.js';
import { scoreTask } from '../js/ai.js';
import { assessRisk, schedule } from '../js/planner.js';
import { analyzeScenarioRipple, evaluateAlternatives } from '../js/ripple.js';
import { runSimulation, commitSimulation } from '../js/simulation.js';
import {
  getApprovals,
  getPendingApprovals,
  getApproval,
  canApprove,
  createApprovalRequest,
  decideApproval,
  getNotifications,
  addNotification,
  isManager,
  isTeamMember,
  isAdmin,
  resetState,
  loadState,
} from '../js/state.js';
import { TODAY, NOW, dt, workDay } from '../js/time.js';

const seed = () => createSeedState();

test('1. Client-priority criteria: 4-tier focus is structured and distinct from operational model', () => {
  const s = seed();
  const task = s.tasks.find((t) => t.id === 't101');
  const res = scoreTask(s, task);

  assert.ok(res.clientCriteria, 'returns clientCriteria object');
  assert.equal(res.clientCriteria.clientOrder, '1. Service · 2. Safety · 3. Residents’ well-being · 4. Actual concern / urgency');
  assert.ok(res.clientCriteria.validationNote.includes('operational validation with EM Services'));
  assert.ok(res.assumptions.some((a) => a.includes('illustrative weights')), 'contains prototype assumptions disclaimer');
});

test('2. Conflicting priorities: routine service cannot override imminent danger or statutory constraints', () => {
  const s = seed();
  // Routine admin task with medium priority
  const routineAdmin = {
    id: 'test_admin',
    title: 'File weekly paper form',
    category: 'Admin',
    priority: 'Medium',
    due: dt(workDay(3), '17:00'),
    effort: 1,
    status: 'todo',
    safety: false,
    statutory: false,
    ownerId: 'o1',
  };
  // Imminent danger lift entrapment
  const dangerLift = {
    id: 'test_danger',
    title: 'Lift failure with passenger trapped',
    category: 'Maintenance',
    priority: 'Critical',
    due: dt(TODAY, '12:00'),
    effort: 2,
    status: 'todo',
    safety: true,
    statutory: false,
    ownerId: 'o1',
  };

  const adminScore = scoreTask(s, routineAdmin).score;
  const dangerScore = scoreTask(s, dangerLift).score;

  assert.ok(dangerScore > adminScore, `Imminent danger (${dangerScore}) must outrank routine service (${adminScore})`);
  assert.ok(dangerScore >= 70, 'Emergency safety hazard falls in Do Now band');
});

test('3. Repeat complaints volume alone does not inflate priority over genuine safety hazards', () => {
  const s = seed();
  const noisyComplaint = {
    id: 'test_noise',
    title: 'Corridor littering repeat calls',
    category: 'Cleaning',
    priority: 'Low',
    due: dt(workDay(3), '17:00'),
    effort: 1,
    status: 'todo',
    complaints: 15, // High volume of repeat calls
    safety: false,
    statutory: false,
    ownerId: 'o1',
  };
  const safetyHazard = {
    id: 'test_safety',
    title: 'Exposed wire at void deck pillar',
    category: 'Maintenance',
    priority: 'High',
    due: dt(TODAY, '17:00'),
    effort: 1,
    status: 'todo',
    complaints: 0,
    safety: true,
    ownerId: 'o1',
  };

  const noisyRes = scoreTask(s, noisyComplaint);
  const safetyRes = scoreTask(s, safetyHazard);

  const complaintReason = noisyRes.reasons.find((r) => r.label.includes('repeat complaints recorded'));
  assert.ok(complaintReason, 'identifies repeat complaints');
  assert.equal(complaintReason.points, 0, 'repeat complaint volume awards exactly 0 points');
  assert.ok(safetyRes.score > noisyRes.score, 'unreported safety hazard outranks high-complaint routine cleaning');
});

test('4. SLA deadlines: tight SLA windows and breached SLAs elevate risk and score', () => {
  const s = seed();
  const breachedTask = {
    id: 'test_sla_breach',
    title: 'Pump breakdown response',
    category: 'Maintenance',
    priority: 'High',
    due: dt(TODAY, '10:00'),
    slaDue: dt(TODAY, '08:00'), // Expired 8:00am today (NOW is 08:30)
    slaType: 'Emergency SLA (2h)',
    effort: 1,
    status: 'todo',
    ownerId: 'o1',
  };

  const risk = assessRisk(s, breachedTask);
  assert.equal(risk.level, 'high', 'breached SLA produces high risk');
  assert.ok(risk.reasons.some((r) => r.includes('SLA deadline breached')), 'specifies SLA breach in risk reasons');

  const sc = scoreTask(s, breachedTask);
  assert.ok(sc.reasons.some((r) => r.type === 'sla'), 'scoreTask includes SLA penalty reason');
});

test('5. Repair appointments: fixed resident commitments are tracked and protected', () => {
  const s = seed();
  const apptTask = s.tasks.find((t) => t.id === 't103');
  assert.ok(apptTask.appointmentTime, 't103 has a resident appointment time');

  const risk = assessRisk(s, apptTask);
  assert.ok(risk.reasons.some((r) => r.includes('Commitment window') || r.includes('appointment')), 'assesses appointment commitment');

  const sc = scoreTask(s, apptTask);
  assert.ok(sc.reasons.some((r) => r.type === 'appointment'), 'scoreTask includes appointment protection reason');
});

test('6. Ripple dependency effects: traces multi-level downstream tasks and consequence exposure', () => {
  const s = seed();
  // t103 (Site check Blk 211) -> t104 (Resident call) -> t112 (Contractor work-order)
  const scRipple = analyzeScenarioRipple(s, { incident: 'lift', incidentAssignee: 'o1' });

  assert.ok(scRipple.directAffectedTaskIds.includes('t103'), 't103 is directly displaced by Blk 214 lift incident');
  assert.ok(scRipple.downstreamTaskIds.includes('t104'), 't104 is in downstream set');
  assert.ok(scRipple.downstreamTaskIds.includes('t112'), 't112 is in downstream set');
  assert.ok(scRipple.potentialConsequences.some((c) => c.consequence.includes('spalling') || c.consequence.includes('corrosion')));
});

test('7. Three-alternative evaluation: assesses SLA breaches and appointment displacement', () => {
  const s = seed();
  const evalResult = evaluateAlternatives(s, { incident: 'lift', incidentAssignee: 'o1' });

  const { noAction, reschedule, reassign } = evalResult.alternatives;
  assert.equal(noAction.isFeasible, false, 'Alternative A (No Action) is infeasible');
  assert.ok(noAction.slaBreaches.length >= 1, 'No Action reports SLA breaches');

  // Alternative C reassigns work to qualified officer with capacity
  assert.ok(reassign.reassignmentsCount >= 1, 'Alternative C suggests reassignments');
  assert.ok(reassign.approvalHierarchy.required, 'Alternative C flags required hierarchical approval');
  assert.equal(reassign.approvalHierarchy.selfApprovalPermitted, false, 'self-approval is explicitly prohibited');
});

test('8. Hierarchical approval: create, review, and decide approval workflow', () => {
  const s = seed();
  const initialPending = getPendingApprovals(s).length;

  // Officer o1 submits a request
  const newReq = createApprovalRequest(s, {
    requestType: 'reassignment',
    taskId: 't103',
    requesterId: 'o1',
    requesterRole: 'team_member',
    assignedManagerId: 's1',
    proposedOwnerId: 'o3',
    reason: 'Displaced by lift emergency; reassigning to protect resident appointment.',
  });

  assert.ok(newReq.id.startsWith('appr-'), 'generates approval id');
  assert.equal(newReq.status, 'pending', 'new request is pending');
  assert.equal(getPendingApprovals(s).length, initialPending + 1);

  // Deciding approval as assigned manager Jennifer Ong (s1)
  s.role = 'manager';
  const approvalRes = decideApproval(s, newReq.id, 'approved', 'Jennifer Ong', 'Approved for resident appointment continuity.');
  assert.equal(approvalRes.success, true);
  assert.equal(approvalRes.status, 'approved');

  const updatedReq = getApproval(s, newReq.id);
  assert.equal(updatedReq.status, 'approved');
  assert.equal(updatedReq.decidedBy, 'Jennifer Ong');
  assert.ok(updatedReq.auditTrail.some((ev) => ev.action === 'APPROVED'));
});

test('9. Unauthorised self-approval: requester CANNOT self-approve restricted requests', () => {
  const s = seed();
  // Team member o1 creates a request
  const req = createApprovalRequest(s, {
    requestType: 'reassignment',
    taskId: 't102',
    requesterId: 'o1',
    requesterRole: 'team_member',
    assignedManagerId: 's1',
    reason: 'Personal adjustment',
  });

  // Verify canApprove helper returns false for requester
  assert.equal(canApprove(s, req, 'o1'), false, 'requester cannot self-approve');

  // Attempting to decide as o1
  s.role = 'team_member';
  s.currentOfficerId = 'o1';
  const attemptRes = decideApproval(s, req.id, 'approved', 'Aisyah Rahman');

  assert.equal(attemptRes.success, false, 'self-approval attempt must fail');
  assert.ok(attemptRes.error.includes('Unauthorized'), 'returns unauthorized error');
  assert.equal(getApproval(s, req.id).status, 'pending', 'request remains pending');
});

test('10. Notification audit events and multi-channel simulated dispatch', () => {
  const s = seed();
  const initialNotifs = getNotifications(s).length;

  const notif = addNotification(s, {
    type: 'sla_warning',
    channel: 'whatsapp',
    recipientId: 'o1',
    title: 'SLA Warning: Blk 208 Inspection',
    summary: 'Less than 45 minutes before deadline.',
    taskId: 't101',
    secureLink: 'syncai://tasks/t101',
  });

  assert.ok(notif.id.startsWith('notif-'));
  assert.equal(notif.channel, 'whatsapp');
  assert.equal(notif.channelLabel, 'WhatsApp (Proposed)');
  assert.equal(notif.privacySafe, true, 'flagged privacy safe');
  assert.equal(getNotifications(s).length, initialNotifs + 1);
});

test('11. Simulation isolation: What-If does not mutate source state until commit', () => {
  const s = seed();
  const originalTaskCount = s.tasks.length;
  const originalTaskOwner = s.tasks.find((t) => t.id === 't103').ownerId;

  const simResult = runSimulation(s, {
    incident: 'lift',
    incidentAssignee: 'o1',
  });

  assert.equal(s.tasks.length, originalTaskCount, 'source tasks count unchanged');
  assert.equal(s.tasks.find((t) => t.id === 't103').ownerId, originalTaskOwner, 'source task owner unchanged');

  // Commit explicitly
  const { next, applied } = commitSimulation(simResult, simResult.recs.map((r) => r.id));
  assert.ok(applied.length > 0, 'applied reassignments on working copy');
  assert.equal(s.tasks.length, originalTaskCount, 'source state remains pure after commitSimulation');
});

test('12. Reset behaviour restores state cleanly from seed', () => {
  const s = seed();
  s.tasks.push({ id: 'temp_task', title: 'Temporary', status: 'todo' });
  assert.ok(s.tasks.some((t) => t.id === 'temp_task'));

  const fresh = seed();
  assert.ok(!fresh.tasks.some((t) => t.id === 'temp_task'), 'seed creates fresh unpolluted state');
});

test('13. Role boundaries: manager, team member, and admin roles correctly segregated', () => {
  const s = seed();

  s.role = 'team_member';
  assert.equal(isTeamMember(s), true);
  assert.equal(isManager(s), false);
  assert.equal(isAdmin(s), false);

  s.role = 'manager';
  assert.equal(isManager(s), true);
  assert.equal(isTeamMember(s), false);
  assert.equal(isAdmin(s), false);

  s.role = 'admin';
  assert.equal(isAdmin(s), true);
  assert.equal(isManager(s), false);
  assert.equal(isTeamMember(s), false);
});

test('14. Missing or incomplete data handled safely without throwing', () => {
  const s = seed();
  // Call with empty task object
  const emptyTask = { id: 'empty', title: 'Empty', priority: 'Low', effort: 1, due: dt(TODAY, '17:00'), status: 'todo' };
  assert.doesNotThrow(() => scoreTask(s, emptyTask));
  assert.doesNotThrow(() => assessRisk(s, emptyTask));
  assert.doesNotThrow(() => schedule(s, 'non_existent_officer'));
});
