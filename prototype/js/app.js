// Main Application Controller — Static Prototype Rebuild (ES Modules)
import {
  getState,
  loadState,
  resetState,
  update,
  subscribe,
  getCurrentUser,
  setCurrentUser,
  isAdmin,
  isManager,
  isTeamMember,
  getPendingApprovals,
  getUsers,
  getUser,
  approveUser,
  setUserRole,
  setUserStatus,
  createTeam,
  addTeamMember,
  removeTeamMember,
  createApprovalRequest,
  decideApproval,
  isOpen,
  logActivity,
  actorName,
  getCase,
  closeCase,
  requestCaseReassignment,
  officerName,
} from './state.js';
import { html, raw, render, icon, toast, openModal, closeModal, confirmDialog } from './ui.js';
import { accessibleTask, changeTaskStatus, deleteCapturedTask, taskDateInput, taskDuration } from './taskCapture.js';
import { accessibleCase } from './cases.js';
import { deadlineAlert, priorityFactors } from './taskIntelligence.js';
import { traceDownstream } from './ripple.js';
import { calendarDay, singaporeInstant, TODAY } from './time.js';

// Page modules
import overviewPage from './pages/overview.js';
import casesPage, { caseView } from './pages/cases.js';
import tasksPage, { tasksView } from './pages/tasks.js';
import { openTaskCapture } from './pages/taskCaptureDialog.js';
import planPage, { planView } from './pages/plan.js';
import { currentPlanningOfficer, planningDates, planningView } from './pages/smartPlan.js';
import { openSchedulePreferences } from './pages/schedulePreferencesDialog.js';
import teamPage from './pages/team.js';
import peoplePage from './pages/people.js';
import teamsAdminPage from './pages/teams-admin.js';
import activityPage from './pages/activity.js';
import decidesPage from './pages/decides.js';
import settingsPage from './pages/settings.js';
import assistantPage from './pages/assistant.js';

// Navigation section registry
const SECTIONS = {
  overview: { id: 'overview', label: 'Overview', icon: 'grid', page: overviewPage },
  assistant: { id: 'assistant', label: 'Ask SyncAI', icon: 'sparkle', page: assistantPage },
  tasks: { id: 'tasks', label: 'My tasks', icon: 'tasks', page: tasksPage },
  cases: { id: 'cases', label: 'Case Action Centre', icon: 'cases', page: casesPage },
  plan: { id: 'plan', label: 'My plan', icon: 'calendar', page: planPage },
  team: { id: 'team', label: 'My team', icon: 'team', page: teamPage },
  people: { id: 'people', label: 'People', icon: 'users', page: peoplePage },
  teams: { id: 'teams', label: 'Teams', icon: 'team', page: teamsAdminPage },
  activity: { id: 'activity', label: 'Activity', icon: 'history', page: activityPage },
  decides: { id: 'decides', label: 'How SyncAI decides', icon: 'sparkle', page: decidesPage },
  settings: { id: 'settings', label: 'Settings', icon: 'settings', page: settingsPage },
};

let currentSection = 'overview';
let currentCaseId = null;

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
    return ['overview', 'assistant', 'tasks', 'cases', 'plan', 'team', 'decides', 'settings'];
  }
  // Member
  return ['overview', 'assistant', 'tasks', 'cases', 'plan', 'decides', 'settings'];
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
  const theme = localStorage.getItem('syncai_theme') || 'system';
  const textSize = localStorage.getItem('syncai_text_size') || 'standard';
  if (theme !== 'system') document.documentElement.setAttribute('data-theme', theme);
  if (textSize !== 'standard') document.documentElement.setAttribute('data-text-size', textSize);

  // Read section from URL hash
  readPortalRoute(s);

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
}

