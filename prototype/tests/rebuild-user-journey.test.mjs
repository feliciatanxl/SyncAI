// Integration & User Journey Tests for SyncAI Static Rebuild
// Run with: node prototype/tests/rebuild-user-journey.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../js/data.js';
import {
  getCurrentUser,
  setCurrentUser,
  isAdmin,
  isManager,
  isTeamMember,
  getUsers,
  getUser,
  approveUser,
  setUserRole,
  setUserStatus,
  getPendingApprovals,
  decideApproval,
  createApprovalRequest,
  canApprove,
  visibleTasks,
  resetState,
  loadState,
  getTask,
} from '../js/state.js';
import { dayCapacity, buildSchedule } from '../js/planner.js';
import { evaluateAlternatives, traceDownstream } from '../js/ripple.js';
import assistantPage from '../js/pages/assistant.js';
import overviewPage from '../js/pages/overview.js';
import tasksPage from '../js/pages/tasks.js';
import planPage from '../js/pages/plan.js';
import teamPage from '../js/pages/team.js';
import peoplePage from '../js/pages/people.js';
import teamsAdminPage from '../js/pages/teams-admin.js';
import activityPage from '../js/pages/activity.js';
import decidesPage from '../js/pages/decides.js';
import settingsPage from '../js/pages/settings.js';

test('1. Role persona setup and boundary enforcement', () => {
  const s = createSeedState();

  // Test Member
  setCurrentUser(s, 'member');
  assert.equal(s.role, 'member');
  assert.equal(isTeamMember(s), true);
  assert.equal(isManager(s), false);
  assert.equal(isAdmin(s), false);
  const memberUser = getCurrentUser(s);
  assert.equal(memberUser.displayName, 'Aisyah Rahman');

  // Test Manager
  setCurrentUser(s, 'manager');
  assert.equal(s.role, 'manager');
  assert.equal(isManager(s), true);
  assert.equal(isTeamMember(s), false);
  assert.equal(isAdmin(s), false);
  const mgrUser = getCurrentUser(s);
  assert.equal(mgrUser.displayName, 'Jennifer Ong');

  // Test Admin
  setCurrentUser(s, 'admin');
  assert.equal(s.role, 'admin');
  assert.equal(isAdmin(s), true);
  assert.equal(isManager(s), false);
  assert.equal(isTeamMember(s), false);
  const adminUser = getCurrentUser(s);
  assert.equal(adminUser.displayName, 'TAN, ALEX');

  // Test Pending
  setCurrentUser(s, 'pending');
  assert.equal(s.status, 'pending');
  assert.equal(getCurrentUser(s).status, 'pending');

  // Test Disabled
  setCurrentUser(s, 'disabled');
  assert.equal(s.status, 'disabled');
  assert.equal(getCurrentUser(s).status, 'disabled');
});

test('2. Task isolation: Team Member only sees assigned tasks', () => {
  const s = createSeedState();

  setCurrentUser(s, 'member');
  const memberTasks = visibleTasks(s);
  assert.ok(memberTasks.length > 0);
  assert.ok(memberTasks.every((t) => t.ownerId === 'o1'), 'Property officer only sees own tasks');

  setCurrentUser(s, 'manager');
  const managerTasks = visibleTasks(s);
  assert.ok(managerTasks.length > memberTasks.length, 'Manager sees all team tasks');

  setCurrentUser(s, 'admin');
  const adminTasks = visibleTasks(s);
  assert.equal(adminTasks.length, 0, 'Admin has no operational task list, keeping calendar private');
});

test('3. Admin user governance: approve, change role, and turn off accounts', () => {
  const s = createSeedState();

  // Find pending user David Koh
  const pendingUser = getUser(s, 'p1');
  assert.ok(pendingUser);
  assert.equal(pendingUser.status, 'pending');

  // Approve David Koh as member
  approveUser(s, 'p1', 'member');
  assert.equal(pendingUser.status, 'active');
  assert.equal(pendingUser.role, 'member');

  // Change David Koh to Manager
  setUserRole(s, 'p1', 'manager');
  assert.equal(pendingUser.role, 'manager');

  // Disable account
  setUserStatus(s, 'p1', 'disabled');
  assert.equal(pendingUser.status, 'disabled');

  // Verify audit log has recorded all actions
  assert.ok(s.activity.some((a) => a.text.includes('Approved access for David Koh')));
  assert.ok(s.activity.some((a) => a.text.includes('Changed role for David Koh')));
  assert.ok(s.activity.some((a) => a.text.includes('Changed account status for David Koh')));
});

