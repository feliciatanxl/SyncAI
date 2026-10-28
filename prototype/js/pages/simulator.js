import { CATEGORIES } from '../data.js';
import { INCIDENTS, commitSimulation, runSimulation } from '../simulation.js';
import { getState, getTask, logActivity, officerName, replaceState, bumpRev, remainingHours } from '../state.js';
import { assessRisk } from '../planner.js';
import { NOW, fmtDue, fmtHours } from '../time.js';
import { html, icon, avatar, meter, pct, emptyState, toast, confirmDialog, capacityBadge, priorityBadge } from '../ui.js';
import { ctx } from '../ctx.js';

const DEFAULT_EXTRA = { title: 'Prepare briefing pack for Town Council audit', category: 'Admin', effort: 4, dueDays: 1, assignee: 'auto' };

const view = {
  form: { absent: [], absenceType: 'mc', absenceDays: 1, incident: '', incidentAssignee: 'auto', extraOn: false, extra: { ...DEFAULT_EXTRA } },
  result: null,
  baseRev: null,
  accepted: new Set(),
  loading: false,
};

const PRESETS = {
  mc: { label: 'Officer on MC', icon: 'user', form: { absent: ['o4'], absenceType: 'mc', absenceDays: 2, incident: '', extraOn: false } },
  incident: { label: 'Urgent lift breakdown', icon: 'zap', form: { absent: [], incident: 'lift', incidentAssignee: 'auto', extraOn: false } },
  extra: { label: 'Extra high-priority assignment', icon: 'plus', form: { absent: [], incident: '', extraOn: true, extra: { ...DEFAULT_EXTRA, assignee: 'o1' } } },
  multi: { label: 'Two officers unavailable', icon: 'users', form: { absent: ['o2', 'o4'], absenceType: 'leave', absenceDays: 1, incident: '', extraOn: false } },
};

function scenarioForm(s) {
  const f = view.form;
  const officerOpts = (sel, withAuto = true) => html`${withAuto ? html`<option value="auto" ${sel === 'auto' ? 'selected' : ''}>Let SyncAI choose best fit</option>` : ''}${s.officers.map((o) => html`<option value="${o.id}" ${sel === o.id ? 'selected' : ''}>${o.name}</option>`)}`;
  return html`<form id="sim-form" data-submit="sim-run" data-change="sim-field" novalidate class="stack">
    <div>
      <span class="label small" style="font-weight:600">Quick scenarios</span>
      <div class="row wrap mt-sm">${Object.entries(PRESETS).map(([k, p]) => html`<button type="button" class="chip" data-action="sim-preset" data-preset="${k}">${icon(p.icon, 14)}${p.label}</button>`)}</div>
    </div>

    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend class="label" style="font-weight:600;font-size:12.5px;margin-bottom:6px">${icon('user', 14)} Unavailable officers</legend>
      <div class="dep-list" style="max-height:none">
        ${s.officers.map((o) => html`<label class="check"><input type="checkbox" name="absent" value="${o.id}" ${f.absent.includes(o.id) ? 'checked' : ''} />${o.name} <span class="muted small">· ${o.title}</span></label>`)}
      </div>
      <div class="form-grid mt-sm">
        <div class="field"><label for="sim-type">Reason</label><select class="select" id="sim-type" name="absenceType">
          <option value="mc" ${f.absenceType === 'mc' ? 'selected' : ''}>Medical leave (MC)</option>
          <option value="leave" ${f.absenceType === 'leave' ? 'selected' : ''}>Annual / urgent leave</option>
        </select><span class="hint">Medical details are never recorded.</span></div>
        <div class="field"><label for="sim-days">Duration</label><select class="select" id="sim-days" name="absenceDays">
          ${[1, 2, 3, 5].map((n) => html`<option value="${n}" ${f.absenceDays === n ? 'selected' : ''}>${n} working day${n > 1 ? 's' : ''}</option>`)}
        </select></div>
      </div>
    </fieldset>

    <div class="form-grid">
      <div class="field"><label for="sim-inc">${icon('zap', 14)} Urgent incident</label><select class="select" id="sim-inc" name="incident">
        <option value="">None</option>${INCIDENTS.map((i) => html`<option value="${i.id}" ${f.incident === i.id ? 'selected' : ''}>${i.label} (${fmtHours(i.effort)})</option>`)}
      </select></div>
      <div class="field"><label for="sim-inc-who">Incident assigned to</label><select class="select" id="sim-inc-who" name="incidentAssignee" ${f.incident ? '' : 'disabled'}>${officerOpts(f.incidentAssignee)}</select></div>
    </div>

    <div class="stack" style="gap:10px">
      <label class="check"><input type="checkbox" name="extraOn" ${f.extraOn ? 'checked' : ''} /><strong>${icon('plus', 14)} Additional high-priority assignment</strong></label>
      ${f.extraOn
        ? html`<div class="form-grid">
            <div class="field full" data-field="extra-title"><label for="sim-x-title">Title</label><input class="input" id="sim-x-title" name="extraTitle" value="${f.extra.title}" maxlength="100" /><span class="error-text" id="e-extra-title"></span></div>
            <div class="field"><label for="sim-x-cat">Category</label><select class="select" id="sim-x-cat" name="extraCategory">${CATEGORIES.map((c) => html`<option ${c === f.extra.category ? 'selected' : ''}>${c}</option>`)}</select></div>
            <div class="field" data-field="extra-effort"><label for="sim-x-eff">Effort (hours)</label><input class="input" type="number" min="0.5" max="16" step="0.5" id="sim-x-eff" name="extraEffort" value="${f.extra.effort}" /><span class="error-text" id="e-extra-effort"></span></div>
            <div class="field"><label for="sim-x-due">Due</label><select class="select" id="sim-x-due" name="extraDue">${[[0, 'Today'], [1, 'Tomorrow'], [2, 'In 2 working days'], [4, 'End of week']].map(([v, l]) => html`<option value="${v}" ${f.extra.dueDays === v ? 'selected' : ''}>${l}</option>`)}</select></div>
            <div class="field"><label for="sim-x-who">Assign to</label><select class="select" id="sim-x-who" name="extraAssignee">${officerOpts(f.extra.assignee)}</select></div>
          </div>`
        : ''}
    </div>

    <div class="row wrap">
      <button type="submit" class="btn btn-ai btn-lg">${icon('flask', 16)}Run simulation</button>
      <button type="button" class="btn btn-subtle" data-action="sim-reset">${icon('reset', 16)}Reset</button>
    </div>
  </form>`;
}

