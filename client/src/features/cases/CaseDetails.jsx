import { useState } from 'react'
import {
  Badge, Button, Dialog, DialogSurface, Field, Input, MessageBar, MessageBarBody, Select, Tab, TabList, Textarea,
} from '@fluentui/react-components'
import {
  ArrowTrending16Regular, Chat16Regular, Checkmark16Regular, CheckmarkCircle16Filled, Clock16Regular, Dismiss24Regular, ErrorCircle16Regular,
  Folder16Regular, History16Regular, Location16Regular, People16Regular, PersonAdd16Regular, Shield16Regular, TargetArrow16Regular, Sparkle16Regular, Warning16Regular,
} from '@fluentui/react-icons'
import { useLocale, useT } from '../../lib/i18n.js'
import { caseBrief, caseStage, closureReadiness, detectFollowUps } from './caseLogic.js'
import { Countdown, fmtDate, StageBadge } from './CaseViews.jsx'
import { explainFinding } from './followUpExplain.js'

export const DETAIL_TABS = ['timeline', 'followUps', 'blockers', 'closure', 'evidence', 'history', 'comms', 'brief']
const TAB_ICONS = {
  timeline: History16Regular, followUps: TargetArrow16Regular, blockers: Warning16Regular, closure: Checkmark16Regular,
  evidence: Folder16Regular, history: Clock16Regular, comms: Chat16Regular, brief: Sparkle16Regular,
}

// Case details laid out like the prototype's case workspace: header, side tab rail, footer actions.
export default function CaseDetails({ kase, tab, onTab, onClose, ...rest }) {
  return (
    <Dialog open={Boolean(kase)} onOpenChange={(_e, d) => !d.open && onClose()}>
      <DialogSurface className="case-details-dialog" aria-labelledby="case-ws-title">
        {kase && <CaseDetailsBody kase={kase} tab={tab} onTab={onTab} onClose={onClose} {...rest} />}
      </DialogSurface>
    </Dialog>
  )
}

