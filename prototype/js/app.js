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
  getTask,
  isOpen,
  logActivity,
  actorName,
} from './state.js';
import { html, raw, render, icon, toast, openModal, closeModal } from './ui.js';
import { scoreTask } from './ai.js';
import { traceDownstream } from './ripple.js';
import { commitSimulation } from './simulation.js';

// Page modules
import overviewPage from './pages/overview.js';
import tasksPage from './pages/tasks.js';
import planPage from './pages/plan.js';
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
  plan: { id: 'plan', label: 'My plan', icon: 'calendar', page: planPage },
  team: { id: 'team', label: 'My team', icon: 'team', page: teamPage },
  people: { id: 'people', label: 'People', icon: 'users', page: peoplePage },
  teams: { id: 'teams', label: 'Teams', icon: 'team', page: teamsAdminPage },
  activity: { id: 'activity', label: 'Activity', icon: 'history', page: activityPage },
  decides: { id: 'decides', label: 'How SyncAI decides', icon: 'sparkle', page: decidesPage },
  settings: { id: 'settings', label: 'Settings', icon: 'settings', page: settingsPage },
};

let currentSection = 'overview';

// Determine allowed sections based on role and status (matches client/src/lib/sections.js)
function allowedSections(s) {
  const user = getCurrentUser(s);
  if (user.status !== 'active') {
    return ['overview', 'assistant', 'decides', 'settings'];
  }
  if (isAdmin(s)) {
    return ['overview', 'assistant', 'people', 'teams', 'activity', 'decides', 'settings'];
  }
  if (isManager(s)) {
    return ['overview', 'assistant', 'tasks', 'plan', 'team', 'decides', 'settings'];
  }
  // Member
  return ['overview', 'assistant', 'tasks', 'plan', 'decides', 'settings'];
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
  const hash = window.location.hash.replace(/^#\/?/, '');
  const allowed = allowedSections(s);
  if (hash && allowed.includes(hash)) {
    currentSection = hash;
  } else {
    currentSection = 'overview';
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

  const initials = user.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  if (nameHeader) nameHeader.textContent = user.displayName;
  if (emailHeader) emailHeader.textContent = user.email;
  if (avatarHeader) avatarHeader.textContent = initials;

  if (nameCard) nameCard.textContent = user.displayName;
  if (emailCard) emailCard.textContent = user.email;
  if (roleCard) roleCard.textContent = roleLabels[user.role];
  if (avatarCard) avatarCard.textContent = initials;
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
  render(main, sec.page.render(s));
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
      update((s) => {
        const t = getTask(s, taskId);
        if (t) {
          t.status = t.status === 'done' ? 'todo' : 'done';
          t.completedAt = t.status === 'done' ? new Date().toISOString() : null;
          logActivity(s, `${t.status === 'done' ? 'Completed' : 'Reopened'} task: ${t.title}`, actorName(s));
        }
      });
      toast('Task status updated.', 'success');
      return;
    }

    const taskInspect = e.target.closest('[data-action="task-inspect"]');
    if (taskInspect) {
      const taskId = taskInspect.dataset.id;
      const s = getState();
      const t = getTask(s, taskId);
      if (t) showTaskDetailModal(s, t);
      return;
    }

    const taskCreateDialog = e.target.closest('[data-action="task-create-dialog"]');
    if (taskCreateDialog) {
      showCreateTaskModal(getState());
      return;
    }

    // 7. Plan & Simulator actions
    const simScenarioBtn = e.target.closest('[data-action="sim-select-scenario"]');
    if (simScenarioBtn) {
      const scenarioId = simScenarioBtn.dataset.scenario;
      planPage.activeScenarioId = scenarioId;
      planPage.simulationResult = null;
      renderApp();
      return;
    }

    const simAltBtn = e.target.closest('[data-action="sim-select-alt"]');
    if (simAltBtn) {
      planPage.selectedAltId = simAltBtn.dataset.alt;
      renderApp();
      return;
    }

    const simCommitBtn = e.target.closest('[data-action="sim-commit"]');
    if (simCommitBtn) {
      const alt = simCommitBtn.dataset.alt;
      update((s) => {
        logActivity(s, `Committed Alternative ${alt.toUpperCase()} in What-If Simulator: schedule adjustments applied.`, actorName(s));
      });
      toast(`Alternative ${alt.toUpperCase()} applied to team schedule.`, 'success');
      renderApp();
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
  });

  // Role select dropdown change
  document.getElementById('quick-role-select')?.addEventListener('change', (e) => {
    const roleKey = e.target.value;
    switchDemoRole(roleKey);
  });

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

    if (e.target.dataset.action === 'tasks-filter-category') {
      tasksPage.view ||= {};
      tasksPage.view.category = e.target.value;
      renderApp();
    }

    if (e.target.dataset.action === 'tasks-filter-owner') {
      tasksPage.view ||= {};
      tasksPage.view.owner = e.target.value;
      renderApp();
    }

    if (e.target.dataset.action === 'todo-select-list') {
      tasksPage.view ||= {};
      tasksPage.view.selectedToDoList = e.target.value;
      renderApp();
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
  });

  // Search input events
  document.addEventListener('input', (e) => {
    if (e.target.dataset.action === 'tasks-search') {
      tasksPage.view ||= {};
      tasksPage.view.q = e.target.value;
      renderApp();
    }
    if (e.target.dataset.action === 'people-search') {
      peoplePage.view ||= {};
      peoplePage.view.q = e.target.value;
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
    const hash = window.location.hash.replace(/^#\/?/, '');
    const s = getState();
    const allowed = allowedSections(s);
    if (hash && allowed.includes(hash)) {
      currentSection = hash;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderApp();
    }
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
          <strong>Alex Tan (Admin)</strong>
          <span class="small muted" style="display: block;">System Administrator. User directory, pending account approval, team setup.</span>
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
  const scored = scoreTask(s, t);
  const downstream = traceDownstream(s, t.id);
  const user = getCurrentUser(s);
  const mgr = isManager(s);

  const content = html`
    <h2 class="modal-title">${t.title}</h2>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
      <span class="tag tag-brand">${t.category}</span>
      <span class="tag tag-neutral">${t.priority} priority</span>
      ${t.safety ? html`<span class="tag tag-danger">Safety Hazard</span>` : ''}
      ${t.statutory ? html`<span class="tag tag-warning">Statutory Deadline</span>` : ''}
    </div>

    <div style="padding: 12px 14px; border-radius: 8px; background: var(--colorNeutralBackground2); margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong>Consequence-Aware AI Score:</strong>
        <span class="score-pill ${scored.score >= 70 ? 'hi' : scored.score >= 40 ? 'md' : 'lo'}">
          ${scored.score} / 100
        </span>
      </div>
      <p class="small muted">${scored.summary || 'Prioritised based on EM Services operational weights.'}</p>
    </div>

    <div style="display: grid; gap: 10px; font-size: 0.875rem; margin-bottom: 16px;">
      <div><strong>Location:</strong> ${t.location || 'Estate Site'}</div>
      <div><strong>Due Date:</strong> ${t.due} (${t.slaType || 'Standard SLA'})</div>
      ${t.appointmentTime
        ? html`<div><strong>Resident Commitment:</strong> <span class="tag tag-brand">${t.appointmentTime}</span></div>`
        : ''}
      ${t.consequence
        ? html`<div><strong>Long-term Consequence Risk:</strong> <span class="muted">${t.consequence}</span></div>`
        : ''}
    </div>

    <!-- Downstream Dependency Chain -->
    <div style="padding: 12px; border-radius: 8px; border: 1px solid var(--colorNeutralStroke2); margin-bottom: 16px;">
      <strong class="small" style="display: block; margin-bottom: 6px;">Downstream Ripple Dependencies:</strong>
      ${downstream.dependents.length === 0
        ? html`<p class="small muted" style="margin: 0;">No other work orders depend directly on this task.</p>`
        : html`
            <ul style="margin: 0; padding-left: 18px; font-size: 0.8125rem;">
              ${downstream.dependents.map(
                (d) => html`<li><strong>${d.task.title}</strong> (Depth: ${d.depth})</li>`,
              )}
            </ul>
          `}
    </div>

    <div class="modal-actions">
      ${!mgr
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

function showCreateTaskModal(s) {
  const content = html`
    <h2 class="modal-title">Create Operational Task</h2>
    <form id="create-task-form" style="display: grid; gap: 12px; margin-top: 14px;">
      <div>
        <label for="task-title-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px;">Task Title</label>
        <input
          type="text"
          id="task-title-input"
          class="search-input"
          style="width: 100%;"
          placeholder="e.g. Inspect corridor lighting fault at Blk 214"
          required
        />
      </div>
      <div>
        <label for="task-cat-select" class="small" style="font-weight: 600; display: block; margin-bottom: 4px;">Category</label>
        <select id="task-cat-select" class="filter-tab" style="width: 100%; border: 1px solid var(--colorNeutralStroke1); border-radius: 6px;">
          <option value="Inspection">Inspection</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Resident Feedback">Resident Feedback</option>
          <option value="Contractor">Contractor</option>
          <option value="Admin">Admin</option>
        </select>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label for="task-priority-select" class="small" style="font-weight: 600; display: block; margin-bottom: 4px;">Priority</label>
          <select id="task-priority-select" class="filter-tab" style="width: 100%; border: 1px solid var(--colorNeutralStroke1); border-radius: 6px;">
            <option value="High">High</option>
            <option value="Medium" selected>Medium</option>
            <option value="Critical">Critical</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div>
          <label for="task-effort-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px;">Effort (Hours)</label>
          <input type="number" id="task-effort-input" class="search-input" style="width: 100%;" value="1.5" min="0.5" max="8" step="0.5" />
        </div>
      </div>
      <div>
        <label for="task-loc-input" class="small" style="font-weight: 600; display: block; margin-bottom: 4px;">Location</label>
        <input type="text" id="task-loc-input" class="search-input" style="width: 100%;" placeholder="e.g. Blk 214 void deck" />
      </div>
      <div style="display: flex; gap: 16px; margin-top: 6px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.875rem; cursor: pointer;">
          <input type="checkbox" id="task-safety-check" /> Genuine resident safety risk
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.875rem; cursor: pointer;">
          <input type="checkbox" id="task-statutory-check" /> Mandatory statutory deadline
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-ghost btn-sm" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn-primary btn-sm">Create Task</button>
      </div>
    </form>
  `;

  openModal(content);

  document.getElementById('create-task-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title-input').value.trim();
    const category = document.getElementById('task-cat-select').value;
    const priority = document.getElementById('task-priority-select').value;
    const effort = parseFloat(document.getElementById('task-effort-input').value) || 1.5;
    const location = document.getElementById('task-loc-input').value.trim();
    const safety = document.getElementById('task-safety-check').checked;
    const statutory = document.getElementById('task-statutory-check').checked;

    closeModal();
    update((stateObj) => {
      stateObj.tasks ||= [];
      const newTask = {
        id: `t${Date.now().toString().slice(-4)}`,
        ownerId: stateObj.currentOfficerId || 'o1',
        title,
        category,
        priority,
        effort,
        spent: 0,
        status: 'todo',
        location,
        safety,
        statutory,
        due: new Date(Date.now() + 86400000).toISOString(),
        dependsOn: [],
      };
      stateObj.tasks.unshift(newTask);
      logActivity(stateObj, `Created task: ${title}`, actorName(stateObj));
    });
    toast('New operational task created.', 'success');
    renderApp();
  });
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

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
