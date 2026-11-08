import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, MessageBar, MessageBarBody, MessageBarTitle, Select, Spinner } from '@fluentui/react-components'
import {
  ArrowClockwise20Regular, ArrowEnterLeft20Regular, History24Regular, Checkmark20Regular, DismissCircle20Regular, History20Regular, LockClosed20Regular,
  LockOpen20Regular, Open20Regular, PersonAdd20Regular, PersonEdit20Regular, ShieldTask20Regular, SignOut20Regular,
} from '@fluentui/react-icons'
import { apiRequest } from '../lib/api.js'
import PageHeader, { HeroStat } from './PageHeader.jsx'
import { useLocale, useT } from '../lib/i18n.js'
import { useNow } from '../lib/time.js'

const ACTIONS = ['signed_up', 'signed_in', 'opened', 'signed_out', 'approved', 'declined', 'role_changed', 'access_off', 'access_on', 'status_changed']
const ICON = {
  signed_up: <PersonAdd20Regular />,
  signed_in: <ArrowEnterLeft20Regular />,
  opened: <Open20Regular />,
  signed_out: <SignOut20Regular />,
  approved: <Checkmark20Regular />,
  declined: <DismissCircle20Regular />,
  role_changed: <PersonEdit20Regular />,
  access_off: <LockClosed20Regular />,
  access_on: <LockOpen20Regular />,
  status_changed: <ShieldTask20Regular />,
}
const TONE = { approved: 'tone-good', access_on: 'tone-good', declined: 'tone-bad', access_off: 'tone-bad', role_changed: 'tone-info', status_changed: 'tone-info' }
const PAGE = 50

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// The audit trail for admins: who signed in and who changed whose access, newest first, grouped by day.
export default function ActivityLog({ getToken, people, nameOf }) {
  const t = useT()
  const locale = useLocale()
  const [person, setPerson] = useState('')
  const [action, setAction] = useState('')
  const [items, setItems] = useState(null)
  const [nextBefore, setNextBefore] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const now = useNow()

  const fetchPage = useCallback((before, signal) => {
    const query = new URLSearchParams({ limit: String(PAGE) })
    if (person) query.set('person', person)
    if (action) query.set('action', action)
    if (before) query.set('before', before)
    return apiRequest(`/activity?${query}`, { getToken, signal })
  }, [getToken, person, action])

  // Reloads from the top whenever the filters change.
  useEffect(() => {
    const controller = new AbortController()
    fetchPage(null, controller.signal).then(
      (page) => { setItems(page.items); setNextBefore(page.nextBefore); setError(null) },
      (err) => err.name !== 'AbortError' && setError(err),
    )
    return () => controller.abort()
  }, [fetchPage])

  async function more(reset) {
    setLoading(true)
    try {
      const page = await fetchPage(reset ? null : nextBefore)
      setItems((list) => (reset ? page.items : [...list, ...page.items]))
      setNextBefore(page.nextBefore)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  // Summary for the header, from the entries loaded below.
  const today = (items ?? []).filter((e) => dayKey(new Date(e.at)) === dayKey(now))

  const who = useCallback((e, side) => e[`${side}Name`] || e[`${side}Email`] || t('activity.unknown'), [t])
  const sentence = (e) =>
    t(`activity.${e.action}`, {
      actor: who(e, 'actor'),
      target: who(e, 'target'),
      role: e.details?.role ? t(`role.${e.details.role}`) : '',
      from: e.details?.from ? t(e.action === 'role_changed' ? `role.${e.details.from}` : `status.${e.details.from}`) : '',
      to: e.details?.to ? t(e.action === 'role_changed' ? `role.${e.details.to}` : `status.${e.details.to}`) : '',
    })

  // Day headings: "Today", "Yesterday", then the full date.
  const groups = useMemo(() => {
    const today = now
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const capital = (s) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
    const label = (d) =>
      dayKey(d) === dayKey(today) ? capital(rtf.format(0, 'day'))
        : dayKey(d) === dayKey(yesterday) ? capital(rtf.format(-1, 'day'))
          : d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const out = []
    for (const e of items ?? []) {
      const d = new Date(e.at)
      if (out.at(-1)?.key !== dayKey(d)) out.push({ key: dayKey(d), label: label(d), entries: [] })
      out.at(-1).entries.push(e)
    }
    return out
  }, [items, locale, now])

  return (
    <>
      <PageHeader icon={<History24Regular />} title={t('nav.activity')} description={t('activity.lead')}>
        <HeroStat value={items ? today.length : '–'} label={t('activity.stat.today')} />
        <HeroStat value={items ? new Set(today.map((e) => e.actorId)).size : '–'} label={t('activity.stat.people')} />
      </PageHeader>

      <div className="activity-tools">
        <label className="activity-filter">
          <span>{t('activity.filterPerson')}</span>
          <Select value={person} onChange={(_e, d) => setPerson(d.value)}>
            <option value="">{t('activity.allPeople')}</option>
            {(people ?? []).map((u) => <option key={u.id} value={u.id}>{nameOf(u)}</option>)}
          </Select>
        </label>
        <label className="activity-filter">
          <span>{t('activity.filterType')}</span>
          <Select value={action} onChange={(_e, d) => setAction(d.value)}>
            <option value="">{t('activity.allTypes')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{t(`activity.type.${a}`)}</option>)}
          </Select>
        </label>
        <Button icon={<ArrowClockwise20Regular />} disabled={loading} onClick={() => more(true)}>{t('btn.refresh')}</Button>
      </div>

      {error && (
        <MessageBar intent="error" className="portal-error">
          <MessageBarBody><MessageBarTitle>{t('err.loadActivity')}</MessageBarTitle>{error.message}</MessageBarBody>
        </MessageBar>
      )}

      {items == null && !error ? (
        <div className="panel"><Spinner size="small" label={t('app.loading')} /></div>
      ) : items?.length === 0 ? (
        <div className="panel empty">
          <History20Regular />
          <p>{t('activity.empty')}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="activity-day" aria-label={g.label}>
            <h2>{g.label}</h2>
            <ol className="activity-list panel">
              {g.entries.map((e) => {
                const at = new Date(e.at)
                return (
                  <li key={e.id} className={`activity-item ${TONE[e.action] ?? ''}`}>
                    <span className="activity-icon" aria-hidden="true">{ICON[e.action] ?? <History20Regular />}</span>
                    <span className="activity-text">{sentence(e)}</span>
                    <time dateTime={at.toISOString()} title={at.toLocaleString(locale)}>
                      {at.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
                    </time>
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}

      {nextBefore && (
        <div className="activity-more">
          <Button disabled={loading} onClick={() => more(false)}>{t('activity.loadMore')}</Button>
        </div>
      )}
    </>
  )
}
