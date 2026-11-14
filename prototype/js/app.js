// Main Application Controller — Static Prototype Rebuild (ES Modules)
import {
  getState,
  loadState,
  resetState,
  storage,
  update,
  subscribe,
  getCurrentUser,
  setCurrentUser,
  isAdmin,
  isManager,
  isTeamMember,
  getPendingApprovals,
  getApprovals,
  getUsers,
  getUser,
  approveUser,
  setUserRole,
  setUserStatus,
  createTeam,
  addTeamMember,
  removeTeamMember,
  createApprovalRequest,
  submitOperationalChangeApproval,
  decideApproval,
  isOpen,
  logActivity,
  actorName,
  getCase,
  closeCase,
  requestCaseClosure,
  requestCaseReassignment,
  resolveLooseEnd,
  resolveCaseBlocker,
  addCaseProgressNote,
  officerName,
  getVisibleNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  addCommunication,
  acknowledgeCommunication,
  generateDraftReply,
  extractTaskDraftFromMessage,
  detectLooseEnds,
  requestCaseStageTransition,
  canTransitionCase,
  normalizeKanbanStage,
  addCaseEvidence,
  getCaseEvidence,
  verifyCaseEvidence,
} from './state.js';
import { html, raw, render, icon, toast, openModal, closeModal, confirmDialog } from './ui.js';
import { accessibleTask, changeTaskStatus, deleteCapturedTask, taskDateInput, taskDuration } from './taskCapture.js';
import { accessibleCase, visibleCases, getCaseKanbanColumn } from './cases.js';
import { deadlineAlert, priorityFactors } from './taskIntelligence.js';
import { traceDownstream } from './ripple.js';
import { acceptDraft, discardDraft, generateDraft, reviewDraft } from './scheduleReview.js';
import { calendarDay, singaporeInstant, TODAY } from './time.js';

// Page modules
import overviewPage from './pages/overview.js';
import casesPage, { caseView } from './pages/cases.js';
import tasksPage, { clearTaskFilters, tasksView } from './pages/tasks.js';
import { openTaskCapture } from './pages/taskCaptureDialog.js';
import planPage from './pages/plan.js';
import { currentPlanningOfficer, planningDates, planningIssueView, planningView, scheduleRange, visibleDraft } from './pages/smartPlan.js';
import { blockTimes, canRequestScheduleChange, pendingScheduleRequest, requestScheduleChange } from './planningIssues.js';
import { openSchedulePreferences } from './pages/schedulePreferencesDialog.js';
import teamPage from './pages/team.js';
import peoplePage from './pages/people.js';
import teamsAdminPage from './pages/teams-admin.js';
import activityPage from './pages/activity.js';
import decidesPage from './pages/decides.js';
import settingsPage from './pages/settings.js';
import assistantPage from './pages/assistant.js';
import approvalGovernancePage, { approvalGovernanceView, isManagerReviewApproval, managerReviewType } from './pages/approval-governance.js';
import myRequestsPage, { myRequestsView } from './pages/my-requests.js';
import attendancePage, { handleAttendanceClick } from './pages/attendance.js';
import ripplePage, { handleRippleClick } from './pages/ripple.js';

// Navigation section registry
const SECTIONS = {
  overview: { id: 'overview', label: 'Overview', icon: 'grid', page: overviewPage },
  assistant: { id: 'assistant', label: 'Ask SyncAI', icon: 'sparkle', page: assistantPage },
  tasks: { id: 'tasks', label: 'My tasks', icon: 'tasks', page: tasksPage },
  cases: { id: 'cases', label: 'Case Action Centre', icon: 'cases', page: casesPage },
  plan: { id: 'plan', label: 'My plan', icon: 'calendar', page: planPage },
  team: { id: 'team', label: 'My team', icon: 'team', page: teamPage },
  'approval-governance': { id: 'approval-governance', label: 'Approval Governance', icon: 'shield', page: approvalGovernancePage },
  'my-requests': { id: 'my-requests', label: 'My Requests', icon: 'history', page: myRequestsPage },
  attendance: { id: 'attendance', label: 'Attendance', icon: 'users', page: attendancePage },
  ripple: { id: 'ripple', label: 'Ripple Intelligence', icon: 'radar', page: ripplePage },
  people: { id: 'people', label: 'People', icon: 'users', page: peoplePage },
  teams: { id: 'teams', label: 'Teams', icon: 'team', page: teamsAdminPage },
  activity: { id: 'activity', label: 'Activity', icon: 'history', page: activityPage },
  decides: { id: 'decides', label: 'How SyncAI decides', icon: 'sparkle', page: decidesPage },
  settings: { id: 'settings', label: 'Settings', icon: 'settings', page: settingsPage },
};

let currentSection = 'overview';
let currentCaseId = null;
let currentNotificationFilter = 'all';
let lastFocusedTrigger = null;

function closeCaseDrawer() {
  caseView.selectedCaseId = null;
  caseView.activeExplanationRuleId = null;
  caseView.highlightedSourceId = null;
  renderApp();
  if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
    lastFocusedTrigger.focus();
  }
}

// Determine allowed sections based on role and status (matches client/src/lib/sections.js)
function allowedSections(s) {
  const user = getCurrentUser(s);
  if (user.status !== 'active') {
    return ['overview', 'assistant', 'decides', 'settings'];
  }
  if (isAdmin(s)) {
    return ['overview', 'assistant', 'cases', 'people', 'teams', 'activity', 'decides', 'settings'];
  }
  if (isManager(s)) {
    return ['overview', 'assistant', 'tasks', 'cases', 'plan', 'team', 'approval-governance', 'attendance', 'ripple', 'decides', 'settings'];
  }
  // Member
  return ['overview', 'assistant', 'tasks', 'cases', 'plan', 'my-requests', 'attendance', 'decides', 'settings'];
}

function readPortalRoute(s) {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const caseRoute = /^cases\/([^/]+)$/.exec(hash);
  const section = caseRoute ? 'cases' : hash;
  currentSection = allowedSections(s).includes(section) ? section : 'overview';
  currentCaseId = currentSection === 'cases' ? caseRoute?.[1] ?? null : null;
}

function init() {
  const s = loadState();

  // Check URL query params for initial role override (?role=admin, ?role=manager, ?role=member)
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  const statusParam = urlParams.get('status');

  // Check sessionStorage (set by login.html)
  const sessionRole = sessionStorage.getItem('syncai_demo_role');
  const sessionStatus = sessionStorage.getItem('syncai_demo_status');

  const chosenRole = roleParam || sessionRole;
  const chosenStatus = statusParam || sessionStatus;

  if (chosenRole) {
    setCurrentUser(s, {
      role: chosenRole,
      status: chosenStatus || 'active',
      id: chosenRole === 'admin' ? 'a1' : chosenRole === 'manager' ? 's1' : chosenStatus === 'pending' ? 'p1' : chosenStatus === 'disabled' ? 'd1' : 'o1',
    });
  }

  // Restore theme & text preferences
  let theme, textSize;
  try {
    theme = localStorage.getItem('syncai_theme');
    textSize = localStorage.getItem('syncai_text_size');
  } catch {
    // The demo can still run in memory when browser storage is unavailable.
  }
  if (theme && theme !== 'system') document.documentElement.setAttribute('data-theme', theme);
  if (textSize && textSize !== 'standard') document.documentElement.setAttribute('data-text-size', textSize);

  // Read section from URL hash
  readPortalRoute(s);
  const officer = currentPlanningOfficer(s);
  const accepted = s.acceptedSchedules?.[officer?.id];
  if (accepted && !accepted[TODAY]) {
    const latest = Object.values(accepted).sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0];
    if (latest) {
      planningView.date = latest.day.date;
      planningView.mode = latest.dates.length > 1 ? 'weekly' : 'daily';
    }
  }

  // Subscribe to state updates
  subscribe(() => renderApp());

  // Attach global event delegation
  setupEvents();

  // Scroll to Top behavior
  const scrollTopBtn = document.getElementById('btn-scroll-top');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY || document.documentElement.scrollTop;
      scrollTopBtn.classList.toggle('is-visible', scrolled > 240);
    }, { passive: true });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Initial render
  renderApp();
}

function renderApp() {
  const s = getState();
  const user = getCurrentUser(s);
  const allowed = allowedSections(s);

  // Role Boundary check: enforce role-based access
  if (!allowed.includes(currentSection)) {
    currentSection = 'overview';
    currentCaseId = null;
    window.location.hash = '#overview';
  }

  // 1. Update Header
  updateHeader(s, user);

  // 2. Render Navigation Sidebar
  renderNav(s, user, allowed);

  // 3. Render Main Page
  renderMain(s);
}

function updateHeader(s, user) {
  const roleTag = document.getElementById('portal-role-tag');
  const roleSelect = document.getElementById('quick-role-select');
  const nameHeader = document.getElementById('account-name-header');
  const emailHeader = document.getElementById('account-email-header');
  const avatarHeader = document.getElementById('account-avatar-header');
  const nameCard = document.getElementById('account-name-card');
  const emailCard = document.getElementById('account-email-card');
  const roleCard = document.getElementById('account-role-card');
  const avatarCard = document.getElementById('account-avatar-card');

  const roleLabels = {
    admin: 'Admin',
    manager: 'Manager',
    member: user.status === 'pending' ? 'Pending' : user.status === 'disabled' ? 'Disabled' : 'Team member',
  };

  const currentRoleKey = user.status === 'pending' ? 'pending' : user.status === 'disabled' ? 'disabled' : user.role;

  if (roleTag) {
    roleTag.textContent = roleLabels[user.role] || user.role;
    roleTag.className = `portal-tag ${user.role} ${user.status}`;
  }

  if (roleSelect) {
    roleSelect.value = currentRoleKey;
  }

  const initials = user.displayName.includes(',')
    ? user.displayName.split(',')[0].trim().charAt(0).toUpperCase()
    : user.displayName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

  const isGreenAvatar = user.role === 'admin' || user.displayName.includes('TAN') || initials === 'T';

  if (nameHeader) nameHeader.textContent = user.displayName;
  if (emailHeader) emailHeader.textContent = user.email;
  if (avatarHeader) {
    avatarHeader.textContent = initials;
    if (isGreenAvatar) avatarHeader.classList.add('avatar-green');
    else avatarHeader.classList.remove('avatar-green');
  }

  if (nameCard) nameCard.textContent = user.displayName;
  if (emailCard) emailCard.textContent = user.email;
  if (roleCard) roleCard.textContent = roleLabels[user.role];
  if (avatarCard) {
    avatarCard.textContent = initials;
    if (isGreenAvatar) avatarCard.classList.add('avatar-green');
    else avatarCard.classList.remove('avatar-green');
  }

  // Update Actionable Notifications UI (#071)
  const notifBadge = document.getElementById('notification-unread-badge');
  const notifLabel = document.getElementById('notification-count-label');
  const notifList = document.getElementById('notification-list-container');
  const tabAllBtn = document.getElementById('notif-tab-all');
  const tabUnreadBtn = document.getElementById('notif-tab-unread');
  const visibleNotifs = getVisibleNotifications(s);
  const unreadCount = visibleNotifs.filter((n) => !n.read).length;

  if (tabAllBtn && tabUnreadBtn) {
    if (currentNotificationFilter === 'unread') {
      tabUnreadBtn.classList.add('is-active');
      tabAllBtn.classList.remove('is-active');
    } else {
      tabAllBtn.classList.add('is-active');
      tabUnreadBtn.classList.remove('is-active');
    }
    tabAllBtn.textContent = `All (${visibleNotifs.length})`;
    tabUnreadBtn.textContent = `Unread (${unreadCount})`;
  }

  if (notifBadge) {
    if (unreadCount > 0) {
      notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      notifBadge.hidden = false;
    } else {
      notifBadge.hidden = true;
    }
  }

  if (notifLabel) {
    notifLabel.textContent = `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`;
  }

  if (notifList) {
    const displayedNotifs = currentNotificationFilter === 'unread' ? visibleNotifs.filter((n) => !n.read) : visibleNotifs;
    if (displayedNotifs.length === 0) {
      notifList.innerHTML = `<div style="text-align: center; padding: 24px 16px; color: var(--colorNeutralForeground3); font-size: 0.8125rem;">${currentNotificationFilter === 'unread' ? 'No unread notifications.' : 'No actionable notifications recorded for this role.'}</div>`;
    } else {
      notifList.innerHTML = displayedNotifs.slice(0, 10).map((n) => `
        <div class="notification-item ${n.read ? 'is-read' : 'is-unread'}" style="padding: 10px 14px; border-bottom: 1px solid var(--colorNeutralStroke3); display: flex; flex-direction: column; gap: 4px; background: ${n.read ? 'transparent' : 'var(--colorBrandBackground2)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <strong style="font-size: 0.8125rem; color: var(--colorNeutralForeground1);">${n.title}</strong>
            <span class="tag ${n.priority === 'urgent' ? 'tag-danger' : n.priority === 'warning' ? 'tag-warning' : 'tag-neutral'} small">${n.channelLabel || 'In-App'}</span>
          </div>
          <p class="small muted" style="margin: 0; font-size: 0.75rem; line-height: 1.35;">${n.summary}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            ${n.caseId ? `<button type="button" class="btn-subtle btn-sm" data-action="nav-to-case" data-case="${n.caseId}" style="font-size: 0.75rem; padding: 2px 8px;">View Case →</button>` : '<span></span>'}
            ${!n.read ? `<button type="button" class="btn-ghost btn-sm" data-action="notif-mark-read" data-id="${n.id}" style="font-size: 0.75rem; padding: 2px 6px;">Mark read</button>` : '<span class="small muted" style="font-size: 0.75rem;">Read</span>'}
          </div>
        </div>
      `).join('');
    }
  }
}

