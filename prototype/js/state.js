// Shared application state with localStorage persistence. Every page reads
// from the same object so dashboards, tasks, plans and simulations agree.

import { addDemoCases, addPlanningDemoData, createSeedState, DATA_VERSION } from './data.js';
import { TODAY, NOW, dt, workDay } from './time.js';

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
  if (saved?.version === DATA_VERSION) {
    // The previous Add task dialog used a four-digit ID and saved a UTC deadline without source metadata.
    for (const task of saved.tasks || []) {
      if (!task.source && !task.createdAt && /^t\d{4}$/.test(task.id) && task.due?.endsWith('Z')) {
        task.manualCapture = true;
      }
    }
  }
  if (saved && saved.version === DATA_VERSION && saved.seededFor === TODAY) {
    if (saved.role === 'officer') saved.role = 'team_member';
    else if (saved.role === 'supervisor' || saved.role === 'hq') saved.role = 'manager';
    const needsDemoData = !Array.isArray(saved.cases) || !Array.isArray(saved.appointments);
    state = addPlanningDemoData(addDemoCases(saved));
    if (needsDemoData) persist();
  } else {
    state = createSeedState();
    if (saved) {
      if (saved.version === DATA_VERSION) {
        if (Array.isArray(saved.cases)) state.cases = saved.cases;
        if (saved.schedulePreferences) state.schedulePreferences = saved.schedulePreferences;
        const savedTasks = new Map((saved.tasks || []).map((task) => [task.id, task]));
        for (const task of state.tasks) {
          const previous = savedTasks.get(task.id);
          if (previous && Object.hasOwn(previous, 'caseId')) task.caseId = previous.caseId;
          if (previous?.tags) task.tags = previous.tags;
          if (previous?.category) task.category = previous.category;
        }
        state.tasks.unshift(...(saved.tasks || []).filter((task) => task.manualCapture));
      }
      storage.notice = 'Demo data was refreshed so dates line up with today.';
    }
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
      displayName: s.admin?.displayName || s.admin?.name || 'TAN, ALEX',
      email: s.admin?.email || 'alex.tan@syncai.demo',
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

export function getTasks(s) {
  return s.tasks || [];
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
    caseId: req.caseId || null,
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

  if (decision === 'approved' || decision === 'approve') {
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

    // Apply approved case closure
    if (approval.caseId && (approval.requestType === 'case_closure' || approval.requestType === 'closure')) {
      closeCase(s, approval.caseId, reviewer);
    } else if (approval.caseId) {
      // Apply approved case reassignment
      const c = getCase(s, approval.caseId);
      if (c) {
        const targetOfficer = approval.proposedOwnerId || approval.suggestedAssigneeId;
        if (targetOfficer && targetOfficer !== c.ownerId) {
          const prevOwnerName = officerName(s, c.ownerId);
          const newOwnerName = officerName(s, targetOfficer);
          c.ownerId = targetOfficer;
          c.timeline = c.timeline || [];
          c.timeline.unshift({
            id: `ev-appr-${nextId(s, '')}`,
            at: NOW,
            type: 'approval',
            title: `Reassignment approved by ${reviewer}`,
            summary: `Operational case ownership transferred from ${prevOwnerName} to ${newOwnerName}. Note: ${approval.decision}`,
            source: 'Manager Approvals',
            actor: reviewer,
          });
        }
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

    if (approval.caseId) {
      const c = getCase(s, approval.caseId);
      if (c) {
        c.timeline = c.timeline || [];
        c.timeline.push({
          id: `ev-rej-${nextId(s, '')}`,
          at: NOW,
          type: 'approval',
          title: `Reassignment request declined by ${reviewer}`,
          summary: `Request declined: ${approval.decision}`,
          source: 'Manager Approvals',
          actor: reviewer,
        });
      }
    }

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

export function markAllNotificationsRead(s) {
  for (const n of s.notifications || []) {
    n.read = true;
  }
}

export function getVisibleNotifications(s) {
  const user = getCurrentUser(s);
  if (user.status !== 'active') return [];
  const list = s.notifications || [];
  if (user.role === 'admin') {
    return list.filter((n) => n.recipientRole === 'admin' || n.recipientId === user.id || n.type === 'governance_audit' || n.type === 'governance_compliance_audit');
  }
  if (user.role === 'manager') {
    const teamMemberIds = new Set((s.teams || [])
      .filter((t) => t.managers.some((m) => m.id === user.id))
      .flatMap((t) => t.members.map((m) => m.id)));
    teamMemberIds.add(user.id);
    return list.filter((n) => !n.recipientId || teamMemberIds.has(n.recipientId) || n.recipientRole === 'manager' || n.type === 'approval_request');
  }
  // team member
  return list.filter((n) => !n.recipientId || n.recipientId === user.id || n.recipientRole === 'team_member');
}

// ============================================================================
// Case Communication Hub — Simulated Multi-Channel Records
// ============================================================================

export function getCommunications(s, caseId = null) {
  s.communications ||= [];
  if (caseId) {
    return s.communications.filter((m) => m.caseId === caseId);
  }
  return s.communications;
}

export function addCommunication(s, comm) {
  s.communications ||= [];
  const id = comm.id || `comm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const record = {
    id,
    caseId: comm.caseId,
    channel: comm.channel || 'in_app', // 'in_app' | 'whatsapp' | 'teams' | 'telegram'
    channelLabel: comm.channelLabel || (
      comm.channel === 'whatsapp' ? 'WhatsApp (Proposed)' :
      comm.channel === 'teams' ? 'Microsoft Teams (Proposed)' :
      comm.channel === 'telegram' ? 'Telegram (Proposed)' : 'In-App Portal'
    ),
    direction: comm.direction || 'outbound', // 'inbound' | 'outbound'
    sender: comm.sender || 'Aisyah Rahman (Property Officer)',
    senderRole: comm.senderRole || 'Property Officer',
    recipient: comm.recipient || 'Resident / Contractor',
    timestamp: comm.timestamp || NOW,
    category: comm.category || 'Resident Follow-up',
    content: comm.content || '',
    acknowledged: Boolean(comm.acknowledged),
    acknowledgedAt: comm.acknowledged ? (comm.acknowledgedAt || NOW) : null,
    sourceLabel: comm.sourceLabel || (comm.channel === 'in_app' ? 'Simulated notification' : 'Proposed external channel'),
    linkedTaskId: comm.linkedTaskId || null,
  };
  s.communications.unshift(record);

  // If tied to a case, optionally add a corresponding timeline event
  const c = getCase(s, comm.caseId);
  if (c && !comm.skipTimeline) {
    c.timeline ||= [];
    c.timeline.push({
      id: `ev-${Date.now()}`,
      at: record.timestamp,
      type: 'communication',
      title: `${record.channelLabel}: ${record.category}`,
      summary: record.content.length > 90 ? record.content.slice(0, 87) + '...' : record.content,
      source: record.channelLabel,
      actor: record.sender,
    });
  }

  return record;
}

export function acknowledgeCommunication(s, commId, ack = null) {
  const comm = (s.communications || []).find((m) => m.id === commId);
  if (comm) {
    comm.acknowledged = ack !== null ? ack : !comm.acknowledged;
    comm.acknowledgedAt = comm.acknowledged ? NOW : null;
  }
  return comm;
}

export function generateDraftReply(s, caseId, commId = null) {
  const c = getCase(s, caseId);
  if (!c) return 'Case not found.';
  const officer = officerName(s, c.ownerId);
  const comm = commId ? (s.communications || []).find((m) => m.id === commId) : null;
  const residentName = c.resident?.name || 'Resident';

  if (comm && comm.category === 'Contractor Query') {
    return `Hi Eng Seng Plumbing, regarding ${c.title} (${c.caseNumber || c.id}): Zone A officer ${officer} has dispatched the physical inspection notice to upper unit #06-12 today. Joint inspection is tentatively slated for tomorrow. Please hold stand-by quotation pending access confirmation. Regards, EM Services Town Council.`;
  }

  return `Dear ${residentName}, thank you for contacting EM Services Town Council regarding ${c.title} (${c.caseNumber || c.id}). Property Officer ${officer} has completed the on-site moisture assessment. We are coordinating access with the upper unit for joint rectification. Our next status update will follow by ${c.followUpDue ? c.followUpDue.slice(0, 16) : 'next working day'}. For emergency assistance, please contact the Town Council hotline.`;
}

/**
 * Communication-to-Task Drafting (#076)
 * Deterministic simulation parsing structured actionable intent from fictional messages.
 * Requires user confirmation; never creates tasks automatically.
 */
export function extractTaskDraftFromMessage(text, defaultCaseId = null) {
  const rawText = text || '';
  const lower = rawText.toLowerCase();

  let caseId = defaultCaseId || 'case-001';
  if (lower.includes('blk 211') || lower.includes('seepage') || lower.includes('demo-001') || lower.includes('211-512')) {
    caseId = 'case-001';
  } else if (lower.includes('blk 310') || lower.includes('hopper') || lower.includes('demo-002')) {
    caseId = 'case-002';
  } else if (lower.includes('blk 405') || lower.includes('drain') || lower.includes('demo-003')) {
    caseId = 'case-003';
  } else if (lower.includes('blk 208') || lower.includes('lift') || lower.includes('demo-004')) {
    caseId = 'case-004';
  }

  let title = 'Follow-up on operational communication';
  let category = 'Resident Feedback';
  let priority = 'Medium';
  let due = `${TODAY}T17:00`;
  let suggestedAssignee = 'o1';

  if (lower.includes('quote') || lower.includes('quotation') || lower.includes('contractor') || lower.includes('estimate')) {
    title = 'Follow up with contractor on pending scope quotation';
    category = 'Contractor Management';
    priority = 'High';
  } else if (lower.includes('moisture') || lower.includes('inspection') || lower.includes('leak') || lower.includes('seepage')) {
    title = 'Conduct joint ceiling inspection with upper unit tenant';
    category = 'Inspection';
    priority = 'High';
    due = `${TODAY}T14:00`;
  } else if (lower.includes('call') || lower.includes('callback') || lower.includes('ring') || lower.includes('update resident')) {
    title = 'Resident progress callback and acknowledgment';
    category = 'Resident Feedback';
    priority = 'Medium';
    due = `${TODAY}T16:00`;
  } else if (lower.includes('lift') || lower.includes('jolt') || lower.includes('stuck') || lower.includes('emergency')) {
    title = 'Urgent lift safety audit with technician';
    category = 'Lift Inspection';
    priority = 'Critical';
    due = `${TODAY}T12:00`;
  }

  return {
    caseId,
    title,
    category,
    priority,
    due,
    suggestedAssignee,
    extractedSnippet: rawText.length > 80 ? rawText.slice(0, 77) + '...' : rawText,
    requiresHumanVerification: true,
    disclaimer: 'Prototype simulation — requires human verification. Untrusted messages never auto-commit.',
  };
}

// ============================================================================
// Category C: Case Action Centre & Operational Loose-End Intelligence
// ============================================================================

export function getCases(s) {
  return s.cases || [];
}

export function getCase(s, id) {
  if (!id) return null;
  return (s.cases || []).find((c) => c.id === id || c.caseNumber === id);
}

export { visibleCases, accessibleCase, tasksForCase, getCaseKanbanColumn, KANBAN_COLUMNS } from './cases.js';

/**
 * Operational Loose-End Detector — Signature Feature
 * Deterministic rule-based engine detecting unresolved operational commitments
 * before tasks become overdue or slip through the cracks.
 * Enriched with Evidence-Linked Explanations (#117) and Responsible AI metadata.
 */
export function detectLooseEnds(s, c) {
  if (!c) return [];
  const findings = [];
  const checkpoints = c.checkpoints || [];
  const evidence = c.evidence || [];
  const blockers = c.blockers || [];

  // Rule 1: Promised resident follow-up is outstanding
  const residentCp = checkpoints.find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.includes('resident'));
  const openFeedbackTask = (c.taskIds || []).map((tid) => getTask(s, tid)).find((t) => t && t.category === 'Resident Feedback' && t.status !== 'done');
  if (residentCp || openFeedbackTask) {
    findings.push({
      findingId: `${c.id}-resident_followup`,
      ruleId: 'resident_followup',
      ruleCode: 'EMS-LE-01',
      ruleName: 'Resident Follow-up Commitment',
      severity: 'warning',
      title: 'Outstanding Resident Callback',
      explanation: 'Promised resident update call has not been recorded following the initial site inspection.',
      whyDetected: 'Following the on-site moisture assessment, an operational commitment was recorded to update the resident. More than 24 hours have elapsed without a logged telephone call or direct contact acknowledgment in the case timeline.',
      ruleThreshold: 'Mandatory resident callback within 24 hours of inspection completion (OneService / Town Council Customer Service Charter).',
      verifiedFacts: [
        `Inspection recorded at ${c.location || 'site'} with high moisture level (78%).`,
        `Resident contact on file: ${c.resident?.name || 'Tenant'} (${c.resident?.contact || 'Contact on file'}).`,
        `Follow-up deadline scheduled for ${c.followUpDue ? c.followUpDue.slice(0, 16) : 'next working day'}.`,
      ],
      ruleDeductions: [
        'No matching contact entry or call log found in timeline since initial inspection.',
        'Elapsed operational duration exceeds standard 24h resident communication SLA.',
        'Unfulfilled resident commitments risk public escalation to grassroots/OneService.',
      ],
      missingInfo: 'Documented resident phone conversation log, visit note, or SMS acknowledgment.',
      suggestedAction: `Contact resident ${c.resident?.name || 'tenant'} to provide investigation update and record callback.`,
      sourceEvidence: openFeedbackTask ? `Task ${openFeedbackTask.id} (${openFeedbackTask.title})` : `Checkpoint: ${residentCp?.title || 'Resident Callback'}`,
      sourceRecordType: openFeedbackTask ? 'task' : residentCp ? 'checkpoint' : 'timeline',
      sourceRecordId: openFeedbackTask ? openFeedbackTask.id : residentCp ? residentCp.id : 'ev-001-3',
      sourceRecordRef: openFeedbackTask ? `Task ${openFeedbackTask.id}` : residentCp ? `Checkpoint: ${residentCp.title}` : 'Timeline: Inspection Log',
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: openFeedbackTask?.due || residentCp?.due || c.slaDue,
      status: 'confirmed',
    });
  }

  // Rule 2: Contractor confirmation or quotation still pending past threshold (>24h)
  const contractorBlocker = blockers.find((b) => !b.resolved && (b.category === 'Awaiting contractor' || (b.title && b.title.toLowerCase().includes('contractor'))));
  const contractorCp = checkpoints.find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.toLowerCase().includes('contractor'));
  if (contractorBlocker || contractorCp) {
    findings.push({
      findingId: `${c.id}-contractor_pending`,
      ruleId: 'contractor_pending',
      ruleCode: 'EMS-LE-02',
      ruleName: 'Contractor Quotation & Scope Turnaround',
      severity: 'warning',
      title: 'Contractor Quotation & Scope Pending',
      explanation: 'Contractor quotation has exceeded the standard 24h estimation turnaround without recorded submission.',
      whyDetected: 'Term contractor was notified of required repair works, but quotation or work schedule confirmation has not been submitted within the 24-hour turnaround SLA.',
      ruleThreshold: 'Contractor quote submission required within 24 hours of site assessment (EMS Maintenance SLA).',
      verifiedFacts: [
        `Repair scope issued to term contractor: ${contractorBlocker?.responsibleParty || 'Eng Seng Plumbing'}.`,
        `Blocker record active: ${contractorBlocker?.title || 'Contractor quotation pending'}.`,
        `SLA due date: ${dt(TODAY, '17:00')}.`,
      ],
      ruleDeductions: [
        'No formal quotation document attached in case evidence files.',
        'Delayed contractor estimation stalls work order creation and upper-unit coordination.',
      ],
      missingInfo: 'Contractor itemized scope of works and signed quotation slip.',
      suggestedAction: 'Send automated prompt to term contractor to submit scope quotation.',
      sourceEvidence: contractorBlocker ? `${contractorBlocker.sourceRef || contractorBlocker.title} (${contractorBlocker.responsibleParty || 'Contractor'})` : 'Work Order WO-2026-8812',
      sourceRecordType: contractorBlocker ? 'blocker' : 'checkpoint',
      sourceRecordId: contractorBlocker ? contractorBlocker.id : (contractorCp ? contractorCp.id : 'cp-002-2'),
      sourceRecordRef: contractorBlocker ? `Blocker: ${contractorBlocker.title}` : `Checkpoint: ${contractorCp?.title || 'Contractor Quota'}`,
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: contractorCp?.due || dt(TODAY, '17:00'),
      status: 'confirmed',
    });
  }

  // Rule 3: Scheduled inspection lacks documented findings / outcome report
  const outcomeCp = checkpoints.find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.includes('findings'));
  if (outcomeCp) {
    findings.push({
      findingId: `${c.id}-inspection_outcome`,
      ruleId: 'inspection_outcome',
      ruleCode: 'EMS-LE-03',
      ruleName: 'Inspection Outcome Documentation',
      severity: 'critical',
      title: 'Site Inspection Lacks Documented Findings',
      explanation: 'Scheduled joint inspection took place, but mandatory statutory outcome findings have not been uploaded.',
      whyDetected: 'A joint technical inspection was completed according to schedule, but mandatory regulatory findings (checklist and signed technician log) have not been filed.',
      ruleThreshold: 'BCA & Town Council compliance requires inspection findings logged within 4 hours of site inspection.',
      verifiedFacts: [
        `Inspection scheduled at ${c.location || 'site'} with attending technician.`,
        `Checklist item "${outcomeCp.title}" remains uncompleted.`,
      ],
      ruleDeductions: [
        'Absence of endorsed outcome report prevents statutory compliance sign-off.',
        'Critical severity assigned due to statutory safety implications.',
      ],
      missingInfo: 'Certified technician service log slip and endorsed inspection findings.',
      suggestedAction: 'Upload certified technician service log slip and endorse inspection findings.',
      sourceEvidence: `Case ${c.caseNumber || c.id} / Checkpoint: ${outcomeCp.title}`,
      sourceRecordType: 'checkpoint',
      sourceRecordId: outcomeCp.id,
      sourceRecordRef: `Checkpoint: ${outcomeCp.title}`,
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: outcomeCp.due || dt(TODAY, '14:00'),
      status: 'confirmed',
    });
  }

  // Rule 4: Case has not received a meaningful update within illustrative threshold (>48h)
  const staleCp = checkpoints.find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.includes('>48h'));
  const lastEvent = c.timeline && c.timeline.length ? c.timeline[c.timeline.length - 1] : null;
  const lastAt = lastEvent?.at || c.reportedAt;
  const isStale = Boolean(staleCp || (c.status === 'in_progress' && lastAt && (lastAt.includes(workDay(-2)) || lastAt.includes(workDay(-3)) || lastAt.includes(workDay(-4)) || lastAt.includes(workDay(-5)))));
  if (isStale) {
    findings.push({
      findingId: `${c.id}-stale_case`,
      ruleId: 'stale_case',
      ruleCode: 'EMS-LE-04',
      ruleName: 'Case Activity Stalemate Detector',
      severity: 'warning',
      title: 'Stale Case Activity (>48h Inactive)',
      explanation: 'High-urgency open case has received no progress log or site inspection note in the last 48 hours.',
      whyDetected: 'Open case has remained in progress without an updated timeline entry, progress report, or communication event for more than 48 operational hours.',
      ruleThreshold: 'Active high-urgency cases must record progress at least once every 48 hours.',
      verifiedFacts: [
        `Case status: ${c.status}.`,
        `Last timeline event: "${lastEvent?.title || 'Case Reported'}" recorded at ${lastAt || 'initial intake'}.`,
      ],
      ruleDeductions: [
        'Zero activity recorded for over 48 hours indicates workflow stagnation or unrecorded offline action.',
      ],
      missingInfo: 'Updated site status, resident follow-up note, or contractor progress log.',
      suggestedAction: 'Request status confirmation from attending property officer.',
      sourceEvidence: `Last recorded update: ${lastEvent ? lastEvent.title : 'Case Intake'}`,
      sourceRecordType: 'timeline',
      sourceRecordId: lastEvent ? lastEvent.id : 'ev-001-1',
      sourceRecordRef: lastEvent ? `Timeline: ${lastEvent.title}` : 'Timeline: Intake',
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: c.slaDue,
      status: 'confirmed',
    });
  }

  // Rule 5: Required supporting record or evidence is missing
  const missingEvi = evidence.filter((e) => e.missing && e.requiredForClosure);
  if (missingEvi.length > 0) {
    findings.push({
      findingId: `${c.id}-missing_evidence`,
      ruleId: 'missing_evidence',
      ruleCode: 'EMS-LE-05',
      ruleName: 'Mandatory Compliance Evidence Verification',
      severity: 'warning',
      title: 'Required Supporting Evidence Missing',
      explanation: 'Mandatory technical records required by Town Council compliance standards are unattached.',
      whyDetected: 'Case requires mandatory documentation (e.g. upper unit joint inspection notice copy, thermographic imaging) before work orders or closures can be certified.',
      ruleThreshold: 'All mandatory evidence items marked "requiredForClosure" must be uploaded and verified before case completion.',
      verifiedFacts: [
        `Required evidence unattached: ${missingEvi.map((e) => e.title).join(', ')}.`,
        `Verified evidence present: ${evidence.filter((e) => e.verified).map((e) => e.title).join(', ') || 'None'}.`,
      ],
      ruleDeductions: [
        'Missing statutory notices prevent legal compliance under Singapore Building Maintenance and Strata Management guidelines.',
      ],
      missingInfo: `Unattached files: ${missingEvi.map((e) => e.sourceRef || e.title).join(', ')}.`,
      suggestedAction: 'Request mandatory photo/document attachments before proceeding to rectification.',
      sourceEvidence: missingEvi.map((e) => e.title).join(', '),
      sourceRecordType: 'evidence',
      sourceRecordId: missingEvi[0].id,
      sourceRecordRef: `Evidence: ${missingEvi[0].title}`,
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: c.slaDue,
      status: 'confirmed',
    });
  }

  // Rule 6: Closure requested with incomplete checkpoints or unapproved exceptions
  const unclosedCp = checkpoints.filter((cp) => !cp.completed && cp.requiredForClosure);
  if (c.status === 'ready_for_closure' && unclosedCp.length > 0) {
    findings.push({
      findingId: `${c.id}-unresolved_closure`,
      ruleId: 'unresolved_closure',
      ruleCode: 'EMS-LE-06',
      ruleName: 'Closure Prerequisite Completeness Check',
      severity: 'critical',
      title: 'Closure Requested with Incomplete Checkpoints',
      explanation: 'Case is marked ready for closure but prerequisite checkpoints remain incomplete.',
      whyDetected: 'Case was submitted for closure review, but mandatory prerequisite checkpoints have not been completed or signed off.',
      ruleThreshold: 'Zero incomplete mandatory checkpoints permitted at closure sign-off.',
      verifiedFacts: [
        `Incomplete prerequisites: ${unclosedCp.map((cp) => cp.title).join('; ')}.`,
      ],
      ruleDeductions: [
        'Premature closure would violate Town Council operational audit procedures.',
      ],
      missingInfo: 'Completed checkpoint verifications or authorised manager exception memo.',
      suggestedAction: 'Satisfy all mandatory closure checklist items or obtain authorised exception.',
      sourceEvidence: unclosedCp.map((cp) => cp.title).join('; '),
      sourceRecordType: 'checkpoint',
      sourceRecordId: unclosedCp[0].id,
      sourceRecordRef: `Checkpoint: ${unclosedCp[0].title}`,
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: c.slaDue,
      status: 'confirmed',
    });
  }

  // Rule 7: Reassignment without completed handover acknowledgement
  if (c.handover && c.handover.status === 'pending_acknowledgement') {
    findings.push({
      findingId: `${c.id}-pending_handover`,
      ruleId: 'pending_handover',
      ruleCode: 'EMS-LE-07',
      ruleName: 'Operational Reassignment Handover Protocol',
      severity: 'warning',
      title: 'Pending Assignment Handover Sign-off',
      explanation: 'Case was reallocated to another officer, but the receiving officer has not acknowledged the handover brief.',
      whyDetected: 'A case reassignment was initiated, but the target officer has not acknowledged receipt and accepted responsibility for upcoming commitments.',
      ruleThreshold: 'Handover acknowledgment mandatory within 2 working hours of reassignment approval.',
      verifiedFacts: [
        `Originating officer: ${officerName(s, c.handover.fromOfficerId)}.`,
        `Receiving officer: ${officerName(s, c.handover.toOfficerId)}.`,
        `Handover reason: ${c.handover.reason || 'Workload adjustment'}.`,
      ],
      ruleDeductions: [
        'Unacknowledged handovers cause gaps in resident communications and missed site visits.',
      ],
      missingInfo: 'Receiving officer electronic acknowledgment and schedule acceptance.',
      suggestedAction: 'Receiving officer must review documented commitments and acknowledge handover.',
      sourceEvidence: `Handover from ${officerName(s, c.handover.fromOfficerId)} to ${officerName(s, c.handover.toOfficerId)} (${c.handover.reason || 'Workload adjustment'})`,
      sourceRecordType: 'timeline',
      sourceRecordId: 'handover-event',
      sourceRecordRef: 'Handover Protocol',
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: dt(TODAY, '11:30'),
      status: 'confirmed',
    });
  }

  // Rule 8: Documented appointment approaching without confirmation
  const unconfirmedApt = checkpoints.find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.toLowerCase().includes('appointment'));
  const aptTask = (c.taskIds || []).map((tid) => getTask(s, tid)).find((t) => t && t.appointmentTime && t.status !== 'done');
  if (unconfirmedApt || aptTask) {
    findings.push({
      findingId: `${c.id}-unconfirmed_appointment`,
      ruleId: 'unconfirmed_appointment',
      ruleCode: 'EMS-LE-08',
      ruleName: 'Fixed Resident Appointment Protection',
      severity: 'warning',
      title: 'Upcoming Appointment Lacks Confirmation',
      explanation: 'Resident unit repair appointment is scheduled within 24 hours without recorded tenant access confirmation.',
      whyDetected: 'A fixed resident access appointment is scheduled in the calendar, but resident confirmation has not been recorded within the standard 24h pre-visit window.',
      ruleThreshold: 'Resident attendance confirmation required 24 hours prior to fixed repair block.',
      verifiedFacts: [
        `Appointment: ${aptTask?.appointmentTime || unconfirmedApt?.due?.slice(11, 16) || 'Scheduled today'}.`,
        `Resident contact: ${c.resident?.name || 'Resident'} (${c.resident?.contact || 'Phone on file'}).`,
      ],
      ruleDeductions: [
        'Unconfirmed appointments risk wasted contractor trips and abortive site visit charges.',
      ],
      missingInfo: 'Recorded tenant SMS or call confirming presence at unit during scheduled block.',
      suggestedAction: 'Send SMS/Call resident to verify home access availability.',
      sourceEvidence: aptTask ? `Task ${aptTask.id} (${aptTask.appointmentTime})` : `Appointment: ${unconfirmedApt?.due ? unconfirmedApt.due.slice(0, 16) : 'Upcoming'} (${c.resident?.contact || 'Resident'})`,
      sourceRecordType: aptTask ? 'task' : 'checkpoint',
      sourceRecordId: aptTask ? aptTask.id : (unconfirmedApt ? unconfirmedApt.id : 'cp-001-2'),
      sourceRecordRef: aptTask ? `Task ${aptTask.id}` : `Checkpoint: ${unconfirmedApt?.title || 'Appointment'}`,
      reviewStatus: 'Human review required',
      disclaimer: 'Deterministic rule-based finding — human review required. Not an autonomous AI prediction.',
      dueDate: aptTask?.due || unconfirmedApt?.due || dt(TODAY, '17:00'),
      status: 'confirmed',
    });
  }

  return findings.map((f) => ({
    ...f,
    caseId: c.id,
    caseNumber: c.caseNumber || c.id,
    caseTitle: c.title,
    caseItem: c,
  }));
}

