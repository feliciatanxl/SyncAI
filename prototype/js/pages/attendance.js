// Attendance page (104) with the MC reshuffle (051).
// Managers see and edit the whole team. Team members can only check themselves in and out.

import { absentOfficers, applyReshuffle, attendanceSummary, checkIn, checkOut, clearAbsence, markAbsent, proposeReshuffle } from '../attendance.js';
import { getCurrentUser, getOfficer, getState, initials, isManager, update } from '../state.js';
import { TODAY, fmtLongDay } from '../time.js';
import { html, icon, pct, toast } from '../ui.js';

const STATUS_BADGE = { in: 'success', out: 'neutral', pending: 'warning', mc: 'danger', leave: 'brand', away: 'neutral' };

function rowActions(s, row, manager) {
  const { officer, status } = row;
  const mine = officer.id === s.currentOfficerId;
  const id = officer.id;
  const button = (action, label, kind = 'secondary', extra = '') =>
    html`<button type="button" class="btn-sm btn-${kind}" data-action="${action}" data-officer="${id}" ${extra}>${label}</button>`;

  if (!manager && !mine) return html`<span class="muted small">View only</span>`;
  if (status.group === 'absent') return manager ? button('att-clear', 'Mark as back') : html`<span class="muted small">Ask your manager</span>`;
  const actions = [];
  if (status.id === 'pending') actions.push(button('att-check-in', 'Check in', 'primary'));
  if (status.id === 'in') actions.push(button('att-check-out', 'Check out'));
  if (status.id === 'out') actions.push(button('att-check-in', 'Check in again'));
  if (manager) {
    actions.push(button('att-absent-mc', 'Mark MC', 'subtle'));
    actions.push(button('att-absent-leave', 'Mark leave', 'subtle'));
  }
  return html`<div class="u-row u-wrap">${actions}</div>`;
}

function roster(s, manager) {
  const { rows } = attendanceSummary(s);
  return html`<section class="panel" aria-labelledby="att-roster-h">
    <div class="panel-head">
      <div>
        <h2 id="att-roster-h">Today’s roster</h2>
        <p class="muted small">${fmtLongDay(TODAY)}. ${manager ? 'Check people in, or mark who is away.' : 'Check yourself in and out.'}</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table" aria-label="Attendance today">
        <thead><tr><th scope="col">Officer</th><th scope="col">Zone</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody>
          ${rows.map(
            (row) => html`<tr>
              <th scope="row"><span class="u-row"><span class="account-avatar sm" aria-hidden="true">${initials(row.officer.name)}</span><span><strong>${row.officer.name}</strong><br /><span class="muted small">${row.officer.title}</span></span></span></th>
              <td>${row.officer.zone}</td>
              <td><span class="badge badge-${STATUS_BADGE[row.status.id] || 'neutral'}">${row.status.label}</span></td>
              <td>${rowActions(s, row, manager)}</td>
            </tr>`,
          )}
        </tbody>
      </table>
    </div>
    <p class="muted small u-mt-sm">${icon('shield', 14)} Only the type of absence is kept. Medical details are never recorded.</p>
  </section>`;
}

function util(snap, id) {
  return snap.team.find((t) => t.id === id)?.weekUtil ?? null;
}