function readForm(form) {
  const fd = new FormData(form);
  const f = view.form;
  f.absent = fd.getAll('absent').map(String);
  f.absenceType = String(fd.get('absenceType') || 'mc');
  f.absenceDays = Number(fd.get('absenceDays') || 1);
  f.incident = String(fd.get('incident') || '');
  f.incidentAssignee = String(fd.get('incidentAssignee') || 'auto');
  const wasOn = f.extraOn;
  f.extraOn = fd.get('extraOn') === 'on';
  if (wasOn && f.extraOn) {
    f.extra = {
      title: String(fd.get('extraTitle') || ''),
      category: String(fd.get('extraCategory') || 'Admin'),
      effort: Number(fd.get('extraEffort')),
      dueDays: Number(fd.get('extraDue') || 0),
      assignee: String(fd.get('extraAssignee') || 'auto'),
    };
  }
  return wasOn !== f.extraOn;
}

function metricRow(label, a, b, c, fmt = (v) => v, lowerIsBetter = true) {
  const cls = (from, to) => (to === from || lowerIsBetter == null ? '' : (to < from) === lowerIsBetter ? 'delta-good' : 'delta-bad');
  return { label, a: fmt(a), b: fmt(b), c: fmt(c), bc: cls(a, b), cc: cls(a, c) };
}