export function getExplanationForFinding(s, caseId, ruleId) {
  const c = getCase(s, caseId);
  if (!c) return null;
  const ends = detectLooseEnds(s, c);
  return ends.find((e) => e.ruleId === ruleId || e.findingId === ruleId) || ends[0] || null;
}

/**
 * Closure Readiness Checker
 * Evaluates whether all mandatory prerequisites are satisfied before marking complete.
 */
export function checkClosureReadiness(s, c) {
  if (!c) return { isReady: false, unresolvedItems: ['Case record not found.'] };

  const checkpoints = c.checkpoints || [];
  const evidence = c.evidence || [];
  const blockers = c.blockers || [];
  const unresolvedItems = [];

  // 1. Unresolved blockers
  const activeBlockers = blockers.filter((b) => !b.resolved);
  if (activeBlockers.length > 0) {
    unresolvedItems.push(`Active blocker: ${activeBlockers[0].title}`);
  }

  // 2. Missing required evidence
  const missingEvi = evidence.filter((e) => e.missing && e.requiredForClosure);
  if (missingEvi.length > 0) {
    unresolvedItems.push(`Missing required evidence: ${missingEvi.map((e) => e.title).join(', ')}`);
  }

  // 3. Unresolved required checkpoints
  const incompleteCp = checkpoints.filter((cp) => !cp.completed && cp.requiredForClosure);
  incompleteCp.forEach((cp) => {
    unresolvedItems.push(`Incomplete prerequisite: ${cp.title}${cp.requiresManager ? ' (Requires Manager Sign-off)' : ''}`);
  });

  // 4. Loose-end critical alerts
  const looseEnds = detectLooseEnds(s, c);
  const criticalEnds = looseEnds.filter((l) => l.severity === 'critical');
  criticalEnds.forEach((ce) => {
    unresolvedItems.push(`Critical loose-end: ${ce.title}`);
  });

  return {
    isReady: unresolvedItems.length === 0,
    inspectionRecorded: !checkpoints.some((cp) => cp.id.includes('inspection') && !cp.completed),
    evidenceVerified: missingEvi.length === 0,
    contractorVerified: !checkpoints.some((cp) => cp.title.toLowerCase().includes('contractor') && !cp.completed),
    residentCompleted: !checkpoints.some((cp) => cp.title.toLowerCase().includes('resident') && !cp.completed),
    managerApproved: !checkpoints.some((cp) => cp.requiresManager && !cp.completed),
    unresolvedItems,
  };
}