function renderNav(s, user, allowed) {
  const nav = document.getElementById('portal-nav');
  if (!nav) return;

  const pendingApprovals = getPendingApprovals(s);
  const pendingApprovalsCount = pendingApprovals.filter((a) => a.requestType !== 'operational_change').length;
  const pendingManagerReviewCount = pendingApprovals.filter(isManagerReviewApproval).length;
  const myPendingRequestsCount = pendingApprovals.filter((a) => ['operational_change', 'schedule_adjustment'].includes(a.requestType) && a.requesterId === getCurrentUser(s).id).length;
  const pendingUsersCount = (s.users || []).filter((u) => u.status === 'pending').length;

  const vCases = visibleCases(s);
  let totalLooseEnds = 0;
  for (const vc of vCases) {
    totalLooseEnds += detectLooseEnds(s, vc).length;
  }

  const navHtml = allowed
    .map((secId) => {
      const sec = SECTIONS[secId];
      if (!sec) return '';
      const isCurrent = currentSection === secId;

      let badge = '';
      if (secId === 'people' && pendingUsersCount > 0) {
        badge = html`<span class="tag tag-warning" style="margin-left: auto;">${pendingUsersCount}</span>`;
      } else if (secId === 'team' && pendingApprovalsCount > 0) {
        badge = html`<span class="tag tag-warning" style="margin-left: auto;">${pendingApprovalsCount}</span>`;
      } else if (secId === 'approval-governance' && pendingManagerReviewCount > 0) {
        badge = html`<span class="tag tag-warning" style="margin-left: auto;">${pendingManagerReviewCount}</span>`;
      } else if (secId === 'my-requests' && myPendingRequestsCount > 0) {
        badge = html`<span class="tag tag-warning" style="margin-left: auto;">${myPendingRequestsCount}</span>`;
      } else if (secId === 'cases' && totalLooseEnds > 0) {
        badge = html`<span class="tag tag-warning" style="margin-left: auto;">${totalLooseEnds}</span>`;
      }

      return html`
        <button
          type="button"
          class="portal-nav-item"
          aria-current="${isCurrent ? 'page' : 'false'}"
          data-action="nav-go"
          data-section="${secId}"
        >
          ${icon(sec.icon, 20)}
          <span>${sec.label}</span>
          ${badge}
        </button>
      `;
    })
    .join('');

  nav.innerHTML = `
    ${navHtml}
    <p class="portal-nav-note small">
      ${icon('info', 18)} Illustrated with fictional EM Services data. All AI suggestions require human approval.
    </p>
  `;
}

function renderMain(s) {
  const main = document.getElementById('main-content');
  if (!main) return;

  const sec = SECTIONS[currentSection] || SECTIONS.overview;
  render(main, sec.id === 'cases' ? sec.page.render(s, currentCaseId) : sec.page.render(s));
}

let isDraggingCard = false;
let currentDragCaseId = null;

function handleCaseTransitionFlow(caseId, targetStage) {
  const s = getState();
  const c = getCase(s, caseId);
  if (!c) return;

  const check = canTransitionCase(s, caseId, targetStage);
  if (check.isCurrent) return;

  if (!check.permitted) {
    toast(`Transition rejected: ${check.reason}`, 'error');
    return;
  }

  if (check.requiresReason || check.requiresApproval || check.isException) {
    caseView.transitionModal = {
      caseId: c.id,
      targetStage,
      currentStage: getCaseKanbanColumn(c),
      requiresReason: Boolean(check.requiresReason),
      requiresApproval: Boolean(check.requiresApproval),
      isException: Boolean(check.isException),
      reasonHint: check.reason,
      unresolvedItems: check.unresolvedItems || [],
      error: null,
    };
    renderApp();
    return;
  }

  // Straightforward permitted transition
  update((stateObj) => {
    const res = requestCaseStageTransition(stateObj, caseId, targetStage);
    if (!res.success) {
      toast(res.error, 'error');
    } else {
      toast(res.message || 'Case moved successfully.', 'success');
    }
  });
  renderApp();
}

function setupKanbanDragAndDrop() {
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.kanban-case-card');
    if (!card) return;
    const cid = card.dataset.caseId || card.dataset.case;
    if (!cid) return;

    isDraggingCard = true;
    currentDragCaseId = cid;
    card.classList.add('is-dragging');

    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', cid);
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  document.addEventListener('dragend', (e) => {
    const card = e.target.closest('.kanban-case-card');
    if (card) card.classList.remove('is-dragging');
    document.querySelectorAll('.kanban-col').forEach((col) => {
      col.classList.remove('is-drop-target', 'is-invalid-target');
    });
    currentDragCaseId = null;
    setTimeout(() => {
      isDraggingCard = false;
    }, 150);
  });

  document.addEventListener('dragover', (e) => {
    const dropzone = e.target.closest('#evidence-dropzone');
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
      return;
    }

    const col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault();

    const targetColId = col.dataset.colId;
    if (!targetColId || !currentDragCaseId) return;

    const s = getState();
    const check = canTransitionCase(s, currentDragCaseId, targetColId);

    if (check.isCurrent) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      col.classList.remove('is-drop-target', 'is-invalid-target');
    } else if (check.permitted) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      col.classList.add('is-drop-target');
      col.classList.remove('is-invalid-target');
    } else {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      col.classList.add('is-invalid-target');
      col.classList.remove('is-drop-target');
    }
  });

  document.addEventListener('dragleave', (e) => {
    const dropzone = e.target.closest('#evidence-dropzone');
    if (dropzone && !dropzone.contains(e.relatedTarget)) {
      dropzone.classList.remove('is-dragover');
      return;
    }

    const col = e.target.closest('.kanban-col');
    if (!col) return;
    if (!col.contains(e.relatedTarget)) {
      col.classList.remove('is-drop-target', 'is-invalid-target');
    }
  });

  document.addEventListener('drop', (e) => {
    const dropzone = e.target.closest('#evidence-dropzone');
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      const fileInput = document.getElementById('evidence-file-input');
      if (fileInput && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    const col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault();

    col.classList.remove('is-drop-target', 'is-invalid-target');
    const targetStage = col.dataset.colId;
    const caseId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || currentDragCaseId;

    if (caseId && targetStage) {
      handleCaseTransitionFlow(caseId, targetStage);
    }
  });
}

