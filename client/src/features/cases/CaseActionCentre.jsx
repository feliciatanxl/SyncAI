import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, MessageBar, MessageBarBody, MessageBarTitle, SearchBox, Select, Spinner, Tab, TabList } from '@fluentui/react-components'
import {
  Board20Regular, BriefcaseSearch24Regular, CheckmarkCircle24Regular, Folder24Regular, PauseCircle24Regular, Alert24Regular, TextBulletListLtr20Regular,
} from '@fluentui/react-icons'
import PageHeader, { HeroStat } from '../../components/PageHeader.jsx'
import { useLocale, useT } from '../../lib/i18n.js'
import { useNow } from '../../lib/time.js'
import { byPriority, canUseCaseCentre, caseStage, shiftCounts, checkTransition, caseSummary, detectFollowUps, STAGES, URGENCIES, visibleCases } from './caseLogic.js'
import { caseDataMode, createCaseService } from './caseService.js'
import CaseDetails from './CaseDetails.jsx'
import CaseStageDialog from './CaseStageDialog.jsx'
import { CaseBoard, CaseTable } from './CaseViews.jsx'
import FollowUpRadar from './FollowUpRadar.jsx'
import NextUp from './NextUp.jsx'
import './cases.css'

const CARDS = ['open', 'followUps', 'blocked', 'ready']
const CARD_ICONS = { open: <Folder24Regular />, followUps: <Alert24Regular />, blocked: <PauseCircle24Regular />, ready: <CheckmarkCircle24Regular /> }
const CARD_FILTER = {
  open: (c) => caseStage(c) !== 'closed',
  followUps: (c, now) => detectFollowUps(c, now).length > 0,
  blocked: (c) => caseStage(c) === 'pending_external',
  ready: (c) => caseStage(c) === 'ready_for_closure',
}