/**
 * AI-Ready Handover & Case Brief Generator
 * Deterministic template simulating synthesized case intelligence from factual records.
 */
export function generateCaseBrief(s, c) {
  if (!c) return 'No case selected.';
  const officer = officerName(s, c.ownerId);
  const looseEnds = detectLooseEnds(s, c);
  const readiness = checkClosureReadiness(s, c);
  const completedCp = (c.checkpoints || []).filter((cp) => cp.completed).map((cp) => cp.title);
  const pendingCp = (c.checkpoints || []).filter((cp) => !cp.completed).map((cp) => cp.title);
  const activeBlockers = (c.blockers || []).filter((b) => !b.resolved);

  const unverifiedEvidence = (c.evidence || []).filter((e) => !e.verified).map((e) => e.title);
  const missingInfoList = [];
  if (unverifiedEvidence.length > 0) {
    missingInfoList.push(`Unverified / missing evidence records: ${unverifiedEvidence.join(', ')}`);
  }
  for (const l of looseEnds) {
    if (l.missingInfo && !missingInfoList.includes(l.missingInfo)) {
      missingInfoList.push(l.missingInfo);
    }
  }

  return [
    `=== SIMULATED CASE BRIEF — GENERATED FROM FICTIONAL CASE DATA ===`,
    `Case Reference: ${c.caseNumber} | Title: ${c.title}`,
    `Category: ${c.category} | Location: ${c.estate} (Unit: ${c.unit})`,
    `Assigned Property Officer: ${officer} (Zone A Operations)`,
    ``,
    `[CURRENT STATUS]`,
    `Status: ${c.status.toUpperCase()} | Urgency: ${c.urgency} | SLA: ${c.slaType} (Due: ${c.slaDue})`,
    ``,
    `[EXECUTIVE SUMMARY]`,
    c.summary || 'Operational estate case under active investigation.',
    ``,
    `[WORK COMPLETED]`,
    completedCp.length > 0 ? completedCp.map((t) => `✓ ${t}`).join('\n') : '• Case reported and initial triage logged.',
    ``,
    `[OUTSTANDING COMMITMENTS & LOOSE ENDS] (${looseEnds.length} detected)`,
    looseEnds.length > 0
      ? looseEnds.map((l) => `! [${l.severity.toUpperCase()}] ${l.title}: ${l.suggestedAction} (Evidence: ${l.sourceEvidence})`).join('\n')
      : '• All documented follow-up commitments are currently on track.',
    ``,
    `[DOCUMENTED BLOCKERS]`,
    activeBlockers.length > 0
      ? activeBlockers.map((b) => `• ${b.title} [Responsible: ${b.responsibleParty}]`).join('\n')
      : '• No active blockers recorded.',
    ``,
    `[CLOSURE READINESS CHECK]`,
    readiness.isReady
      ? '✓ All checkpoints satisfied. Case is eligible for formal closure.'
      : `⚠ Closure blocked by ${readiness.unresolvedItems.length} requirement(s):\n${readiness.unresolvedItems.map((u) => `  - ${u}`).join('\n')}`,
    ``,
    `[DISCLOSED MISSING INFORMATION]`,
    missingInfoList.length > 0
      ? missingInfoList.map((m) => `• ${m}`).join('\n')
      : '• All required operational and statutory records are verified in authorized state.',
    ``,
    `[RECOMMENDED NEXT ACTIONS]`,
    looseEnds.length > 0 ? `1. ${looseEnds[0].suggestedAction}` : '1. Continue scheduled routine monitoring.',
    `2. Open Smart Planner to align follow-up blocks with officer calendar buffer.`,
    `3. If schedule conflict arises, run Ripple Intelligence to evaluate alternatives before reassignment.`,
    ``,
    `Source: SyncAI Case Action Centre · Deterministic Prototype Simulator`,
  ].join('\n');
}