function setupEvents() {
  setupKanbanDragAndDrop();

  document.addEventListener('click', (e) => {
    // 0. Mobile Navigation Hamburger & Backdrop
    const mobileNavToggle = e.target.closest('#btn-mobile-nav-toggle');
    if (mobileNavToggle) {
      const nav = document.getElementById('portal-nav');
      const backdrop = document.getElementById('mobile-nav-backdrop');
      const isOpen = nav?.classList.toggle('is-open');
      mobileNavToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (backdrop) {
        if (isOpen) backdrop.removeAttribute('hidden');
        else backdrop.setAttribute('hidden', '');
      }
      return;
    }

    const mobileBackdrop = e.target.closest('#mobile-nav-backdrop');
    if (mobileBackdrop) {
      document.getElementById('portal-nav')?.classList.remove('is-open');
      mobileBackdrop.setAttribute('hidden', '');
      document.getElementById('btn-mobile-nav-toggle')?.setAttribute('aria-expanded', 'false');
      return;
    }

    // Attendance (104, 051) and Ripple Intelligence pages
    if (handleAttendanceClick(e) || handleRippleClick(e)) {
      renderApp();
      return;
    }

    // Evidence file dropzone click
    const evidenceDropzone = e.target.closest('#evidence-dropzone');
    if (evidenceDropzone) {
      const fileInput = document.getElementById('evidence-file-input');
      if (fileInput && e.target !== fileInput) {
        fileInput.click();
        return;
      }
    }

    if (e.target.closest('[data-action="settings-reset-defaults"]')) {
      saveDisplaySetting('theme', 'system');
      saveDisplaySetting('text-size', 'standard');
      toast('Display settings reset.', 'info');
      renderApp();
      document.querySelector('[data-action="settings-reset-defaults"]')?.focus();
      return;
    }
    // 1. Navigation clicks
    const navBtn = e.target.closest('[data-action="nav-go"]');
    if (navBtn) {
      e.preventDefault();
      // Close mobile navigation drawer if open
      document.getElementById('portal-nav')?.classList.remove('is-open');
      document.getElementById('mobile-nav-backdrop')?.setAttribute('hidden', '');
      document.getElementById('btn-mobile-nav-toggle')?.setAttribute('aria-expanded', 'false');

      const sec = navBtn.dataset.section;
      if (sec && SECTIONS[sec]) {
        currentSection = sec;
        currentCaseId = null;
        window.location.hash = `#${sec}`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderApp();
      }
      return;
    }

    // 2. Account popover toggle
    const accountTrigger = e.target.closest('#account-trigger');
    const popover = document.getElementById('account-popover');
    if (accountTrigger) {
      e.stopPropagation();
      const isHidden = popover.hasAttribute('hidden');
      if (isHidden) {
        popover.removeAttribute('hidden');
        accountTrigger.setAttribute('aria-expanded', 'true');
      } else {
        popover.setAttribute('hidden', '');
        accountTrigger.setAttribute('aria-expanded', 'false');
      }
      return;
    }

    if (popover && !popover.contains(e.target)) {
      popover.setAttribute('hidden', '');
      document.getElementById('account-trigger')?.setAttribute('aria-expanded', 'false');
    }

    // 2b. Notification popover toggle (#071)
    const notifTrigger = e.target.closest('#btn-notification-trigger');
    const notifPopover = document.getElementById('notification-popover');
    if (notifTrigger) {
      e.stopPropagation();
      if (notifPopover) {
        const isHidden = notifPopover.hasAttribute('hidden');
        if (isHidden) {
          notifPopover.removeAttribute('hidden');
          notifTrigger.setAttribute('aria-expanded', 'true');
          popover?.setAttribute('hidden', '');
        } else {
          notifPopover.setAttribute('hidden', '');
          notifTrigger.setAttribute('aria-expanded', 'false');
        }
      }
      return;
    }

    if (notifPopover && !notifPopover.contains(e.target) && !e.target.closest('#btn-notification-trigger')) {
      notifPopover.setAttribute('hidden', '');
      document.getElementById('btn-notification-trigger')?.setAttribute('aria-expanded', 'false');
    }

    // Notification All / Unread tabs
    const notifTabBtn = e.target.closest('[data-action="notif-tab"]');
    if (notifTabBtn) {
      currentNotificationFilter = notifTabBtn.dataset.tab;
      renderApp();
      const pop = document.getElementById('notification-popover');
      if (pop) pop.removeAttribute('hidden');
      document.getElementById('btn-notification-trigger')?.setAttribute('aria-expanded', 'true');
      return;
    }

    // Mark all notifications read
    if (e.target.closest('#btn-mark-all-read')) {
      update((s) => markAllNotificationsRead(s));
      toast('All notifications marked as read.', 'success');
      renderApp();
      const pop = document.getElementById('notification-popover');
      if (pop) pop.removeAttribute('hidden');
      document.getElementById('btn-notification-trigger')?.setAttribute('aria-expanded', 'true');
      return;
    }

    // Mark single notification read
    const notifReadBtn = e.target.closest('[data-action="notif-mark-read"]');
    if (notifReadBtn) {
      const nid = notifReadBtn.dataset.id;
      update((s) => markNotificationRead(s, nid));
      toast('Notification marked as read.', 'info');
      renderApp();
      const pop = document.getElementById('notification-popover');
      if (pop) pop.removeAttribute('hidden');
      document.getElementById('btn-notification-trigger')?.setAttribute('aria-expanded', 'true');
      return;
    }

    // 3. Sign out button
    if (e.target.closest('#btn-signout')) {
      sessionStorage.clear();
      window.location.href = 'site/login.html';
      return;
    }

    // 4. Switch account button
    if (e.target.closest('#btn-switch-account')) {
      document.getElementById('account-popover')?.setAttribute('hidden', '');
      showAccountSwitchModal();
      return;
    }

    // 5. Reset demo buttons
    if (e.target.closest('#btn-quick-reset') || e.target.closest('#btn-reset-demo-card') || e.target.closest('[data-action="settings-reset-demo-data"]')) {
      planningView.drafts.clear();
      Object.assign(planningIssueView, { open: false, date: '', allDates: false, issues: [] });
      Object.assign(planningView, { date: TODAY, mode: 'daily', officerId: null });
      resetState();
      toast('Demo state reset to default seed.', 'success');
      renderApp();
      return;
    }

    // 6. Tasks actions
    const taskToggle = e.target.closest('[data-action="task-toggle"]');
    if (taskToggle) {
      const taskId = taskToggle.dataset.id;
      const task = accessibleTask(getState(), taskId);
      if (task) {
        update((s) => changeTaskStatus(s, taskId, isOpen(task) ? 'done' : 'todo'));
        toast('Task status updated.', 'success');
      }
      return;
    }

    const taskInspect = e.target.closest('[data-action="task-inspect"]');
    if (taskInspect) {
      const taskId = taskInspect.dataset.id;
      const s = getState();
      const t = accessibleTask(s, taskId);
      if (t) showTaskDetailModal(s, t);
      return;
    }

    const taskRequestApproval = e.target.closest('[data-action="task-request-approval"]');
    if (taskRequestApproval) {
      const s = getState();
      const taskId = taskRequestApproval.dataset.id || document.getElementById('my-requests-task-id')?.value;
      const task = taskId ? accessibleTask(s, taskId) : null;
      if (!isTeamMember(s) || getCurrentUser(s).status !== 'active') {
        toast('Only an active team member can submit an operational-change request.', 'error');
      } else if (!task || task.ownerId !== s.currentOfficerId) {
        toast(taskId ? 'Select one of your assigned tasks.' : 'Select an assigned task first.', 'error');
      } else {
        showTaskApprovalRequestModal(s, task);
      }
      return;
    }

    const myRequestDetails = e.target.closest('[data-action="my-request-details"]');
    if (myRequestDetails) {
      const s = getState();
      const approval = getApprovals(s).find((item) => item.id === myRequestDetails.dataset.id
        && ['operational_change', 'schedule_adjustment'].includes(item.requestType)
        && item.requesterId === getCurrentUser(s).id);
      if (approval) showRequesterApprovalRequestDetails(s, approval);
      else toast('Request not found.', 'error');
      return;
    }

    const myRequestsTypeFilter = e.target.closest('[data-action="my-requests-type-filter"]');
    if (myRequestsTypeFilter) {
      const filter = myRequestsTypeFilter.dataset.type;
      if (['all', 'operational_change', 'schedule_adjustment'].includes(filter)) {
        myRequestsView.typeFilter = filter;
        renderApp();
      }
      return;
    }

    const taskEdit = e.target.closest('[data-action="capture-edit"]');
    if (taskEdit) {
      const task = accessibleTask(getState(), taskEdit.dataset.id);
      if (task) openTaskCapture({ task });
      return;
    }

    const moreTaskFilters = e.target.closest('[data-action="tasks-more-filters"]');
    if (moreTaskFilters) {
      tasksView.moreFiltersOpen = !tasksView.moreFiltersOpen;
      moreTaskFilters.setAttribute('aria-expanded', String(tasksView.moreFiltersOpen));
      document.getElementById('tasks-extra-filters').hidden = !tasksView.moreFiltersOpen;
      return;
    }

    if (e.target.closest('[data-action="tasks-clear-filters"]')) {
      clearTaskFilters();
      renderApp();
      document.querySelector('[data-action="tasks-search"]')?.focus();
      return;
    }

    const taskDelete = e.target.closest('[data-action="capture-delete"]');
    if (taskDelete) {
      const task = accessibleTask(getState(), taskDelete.dataset.id);
      if (task?.manualCapture) {
        confirmDialog({
          title: 'Delete task?',
          body: `“${task.title}” will be removed from this prototype.`,
          confirmLabel: 'Delete task',
          danger: true,
        }).then((confirmed) => {
          if (!confirmed || !accessibleTask(getState(), task.id)?.manualCapture) return;
          update((s) => deleteCapturedTask(s, task.id));
          toast('Task deleted.', 'success');
          document.querySelector('[data-action="tasks-search"]')?.focus();
        });
      }
      return;
    }

    const tasksFilterStatus = e.target.closest('[data-action="tasks-filter-status"]');
    if (tasksFilterStatus) {
      const status = tasksFilterStatus.dataset.status;
      tasksView.status = status;
      tasksView.page = 1;
      renderApp();
      document.querySelector('[data-action="tasks-filter-status"][aria-pressed="true"]')?.focus();
      return;
    }

    const tasksPageBtn = e.target.closest('[data-action="tasks-page"]');
    if (tasksPageBtn) {
      const p = parseInt(tasksPageBtn.dataset.page, 10);
      if (!isNaN(p) && p >= 1) {
        tasksView.page = p;
        renderApp();
      }
      return;
    }

    const peopleFilterBtn = e.target.closest('[data-action="people-filter"]');
    if (peopleFilterBtn) {
      const filter = peopleFilterBtn.dataset.filter;
      const targetView = peoplePage.peopleView || peoplePage.view || {};
      targetView.filter = filter;
      targetView.page = 1;
      renderApp();
      return;
    }

    const peoplePageBtn = e.target.closest('[data-action="people-page"]');
    if (peoplePageBtn) {
      const p = parseInt(peoplePageBtn.dataset.page, 10);
      if (!isNaN(p) && p >= 1) {
        const targetView = peoplePage.peopleView || peoplePage.view || {};
        targetView.page = p;
        renderApp();
      }
      return;
    }

    const activityPageBtn = e.target.closest('[data-action="activity-page"]');
    if (activityPageBtn) {
      const p = parseInt(activityPageBtn.dataset.page, 10);
      if (!isNaN(p) && p >= 1) {
        const targetView = activityPage.activityView || activityPage.view || {};
        targetView.page = p;
        renderApp();
      }
      return;
    }

    const taskCreateDialog = e.target.closest('[data-action="task-create-dialog"]');
    if (taskCreateDialog) {
      const caseId = taskCreateDialog.dataset.caseId;
      if (caseId && !accessibleCase(getState(), caseId)) return;
      openTaskCapture({
        caseId,
        onCreate: caseId ? undefined : () => Object.assign(tasksView, {
          q: '', status: 'all', priority: 'all', category: 'all', tag: '', owner: 'all', dueDate: '', page: 1,
        }),
      });
      return;
    }

    const planControl = e.target.closest('button[data-action^="plan-"]');
    if (planControl) {
      const officer = currentPlanningOfficer(getState());
      if (!officer) return;
      const { action, mode, offset, date } = planControl.dataset;
      if (action === 'plan-issue-request') {
        const issue = planningIssueView.issues.find(({ id }) => id === planControl.dataset.id);
        if (issue && canRequestScheduleChange(getState(), issue) && !pendingScheduleRequest(getState(), issue)) openScheduleChangeRequest(issue);
        return;
      }
      if (action === 'plan-review-all') {
        Object.assign(planningIssueView, { allDates: true, open: true });
        renderApp();
        document.querySelector('#schedule-issue-panel > summary')?.focus();
        return;
      }
      if (action === 'plan-issue-day') {
        planningIssueView.date = date;
        planningIssueView.open = true;
        renderApp();
        document.querySelector('[data-action="plan-issue-day"][aria-pressed="true"]')?.focus();
        return;
      }
      if (action === 'plan-issue-week') {
        Object.assign(planningView, { date, mode: 'weekly' });
        Object.assign(planningIssueView, { date, open: true, allDates: false });
        renderApp();
        document.querySelector('[data-action="plan-issue-day"][aria-pressed="true"]')?.focus();
        return;
      }
      if (action === 'plan-preferences') {
        openSchedulePreferences(officer);
        return;
      }
      const draft = visibleDraft(officer.id);
      if (action === 'plan-accept' || action === 'plan-discard') {
        if (draft) resolveScheduleDraft(draft, action === 'plan-accept');
        return;
      }
      if (action === 'plan-generate') {
        planningIssueView.date = '';
        planningIssueView.allDates = false;
        const dates = draft && reviewDraft(getState(), draft).changed.length ? draft.dates : planningDates();
        planningView.drafts.set(officer.id, generateDraft(getState(), officer.id, dates));
        toast('Draft schedule generated.', 'info');
      }
      if (action === 'plan-view') planningView.mode = mode;
      if (action === 'plan-today') planningView.date = TODAY;
      if (action === 'plan-shift') planningView.date = calendarDay(planningView.date, Number(offset) * (planningView.mode === 'weekly' ? 7 : 1));
      if (['plan-view', 'plan-today', 'plan-shift'].includes(action)) planningIssueView.allDates = false;
      if (action === 'plan-open-day') {
        Object.assign(planningView, { date, mode: 'daily' });
        planningIssueView.allDates = false;
        if (planningIssueView.issues.some((issue) => issue.date === date)) planningIssueView.open = true;
      }
      renderApp();
      if (action === 'plan-open-day') document.querySelector('[data-action="plan-view"][data-mode="daily"]')?.focus();
      else if (action === 'plan-view') document.querySelector('[data-action="plan-view"][aria-pressed="true"]')?.focus();
      else if (action === 'plan-shift') document.querySelector(`[data-action="plan-shift"][data-offset="${offset}"]`)?.focus();
      else document.querySelector(`[data-action="${action}"]`)?.focus();
      return;
    }

    const calRefresh = e.target.closest('[data-action="cal-refresh"]');
    if (calRefresh) {
      toast('Outlook Calendar refreshed (Simulated).', 'info');
      return;
    }

    const todoRefresh = e.target.closest('[data-action="todo-refresh"]');
    if (todoRefresh) {
      toast('Microsoft To Do refreshed (Simulated).', 'info');
      return;
    }

    // 8. Manager Approval Queue actions
    const mgrApprove = e.target.closest('[data-action="manager-approve"]');
    if (mgrApprove) {
      const apprId = mgrApprove.dataset.id;
      let outcome;
      update((s) => {
        outcome = decideApproval(s, apprId, 'approved', actorName(s), 'Approved by authorised manager.');
      });
      toast(outcome.message || outcome.error, outcome.success ? 'success' : 'error');
      return;
    }

    const mgrReject = e.target.closest('[data-action="manager-reject"]');
    if (mgrReject) {
      const apprId = mgrReject.dataset.id;
      update((s) => {
        decideApproval(s, apprId, 'rejected', actorName(s), 'Declined after operational capacity review.');
      });
      toast('Approval request declined.', 'info');
      renderApp();
      return;
    }

    const governanceReview = e.target.closest('[data-action="manager-governance-review"]');
    if (governanceReview) {
      const s = getState();
      if (!isManager(s) || getCurrentUser(s).status !== 'active') {
        toast('Only an active manager can review approval requests.', 'error');
        return;
      }
      const approval = getApprovals(s).find((item) => item.id === governanceReview.dataset.id && isManagerReviewApproval(item));
      if (!approval || !managerReviewType(approval)) {
        toast('Approval request not found.', 'error');
        return;
      }
      showManagerApprovalReview(s, approval);
      return;
    }

    const governanceTypeFilter = e.target.closest('[data-action="manager-governance-type-filter"]');
    if (governanceTypeFilter) {
      approvalGovernanceView.typeFilter = governanceTypeFilter.dataset.type || 'all';
      renderApp();
      return;
    }

    const governanceStatusFilter = e.target.closest('[data-action="manager-governance-status-filter"]');
    if (governanceStatusFilter) {
      approvalGovernanceView.statusFilter = governanceStatusFilter.dataset.status || 'all';
      renderApp();
      return;
    }

    const teamExpand = e.target.closest('[data-action="team-toggle-expand"]');
    if (teamExpand) {
      const teamId = teamExpand.dataset.team;
      teamPage.teamView.expandedTeamId = teamPage.teamView.expandedTeamId === teamId ? null : teamId;
      renderApp();
      return;
    }

    // Admin Teams Accordion & Members
    const adminTeamToggle = e.target.closest('[data-action="admin-team-toggle"]');
    if (adminTeamToggle) {
      const teamId = adminTeamToggle.dataset.team;
      if (teamsAdminPage.teamsAdminView.expandedIds.has(teamId)) {
        teamsAdminPage.teamsAdminView.expandedIds.delete(teamId);
      } else {
        teamsAdminPage.teamsAdminView.expandedIds.add(teamId);
      }
      renderApp();
      return;
    }

    const adminTeamsToggleAll = e.target.closest('[data-action="admin-teams-toggle-all"]');
    if (adminTeamsToggleAll) {
      const s = getState();
      const teams = getTeams(s);
      const allExp = teams.length > 0 && teams.every((t) => teamsAdminPage.teamsAdminView.expandedIds.has(t.id));
      if (allExp) {
        teamsAdminPage.teamsAdminView.expandedIds.clear();
      } else {
        teams.forEach((t) => teamsAdminPage.teamsAdminView.expandedIds.add(t.id));
      }
      renderApp();
      return;
    }

    const adminAddMember = e.target.closest('[data-action="admin-add-team-member"]');
    if (adminAddMember) {
      const teamId = adminAddMember.dataset.team;
      const selectId = adminAddMember.dataset.select;
      const selectEl = document.getElementById(selectId);
      const userId = selectEl ? selectEl.value : null;
      if (!userId) {
        toast('Please select an active officer from the dropdown.', 'error');
        return;
      }
      update((s) => {
        addTeamMember(s, teamId, userId);
        const user = getUser(s, userId);
        logActivity(s, `Added ${user ? user.displayName : userId} to team`, actorName(s));
      });
      toast('Officer successfully added to team.', 'success');
      renderApp();
      return;
    }

    const adminRemoveMember = e.target.closest('[data-action="admin-remove-team-member"]');
    if (adminRemoveMember) {
      const teamId = adminRemoveMember.dataset.team;
      const userId = adminRemoveMember.dataset.user;
      update((s) => {
        removeTeamMember(s, teamId, userId);
        const user = getUser(s, userId);
        logActivity(s, `Removed ${user ? user.displayName : userId} from team`, actorName(s));
      });
      toast('Officer removed from team.', 'info');
      renderApp();
      return;
    }

    const adminCreateTeam = e.target.closest('[data-action="admin-create-team-dialog"]');
    if (adminCreateTeam) {
      showCreateTeamModal(getState());
      return;
    }

    // 9. Admin People actions
    const adminApprove = e.target.closest('[data-action="admin-approve"]');
    if (adminApprove) {
      const userId = adminApprove.dataset.id;
      update((s) => {
        approveUser(s, userId, 'member');
      });
      toast('User account approved and activated.', 'success');
      renderApp();
      return;
    }

    const adminDisable = e.target.closest('[data-action="admin-disable"]');
    if (adminDisable) {
      const userId = adminDisable.dataset.id;
      update((s) => {
        setUserStatus(s, userId, 'disabled');
      });
      toast('User access turned off.', 'info');
      renderApp();
      return;
    }

    const adminRestore = e.target.closest('[data-action="admin-restore"]');
    if (adminRestore) {
      const userId = adminRestore.dataset.id;
      update((s) => {
        setUserStatus(s, userId, 'active');
      });
      toast('User access restored.', 'success');
      renderApp();
      return;
    }

    const copyInvite = e.target.closest('[data-action="copy-invite"]');
    if (copyInvite) {
      const codeEl = document.getElementById('invite-link-code');
      const textToCopy = codeEl ? codeEl.innerText.trim() : (window.location.origin + '/prototype/site/login.html');
      navigator.clipboard?.writeText(textToCopy);
      toast('Demo invite link copied to clipboard.', 'success');
      return;
    }

    // 10. Assistant preset click
    const askPreset = e.target.closest('[data-action="assistant-ask-preset"]');
    if (askPreset) {
      const q = askPreset.dataset.q;
      assistantPage.ask(getState(), q, () => renderApp());
      return;
    }

    const assistantClear = e.target.closest('[data-action="assistant-clear"]');
    if (assistantClear) {
      assistantPage.clear();
      renderApp();
      return;
    }

    // 11. Modal close actions
    if (e.target.closest('[data-action="modal-close"]')) {
      closeModal();
      return;
    }

    // 12. Graph test
    if (e.target.closest('[data-action="graph-test-run"]')) {
      const resultEl = document.getElementById('graph-test-result');
      if (resultEl) {
        resultEl.textContent = 'Testing Graph API handshake...';
        setTimeout(() => {
          resultEl.textContent = 'Simulated Graph token verified: Read.Calendar, Read.Tasks, User.Read OK.';
          toast('Graph token test successful.', 'success');
        }, 300);
      }
      return;
    }

    // 13. Case Action Centre events
    const caseTabBtn = e.target.closest('[data-action="case-tab"]');
    if (caseTabBtn) {
      caseView.activeTab = caseTabBtn.dataset.tab;
      renderApp();
      return;
    }

    const caseViewModeBtn = e.target.closest('[data-action="case-view-mode"]');
    if (caseViewModeBtn) {
      caseView.viewMode = caseViewModeBtn.dataset.mode;
      renderApp();
      return;
    }

    const caseInspectBtn = e.target.closest('[data-action="case-inspect"]');
    if (caseInspectBtn) {
      // Case links behave as in-page workspace controls; do not let their
      // fallback hash navigate away before the detail workspace opens.
      e.preventDefault();
      e.stopPropagation();
      lastFocusedTrigger = caseInspectBtn;
      const cid = caseInspectBtn.dataset.id;
      caseView.selectedCaseId = cid;
      if (caseInspectBtn.dataset.tab) {
        caseView.journeyTab = caseInspectBtn.dataset.tab;
      } else {
        caseView.journeyTab = 'timeline';
      }
      if (caseInspectBtn.dataset.rule) {
        caseView.activeExplanationRuleId = caseInspectBtn.dataset.rule;
      }
      caseView.highlightedSourceId = null;
      renderApp();
      setTimeout(() => {
        document.querySelector('.drawer-close-btn')?.focus();
      }, 50);
      return;
    }

    const caseModalClose = e.target.closest('button[data-action="case-modal-close"]');
    const caseBackdropClose = e.target.matches('.case-workspace-backdrop[data-action="case-modal-close"]');
    if (caseModalClose || caseBackdropClose) {
      closeCaseDrawer();
      return;
    }

    const journeyTabBtn = e.target.closest('[data-action="case-journey-tab"]');
    if (journeyTabBtn) {
      caseView.journeyTab = journeyTabBtn.dataset.tab;
      renderApp();
      const scrollEl = document.querySelector('.case-detail-scroll');
      if (scrollEl) scrollEl.scrollTop = 0;
      return;
    }

    if (e.target.closest('[data-action="case-clear-filters"]')) {
      caseView.searchQuery = '';
      caseView.estateFilter = 'all';
      caseView.urgencyFilter = 'all';
      caseView.activeTab = 'all';
      renderApp();
      return;
    }

    // Move to Stage Accessible Modal Triggers
    const moveStageBtn = e.target.closest('[data-action="case-move-stage-dialog"]');
    if (moveStageBtn) {
      e.stopPropagation();
      caseView.moveStageModalCaseId = moveStageBtn.dataset.case;
      renderApp();
      return;
    }

    const moveStageClose = e.target.closest('button[data-action="case-move-stage-close"]');
    const moveStageBackdropClose = e.target.matches('.modal-backdrop[data-action="case-move-stage-close"]');
    if (moveStageClose || moveStageBackdropClose) {
      caseView.moveStageModalCaseId = null;
      renderApp();
      return;
    }

    const selectMoveStageBtn = e.target.closest('[data-action="case-select-move-stage"]');
    if (selectMoveStageBtn) {
      const cid = selectMoveStageBtn.dataset.case;
      const targetStage = selectMoveStageBtn.dataset.target;
      caseView.moveStageModalCaseId = null;
      handleCaseTransitionFlow(cid, targetStage);
      return;
    }

    const resolveAndMoveBtn = e.target.closest('[data-action="case-resolve-blocker-and-move"]');
    if (resolveAndMoveBtn) {
      const cid = resolveAndMoveBtn.dataset.case;
      const bid = resolveAndMoveBtn.dataset.blocker;
      const targetStage = resolveAndMoveBtn.dataset.target;
      caseView.moveStageModalCaseId = null;
      update((s) => {
        resolveCaseBlocker(s, cid, bid);
        const res = requestCaseStageTransition(s, cid, targetStage);
        if (!res.success) {
          toast(res.error, 'error');
        } else {
          toast(res.message || 'Blocker resolved and case resumed in In Progress.', 'success');
        }
      });
      renderApp();
      return;
    }

    // Consequential Stage Transition Confirmation Modal Triggers
    const transitionCancel = e.target.closest('button[data-action="case-transition-cancel"]');
    const transitionBackdropCancel = e.target.matches('.modal-backdrop[data-action="case-transition-cancel"]');
    if (transitionCancel || transitionBackdropCancel) {
      caseView.transitionModal = null;
      renderApp();
      return;
    }

    const confirmTransitionBtn = e.target.closest('[data-action="case-transition-confirm"]');
    if (confirmTransitionBtn) {
      const cid = confirmTransitionBtn.dataset.case;
      const targetStage = confirmTransitionBtn.dataset.target;
      const reasonInput = document.getElementById('case-transition-reason-input');
      const reasonVal = reasonInput ? reasonInput.value.trim() : '';

      const modal = caseView.transitionModal;
      if (modal && modal.requiresReason && reasonVal.length < 4) {
        toast('Please enter a valid operational reason (minimum 4 characters).', 'error');
        return;
      }

      update((s) => {
        const res = requestCaseStageTransition(s, cid, targetStage, null, reasonVal);
        if (!res.success) {
          toast(res.error, 'error');
        } else {
          caseView.transitionModal = null;
          toast(res.message || 'Stage transition completed.', 'success');
        }
      });
      renderApp();
      return;
    }

    // Card Surface Click (opens case if not dragging and not clicking on interactive child elements)
    const cardSurface = e.target.closest('[data-action="case-card-surface"]');
    if (cardSurface) {
      if (isDraggingCard) return;
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.kanban-card-drag-affordance')) {
        return;
      }
      const cid = cardSurface.dataset.caseId || cardSurface.dataset.case;
      if (cid) {
        caseView.selectedCaseId = cid;
        caseView.journeyTab = 'timeline';
        renderApp();
        return;
      }
    }

    // Table Row Click (opens case if not clicking on interactive child elements)
    const rowClick = e.target.closest('[data-action="case-row-click"]');
    if (rowClick) {
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.tag')) {
        return;
      }
      const cid = rowClick.dataset.caseId;
      if (cid) {
        caseView.selectedCaseId = cid;
        caseView.journeyTab = 'timeline';
        renderApp();
        return;
      }
    }

    const casePlanNav = e.target.closest('[data-action="case-plan-nav"]');
    if (casePlanNav) {
      caseView.selectedCaseId = null;
      currentSection = 'plan';
      window.location.hash = '#plan';
      toast('Navigated to Smart Planner for scheduled case commitments.', 'info');
      renderApp();
      return;
    }

    const caseRippleNav = e.target.closest('[data-action="case-ripple-nav"]');
    if (caseRippleNav) {
      const state = getState();
      const task = accessibleTask(state, caseRippleNav.dataset.task);
      if (!task) {
        toast('This task is unavailable.', 'info');
        return;
      }
      showTaskDetailModal(state, task);
      const details = document.querySelector('#modal-root .task-details-extra');
      if (details) details.open = true;
      return;
    }

    const navToCaseBtn = e.target.closest('[data-action="nav-to-case"]');
    if (navToCaseBtn) {
      closeModal();
      const pop = document.getElementById('notification-popover');
      if (pop) pop.setAttribute('hidden', '');
      document.getElementById('btn-notification-trigger')?.setAttribute('aria-expanded', 'false');
      const cid = navToCaseBtn.dataset.case;
      currentSection = 'cases';
      window.location.hash = '#cases';
      caseView.selectedCaseId = cid;
      caseView.journeyTab = 'timeline';
      renderApp();
      return;
    }

    const caseRequestClosureBtn = e.target.closest('[data-action="case-request-closure"]');
    if (caseRequestClosureBtn) {
      const cid = caseRequestClosureBtn.dataset.case;
      update((s) => {
        const res = requestCaseClosure(s, cid);
        if (!res.success) {
          toast(res.error, 'error');
        } else {
          toast('Closure approval request submitted to Manager Jennifer Ong.', 'success');
        }
      });
      renderApp();
      return;
    }

    const caseCloseBtn = e.target.closest('[data-action="case-close-action"]');
    if (caseCloseBtn) {
      const cid = caseCloseBtn.dataset.case;
      const s = getState();
      if (!isManager(s)) {
        update((st) => {
          const res = requestCaseClosure(st, cid);
          if (!res.success) {
            toast(res.error, 'error');
            caseView.journeyTab = 'readiness';
          } else {
            toast('Closure approval request submitted to Manager Jennifer Ong.', 'success');
          }
        });
      } else {
        update((st) => {
          const res = closeCase(st, cid);
          if (!res.success) {
            toast(res.error, 'error');
            caseView.journeyTab = 'readiness';
          } else {
            toast(`Case ${res.case.caseNumber} closed successfully.`, 'success');
          }
        });
      }
      renderApp();
      return;
    }

    const caseSubmitNoteBtn = e.target.closest('[data-action="case-submit-note"]');
    if (caseSubmitNoteBtn) {
      const form = document.getElementById('case-add-note-form');
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit(caseSubmitNoteBtn);
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
      return;
    }

    const caseRefreshBriefBtn = e.target.closest('[data-action="case-refresh-brief"]');
    if (caseRefreshBriefBtn) {
      toast('AI Case Brief refreshed from latest verified case state.', 'info');
      renderApp();
      return;
    }

    const caseReassignBtn = e.target.closest('[data-action="case-reassign-dialog"]');
    if (caseReassignBtn) {
      const cid = caseReassignBtn.dataset.case || caseView.selectedCaseId;
      // Reassignment is a separate focused workflow. Remove the case workspace
      // before mounting the generic modal so dialogs never stack visually or
      // compete for keyboard focus.
      caseView.selectedCaseId = null;
      caseView.activeExplanationRuleId = null;
      caseView.highlightedSourceId = null;
      renderApp();
      showCaseReassignModal(getState(), cid);
      return;
    }

    const caseCopyBriefBtn = e.target.closest('[data-action="case-copy-brief"]');
    if (caseCopyBriefBtn) {
      const el = document.getElementById('case-brief-text');
      if (el) {
        navigator.clipboard?.writeText(el.innerText);
        const originalText = caseCopyBriefBtn.innerHTML;
        caseCopyBriefBtn.innerHTML = '✓ Copied!';
        setTimeout(() => { caseCopyBriefBtn.innerHTML = originalText; }, 2000);
        toast('Case Brief copied to clipboard.', 'success');
      }
      return;
    }

    const toggleCp = e.target.closest('[data-action="case-toggle-checkpoint"]');
    if (toggleCp) {
      const cid = toggleCp.dataset.case;
      const cpid = toggleCp.dataset.cp;
      update((s) => {
        const c = s.cases?.find((item) => item.id === cid);
        const cp = c?.checkpoints?.find((item) => item.id === cpid);
        if (cp) {
          cp.completed = toggleCp.checked;
          if (cp.completed) {
            cp.completedAt = new Date().toISOString();
            toast(`Checkpoint "${cp.title}" marked completed.`, 'success');
          } else {
            cp.completedAt = null;
            toast(`Checkpoint "${cp.title}" marked pending.`, 'info');
          }
        }
      });
      renderApp();
      return;
    }

    const resolveFindingBtn = e.target.closest('[data-action="case-resolve-finding"]');
    if (resolveFindingBtn) {
      const cid = resolveFindingBtn.dataset.case;
      const rule = resolveFindingBtn.dataset.rule;
      update((s) => {
        resolveLooseEnd(s, cid, rule);
      });
      toast('Follow-up outcome recorded and requirement fulfilled.', 'success');
      renderApp();
      return;
    }

    const verifyEvidenceBtn = e.target.closest('[data-action="case-verify-evidence"]');
    if (verifyEvidenceBtn) {
      const cid = verifyEvidenceBtn.dataset.case;
      const eid = verifyEvidenceBtn.dataset.evidence;
      update((s) => {
        const res = verifyCaseEvidence(s, cid, eid, 'verify', actorName(s));
        if (res.success) {
          toast('Evidence record verified successfully.', 'success');
        } else {
          toast(res.error || 'Failed to verify evidence.', 'error');
        }
      });
      renderApp();
      return;
    }

    const rejectEvidenceBtn = e.target.closest('[data-action="case-reject-evidence"]');
    if (rejectEvidenceBtn) {
      const cid = rejectEvidenceBtn.dataset.case;
      const eid = rejectEvidenceBtn.dataset.evidence;
      const reason = window.prompt('Enter rejection reason for audit register (minimum 4 characters):');
      if (reason != null) {
        if (reason.trim().length < 4) {
          toast('Rejection reason must be at least 4 characters.', 'error');
        } else {
          update((s) => {
            const res = verifyCaseEvidence(s, cid, eid, 'reject', actorName(s), reason.trim());
            if (res.success) {
              toast('Evidence record rejected and audit logged.', 'info');
            } else {
              toast(res.error || 'Failed to reject evidence.', 'error');
            }
          });
          renderApp();
        }
      }
      return;
    }

    const previewEvidenceBtn = e.target.closest('[data-action="case-preview-evidence"]');
    if (previewEvidenceBtn) {
      toast('Opening simulated evidence preview for demo purposes.', 'info');
      return;
    }

    // 14. Evidence-Linked Explanations & Communication Hub events
    const caseExplainBtn = e.target.closest('[data-action="case-explain-finding"]');
    if (caseExplainBtn) {
      const cid = caseExplainBtn.dataset.case;
      const rule = caseExplainBtn.dataset.rule;
      caseView.selectedCaseId = cid;
      caseView.journeyTab = 'loose_ends';
      caseView.activeExplanationRuleId = rule;
      caseView.highlightedSourceId = null;
      renderApp();
      return;
    }

    const caseViewExpBtn = e.target.closest('[data-action="case-view-explanation"]');
    if (caseViewExpBtn) {
      caseView.activeExplanationRuleId = caseViewExpBtn.dataset.rule;
      caseView.highlightedSourceId = null;
      renderApp();
      return;
    }

    if (e.target.closest('[data-action="case-exit-explanation"]')) {
      caseView.activeExplanationRuleId = null;
      caseView.highlightedSourceId = null;
      renderApp();
      return;
    }

    const radarFilterBtn = e.target.closest('[data-action="case-radar-filter"]');
    if (radarFilterBtn) {
      caseView.radarFilter = radarFilterBtn.dataset.filter;
      renderApp();
      return;
    }

    const jumpSourceBtn = e.target.closest('[data-action="case-jump-source"]');
    if (jumpSourceBtn) {
      const targetType = jumpSourceBtn.dataset.type;
      const sourceId = jumpSourceBtn.dataset.sourceId;
      caseView.highlightedSourceId = sourceId;
      if (targetType === 'timeline') {
        caseView.journeyTab = 'timeline';
      } else if (targetType === 'blocker') {
        caseView.journeyTab = 'blockers';
      } else {
        caseView.journeyTab = 'readiness';
      }
      renderApp();
      return;
    }

    if (e.target.closest('[data-action="case-return-explanation"]')) {
      caseView.journeyTab = 'loose_ends';
      caseView.highlightedSourceId = null;
      renderApp();
      return;
    }

    const resolveBlockerBtn = e.target.closest('[data-action="case-resolve-blocker"]');
    if (resolveBlockerBtn) {
      const cid = resolveBlockerBtn.dataset.case;
      const bid = resolveBlockerBtn.dataset.blocker;
      update((s) => {
        resolveCaseBlocker(s, cid, bid);
      });
      toast('Blocker marked as resolved. Primary case status updated.', 'success');
      renderApp();
      return;
    }

    const commFilterBtn = e.target.closest('[data-action="comm-filter-channel"]');
    if (commFilterBtn) {
      caseView.commChannelFilter = commFilterBtn.dataset.channel;
      renderApp();
      return;
    }

    if (e.target.closest('[data-action="comm-toggle-log-form"]')) {
      const formContainer = document.getElementById('comm-log-form-container');
      if (formContainer) {
        formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
      }
      return;
    }

    const commAckBtn = e.target.closest('[data-action="comm-ack"]');
    if (commAckBtn) {
      const mid = commAckBtn.dataset.id;
      update((s) => acknowledgeCommunication(s, mid));
      toast('Communication acknowledgement status updated.', 'info');
      renderApp();
      return;
    }

    const commGenBtn = e.target.closest('[data-action="comm-generate-reply"]');
    if (commGenBtn) {
      const cid = commGenBtn.dataset.case;
      const draft = generateDraftReply(getState(), cid);
      const box = document.getElementById('comm-draft-reply-box');
      if (box) box.value = draft;
      toast('Contextual response draft generated.', 'info');
      return;
    }

    if (e.target.closest('[data-action="comm-copy-reply"]')) {
      const box = document.getElementById('comm-draft-reply-box');
      if (box && box.value) {
        navigator.clipboard?.writeText(box.value);
        const copyBtn = document.getElementById('btn-copy-draft-reply');
        if (copyBtn) {
          const orig = copyBtn.innerHTML;
          copyBtn.innerHTML = '✓ Copied!';
          setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
        }
        toast('Draft reply copied to clipboard.', 'success');
      }
      return;
    }

    if (e.target.closest('[data-action="comm-load-sample-1"]')) {
      const inp = document.getElementById('comm-msg-to-task-input');
      if (inp) {
        inp.value = 'Hi Officer Aisyah, Eng Seng Plumbing here regarding Blk 211 seepage. We need joint access to #06-12 tomorrow at 14:00 to verify floor trap seal before quote approval.';
      }
      return;
    }

    if (e.target.closest('[data-action="comm-load-sample-2"]')) {
      const inp = document.getElementById('comm-msg-to-task-input');
      if (inp) {
        inp.value = 'Hello Town Council, Mdm Tan here from Blk 211 #05-12. Ceiling leak is getting worse after today rain. Please call me back with an update on when contractor can start.';
      }
      return;
    }

    const commParseBtn = e.target.closest('[data-action="comm-parse-task"]');
    if (commParseBtn) {
      const cid = commParseBtn.dataset.case;
      const inp = document.getElementById('comm-msg-to-task-input');
      const draft = extractTaskDraftFromMessage(inp ? inp.value : '', cid);
      caseView.extractedTaskDraft = draft;
      renderApp();
      toast('Parsed actionable task draft from message. Review and confirm below.', 'info');
      return;
    }

    if (e.target.closest('[data-action="comm-confirm-task"]')) {
      const draft = caseView.extractedTaskDraft;
      if (draft) {
        update((s) => {
          const newTask = {
            id: `t-comm-${Date.now()}`,
            ownerId: s.currentOfficerId || 'o1',
            title: draft.title,
            category: draft.category,
            priority: draft.priority,
            due: draft.due,
            status: 'todo',
            caseId: draft.caseId,
            tags: ['Case-Linked', 'Communication-Draft'],
          };
          s.tasks.push(newTask);
          const c = getCase(s, draft.caseId);
          if (c) {
            c.taskIds ||= [];
            c.taskIds.push(newTask.id);
            c.timeline ||= [];
            c.timeline.push({
              id: `ev-${Date.now()}`,
              at: TODAY,
              type: 'task_created',
              title: `Task created: ${newTask.title}`,
              summary: `Created in Smart Planner from communication draft (${draft.category}).`,
              source: 'Communication Hub',
              actor: actorName(s),
            });
          }
          logActivity(s, `Created task "${newTask.title}" from communication draft for Case ${c?.caseNumber || draft.caseId}.`, actorName(s));
        });
        caseView.extractedTaskDraft = null;
        toast('Task confirmed and saved to Smart Planner!', 'success');
        renderApp();
      }
      return;
    }

    const quickRoleBtn = e.target.closest('[data-action="quick-switch-role"]');
    if (quickRoleBtn) {
      switchDemoRole(quickRoleBtn.dataset.role);
      return;
    }
  });

  // Role select dropdown change
  document.getElementById('quick-role-select')?.addEventListener('change', (e) => {
    const roleKey = e.target.value;
    switchDemoRole(roleKey);
  });

  document.addEventListener('toggle', (event) => {
    if (event.target.id === 'schedule-issue-panel' && event.target.isConnected) planningIssueView.open = event.target.open;
    if (event.target.id === 'todo-preview' && event.target.isConnected) tasksView.toDoOpen = event.target.open;
  }, true);

  // Filter changes
  document.addEventListener('change', (e) => {
    if (e.target.id === 'evidence-file-input') {
      const file = e.target.files && e.target.files[0];
      const display = document.getElementById('evidence-filename-display');
      if (file && display) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        display.textContent = `✓ Selected: ${file.name} (${sizeMb} MB)`;
        display.style.color = 'var(--colorPaletteGreenForeground1)';
        const titleInput = document.getElementById('evidence-title-input');
        if (titleInput && !titleInput.value.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_\-+]+/g, ' ').trim();
          titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        }
      }
      return;
    }

    if (e.target.dataset.action === 'admin-change-role') {
      const userId = e.target.dataset.id;
      const newRole = e.target.value;
      update((s) => {
        setUserRole(s, userId, newRole);
      });
      toast(`Role changed to ${newRole}.`, 'success');
      renderApp();
    }

    const filter = {
      'tasks-filter-category': 'category',
      'tasks-filter-tag': 'tag',
      'tasks-filter-owner': 'owner',
      'tasks-filter-priority': 'priority',
      'tasks-filter-date': 'dueDate',
    }[e.target.dataset.action];
    if (filter) {
      const action = e.target.dataset.action;
      tasksView[filter] = e.target.value;
      tasksView.page = 1;
      renderApp();
      document.querySelector(`[data-action="${action}"]`)?.focus();
    }

    if (e.target.dataset.action === 'capture-status') {
      const { id } = e.target.dataset;
      const task = accessibleTask(getState(), id);
      if (task) {
        const status = e.target.value;
        update((s) => changeTaskStatus(s, id, status));
        toast('Task status updated.', 'success');
      }
    }

    if (e.target.dataset.action === 'todo-select-list') {
      tasksView.selectedToDoList = e.target.value;
      tasksView.toDoOpen = true;
      renderApp();
      document.getElementById('todo-list-select')?.focus();
    }

    if (e.target.dataset.action === 'plan-date') {
      if (singaporeInstant(e.target.value + 'T00:00')) planningView.date = e.target.value;
      planningIssueView.allDates = false;
      renderApp();
      document.querySelector('[data-action="plan-date"]')?.focus();
    }
    if (e.target.dataset.action === 'plan-officer') {
      planningView.officerId = e.target.value;
      planningIssueView.allDates = false;
      renderApp();
      document.querySelector('[data-action="plan-officer"]')?.focus();
    }

    if (e.target.dataset.action === 'settings-change-theme') {
      const val = e.target.value;
      saveDisplaySetting('theme', val);
      toast(`Appearance set to ${val}.`, 'info');
      renderApp();
      document.querySelector('[name="appearance"]:checked')?.focus();
    }

    if (e.target.dataset.action === 'settings-change-text') {
      const val = e.target.value;
      saveDisplaySetting('text-size', val);
      toast(`Text size set to ${val}.`, 'info');
      renderApp();
      document.querySelector('[name="textSize"]:checked')?.focus();
    }

    if (e.target.dataset.action === 'case-filter-estate') {
      caseView.estateFilter = e.target.value;
      renderApp();
    }

    if (e.target.dataset.action === 'case-filter-urgency') {
      caseView.urgencyFilter = e.target.value;
      renderApp();
    }
  });

  // Search input events
  document.addEventListener('input', (e) => {
    if (e.target.dataset.action === 'tasks-search') {
      const { value, selectionStart, selectionEnd } = e.target;
      tasksView.q = value;
      tasksView.page = 1;
      renderApp();
      const search = document.querySelector('[data-action="tasks-search"]');
      search?.focus();
      search?.setSelectionRange(selectionStart, selectionEnd);
    }
    if (e.target.dataset.action === 'people-search') {
      const pv = peoplePage.peopleView || peoplePage.view || {};
      pv.q = e.target.value;
      pv.page = 1;
      renderApp();
    }
    if (e.target.dataset.action === 'case-search') {
      caseView.searchQuery = e.target.value;
      renderApp();
    }
  });

  // Assistant and form submit events
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'manager-governance-decision-form') {
      e.preventDefault();
      const form = e.target;
      const s = getState();
      const approval = getApprovals(s).find((item) => item.id === form.dataset.id && isManagerReviewApproval(item));
      const decision = e.submitter?.dataset.decision;
      const note = form.elements.namedItem('decisionComment')?.value?.trim() || '';
      if (!isManager(s) || getCurrentUser(s).status !== 'active' || !approval) {
        toast('This request cannot be decided by the current user.', 'error');
        return;
      }
      if (!['approved', 'rejected'].includes(decision) || note.length < 4) {
        toast('Enter a decision comment or rejection reason of at least 4 characters.', 'error');
        return;
      }
      let result;
      update((state) => {
        result = decideApproval(state, approval.id, decision, actorName(state), note);
      });
      if (!result?.success) {
        toast(result?.error || 'Could not record this decision.', 'error');
        return;
      }
      closeModal();
      toast(decision === 'approved' ? 'Approval recorded.' : 'Request rejected and requester notified.', decision === 'approved' ? 'success' : 'info');
      renderApp();
      return;
    }

    if (e.target.id === 'operational-change-approval-form') {
      e.preventDefault();
      const form = e.target;
      const value = (name) => form.elements.namedItem(name)?.value?.trim() || '';
      const file = form.elements.namedItem('evidenceFile')?.files?.[0];
      if (file && file.size > 5 * 1024 * 1024) {
        toast('File size exceeds the 5MB demo limit.', 'error');
        return;
      }
      const selectedEvidence = [...form.querySelectorAll('[name="evidenceIds"]:checked')].map((input) => {
        const evidence = getCaseEvidence(getState(), form.dataset.case).find((item) => item.id === input.value);
        return evidence ? { id: evidence.id, title: evidence.title, fileName: evidence.fileName, type: evidence.type } : null;
      }).filter(Boolean);
      const supportingEvidence = [...selectedEvidence];
      if (file) supportingEvidence.push({ fileName: file.name, fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`, type: file.type || 'file', referenceOnly: true });
      if (value('evidenceReference')) supportingEvidence.push({ reference: value('evidenceReference'), type: 'reference' });

      let result;
      const details = {
        unexpectedSituation: value('unexpectedSituation'),
        reason: value('reason'),
        proposedChanges: value('proposedChanges'),
        requestedScope: value('requestedScope'),
        potentialCostImpact: value('potentialCostImpact'),
        potentialScheduleImpact: value('potentialScheduleImpact'),
        potentialOperationalImpact: value('potentialOperationalImpact'),
        supportingEvidence,
      };
      update((s) => { result = submitOperationalChangeApproval(s, form.dataset.task, details); });
      if (!result?.success) {
        toast(result?.error || 'Please complete the required request details.', 'error');
        return;
      }
      closeModal();
      toast(`Approval request ${result.approval.id} submitted. The task was not changed.`, 'success');
      renderApp();
      return;
    }

    if (e.target.id === 'comm-manual-log-form') {
      e.preventDefault();
      const form = e.target;
      const channel = form.channel.value;
      const category = form.category.value;
      const content = form.content.value;
      const cid = caseView.selectedCaseId;

      const trimmed = (content || '').trim();
      if (trimmed.length < 4) {
        toast('Please provide valid communication notes (at least 4 characters).', 'error');
        return;
      }

      update((s) => {
        addCommunication(s, {
          caseId: cid,
          channel,
          direction: 'outbound',
          sender: `${actorName(s)} (Property Officer)`,
          recipient: 'Resident / Contractor',
          category,
          content: trimmed,
          sourceLabel: 'Manually recorded',
        });
        logActivity(s, `Logged manual ${channel} communication for Case ${cid}: ${category}`, actorName(s));
      });

      toast('Simulated communication record saved.', 'success');
      renderApp();
      return;
    }

    if (e.target.id === 'case-add-note-form') {
      e.preventDefault();
      const form = e.target;
      const cid = form.dataset.case || caseView.selectedCaseId;
      const category = form.noteCategory?.value || 'Inspection Update';
      const content = form.noteContent?.value || '';

      const trimmed = (content || '').trim();
      if (trimmed.length < 4) {
        toast('Please enter a valid note content (at least 4 characters).', 'error');
        return;
      }

      update((s) => {
        addCaseProgressNote(s, cid, category, trimmed);
      });

      toast('Progress note recorded and added to timeline.', 'success');
      renderApp();
      return;
    }

    if (e.target.id === 'case-evidence-upload-form') {
      e.preventDefault();
      const form = e.target;
      const cid = form.dataset.case || caseView.selectedCaseId;
      const title = document.getElementById('evidence-title-input')?.value?.trim();
      const type = document.getElementById('evidence-type-select')?.value || 'document';
      const fileInput = document.getElementById('evidence-file-input');
      const reqCheckbox = document.getElementById('evidence-required-checkbox');
      const desc = document.getElementById('evidence-desc-input')?.value?.trim() || '';

      if (!title || title.length < 3) {
        toast('Evidence title must be at least 3 characters.', 'error');
        return;
      }

      let fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`;
      let fileSize = '1.2 MB';

      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
          toast('File size exceeds the 5MB demo limit. Please select a smaller file.', 'error');
          return;
        }
        fileName = file.name;
        fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      }

      update((s) => {
        addCaseEvidence(s, cid, {
          title,
          fileName,
          type,
          fileSize,
          description: desc,
          requiredForClosure: reqCheckbox ? reqCheckbox.checked : false,
          isLocalUpload: true,
        });
      });

      toast(`Evidence "${title}" attached and queued for manager review.`, 'success');
      renderApp();
      return;
    }

    if (e.target.dataset.action === 'assistant-submit') {
      e.preventDefault();
      const input = document.getElementById('assistant-input-box');
      if (input && input.value.trim()) {
        const text = input.value.trim();
        input.value = '';
        assistantPage.ask(getState(), text, () => renderApp());
      }
    }
  });

  // Global Keyboard Navigation & Focus Trap (Escape and Tab)
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    // Rows and Kanban cards expose keyboard-equivalent click behavior.
    if ((e.key === 'Enter' || e.key === ' ') && !caseView.selectedCaseId) {
      const caseSurface = e.target.closest('[data-action="case-row-click"], [data-action="case-card-surface"]');
      if (caseSurface && !e.target.closest('button, a, input, select, textarea')) {
        e.preventDefault();
        const cid = caseSurface.dataset.caseId || caseSurface.dataset.case;
        if (cid) {
          lastFocusedTrigger = caseSurface;
          caseView.selectedCaseId = cid;
          caseView.journeyTab = 'timeline';
          renderApp();
          setTimeout(() => document.querySelector('.drawer-close-btn')?.focus(), 50);
          return;
        }
      }
    }

    // Evidence dropzone keyboard trigger
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('#evidence-dropzone')) {
      e.preventDefault();
      document.getElementById('evidence-file-input')?.click();
      return;
    }

    // Escape key handling
    if (e.key === 'Escape') {
      // 1. Mobile navigation drawer
      const mobileNav = document.getElementById('portal-nav');
      if (mobileNav?.classList.contains('is-open')) {
        mobileNav.classList.remove('is-open');
        document.getElementById('mobile-nav-backdrop')?.setAttribute('hidden', '');
        document.getElementById('btn-mobile-nav-toggle')?.setAttribute('aria-expanded', 'false');
        return;
      }

      // 2. Case Journey drawer
      if (caseView.selectedCaseId) {
        closeCaseDrawer();
        return;
      }

      // 3. Generic modals
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot && !modalRoot.hasAttribute('hidden')) {
        closeModal();
        return;
      }

      // 4. Notifications popover
      const notifPopover = document.getElementById('notification-popover');
      if (notifPopover && !notifPopover.hasAttribute('hidden')) {
        notifPopover.setAttribute('hidden', '');
        document.getElementById('btn-notification-trigger')?.setAttribute('aria-expanded', 'false');
        return;
      }

      // 5. Account menu popover
      const accountPopover = document.getElementById('account-popover');
      if (accountPopover && !accountPopover.hasAttribute('hidden')) {
        accountPopover.setAttribute('hidden', '');
        document.getElementById('account-trigger')?.setAttribute('aria-expanded', 'false');
        return;
      }
    }

    // Tab key focus trap inside active drawer
    if (e.key === 'Tab' && caseView.selectedCaseId) {
      const drawer = document.querySelector('.drawer-panel');
      if (drawer) {
        const focusable = drawer.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
  });

  // Hash change
  window.addEventListener('hashchange', () => {
    readPortalRoute(getState());
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderApp();
  });
}

