// Shared application state with localStorage persistence. Every page reads
// from the same object so dashboards, tasks, plans and simulations agree.

import { createSeedState, DATA_VERSION } from './data.js';
import { TODAY, NOW } from './time.js';

const STORAGE_KEY = 'syncai.prototype.state';

let state = null;
let revCounter = 0;
const listeners = new Set();

export const storage = { ok: true, notice: null };

/** Give a state object a fresh revision so memoised calculations recompute. */
export function bumpRev(s) {
  s.rev = ++revCounter;
  return s;
}

export function loadState() {
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    storage.ok = false;
    storage.notice = 'Browser storage is unavailable, so changes will not be kept after you close this tab.';
  }
  if (saved && saved.version === DATA_VERSION && saved.seededFor === TODAY) {
    if (saved.role === 'officer') saved.role = 'team_member';
    else if (saved.role === 'supervisor' || saved.role === 'hq') saved.role = 'manager';
    state = saved;
  } else {
    state = createSeedState();
    if (saved) storage.notice = 'Demo data was refreshed so dates line up with today.';
    persist();
  }
  return bumpRev(state);
}

function persist() {
  if (!storage.ok) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storage.ok = false;
    storage.notice = 'Could not save to browser storage. Changes will be lost on reload.';
  }
}

export const getState = () => state;

/** Apply a mutation, persist, and re-render subscribers. */
export function update(mutator) {
  mutator(state);
  bumpRev(state);
  persist();
  listeners.forEach((fn) => fn(state));
}

export function replaceState(next) {
  state = next;
  bumpRev(state);
  persist();
  listeners.forEach((fn) => fn(state));
}