/**
 * Close a case with readiness validation.
 */
export function closeCase(s, caseId, actor = null) {
  const c = getCase(s, caseId);
  if (!c) return { success: false, error: 'Case not found.' };

  const currentActor = actor || actorName(s);
  const readiness = checkClosureReadiness(s, c);

  // If not ready and not manager exception, block closure
  if (!readiness.isReady && !isManager(s)) {
    return {
      success: false,
      error: `Cannot close case: ${readiness.unresolvedItems[0] || 'Prerequisite checkpoints incomplete.'}`,
      unresolved: readiness.unresolvedItems,
    };
  }

  c.status = 'closed';
  c.closedAt = NOW;
  c.closedBy = currentActor;
  c.timeline ||= [];
  c.timeline.unshift({
    id: `ev-close-${nextId(s, '')}`,
    at: NOW,
    type: 'closure',
    title: `Case closed by ${currentActor}`,
    summary: readiness.isReady
      ? 'All closure readiness checklist requirements verified and satisfied.'
      : `Closed with authorised manager exception: ${readiness.unresolvedItems.join(', ')}`,
    source: 'Closure Readiness Engine',
    actor: currentActor,
  });

  // If any pending closure approval was open for this case, mark it approved
  for (const a of s.approvals || []) {
    if (a.caseId === caseId && (a.requestType === 'case_closure' || a.requestType === 'closure') && a.status === 'pending') {
      a.status = 'approved';
      a.decidedAt = NOW;
      a.decidedBy = currentActor;
      a.decision = 'Case closure verified and authorized by Estate Manager.';
    }
  }

  logActivity(s, `Closed case ${c.caseNumber} (${c.title})`, currentActor);
  return { success: true, case: c };
}

