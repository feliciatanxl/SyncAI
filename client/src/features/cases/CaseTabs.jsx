// The case dialog's section tabs, ported from the prototype (prototype/js/pages/cases.js, renderJourney*Tab).
// Layout and wording follow the prototype; buttons only appear where the client has a real action behind them.
import { useState } from 'react'
import './caseTabs.css'
import { MessageBar, MessageBarBody } from '@fluentui/react-components'
import {
  Add12Regular, ArrowRight16Regular, Chat12Regular, Checkmark12Regular, Checkmark16Regular, Clock12Regular, Clock16Regular, Copy16Regular,
  Edit16Regular, Folder16Regular, Info16Regular, TextBulletListLtr16Regular, People16Regular, PersonAdd16Regular, Sparkle12Regular,
  TableSimple16Regular, TargetArrow16Regular, Warning12Regular, Warning16Regular,
} from '@fluentui/react-icons'
import { useLocale } from '../../lib/i18n.js'
import { caseBrief, caseStage, closureReadiness, detectFollowUps } from './caseLogic.js'
import { Countdown, fmtDate } from './CaseViews.jsx'
import { explainFinding } from './followUpExplain.js'

// Shared submit handling for the small forms: busy flag, error message, reset on success.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export const ErrorBar = ({ error }) => error && <MessageBar intent="error" className="case-form-error"><MessageBarBody>{error}</MessageBarBody></MessageBar>
const byNewest = (list) => [...(list ?? [])].sort((a, b) => new Date(b.at) - new Date(a.at))
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {})

const NOTE_CATEGORIES = ['Inspection Update', 'Resident Contact', 'Contractor Follow-up', 'Site Observation', 'Repair Progress']