function saveDisplaySetting(key, value) {
  if (value === 'system' || value === 'standard') document.documentElement.removeAttribute(`data-${key}`);
  else document.documentElement.setAttribute(`data-${key}`, value);
  try {
    localStorage.setItem(`syncai_${key.replace('-', '_')}`, value);
  } catch {
    // Apply the selected display setting for the current session.
  }
}

function switchDemoRole(roleKey) {
  const s = getState();
  setCurrentUser(s, roleKey);
  sessionStorage.setItem('syncai_demo_role', s.role);
  sessionStorage.setItem('syncai_demo_status', s.status);
  toast(`Switched persona to ${s.role.toUpperCase()} (${s.status}).`, 'info');
  renderApp();
}

function showAccountSwitchModal() {
  const content = html`
    <h2 class="modal-title">Switch Demo Persona</h2>
    <p class="muted small">Select a fictional Town Council persona to inspect their role-based experience:</p>
    <div style="display: grid; gap: 10px; margin: 16px 0;">
      <button type="button" class="btn-secondary" style="justify-content: flex-start; text-align: left; padding: 12px 14px;" data-action="pick-role-modal" data-role="member">
        <div>
          <strong>Aisyah Rahman (Team Member)</strong>
          <span class="small muted" style="display: block;">Property Officer (Zone A). Personal daily plan, tasks, simulated To Do & Calendar.</span>
        </div>
      </button>
      <button type="button" class="btn-secondary" style="justify-content: flex-start; text-align: left; padding: 12px 14px;" data-action="pick-role-modal" data-role="manager">
        <div>
          <strong>Jennifer Ong (Manager)</strong>
          <span class="small muted" style="display: block;">Estate Manager. Team capacity, manager approval queue, What-If Simulator commit.</span>
        </div>
      </button>
      <button type="button" class="btn-secondary" style="justify-content: flex-start; text-align: left; padding: 12px 14px;" data-action="pick-role-modal" data-role="admin">
        <div>
          <strong>TAN, ALEX (Admin)</strong>
          <span class="small muted" style="display: block;">Town Council Administrator. User directory, pending account approval, team setup.</span>
        </div>
      </button>
      <button type="button" class="btn-secondary" style="justify-content: flex-start; text-align: left; padding: 12px 14px;" data-action="pick-role-modal" data-role="pending">
        <div>
          <strong>David Koh (Pending Account)</strong>
          <span class="small muted" style="display: block;">Reviewer Demo: Awaiting administrator approval banner and locked tools.</span>
        </div>
      </button>
      <button type="button" class="btn-secondary" style="justify-content: flex-start; text-align: left; padding: 12px 14px;" data-action="pick-role-modal" data-role="disabled">
        <div>
          <strong>Siti Nurhaliza (Disabled Account)</strong>
          <span class="small muted" style="display: block;">Reviewer Demo: Deactivated account access restriction.</span>
        </div>
      </button>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" data-action="modal-close">Cancel</button>
    </div>
  `;
  openModal(content);

  document.getElementById('modal-root')?.addEventListener('click', (e) => {
    const pickBtn = e.target.closest('[data-action="pick-role-modal"]');
    if (pickBtn) {
      const r = pickBtn.dataset.role;
      closeModal();
      switchDemoRole(r);
    }
  }, { once: true });
}