/**
 * Submit closure request for a case (creates manager approval request).
 * Property Officers use this to request manager sign-off without prematurely closing the case.
 */
export function requestCaseClosure(s, caseId, reason = '') {
  const c = getCase(s, caseId);
  if (!c) return { success: false, error: 'Case not found.' };

  const existing = (s.approvals || []).find(
    (a) => a.caseId === caseId && (a.requestType === 'case_closure' || a.requestType === 'closure') && a.status === 'pending'
  );
  if (existing) {
    return { success: false, error: 'A closure approval request is already pending manager sign-off.' };
  }

  const primaryTaskId = (c.taskIds && c.taskIds[0]) || null;
  const currentActor = actorName(s);

  const approval = createApprovalRequest(s, {
    requestType: 'case_closure',
    taskId: primaryTaskId,
    caseId: c.id,
    taskTitle: `Closure Sign-off: Case ${c.caseNumber || c.id} — ${c.title}`,
    requesterId: s.currentOfficerId,
    requesterName: currentActor,
    requesterRole: 'team_member',
    reason: reason || 'All operational checkpoints completed. Requesting formal manager sign-off and statutory audit.',
    slaImpact: 'Verified on-schedule resolution',
    operationalImpact: 'Final case archiving and inspection record closure',
  });

  c.timeline ||= [];
  c.timeline.unshift({
    id: `ev-req-close-${nextId(s, '')}`,
    at: TODAY,
    type: 'closure_requested',
    title: `Closure sign-off requested by ${currentActor}`,
    summary: reason || 'Submitted to Manager Jennifer Ong for statutory sign-off and closure audit.',
    source: 'Case Action Centre',
    actor: currentActor,
  });

  addNotification(s, {
    type: 'closure_warning',
    title: `Closure Sign-Off: Case ${c.caseNumber || c.id}`,
    message: `${currentActor} requested manager closure sign-off for "${c.title}".`,
    caseId: c.id,
    priority: 'medium',
    actionLabel: 'Review in Approvals',
    actionUrl: '#team',
    category: 'compliance',
    role: 'manager',
  });

  logActivity(s, `Requested manager closure sign-off for Case ${c.caseNumber || c.id}`, currentActor);
  return { success: true, approval };
}

