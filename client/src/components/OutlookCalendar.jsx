import { useCallback, useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { Badge, Button, MessageBar, MessageBarBody, Spinner } from '@fluentui/react-components'
import { ArrowSync20Regular, CalendarLtr20Regular, CalendarLtr24Regular, PlugConnected20Regular, ShieldKeyhole20Regular } from '@fluentui/react-icons'
import { GRAPH_SCOPES, getGraphToken, markReturnSection, clearReturnSection } from '../auth/msal.js'
import { calendarWindow, errorKind, formatDuration, formatWhen, getProfile, listEvents } from '../lib/graph.js'
import { useLocale, useT } from '../lib/i18n.js'

const SHOW_AS_COLOR = { busy: 'danger', oof: 'severe', tentative: 'warning', workingElsewhere: 'informative', free: 'success' }

// Graph token getters for the signed-in account. Only `interactive` ones may send the person to Microsoft.
function useGraph() {
  const { instance } = useMsal()
  const accountId = (instance.getActiveAccount() ?? instance.getAllAccounts()[0])?.homeAccountId
  return useCallback(
    (scopes, interactive = false) => () =>
      getGraphToken(instance, accountId ? instance.getAccount({ homeAccountId: accountId }) : null, scopes, { interactive }),
    [instance, accountId],
  )
}

const who = (profile) => profile?.displayName || profile?.mail || profile?.userPrincipalName

// The signed-in person's own Outlook calendar for the next 7 days, read live from Microsoft Graph.
// Read-only and never saved by SyncAI. Rendered only for active accounts (see memberSections).
export default function OutlookCalendar({ me }) {
  const t = useT()
  const locale = useLocale()
  const tokenFor = useGraph()
  const [state, setState] = useState({ phase: 'loading', events: null, profile: null, truncated: false, error: null })

  // Resolves with the next state (as a setState updater) rather than setting it, so callers decide when.
  const fetchEvents = useCallback(async (interactive = false) => {
    if (interactive) markReturnSection('plan')
    try {
      const { start, end } = calendarWindow(new Date())
      const [result, profile] = await Promise.all([
        listEvents({ getToken: tokenFor(GRAPH_SCOPES.calendar, interactive), start, end }),
        getProfile(tokenFor(GRAPH_SCOPES.profile)).catch(() => null),
      ])
      clearReturnSection()
      return () => ({ phase: 'ready', ...result, profile, error: null })
    } catch (err) {
      const kind = errorKind(err)
      // Consent needed after a click means the browser is already on its way to Microsoft: keep the spinner.
      if (kind === 'consent' && interactive) return (s) => s
      clearReturnSection()
      // Not yet connected is a normal starting state, not an error.
      return (s) => ({ ...s, phase: s.events ? 'ready' : 'idle', error: kind === 'consent' ? null : kind })
    }
  }, [tokenFor])
  const load = (interactive) => {
    setState((s) => ({ ...s, phase: 'loading', error: null }))
    fetchEvents(interactive).then(setState)
  }

  // Silent check on arrival: shows the calendar straight away for people who already connected it.
  const active = me.status === 'active'
  useEffect(() => {
    if (!active) return undefined
    let live = true
    fetchEvents().then((next) => live && setState(next))
    return () => { live = false }
  }, [active, fetchEvents])

  if (!active) return null
  const { phase, events, profile, truncated, error } = state
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

      {error && (
        <MessageBar intent={error === 'cancelled' ? 'warning' : 'error'} className="cal-error">
          <MessageBarBody>{t(`graph.err.${error}`)}</MessageBarBody>
        </MessageBar>
      )}

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
  const tokenFor = useGraph()
  const [state, setState] = useState({ busy: false, profile: null, error: null })

  async function run() {
    setState({ busy: true, profile: null, error: null })
    markReturnSection('settings')
    try {
      const profile = await getProfile(tokenFor(GRAPH_SCOPES.profile, true))
      clearReturnSection()
      setState({ busy: false, profile, error: null })
    } catch (err) {
      const kind = errorKind(err)
      if (kind === 'consent') return
      clearReturnSection()
      setState({ busy: false, profile: null, error: kind })
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
      {state.error && (
        <MessageBar intent={state.error === 'cancelled' ? 'warning' : 'error'} className="cal-error">
          <MessageBarBody>{t(`graph.err.${state.error}`)}</MessageBarBody>
        </MessageBar>
      )}
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