function openScheduleChangeRequest(issue) {
  const commitment = [issue.block, issue.other].filter(Boolean)
    .map((block) => `${block.title} · ${blockTimes(block)} SGT`).join(' / ');
  openModal(html`<h2 class="modal-title">Request Schedule Change</h2>
    <p><strong>${issue.title}</strong></p>
    <p class="small muted">${commitment || 'No task block was scheduled.'}</p>
    <p class="small">${issue.message}</p>
    <form id="schedule-change-request" class="capture-form">
      <label class="capture-wide">Reason for requesting a change
        <textarea name="reason" required maxlength="500" rows="3" autofocus></textarea>
      </label>
      <p class="capture-wide capture-error" role="alert" hidden></p>
      <div class="modal-actions capture-wide">
        <button type="button" class="btn-secondary" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn-primary">Submit for review</button>
      </div>
    </form>`);
  const form = document.getElementById('schedule-change-request');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      planningIssueView.open = true;
      update((state) => requestScheduleChange(state, issue, form.elements.reason.value));
      closeModal();
      document.querySelector('#schedule-issue-panel summary')?.focus();
      toast(storage.ok ? 'Simulated request submitted. Pending Approval.' : 'Pending Approval for this session. Browser storage is unavailable.', storage.ok ? 'success' : 'error');
    } catch (error) {
      const alert = form.querySelector('[role="alert"]');
      alert.textContent = error.message;
      alert.hidden = false;
    }
  });
}