function renderNav(s, user, allowed) {
  const nav = document.getElementById('portal-nav');
  if (!nav) return;

  const pendingApprovalsCount = getPendingApprovals(s).length;
  const pendingUsersCount = (s.users || []).filter((u) => u.status === 'pending').length;

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

function setupEvents() {
  document.addEventListener('click', (e) => {
    // 1. Navigation clicks
    const navBtn = e.target.closest('[data-action="nav-go"]');
    if (navBtn) {
      e.preventDefault();
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

    const taskEdit = e.target.closest('[data-action="capture-edit"]');
    if (taskEdit) {
      const task = accessibleTask(getState(), taskEdit.dataset.id);
      if (task) openTaskCapture({ task });
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
      if (action === 'plan-preferences') {
        openSchedulePreferences(officer);
        return;
      }
      if (action === 'plan-generate') planningView.generation = { officerId: officer.id, dates: planningDates() };
      if (action === 'plan-view') planningView.mode = mode;
      if (action === 'plan-today') planningView.date = TODAY;
      if (action === 'plan-shift') planningView.date = calendarDay(planningView.date, Number(offset) * (planningView.mode === 'weekly' ? 7 : 1));
      if (action === 'plan-open-day') Object.assign(planningView, { date, mode: 'daily' });
      renderApp();
      if (action === 'plan-open-day') document.querySelector('[data-action="plan-view"][data-mode="daily"]')?.focus();
      else if (action === 'plan-view') document.querySelector('[data-action="plan-view"][aria-pressed="true"]')?.focus();
      else if (action === 'plan-shift') document.querySelector(`[data-action="plan-shift"][data-offset="${offset}"]`)?.focus();
      else document.querySelector(`[data-action="${action}"]`)?.focus();
      return;
    }

    // 7. Plan & Simulator actions
    const simScenarioBtn = e.target.closest('[data-action="sim-select-scenario"]');
    if (simScenarioBtn) {
      const scenarioId = simScenarioBtn.dataset.scenario;
      planView.activeScenarioId = scenarioId;
      planView.simulationResult = null;
      renderApp();
      return;
    }

    const simAltBtn = e.target.closest('[data-action="sim-select-alt"]');
    if (simAltBtn) {
      planView.selectedAltId = simAltBtn.dataset.alt;
      renderApp();
      return;
    }

    const simCommitBtn = e.target.closest('[data-action="sim-commit"]');
    if (simCommitBtn) {
      if (!isManager(getState()) || getCurrentUser(getState()).status !== 'active') return;
      const alt = simCommitBtn.dataset.alt;
      update((s) => {
        logActivity(s, `Recorded simulated choice: Alternative ${alt.toUpperCase()}.`, actorName(s));
      });
      toast(`Simulated choice recorded: Alternative ${alt.toUpperCase()}.`, 'success');
      return;
    }

    const simRequestApprovalBtn = e.target.closest('[data-action="sim-request-approval"]');
    if (simRequestApprovalBtn) {
      const alt = simRequestApprovalBtn.dataset.alt;
      update((s) => {
        createApprovalRequest(s, {
          requestType: 'schedule_adjustment',
          taskId: 't103',
          taskTitle: 'Site check: ceiling seepage at Blk 211 #05-12',
          reason: `Alternative ${alt.toUpperCase()} schedule adjustment submitted from What-If Simulator.`,
          slaImpact: 'Protects 24h response commitment while handling safety delay.',
          operationalImpact: 'Rebalances inspection workload across Zone A.',
        });
      });
      toast('Schedule change request submitted to Estate Manager Jennifer Ong.', 'success');
      renderApp();
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
      update((s) => {
        decideApproval(s, apprId, 'approved', actorName(s), 'Approved by authorised manager.');
      });
      toast('Schedule change approved and applied.', 'success');
      renderApp();
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
      const cid = caseInspectBtn.dataset.id;
      caseView.selectedCaseId = cid;
      if (caseInspectBtn.dataset.tab) {
        caseView.journeyTab = caseInspectBtn.dataset.tab;
      } else {
        caseView.journeyTab = 'timeline';
      }
      renderApp();
      return;
    }

    const caseModalClose = e.target.closest('[data-action="case-modal-close"]');
    if (caseModalClose) {
      caseView.selectedCaseId = null;
      renderApp();
      return;
    }

    const journeyTabBtn = e.target.closest('[data-action="case-journey-tab"]');
    if (journeyTabBtn) {
      caseView.journeyTab = journeyTabBtn.dataset.tab;
      renderApp();
      return;
    }

    if (e.target.closest('[data-action="case-clear-filters"]')) {
      caseView.searchQuery = '';
      caseView.estateFilter = 'all';
      caseView.urgencyFilter = 'all';
      renderApp();
      return;
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
      caseView.selectedCaseId = null;
      currentSection = 'plan';
      window.location.hash = '#plan';
      toast('Opened What-If Simulator & Ripple Intelligence for case task.', 'info');
      renderApp();
      return;
    }

    const navToCaseBtn = e.target.closest('[data-action="nav-to-case"]');
    if (navToCaseBtn) {
      closeModal();
      const cid = navToCaseBtn.dataset.case;
      currentSection = 'cases';
      window.location.hash = '#cases';
      caseView.selectedCaseId = cid;
      caseView.journeyTab = 'timeline';
      renderApp();
      return;
    }

    const caseCloseBtn = e.target.closest('[data-action="case-close-action"]');
    if (caseCloseBtn) {
      const cid = caseCloseBtn.dataset.case;
      update((s) => {
        const res = closeCase(s, cid);
        if (!res.success) {
          toast(res.error, 'error');
        } else {
          toast(`Case ${res.case.caseNumber} closed successfully.`, 'success');
        }
      });
      renderApp();
      return;
    }

    const caseReassignBtn = e.target.closest('[data-action="case-reassign-dialog"]');
    if (caseReassignBtn) {
      const cid = caseReassignBtn.dataset.case || caseView.selectedCaseId;
      showCaseReassignModal(getState(), cid);
      return;
    }

    const caseCopyBriefBtn = e.target.closest('[data-action="case-copy-brief"]');
    if (caseCopyBriefBtn) {
      const el = document.getElementById('case-brief-text');
      if (el) {
        navigator.clipboard?.writeText(el.innerText);
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
    if (event.target.id === 'todo-preview' && event.target.isConnected) tasksView.toDoOpen = event.target.open;
  }, true);

  // Filter changes
  document.addEventListener('change', (e) => {
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
      tasksView[filter] = e.target.value;
      tasksView.page = 1;
      renderApp();
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
      renderApp();
      document.querySelector('[data-action="plan-date"]')?.focus();
    }
    if (e.target.dataset.action === 'plan-officer') {
      planningView.officerId = e.target.value;
      renderApp();
      document.querySelector('[data-action="plan-officer"]')?.focus();
    }

    if (e.target.dataset.action === 'settings-change-theme') {
      const val = e.target.value;
      localStorage.setItem('syncai_theme', val);
      if (val === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', val);
      toast(`Appearance set to ${val}.`, 'info');
    }

    if (e.target.dataset.action === 'settings-change-text') {
      const val = e.target.value;
      localStorage.setItem('syncai_text_size', val);
      if (val === 'standard') document.documentElement.removeAttribute('data-text-size');
      else document.documentElement.setAttribute('data-text-size', val);
      toast(`Text size set to ${val}.`, 'info');
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

  // Assistant form submit
  document.addEventListener('submit', (e) => {
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

  // Hash change
  window.addEventListener('hashchange', () => {
    readPortalRoute(getState());
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderApp();
  });
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

function showTaskDetailModal(s, t) {
  const dependents = traceDownstream(s, t.id).dependents.filter(({ task }) => accessibleTask(s, task.id));
  const mgr = isManager(s);
  const relatedCase = accessibleCase(s, t.caseId);
  const factors = priorityFactors(t);
  const deadline = deadlineAlert(t);
  const slaDue = taskDateInput(t.slaDue);

  const content = html`
    <h2 id="modal-title" class="modal-title">${t.title}</h2>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
      <span class="tag tag-brand">${t.category}</span>
      <span class="tag tag-neutral">${t.priority} priority</span>
      ${(t.tags || []).map((tag) => html`<span class="tag tag-neutral">${tag}</span>`)}
      ${deadline ? html`<span class="tag tag-${deadline.tone}">${deadline.label}</span>` : ''}
      ${t.safety ? html`<span class="tag tag-danger">Safety Hazard</span>` : ''}
      ${t.statutory ? html`<span class="tag tag-warning">Statutory Deadline</span>` : ''}
    </div>

    <div style="display: grid; gap: 10px; font-size: 0.875rem; margin-bottom: 16px;">
      ${t.description ? html`<p class="capture-text">${t.description}</p>` : ''}
      <div><strong>Assigned officer:</strong> ${officerName(s, t.ownerId)}</div>
      ${relatedCase ? html`<div><strong>Case:</strong> <a href="#cases/${relatedCase.id}" data-action="modal-close">${relatedCase.number} · ${relatedCase.title}</a></div>` : ''}
      ${t.location ? html`<div><strong>Location:</strong> ${t.location}</div>` : ''}
      <div><strong>Due:</strong> ${taskDateInput(t.dueAt || t.due).replace('T', ' ')} SGT</div>
      ${slaDue || t.slaType ? html`<div><strong>SLA:</strong> ${t.slaType || 'Recorded deadline'}
        ${slaDue ? html`<time datetime="${slaDue}+08:00">${slaDue.replace('T', ' ')} SGT</time>` : ''}</div>` : ''}
      <div><strong>Estimated duration:</strong> ${taskDuration(t)} minutes</div>
      ${t.fixedStartAt ? html`<div><strong>Fixed start:</strong> ${taskDateInput(t.fixedStartAt).replace('T', ' ')} SGT</div>` : ''}
      ${t.remarks ? html`<div class="capture-text"><strong>Remarks:</strong> ${t.remarks}</div>` : ''}
      ${t.appointmentTime
        ? html`<div><strong>Resident Commitment:</strong> <span class="tag tag-brand">${t.appointmentTime}</span></div>`
        : ''}
      ${t.caseId
        ? html`
            <div>
              <strong>Linked Case:</strong>
              <button
                type="button"
                class="tag tag-brand"
                data-action="nav-to-case"
                data-case="${t.caseId}"
                style="cursor: pointer; border: 1px solid var(--colorBrandStroke2); background: var(--colorBrandBackground2); color: var(--colorBrandForeground1); font-family: monospace; font-weight: 700; margin-left: 6px;"
              >
                ${icon('cases', 12)} ${t.caseId} → Open in Case Action Centre
              </button>
            </div>
          `
        : ''}
      ${t.consequence
        ? html`<div><strong>Long-term Consequence Risk:</strong> <span class="muted">${t.consequence}</span></div>`
        : ''}
    </div>
    <details class="priority-explanation">
      <summary>Why this priority?</summary>
      <p class="small muted">Priority is set on the task. These demo factors show the recorded context in EMS’s stated order.</p>
      <ol>${factors.map(({ factor, reason }) => html`<li><strong>${factor}</strong> ${reason}</li>`)}</ol>
    </details>

    <!-- Downstream Dependency Chain -->
    <div style="padding: 12px; border-radius: 8px; border: 1px solid var(--colorNeutralStroke2); margin-bottom: 16px;">
      <strong class="small" style="display: block; margin-bottom: 6px;">Downstream Ripple Dependencies:</strong>
      ${dependents.length === 0
        ? html`<p class="small muted" style="margin: 0;">No visible work orders depend on this task.</p>`
        : html`
            <ul style="margin: 0; padding-left: 18px; font-size: 0.8125rem;">
              ${dependents.map(
                (d) => html`<li><strong>${d.task.title}</strong> (Depth: ${d.depth})</li>`,
              )}
            </ul>
          `}
    </div>

    <div class="modal-actions">
      ${t.manualCapture ? '' : !mgr
        ? html`
            <button
              type="button"
              class="btn-primary btn-sm"
              data-action="request-task-adjustment"
              data-id="${t.id}"
            >
              Request Schedule Change
            </button>
          `
        : html`
            <button
              type="button"
              class="btn-primary btn-sm"
              data-action="reassign-task-direct"
              data-id="${t.id}"
            >
              Reassign Task
            </button>
          `}
      <button type="button" class="btn-ghost btn-sm" data-action="modal-close">Close</button>
    </div>
  `;

  openModal(content);

  document.getElementById('modal-root')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="request-task-adjustment"]')) {
      closeModal();
      update((stateObj) => {
        createApprovalRequest(stateObj, {
          requestType: 'schedule_adjustment',
          taskId: t.id,
          taskTitle: t.title,
          reason: 'Officer requested schedule change due to operational buffer constraint.',
          slaImpact: 'Maintains required response window.',
          operationalImpact: 'Prevents overload during site visits.',
        });
      });
      toast('Schedule change request submitted for manager approval.', 'success');
      renderApp();
    }
  }, { once: true });
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
    <h2 class="modal-title">Request Case Reassignment</h2>
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
          <label for="reassign-reason-input" style="display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 4px;">Operational Handover Reason</label>
          <textarea id="reassign-reason-input" rows="3" required placeholder="e.g. Zone boundary re-alignment / site inspection capacity overload..." style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--colorNeutralStroke1); font-family: inherit; font-size: 0.875rem; box-sizing: border-box;"></textarea>
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

      closeModal();
      update((stateObj) => {
        requestCaseReassignment(stateObj, caseId, targetOfficerId, reason);
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
