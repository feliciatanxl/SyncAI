// Ripple Intelligence page: see what a disruption knocks over, compare three
// ways to respond, preview each plan, and approve one. Manager only.
//
//   031 dependency chains   · 032 impact cascade   · 035 before / after plan
//   036 three strategies    · 040 plain-language consequences
//
// All the working-out lives in ../rippleBoard.js and the existing engines.

import { SCENARIOS, OPTION_IDS, applyDecision, buildBoard, chainRoots, chainsFor, lastDecision } from '../rippleBoard.js';
import { actorName, getCurrentUser, getState, getTask, initials, isManager, officerName, update } from '../state.js';
import { fmtDue } from '../time.js';
import { html, icon, toast } from '../ui.js';

export const rippleView = { scenarioId: 'lift', optionId: null, exploreId: null };

const LETTER = { none: 'A', reschedule: 'B', reassign: 'C' };
const hours = ['09:00', '11:00', '13:00', '15:00', '17:00'];
const axisLeft = (hhmm) => ((Number(hhmm.slice(0, 2)) * 60 - (8 * 60 + 30)) / 540) * 100;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function selectedOption(board) {
  const wanted = rippleView.optionId || board.options.find((o) => o.recommended)?.id || 'reassign';
  return board.options.find((o) => o.id === wanted) || board.options[0];
}

// ----- 1. scenario -----

function scenarioPicker() {
  return html`<section class="panel" aria-labelledby="rip-what-h">
    <div class="panel-head">
      <div><h2 id="rip-what-h"><span class="rip-step" aria-hidden="true">1</span> What has happened?</h2>
      <p class="muted small">Pick a disruption. SyncAI works out the knock-on effects on a copy, so your real plans do not change.</p></div>
      <span class="tag tag-brand">Explainable AI</span>
    </div>
    <div class="rip-scenarios" role="group" aria-label="Disruptions">
      ${SCENARIOS.map(
        (sc) => html`<button type="button" class="rip-scenario" data-action="rip-scenario" data-scenario="${sc.id}" aria-pressed="${rippleView.scenarioId === sc.id}">
          <span class="stat-icon">${icon(sc.id === 'absent' ? 'users' : 'zap', 16)}</span>
          <span><strong>${sc.label}</strong><span class="meta">${sc.hint}</span></span>
        </button>`,
      )}
    </div>
  </section>`;
}

// ----- 2. cascade (032) -----

function tile(iconName, label, value, hint, warn = false) {
  return html`<li class="stat-card ${warn ? 'warn' : ''}"><span class="stat-icon">${icon(iconName, 20)}</span><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><span class="stat-hint">${hint}</span></li>`;
}