function results(s) {
  if (view.loading) {
    return html`<section class="card"><div class="loading-card" aria-busy="true"><span class="ai-label">${icon('sparkles', 16)}Re-planning every officer's week…</span>${[90, 70, 85, 60].map((w) => html`<div class="skeleton" style="width:${w}%"></div>`)}</div></section>`;
  }
  const r = view.result;
  if (!r) {
    return html`<section class="card">${emptyState('flask', 'No simulation yet', 'Pick a quick scenario or build your own, then run it. The live schedule stays unchanged until you apply the result.')}</section>`;
  }
  const rows = [
    metricRow('Average utilisation', r.before.avgUtil, r.afterNoAction.avgUtil, r.after.avgUtil, pct, null),
    metricRow('Overloaded officers', r.before.overloaded, r.afterNoAction.overloaded, r.after.overloaded),
    metricRow('Unavailable officers', r.before.unavailable, r.afterNoAction.unavailable, r.after.unavailable, undefined, null),
    metricRow('High-risk deadlines', r.before.highRisk.length, r.afterNoAction.highRisk.length, r.after.highRisk.length),
    metricRow('Tasks that miss deadlines', r.before.missing, r.afterNoAction.missing, r.after.missing),
  ];
  const newRisks = r.afterNoAction.highRisk.filter((id) => !r.before.highRisk.includes(id));
  const resolved = newRisks.filter((id) => !r.after.highRisk.includes(id));
  const stale = getState().rev !== view.baseRev;
  const sim = r.sim;

  return html`<div class="stack">
    <section class="card ai-card" aria-labelledby="sr-h">
      <div class="card-head"><h2 id="sr-h"><span class="ai-label">${icon('sparkles', 16)}Simulation result</span></h2><span class="badge badge-warning">Preview — not applied</span></div>
      <div class="card-body">
        <ul class="reasons">${r.notes.map((n) => html`<li><span>${n}</span></li>`)}</ul>
        <p class="ai-headline">${newRisks.length
          ? `Without action, ${newRisks.length} more deadline${newRisks.length > 1 ? 's' : ''} become high-risk. SyncAI's ${r.recs.length} suggested reassignment${r.recs.length === 1 ? '' : 's'} would resolve ${resolved.length} of them.`
          : `This scenario adds no new high-risk deadlines.${r.recs.length ? ` SyncAI still suggests ${r.recs.length} reassignment${r.recs.length > 1 ? 's' : ''} to rebalance work.` : ''}`}</p>
        <div class="compare">
          ${[['Before', 'a', ''], ['After — no action', 'b', 'bc'], ['After — with SyncAI actions', 'c', 'cc']].map(
            ([title, k, ck], i) => html`<div class="compare-col ${i === 2 ? 'after' : ''}"><h4>${title}</h4>
              ${rows.map((m) => html`<div class="kv"><span>${m.label}</span><b class="${ck ? m[ck] : ''}">${m[k]}</b></div>`)}
            </div>`,
          )}
        </div>
      </div>
    </section>

    <section class="card" aria-labelledby="ob-h">
      <div class="card-head"><h2 id="ob-h">Officer capacity this week <span class="sub">top bar: before · bottom bar: after SyncAI actions</span></h2></div>
      <div class="card-body officer-bars">
        ${r.before.team.map((b) => {
          const a = r.after.team.find((x) => x.id === b.id);
          return html`<div class="officer-bar">
            <span class="row">${avatar(b.name, 'sm')}${b.name}</span>
            <div class="dual">${meter(b.weekUtil, { label: `${b.name} before` })}${a.status.id === 'away' && a.weekUtil == null ? html`<span class="small muted">Away all week</span>` : meter(a.weekUtil, { label: `${b.name} after` })}</div>
            <span class="row small">${pct(b.weekUtil)} → <strong>${pct(a.weekUtil)}</strong> ${a.status.id !== b.status.id ? capacityBadge(a.status) : ''}</span>
          </div>`;
        })}
      </div>
    </section>

    <section class="card" aria-labelledby="rr-h">
      <div class="card-head"><h2 id="rr-h">Tasks requiring reassignment <span class="sub">untick any you don't want to apply</span></h2></div>
      <div class="card-body">
        ${r.recs.length
          ? r.recs.map((rec) => {
              const t = getTask(sim, rec.taskId);
              return html`<label class="rec" style="cursor:pointer">
                <span class="rec-head">
                  <input type="checkbox" data-change="sim-rec" value="${rec.id}" ${view.accepted.has(rec.id) ? 'checked' : ''} aria-label="Apply reassignment of ${t.title}" style="width:18px;height:18px;margin-top:4px" />
                  <span class="grow"><span class="rec-title">${t.title}</span>
                    <span class="meta"><span>${officerName(sim, rec.fromId)}</span>${icon('arrow', 12)}<strong>${officerName(sim, rec.toId)}</strong><span>· ${fmtHours(t.effort)}</span>${rec.alternatives.length ? html`<span>· Alternatives: ${rec.alternatives.join(', ')}</span>` : ''}</span></span>
                  <span class="badge badge-ai">Fit ${rec.fit}</span>
                </span>
                <span class="why">${icon('info', 14)}<span>${rec.why} → ${rec.reasons.join(', ')}.</span></span>
              </label>`;
            })
          : html`<p class="notice notice-success">${icon('check', 16)}No reassignments needed — remaining officers can absorb the change.</p>`}
      </div>
    </section>

    ${stillRisky(r)}

    <section class="card" aria-labelledby="mv-h">
      <div class="card-head"><h2 id="mv-h">Schedule changes <span class="sub">${r.moved.length} task${r.moved.length === 1 ? '' : 's'} move</span></h2></div>
      <div class="card-body flush table-wrap">
        ${r.moved.length
          ? html`<table class="table"><thead><tr><th>Task</th><th>Owner</th><th>Planned start</th><th class="hide-sm">Deadline</th></tr></thead><tbody>
              ${r.moved.map(
                (m) => html`<tr>
                  <td><strong>${m.title}</strong></td>
                  <td>${m.fromOwner !== m.toOwner ? html`${officerName(sim, m.fromOwner)} → <strong>${officerName(sim, m.toOwner)}</strong>` : officerName(sim, m.toOwner)}</td>
                  <td>${m.from} → <strong class="${m.late ? 'delta-bad' : ''}">${m.to}</strong></td>
                  <td class="hide-sm">${m.due}</td>
                </tr>`,
              )}
            </tbody></table>`
          : html`<p class="muted" style="padding:12px 18px">No planned work moves.</p>`}
      </div>
    </section>

    <section class="card" aria-labelledby="ap-h">
      <div class="card-body stack">
        ${stale ? html`<p class="notice notice-warning">${icon('alert', 16)}<span class="grow">The live data changed after this simulation ran. Re-run it before applying.</span></p>` : ''}
        <p class="notice notice-info">${icon('shield', 16)}<span class="grow">Applying updates availability, adds new tasks and reassigns the ${view.accepted.size} selected task${view.accepted.size === 1 ? '' : 's'}. Officers would be notified in Teams and their calendars would only change after they accept new plans (simulated).</span></p>
        <div class="row wrap">
          <button class="btn btn-primary btn-lg" data-action="sim-apply" ${stale ? 'disabled' : ''}>${icon('check', 16)}Apply to live schedule</button>
          <button class="btn btn-lg" data-action="sim-discard">Discard simulation</button>
        </div>
      </div>
    </section>
  </div>`;
}

/** High-risk work that no reassignment could fix — needs a human decision. */
function stillRisky(r) {
  const st = r.afterState;
  const items = r.after.highRisk.map((id) => getTask(st, id)).filter(Boolean);
  if (!items.length) return '';
  return html`<section class="card" aria-labelledby="sk-h">
    <div class="card-head"><h2 id="sk-h">${icon('alert', 16)}Still at risk after SyncAI actions <span class="sub">needs a supervisor decision</span></h2></div>
    <div class="card-body flush"><ul class="list">
      ${items.map((t) => {
        const risk = assessRisk(st, t);
        return html`<li class="list-item" style="align-items:flex-start"><span class="stat-icon danger">${icon('alert', 14)}</span><div class="grow">
          <strong>${t.title}</strong>
          <div class="meta"><span>${officerName(st, t.ownerId)}</span><span>Due ${fmtDue(t.due)}</span><span>${fmtHours(remainingHours(t))} left</span>${priorityBadge(t.priority)}</div>
          <p class="why mt-sm">${icon('info', 12)}<span>${risk.reasons[0]} ${t.due < NOW ? 'Agree a new completion date and record why it slipped.' : 'No available officer can absorb it on time.'}</span></p>
          <p class="small muted mt-sm">Options: extend the deadline with the resident or contractor, activate the term contractor / standby team, or approve overtime.</p>
        </div></li>`;
      })}
    </ul></div>
  </section>`;
}

function renderPage(s) {
  return html`
    <div class="page-head">
      <div><h1>What-If Simulator</h1><p>Preview the impact of absences and urgent work before changing anyone's schedule.</p></div>
      <span class="badge badge-neutral">${icon('lock', 12)}Baseline protected until you apply</span>
    </div>
    <div class="grid grid-sim">
      <section class="card" aria-labelledby="sc-h">
        <div class="card-head"><h2 id="sc-h">Scenario</h2></div>
        <div class="card-body">${scenarioForm(s)}</div>
      </section>
      <div id="sim-results">${results(s)}</div>
    </div>`;
}

function run() {
  const form = document.getElementById('sim-form');
  if (form) readForm(form);
  const f = view.form;
  if (f.extraOn) {
    const bad = [];
    if (f.extra.title.trim().length < 3) bad.push(['extra-title', 'Enter a title.']);
    if (!(f.extra.effort >= 0.5 && f.extra.effort <= 16)) bad.push(['extra-effort', 'Between 0.5 and 16 hours.']);
    form.querySelectorAll('[data-field^="extra"]').forEach((el) => el.classList.remove('invalid'));
    form.querySelectorAll('[id^="e-extra"]').forEach((el) => (el.textContent = ''));
    if (bad.length) {
      bad.forEach(([k, m]) => {
        form.querySelector(`[data-field="${k}"]`).classList.add('invalid');
        form.querySelector(`#e-${k}`).textContent = m;
      });
      return;
    }
  }
  if (!f.absent.length && !f.incident && !f.extraOn) {
    toast('Choose at least one change: an absence, an incident or an extra assignment.', 'error');
    return;
  }
  view.loading = true;
  ctx.rerender();
  setTimeout(() => {
    const s = getState();
    try {
      view.result = runSimulation(s, {
        absent: f.absent,
        absenceType: f.absenceType,
        absenceDays: f.absenceDays,
        incident: f.incident || null,
        incidentAssignee: f.incidentAssignee,
        extra: f.extraOn ? { ...f.extra, title: f.extra.title.trim() } : null,
      });
      view.baseRev = s.rev;
      view.accepted = new Set(view.result.recs.map((r) => r.id));
    } catch (err) {
      console.error(err);
      toast('The simulation could not be completed. Try a different scenario.', 'error');
      view.result = null;
    }
    view.loading = false;
    ctx.rerender();
    document.getElementById('sr-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 650);
}

export default {
  id: 'simulator',
  title: 'What-If Simulator',
  icon: 'flask',
  roles: ['supervisor'],
  render: renderPage,
  mount: () => {
    if (ctx.pending?.simulate) {
      Object.assign(view.form, { absent: ctx.pending.simulate.absent, absenceType: 'mc', absenceDays: 1, incident: '', extraOn: false });
      ctx.pending = null;
      run();
    }
  },
  actions: {
    'sim-preset': (el) => {
      const p = PRESETS[el.dataset.preset];
      view.form = { ...view.form, absenceType: 'mc', absenceDays: 1, incidentAssignee: 'auto', extra: { ...DEFAULT_EXTRA }, ...structuredClone(p.form) };
      ctx.rerender();
      run();
    },
    'sim-reset': () => {
      view.form = { absent: [], absenceType: 'mc', absenceDays: 1, incident: '', incidentAssignee: 'auto', extraOn: false, extra: { ...DEFAULT_EXTRA } };
      view.result = null;
      ctx.rerender();
    },
    'sim-discard': () => {
      view.result = null;
      ctx.rerender();
      toast('Simulation discarded. Nothing was changed.', 'info');
    },
    'sim-apply': async () => {
      const r = view.result;
      if (!r) return;
      if (getState().rev !== view.baseRev) return toast('Live data changed — re-run the simulation first.', 'error');
      const ok = await confirmDialog({
        title: 'Apply this scenario to the live schedule?',
        body: `${r.notes.join(' ')} ${view.accepted.size} reassignment(s) will be applied.`,
        confirmLabel: 'Apply changes',
      });
      if (!ok) return;
      const { next, applied } = commitSimulation(r, [...view.accepted]);
      logActivity(next, `Applied what-if scenario: ${r.notes.join(' ')} ${applied.length} reassignment(s) approved.`);
      bumpRev(next);
      view.result = null;
      replaceState(next);
      toast(`Scenario applied with ${applied.length} reassignment(s).`);
    },
  },
  changes: {
    'sim-field': (el) => {
      if (el.dataset.change === 'sim-rec') return;
      const form = document.getElementById('sim-form');
      const toggled = readForm(form);
      const incWho = form.querySelector('[name="incidentAssignee"]');
      if (incWho) incWho.disabled = !view.form.incident;
      if (toggled) ctx.rerender();
    },
    'sim-rec': (el) => {
      if (el.checked) view.accepted.add(el.value);
      else view.accepted.delete(el.value);
      ctx.rerender();
    },
  },
};
