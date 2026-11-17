import { useState } from 'react'
import {
  Badge, Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, MessageBar, MessageBarBody, Select, Tab, TabList, Textarea,
} from '@fluentui/react-components'
import { ArrowSwap16Regular, CheckmarkCircle16Filled, Dismiss24Regular, ErrorCircle16Regular, Warning16Regular } from '@fluentui/react-icons'
import { useLocale, useT } from '../../lib/i18n.js'
import { caseBrief, caseStage, closureReadiness, detectFollowUps } from './caseLogic.js'
import { Countdown, fmtDate, StageBadge, UrgencyBadge } from './CaseViews.jsx'

export const DETAIL_TABS = ['timeline', 'followUps', 'blockers', 'closure', 'evidence', 'history', 'comms', 'brief']

// Case details in a dialog (full-screen on phones). `actions` are the service calls; each returns a promise.
export default function CaseDetails({ kase, tab, onTab, onClose, ...rest }) {
  const t = useT()
  return (
    <Dialog open={Boolean(kase)} onOpenChange={(_e, d) => !d.open && onClose()}>
      <DialogSurface className="case-details-dialog" aria-label={kase ? `${kase.number} ${kase.title}` : undefined}>
        {kase && (
          <DialogBody className="case-details-body">
            <DialogTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label={t('cases.closeDetails')} onClick={onClose} />}>
              <span className="case-id">{kase.number}</span> {kase.title}
            </DialogTitle>
            <DialogContent>
              <CaseDetailsBody kase={kase} tab={tab} onTab={onTab} {...rest} />
            </DialogContent>
          </DialogBody>
        )}
      </DialogSurface>
    </Dialog>
  )
}

export function CaseDetailsBody({ kase, tab, onTab, me, now, officers, officerName, actions, onMove }) {
  const t = useT()
  const followUps = detectFollowUps(kase, now)
  return (
    <>
      <div className="case-details-meta">
        <StageBadge stage={caseStage(kase)} />
        <UrgencyBadge urgency={kase.urgency} />
        <span className="small">{[kase.estate, kase.block, kase.unit].filter(Boolean).join(' · ')}</span>
        <span className="small">{t('cases.officer', { name: officerName(kase.ownerId) })}</span>
        <span className="small"><Countdown due={kase.deadline} now={now} /></span>
        <Button size="small" icon={<ArrowSwap16Regular />} onClick={() => onMove(kase.id)}>{t('cases.move')}</Button>
      </div>
      <PendingRequest kase={kase} me={me} officerName={officerName} actions={actions} />
      <TabList selectedValue={tab} onTabSelect={(_e, d) => onTab(d.value)} className="case-tabs" size="small">
        {DETAIL_TABS.map((id) => (
          <Tab key={id} value={id}>{t(`cases.d.${id}`)}{id === 'followUps' && followUps.length > 0 ? ` (${followUps.length})` : ''}</Tab>
        ))}
      </TabList>
      <div className="case-tab-panel" role="tabpanel" aria-label={t(`cases.d.${tab}`)}>
        {tab === 'timeline' && <Timeline kase={kase} actions={actions} />}
        {tab === 'followUps' && <FollowUps findings={followUps} now={now} />}
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

function FollowUps({ findings, now }) {
  const t = useT()
  if (!findings.length) return <Empty>{t('cases.radar.empty')}</Empty>
  return (
    <>
      <p className="muted small">{t('cases.radar.lead')}</p>
      <ul className="case-cards">
        {findings.map((f) => (
          <li key={f.id} className="panel">
            <div className="panel-head"><h3>{f.title}</h3><Countdown due={f.due} now={now} /></div>
            <p><strong>{t('cases.why.found')}</strong> {f.reason}</p>
            <p><strong>{t('cases.why.rule')}</strong> {f.threshold}</p>
            <p><strong>{t('cases.record')}:</strong> {f.record.label}</p>
            <p><strong>{t('cases.next')}:</strong> {f.nextStep}</p>
            <p className="muted small">{t('cases.why.review')}</p>
          </li>
        ))}
      </ul>
    </>
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