export function CaseDetailsBody({ kase, tab, onTab, onClose, now, officerName, onMove, ...rest }) {
  const t = useT()
  const stage = caseStage(kase)
  const closed = stage === 'closed'
  const readiness = closureReadiness(kase)
  const pending = readiness.items.length
  const counts = {
    followUps: detectFollowUps(kase, now).length,
    blockers: (kase.blockers ?? []).filter((b) => !b.resolved).length,
    evidence: kase.evidence?.length ?? 0,
    history: kase.history?.length ?? 0,
    comms: kase.communications?.length ?? 0,
  }
  const location = [kase.estate, kase.block, kase.unit].filter(Boolean).join(' · ')
  const readyLabel = readiness.ready ? t('cases.ws.ready') : t('cases.ws.pending', { n: pending })
  return (
    <div className="case-ws">
      <header className="case-ws-header">
        {/* First in the DOM so the dialog's initial focus lands on Close, as in the prototype. */}
        <Button className="case-ws-close" appearance="outline" icon={<Dismiss24Regular />} aria-label={t('cases.closeDetails')} onClick={onClose} />
        <div className="case-ws-heading">
          <div className="case-ws-kicker">
            <span className="case-id">{kase.number}</span>
            <StageBadge stage={stage} />
            {kase.category && <Badge appearance="tint" color="subtle" className="case-ws-category">{kase.category}</Badge>}
            <span className="case-ws-due"><Countdown due={kase.deadline} now={now} /></span>
            {location && <span className="small muted case-ws-location"><Location16Regular /> {location}</span>}
          </div>
          <h2 id="case-ws-title" className="case-ws-title">{kase.title}</h2>
          <div className="case-ws-owner">
            <Button appearance="subtle" size="small" icon={<People16Regular />} onClick={() => onTab('history')}>
              {t('cases.ws.assigned')}&nbsp;<strong>{officerName(kase.ownerId)}</strong>
            </Button>
            <span className={`case-ws-readiness ${readiness.ready ? 'is-ready' : ''}`}>
              {readiness.ready ? <Checkmark16Regular /> : <Clock16Regular />} {readyLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="case-ws-main">
        <TabList vertical selectedValue={tab} onTabSelect={(_e, d) => onTab(d.value)} className="case-ws-nav" aria-label={t('cases.ws.sections')}>
          {DETAIL_TABS.map((id) => {
            const Icon = TAB_ICONS[id]
            const n = counts[id]
            return (
              <Tab key={id} value={id} icon={<Icon />}>
                <span className="case-ws-tab">
                  <span className="case-ws-tab-label">{t(`cases.d.${id}`)}</span>
                  {id === 'closure'
                    ? <span className={`case-ws-count ${readiness.ready ? 'is-ok' : 'is-alert'}`} aria-label={readyLabel}>{readiness.ready ? '✓' : '!'}</span>
                    : n != null && <span className={`case-ws-count ${n > 0 && (id === 'followUps' || id === 'blockers') ? 'is-warn' : ''}`}>{n}</span>}
                </span>
              </Tab>
            )
          })}
        </TabList>
        <div className="case-ws-content">
          <TabPanel kase={kase} tab={tab} onTab={onTab} now={now} officerName={officerName} {...rest} />
        </div>
      </div>

      <footer className="case-ws-footer">
        <div className="case-ws-footer-group">
          {!closed && <Button size="small" icon={<PersonAdd16Regular />} onClick={() => onTab('history')}>{t('cases.ws.reassign')}</Button>}
          {!closed && <Button size="small" icon={<ArrowTrending16Regular />} onClick={() => onMove(kase.id)}>{t('cases.move')}</Button>}
        </div>
        <div className="case-ws-footer-group">
          {!closed && !readiness.ready && (
            <Button appearance="transparent" size="small" className="case-ws-pending-link" onClick={() => onTab('closure')}>{t('cases.ws.checklist', { n: pending })}</Button>
          )}
          <Button appearance="primary" disabled={closed} onClick={() => onMove(kase.id, 'closed')}>{closed ? t('cases.stage.closed') : t('cases.ws.closeCase')}</Button>
        </div>
      </footer>
    </div>
  )
}

function TabPanel({ kase, tab, onTab, me, now, officers, officerName, actions }) {
  return (
    <>
      <PendingRequest kase={kase} me={me} officerName={officerName} actions={actions} />
      <div className="case-tab-panel" role="tabpanel">
        {tab === 'timeline' && <Timeline kase={kase} actions={actions} />}
        {tab === 'followUps' && <FollowUps kase={kase} findings={detectFollowUps(kase, now)} onTab={onTab} />}
        {tab === 'blockers' && <Blockers kase={kase} />}
        {tab === 'closure' && <Closure kase={kase} />}
        {tab === 'evidence' && <Evidence kase={kase} />}
        {tab === 'history' && <History kase={kase} me={me} officers={officers} actions={actions} />}
        {tab === 'comms' && <Communications kase={kase} actions={actions} />}
        {tab === 'brief' && <Brief kase={kase} now={now} />}
      </div>
    </>
  )
}

// Shared submit handling for the small forms: busy flag, error message, reset on success.
function useAction() {
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

const ErrorBar = ({ error }) => error && <MessageBar intent="error" className="case-form-error"><MessageBarBody>{error}</MessageBarBody></MessageBar>
const Empty = ({ children }) => <p className="muted empty">{children}</p>
const byNewest = (list) => [...(list ?? [])].sort((a, b) => new Date(b.at) - new Date(a.at))

function PendingRequest({ kase, me, officerName, actions }) {
  const t = useT()
  const { busy, error, run } = useAction()
  const [note, setNote] = useState('')
  const req = kase.pendingRequest
  if (!req) return null
  const what = req.type === 'closure' ? t('cases.req.closure') : t('cases.req.reassign', { name: officerName(req.toOfficerId) })
  return (
    <MessageBar intent="warning" layout="multiline" className="case-request">
      <MessageBarBody>
        <strong>{what}</strong> — {t('cases.req.by', { name: req.by })}. {req.reason}
        {me.role === 'manager' ? (
          <div className="case-request-decide">
            <Input value={note} onChange={(_e, d) => setNote(d.value)} placeholder={t('cases.req.note')} aria-label={t('cases.req.note')} />
            <Button size="small" appearance="primary" disabled={busy} onClick={() => run(() => actions.decideRequest(kase.id, true, note))}>{t('cases.req.approve')}</Button>
            <Button size="small" disabled={busy} onClick={() => run(() => actions.decideRequest(kase.id, false, note))}>{t('cases.req.reject')}</Button>
          </div>
        ) : <p className="small">{t('cases.req.waiting')}</p>}
        <ErrorBar error={error} />
      </MessageBarBody>
    </MessageBar>
  )
}

function Timeline({ kase, actions }) {
  const t = useT()
  const locale = useLocale()
  const [text, setText] = useState('')
  const { busy, error, run } = useAction()
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => actions.addNote(kase.id, text))) setText('')
  }
  return (
    <>
      <form className="case-form" onSubmit={submit}>
        <Field label={t('cases.addNote')}>
          <Textarea value={text} onChange={(_e, d) => setText(d.value)} placeholder={t('cases.notePlaceholder')} resize="vertical" />
        </Field>
        <Button type="submit" appearance="primary" disabled={busy || !text.trim()}>{t('cases.saveNote')}</Button>
        <ErrorBar error={error} />
      </form>
      <ol className="case-timeline">
        {byNewest(kase.timeline).map((e) => (
          <li key={e.id}>
            <strong>{e.title}</strong>
            {e.summary && <p>{e.summary}</p>}
            <p className="muted small">{fmtDate(e.at, locale)} · {e.actor} · {t('cases.source', { source: e.source })}</p>
          </li>
        ))}
      </ol>
    </>
  )
}