async function resolveScheduleDraft(draft, accept) {
  const range = scheduleRange(draft.dates);
  const review = reviewDraft(getState(), draft);
  const issues = accept && (review.warningCount > 0 || review.unscheduledCount > 0);
  const scheduled = draft.days.reduce((count, day) => count + day.proposed.length, 0);
  const risks = draft.unscheduled.filter(({ deadline }) => deadline.at).length
    + draft.days.reduce((count, day) => count + (day.warningDetails || []).filter(({ kind }) => kind === 'Deadline risk').length, 0);
  const count = (n, label) => `${n} ${label}${n === 1 ? '' : 's'}`;
  const details = [
    review.replaced.length ? `Replaces ${count(review.replaced.length, 'accepted day')}.` : '',
    issues ? 'Warnings and unscheduled work remain available for review.' : '',
  ].filter(Boolean).join(' ');
  const confirmed = await confirmDialog({
    title: accept ? 'Accept schedule?' : 'Discard draft?',
    body: accept ? `${range}. ${count(scheduled, 'scheduled task')} · ${review.unscheduledCount} unscheduled · ${count(review.warningCount, 'calendar warning')} · ${count(risks, 'potential deadline risk')}. ${details}`
      : `${range}. Return to the accepted schedule or protected calendar for these dates.`,
    confirmLabel: accept ? 'Accept Schedule' : 'Discard Draft',
    danger: !accept,
    acknowledgement: issues ? 'I understand that some tasks remain unscheduled or require further review.' : undefined,
  });
  if (!confirmed || planningView.drafts.get(draft.officerId) !== draft || currentPlanningOfficer(getState())?.id !== draft.officerId) return;
  if (accept) {
    try {
      update((state) => {
        const latest = reviewDraft(state, draft);
        if (!issues && (latest.warningCount || latest.unscheduledCount)) throw new Error('Review the outstanding warnings before accepting.');
        acceptDraft(state, draft, { acknowledged: Boolean(issues || review.replaced.length) });
        discardDraft(planningView.drafts, draft, true);
      });
      toast(storage.ok ? 'Schedule accepted and saved.' : 'Schedule accepted for this session. Browser storage could not save it.',
        storage.ok ? 'success' : 'error');
    } catch (error) {
      renderApp();
      toast(error.message, 'error');
    }
  } else {
    discardDraft(planningView.drafts, draft, true);
    renderApp();
    toast('Draft discarded.', 'info');
  }
  document.getElementById('smart-plan-h')?.focus();
}