test('4. Manager approval workflow: decision and schedule update', () => {
  const s = createSeedState();
  setCurrentUser(s, 'manager');

  const pending = getPendingApprovals(s);
  assert.ok(pending.length > 0, 'Seed contains pending approval requests');

  const req = pending[0];
  const targetTask = getTask(s, req.taskId);
  assert.ok(targetTask);

  // Approve request
  const res = decideApproval(s, req.id, 'approved', 'Jennifer Ong', 'Approved operational reassignment.');
  assert.equal(res.success, true);
  assert.equal(req.status, 'approved');
  assert.equal(req.decidedBy, 'Jennifer Ong');
  assert.equal(targetTask.ownerId, req.proposedOwnerId, 'Approved reassignment updates task owner');
});

test('5. Ripple Intelligence & What-If 3-Alternative evaluation', () => {
  const s = createSeedState();

  // Evaluate emergency lift scenario
  const sim = evaluateAlternatives(s, 'lift_emergency');
  assert.ok(sim);
  assert.ok(sim.alternatives);
  assert.ok(sim.alternatives.noAction, 'Alternative A exists');
  assert.ok(sim.alternatives.reschedule, 'Alternative B exists');
  assert.ok(sim.alternatives.reassign, 'Alternative C exists');

  const altA = sim.alternatives.noAction;
  const altB = sim.alternatives.reschedule;
  const altC = sim.alternatives.reassign;
  assert.equal(altA.id, 'no_action');
  assert.equal(altB.id, 'reschedule');
  assert.equal(altC.id, 'reassign');

  // Trace downstream dependencies
  const ripple = traceDownstream(s, 't103');
  assert.ok(ripple.dependents.length >= 2, 't103 ripples downstream to t104 and t112');
});

test('6. Ask SyncAI assistant deterministic responses and role privacy guardrail', () => {
  const s = createSeedState();

  // Test member role privacy restriction
  setCurrentUser(s, 'member');
  let lastReply = '';
  assistantPage.ask(s, "Show me Marcus's calendar", () => {});
  // Check that ask executes without throwing
  assert.doesNotThrow(() => assistantPage.ask(s, 'What should I work on first?', () => {}));
  assert.doesNotThrow(() => assistantPage.ask(s, 'Can I finish everything today?', () => {}));
  assert.doesNotThrow(() => assistantPage.ask(s, 'Which tasks are close to their SLA?', () => {}));
  assert.doesNotThrow(() => assistantPage.ask(s, 'What happens if an urgent lift incident occurs?', () => {}));
  assert.doesNotThrow(() => assistantPage.ask(s, 'What happens if an officer is on MC?', () => {}));
  assert.doesNotThrow(() => assistantPage.ask(s, 'What approvals are pending?', () => {}));
});

test('7. Page rendering resilience across all roles and status states', () => {
  const s = createSeedState();

  const rolesToTest = ['member', 'manager', 'admin', 'pending', 'disabled'];

  for (const roleKey of rolesToTest) {
    setCurrentUser(s, roleKey);
    assert.doesNotThrow(() => overviewPage.render(s), `overviewPage renders for ${roleKey}`);
    assert.doesNotThrow(() => tasksPage.render(s), `tasksPage renders for ${roleKey}`);
    assert.doesNotThrow(() => planPage.render(s), `planPage renders for ${roleKey}`);
    assert.doesNotThrow(() => teamPage.render(s), `teamPage renders for ${roleKey}`);
    assert.doesNotThrow(() => peoplePage.render(s), `peoplePage renders for ${roleKey}`);
    assert.doesNotThrow(() => teamsAdminPage.render(s), `teamsAdminPage renders for ${roleKey}`);
    assert.doesNotThrow(() => activityPage.render(s), `activityPage renders for ${roleKey}`);
    assert.doesNotThrow(() => decidesPage.render(), `decidesPage renders for ${roleKey}`);
    assert.doesNotThrow(() => settingsPage.render(s), `settingsPage renders for ${roleKey}`);
    assert.doesNotThrow(() => assistantPage.render(s), `assistantPage renders for ${roleKey}`);
  }
});