function cascade(s, board) {
  const c = board.cascade;
  const taskLine = (t, extra = '') => html`<li><strong>${t.title}</strong><span class="muted small"> · ${officerName(s, t.ownerId)} · due ${fmtDue(t.due)}</span>${extra}</li>`;
  return html`<section class="panel" aria-labelledby="rip-cascade-h">
    <div class="panel-head"><div><h2 id="rip-cascade-h"><span class="rip-step" aria-hidden="true">2</span> What it knocks over</h2>
    <p class="muted small">${board.incident ? `${board.incident.title}. Needs about ${c.deficitHours} hours of the assigned officer's day.` : 'Everything the absent officers were due to do.'}</p></div></div>
    <ul class="stat-grid" aria-label="Impact summary">
      ${tile('tasks', 'Tasks displaced', c.direct.length, 'Pushed out of today')}
      ${tile('link', 'Knock-on tasks', c.downstream.length, 'Wait on displaced work', c.downstream.length > 0)}
      ${tile('clock', 'SLAs at risk', c.sla.length, 'Service level promises', c.sla.length > 0)}
      ${tile('calendar', 'Appointments', c.appointments.length, 'Fixed visits that may clash', c.appointments.length > 0)}
    </ul>
    <div class="u-grid-2 rip-lists">
      <div>
        <h3>Displaced today</h3>
        ${c.direct.length ? html`<ul class="u-list">${c.direct.map((t) => taskLine(t))}</ul>` : html`<p class="muted">No tasks are displaced.</p>`}
        ${c.downstream.length ? html`<h3 class="u-mt">Knock-on tasks</h3><ul class="u-list">${c.downstream.map((t) => taskLine(t))}</ul>` : ''}
      </div>
      <div>
        <h3>SLAs at risk</h3>
        ${c.sla.length ? html`<ul class="u-list">${c.sla.map((x) => html`<li><strong>${x.title}</strong><span class="muted small"> · ${x.slaType} · due ${x.slaDue}</span></li>`)}</ul>` : html`<p class="muted">No SLA is directly affected.</p>`}
        ${c.appointments.length ? html`<h3 class="u-mt">Appointments that may clash</h3><ul class="u-list">${c.appointments.map((x) => html`<li><strong>${x.title}</strong><span class="muted small"> · ${x.appointmentTime}</span></li>`)}</ul>` : ''}
        ${c.mandatory.length ? html`<h3 class="u-mt">Mandatory deadlines</h3><ul class="u-list">${c.mandatory.map((x) => html`<li><strong>${x.title}</strong><span class="muted small"> · due ${x.deadline}</span></li>`)}</ul>` : ''}
      </div>
    </div>
  </section>`;
}

// ----- 3. chains (031) -----

function chainBlock(s, chain, heading) {
  if (!chain) return '';
  const { root, steps } = chain;
  if (!steps.length) {
    return html`<div class="chain"><h3>${heading}: ${root.title}</h3><p class="muted small">Nothing else waits on this task, so it does not cause a chain reaction.</p></div>`;
  }
  return html`<div class="chain">
    <h3>${heading}: ${root.title}</h3>
    <p class="muted small">${plural(steps.length, 'task')} wait on this, up to ${plural(chain.maxDepth, 'step')} away.${chain.hasCycle ? ' A circular dependency was found and safely stopped.' : ''}</p>
    <ol class="chain-list" aria-label="Dependency chain for ${root.title}">
      <li class="chain-node is-root"><span class="chain-dot" aria-hidden="true"></span><div><strong>${root.title}</strong><span class="muted small"> · ${officerName(s, root.ownerId)} · due ${fmtDue(root.due)}</span><br /><span class="tag tag-danger">Disrupted</span></div></li>
      ${steps.map(
        (st) => html`<li class="chain-node" style="--depth:${st.depth}">
          <span class="chain-dot" aria-hidden="true"></span>
          <div>
            <strong>${st.task.title}</strong><span class="muted small"> · ${officerName(s, st.task.ownerId)} · due ${fmtDue(st.task.due)}</span><br />
            <span class="tag tag-neutral">${plural(st.depth, 'step')} away</span>
            ${st.safety ? html` <span class="tag tag-danger">Safety</span>` : ''}${st.statutory ? html` <span class="tag tag-warning">Mandatory</span>` : ''}
            ${st.slaType ? html` <span class="muted small">${st.slaType}</span>` : ''}
            ${st.consequence ? html`<br /><span class="small">Why it matters: ${st.consequence}</span>` : ''}
          </div>
        </li>`,
      )}
    </ol>
  </div>`;
}

function chains(s, board) {
  const shown = new Set(board.chains.map((c) => c.root.id));
  const roots = chainRoots(s);
  const explore = rippleView.exploreId && getTask(s, rippleView.exploreId) ? chainsFor(s, rippleView.exploreId) : null;
  return html`<section class="panel" aria-labelledby="rip-chain-h">
    <div class="panel-head"><div><h2 id="rip-chain-h"><span class="rip-step" aria-hidden="true">3</span> How the delay spreads</h2>
    <p class="muted small">Each task that waits on a delayed task is delayed too, and so on down the line.</p></div></div>
    ${board.chains.length ? html`<div class="chain-grid">${board.chains.map((c) => chainBlock(s, c, 'If this slips'))}</div>` : html`<p class="muted">No displaced task has others waiting on it.</p>`}
    ${roots.length
      ? html`<h3 class="u-mt">Explore another task</h3>
        <div class="u-row u-wrap" role="group" aria-label="Explore a task's dependency chain">
          ${roots.map((id) => html`<button type="button" class="btn-sm ${rippleView.exploreId === id ? 'btn-primary' : 'btn-secondary'}" data-action="rip-explore" data-task="${id}">${getTask(s, id).title.slice(0, 44)}${shown.has(id) ? ' (above)' : ''}</button>`)}
        </div>
        ${explore ? html`<div class="u-mt">${chainBlock(s, explore, 'If this slips')}</div>` : ''}`
      : ''}
  </section>`;
}

// ----- 4. options (036) -----

function optionCards(board) {
  const picked = selectedOption(board).id;
  return html`<section class="panel" aria-labelledby="rip-opt-h">
    <div class="panel-head"><div><h2 id="rip-opt-h"><span class="rip-step" aria-hidden="true">4</span> Three ways to respond</h2>
    <p class="muted small">Numbers count tasks that become high risk because of this disruption. Work that was already behind is not counted.</p></div></div>
    ${board.recommendation.escalationRequired ? html`<div class="callout warn">${icon('alert', 20)}<div><strong>Needs a manager</strong><br />${board.recommendation.escalationWarning}</div></div>` : ''}
    <div class="alternatives-grid" role="group" aria-label="Options">
      ${board.options.map((o) => {
        const m = o.m;
        const stat = (label, n) => html`<span class="alt-stat"><span>${label}</span><strong>${n}</strong></span>`;
        return html`<button type="button" class="alt-card rip-alt ${o.id === picked ? 'selected' : ''} ${o.id === 'none' ? 'is-baseline' : ''}" data-action="rip-option" data-option="${o.id}" aria-pressed="${o.id === picked}">
          <span class="rip-alt-head"><span class="alt-letter">${LETTER[o.id]}</span>${o.recommended ? html`<span class="tag tag-brand">Recommended</span>` : ''}<span class="badge ${o.badge}">${o.status}</span></span>
          <strong>${o.label}</strong>
          <span class="small muted">${o.summary}</span>
          <span class="alt-stats">
            ${stat('New high-risk tasks', m.newRisk.length)}${stat('SLAs missed', m.sla.length)}${stat('Appointments at risk', m.appointments.length)}${stat('Mandatory deadlines', m.mandatory.length)}${stat('Tasks moved', o.moves.length)}
          </span>
        </button>`;
      })}
    </div>
  </section>`;
}

// ----- 5. before / after (035) -----

function timeline(plan, { compare } = {}) {
  const diff = (bar) => (compare && bar.kind !== 'meeting' && !compare.has(`${bar.title}|${bar.start}`) ? 'is-new' : '');
  return html`<div class="rip-row">
    <div class="rip-who"><span class="account-avatar sm" aria-hidden="true">${initials(plan.officer.name)}</span><span><strong>${plan.officer.name}</strong><br /><span class="muted small">${plan.officer.zone}</span></span></div>
    <div class="rip-track ${plan.away ? 'is-away' : ''}" role="img" aria-label="${plan.officer.name}: ${plan.away ? 'away today' : plan.blocks.map((b) => `${b.start} to ${b.end} ${b.title}`).join('; ')}">
      ${hours.map((h) => html`<i class="rip-tick" style="left:${axisLeft(h)}%" aria-hidden="true"></i>`)}
      ${plan.away ? html`<span class="rip-away">Away today</span>` : ''}
      ${plan.blocks.map(
        (b) => html`<span class="rip-bar rip-${b.kind} ${b.late ? 'is-late' : ''} ${diff(b)}" style="left:${b.left}%;width:${b.width}%" title="${b.start}–${b.end} · ${b.title}${b.late ? ' · will finish late' : ''}">${b.title}</span>`,
      )}
    </div>
    ${plan.late.length || plan.unscheduled.length ? html`<p class="small rip-warn">${icon('alert', 12)} Won't finish on time: ${[...new Set([...plan.late, ...plan.unscheduled])].slice(0, 3).join(', ')}${new Set([...plan.late, ...plan.unscheduled]).size > 3 ? '…' : ''}</p>` : ''}
  </div>`;
}

const axis = () => html`<div class="rip-axis" aria-hidden="true">${hours.map((h) => html`<i style="left:${axisLeft(h)}%">${h}</i>`)}</div>`;

function beforeAfter(board) {
  const opt = selectedOption(board);
  const before = board.plans.before;
  const after = board.plans[opt.id];
  const beforeKeys = new Set(before.flatMap((p) => p.blocks.map((b) => `${b.title}|${b.start}`)));
  return html`<section class="panel" aria-labelledby="rip-plan-h">
    <div class="panel-head"><div><h2 id="rip-plan-h"><span class="rip-step" aria-hidden="true">5</span> Today's plan, before and after</h2>
    <p class="muted small">Showing option ${LETTER[opt.id]}: ${opt.label}. Pick another option above to compare. Highlighted bars are new or moved.</p></div></div>
    <div class="u-row u-wrap rip-tabs" role="group" aria-label="Choose which option to preview">
      ${OPTION_IDS.map((id) => html`<button type="button" class="btn-sm ${id === opt.id ? 'btn-primary' : 'btn-secondary'}" data-action="rip-option" data-option="${id}" aria-pressed="${id === opt.id}">${LETTER[id]}. ${board.options.find((o) => o.id === id).label}</button>`)}
    </div>
    <div class="u-grid-2 rip-compare">
      <div><h3>Before the disruption</h3>${axis()}${before.map((p) => timeline(p))}</div>
      <div><h3>After: ${opt.label}</h3>${axis()}${after.map((p) => timeline(p, { compare: beforeKeys }))}</div>
    </div>
    <ul class="rip-legend small" aria-label="Legend">
      <li><i class="rip-key rip-task"></i>Task</li><li><i class="rip-key rip-safety"></i>Safety</li><li><i class="rip-key rip-mandatory"></i>Mandatory</li>
      <li><i class="rip-key rip-incident"></i>Urgent incident</li><li><i class="rip-key rip-meeting"></i>Meeting</li><li><i class="rip-key rip-task is-late"></i>Finishes late</li>
    </ul>
  </section>`;
}

// ----- 6. explanation (040) + decision -----

function explanation(board) {
  const opt = selectedOption(board);
  const ex = opt.explain;
  return html`<section class="panel" aria-labelledby="rip-why-h">
    <div class="panel-head"><div><h2 id="rip-why-h"><span class="rip-step" aria-hidden="true">6</span> What this means, in plain words</h2>
    <p class="muted small">Option ${LETTER[opt.id]}: ${opt.label}</p></div></div>
    <p class="rip-headline">${ex.headline}</p>
    <ul class="u-list">${ex.what.map((w) => html`<li><span>${w}</span></li>`)}</ul>
    ${ex.who.length ? html`<h3 class="u-mt">Who is affected</h3><ul class="u-list">${ex.who.map((w) => html`<li><span>${w}</span></li>`)}</ul>` : ''}
    ${ex.stake.length ? html`<h3 class="u-mt">Why it matters</h3><ul class="u-list">${ex.stake.map((w) => html`<li><span>${w}</span></li>`)}</ul>` : ''}
    <div class="callout u-mt">${icon('sparkles', 20)}<div>
      <strong>Why SyncAI suggests ${board.recommendation.preferredAlternative ? `option ${LETTER[board.recommendation.preferredId]}` : 'a manager decision'}</strong><br />
      ${board.recommendation.rationale}
      <br /><span class="muted small">SyncAI always checks safety first, then mandatory deadlines, then service to residents, then how urgent the concern really is.</span>
    </div></div>
    <details class="u-mt"><summary>How this was worked out</summary>
      <ul class="u-list">${board.assumptions.map((a) => html`<li><span>${a}</span></li>`)}</ul>
    </details>
  </section>`;
}

function decision(s, board) {
  const opt = selectedOption(board);
  const manager = isManager(s) && getCurrentUser(s).status === 'active';
  return html`<section class="panel rip-decision" aria-labelledby="rip-dec-h">
    <h2 id="rip-dec-h"><span class="rip-step" aria-hidden="true">7</span> Your decision</h2>
    ${opt.id === 'none'
      ? html`<p class="muted">Choosing no action changes nothing. Select option B or C above if you want to apply a plan.</p>`
      : html`<p>Approve <strong>${LETTER[opt.id]}: ${opt.label}</strong> to apply ${plural(opt.moves.length, 'change')}${board.scenario.incident ? ' and add the urgent incident to the plan' : ''}. The decision is saved in the activity log.</p>`}
    <div class="u-row u-wrap">
      <button type="button" class="btn-primary" data-action="rip-approve" data-option="${opt.id}" ${manager && opt.id !== 'none' ? '' : 'disabled'}>${icon('check', 16)}Approve and apply</button>
      ${manager ? '' : html`<span class="muted small">Only an active manager can approve.</span>`}
    </div>
  </section>`;
}

function recap(s, board, done) {
  return html`<section class="panel" aria-labelledby="rip-done-h">
    <div class="callout">${icon('check', 20)}<div>
      <h2 id="rip-done-h" style="font-size:1.0625rem;margin:0 0 4px">Decision recorded</h2>
      <strong>${done.optionLabel}</strong> for ${done.label}. ${done.changed} change${done.changed === 1 ? ' was' : 's were'} applied by ${done.by}.<br />
      ${done.summary}<br />
      <span class="muted small">It is in the Activity log. To run this scenario again, use Reset demo data in Settings.</span>
    </div></div>
  </section>`;
}

// ----- page -----

export default {
  render(s) {
    const board = buildBoard(s, rippleView.scenarioId);
    const done = lastDecision(s, rippleView.scenarioId);
    return html`
      <header class="page-hero">
        <span class="page-hero-icon" aria-hidden="true">${icon('radar', 28)}</span>
        <div class="page-hero-text">
          <p class="page-hero-eyebrow">Operationally aware AI scheduling</p>
          <h1>Ripple Intelligence</h1>
          <p>When something urgent happens, see what it knocks over, compare your options as a real day plan, and approve the best one before anything changes.</p>
        </div>
      </header>
      ${scenarioPicker()}
      ${done
        ? html`<div class="u-mt">${recap(s, board, done)}</div>`
        : board.empty
        ? html`<section class="panel u-mt"><div class="callout">${icon('info', 20)}<div><strong>Nobody is marked absent today.</strong><br />Mark an officer as MC on the <button type="button" class="btn-subtle btn-sm" data-action="nav-go" data-section="attendance">Attendance page</button>, then come back to see the knock-on effects.</div></div></section>`
        : html`<div class="u-stack u-mt">${cascade(s, board)}${chains(s, board)}${optionCards(board)}${beforeAfter(board)}${explanation(board)}${decision(s, board)}</div>`}
    `;
  },
};

/** Click handling for this page. Returns true when the click was handled. */
export function handleRippleClick(e) {
  const el = e.target.closest('[data-action^="rip-"]');
  if (!el) return false;
  const action = el.dataset.action;
  if (action === 'rip-scenario') {
    rippleView.scenarioId = el.dataset.scenario;
    rippleView.optionId = null;
    update(() => {});
  } else if (action === 'rip-option') {
    rippleView.optionId = el.dataset.option;
    update(() => {});
  } else if (action === 'rip-explore') {
    rippleView.exploreId = rippleView.exploreId === el.dataset.task ? null : el.dataset.task;
    update(() => {});
  } else if (action === 'rip-approve') {
    const live = getState();
    if (!isManager(live) || getCurrentUser(live).status !== 'active') {
      toast('Only an active manager can approve this.', 'error');
      return true;
    }
    let changed = 0;
    update((s) => {
      changed = applyDecision(s, rippleView.scenarioId, el.dataset.option, actorName(s));
    });
    toast(changed ? `Approved. ${changed} change${changed === 1 ? '' : 's'} applied.` : 'Nothing to apply for that option.', changed ? 'success' : 'info');
  } else {
    return false;
  }
  return true;
}