function showTaskDetailModal(s, t) {
  const dependents = traceDownstream(s, t.id).dependents.filter(({ task }) => accessibleTask(s, task.id));
  const mgr = isManager(s);
  const relatedCase = accessibleCase(s, t.caseId);
  const factors = priorityFactors(t);
  const deadline = deadlineAlert(t);
  const slaDue = taskDateInput(t.slaDue);

  const due = taskDateInput(t.dueAt || t.due);
  const fixedStart = taskDateInput(t.fixedStartAt);
  const renderTime = (value) => html`<time datetime="${value}+08:00">${value.replace('T', ' ')} SGT</time>`;
  const priorityTone = { Critical: 'danger', High: 'warning', Medium: 'brand' }[t.priority] || 'neutral';

  openModal(html`
    <div class="task-details">
      <header class="task-details-header">
        <div>
          <h2 id="modal-title" class="modal-title">${t.title}</h2>
          <p class="small muted">${t.location ? `${t.location} · ` : ''}Assigned to ${officerName(s, t.ownerId)}</p>
        </div>
        <button type="button" class="btn-subtle task-details-close" data-action="modal-close" aria-label="Close task details">${icon('close', 20)}</button>
      </header>
      <div class="task-details-body">
        <div class="task-details-badges">
          <span class="tag tag-${priorityTone}">${t.priority} Priority</span>
          ${t.safety ? html`<span class="tag tag-danger">Safety</span>` : ''}
          <span class="tag tag-brand">${t.category}</span>
        </div>
        ${t.description ? html`<p class="capture-text task-details-description">${t.description}</p>` : ''}
        <dl class="task-details-facts" aria-label="Key information">
          <div><dt>Due date</dt><dd>${due ? renderTime(due) : 'No due date recorded'}
            ${deadline ? html`<span class="work-order-deadline-note ${deadline.tone}">${deadline.label}</span>` : ''}
          </dd></div>
          <div><dt>Estimated duration</dt><dd>${taskDuration(t)} minutes</dd></div>
          ${t.appointmentTime ? html`<div><dt>Resident commitment</dt><dd>${t.appointmentTime}</dd></div>` : ''}
          ${slaDue || t.slaType ? html`<div><dt>SLA information</dt><dd>${t.slaType || 'Recorded deadline'}
            ${slaDue ? html`<span class="task-details-note">${slaDue === due ? 'Same as the due date' : renderTime(slaDue)}</span>` : ''}
          </dd></div>` : ''}
        </dl>
        <details class="priority-explanation" open>
          <summary>Why this priority?</summary>
          <p class="small muted">Priority is set on the task. These demo factors show the recorded context in EMS’s stated order.</p>
          <ol>${factors.map(({ factor, reason }) => html`<li><strong>${factor}</strong> ${reason}</li>`)}</ol>
        </details>
        <details class="task-details-extra">
          <summary>Additional details &amp; dependencies</summary>
          <dl class="task-details-extra-list">
            ${t.caseId ? html`<div><dt>Linked case</dt><dd>
              ${relatedCase ? html`<a href="#cases/${relatedCase.id}" data-action="modal-close">${relatedCase.number || relatedCase.id} · ${relatedCase.title}</a>` : ''}
              <button type="button" class="btn-subtle btn-sm" data-action="nav-to-case" data-case="${t.caseId}">Open in Case Action Centre</button>
            </dd></div>` : ''}
            ${t.tags?.length ? html`<div><dt>Tags</dt><dd class="task-details-badges">${t.tags.map((tag) => html`<span class="tag tag-neutral">${tag}</span>`)}</dd></div>` : ''}
            ${t.statutory ? html`<div><dt>Deadline type</dt><dd>Statutory deadline</dd></div>` : ''}
            ${fixedStart ? html`<div><dt>Fixed start</dt><dd>${renderTime(fixedStart)}</dd></div>` : ''}
            ${t.remarks ? html`<div><dt>Remarks</dt><dd class="capture-text">${t.remarks}</dd></div>` : ''}
            ${t.consequence ? html`<div><dt>Long-term consequence risk</dt><dd>${t.consequence}</dd></div>` : ''}
            <div><dt>Downstream dependencies</dt><dd>
              ${dependents.length ? html`<ul>${dependents.map(({ task, depth }) => html`<li>${task.title} <span class="muted">(Depth: ${depth})</span></li>`)}</ul>`
                : 'No visible work orders depend on this task.'}
            </dd></div>
          </dl>
        </details>
        ${getApprovals(s).filter((approval) => approval.taskId === t.id).length ? html`
          <section class="task-details-extra" aria-label="Approval requests for this task">
            <h3>Approval requests for this task</h3>
            ${getApprovals(s).filter((approval) => approval.taskId === t.id).map((approval) => html`
              <div style="margin-top: 6px; padding: 10px; border-radius: 8px; background: var(--colorNeutralBackground2);">
                <span class="tag ${approval.status === 'pending' ? 'tag-warning' : approval.status === 'approved' ? 'tag-success' : 'tag-danger'}">${approval.status.replaceAll('_', ' ')}</span>
                <span class="small">${approval.id} · ${approval.requestType.replaceAll('_', ' ')}</span>
                ${approval.decision ? html`<div class="small" style="margin-top: 5px;"><strong>Manager decision:</strong> ${approval.decision}</div>` : ''}
              </div>
            `)}
          </section>` : ''}
      </div>
      <footer class="task-details-footer">
        <button type="button" class="btn-ghost btn-sm" data-action="modal-close">Close</button>
        <button type="button" class="${!t.manualCapture && !mgr ? 'btn-secondary' : 'btn-primary'} btn-sm" data-action="capture-edit" data-id="${t.id}">Edit Task</button>
        ${!t.manualCapture && !mgr ? html`
          <button type="button" class="btn-primary btn-sm" data-action="request-task-adjustment" data-id="${t.id}">Request Schedule Change</button>` : ''}
      </footer>
    </div>
  `, { wide: true, variant: 'task-details-modal' });

  document.querySelector('#modal-root [data-action="request-task-adjustment"]')?.addEventListener('click', () => {
    update((stateObj) => {
      createApprovalRequest(stateObj, {
        requestType: 'schedule_adjustment',
        taskId: t.id,
        taskTitle: t.title,
        reason: 'Officer requested schedule change due to operational buffer constraint.',
        slaImpact: 'Maintains the fictional response deadline.',
        operationalImpact: 'Prevents overload during site visits.',

      });
    });
    closeModal();
    toast('Schedule change request submitted for manager approval.', 'success');
  });
}

function showManagerApprovalReview(s, approval) {
  const type = managerReviewType(approval);
  const task = approval.taskId ? s.tasks.find((item) => item.id === approval.taskId) : null;
  const relatedCase = approval.caseId ? getCase(s, approval.caseId) : null;
  const missing = 'Not recorded';
  const when = (value) => value ? new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : missing;
  const evidence = Array.isArray(approval.supportingEvidence) ? approval.supportingEvidence : [];
  const currentOwnerId = relatedCase?.ownerId || task?.ownerId || approval.originalOwnerId;
  const proposedOwnerId = approval.proposedOwnerId || approval.suggestedAssigneeId;
  const detail = approval.requestType === 'operational_change' ? html`
    <section class="panel"><h3>Unexpected situation and justification</h3><p><strong>Situation</strong><br>${approval.unexpectedSituation || 'Not provided'}</p><p><strong>Reason</strong><br>${approval.reason || 'Not provided'}</p></section>
    <section class="panel"><h3>Proposed changes and requested scope</h3><p><strong>Original arrangement</strong><br>${approval.originalSchedule || missing}</p><p><strong>Proposed changes</strong><br>${approval.proposedChanges || 'Not provided'}</p><p><strong>Requested scope</strong><br>${approval.requestedScope || 'Not provided'}</p></section>
    <section class="panel"><h3>Potential impact</h3><p>Cost: ${approval.potentialCostImpact || 'Not specified'}</p><p>Schedule: ${approval.potentialScheduleImpact || 'Not specified'}</p><p>Operational or service: ${approval.potentialOperationalImpact || 'Not specified'}</p></section>
    <section class="panel"><h3>Supporting evidence references</h3>${evidence.length ? html`<ul>${evidence.map((item) => html`<li>${item.title || item.fileName || item.reference || 'Evidence reference'}${item.fileName ? ` · ${item.fileName}` : ''}${item.fileSize ? ` · ${item.fileSize}` : ''}${item.reference ? ` · ${item.reference}` : ''}</li>`)}</ul><p class="small muted">The prototype stores evidence references and metadata only; attached file contents are not available here.</p>` : html`<p>No supporting evidence references were attached.</p>`}</section>
  ` : approval.requestType === 'schedule_adjustment' ? html`
    <section class="panel"><h3>Schedule adjustment</h3><p><strong>Original schedule</strong><br>${approval.originalSchedule && approval.originalSchedule !== 'Original schedule' ? approval.originalSchedule : missing}</p><p><strong>Requested schedule</strong><br>${approval.proposedSchedule && approval.proposedSchedule !== 'Proposed schedule' ? approval.proposedSchedule : missing}</p><p><strong>Reason</strong><br>${approval.reason && approval.reason !== 'Operational schedule adjustment' ? approval.reason : missing}</p><p><strong>SLA impact</strong><br>${approval.slaImpact && approval.slaImpact !== 'Within operational SLA margin' ? approval.slaImpact : missing}</p><p><strong>Operational impact</strong><br>${approval.operationalImpact && approval.operationalImpact !== 'Rebalances officer workload' ? approval.operationalImpact : missing}</p></section>
  ` : approval.requestType === 'reassign' || approval.requestType === 'reassignment' ? html`
    <section class="panel"><h3>Case reassignment</h3><p><strong>Current assignee</strong><br>${currentOwnerId ? officerName(s, currentOwnerId) : missing}</p><p><strong>Proposed assignee</strong><br>${proposedOwnerId ? officerName(s, proposedOwnerId) : missing}</p><p><strong>Reason</strong><br>${approval.reason || approval.note || missing}</p></section>
  ` : html`
    <section class="panel"><h3>Case closure</h3><p><strong>Case</strong><br>${relatedCase ? `${relatedCase.id} · ${relatedCase.title || relatedCase.caseNumber || ''}` : approval.caseId || missing}</p><p><strong>Current case status</strong><br>${relatedCase?.status || missing}</p><p><strong>Current assignee</strong><br>${relatedCase?.ownerId ? officerName(s, relatedCase.ownerId) : missing}</p><p><strong>Reason</strong><br>${approval.reason || approval.note || missing}</p><p><strong>SLA impact</strong><br>${approval.slaImpact || missing}</p><p><strong>Operational impact</strong><br>${approval.operationalImpact || missing}</p></section>
  `;
  const content = html`
    <h2 id="modal-title" class="modal-title">${type.label} review</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px"><span class="tag ${approval.status === 'approved' ? 'tag-success' : approval.status === 'rejected' ? 'tag-danger' : 'tag-warning'}">${approval.status}</span><span class="tag tag-neutral">${type.label}</span><span class="tag tag-neutral">${approval.id}</span></div>
    <div style="display:grid;gap:10px;max-height:62vh;overflow-y:auto;padding:2px">
      <section class="panel"><h3>Request and linked work</h3><p><strong>Requester</strong><br>${approval.requesterName || approval.requesterId || missing}</p><p><strong>Submitted</strong><br>${when(approval.createdAt)}</p>${task ? html`<p><strong>Task</strong><br>${task.id} · ${task.title || approval.taskTitle || missing}</p><p><strong>Assigned officer</strong><br>${officerName(s, task.ownerId || approval.originalOwnerId)}</p><p><strong>Current task status</strong><br>${task.status || missing}</p><p><strong>Current task due date</strong><br>${task.dueAt || task.due || missing}</p>` : approval.taskId ? html`<p><strong>Task</strong><br>${approval.taskId} · ${approval.taskTitle || missing}</p>` : ''}${approval.caseId ? html`<p><strong>Linked case</strong><br>${approval.caseId}${relatedCase?.title ? ` · ${relatedCase.title}` : ''}</p>` : ''}</section>
      ${detail}
      ${approval.decision ? html`<section class="panel"><h3>Recorded decision</h3><p><strong>${approval.status === 'approved' ? 'Approved' : 'Rejected'} by</strong> ${approval.decidedBy || missing}</p><p><strong>Decision time</strong><br>${when(approval.decidedAt)}</p><p><strong>Comment or reason</strong><br>${approval.decision}</p></section>` : ''}
    </div>
    ${approval.status === 'pending' ? html`<form id="manager-governance-decision-form" data-id="${approval.id}" style="display:grid;gap:10px;margin-top:12px"><label class="small">Decision comment or rejection reason *<textarea class="search-input" name="decisionComment" required minlength="4" rows="3" style="display:block;width:100%;box-sizing:border-box" placeholder="Explain the decision and any relevant limits."></textarea></label><div class="modal-actions"><button type="button" class="btn-ghost btn-sm" data-action="modal-close">Close</button><button type="submit" class="btn-danger btn-sm" data-decision="rejected">Reject</button><button type="submit" class="btn-primary btn-sm" data-decision="approved">Approve</button></div></form>` : html`<div class="modal-actions"><button type="button" class="btn-ghost btn-sm" data-action="modal-close">Close</button></div>`}
  `;
  openModal(content, { wide: true });
}

