// Overview Page — Role-aware view matching full-stack AdminPortal / MemberPortal
import { html, raw, icon } from '../ui.js';
import { isAdmin, isManager, isTeamMember, getCurrentUser, getPendingApprovals, visibleTasks, getOfficer, actorName } from '../state.js';
import { assessRisk } from '../planner.js';
import { TODAY, NOW } from '../time.js';

export default {
  render(s) {
    const user = getCurrentUser(s);
    const active = user.status === 'active';

    if (isAdmin(s) && active) {
      return renderAdminOverview(s, user);
    }
    if (isManager(s) && active) {
      return renderManagerOverview(s, user);
    }
    if (active) {
      return renderMemberOverview(s, user);
    }
    return renderStatusOverview(s, user);
  },
};

function renderAdminOverview(s, user) {
  const users = s.users || [];
  const pending = users.filter((u) => u.status === 'pending');
  const activeCount = users.filter((u) => u.status === 'active').length;
  const managerCount = users.filter((u) => u.role === 'manager' && u.status === 'active').length;

  return html`
    <section class="portal-hero" aria-labelledby="hero-h">
      <div>
        <p class="portal-hero-date">
          <time datetime="${TODAY}">${new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
        </p>
        <h1 id="hero-h">Good day, ${user.displayName.split(' ')[0]}</h1>
        <p>You have ${pending.length} pending account requests to review. SyncAI is configured for your Town Council.</p>
      </div>
      <div class="portal-hero-usp">
        ${icon('shield', 24)}
        <span><strong>Administrator Portal</strong> Manage users, roles, team memberships and audit logs.</span>
      </div>
    </section>

    <ul class="stat-grid" aria-label="Overview statistics">
      <li class="stat-card">
        <span class="stat-icon">${icon('users', 20)}</span>
        <span class="stat-label">People</span>
        <strong class="stat-value">${users.length}</strong>
        <span class="stat-hint">Across all teams</span>
      </li>
      <li class="stat-card ${pending.length ? 'warn' : ''}">
        <span class="stat-icon">${icon('clock', 20)}</span>
        <span class="stat-label">Pending</span>
        <strong class="stat-value">${pending.length}</strong>
        <span class="stat-hint">${pending.length ? 'Awaiting approval' : 'All approved'}</span>
      </li>
      <li class="stat-card">
        <span class="stat-icon">${icon('check', 20)}</span>
        <span class="stat-label">Active</span>
        <strong class="stat-value">${activeCount}</strong>
        <span class="stat-hint">Signed-in users</span>
      </li>
      <li class="stat-card">
        <span class="stat-icon">${icon('shield', 20)}</span>
        <span class="stat-label">Managers</span>
        <strong class="stat-value">${managerCount}</strong>
        <span class="stat-hint">Authorised approvers</span>
      </li>
    </ul>

    <div class="portal-grid">
      <section class="panel" aria-labelledby="pending-queue-h">
        <div class="panel-head">
          <h2 id="pending-queue-h">Pending approval requests</h2>
          <span class="tag ${pending.length ? 'tag-warning' : 'tag-neutral'}">${pending.length} waiting</span>
        </div>
        ${pending.length === 0
          ? html`<div class="empty">${icon('check', 20)}<p>No pending user accounts. All sign-ins are up to date.</p></div>`
          : html`
              <ul class="queue">
                ${pending.map(
                  (u) => html`
                    <li>
                      <div class="account-avatar">${u.displayName.slice(0, 2).toUpperCase()}</div>
                      <div class="queue-who">
                        <strong>${u.displayName}</strong>
                        <span>${u.email}</span>
                      </div>
                      <div class="queue-actions">
                        <button type="button" class="btn-primary btn-sm" data-action="admin-approve" data-id="${u.id}">Approve</button>
                        <button type="button" class="btn-ghost btn-sm" data-action="admin-disable" data-id="${u.id}">Decline</button>
                      </div>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>

      <section class="panel panel-invite" aria-labelledby="invite-h">
        <div class="panel-head">
          <h2 id="invite-h">Invite your team</h2>
        </div>
        <ol class="steps-list">
          <li>Send them this link.</li>
          <li>They sign in with their own Microsoft account.</li>
          <li>They appear under “Needs your attention” for you to approve.</li>
        </ol>
        <div class="invite">
          <div class="invite-box">
            <code id="invite-link-code">${typeof window !== 'undefined' && window.location ? `${window.location.origin}${window.location.pathname.replace(/\/index\.html.*|\/?$/, '')}/site/login.html` : 'https://syncai.towncouncil.internal/site/login.html'}</code>
          </div>
          <button type="button" class="btn-secondary btn-sm" data-action="copy-invite">
            ${icon('copy', 14)} Copy link
          </button>
        </div>
      </section>

      ${renderUspCard(true)}
    </div>
  `;
}

function renderManagerOverview(s, user) {
  const tasks = s.tasks || [];
  const pendingApprovals = getPendingApprovals(s);
  const highRiskTasks = tasks.filter((t) => t.status !== 'done' && assessRisk(s, t).level === 'high');
  const activeOfficers = s.officers.filter((o) => !o.availability?.[TODAY]).length;

  return html`
    <section class="portal-hero" aria-labelledby="hero-h">
      <div>
        <p class="portal-hero-date">
          <time datetime="${TODAY}">${new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
        </p>
        <h1 id="hero-h">Good day, ${user.displayName.split(' ')[0]}</h1>
        <p>Team workload is balanced with ${pendingApprovals.length} pending approval request. Safety and statutory commitments are protected.</p>
      </div>
      <div class="portal-hero-usp">
        ${icon('sparkles', 24)}
        <span><strong>Operational Ripple Intelligence</strong> Downstream dependencies and team capacity are monitored continuously.</span>
      </div>
    </section>

    <ul class="stat-grid" aria-label="Team operational summary">
      <li class="stat-card">
        <span class="stat-icon">${icon('tasks', 20)}</span>
        <span class="stat-label">Team Tasks</span>
        <strong class="stat-value">${tasks.filter((t) => t.status !== 'done').length}</strong>
        <span class="stat-hint">Active work orders</span>
      </li>
      <li class="stat-card ${pendingApprovals.length ? 'warn' : ''}">
        <span class="stat-icon">${icon('alert', 20)}</span>
        <span class="stat-label">Approvals</span>
        <strong class="stat-value">${pendingApprovals.length}</strong>
        <span class="stat-hint">${pendingApprovals.length ? 'Action required' : 'Queue clear'}</span>
      </li>
      <li class="stat-card ${highRiskTasks.length ? 'warn' : ''}">
        <span class="stat-icon">${icon('clock', 20)}</span>
        <span class="stat-label">SLA Attention</span>
        <strong class="stat-value">${highRiskTasks.length}</strong>
        <span class="stat-hint">Tight deadline margin</span>
      </li>
      <li class="stat-card">
        <span class="stat-icon">${icon('users', 20)}</span>
        <span class="stat-label">Available Staff</span>
        <strong class="stat-value">${activeOfficers} / ${s.officers.length}</strong>
        <span class="stat-hint">Officers on duty today</span>
      </li>
    </ul>

    <div class="portal-grid">
      <!-- Manager Approval Queue -->
      <section class="panel" aria-labelledby="approval-queue-h">
        <div class="panel-head">
          <h2 id="approval-queue-h">Manager approval queue</h2>
          <span class="tag ${pendingApprovals.length ? 'tag-warning' : 'tag-neutral'}">${pendingApprovals.length} pending</span>
        </div>
        ${pendingApprovals.length === 0
          ? html`<div class="empty">${icon('check', 20)}<p>No schedule changes or reassignments awaiting approval.</p></div>`
          : html`
              <ul class="queue">
                ${pendingApprovals.map(
                  (a) => html`
                    <li>
                      <div class="stat-icon" style="border-radius: 50%; width: 36px; height: 36px;">${icon('arrow', 16)}</div>
                      <div class="queue-who">
                        <strong>${a.taskTitle}</strong>
                        <span>${a.requesterName} requested ${a.requestType.replace('_', ' ')}: ${a.reason}</span>
                      </div>
                      <div class="queue-actions">
                        <button type="button" class="btn-primary btn-sm" data-action="manager-approve" data-id="${a.id}">Approve</button>
                        <button type="button" class="btn-ghost btn-sm" data-action="manager-reject" data-id="${a.id}">Reject</button>
                      </div>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>

      <!-- Team Duty & Capacity Snapshot -->
      <section class="panel" aria-labelledby="team-duty-h">
        <div class="panel-head">
          <h2 id="team-duty-h">Today's Team Capacity</h2>
          <a href="#team" class="btn-ghost btn-sm" data-action="nav-go" data-section="team">View all →</a>
        </div>
        <ul style="list-style: none; margin: 0; padding: 0; display: grid; gap: 10px;">
          ${s.officers.slice(0, 4).map((o) => {
            const away = o.availability?.[TODAY];
            return html`
              <li style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: var(--colorNeutralBackground2);">
                <div>
                  <strong>${o.name}</strong>
                  <span class="small muted" style="display: block;">${o.title} · ${o.zone}</span>
                </div>
                <span class="tag ${away ? 'tag-neutral' : 'tag-success'}">${away ? away.toUpperCase() : 'Available'}</span>
              </li>
            `;
          })}
        </ul>
      </section>

      ${renderUspCard(true)}
    </div>
  `;
}

function renderMemberOverview(s, user) {
  const tasks = visibleTasks(s);
  const myPendingApprovals = (s.approvals || []).filter((a) => a.requesterId === s.currentOfficerId && a.status === 'pending');

  return html`
    <section class="portal-hero" aria-labelledby="hero-h">
      <div>
        <p class="portal-hero-date">
          <time datetime="${TODAY}">${new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
        </p>
        <h1 id="hero-h">Good day, ${user.displayName.split(' ')[0]}</h1>
        <p>Your work has been ranked by safety and SLA deadlines. Today’s plan fits into your available hours around Outlook meetings.</p>
      </div>
      <div class="portal-hero-usp">
        ${icon('sparkles', 24)}
        <span><strong>Operationally aware AI scheduling</strong> Understand priorities. Build achievable plans. Adapt when work changes.</span>
      </div>
    </section>

    <div class="member-grid">
      <!-- Today's Plan Preview -->
      <section class="panel member-today" aria-labelledby="today-h">
        <div class="panel-head">
          <h2 id="today-h">Today's plan overview</h2>
          <span class="tag tag-brand">Fits your day</span>
        </div>
        <div class="plan-timeline" aria-label="Today's scheduled plan">
          <div class="plan-slot safety">
            <span class="slot-time">08:30 – 10:00</span>
            <div class="slot-main">
              <strong class="slot-title">Lift inspection — Blk 208</strong>
              <span class="slot-meta">Lifts A & B · Fictional inspection deadline</span>
            </div>
            <span class="slot-badge tag-danger">Safety</span>
          </div>
          <div class="plan-slot deadline">
            <span class="slot-time">10:30 – 11:30</span>
            <div class="slot-main">
              <strong class="slot-title">Fire safety cert verification</strong>
              <span class="slot-meta">SCDF statutory compliance check</span>
            </div>
            <span class="slot-badge tag-warning">Statutory</span>
          </div>
          <div class="plan-slot buffer">
            <span class="slot-time">12:00 – 13:00</span>
            <div class="slot-main">
              <strong class="slot-title">Protected lunch & transit buffer</strong>
              <span class="slot-meta">Outlook calendar hold protected</span>
            </div>
            <span class="slot-badge tag-neutral">Protected</span>
          </div>
          <div class="plan-slot service">
            <span class="slot-time">14:00 – 15:30</span>
            <div class="slot-main">
              <strong class="slot-title">Site check: ceiling seepage</strong>
              <span class="slot-meta">Blk 211 #05-12 · Resident visit</span>
            </div>
            <span class="slot-badge tag-brand">Service</span>
          </div>
          <div class="plan-slot admin">
            <span class="slot-time">16:00 – 17:00</span>
            <div class="slot-main">
              <strong class="slot-title">CleanPro contractor report review</strong>
              <span class="slot-meta">Monthly estate operations review</span>
            </div>
            <span class="slot-badge tag-neutral">Admin</span>
          </div>
        </div>
        <div class="today-note">
          ${icon('calendar', 20)}
          <p>
            <strong>Realistic day planning in action:</strong><br />
            <span class="muted">Your schedule leaves buffer around inspection travel and fixed Outlook meetings.</span>
          </p>
        </div>
        <div style="margin-top: 14px;">
          <button type="button" class="btn-primary btn-sm" data-action="nav-go" data-section="plan">
            Open Smart Planner →
          </button>
        </div>
      </section>

      <!-- Role & Team Details -->
      <section class="panel member-side" aria-labelledby="role-h">
        <div class="panel-head">
          <h2 id="role-h">Your Operational Role</h2>
          <span class="tag tag-brand">Property Officer</span>
        </div>
        <p class="muted small">Sees their own tasks, daily plan, and gets recommendations that fit their working hours.</p>
        <p class="small" style="margin-top: 10px;">
          <strong>Team:</strong> Zone A Operations<br />
          <strong>Manager:</strong> Jennifer Ong (Estate Manager)
        </p>
        ${myPendingApprovals.length > 0
          ? html`
              <div class="callout warn" style="margin-top: 14px;">
                ${icon('clock', 18)}
                <div>
                  <strong>${myPendingApprovals.length} pending change request</strong><br />
                  Submitted for manager review: ${myPendingApprovals[0].taskTitle}.
                </div>
              </div>
            `
          : ''}
      </section>

      <!-- Setup Progress Card -->
      <section class="panel member-side setup-card" aria-labelledby="setup-h">
        <div class="panel-head">
          <h2 id="setup-h">Platform Status</h2>
        </div>
        <p class="muted small">Operational systems status for your account:</p>
        <ol class="setup-list">
          <li class="setup-step done">
            <span class="setup-icon">${icon('check', 16)}</span>
            <span class="setup-name">Microsoft Entra ID sign-in</span>
            <span class="setup-state">Connected (Demo)</span>
          </li>
          <li class="setup-step done">
            <span class="setup-icon">${icon('check', 16)}</span>
            <span class="setup-name">Town Council manager approval</span>
            <span class="setup-state">Active</span>
          </li>
          <li class="setup-step done">
            <span class="setup-icon">${icon('check', 16)}</span>
            <span class="setup-name">Zone A operational team placement</span>
            <span class="setup-state">Assigned</span>
          </li>
          <li class="setup-step done">
            <span class="setup-icon">${icon('check', 16)}</span>
            <span class="setup-name">Microsoft To Do sync</span>
            <span class="setup-state">Simulated Live</span>
          </li>
          <li class="setup-step done">
            <span class="setup-icon">${icon('check', 16)}</span>
            <span class="setup-name">Outlook calendar buffer integration</span>
            <span class="setup-state">Simulated Live</span>
          </li>
        </ol>
      </section>

      ${renderUspCard(true)}
    </div>
  `;
}

function renderStatusOverview(s, user) {
  const isPending = user.status === 'pending';
  return html`
    <section class="portal-hero" aria-labelledby="hero-h">
      <div>
        <p class="portal-hero-date">
          <time datetime="${TODAY}">${new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time>
        </p>
        <h1 id="hero-h">${isPending ? 'Account pending approval' : 'Account disabled'}</h1>
        <p>
          ${isPending
            ? 'Your Microsoft account has been authenticated, but an administrator has not yet assigned your operational role and team.'
            : 'Your SyncAI access has been disabled by a Town Council administrator.'}
        </p>
      </div>
      <div class="portal-hero-usp">
        ${icon('shield', 24)}
        <span><strong>Access Controlled</strong> Operational task lists, calendars and plans are protected until account approval.</span>
      </div>
    </section>

    <div class="member-grid">
      <section class="panel status-panel ${user.status}" aria-labelledby="status-h">
        <span class="card-icon" style="background: var(--colorPaletteMarigoldBackground1); color: var(--colorPaletteMarigoldForeground2);">
          ${icon('clock', 24)}
        </span>
        <div>
          <h2 id="status-h">${isPending ? 'Awaiting Administrator Review' : 'Account Deactivated'}</h2>
          <p class="muted">
            ${isPending
              ? 'An administrator will verify your Town Council officer role and assign you to an operational zone (Zone A, B or C). Once approved, your daily plan, tasks and Outlook integration will activate automatically.'
              : 'Please contact your estate manager or IT administrator if you require reactivation.'}
          </p>
        </div>
      </section>

      <section class="panel setup-card wide" aria-labelledby="setup-h">
        <div class="panel-head">
          <h2 id="setup-h">Account Activation Checklist</h2>
        </div>
        <ol class="setup-list">
          <li class="setup-step done">
            <span class="setup-icon">${icon('check', 16)}</span>
            <span class="setup-name">Microsoft Entra ID sign-in</span>
            <span class="setup-state">Completed</span>
          </li>
          <li class="setup-step ${isPending ? 'waiting' : 'off'}">
            <span class="setup-icon">${icon('clock', 16)}</span>
            <span class="setup-name">Town Council Administrator approval</span>
            <span class="setup-state">${isPending ? 'Waiting for admin' : 'Disabled'}</span>
          </li>
          <li class="setup-step soon">
            <span class="setup-icon">${icon('clock', 16)}</span>
            <span class="setup-name">Operational team placement</span>
            <span class="setup-state">Pending</span>
          </li>
          <li class="setup-step soon">
            <span class="setup-icon">${icon('clock', 16)}</span>
            <span class="setup-name">Microsoft To Do & Outlook calendar unlock</span>
            <span class="setup-state">Locked</span>
          </li>
        </ol>
      </section>
    </div>
  `;
}

function renderUspCard(fullWidth = false) {
  return html`
    <section class="panel-usp ${fullWidth ? 'wide' : ''}" aria-labelledby="usp-h" style="${fullWidth ? 'grid-column: 1 / -1;' : ''}">
      <div class="usp-intro">
        <p class="eyebrow">Our difference</p>
        <h2 id="usp-h">Operationally aware AI scheduling</h2>
        <p class="muted">SyncAI evaluates genuine safety hazards, statutory constraints, and operational ripple consequences before proposing schedule changes.</p>
        <button type="button" class="btn-primary" data-action="nav-go" data-section="decides">
          How SyncAI decides →
        </button>
      </div>
      <ol class="usp-factors" aria-label="Operational priority factors">
        <li>
          <span class="usp-n" aria-hidden="true">1</span>
          <strong>Safety</strong>
          <span>Genuine risks to residents, staff and property outrank routine requests.</span>
        </li>
        <li>
          <span class="usp-n" aria-hidden="true">2</span>
          <strong>Mandatory deadlines</strong>
          <span>Statutory, BCA/SCDF compliance and funding approval dates cannot slip.</span>
        </li>
        <li>
          <span class="usp-n" aria-hidden="true">3</span>
          <strong>Service impact & consequences</strong>
          <span>Evaluates what happens if work waits. Not who complains loudest.</span>
        </li>
        <li>
          <span class="usp-n" aria-hidden="true">4</span>
          <strong>Scheduling feasibility</strong>
          <span>Estimates durations matched to true available hours and Outlook meetings.</span>
        </li>
      </ol>
    </section>
  `;
}