// Where a finding's source record lives, and where its outcome gets recorded.
const RECORD_TAB = { blocker: 'blockers', evidence: 'evidence', timeline: 'timeline' }
const outcomeTab = (f) => (f.ruleId === 'resident_callback' ? 'comms' : f.record.type === 'evidence' ? 'evidence' : 'timeline')

function FollowUps({ kase, findings, onTab }) {
  const t = useT()
  const [openId, setOpenId] = useState(null)
  const open = findings.find((f) => f.id === openId)
  if (open) return <FollowUpExplanation f={open} x={explainFinding(kase, open)} onBack={() => setOpenId(null)} onTab={onTab} />
  return (
    <div className="fu-list">
      <div className="fu-head">
        <div>
          <h3>{t('cases.d.followUps')}</h3>
          <p className="muted small">{t('cases.fu.lead')}</p>
        </div>
        <Badge appearance="tint" color="warning">{t('cases.fu.attention', { n: findings.length })}</Badge>
      </div>
      {!findings.length ? (
        <div className="fu-empty"><strong>{t('cases.fu.emptyTitle')}</strong><p className="small">{t('cases.radar.empty')}</p></div>
      ) : findings.map((f) => {
        const x = explainFinding(kase, f)
        return (
          <article key={f.id} className={`fu-card fu-${f.severity}`}>
            <div className="fu-card-top">
              <span className="fu-card-title"><strong>{x.title}</strong><span className="fu-code">{x.ruleCode}</span></span>
              <span className={`fu-sev fu-sev-${f.severity}`}>{t(`cases.fu.sev.${f.severity}`)}</span>
            </div>
            <p className="small muted">{x.explanation}</p>
            <p className="fu-record"><strong>{t('cases.fu.supporting')}</strong> {f.record.label}</p>
            <p className="fu-next small">💡 <strong>{t('cases.fu.nextStep')}</strong> {x.suggestedAction}</p>
            <div className="fu-actions">
              <div>
                <Button size="small" appearance="primary" icon={<Sparkle16Regular />} onClick={() => setOpenId(f.id)}>{t('cases.fu.why')}</Button>
                <Button size="small" className="fu-resolve" icon={<Checkmark16Regular />} onClick={() => onTab(outcomeTab(f))}>{t('cases.fu.outcome')}</Button>
              </div>
              <Button size="small" appearance="subtle" icon={<Chat16Regular />} onClick={() => onTab('comms')}>{t('cases.fu.hub')}</Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

// The prototype's evidence-linked explanation (#117): disclosure, finding, four-part breakdown, source record.
function FollowUpExplanation({ f, x, onBack, onTab }) {
  const t = useT()
  return (
    <div className="fu-list">
      <div className="fu-head">
        <Button appearance="transparent" className="fu-back" onClick={onBack}>← {t('cases.fu.back')}</Button>
        <span className="fu-badge">{t('cases.fu.badge')}</span>
      </div>
      <div className="fu-disclosure">
        <strong><Shield16Regular /> {t('cases.fu.disclosureTitle')}</strong>
        <p>{t('cases.fu.disclosure1')} <strong>{x.ruleCode} ({x.ruleName})</strong> {t('cases.fu.disclosure2')}</p>
      </div>
      <div className="fu-finding">
        <div className="fu-card-top">
          <h3>{x.title}</h3>
          <span className={`fu-sev fu-sev-${f.severity}`}>{t(`cases.fu.sev.${f.severity}`)}</span>
        </div>
        <p>{x.whyDetected}</p>
        <p className="fu-threshold"><strong>{t('cases.fu.threshold')}</strong> {x.ruleThreshold}</p>
      </div>
      <section className="fu-part fu-facts"><h4><Checkmark16Regular /> {t('cases.fu.facts')}</h4><ul>{x.verifiedFacts.map((v) => <li key={v}>{v}</li>)}</ul></section>
      <section className="fu-part fu-rules"><h4><Sparkle16Regular /> {t('cases.fu.rules')}</h4><ul>{x.ruleDeductions.map((v) => <li key={v}>{v}</li>)}</ul></section>
      <section className="fu-part fu-missing"><h4><Warning16Regular /> {t('cases.fu.missing')}</h4><p>{x.missingInfo}</p></section>
      <section className="fu-part fu-recs"><h4><Shield16Regular /> {t('cases.fu.recs')}</h4><p>{x.suggestedAction}</p></section>
      <div className="fu-source">
        <div>
          <span className="fu-source-label">{t('cases.fu.source')}</span>
          <strong>{x.sourceRecordRef}</strong>
        </div>
        <div className="fu-source-actions">
          <Button size="small" className="fu-resolve" icon={<Checkmark16Regular />} onClick={() => onTab(outcomeTab(f))}>{t('cases.fu.resolve')}</Button>
          <Button size="small" appearance="primary" onClick={() => onTab(RECORD_TAB[f.record.type] ?? 'timeline')}>{t('cases.fu.view')} →</Button>
        </div>
      </div>
    </div>
  )
}

function Blockers({ kase }) {
  const t = useT()
  if (!kase.blockers?.length) return <Empty>{t('cases.noBlockers')}</Empty>
  return (
    <ul className="case-cards">
      {kase.blockers.map((b) => (
        <li key={b.id} className="panel">
          <div className="panel-head">
            <h3>{b.title}</h3>
            <Badge appearance="tint" color={b.resolved ? 'success' : 'warning'}>{b.resolved ? t('cases.resolved') : t('cases.active')}</Badge>
          </div>
          <p className="small">{b.responsibleParty ? t('cases.waitingOn', { party: b.responsibleParty }) : t('cases.partyUnknown')}</p>
        </li>
      ))}
    </ul>
  )
}

function Closure({ kase }) {
  const t = useT()
  const r = closureReadiness(kase)
  return (
    <>
      <MessageBar intent={r.ready ? 'success' : 'warning'}>
        <MessageBarBody>{r.ready ? t('cases.closure.ready') : t('cases.closure.notReady', { n: r.items.length })}</MessageBarBody>
      </MessageBar>
      <ul className="case-checklist">
        {r.checks.map((c) => (
          <li key={c.label}>
            {c.done ? <CheckmarkCircle16Filled className="ok" /> : <ErrorCircle16Regular className="bad" />}
            <span>{c.label}</span>
            <span className="visually-hidden">{c.done ? t('cases.done') : t('cases.notDone')}</span>
          </li>
        ))}
      </ul>
      {!r.ready && (
        <>
          <h3>{t('cases.closure.missing')}</h3>
          <ul className="case-bullets">{r.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </>
      )}
      <p className="muted small">{t('cases.closure.human')}</p>
    </>
  )
}

const EVIDENCE_COLOR = { verified: 'success', pending_review: 'warning', missing: 'danger', rejected: 'danger' }

function Evidence({ kase }) {
  const t = useT()
  const locale = useLocale()
  if (!kase.evidence?.length) return <Empty>{t('cases.noEvidence')}</Empty>
  return (
    <ul className="case-cards">
      {kase.evidence.map((e) => (
        <li key={e.id} className="panel">
          <div className="panel-head">
            <h3>{e.status === 'missing' && <Warning16Regular className="bad" />} {e.title}</h3>
            <Badge appearance="tint" color={EVIDENCE_COLOR[e.status] ?? 'subtle'}>{t(`cases.ev.${e.status}`)}</Badge>
          </div>
          <p className="small">
            {e.status === 'missing' ? t('cases.ev.notUploaded') : [e.type, e.fileName, e.size, fmtDate(e.uploadedAt, locale), e.uploadedBy].filter(Boolean).join(' · ')}
          </p>
          {e.verifiedBy && <p className="muted small">{t('cases.ev.verifiedBy', { name: e.verifiedBy })}</p>}
          {e.requiredForClosure && <p className="muted small">{t('cases.ev.required')}</p>}
        </li>
      ))}
    </ul>
  )
}

function History({ kase, me, officers, actions }) {
  const t = useT()
  const locale = useLocale()
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const { busy, error, run } = useAction()
  const others = officers.filter((o) => o.id !== kase.ownerId)
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => actions.requestReassignment(kase.id, to, reason))) { setTo(''); setReason('') }
  }
  return (
    <>
      {byNewest(kase.history).length === 0 ? <Empty>{t('cases.noHistory')}</Empty> : (
        <ol className="case-timeline">
          {byNewest(kase.history).map((h) => (
            <li key={h.id}>
              <strong>{h.field}</strong>
              <p><span className="change-before">{h.before}</span> → <span className="change-after">{h.after}</span></p>
              <p className="muted small">{fmtDate(h.at, locale)} · {h.actor} · {h.reason}</p>
            </li>
          ))}
        </ol>
      )}
      {caseStage(kase) !== 'closed' && !kase.pendingRequest && (
        <form className="case-form" onSubmit={submit}>
          <h3>{me.role === 'manager' ? t('cases.reassign') : t('cases.requestReassign')}</h3>
          <div className="case-form-row">
            <Field label={t('cases.reassignTo')}>
              <Select value={to} onChange={(_e, d) => setTo(d.value)}>
                <option value="">{t('cases.choose')}</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
            <Field label={t('cases.reason')} required>
              <Input value={reason} onChange={(_e, d) => setReason(d.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={busy || !to || !reason.trim()}>{me.role === 'manager' ? t('cases.reassign') : t('cases.sendRequest')}</Button>
          <ErrorBar error={error} />
        </form>
      )}
    </>
  )
}

const CHANNELS = ['Phone', 'Email', 'SMS', 'In person']

function Communications({ kase, actions }) {
  const t = useT()
  const locale = useLocale()
  const blank = { channel: 'Phone', direction: 'outbound', party: '', summary: '' }
  const [form, setForm] = useState(blank)
  const { busy, error, run } = useAction()
  const set = (key) => (_e, d) => setForm((f) => ({ ...f, [key]: d.value }))
  const submit = async (e) => {
    e.preventDefault()
    if (await run(() => actions.logCommunication(kase.id, form))) setForm(blank)
  }
  return (
    <>
      <p className="muted small">{t('cases.comms.note')}</p>
      {byNewest(kase.communications).length === 0 ? <Empty>{t('cases.noComms')}</Empty> : (
        <ol className="case-timeline">
          {byNewest(kase.communications).map((m) => (
            <li key={m.id}>
              <strong>{m.channel} · {t(`cases.comms.${m.direction}`)} · {m.party}</strong>
              <p>{m.summary}</p>
              <p className="muted small">{fmtDate(m.at, locale)}</p>
            </li>
          ))}
        </ol>
      )}
      <form className="case-form" onSubmit={submit}>
        <h3>{t('cases.comms.log')}</h3>
        <div className="case-form-row">
          <Field label={t('cases.comms.channel')}>
            <Select value={form.channel} onChange={set('channel')}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label={t('cases.comms.direction')}>
            <Select value={form.direction} onChange={set('direction')}>
              <option value="outbound">{t('cases.comms.outbound')}</option>
              <option value="inbound">{t('cases.comms.inbound')}</option>
            </Select>
          </Field>
          <Field label={t('cases.comms.party')} required><Input value={form.party} onChange={set('party')} /></Field>
        </div>
        <Field label={t('cases.comms.summary')} required><Textarea value={form.summary} onChange={set('summary')} resize="vertical" /></Field>
        <Button type="submit" appearance="primary" disabled={busy || !form.party.trim() || !form.summary.trim()}>{t('cases.comms.save')}</Button>
        <ErrorBar error={error} />
      </form>
    </>
  )
}

function Brief({ kase, now }) {
  const t = useT()
  const b = caseBrief(kase, now)
  const list = (title, items, empty) => (
    <section className="brief-block">
      <h3>{title}</h3>
      {items.length ? <ul className="case-bullets">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="muted small">{empty}</p>}
    </section>
  )
  return (
    <>
      <MessageBar intent="info"><MessageBarBody>{t('cases.brief.notice')}</MessageBarBody></MessageBar>
      <section className="brief-block"><h3>{t('cases.brief.summary')}</h3><p>{b.summary}</p></section>
      {list(t('cases.brief.done'), b.completed, t('cases.brief.none'))}
      {list(t('cases.brief.outstanding'), b.outstanding, t('cases.brief.none'))}
      {list(t('cases.brief.next'), b.nextSteps, t('cases.brief.none'))}
      {list(t('cases.brief.missing'), b.missing, t('cases.brief.none'))}
      {list(t('cases.brief.sources'), b.sources, t('cases.brief.none'))}
    </>
  )
}