function showRequesterApprovalRequestDetails(s, approval) {
  const isOperationalChange = approval.requestType === 'operational_change';
  const requestTypeLabel = isOperationalChange ? 'Operational Change' : 'Schedule Adjustment';
  const originalSchedule = approval.originalSchedule && approval.originalSchedule !== 'Original schedule'
    ? approval.originalSchedule : 'Not recorded';
  const requestedSchedule = approval.proposedSchedule && approval.proposedSchedule !== 'Proposed schedule'
    ? approval.proposedSchedule : 'Not recorded';
  const scheduleReason = approval.reason && approval.reason !== 'Operational schedule adjustment'
    ? approval.reason : 'Not recorded';
  const scheduleSlaImpact = approval.slaImpact && approval.slaImpact !== 'Within operational SLA margin'
    ? approval.slaImpact : 'Not recorded';
  const scheduleOperationalImpact = approval.operationalImpact && approval.operationalImpact !== 'Rebalances officer workload'
    ? approval.operationalImpact : 'Not recorded';
  const content = html`
    <h2 id="modal-title" class="modal-title">Approval request details</h2>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 14px;">
      <span class="tag ${approval.status === 'approved' ? 'tag-success' : approval.status === 'rejected' ? 'tag-danger' : 'tag-warning'}">${approval.status}</span>
      <span class="tag tag-neutral">${requestTypeLabel}</span>
      <span class="tag tag-neutral">${approval.id}</span>
    </div>
    <div style="display: grid; gap: 8px; max-height: 62vh; overflow-y: auto;">
      <div><strong>Task:</strong> ${approval.taskId} · ${approval.taskTitle}</div>
      ${approval.caseId ? html`<div><strong>Linked case:</strong> ${approval.caseId}</div>` : ''}
      <div><strong>Submitted:</strong> ${approval.createdAt ? new Date(approval.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : 'Not recorded'}</div>
      ${isOperationalChange ? html`
        <div><strong>Unexpected situation:</strong><p>${approval.unexpectedSituation || 'Not provided'}</p></div>
        <div><strong>Reason:</strong><p>${approval.reason || 'Not provided'}</p></div>
        <div><strong>Proposed changes:</strong><p>${approval.proposedChanges || 'Not provided'}</p></div>
        <div><strong>Requested scope:</strong><p>${approval.requestedScope || 'Not provided'}</p></div>
        <div><strong>Potential impacts:</strong><ul><li>Cost: ${approval.potentialCostImpact || 'Not specified'}</li><li>Schedule: ${approval.potentialScheduleImpact || 'Not specified'}</li><li>Operational: ${approval.potentialOperationalImpact || 'Not specified'}</li></ul></div>
        ${approval.supportingEvidence?.length ? html`<div><strong>Evidence references:</strong><ul>${approval.supportingEvidence.map((item) => html`<li>${item.title || item.fileName || item.reference || 'Evidence reference'}${item.fileName ? ` · ${item.fileName}` : ''}${item.reference ? ` · ${item.reference}` : ''}</li>`)}</ul></div>` : ''}
      ` : html`
        <div><strong>Original schedule:</strong><p>${originalSchedule}</p></div>
        <div><strong>Requested schedule:</strong><p>${requestedSchedule}</p></div>
        <div><strong>Reason for schedule change:</strong><p>${scheduleReason}</p></div>
        <div><strong>SLA impact:</strong><p>${scheduleSlaImpact}</p></div>
        <div><strong>Operational impact:</strong><p>${scheduleOperationalImpact}</p></div>
      `}
      ${approval.decision ? html`<section class="panel" style="padding: 12px;"><strong>Manager decision · ${approval.decidedBy || 'Manager'}${approval.decidedAt ? ` · ${new Date(approval.decidedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}` : ''}</strong><p>${approval.decision}</p></section>` : ''}
    </div>
    <div class="modal-actions"><button type="button" class="btn-ghost btn-sm" data-action="modal-close">Close</button></div>
  `;
  openModal(content, { wide: true });
}

function showTaskApprovalRequestModal(s, task) {
  const relatedCase = task.caseId ? getCase(s, task.caseId) : null;
  const evidence = relatedCase ? getCaseEvidence(s, relatedCase.id) : [];
  const content = html`
    <h2 id="modal-title" class="modal-title">Request Approval</h2>
    <p class="small muted">Request authorisation for a proposed operational change. Submitting this form does not change or pause the task.</p>
    <div style="display: grid; gap: 5px; margin: 12px 0; padding: 12px; border-radius: 8px; background: var(--colorNeutralBackground2);">
      <div><strong>Task:</strong> ${task.id} · ${task.title}</div>
      ${relatedCase ? html`<div><strong>Case:</strong> ${relatedCase.id} · ${relatedCase.title || relatedCase.caseNumber || relatedCase.number || ''}</div>` : ''}
      <div><strong>Assigned officer:</strong> ${officerName(s, task.ownerId)}</div>
      <div><strong>Original due:</strong> ${taskDateInput(task.dueAt || task.due).replace('T', ' ')}</div>
      ${task.fixedStartAt ? html`<div><strong>Fixed start:</strong> ${taskDateInput(task.fixedStartAt).replace('T', ' ')}</div>` : ''}
      <div><strong>Duration:</strong> ${taskDuration(task)} minutes · <strong>Status:</strong> ${task.status}</div>
    </div>
    <form id="operational-change-approval-form" data-task="${task.id}" data-case="${relatedCase?.id || ''}" style="display: grid; gap: 10px; max-height: 58vh; overflow-y: auto; padding: 2px;">
      <label class="small">Unexpected situation *<textarea class="search-input" name="unexpectedSituation" required minlength="4" rows="2" style="display: block; width: 100%; box-sizing: border-box;" placeholder="What happened during the work?"></textarea></label>
      <label class="small">Reason for request *<textarea class="search-input" name="reason" required minlength="4" rows="2" style="display: block; width: 100%; box-sizing: border-box;" placeholder="Why is a change necessary?"></textarea></label>
      <label class="small">Proposed changes *<textarea class="search-input" name="proposedChanges" required minlength="4" rows="2" style="display: block; width: 100%; box-sizing: border-box;" placeholder="Describe what should change."></textarea></label>
      <label class="small">Requested approval scope *<textarea class="search-input" name="requestedScope" required minlength="4" rows="2" style="display: block; width: 100%; box-sizing: border-box;" placeholder="Specify exactly what the manager should authorise."></textarea></label>
      <label class="small">Potential cost impact<textarea class="search-input" name="potentialCostImpact" rows="1" style="display: block; width: 100%; box-sizing: border-box;" placeholder="Optional"></textarea></label>
      <label class="small">Potential schedule impact<textarea class="search-input" name="potentialScheduleImpact" rows="1" style="display: block; width: 100%; box-sizing: border-box;" placeholder="Optional"></textarea></label>
      <label class="small">Potential operational or service impact<textarea class="search-input" name="potentialOperationalImpact" rows="1" style="display: block; width: 100%; box-sizing: border-box;" placeholder="Optional"></textarea></label>
      <fieldset style="border: 1px solid var(--colorNeutralStroke2); border-radius: 8px; padding: 10px;">
        <legend class="small">Supporting evidence (optional)</legend>
        ${evidence.length ? evidence.map((item) => html`<label class="small" style="display: block; margin: 4px 0;"><input type="checkbox" name="evidenceIds" value="${item.id}"> ${item.title} (${item.fileName || item.typeLabel || 'evidence'})</label>`) : html`<span class="small muted">No linked case evidence is available.</span>`}
        <label class="small" style="display: block; margin-top: 8px;">Attach file reference<input type="file" name="evidenceFile" style="display: block; margin-top: 4px;"></label>
        <label class="small" style="display: block; margin-top: 8px;">Other evidence reference<input class="search-input" name="evidenceReference" style="display: block; width: 100%; box-sizing: border-box;" placeholder="Quotation number, contractor, document link, etc."></label>
        <span class="small muted">Prototype stores selected file metadata only (up to 5 MB); it does not upload file contents.</span>
      </fieldset>
      <div class="modal-actions">
        <button type="submit" class="btn-primary btn-sm">Submit Approval Request</button>
        <button type="button" class="btn-ghost btn-sm" data-action="modal-close">Cancel</button>
      </div>
    </form>
  `;
  openModal(content, { wide: true });
}

function showCreateTeamModal(s) {
  const content = html`
    <h2 class="modal-title">Create Operational Team</h2>
    <form id="create-team-form" style="display: grid; gap: 14px; margin-top: 14px;">
      <div>
        <label for="team-name-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px;">Team Name</label>
        <input
          type="text"
          id="team-name-input"
          class="search-input"
          style="width: 100%; box-sizing: border-box;"
          placeholder="e.g. Zone C Facilities"
          required
        />
      </div>
      <div>
        <label for="team-manager-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px;">Supervising Manager</label>
        <input
          type="text"
          id="team-manager-input"
          class="search-input"
          style="width: 100%; box-sizing: border-box;"
          value="Jennifer Ong"
          readonly
        />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-ghost btn-sm" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn-primary btn-sm">Create Team</button>
      </div>
    </form>
  `;

  openModal(content);

  document.getElementById('create-team-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('team-name-input').value.trim();
    if (!name) return;
    closeModal();
    update((stateObj) => {
      const newTeam = createTeam(stateObj, name, 's1');
      teamsAdminPage.teamsAdminView.expandedIds.add(newTeam.id);
      logActivity(stateObj, `Created team: ${name}`, actorName(stateObj));
    });
    toast(`Team "${name}" created.`, 'success');
    renderApp();
  });
}

function showCaseReassignModal(s, caseId) {
  const c = getCase(s, caseId);
  if (!c) return;

  const currentOwner = officerName(s, c.ownerId);
  const eligibleOfficers = (s.users || [])
    .filter((u) => u.status === 'active' && u.role !== 'admin' && u.id !== c.ownerId);

  const content = html`
    <header class="modal-head case-reassign-modal-head">
      <div>
        <span class="case-number-badge">${c.caseNumber || c.number || c.id}</span>
        <h2 class="modal-title" id="modal-title">Request Case Reassignment</h2>
      </div>
      <button type="button" class="drawer-close-btn" data-action="modal-close" aria-label="Close reassignment dialog" title="Close">
        ${icon('x', 18)}
      </button>
    </header>
    <p class="muted small" style="margin-bottom: 14px;">
      Reassign <strong>${c.caseNumber}</strong> (${c.title}). This will submit a formal handover request to Estate Manager Jennifer Ong.
    </p>

    <form id="case-reassign-form">
      <div style="display: grid; gap: 12px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 4px;">Current Case Officer</label>
          <input type="text" value="${currentOwner}" readonly style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke2); background: var(--colorNeutralBackground2); box-sizing: border-box;" />
        </div>

        <div>
          <label for="reassign-target-officer" style="display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 4px;">Assign To</label>
          <select id="reassign-target-officer" required style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); box-sizing: border-box;">
            <option value="">Select receiving officer...</option>
            ${eligibleOfficers.map(
              (o) => html`<option value="${o.id}">${o.displayName} (${o.role === 'manager' ? 'Estate Manager' : 'Property Officer'})</option>`,
            )}
          </select>
        </div>

        <div>
          <label for="reassign-reason-input" style="display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 4px;">Operational Handover Reason <span aria-hidden="true">*</span></label>
          <textarea id="reassign-reason-input" rows="4" required minlength="4" aria-describedby="reassign-reason-help" placeholder="e.g. Zone boundary re-alignment / site inspection capacity overload..." style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.875rem; box-sizing: border-box;"></textarea>
          <p id="reassign-reason-help" class="small muted" style="margin: 4px 0 0;">Required for the handover audit trail. Enter at least 4 characters.</p>
        </div>

        <div style="padding: 10px 12px; border-radius: 6px; background: var(--colorNeutralBackground2); font-size: 0.75rem; color: var(--colorNeutralForeground3);">
          ${icon('info', 14)} Connected to Approvals & Audit: Estate Manager Jennifer Ong must approve before ownership and task assignments update.
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-ghost btn-sm" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn-primary btn-sm">Submit Request</button>
      </div>
    </form>
  `;

  openModal(content);

  const form = document.getElementById('case-reassign-form');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const targetOfficerId = document.getElementById('reassign-target-officer')?.value;
      const reason = document.getElementById('reassign-reason-input')?.value;

      if (!targetOfficerId) {
        toast('Please select an active officer.', 'error');
        return;
      }

      if (!reason || reason.trim().length < 4) {
        toast('Please enter an operational handover reason (minimum 4 characters).', 'error');
        document.getElementById('reassign-reason-input')?.focus();
        return;
      }

      closeModal();
      update((stateObj) => {
        requestCaseReassignment(stateObj, caseId, targetOfficerId, reason.trim());
      });
      toast(`Reassignment request for ${c.caseNumber} submitted for manager review.`, 'success');
      renderApp();
    });
  }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