/**
 * Record follow-up outcome and resolve loose end.
 */
export function resolveLooseEnd(s, caseId, ruleId, outcomeNote = '') {
  const c = getCase(s, caseId);
  if (!c) return { success: false, error: 'Case not found.' };

  const actor = actorName(s);
  let resolvedRuleName = ruleId;

  // Rule 1: resident_followup
  if (ruleId === 'resident_followup' || ruleId === 'EMS-LE-01') {
    resolvedRuleName = 'Resident Follow-up Commitment';
    const residentCp = (c.checkpoints || []).find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.includes('resident'));
    if (residentCp) {
      residentCp.completed = true;
      residentCp.completedAt = NOW;
    }
    const openFeedbackTask = (c.taskIds || []).map((tid) => getTask(s, tid)).find((t) => t && t.category === 'Resident Feedback' && t.status !== 'done');
    if (openFeedbackTask) {
      openFeedbackTask.status = 'done';
    }
  } else if (ruleId === 'contractor_pending' || ruleId === 'EMS-LE-02') {
    resolvedRuleName = 'Contractor Quotation & Scope Turnaround';
    const contractorBlocker = (c.blockers || []).find((b) => !b.resolved && (b.category === 'Awaiting contractor' || (b.title && b.title.toLowerCase().includes('contractor'))));
    if (contractorBlocker) {
      contractorBlocker.resolved = true;
      contractorBlocker.resolvedAt = TODAY;
    }
    const contractorCp = (c.checkpoints || []).find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.toLowerCase().includes('contractor'));
    if (contractorCp) {
      contractorCp.completed = true;
      contractorCp.completedAt = NOW;
    }
  } else if (ruleId === 'inspection_outcome' || ruleId === 'EMS-LE-03') {
    resolvedRuleName = 'Inspection Outcome Documentation';
    const outcomeCp = (c.checkpoints || []).find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.includes('findings'));
    if (outcomeCp) {
      outcomeCp.completed = true;
      outcomeCp.completedAt = NOW;
    }
  } else if (ruleId === 'photo_evidence' || ruleId === 'EMS-LE-04') {
    resolvedRuleName = 'Photographic Evidence Verification';
    const photoEvi = (c.evidence || []).find((e) => !e.verified && e.title && e.title.toLowerCase().includes('photo'));
    if (photoEvi) {
      photoEvi.verified = true;
    }
  } else if (ruleId === 'bca_filing' || ruleId === 'EMS-LE-05') {
    resolvedRuleName = 'Statutory BCA Filing';
    const bcaCp = (c.checkpoints || []).find((cp) => !cp.completed && cp.looseEndReason && cp.looseEndReason.includes('BCA'));
    if (bcaCp) {
      bcaCp.completed = true;
      bcaCp.completedAt = NOW;
    }
  } else {
    const matchingCp = (c.checkpoints || []).find((cp) => !cp.completed && (cp.id === ruleId || cp.looseEndReason?.includes(ruleId)));
    if (matchingCp) {
      matchingCp.completed = true;
      matchingCp.completedAt = NOW;
    }
  }

  // Add timeline event
  c.timeline ||= [];
  c.timeline.unshift({
    id: `ev-res-${nextId(s, '')}`,
    at: TODAY,
    type: 'followup_resolved',
    title: `Follow-Up Resolved: ${resolvedRuleName}`,
    summary: outcomeNote || `Operational commitment fulfilled and outcome recorded by ${actor}. Requirement verified.`,
    source: 'Loose-End Detector',
    actor,
  });

  // Mark matching loose-end notification read if any
  for (const n of s.notifications || []) {
    if (n.caseId === c.id && n.type === 'loose_end') {
      n.read = true;
    }
  }

  logActivity(s, `Resolved follow-up "${resolvedRuleName}" for Case ${c.caseNumber || c.id}`, actor);
  return { success: true, case: c };
}