function reshuffle(s) {
  const absent = absentOfficers(s);
  if (!absent.length) {
    return html`<section class="panel" aria-labelledby="att-resh-h">
      <div class="panel-head"><div><h2 id="att-resh-h">MC reshuffle</h2><p class="muted small">When someone is marked MC or on leave, SyncAI suggests who takes over their open work.</p></div></div>
      <div class="callout">${icon('info', 20)}<div>Everyone is in today, so there is nothing to reshuffle. Mark an officer as MC above to see it work.</div></div>
    </section>`;
  }

  const r = proposeReshuffle(s);
  const receivers = [...new Set(r.proposals.map((p) => p.toId))];
  const affected = [...absent.map((o) => o.id), ...receivers];
  return html`<section class="panel" aria-labelledby="att-resh-h">
    <div class="panel-head">
      <div>
        <h2 id="att-resh-h">MC reshuffle</h2>
        <p class="muted small">${absent.map((o) => o.name).join(', ')} ${absent.length > 1 ? 'are' : 'is'} away today. SyncAI suggests who takes over the open work, most urgent first. Nothing changes until a manager approves.</p>
      </div>
      <span class="tag tag-brand">Explainable AI</span>
    </div>

    ${r.proposals.length || r.unassigned.length
      ? html`<div class="table-wrap">
          <table class="data-table" aria-label="Proposed reshuffle">
            <thead><tr><th scope="col">Task</th><th scope="col">Due</th><th scope="col">From</th><th scope="col">To</th><th scope="col">Why this person</th></tr></thead>
            <tbody>
              ${r.proposals.map(
                (p) => html`<tr>
                  <th scope="row">${p.title}${p.safety ? html` <span class="tag tag-danger">Safety</span>` : ''}${p.statutory ? html` <span class="tag tag-warning">Mandatory</span>` : ''}</th>
                  <td>${p.due}</td>
                  <td>${p.fromName}</td>
                  <td><strong>${p.toName}</strong></td>
                  <td class="small">${p.reasons.slice(0, 3).join(', ')}${p.alternatives.length ? html`<br /><span class="muted">Also considered: ${p.alternatives.join(', ')}</span>` : ''}</td>
                </tr>`,
              )}
              ${r.unassigned.map(
                (p) => html`<tr>
                  <th scope="row">${p.title}</th>
                  <td>${p.due}</td>
                  <td>${p.fromName}</td>
                  <td><span class="badge badge-danger">Needs a manager</span></td>
                  <td class="small">${p.reason}</td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>`
      : html`<div class="callout">${icon('info', 20)}<div>${absent.map((o) => o.name).join(', ')} ${absent.length > 1 ? 'have' : 'has'} no open tasks, so nothing needs to move.</div></div>`}

    <h3 class="u-mt">Team load this week, before and after</h3>
    <div class="att-load">
      ${affected.map((id) => {
        const o = getOfficer(s, id);
        const before = util(r.before, id);
        const after = util(r.after, id);
        const away = absent.some((a) => a.id === id);
        return html`<div class="att-load-row">
          <span class="u-row"><span class="account-avatar sm" aria-hidden="true">${initials(o.name)}</span><strong>${o.name}</strong></span>
          <span class="att-load-values">${away ? html`<span class="muted">Away today</span>` : html`<span>${pct(before)}</span><span aria-hidden="true">${icon('arrow', 14)}</span><strong class="${after > 1 ? 'u-bad' : after > before ? '' : 'u-good'}">${pct(after)}</strong>`}</span>
        </div>`;
      })}
    </div>

    ${isManager(s) && r.proposals.length
      ? html`<div class="u-row u-wrap u-mt">
          <button type="button" class="btn-primary" data-action="att-reshuffle-apply">${icon('check', 16)}Approve and apply ${r.proposals.length === 1 ? '1 move' : `${r.proposals.length} moves`}</button>
          <a class="btn-secondary" href="#ripple" data-action="nav-go" data-section="ripple">${icon('sparkle', 16)}See the knock-on effects</a>
        </div>`
      : ''}
  </section>`;
}

export default {
  render(s) {
    const manager = isManager(s);
    const sum = attendanceSummary(s);
    const user = getCurrentUser(s);
    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('users', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Team availability</p>
          <h1>Attendance</h1>
          <p>See who is in, who has not checked in and who is away. SyncAI plans only around people who are available, and moves work when someone is on MC.</p>
        </div>
      </header>

      <ul class="stat-grid" aria-label="Attendance today">
        <li class="stat-card"><span class="stat-icon">${icon('users', 20)}</span><span class="stat-label">Team</span><strong class="stat-value">${sum.total}</strong><span class="stat-hint">Officers on the roster</span></li>
        <li class="stat-card"><span class="stat-icon">${icon('check', 20)}</span><span class="stat-label">Present</span><strong class="stat-value">${sum.present}</strong><span class="stat-hint">Checked in today</span></li>
        <li class="stat-card ${sum.pending ? 'warn' : ''}"><span class="stat-icon">${icon('clock', 20)}</span><span class="stat-label">Not in yet</span><strong class="stat-value">${sum.pending}</strong><span class="stat-hint">Yet to check in</span></li>
        <li class="stat-card ${sum.absent ? 'warn' : ''}"><span class="stat-icon">${icon('alert', 20)}</span><span class="stat-label">Away</span><strong class="stat-value">${sum.absent}</strong><span class="stat-hint">MC, leave or unavailable</span></li>
      </ul>

      ${user.status === 'active' ? '' : html`<div class="callout warn">${icon('alert', 20)}<div>Your account is not active, so attendance is view only.</div></div>`}
      ${roster(s, manager)}
      ${manager ? html`<div class="u-mt">${reshuffle(s)}</div>` : ''}
    `;
  },
};

/** Click handling for this page. Returns true when the click was handled. */
export function handleAttendanceClick(e) {
  const el = e.target.closest('[data-action^="att-"]');
  if (!el) return false;
  const action = el.dataset.action;
  const id = el.dataset.officer;
  const live = getState();
  const manager = isManager(live);
  // Team members can only change their own check in and out. Everything else is for managers.
  const own = id === live.currentOfficerId && (action === 'att-check-in' || action === 'att-check-out');
  if (getCurrentUser(live).status !== 'active' || !(manager || own)) {
    toast('Only a manager can change this.', 'error');
    return true;
  }

  if (action === 'att-check-in') {
    update((s) => checkIn(s, id));
    toast('Checked in.', 'success');
  } else if (action === 'att-check-out') {
    update((s) => checkOut(s, id));
    toast('Checked out.', 'info');
  } else if (action === 'att-absent-mc' || action === 'att-absent-leave') {
    const kind = action === 'att-absent-mc' ? 'mc' : 'leave';
    update((s) => markAbsent(s, id, kind));
    toast(kind === 'mc' ? 'Marked MC. See the reshuffle below.' : 'Marked on leave. See the reshuffle below.', 'info');
  } else if (action === 'att-clear') {
    update((s) => clearAbsence(s, id));
    toast('Marked as back.', 'success');
  } else if (action === 'att-reshuffle-apply') {
    let moved = 0;
    update((s) => {
      moved = applyReshuffle(s, proposeReshuffle(s).proposals);
    });
    toast(moved ? `${moved} task${moved === 1 ? '' : 's'} moved. The change is in the activity log.` : 'Nothing to move.', moved ? 'success' : 'info');
  } else {
    return false;
  }
  return true;
}
