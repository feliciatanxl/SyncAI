import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import monarchPlugin from '@fullcalendar/react/themes/monarch'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/monarch/theme.css'
import {
  Button, MessageBar, MessageBarBody, Spinner, Tooltip,
} from '@fluentui/react-components'
import { Add20Regular, CalendarLtr16Regular, CalendarLtr24Regular, LockClosed16Regular, TaskListLtr20Regular } from '@fluentui/react-icons'
import GraphErrorBar from '../../components/GraphErrorBar.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { apiRequest } from '../../lib/api.js'
import { useLocale, useT } from '../../lib/i18n.js'
import { useNow } from '../../lib/time.js'
import AssignDutyDialog from './AssignDutyDialog.jsx'
import CalendarToolbar from './CalendarToolbar.jsx'
import DutyDetails from './DutyDetails.jsx'
import OutlookEventDetails from './OutlookEventDetails.jsx'
import UnscheduledTasks from './UnscheduledTasks.jsx'
import { calendarEventMap, EVENT_SOURCE } from './calendarEvents.js'
import { DEFAULT_PLANNING_VIEW, PLANNING_ZONE, toPlanningInput, visibleDuties } from './planning.js'
import useOutlookEvents from './useOutlookEvents.js'
import './planning.css'

const PLUGINS = [monarchPlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]
const VIEW_OPTIONS = { timeGridWeek: { displayEventEnd: false, navLinks: true, navLinkDayClick: 'timeGridDay' } }
const EMPTY = { assignments: [], officers: [], categories: [], priorityFactors: [] }
const SIDEBAR_QUERY = '(min-width: 70rem)'
const hasSidebarSpace = () => window.matchMedia(SIDEBAR_QUERY).matches
function subscribeSidebarSpace(onChange) {
  const media = window.matchMedia(SIDEBAR_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function hourWindow(events) {
  let start = 8
  let end = 18
  for (const { start: startsAt, end: endsAt, allDay } of events) {
    if (allDay) continue
    const [startDay, startTime] = toPlanningInput(startsAt).split('T')
    const [endDay, endTime] = toPlanningInput(endsAt).split('T')
    start = Math.min(start, startDay === endDay ? Number(startTime.slice(0, 2)) : 0)
    const endHour = Number(endTime.slice(0, 2)) + Number(endTime.slice(3) !== '00' || Date.parse(endsAt) % 60_000 !== 0)
    end = Math.max(end, startDay === endDay ? endHour : 24)
  }
  return [start, end].map((hour) => String(hour).padStart(2, '0') + ':00')
}

export default function TeamCalendar({ me, getToken }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const manager = me.role === 'manager'
  const calendar = useRef(null)
  const tasksButton = useRef(null)
  const wide = useSyncExternalStore(subscribeSidebarSpace, hasSidebarSpace, () => false)
  const [{ mine, scopeRevision }, setScope] = useState({ mine: true, scopeRevision: 0 })
  const [period, setPeriod] = useState(null)
  const [selectedOfficers, setSelectedOfficers] = useState([])
  const [category, setCategory] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState(null)
  const [edit, setEdit] = useState(null)
  const [details, setDetails] = useState(null)
  const [outlookDetails, setOutlookDetails] = useState(null)
  const [notice, setNotice] = useState('')
  const [backlogPreference, setBacklogPreference] = useState(null)
  const [allHours, setAllHours] = useState(false)
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    timeZone: PLANNING_ZONE, dateStyle: 'medium', timeStyle: 'short',
  }), [locale])
  const weekFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    timeZone: PLANNING_ZONE, month: 'short', day: 'numeric', year: 'numeric',
  }), [locale])
  const weekdays = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: PLANNING_ZONE, weekday: 'short' }), [locale])
  const days = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: PLANNING_ZONE, day: 'numeric' }), [locale])
  const deadlineFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: PLANNING_ZONE, month: 'short', day: 'numeric' }), [locale])
  const formatTime = (value) => formatter.format(new Date(value)) + ' SGT'
  const allDayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium' }), [locale])
  const outlook = useOutlookEvents(mine && me.status === 'active', period, scopeRevision)

  const datesSet = useCallback(({ start, end, view: current }) => {
    const range = { start: start.toISOString(), end: end.toISOString() }
    const query = new URLSearchParams(range).toString()
    const title = current.type === 'timeGridWeek' ? weekFormatter.formatRange(start, new Date(+end - 1)) : current.title
    setPeriod((previous) => previous?.query === query && previous.title === title && previous.view === current.type
      ? previous : { ...range, query, title, view: current.type, revision: (previous?.revision ?? 0) + 1 })
  }, [weekFormatter])
  const query = period?.query
  const view = period?.view ?? DEFAULT_PLANNING_VIEW
  useEffect(() => {
    if (!query) return undefined
    const controller = new AbortController()
    apiRequest('/planning/calendar?' + query, { getToken, signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ query, refresh, data }) },
      (error) => {
        if (!controller.signal.aborted) setResult({ query, refresh, error: error.message, status: error.status })
      },
    )
    return () => controller.abort()
  }, [query, refresh, getToken])

  const current = result?.query === query && result?.refresh === refresh ? result : null
  const loading = !current
  const { assignments } = current?.data ?? EMPTY
  const { officers, categories, priorityFactors } = current?.data ?? (loading ? result?.data : null) ?? EMPTY
  const eligible = manager ? officers.filter(({ id }) => id !== me.id) : []
  const selections = selectedOfficers.filter((id) => officers.some((officer) => officer.id === id))
  const visibility = { mine, userId: me.id, officers: selections, category }
  const shown = visibleDuties(assignments, visibility)
  const fixed = shown.filter(({ status }) => status === 'protected')
  const backlog = shown.filter(({ status }) => status === 'unscheduled')
  const previousBacklog = loading && result?.data
    ? visibleDuties(result.data.assignments, visibility).filter(({ status }) => status === 'unscheduled').length : 0
  const taskCount = loading ? previousBacklog : backlog.length
  const backlogOpen = backlogPreference ?? (wide && taskCount > 0)
  const canAssign = eligible.length > 0
  const hasTeam = me.teams?.some(({ kind }) => kind === me.role)
  const accessDenied = current?.status === 401 || current?.status === 403
  const assignmentHint = loading ? 'Loading the team roster…'
    : accessDenied ? 'Your account does not have access to duty assignments.'
      : current?.error ? 'Reload the calendar to check which officers can be assigned.'
        : hasTeam === false ? 'Ask an administrator to assign you a team to manage.' : 'No active officers are available on the teams you manage.'
  const eventMap = calendarEventMap({ duties: fixed, outlook: mine ? outlook.events ?? [] : [], outlookLabels: {
    busy: t('cal.show.busy'), untitled: t('cal.untitled'),
  } })
  const events = [...eventMap.values()].map(({ input }) => input)
  const [startHour, endHour] = hourWindow(events)
  const needsAllHours = startHour === '00:00' && endHour === '24:00'
  const fullDay = allHours || needsAllHours
  const outlookStatus = {
    hidden: 'Outlook · My Calendar only', loading: 'Loading Outlook', disconnected: 'Outlook not connected',
    error: 'Outlook unavailable', ready: outlook.truncated ? 'Outlook incomplete' : 'Outlook loaded',
  }[outlook.phase]
  const showConnect = mine && outlook.phase === 'disconnected' && !outlook.error
  const outlookComplete = !mine || (outlook.phase === 'ready' && !outlook.truncated)
  const emptyMessage = !current?.data || events.length || !outlookComplete ? ''
    : !mine && hasTeam === false ? (manager ? 'You don’t manage a team yet.' : 'You haven’t been assigned to a team.')
      : category || (!mine && selections.length) ? 'No events match this view.' : 'No events in this period.'

  function closeBacklog() {
    setBacklogPreference(false)
    if (wide) tasksButton.current?.focus()
  }

  function selectScope(nextMine) {
    setScope((old) => old.mine === nextMine ? old : { mine: nextMine, scopeRevision: old.scopeRevision + 1 })
  }

  function openAssignment(start = null) {
    if (!canAssign) return
    setNotice('')
    const selected = selections.length === 1 && eligible.some(({ id }) => id === selections[0]) ? selections[0] : ''
    setEdit({ officerId: selected || (eligible.length === 1 ? eligible[0].id : ''), start })
  }

  async function save(duty, input) {
    await apiRequest('/planning/assignments' + (duty ? '/' + duty.id : ''), {
      getToken,
      method: duty ? 'PATCH' : 'POST',
      body: duty ? { ...input, revision: duty.revision } : input,
    })
    setEdit(null)
    setRefresh((value) => value + 1)
    setNotice(duty ? 'Duty assignment updated.' : input.type === 'fixed'
      ? 'Protected duty assigned.' : 'Duty assigned to the officer’s Unscheduled Tasks.')
  }

  async function cancel(duty) {
    await apiRequest('/planning/assignments/' + duty.id, {
      getToken, method: 'PATCH', body: { revision: duty.revision, cancel: true },
    })
    setDetails(null)
    setRefresh((value) => value + 1)
    setNotice('Duty assignment cancelled.')
  }

  return (
    <div className="planning-page">
      <PageHeader
        icon={<CalendarLtr24Regular />}
        title={locale === 'en-SG' ? 'My Plan' : t('nav.plan')}
        description="Your schedule and operational duties."
      >
        <Button ref={tasksButton} icon={<TaskListLtr20Regular />} appearance="secondary" className={backlogOpen ? undefined : 'hero-button'}
          aria-label={'Unscheduled Tasks, ' + taskCount} aria-expanded={backlogOpen} aria-controls="planning-backlog"
          aria-haspopup={wide ? undefined : 'dialog'} onClick={() => setBacklogPreference(!backlogOpen)}>
          <span><span className="planning-task-prefix">Unscheduled </span>Tasks</span>
          <span className="planning-task-count" aria-hidden="true">{taskCount}</span>
        </Button>
        {manager && (canAssign ? (
          <Button appearance="secondary" icon={<Add20Regular />} onClick={() => openAssignment()}>Assign duty</Button>
        ) : (
          <Tooltip relationship="description" content={assignmentHint}>
            <Button appearance="secondary" icon={<Add20Regular />} disabledFocusable>Assign duty</Button>
          </Tooltip>
        ))}
      </PageHeader>

      <CalendarToolbar calendar={calendar} period={period} mine={mine} onScope={selectScope}
        filters={{ officers, selections, onOfficers: setSelectedOfficers, categories, category, onCategory: setCategory }}
        hours={{ fullDay, required: needsAllHours, toggle: () => setAllHours((show) => !show) }}
        outlook={outlook} outlookStatus={outlookStatus} />

      {(notice || current?.error || outlook.error || outlook.truncated || showConnect) && (
        <div className="planning-messages">
          {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
          {outlook.error && <GraphErrorBar error={outlook.error} />}
          {outlook.truncated && <MessageBar intent="warning"><MessageBarBody>Outlook data is incomplete for this period. Availability is unknown.</MessageBarBody></MessageBar>}
          {showConnect && (
            <div className="planning-connect">
              <span>Connect Outlook to see meetings in your calendar.</span>
              <Button size="small" appearance="subtle" onClick={() => outlook.refresh(true)}>Connect Outlook</Button>
            </div>
          )}
          {current?.error && (
            <MessageBar intent={accessDenied ? 'warning' : 'error'}>
              <MessageBarBody>
                <strong>{accessDenied ? 'Calendar access restricted.' : 'Couldn’t load duties.'}</strong> {current.error}{' '}
                <Button size="small" onClick={() => setRefresh((value) => value + 1)}>{t('app.retry')}</Button>
              </MessageBarBody>
            </MessageBar>
          )}
        </div>
      )}

      <div className="planning-layout" data-sidebar-open={wide && backlogOpen}>
        <section className="planning-calendar" aria-labelledby="planning-calendar-period" aria-busy={loading}>
          <div className="planning-calendar-grid" data-view={view}>
            <FullCalendar
              ref={calendar}
              plugins={PLUGINS}
              timeZone={PLANNING_ZONE}
              initialView={DEFAULT_PLANNING_VIEW}
              headerToolbar={false}
              firstDay={1}
              editable={false}
              height="auto"
              allDaySlot={events.some((event) => event.allDay)}
              slotDuration="00:30"
              slotMinHeight={26}
              slotHeaderInterval="01:00"
              slotHeaderFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              slotHeaderInnerClass="planning-slot-time"
              slotMinTime={fullDay ? '00:00' : startHour}
              slotMaxTime={fullDay ? '24:00' : endHour}
              eventMinHeight={20}
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              views={VIEW_OPTIONS}
              nowIndicator
              dayMaxEvents={3}
              dayLaneClass={({ isToday, dow }) => isToday ? 'planning-lane-today' : dow === 0 || dow === 6 ? 'planning-lane-weekend' : ''}
              dayHeaderContent={({ date, isToday, view: calendarView, text }) => calendarView.type === 'dayGridMonth' ? text : (
                <span className="planning-day" data-today={isToday}>
                  <span>{weekdays.format(date)}</span><strong>{days.format(date)}</strong>
                </span>
              )}
              datesSet={datesSet}
              dateClick={({ date }) => openAssignment(date)}
              events={events}
              eventClick={({ event }) => {
                const entry = eventMap.get(event.id)
                if (!entry) return
                if (event.extendedProps.source === EVENT_SOURCE.outlook) setOutlookDetails(entry)
                else setDetails(entry.data)
              }}
              eventContent={({ event, timeText }) => {
                const data = eventMap.get(event.id)?.data
                const personal = event.extendedProps.source === EVENT_SOURCE.outlook
                const Icon = personal ? CalendarLtr16Regular : LockClosed16Regular
                const roomy = view === 'timeGridWeek' && !event.allDay && event.end - event.start >= 45 * 60_000
                return (
                  <span className="planning-event" data-source={event.extendedProps.source} data-roomy={roomy} title={event.title}>
                    <strong><Icon aria-hidden="true" /><span className="visually-hidden">{personal ? 'Outlook: ' : 'Protected duty: '}</span>{event.title}</strong>
                    {timeText && <span className="planning-event-time">{timeText}</span>}
                    {!mine && data?.officerName && <span className="planning-event-officer">{data.officerName}</span>}
                  </span>
                )
              }}
            />
          </div>
          <div className="planning-calendar-footer">
            {loading ? <Spinner size="tiny" label="Loading duties" /> : emptyMessage && <span role="status">{emptyMessage}</span>}
            <span className="planning-zone-caption" title="Singapore time">SGT</span>
          </div>
        </section>

        <UnscheduledTasks wide={wide} open={backlogOpen} onClose={closeBacklog} tasks={backlog}
          loading={loading} error={current?.error} accessDenied={accessDenied} filtered={Boolean(category || (!mine && selections.length))}
          mine={mine} priorityFactors={priorityFactors} now={now}
          deadlineLabel={(date) => deadlineFormatter.format(new Date(date))}
          viewDuty={(duty) => { if (!wide) closeBacklog(); setDetails(duty) }} />
      </div>
      {mine && outlookDetails && (
        <OutlookEventDetails event={outlookDetails.data} title={outlookDetails.input.title} formatTime={formatTime}
          formatAllDay={({ start, end }) => allDayFormatter.formatRange(start, new Date(+end - 1))}
          onClose={() => setOutlookDetails(null)} />
      )}
      {details && (
        <DutyDetails duty={details} priorityFactors={priorityFactors} formatTime={formatTime}
          onClose={() => setDetails(null)} onCancel={cancel}
          onEdit={(duty) => { setDetails(null); setEdit({ duty }); setNotice('') }} />
      )}
      {edit && (
        <AssignDutyDialog options={edit} officers={edit.duty ? eligible.filter(({ teamId }) => teamId === edit.duty.teamId) : eligible}
          categories={categories} priorityFactors={priorityFactors}
          onClose={() => setEdit(null)} onSave={save} />
      )}
    </div>
  )
}