export function TimelineTab({ kase, actions }) {
  const locale = useLocale()
  const [category, setCategory] = useState(NOTE_CATEGORIES[0])
  const [text, setText] = useState('')
  const { busy, error, run } = useAction()
  const events = byNewest(kase.timeline)
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => actions.addNote(kase.id, `${category}: ${text.trim()}`))) setText('')
  }
  return (
    <div className="pt-stack">
      <div className="pt-box">
        <div className="pt-row pt-mb8">
          <strong className="pt-title-sm"><Edit16Regular /> Add Operational Progress Note</strong>
          <span className="small muted">Updates case timeline &amp; shared audit state</span>
        </div>
        <form className="pt-form" onSubmit={submit}>
          <select className="pt-input pt-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Note category">
            {NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea className="pt-input" rows={2} required value={text} onChange={(e) => setText(e.target.value)} aria-label="Progress note"
            placeholder="Record progress note (e.g. resident access confirmed, repair completed, water tested)..." />
          <div className="pt-actions-end">
            <button type="submit" className="pt-btn pt-primary" disabled={busy || !text.trim()}><Add12Regular /> Add Note to Timeline</button>
          </div>
          <ErrorBar error={error} />
        </form>
      </div>
      <div className="pt-row">
        <p className="small muted pt-m0">Chronological history of inspections, resident contacts, and contractor updates.</p>
        <span className="small muted">{plural(events.length, 'recorded event')}</span>
      </div>
      {events.length === 0 ? (
        <div className="pt-empty-dashed"><p className="muted pt-m0">No case updates have been recorded yet.</p></div>
      ) : (
        <div className="pt-timeline">
          {events.map((ev) => (
            <div key={ev.id} className="pt-event">
              <span className="pt-dot" aria-hidden="true" />
              <div className="pt-row pt-baseline">
                <strong className="pt-fs14">{ev.title}</strong>
                <span className="small muted">{fmtDate(ev.at, locale)}</span>
              </div>
              {ev.summary && <p className="small pt-fg2 pt-mt4">{ev.summary}</p>}
              <span className="small muted pt-fs12">Source: {ev.source || 'SyncAI'} · Officer: {ev.actor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function BlockersTab({ kase }) {
  const locale = useLocale()
  const blockers = kase.blockers ?? []
  return (
    <div className="pt-stack">
      <div className="pt-row">
        <p className="small muted pt-m0">External blockers preventing case resolution (e.g. resident access, contractor quotes).</p>
        <span className="small muted">{blockers.filter((b) => !b.resolved).length} active blocker(s)</span>
      </div>
      {blockers.length === 0 ? (
        <div className="pt-callout-ok">
          <strong>No active blockers recorded.</strong>
          <p className="small">This case is flowing through operational milestones without external hold-ups.</p>
        </div>
      ) : blockers.map((b) => (
        <div key={b.id} className={`pt-card pt-edge ${b.resolved ? 'pt-edge-ok' : 'pt-edge-bad'}`}>
          <div className="pt-row">
            <strong className="pt-fs15">{b.title}</strong>
            <span className={`pt-tag ${b.resolved ? 'pt-tag-ok' : 'pt-tag-bad'}`}>{b.resolved ? 'Resolved' : 'Active Blocker'}</span>
          </div>
          <div className="small muted">
            <strong>Recorded:</strong> {b.recordedAt ? fmtDate(b.recordedAt, locale) : '—'} · <strong>Party:</strong> {b.responsibleParty || 'External Specialist'}
          </div>
          <p className="small pt-m0"><strong>Action needed:</strong> {b.suggestedAction || 'Awaiting contractor or resident response.'}</p>
        </div>
      ))}
    </div>
  )
}

// closureReadiness() item text → the prototype's typed rows with a shortcut to the tab that fixes it.
function readinessRow(item) {
  if (item.startsWith('Resolve blocker: ')) return { type: 'Active Blocker', tone: 'bad', Icon: Warning12Regular, text: item.slice(17), tab: 'blockers', go: 'Resolve in Blockers →' }
  if (item.startsWith('Upload required evidence: ')) return { type: 'Missing Evidence', tone: 'bad', Icon: Folder16Regular, text: item.slice(26), tab: 'evidence', go: 'Upload in Evidence →' }
  if (item.startsWith('Verify evidence: ')) return { type: 'Evidence Review', tone: 'warn', Icon: Folder16Regular, text: item.slice(17), tab: 'evidence', go: 'Review in Evidence →' }
  return { type: 'Prerequisite', tone: 'warn', Icon: Checkmark12Regular, text: item.replace(/^Complete: /, '') }
}

export function ReadinessTab({ kase, onTab }) {
  const r = closureReadiness(kase)
  const checkpoints = kase.checkpoints ?? []
  const evidence = kase.evidence ?? []
  const pendingClosure = kase.pendingRequest?.type === 'closure'
  return (
    <div className="pt-stack pt-gap16">
      {pendingClosure && (
        <div className="pt-callout-warn"><Clock16Regular /> <span><strong>Closure Sign-Off Submitted:</strong> Awaiting formal manager sign-off.</span></div>
      )}
      <div className={`pt-ready ${r.ready ? 'is-ready' : ''}`}>
        <div className="pt-row">
          <strong className="pt-ready-title">
            {r.ready ? <Checkmark16Regular /> : <Warning16Regular />}
            {r.ready ? 'All Checkpoints Satisfied — Ready for Closure' : `Closure Incomplete — ${r.items.length} Requirements Outstanding`}
          </strong>
          <span className={`pt-tag ${r.ready ? 'pt-tag-ok' : 'pt-tag-warn'} pt-bold`}>{r.ready ? 'Compliant & Ready' : `${r.items.length} Incomplete`}</span>
        </div>
        {r.ready ? (
          <p className="small pt-mt8">All statutory and operational requirements verified. Case is fully compliant and eligible for manager sign-off.</p>
        ) : (
          <>
            <p className="small pt-ready-lead">The following mandatory criteria must be resolved before this case can be closed:</p>
            <div className="pt-list6">
              {r.items.map((item) => {
                const row = readinessRow(item)
                return (
                  <div key={item} className="pt-req">
                    <div className="pt-req-main">
                      <span className={`pt-tag pt-tag-${row.tone} pt-tag-xs`}><row.Icon /> {row.type}</span>
                      <span className="pt-req-text">{row.text}</span>
                    </div>
                    {row.tab
                      ? <button type="button" className="pt-btn pt-subtle pt-link" onClick={() => onTab(row.tab)}>{row.go}</button>
                      : <span className="small muted pt-fs115">Check off below ↓</span>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <div>
        <div className="pt-row pt-mb8">
          <h3 className="pt-h3">Progress Checkpoints</h3>
          <span className="small muted">{checkpoints.filter((cp) => cp.completed).length} / {checkpoints.length} complete</span>
        </div>
        <ul className="pt-ul">
          {checkpoints.map((cp) => (
            <li key={cp.id} className="pt-cp">
              {/* shortcut: read-only, the client has no checkpoint-toggle action yet; add one to the case service to enable. */}
              <label className="pt-cp-label">
                <input type="checkbox" checked={cp.completed} readOnly disabled />
                <span className={cp.completed ? 'pt-done' : 'pt-bold5'}>{cp.title}</span>
              </label>
              <span className={`pt-tag ${cp.completed ? 'pt-tag-ok' : 'pt-tag-neutral'}`}>{cp.completed ? 'Completed' : 'Pending'}</span>
            </li>
          ))}
        </ul>
      </div>
      {evidence.length > 0 && (
        <div>
          <h3 className="pt-h3 pt-mb8">Evidence &amp; Documentation</h3>
          <ul className="pt-ul">
            {evidence.map((e) => {
              const ok = e.status === 'verified'
              return (
                <li key={e.id} className="pt-cp pt-cp-sm">
                  <div className="pt-req-main">
                    <span className={ok ? 'pt-ok' : 'pt-bad'}>{ok ? <Checkmark16Regular /> : <Warning16Regular />}</span>
                    <span className="pt-fs13">{e.title}</span>
                  </div>
                  <span className={`pt-tag ${ok ? 'pt-tag-ok' : 'pt-tag-bad'}`}>{ok ? 'Verified' : 'Missing'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

const EVIDENCE_TYPE = { Photo: 'Inspection Photo', Document: 'Document', Report: 'Inspection Report' }

export function EvidenceTab({ kase, me }) {
  const locale = useLocale()
  const evidence = kase.evidence ?? []
  const verified = evidence.filter((e) => e.status === 'verified').length
  const pending = evidence.filter((e) => e.status !== 'verified' && e.status !== 'rejected').length
  return (
    <div className="pt-stack pt-gap18">
      <div className="pt-box pt-row">
        <div>
          <strong className="pt-fs15">Evidence &amp; Verification Vault</strong>
          <p className="small muted pt-mt2">Mandatory documentation, inspection photos, and statutory completion sign-offs (#027).</p>
        </div>
        <div className="pt-inline8">
          <span className="pt-tag pt-tag-ok">{verified} Verified</span>
          <span className={`pt-tag ${pending > 0 ? 'pt-tag-warn' : 'pt-tag-neutral'}`}>{pending} Pending Review</span>
        </div>
      </div>
      <div>
        <div className="pt-row pt-baseline pt-mb12">
          <h4 className="pt-h4"><Folder16Regular /> Attached Records ({evidence.length})</h4>
          <span className="small muted pt-fs12">Verified on-site documentation and statutory inspection attachments</span>
        </div>
        {evidence.length === 0 ? (
          <div className="pt-empty"><p className="muted small pt-m0">No evidence records attached yet.</p></div>
        ) : (
          <div className="pt-evidence-grid">
            {evidence.map((e) => {
              const ok = e.status === 'verified'
              const rejected = e.status === 'rejected'
              const state = ok ? 'ok' : rejected ? 'bad' : 'warn'
              return (
                <div key={e.id} className={`pt-ev-card pt-ev-${state}`}>
                  <div>
                    <div className="pt-row pt-mb10">
                      <span className={`pt-tag pt-tag-${state} pt-bold6`}>{ok ? '✓ Verified' : rejected ? '✗ Rejected' : e.status === 'missing' ? '⏳ Awaiting Upload' : '⏳ Pending Review'}</span>
                      <span className="pt-tag pt-tag-neutral pt-pill">{EVIDENCE_TYPE[e.type] ?? e.type ?? 'Document'}</span>
                    </div>
                    <h5 className="pt-ev-title" title={e.title}>{e.title}</h5>
                    <p className="small muted pt-fs12 pt-mb8">{e.fileName ? `${e.fileName}${e.size ? ` · ${e.size}` : ''}` : 'No file uploaded yet'}</p>
                  </div>
                  <div className="pt-ev-foot">
                    <div className="small muted pt-fs11">
                      <div>
                        Uploaded by <strong>{e.uploadedBy || 'Property Officer'}</strong>{' '}
                        {e.uploadedAt ? `on ${fmtDate(e.uploadedAt, locale)}` : <>· <em>Pending site upload</em></>}
                      </div>
                      {ok && e.verifiedBy && <div className="pt-ok pt-mt2">Verified by <strong>{e.verifiedBy}</strong></div>}
                      {e.requiredForClosure && <div className="pt-brand pt-bold6 pt-mt2">★ Required for Case Closure</div>}
                    </div>
                    {!ok && !rejected && me?.role !== 'manager' && <span className="small muted pt-italic">Awaiting Manager sign-off</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const isAssignment = (h) => /assign|officer|owner/i.test(h.field)

export function HistoryTab({ kase, me, officers, actions }) {
  const locale = useLocale()
  const history = byNewest(kase.history)
  const assignee = history.filter(isAssignment)
  const changes = history.filter((h) => !isAssignment(h))
  const [showForm, setShowForm] = useState(false)
  return (
    <div className="pt-stack pt-gap20">
      <div className="pt-section">
        <div className="pt-row pt-mb12">
          <div>
            <h4 className="pt-h4"><People16Regular /> Assignee History &amp; Handover Audit (#024)</h4>
            <p className="small muted pt-mt2">Historical record of case ownership transitions and manager authorizations.</p>
          </div>
          {caseStage(kase) !== 'closed' && !kase.pendingRequest && (
            <button type="button" className="pt-btn pt-secondary" onClick={() => setShowForm((v) => !v)}><PersonAdd16Regular /> Request Reassignment</button>
          )}
        </div>
        {showForm && <ReassignForm kase={kase} me={me} officers={officers} actions={actions} onDone={() => setShowForm(false)} />}
        {kase.pendingRequest?.type === 'reassign' && (
          <div className="pt-hcard pt-hcard-warn">
            <div className="pt-row">
              <span className="pt-fs14 pt-bold6">Reassignment requested</span>
              <span className="pt-tag pt-tag-warn">⏳ Pending Approval</span>
            </div>
            <p className="small pt-mt8"><strong>Reason:</strong> {kase.pendingRequest.reason}</p>
          </div>
        )}
        {assignee.length === 0 ? (
          <div className="pt-empty"><p className="muted small pt-m0">No previous reassignment recorded.</p></div>
        ) : (
          <div className="pt-list10">
            {assignee.map((h) => (
              <div key={h.id} className="pt-hcard pt-hcard-ok">
                <div className="pt-row">
                  <div>
                    <span className="pt-fs14 pt-bold6">{h.before || 'Previous Officer'} → <strong>{h.after || 'New Officer'}</strong></span>
                    <div className="small muted pt-mt2">Requested by <strong>{h.actor}</strong> on {fmtDate(h.at, locale)}</div>
                  </div>
                  <span className="pt-tag pt-tag-ok">✓ Handover Approved</span>
                </div>
                <p className="small pt-fg2 pt-mt8"><strong>Reason:</strong> {h.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pt-section">
        <div className="pt-mb12">
          <h4 className="pt-h4"><TableSimple16Regular /> Task &amp; Case Change Comparison (#029)</h4>
          <p className="small muted pt-mt2">Before-and-after snapshots of case attributes (Assignee, Due Date, Stage, Priority).</p>
        </div>
        {changes.length === 0 ? (
          <div className="pt-empty"><p className="muted small pt-m0">No change snapshots recorded yet.</p></div>
        ) : (
          <div className="pt-list14">
            {changes.map((h) => (
              <div key={h.id} className="pt-change">
                <div className="pt-row pt-mb8">
                  <span className="pt-tag pt-tag-neutral pt-bold6">{h.field}</span>
                  <span className="small muted">{fmtDate(h.at, locale)} · by {h.actor}</span>
                </div>
                <div className="pt-before-after">
                  <div className="pt-state"><strong className="muted pt-state-label">Before State</strong><div>{h.before || 'N/A'}</div></div>
                  <div className="pt-arrow">→</div>
                  <div className="pt-state pt-state-after"><strong className="pt-state-label">After State</strong><div>{h.after || 'N/A'}</div></div>
                </div>
                <div className="small pt-fg2 pt-mt8"><strong>Audit Note:</strong> {h.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReassignForm({ kase, me, officers, actions, onDone }) {
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const { busy, error, run } = useAction()
  const others = officers.filter((o) => o.id !== kase.ownerId)
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => actions.requestReassignment(kase.id, to, reason))) onDone()
  }
  return (
    <form className="pt-box pt-form pt-mb12" onSubmit={submit}>
      <div className="pt-grid2">
        <label className="pt-field"><span className="small muted">Reassign to</span>
          <select className="pt-input" value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">Choose an officer</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label className="pt-field"><span className="small muted">Reason</span>
          <input className="pt-input" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
      </div>
      <div className="pt-actions-end">
        <button type="button" className="pt-btn pt-subtle" onClick={onDone}>Cancel</button>
        <button type="submit" className="pt-btn pt-primary" disabled={busy || !to || !reason.trim()}>{me.role === 'manager' ? 'Reassign Case' : 'Send Request'}</button>
      </div>
      <ErrorBar error={error} />
    </form>
  )
}

const CHANNELS = ['Phone', 'Email', 'SMS', 'In person']
const channelKey = (ch) => ch.replace(/\s*\(simulated\)$/i, '')

// Deterministic reply draft from the case's own records (no model call), like the prototype's generateDraftReply.
function draftReply(kase) {
  const name = kase.resident?.name || 'Resident'
  const open = (kase.checkpoints ?? []).find((cp) => !cp.completed)
  return `Dear ${name},\n\nThank you for your patience regarding ${kase.title} (${kase.number}). ${open ? `Our next step is: ${open.title}.` : 'All planned work has been completed.'} We will update you again once there is progress.\n\nRegards,\nTown Council Property Officer`
}

export function CommunicationsTab({ kase, actions }) {
  const locale = useLocale()
  const comms = byNewest(kase.communications)
  const channels = [...new Set(comms.map((m) => channelKey(m.channel)))]
  const [filter, setFilter] = useState('all')
  const [showLog, setShowLog] = useState(false)
  const [draft, setDraft] = useState('')
  const blank = { channel: 'Phone', direction: 'outbound', party: '', summary: '' }
  const [form, setForm] = useState(blank)
  const { busy, error, run } = useAction()
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const shown = filter === 'all' ? comms : comms.filter((m) => channelKey(m.channel) === filter)
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => actions.logCommunication(kase.id, form))) { setForm(blank); setShowLog(false) }
  }
  return (
    <div className="pt-stack pt-gap16">
      <div className="pt-row">
        <div>
          <h3 className="pt-h3">Case Communication Hub</h3>
          <p className="small muted pt-mt2">Multi-channel simulated communication history and follow-up tracking.</p>
        </div>
        <button type="button" className="pt-btn pt-primary" onClick={() => setShowLog((v) => !v)}><Add12Regular /> Log Update</button>
      </div>
      <div className="pt-filter-tabs" role="group" aria-label="Filter by channel">
        {[['all', 'All Channels', comms.length], ...channels.map((ch) => [ch, `${ch} (Simulated)`, comms.filter((m) => channelKey(m.channel) === ch).length])].map(([key, label, n]) => (
          <button key={key} type="button" className={`pt-filter-tab ${filter === key ? 'is-active' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label} <span className="pt-count">{n}</span>
          </button>
        ))}
      </div>
      {showLog && (
        <div className="pt-box">
          <h4 className="pt-h4 pt-mb10">Log Simulated Communication Record</h4>
          <form className="pt-form" onSubmit={submit}>
            <div className="pt-grid2">
              <label className="pt-field"><span className="small muted">Channel</span>
                <select className="pt-input" value={form.channel} onChange={set('channel')}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
              </label>
              <label className="pt-field"><span className="small muted">Direction</span>
                <select className="pt-input" value={form.direction} onChange={set('direction')}>
                  <option value="outbound">Outbound</option><option value="inbound">Inbound</option>
                </select>
              </label>
              <label className="pt-field"><span className="small muted">Party</span>
                <input className="pt-input" value={form.party} onChange={set('party')} required />
              </label>
            </div>
            <label className="pt-field"><span className="small muted">Message Summary / Notes</span>
              <textarea className="pt-input" rows={2} required value={form.summary} onChange={set('summary')} placeholder="Record key points of the call or message..." />
            </label>
            <div className="pt-actions-end">
              <button type="button" className="pt-btn pt-subtle" onClick={() => setShowLog(false)}>Cancel</button>
              <button type="submit" className="pt-btn pt-primary" disabled={busy || !form.party.trim() || !form.summary.trim()}>Save Communication Record</button>
            </div>
            <ErrorBar error={error} />
          </form>
        </div>
      )}
      <div className="pt-list10">
        {shown.length === 0 ? <p className="muted small pt-center">No communication records found for this channel.</p> : shown.map((m) => (
          <div key={m.id} className="pt-comm">
            <div className="pt-row">
              <div className="pt-inline8">
                <span className="pt-tag pt-tag-neutral pt-bold6">{m.channel}</span>
                <strong className="pt-fs13">{m.party}</strong>
              </div>
              <span className="small muted pt-fs12">{fmtDate(m.at, locale)}</span>
            </div>
            <p className="pt-fs13 pt-m0">{m.summary}</p>
            <div className="pt-comm-foot muted"><span>Direction: <em>{m.direction === 'inbound' ? 'Inbound' : 'Outbound'}</em></span></div>
          </div>
        ))}
      </div>
      <div className="pt-box">
        <div className="pt-row pt-mb8">
          <h4 className="pt-h4">Simulated Draft Reply Generator</h4>
          <button type="button" className="pt-btn pt-secondary" onClick={() => setDraft(draftReply(kase))}><Sparkle12Regular /> Generate Draft</button>
        </div>
        <textarea className="pt-input" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Draft reply"
          placeholder="Click 'Generate Draft' to prepare a simulated contextual response..." />
        <div className="pt-actions-end pt-mt8">
          <button type="button" className="pt-btn pt-subtle" disabled={!draft} onClick={() => copy(draft)}><Copy16Regular /> Copy to Clipboard</button>
        </div>
      </div>
    </div>
  )
}

function briefText(kase, b) {
  return [`${kase.number} — ${kase.title}`, '', b.summary, '', 'Work completed:', ...b.completed.map((x) => `- ${x}`), '', 'Outstanding:', ...b.outstanding.map((x) => `- ${x}`), '', 'Next steps:', ...b.nextSteps.map((x) => `- ${x}`)].join('\n')
}

export function BriefTab({ kase, now, officerName, onTab, onInspect }) {
  const locale = useLocale()
  const b = caseBrief(kase, now)
  const r = closureReadiness(kase)
  const findings = detectFollowUps(kase, now)
  const done = (kase.checkpoints ?? []).filter((cp) => cp.completed)
  const recs = findings.map((f) => ({ action: explainFinding(kase, f).suggestedAction, reason: f.reason }))
  return (
    <div className="pt-stack pt-gap16">
      <div className="pt-row pt-brief-bar">
        <div className="pt-inline8">
          <span className="pt-tag pt-tag-brand"><Sparkle12Regular /> Deterministic Template</span>
          <span className="small muted">Factual State Intelligence · Town Council Protocol</span>
        </div>
        <button type="button" className="pt-btn pt-secondary" onClick={() => copy(briefText(kase, b))}><Copy16Regular /> Copy Plaintext Brief</button>
      </div>

      <div className="pt-box pt-pad16">
        <div className="pt-row pt-start pt-mb12">
          <div>
            <div className="pt-inline8 pt-mb4">
              <span className="pt-case-no">{kase.number}</span>
              <span className="pt-tag pt-tag-brand">{caseStage(kase)}</span>
              <span className={`pt-tag ${kase.urgency === 'critical' ? 'pt-tag-bad' : 'pt-tag-neutral'}`}>{kase.urgency}</span>
              <Countdown due={kase.deadline} now={now} />
            </div>
            <h3 className="pt-brief-title">{kase.title}</h3>
            <p className="small muted pt-m0">{[kase.category, [kase.estate, kase.block, kase.unit].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="pt-right">
            <div className="small muted">Assigned Officer</div>
            <strong className="pt-fs14">{officerName(kase.ownerId)}{kase.estate ? ` · ${kase.estate}` : ''}</strong>
          </div>
        </div>
        <div className="pt-due-grid">
          <div><span className="small muted pt-block">Response Due</span><span className="pt-fs13 pt-bold6">{kase.deadline ? fmtDate(kase.deadline, locale) : 'None'}</span></div>
        </div>
      </div>

      <div className="pt-section">
        <h4 className="pt-h4 pt-mb8"><Info16Regular /> What Happened? (Executive Summary)</h4>
        <p className="pt-fs14 pt-fg2 pt-m0">{b.summary}</p>
      </div>

      <div className="pt-section">
        <h4 className="pt-h4 pt-mb10"><Checkmark16Regular /> Work Completed</h4>
        {done.length === 0 ? <p className="small muted pt-m0">No work recorded as completed yet.</p> : (
          <ul className="pt-ul">
            {done.map((cp) => (
              <li key={cp.id} className="pt-work">
                <div className="pt-inline8"><span className="pt-ok"><Checkmark16Regular /></span><strong>{cp.title}</strong></div>
                <span className="pt-tag pt-tag-ok">{cp.completedAt ? fmtDate(cp.completedAt, locale) : 'Completed'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`pt-section ${findings.length ? 'pt-section-warn' : ''}`}>
        <div className="pt-row pt-mb10">
          <h4 className="pt-h4"><TargetArrow16Regular /> Outstanding Commitments &amp; Loose Ends ({findings.length})</h4>
          {findings.length > 0 && <button type="button" className="pt-btn pt-ghost" onClick={() => onTab('followUps')}>View in Follow-Ups Tab →</button>}
        </div>
        {findings.length === 0 ? <p className="small muted pt-m0">No unfulfilled operational loose ends detected.</p> : (
          <ul className="pt-ul">
            {findings.map((f) => {
              const x = explainFinding(kase, f)
              return (
                <li key={f.id} className="pt-loose">
                  <div className="pt-row"><strong className="pt-fs13">{x.ruleName}</strong><span className="pt-tag pt-tag-bad pt-bold6">{x.ruleCode}</span></div>
                  <p className="small pt-fg2 pt-loose-why">{x.explanation}</p>
                  <div className="pt-row pt-loose-foot">
                    <span className="muted"><strong>Action:</strong> {x.suggestedAction}</span>
                    <button type="button" className="pt-btn pt-secondary pt-nowrap" onClick={() => onInspect(f.id)}>Inspect Finding</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="pt-section">
        <h4 className="pt-h4 pt-mb10"><ArrowRight16Regular /> Recommended Next Actions</h4>
        {recs.length === 0 ? <p className="small muted pt-m0">No further actions recommended.</p> : (
          <div className="pt-list8">
            {recs.map((rec, i) => (
              <div key={rec.action} className="pt-rec">
                <span className="pt-num">{i + 1}</span>
                <div><strong className="pt-fs13">{rec.action}</strong><p className="small muted pt-mt2">{rec.reason}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-section">
        <div className="pt-row pt-mb10">
          <h4 className="pt-h4"><Checkmark16Regular /> Statutory Closure Readiness <span className={`pt-tag ${r.ready ? 'pt-tag-ok' : 'pt-tag-warn'} pt-bold`}>{r.ready ? 'Ready' : 'Incomplete'}</span></h4>
          <button type="button" className="pt-btn pt-ghost" onClick={() => onTab('closure')}>Full Checklist →</button>
        </div>
        <p className="small pt-fg2 pt-m0">
          {r.ready ? 'All mandatory operational checkpoints and evidence requirements have been verified. Ready for Estate Manager closure sign-off.' : `Pending requirements: ${r.items.join(', ')}.`}
        </p>
      </div>

      <div className="pt-box pt-row">
        <span className="small pt-bold6">Jump to Supporting Case Records:</span>
        <div className="pt-inline8">
          <button type="button" className="pt-btn pt-secondary" onClick={() => onTab('evidence')}><Folder16Regular /> Evidence &amp; Docs ({(kase.evidence ?? []).length})</button>
          <button type="button" className="pt-btn pt-secondary" onClick={() => onTab('history')}><Clock12Regular /> History &amp; Changes</button>
          <button type="button" className="pt-btn pt-secondary" onClick={() => onTab('comms')}><Chat12Regular /> Resident Comms</button>
          <button type="button" className="pt-btn pt-secondary" onClick={() => onTab('timeline')}><TextBulletListLtr16Regular /> Timeline &amp; Notes</button>
        </div>
      </div>

      <div className="pt-disclaimer">
        <strong>Responsible AI &amp; Town Council Governance Disclosure:</strong>
        This case brief is deterministically compiled from operational state records, checklist verifications, and Singapore Town Council statutory protocols. It does not generate hallucinations or invent unrecorded site facts. Factual gaps and missing evidence are explicitly identified. Officers must confirm physical site conditions before authorizing formal closure.
      </div>
    </div>
  )
}