export function resetState() {
  const keepRole = state?.role;
  state = createSeedState();
  if (keepRole) state.role = keepRole;
  bumpRev(state);
  persist();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function nextId(s, prefix = 't') {
  s.nextId += 1;
  return `${prefix}${s.nextId}`;
}

export function logActivity(s, text, actor) {
  s.activity.unshift({ at: NOW, actor: actor || actorName(s), text });
  s.activity = s.activity.slice(0, 40);
}

// ----- selectors -----

export const isManager = (s) => s.role === 'manager' || s.role === 'supervisor';
export const isSupervisor = isManager;
export const isTeamMember = (s) => s.role === 'team_member' || s.role === 'member' || s.role === 'officer';
export const isAdmin = (s) => s.role === 'admin';
export const isHQ = (s) => s.role === 'hq';

export function getCurrentUser(s) {
  if (isAdmin(s)) {
    return {
      id: 'a1',
      displayName: s.admin?.displayName || s.admin?.name || 'TAN XIU LI, FELICIA',
      email: s.admin?.email || '254381c@mymail.nyp.edu.sg',
      role: 'admin',
      status: s.status || 'active',
      teams: [],
    };
  }
  if (isManager(s)) {
    return {
      id: 's1',
      displayName: s.supervisor?.name || 'Jennifer Ong',
      email: 'jennifer.ong@towncouncil.gov.sg',
      role: 'manager',
      status: s.status || 'active',
      teams: (s.teams || []).map((t) => ({ id: t.id, name: t.name, kind: 'manager' })),
    };
  }
  // Team Member or Pending / Disabled
  const off = getOfficer(s, s.currentOfficerId) || { name: 'Aisyah Rahman', email: 'aisyah.rahman@towncouncil.gov.sg' };
  const foundUser = (s.users || []).find((u) => u.id === s.currentOfficerId) || {};
  return {
    id: s.currentOfficerId || 'o1',
    displayName: foundUser.displayName || off.name,
    email: foundUser.email || off.email || `${off.name.toLowerCase().replace(/\s+/g, '.')}@towncouncil.gov.sg`,
    role: 'member',
    status: s.status || foundUser.status || 'active',
    teams: foundUser.teams || [{ id: 'team-1', name: 'Zone A Operations', kind: 'member' }],
  };
}

export function setCurrentUser(s, userOrRole) {
  if (typeof userOrRole === 'string') {
    if (userOrRole === 'admin') {
      s.role = 'admin';
      s.status = 'active';
      s.currentOfficerId = 'a1';
    } else if (userOrRole === 'manager') {
      s.role = 'manager';
      s.status = 'active';
      s.currentOfficerId = 's1';
    } else if (userOrRole === 'pending') {
      s.role = 'member';
      s.status = 'pending';
      s.currentOfficerId = 'p1';
    } else if (userOrRole === 'disabled') {
      s.role = 'member';
      s.status = 'disabled';
      s.currentOfficerId = 'd1';
    } else {
      s.role = 'member';
      s.status = 'active';
      s.currentOfficerId = 'o1';
    }
  } else if (userOrRole && typeof userOrRole === 'object') {
    s.role = userOrRole.role === 'admin' ? 'admin' : userOrRole.role === 'manager' ? 'manager' : 'member';
    s.status = userOrRole.status || 'active';
    s.currentOfficerId = userOrRole.id || 'o1';
  }
}

export function getUsers(s) {
  return s.users || [];
}

export function getUser(s, id) {
  return (s.users || []).find((u) => u.id === id);
}

export function approveUser(s, id, role = 'member') {
  const user = getUser(s, id);
  if (user) {
    user.status = 'active';
    user.role = role;
    logActivity(s, `Approved access for ${user.displayName} (${role})`, actorName(s));
  }
}

export function setUserRole(s, id, newRole) {
  const user = getUser(s, id);
  if (user) {
    const oldRole = user.role;
    user.role = newRole;
    logActivity(s, `Changed role for ${user.displayName} from ${oldRole} to ${newRole}`, actorName(s));
  }
}

export function setUserStatus(s, id, newStatus) {
  const user = getUser(s, id);
  if (user) {
    const oldStatus = user.status;
    user.status = newStatus;
    logActivity(s, `Changed account status for ${user.displayName} to ${newStatus}`, actorName(s));
  }
}

export function getTeams(s) {
  return s.teams || [];
}

export function getTeam(s, id) {
  return (s.teams || []).find((t) => t.id === id);
}

export function createTeam(s, name) {
  s.teams ||= [];
  const id = `team-${nextId(s, '')}`;
  const newTeam = {
    id,
    name,
    managers: [{ id: 's1', displayName: 'Jennifer Ong', email: 'jennifer.ong@towncouncil.gov.sg' }],
    members: [],
  };
  s.teams.push(newTeam);
  logActivity(s, `Created new operational team: ${name}`, actorName(s));
  return newTeam;
}

export function addTeamMember(s, teamId, userId) {
  const team = getTeam(s, teamId);
  const user = getUser(s, userId);
  if (team && user) {
    if (!team.members.some((m) => m.id === user.id)) {
      team.members.push({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role === 'manager' ? 'Estate Manager' : 'Property Officer',
        lastActiveAt: new Date().toISOString(),
      });
      user.teams ||= [];
      if (!user.teams.some((t) => t.id === teamId)) {
        user.teams.push({ id: team.id, name: team.name, kind: 'member' });
      }
      logActivity(s, `Added ${user.displayName} to ${team.name}`, actorName(s));
    }
  }
}

export function removeTeamMember(s, teamId, userId) {
  const team = getTeam(s, teamId);
  if (team) {
    team.members = team.members.filter((m) => m.id !== userId);
    const user = getUser(s, userId);
    if (user && user.teams) {
      user.teams = user.teams.filter((t) => t.id !== teamId);
    }
    logActivity(s, `Removed member ${userId} from ${team.name}`, actorName(s));
  }
}

export function actorName(s) {
  if (isAdmin(s)) return s.admin?.name || 'Administrator';
  return isManager(s) ? s.supervisor.name : (getOfficer(s, s.currentOfficerId)?.name || 'Property Officer');
}

export function getOfficer(s, id) {
  return s.officers.find((o) => o.id === id);
}

export function officerName(s, id) {
  return getOfficer(s, id)?.name || 'Unassigned';
}

export function getTask(s, id) {
  return s.tasks.find((t) => t.id === id);
}

export const isOpen = (t) => t.status !== 'done';

export function openTasksFor(s, officerId) {
  return s.tasks.filter((t) => t.ownerId === officerId && isOpen(t));
}

/** Tasks the current role is allowed to see. Officers only see their own. Admin has no operational task list by default. */
export function visibleTasks(s) {
  if (isAdmin(s)) return [];
  return isManager(s) ? s.tasks : s.tasks.filter((t) => t.ownerId === s.currentOfficerId);
}

export function meetingsFor(s, officerId, date) {
  return s.meetings
    .filter((m) => m.ownerIds.includes(officerId) && (!date || m.date === date))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function availabilityOn(officer, date) {
  return officer?.availability?.[date] || null;
}

export const isUnavailable = (officer, date) => !!availabilityOn(officer, date);

/** Absence labels never reveal medical details. */
export function absenceLabel(kind, supervisorView) {
  if (!kind) return '';
  if (!supervisorView) return 'Unavailable';
  return { mc: 'Medical leave', leave: 'Annual leave', training: 'Training', sim: 'Unavailable (simulated)' }[kind] || 'Unavailable';
}

export function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export const remainingHours = (t) => Math.max(t.effort - (t.spent || 0), 0.25);

export const isOverdue = (t) => isOpen(t) && t.due < NOW;

// ----- Hierarchical Approvals & Auditability -----

export function getApprovals(s) {
  return s.approvals || [];
}

export function getPendingApprovals(s) {
  return (s.approvals || []).filter((a) => a.status === 'pending');
}

export function getApproval(s, id) {
  return (s.approvals || []).find((a) => a.id === id);
}

/**
 * Check if the active user is authorised to approve this request.
 * Hierarchy Rule: Requesters CANNOT approve their own request.
 * Approver must be an authorised Manager (Estate Manager / HQ / Admin).
 */
export function canApprove(s, approval, actorId = null) {
  if (!approval) return false;
  const currentActor = actorId || (isManager(s) ? s.supervisor?.id : s.currentOfficerId);
  // Self-approval restriction
  if (approval.requesterId && approval.requesterId === currentActor) return false;
  // Role check: Only manager, hq, or admin can approve restricted workflows
  return isManager(s) || isHQ(s) || isAdmin(s);
}

export function createApprovalRequest(s, req) {
  s.approvals ||= [];
  const id = `appr-${nextId(s, '')}`;
  const approval = {
    id,
    requestType: req.requestType || 'schedule_adjustment',
    taskId: req.taskId,
    taskTitle: req.taskTitle || getTask(s, req.taskId)?.title || 'Task',
    requesterId: req.requesterId || s.currentOfficerId,
    requesterName: req.requesterName || officerName(s, req.requesterId || s.currentOfficerId),
    requesterRole: req.requesterRole || (isManager(s) ? 'manager' : 'team_member'),
    assignedManagerId: req.assignedManagerId || s.supervisor?.id || 's1',
    assignedManagerName: req.assignedManagerName || s.supervisor?.name || 'Jennifer Ong',
    escalationManagerId: req.escalationManagerId || s.hq?.id || 'h1',
    escalationManagerName: req.escalationManagerName || s.hq?.name || 'Lim Wei Ling',
    originalOwnerId: req.originalOwnerId || getTask(s, req.taskId)?.ownerId,
    originalSchedule: req.originalSchedule || 'Original schedule',
    proposedOwnerId: req.proposedOwnerId || req.originalOwnerId,
    proposedSchedule: req.proposedSchedule || 'Proposed schedule',
    reason: req.reason || 'Operational schedule adjustment',
    slaImpact: req.slaImpact || 'Within operational SLA margin',
    operationalImpact: req.operationalImpact || 'Rebalances officer workload',
    status: 'pending',
    createdAt: NOW,
    decidedAt: null,
    decidedBy: null,
    decision: null,
    auditTrail: [
      {
        at: NOW,
        actor: req.requesterName || officerName(s, req.requesterId || s.currentOfficerId),
        action: 'SUBMITTED',
        channel: 'In-App',
        details: req.reason || 'Submitted for manager review under platform hierarchy.',
      },
      {
        at: NOW,
        actor: 'SyncAI Notification Adapter',
        action: 'DISPATCHED',
        channel: 'Teams (Proposed)',
        details: `Sent approval card to ${req.assignedManagerName || s.supervisor?.name || 'Jennifer Ong'} with secure review link.`,
      },
      {
        at: NOW,
        actor: 'SyncAI Notification Adapter',
        action: 'DISPATCHED',
        channel: 'WhatsApp (Proposed)',
        details: `Simulated WhatsApp message dispatched: [SyncAI] Approval Request ${id} for ${req.taskTitle || 'Task'}.`,
      },
    ],
  };
  s.approvals.unshift(approval);
  logActivity(s, `Submitted approval request (${id}): ${approval.taskTitle} [${approval.requestType}]`, approval.requesterName);

  // Add simulated manager notification
  addNotification(s, {
    type: 'approval_request',
    channel: 'whatsapp',
    channelLabel: 'WhatsApp (Proposed)',
    recipientId: approval.assignedManagerId,
    recipientName: approval.assignedManagerName,
    recipientRole: 'manager',
    title: `Approval Required: ${approval.taskTitle}`,
    summary: `${approval.requesterName} requested ${approval.requestType.replace('_', ' ')}. Tap to review auditable record.`,
    taskId: approval.taskId,
    approvalId: id,
    secureLink: `syncai://approval/${id}`,
  });

  return approval;
}

export function decideApproval(s, approvalId, decision, reviewerName = null, note = '') {
  const approval = getApproval(s, approvalId);
  if (!approval) return { success: false, error: 'Approval request not found.' };

  const reviewer = reviewerName || actorName(s);
  const currentActor = isManager(s) ? s.supervisor?.id : s.currentOfficerId;

  if (!canApprove(s, approval, currentActor)) {
    return { success: false, error: 'Unauthorized: Requesters cannot self-approve restricted changes; only assigned managers are authorised.' };
  }

  if (decision === 'approved') {
    approval.status = 'approved';
    approval.decidedAt = NOW;
    approval.decidedBy = reviewer;
    approval.decision = note || 'Approved by authorised manager.';
    approval.auditTrail.push({
      at: NOW,
      actor: reviewer,
      action: 'APPROVED',
      channel: 'In-App',
      details: note || 'Change approved and applied to schedule.',
    });

    // Apply approved change
    const t = getTask(s, approval.taskId);
    if (t) {
      if (approval.proposedOwnerId && approval.proposedOwnerId !== t.ownerId) {
        t.ownerId = approval.proposedOwnerId;
      }
      if (approval.newDue) {
        t.due = approval.newDue;
      }
    }

    logActivity(s, `Approved request (${approval.id}) for ${approval.taskTitle}: ${approval.decision}`, reviewer);

    addNotification(s, {
      type: 'reassignment_approved',
      channel: 'in_app',
      channelLabel: 'In-App',
      recipientId: approval.requesterId,
      recipientName: approval.requesterName,
      recipientRole: approval.requesterRole,
      title: `Change Approved: ${approval.taskTitle}`,
      summary: `${reviewer} approved your ${approval.requestType.replace('_', ' ')} request. Schedule updated.`,
      taskId: approval.taskId,
      approvalId: approval.id,
      secureLink: `syncai://tasks/${approval.taskId}`,
    });

    return { success: true, status: 'approved' };
  }

  if (decision === 'rejected') {
    approval.status = 'rejected';
    approval.decidedAt = NOW;
    approval.decidedBy = reviewer;
    approval.decision = note || 'Rejected by manager.';
    approval.auditTrail.push({
      at: NOW,
      actor: reviewer,
      action: 'REJECTED',
      channel: 'In-App',
      details: note || 'Request declined.',
    });

    logActivity(s, `Declined request (${approval.id}) for ${approval.taskTitle}: ${approval.decision}`, reviewer);

    addNotification(s, {
      type: 'approval_request',
      channel: 'in_app',
      channelLabel: 'In-App',
      recipientId: approval.requesterId,
      recipientName: approval.requesterName,
      recipientRole: approval.requesterRole,
      title: `Request Declined: ${approval.taskTitle}`,
      summary: `${reviewer} declined request: ${approval.decision}. Please consult manager.`,
      taskId: approval.taskId,
      approvalId: approval.id,
      secureLink: `syncai://tasks/${approval.taskId}`,
    });

    return { success: true, status: 'rejected' };
  }

  if (decision === 'escalated') {
    approval.status = 'escalated';
    approval.decidedAt = NOW;
    approval.decidedBy = reviewer;
    approval.decision = note || `Escalated to ${approval.escalationManagerName} (EMS HQ).`;
    approval.auditTrail.push({
      at: NOW,
      actor: reviewer,
      action: 'ESCALATED',
      channel: 'Teams (Proposed)',
      details: note || `Escalated to higher management hierarchy tier: ${approval.escalationManagerName}.`,
    });

    logActivity(s, `Escalated request (${approval.id}) to ${approval.escalationManagerName}: ${approval.taskTitle}`, reviewer);

    addNotification(s, {
      type: 'escalation',
      channel: 'teams',
      channelLabel: 'Microsoft Teams (Proposed)',
      recipientId: approval.escalationManagerId,
      recipientName: approval.escalationManagerName,
      recipientRole: 'hq',
      title: `Escalation Notice: ${approval.taskTitle}`,
      summary: `Estate Manager ${reviewer} escalated request ${approval.id} for higher-tier review.`,
      taskId: approval.taskId,
      approvalId: approval.id,
      secureLink: `syncai://approval/${approval.id}`,
    });

    return { success: true, status: 'escalated' };
  }

  return { success: false, error: 'Unknown decision type.' };
}

// ----- Notifications & Channels -----

export function getNotifications(s) {
  return s.notifications || [];
}

export function getUnreadNotifications(s) {
  return (s.notifications || []).filter((n) => !n.read);
}

export function addNotification(s, notif) {
  s.notifications ||= [];
  const record = {
    id: notif.id || `notif-${nextId(s, '')}`,
    type: notif.type || 'urgent_assignment',
    channel: notif.channel || 'in_app',
    channelLabel: notif.channelLabel || (notif.channel === 'whatsapp' ? 'WhatsApp (Proposed)' : notif.channel === 'teams' ? 'Microsoft Teams (Proposed)' : 'In-App'),
    recipientId: notif.recipientId,
    recipientName: notif.recipientName || officerName(s, notif.recipientId),
    recipientRole: notif.recipientRole || 'team_member',
    title: notif.title,
    summary: notif.summary,
    taskId: notif.taskId || null,
    approvalId: notif.approvalId || null,
    secureLink: notif.secureLink || '#/dashboard',
    timestamp: notif.timestamp || NOW,
    read: Boolean(notif.read),
    privacySafe: true,
    auditId: notif.auditId || `aud-${nextId(s, '')}`,
  };
  s.notifications.unshift(record);
  s.notifications = s.notifications.slice(0, 50);
  return record;
}

export function markNotificationRead(s, id) {
  const notif = (s.notifications || []).find((n) => n.id === id);
  if (notif) notif.read = true;
}