/**
 * Resolve case blocker and log activity.
 */
export function resolveCaseBlocker(s, caseId, blockerId) {
  const c = getCase(s, caseId);
  if (!c) return { success: false, error: 'Case not found.' };

  const b = (c.blockers || []).find((item) => item.id === blockerId);
  if (!b) return { success: false, error: 'Blocker not found.' };

  b.resolved = true;
  b.resolvedAt = TODAY;

  const actor = actorName(s);
  c.timeline ||= [];
  c.timeline.unshift({
    id: `ev-blk-${nextId(s, '')}`,
    at: TODAY,
    type: 'blocker_resolved',
    title: `Blocker Resolved: ${b.title}`,
    summary: `External dependency cleared (${b.responsibleParty || 'External'}). Case unblocked.`,
    source: 'Blocker Tracker',
    actor,
  });

  logActivity(s, `Resolved case blocker: ${b.title} (Case ${c.caseNumber || c.id})`, actor);
  return { success: true, blocker: b };
}

/**
 * Add a progress note to case timeline with input validation.
 */
export function addCaseProgressNote(s, caseId, category, content) {
  const c = getCase(s, caseId);
  if (!c) return { success: false, error: 'Case not found.' };

  const trimmed = (content || '').trim();
  if (trimmed.length < 4) {
    return { success: false, error: 'Progress note must be at least 4 characters.' };
  }

  const actor = actorName(s);
  const noteCategory = category || 'Progress Note';

  const newEvent = {
    id: `ev-note-${nextId(s, '')}`,
    at: TODAY,
    type: 'progress_note',
    title: `${noteCategory}`,
    summary: trimmed,
    source: 'Officer Field Note',
    actor,
  };

  c.timeline ||= [];
  c.timeline.unshift(newEvent);

  logActivity(s, `Recorded progress note for Case ${c.caseNumber || c.id}: ${noteCategory}`, actor);
  return { success: true, event: newEvent };
}