// Category C — Case Action Centre. `service` can be injected (tests); otherwise it's chosen by caseDataMode().
export default function CaseActionCentre({ me, getToken, service: injected }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const service = useMemo(() => injected ?? createCaseService({ mode: caseDataMode(), me, getToken }), [injected, me, getToken])
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ q: '', estate: '', urgency: '', stage: '', card: '' })
  const [view, setView] = useState('list')
  const [openId, setOpenId] = useState(null)
  const [tab, setTab] = useState('timeline')
  const [moveId, setMoveId] = useState(null)
  const [moveTarget, setMoveTarget] = useState('')

  const load = useCallback(() => {
    setError(null)
    return service.list().then(setData, (err) => { setData(null); setError(err) })
  }, [service])
  useEffect(() => { load() }, [load])

  if (!canUseCaseCentre(me)) return null

  // Every write re-reads the list so cards, radar and dialogs stay consistent with the data source.
  const act = (fn) => (...args) => fn(...args).then((r) => load().then(() => r))
  const actions = {
    addNote: act(service.addNote), logCommunication: act(service.logCommunication), decideRequest: act(service.decideRequest),
    requestReassignment: act(service.requestReassignment), moveStage: act(service.moveStage),
  }

  const cases = data ? visibleCases(data.cases, me, data.managedOfficerIds) : []
  const shift = shiftCounts(cases, now)
  const header = (
    <PageHeader
      icon={<BriefcaseSearch24Regular />}
      eyebrow={t('cases.eyebrow')}
      title={t('nav.cases')}
      description={`${t('cases.lead')} ${t(`cases.scope.${me.role}`)}`}
    >
      <HeroStat value={now.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })} label={now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} />
      {data && <HeroStat value={shift.overdue} label={t('cases.shift.overdue')} tone={shift.overdue ? 'warn' : undefined} />}
      {data && <HeroStat value={shift.dueSoon} label={t('cases.shift.dueSoon')} />}
    </PageHeader>
  )
  if (error) {
    return (
      <>
        {header}
        <MessageBar intent="error" layout="multiline" className="portal-error">
          <MessageBarBody>
            <MessageBarTitle>{error.status === 404 ? t('cases.apiMissing') : t('cases.loadFailed')}</MessageBarTitle>
            {error.status === 404 ? t('cases.apiMissingText') : error.message}
          </MessageBarBody>
          <Button onClick={load}>{t('app.retry')}</Button>
        </MessageBar>
      </>
    )
  }
  if (!data) return <>{header}<Spinner label={t('cases.loading')} className="portal-loading" /></>

  const officerName = (id) => data.officers.find((o) => o.id === id)?.name ?? t('cases.unassigned')
  const followUpCount = (c) => detectFollowUps(c, now).length
  const summary = caseSummary(cases, now)
  const findings = cases.flatMap((c) => detectFollowUps(c, now))
    // Critical first, then soonest deadline.
    .sort((a, b) => (b.severity === 'critical') - (a.severity === 'critical') || new Date(a.due ?? 8.64e15) - new Date(b.due ?? 8.64e15))
  const estates = [...new Set(cases.map((c) => c.estate))].sort()

  const q = filters.q.trim().toLowerCase()
  const shown = byPriority(cases, now).filter((c) =>
    (!q || c.number.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) &&
    (!filters.estate || c.estate === filters.estate) &&
    (!filters.urgency || c.urgency === filters.urgency) &&
    (!filters.stage || caseStage(c) === filters.stage) &&
    (!filters.card || CARD_FILTER[filters.card](c, now)))
  const filtered = Object.values(filters).some(Boolean)
  const setFilter = (key) => (_e, d) => setFilters((f) => ({ ...f, [key]: d.value }))
  const openCase = (id, startTab = 'timeline') => { setTab(startTab); setOpenId(id) }
  const opened = cases.find((c) => c.id === openId) ?? null
  const moving = cases.find((c) => c.id === moveId) ?? null
  const startMove = (id, target = '') => { setMoveTarget(target); setMoveId(id) }
  // A drop that needs nothing more moves straight away; anything needing a reason, approval or refusal opens the dialog.
  const dropCase = (id, target) => {
    const kase = cases.find((c) => c.id === id)
    const check = checkTransition(kase, target, me, data.managedOfficerIds)
    if (check.allowed && !check.needsReason && !check.needsApproval) actions.moveStage(id, target, '').catch(() => startMove(id, target))
    else startMove(id, target)
  }
  const viewProps = { cases: shown, followUpCount, officerName, now, onOpen: openCase, onMove: startMove, onDrop: dropCase }

  return (
    <>
      {header}
      <NextUp cases={byPriority(cases, now)} now={now} officerName={officerName} onStart={openCase} />

      <div className="case-summary" role="group" aria-label={t('cases.summary')}>
        {CARDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`case-stat case-stat-${id}`}
            aria-pressed={filters.card === id}
            onClick={() => setFilters((f) => ({ ...f, card: f.card === id ? '' : id }))}
          >
            <span className="case-stat-icon" aria-hidden="true">{CARD_ICONS[id]}</span>
            <span className="case-stat-text">
              <strong>{summary[id]}</strong>
              <span>{t(`cases.card.${id}`)}</span>
            </span>
          </button>
        ))}
      </div>

      <FollowUpRadar findings={findings} now={now} onOpen={(id) => openCase(id)} onAct={(f) => openCase(f.caseId, 'followUps')} />

      <section id="operational" className="panel case-list-panel" aria-labelledby="cases-h">
        <div className="panel-head">
          <h2 id="cases-h">{t('cases.list.title')}</h2>
          <TabList selectedValue={view} onTabSelect={(_e, d) => setView(d.value)} appearance="subtle" className="case-view-switch" aria-label={t('cases.viewMode')}>
            <Tab value="list" icon={<TextBulletListLtr20Regular />}>{t('cases.viewList')}</Tab>
            <Tab value="board" icon={<Board20Regular />}>{t('cases.viewBoard')}</Tab>
          </TabList>
        </div>
        <div className="case-filters">
          <SearchBox value={filters.q} onChange={setFilter('q')} placeholder={t('cases.search')} aria-label={t('cases.search')} />
          <Select value={filters.estate} onChange={setFilter('estate')} aria-label={t('cases.estate')}>
            <option value="">{t('cases.allEstates')}</option>
            {estates.map((e) => <option key={e} value={e}>{e}</option>)}
          </Select>
          <Select value={filters.urgency} onChange={setFilter('urgency')} aria-label={t('cases.col.urgency')}>
            <option value="">{t('cases.allUrgencies')}</option>
            {URGENCIES.map((u) => <option key={u} value={u}>{t(`cases.urgency.${u}`)}</option>)}
          </Select>
          <Select value={filters.stage} onChange={setFilter('stage')} aria-label={t('cases.col.stage')}>
            <option value="">{t('cases.allStages')}</option>
            {STAGES.map((s) => <option key={s} value={s}>{t(`cases.stage.${s}`)}</option>)}
          </Select>
          {filtered && <Button appearance="subtle" onClick={() => setFilters({ q: '', estate: '', urgency: '', stage: '', card: '' })}>{t('cases.clear')}</Button>}
        </div>
        <p className="muted small" aria-live="polite">{t('cases.showing', { n: shown.length, total: cases.length })}</p>
        {cases.length === 0 ? <p className="empty">{t('cases.empty')}</p>
          : shown.length === 0 ? <p className="empty">{t('cases.noMatch')}</p>
            : view === 'list' ? <CaseTable {...viewProps} /> : <CaseBoard {...viewProps} />}
      </section>

      <CaseDetails
        kase={opened} tab={tab} onTab={setTab} onClose={() => setOpenId(null)}
        me={me} now={now} officers={data.officers} officerName={officerName} actions={actions} onMove={startMove}
      />
      <CaseStageDialog
        key={`${moveId}:${moveTarget}`} kase={moving} initialTarget={moveTarget} me={me} managedOfficerIds={data.managedOfficerIds}
        onClose={() => setMoveId(null)} onSubmit={actions.moveStage}
      />
    </>
  )
}
