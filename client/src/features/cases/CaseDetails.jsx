import { useState } from 'react'
import {
  Badge, Button, Dialog, DialogSurface, Input, MessageBar, MessageBarBody, Tab, TabList,
} from '@fluentui/react-components'
import {
  ArrowTrending16Regular, Chat16Regular, Checkmark16Regular, Clock16Regular, Dismiss24Regular,
  Folder16Regular, History16Regular, Location16Regular, People16Regular, PersonAdd16Regular, Shield16Regular, TargetArrow16Regular, Sparkle16Regular, Warning16Regular,
} from '@fluentui/react-icons'
import { useT } from '../../lib/i18n.js'
import { caseStage, closureReadiness, detectFollowUps } from './caseLogic.js'
import { Countdown, StageBadge } from './CaseViews.jsx'
import { explainFinding } from './followUpExplain.js'
import { BlockersTab, BriefTab, CommunicationsTab, ErrorBar, EvidenceTab, HistoryTab, ReadinessTab, TimelineTab, useAction } from './CaseTabs.jsx'

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
  // Lives here so the brief's "Inspect Finding" can open one explanation on the follow-ups tab.
  const [explainId, setExplainId] = useState(null)
  const inspect = (id) => { setExplainId(id); onTab('followUps') }
  return (
    <>
      <PendingRequest kase={kase} me={me} officerName={officerName} actions={actions} />
      <div className="case-tab-panel" role="tabpanel">
        {tab === 'timeline' && <TimelineTab kase={kase} actions={actions} />}
        {tab === 'followUps' && <FollowUps kase={kase} findings={detectFollowUps(kase, now)} onTab={onTab} openId={explainId} setOpenId={setExplainId} />}
        {tab === 'blockers' && <BlockersTab kase={kase} />}
        {tab === 'closure' && <ReadinessTab kase={kase} onTab={onTab} />}
        {tab === 'evidence' && <EvidenceTab kase={kase} me={me} />}
        {tab === 'history' && <HistoryTab kase={kase} me={me} officers={officers} actions={actions} />}
        {tab === 'comms' && <CommunicationsTab kase={kase} actions={actions} />}
        {tab === 'brief' && <BriefTab kase={kase} now={now} officerName={officerName} onTab={onTab} onInspect={inspect} />}
      </div>
    </>
  )
}

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

// Where a finding's source record lives, and where its outcome gets recorded.
const RECORD_TAB = { blocker: 'blockers', evidence: 'evidence', timeline: 'timeline' }
const outcomeTab = (f) => (f.ruleId === 'resident_callback' ? 'comms' : f.record.type === 'evidence' ? 'evidence' : 'timeline')

function FollowUps({ kase, findings, onTab, openId, setOpenId }) {
  const t = useT()
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