/**
 * Submit reassignment request for a case.
 * Connected directly to the Approvals & Audit workflow!
 */
export function requestCaseReassignment(s, caseId, targetOfficerId, reason = '') {
  const c = getCase(s, caseId);
  if (!c) return null;

  const primaryTaskId = (c.taskIds && c.taskIds[0]) || null;
  const currentOfficer = officerName(s, c.ownerId);
  const targetOfficer = officerName(s, targetOfficerId);

  const approval = createApprovalRequest(s, {
    requestType: 'reassign',
    taskId: primaryTaskId,
    taskTitle: `Reassign ${c.caseNumber}: ${c.title}`,
    caseId: c.id,
    proposedOwnerId: targetOfficerId,
    reason: reason || `Workload adjustment / emergency case reassignment from ${currentOfficer} to ${targetOfficer}.`,
  });

  c.timeline ||= [];
  c.timeline.push({
    id: `ev-reassign-req-${nextId(s, '')}`,
    at: NOW,
    type: 'assignment',
    title: `Reassignment requested to ${targetOfficer}`,
    summary: reason || `Transfer requested from ${currentOfficer} to ${targetOfficer}. Awaiting Estate Manager approval.`,
    source: 'Case Action Centre',
    actor: actorName(s),
  });

  return approval;
}
