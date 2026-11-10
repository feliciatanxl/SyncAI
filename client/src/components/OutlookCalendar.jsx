import { useState } from 'react'
import { Badge, Button, Spinner } from '@fluentui/react-components'
import { ArrowSync20Regular, CalendarLtr20Regular, CalendarLtr24Regular, PlugConnected20Regular, ShieldKeyhole20Regular } from '@fluentui/react-icons'
import { GRAPH_SCOPES, clearReturnSection, markReturnSection } from '../auth/msal.js'
import { calendarWindow, errorInfo, formatDuration, formatWhen, getProfile, listEvents } from '../lib/graph.js'
import { useLocale, useT } from '../lib/i18n.js'
import { useGraph, useGraphData } from '../auth/useGraph.js'
import GraphErrorBar from './GraphErrorBar.jsx'

const SHOW_AS_COLOR = { busy: 'danger', oof: 'severe', tentative: 'warning', workingElsewhere: 'informative', free: 'success' }

const who = (profile) => profile?.displayName || profile?.mail || profile?.userPrincipalName

// The next 7 days of events, plus the profile for "Connected as". The profile never triggers consent.
async function fetchCalendar(tokenFor, interactive) {
  const { start, end } = calendarWindow(new Date())
  const [result, profile] = await Promise.all([
    listEvents({ getToken: tokenFor(GRAPH_SCOPES.calendar, interactive), start, end }),
    getProfile(tokenFor(GRAPH_SCOPES.profile)).catch(() => null),
  ])
  return { ...result, profile }
}

// The signed-in person's own Outlook calendar for the next 7 days, read live from Microsoft Graph.
// Read-only and never saved by SyncAI. Rendered only for active accounts (see memberSections).
export default function OutlookCalendar({ me }) {
  const t = useT()
  const locale = useLocale()
  const active = me.status === 'active'
  const { phase, data, error, load } = useGraphData('calendar', 'plan', active, fetchCalendar)

  if (!active) return null
  const { events, profile, truncated } = data ?? {}
  const connected = Boolean(events)

  return (
    <section className="panel cal-panel" aria-labelledby="cal-h" aria-busy={phase === 'loading'}>
      <div className="cal-head">
        <span className="card-icon" aria-hidden="true"><CalendarLtr24Regular /></span>
        <div className="cal-head-text">
          <h2 id="cal-h">{t('cal.title')}</h2>
          <p className="muted">{t('cal.lead')}</p>
        </div>
        <Badge appearance="tint" color={connected ? 'success' : 'informative'} icon={<PlugConnected20Regular />}>
          {connected ? t('cal.live') : t('cal.notConnected')}
        </Badge>
      </div>

      {error && <GraphErrorBar error={error} />}

      <div className="cal-bar">
        {connected ? (
          <>
            <span className="cal-bar-text small muted">{who(profile) && t('cal.connectedAs', { name: who(profile) })}</span>
            {phase === 'loading' && <Spinner size="tiny" label={t('cal.loading')} />}
            <Button icon={<ArrowSync20Regular />} disabled={phase === 'loading'} onClick={() => load()}>{t('cal.refresh')}</Button>
          </>
        ) : phase === 'loading' ? (
          <Spinner size="tiny" label={t('cal.loading')} />
        ) : (
          <>
            <span className="cal-bar-text small"><ShieldKeyhole20Regular aria-hidden="true" />{t('cal.connectHint')}</span>
            <Button appearance="primary" icon={<CalendarLtr20Regular />} onClick={() => load(true)}>{t('cal.connect')}</Button>
          </>
        )}
      </div>

      {connected && events.length === 0 && <p className="cal-empty muted">{t('cal.empty')}</p>}
      {connected && events.length > 0 && (
        <ol className="cal-list">
          {events.map((event) => {
            const when = formatWhen(event, locale)
            return (
              <li key={event.id} className="cal-item">
                <span className="cal-when">
                  <time dateTime={event.start.toISOString()}>{when.date}</time>
                  <span>{when.time ?? t('cal.allDay')}</span>
                </span>
                <span className="cal-what">
                  <strong>{event.subject ?? t('cal.untitled')}</strong>
                  {event.location && <span className="small muted">{event.location}</span>}
                </span>
                <span className="cal-meta">
                  {!event.allDay && <span className="small muted">{formatDuration(event.minutes, locale)}</span>}
                  {event.showAs && <Badge appearance="tint" color={SHOW_AS_COLOR[event.showAs]}>{t(`cal.show.${event.showAs}`)}</Badge>}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {truncated && <p className="cal-foot small muted">{t('cal.truncated', { count: events.length })}</p>}
      {connected && <p className="cal-foot small muted">{t('cal.planNote')}</p>}
    </section>
  )
}

// Admin Settings: checks that Microsoft Graph answers for the admin's own account. Profile only, no calendar.
export function GraphConnectionTest() {
  const t = useT()
  const { tokenFor } = useGraph()
  const [state, setState] = useState({ busy: false, profile: null, error: null })

  async function run() {
    setState({ busy: true, profile: null, error: null })
    markReturnSection('settings')
    try {
      const profile = await getProfile(tokenFor(GRAPH_SCOPES.profile, true))
      clearReturnSection()
      setState({ busy: false, profile, error: null })
    } catch (err) {
      const error = errorInfo(err)
      if (error.kind === 'consent') return
      clearReturnSection()
      setState({ busy: false, profile: null, error })
    }
  }

  return (
    <section className="panel cal-panel graph-test" aria-labelledby="graph-test-h">
      <div className="cal-head">
        <span className="card-icon" aria-hidden="true"><PlugConnected20Regular /></span>
        <div className="cal-head-text">
          <h2 id="graph-test-h">{t('graph.test.title')}</h2>
          <p className="muted">{t('graph.test.lead')}</p>
        </div>
        {state.profile && <Badge appearance="tint" color="success" icon={<PlugConnected20Regular />}>{t('cal.live')}</Badge>}
      </div>
      <div className="cal-bar">
        <span className="cal-bar-text">{state.busy && <Spinner size="tiny" label={t('app.loading')} />}</span>
        <Button icon={<PlugConnected20Regular />} disabled={state.busy} onClick={run}>{t('graph.test.run')}</Button>
      </div>
      {state.error && <GraphErrorBar error={state.error} />}
      {state.profile && (
        <p role="status" className="cal-foot">
          <strong>{t('graph.test.ok')}</strong><br />
          <span className="muted">
            {[state.profile.displayName, state.profile.mail || state.profile.userPrincipalName, state.profile.jobTitle].filter(Boolean).join(' · ')}
          </span>
        </p>
      )}
    </section>
  )
}
