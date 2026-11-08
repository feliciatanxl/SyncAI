import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar, Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  MessageBar, MessageBarBody, MessageBarTitle, SearchBox, Select, Skeleton, SkeletonItem, Tab, TabList,
  Toast, ToastTitle, Toaster, useId, useToastController,
} from '@fluentui/react-components'
import {
  ArrowClockwise20Regular, ArrowRight16Regular, ChatSparkle20Regular, BrainCircuit24Regular, Checkmark20Regular, CheckmarkCircle24Regular, Copy20Regular, Grid20Regular,
  Info20Regular, People20Regular, People24Regular, PeopleCheckmark24Regular, PersonClock24Regular, PersonProhibited20Regular,
  History20Regular, PeopleTeam20Regular, Settings20Regular, ShieldCheckmark24Regular, Sparkle20Regular, ArrowCounterclockwise20Regular,
} from '@fluentui/react-icons'
import ActivityLog from '../components/ActivityLog.jsx'
import TeamsAdmin from '../components/TeamsAdmin.jsx'
import AssistantChat from '../components/AssistantChat.jsx'
import HowItDecides from '../components/HowItDecides.jsx'
import PageHeader, { HeroStat } from '../components/PageHeader.jsx'
import PortalShell from '../components/PortalShell.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import { apiRequest } from '../lib/api.js'
import { useLocale, useT } from '../lib/i18n.js'
import { greetingKey, greetingName, relativeTime, useNow } from '../lib/time.js'

const SECTIONS = [
  { id: 'overview', icon: <Grid20Regular /> },
  { id: 'assistant', icon: <ChatSparkle20Regular /> },
  { id: 'people', icon: <People20Regular /> },
  { id: 'teams', icon: <PeopleTeam20Regular /> },
  { id: 'activity', icon: <History20Regular /> },
  { id: 'decides', icon: <Sparkle20Regular /> },
  { id: 'settings', icon: <Settings20Regular /> },
]
const STATUS_COLOR = { pending: 'warning', active: 'success', disabled: 'subtle' }
const FILTERS = ['all', 'pending', 'active', 'disabled']
const ROLE_KEYS = ['admin', 'manager', 'member']
// Team places a role change would drop: managers lead teams, team members belong to one, admins to none.
const KEEPS = { manager: 'manager', member: 'member' }
const teamsLostBy = (user, newRole) => (user.teams ?? []).filter((team) => team.kind !== KEEPS[newRole])
const FACTOR_NUMBERS = [1, 2, 3, 4]

function updatedLabel(t, locale, updatedAt, now) {
  const minutes = Math.floor((now - updatedAt) / 60_000)
  if (minutes < 1) return t('updated.now')
  return t('updated.ago', { when: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-minutes, 'minute') })
}

export default function AdminPortal({ me, photo, chat, tenantId, getToken, onSignOut, onSwitchAccount }) {
  const t = useT()
  const [section, setSection] = useState('overview')
  const [users, setUsers] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [roleConfirm, setRoleConfirm] = useState(null)
  const toasterId = useId('toaster')
  const { dispatchToast } = useToastController(toasterId)
  const nameOf = useCallback((u) => u.displayName || u.email || t('app.unnamed'), [t])

  const notify = useCallback((title, intent = 'success') => {
    dispatchToast(<Toast><ToastTitle>{title}</ToastTitle></Toast>, { intent, position: 'bottom-end' })
  }, [dispatchToast])

  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const now = useNow()

  // Resolves true on success. A background refresh that fails keeps the list on screen;
  // the "Updated … ago" label then shows honestly how old it is.
  const load = useCallback((signal, background = false) =>
    apiRequest('/users', { getToken, signal }).then(
      (list) => {
        setUsers(list)
        setUpdatedAt(new Date())
        return true
      },
      (err) => {
        if (err.name !== 'AbortError' && !background) setLoadError(err)
        return false
      },
    ), [getToken])

  // Keeps the list current: every minute while the tab is visible, and straight away when you come back to it.
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    const refresh = () => document.visibilityState === 'visible' && load(controller.signal, true)
    const timer = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  async function refreshNow() {
    setRefreshing(true)
    const ok = await load(undefined, true)
    setRefreshing(false)
    if (!ok) notify(t('toast.refreshFailed'), 'error')
  }

  async function change(user, patch, message) {
    setBusyId(user.id)
    try {
      const updated = await apiRequest(`/users/${user.id}`, { method: 'PATCH', body: patch, getToken })
      setUsers((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
      notify(message)
      load(undefined, true)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const role = (key) => t(`role.${key}`)
  const actions = {
    approve: (u, r = 'member') => change(u, { status: 'active', role: r }, t('toast.approved', { name: nameOf(u), role: role(r) })),
    setRole: (u, r) => (teamsLostBy(u, r).length
      ? setRoleConfirm({ user: u, role: r })
      : change(u, { role: r }, t('toast.roleChanged', { name: nameOf(u), role: role(r) }))),
    restore: (u) => change(u, { status: 'active' }, t('toast.restored', { name: nameOf(u) })),
    turnOff: (u) => setConfirm(u),
  }

  const pending = users?.filter((u) => u.status === 'pending') ?? []
  const shared = { me, users, busyId, actions, nameOf }

  return (
    <PortalShell
      tag={t('tag.admin')}
      sections={SECTIONS}
      section={section}
      onSection={setSection}
      badges={{
        people: pending.length > 0 && (
          <Badge size="small" color="warning" aria-label={t('nav.waiting', { n: pending.length })}>{pending.length}</Badge>
        ),
      }}
      account={{ name: nameOf(me), email: me.email, photo, tenantId, onSwitchAccount, onSignOut }}
    >
      <Toaster toasterId={toasterId} />
      {section === 'settings' ? (
        <SettingsPanel onReset={() => notify(t('settings.resetDone'))} />
      ) : loadError ? (
        <MessageBar intent="error" className="portal-error">
          <MessageBarBody>
            <MessageBarTitle>{t('err.loadTeam')}</MessageBarTitle>
            {loadError.message}
          </MessageBarBody>
          <Button size="small" onClick={() => { setLoadError(null); load() }}>{t('app.retry')}</Button>
        </MessageBar>
      ) : section === 'overview' ? (
        <Overview {...shared} pending={pending} goTo={setSection} notify={notify} now={now} updatedAt={updatedAt} refreshing={refreshing} onRefresh={refreshNow} />
      ) : section === 'people' ? (
        <PeopleSection {...shared} now={now} />
      ) : section === 'assistant' ? (
        <AssistantChat me={me} name={nameOf(me)} chat={chat} goTo={setSection} available={SECTIONS.map((s) => s.id)} />
      ) : section === 'teams' ? (
        <TeamsAdmin getToken={getToken} people={users} nameOf={nameOf} notify={notify} onPeopleChanged={() => load(undefined, true)} />
      ) : section === 'activity' ? (
        <ActivityLog getToken={getToken} people={users} nameOf={nameOf} />
      ) : (
        <HowItDecides />
      )}

      <Dialog open={Boolean(confirm)} onOpenChange={(_e, data) => !data.open && setConfirm(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{confirm && t('confirm.title', { name: nameOf(confirm) })}</DialogTitle>
            <DialogContent>{t('confirm.body')}</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirm(null)}>{t('confirm.keep')}</Button>
              <Button
                appearance="primary"
                onClick={() => {
                  const u = confirm
                  setConfirm(null)
                  change(u, { status: 'disabled' }, t('toast.turnedOff', { name: nameOf(u) }))
                }}
              >
                {t('btn.turnOff')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={Boolean(roleConfirm)} onOpenChange={(_e, data) => !data.open && setRoleConfirm(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{roleConfirm && t('confirm.roleTitle', { name: nameOf(roleConfirm.user), role: role(roleConfirm.role) })}</DialogTitle>
            <DialogContent>
              {roleConfirm && t('confirm.roleBody', { teams: teamsLostBy(roleConfirm.user, roleConfirm.role).map((team) => team.name).join(', ') })}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setRoleConfirm(null)}>{t('teams.cancel')}</Button>
              <Button
                appearance="primary"
                onClick={() => {
                  const { user, role: next } = roleConfirm
                  setRoleConfirm(null)
                  change(user, { role: next }, t('toast.roleChanged', { name: nameOf(user), role: role(next) }))
                }}
              >
                {t('confirm.roleOk')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </PortalShell>
  )
}

function Overview({ me, users, pending, busyId, actions, goTo, notify, nameOf, now, updatedAt, refreshing, onRefresh }) {
  const t = useT()
  const locale = useLocale()
  const count = (fn) => users?.filter(fn).length
  const stats = [
    { key: 'people', value: users?.length, icon: <People24Regular /> },
    { key: 'pending', value: pending.length, icon: <PersonClock24Regular />, tone: pending.length ? 'warn' : '' },
    { key: 'active', value: count((u) => u.status === 'active'), icon: <PeopleCheckmark24Regular /> },
    { key: 'managers', value: count((u) => u.role === 'manager' && u.status === 'active'), icon: <ShieldCheckmark24Regular /> },
  ]
  const inviteUrl = `${window.location.origin}/login`

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      notify(t('toast.copied'))
    } catch {
      notify(t('toast.copyFailed'), 'error')
    }
  }

  return (
    <>
      <section className="portal-hero" aria-labelledby="hero-h">
        <div>
          <p className="portal-hero-date">
            <time dateTime={now.toISOString()}>
              {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {now.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
            </time>
          </p>
          <h1 id="hero-h">{t(greetingKey(now), { name: greetingName(nameOf(me)) })}</h1>
          <p>
            {users == null
              ? t('hero.loading')
              : pending.length === 1
                ? t('hero.pendingOne')
                : pending.length
                  ? t('hero.pendingMany', { n: pending.length })
                  : t('hero.caughtUp')}
          </p>
        </div>
        <div className="portal-hero-usp">
          <BrainCircuit24Regular />
          <span><strong>{t('usp.name')}</strong> {t('usp.short')}</span>
        </div>
      </section>

      <ul className="stat-grid" aria-label={t('stat.summary')}>
        {stats.map((s) => (
          <li key={s.key} className={`stat-card ${s.tone || ''}`}>
            <span className="stat-icon" aria-hidden="true">{s.icon}</span>
            <span className="stat-label">{t(`stat.${s.key}`)}</span>
            <span className="stat-value">{s.value ?? <Skeleton><SkeletonItem size={28} style={{ width: 40 }} /></Skeleton>}</span>
            <span className="stat-hint">{t(`stat.${s.key}Hint`)}</span>
          </li>
        ))}
      </ul>

      <div className="portal-grid">
        <section className="panel" aria-labelledby="queue-h">
          <div className="panel-head">
            <h2 id="queue-h">{t('queue.title')}</h2>
            <div className="panel-tools">
              {updatedAt && <span className="updated-label">{updatedLabel(t, locale, updatedAt, now)}</span>}
              <Button appearance="subtle" icon={<ArrowClockwise20Regular />} disabled={refreshing} onClick={onRefresh} aria-label={t('btn.refresh')} title={t('btn.refresh')} />
              <Button appearance="transparent" onClick={() => goTo('people')}>{t('queue.seeAll')}</Button>
            </div>
          </div>
          {users == null ? (
            <PanelSkeleton />
          ) : pending.length === 0 ? (
            <div className="empty">
              <CheckmarkCircle24Regular />
              <p><strong>{t('queue.empty')}</strong><br />{t('queue.emptyHint')}</p>
            </div>
          ) : (
            <ul className="queue">
              {pending.map((u) => (
                <li key={u.id}>
                  <Avatar name={nameOf(u)} size={36} color="colorful" />
                  <span className="queue-who">
                    <strong>{nameOf(u)}</strong>
                    <span className="muted small">{u.email}</span>
                  </span>
                  <span className="queue-actions">
                    <Button appearance="primary" icon={<Checkmark20Regular />} disabled={busyId === u.id} onClick={() => actions.approve(u, 'member')} aria-label={t('aria.approveMember', { name: nameOf(u) })}>
                      {t('btn.approve')}
                    </Button>
                    <Button disabled={busyId === u.id} onClick={() => actions.approve(u, 'manager')} aria-label={t('aria.approveManager', { name: nameOf(u) })}>
                      {t('btn.asManager')}
                    </Button>
                    <Button appearance="subtle" icon={<PersonProhibited20Regular />} disabled={busyId === u.id} onClick={() => actions.turnOff(u)} aria-label={t('aria.decline', { name: nameOf(u) })}>
                      <span className="hide-sm">{t('btn.decline')}</span>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="invite-h">
          <h2 id="invite-h">{t('invite.title')}</h2>
          <ol className="steps-list">
            <li>{t('invite.step1')}</li>
            <li>{t('invite.step2')}</li>
            <li>{t('invite.step3')}</li>
          </ol>
          <div className="invite">
            <code>{inviteUrl}</code>
            <Button icon={<Copy20Regular />} onClick={copyInvite}>{t('invite.copy')}</Button>
          </div>
        </section>

        <section className="panel panel-usp" aria-labelledby="usp-h">
          <div className="usp-intro">
            <p className="eyebrow">{t('usp.eyebrow')}</p>
            <h2 id="usp-h">{t('usp.name')}</h2>
            <p className="muted">{t('usp.lead')}</p>
            <Button appearance="primary" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => goTo('decides')}>
              {t('usp.cta')}
            </Button>
          </div>
          <ol className="usp-factors" aria-label={t('usp.factors')}>
            {FACTOR_NUMBERS.map((n) => (
              <li key={n}>
                <span className="usp-n" aria-hidden="true">{n}</span>
                <strong>{t(`factor${n}.title`)}</strong>
                <span>{t(`factor${n}.text`)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}

function PeopleSection({ me, users, busyId, actions, nameOf, now }) {
  const t = useT()
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (users ?? []).filter(
      (u) => (filter === 'all' || u.status === filter) && (!q || nameOf(u).toLowerCase().includes(q) || (u.email || '').includes(q)),
    )
  }, [users, query, filter, nameOf])

  return (
    <>
      <PageHeader icon={<People24Regular />} title={t('nav.people')} description={t('people.lead')}>
        <HeroStat value={users ? users.length : '–'} label={t('filter.all')} />
        <HeroStat value={users ? users.filter((u) => u.status === 'pending').length : '–'} label={t('filter.pending')} tone={users?.some((u) => u.status === 'pending') ? 'warn' : undefined} />
        <HeroStat value={users ? users.filter((u) => u.status === 'active').length : '–'} label={t('filter.active')} />
      </PageHeader>

      <details className="roles-help">
        <summary><Info20Regular /> {t('people.rolesHelp')}</summary>
        <dl>
          {ROLE_KEYS.map((key) => (
            <div key={key}><dt>{t(`role.${key}`)}</dt><dd>{t(`role.${key}.text`)}</dd></div>
          ))}
        </dl>
      </details>

      <div className="people-tools">
        <SearchBox placeholder={t('people.search')} value={query} onChange={(_e, d) => setQuery(d.value)} aria-label={t('people.searchLabel')} />
        <TabList selectedValue={filter} onTabSelect={(_e, d) => setFilter(d.value)} aria-label={t('people.filterLabel')} size="small">
          {FILTERS.map((f) => (
            <Tab key={f} value={f}>
              {t(`filter.${f}`)} {users && <span className="tab-count">{f === 'all' ? users.length : users.filter((u) => u.status === f).length}</span>}
            </Tab>
          ))}
        </TabList>
      </div>

      {users == null ? (
        <div className="panel"><PanelSkeleton rows={4} /></div>
      ) : shown.length === 0 ? (
        <div className="panel empty">
          <People20Regular />
          <p>{query ? t('people.noMatch', { q: query }) : t('people.none')}</p>
        </div>
      ) : (
        <table className="people-table">
          <caption className="visually-hidden">{t('people.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('people.person')}</th>
              <th scope="col">{t('people.role')}</th>
              <th scope="col">{t('people.status')}</th>
              <th scope="col">{t('people.team')}</th>
              <th scope="col">{t('people.lastActive')}</th>
              <th scope="col">{t('people.joined')}</th>
              <th scope="col"><span className="visually-hidden">{t('people.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const self = u.id === me.id
              const busy = busyId === u.id
              const name = nameOf(u)
              return (
                <tr key={u.id}>
                  <td data-label={t('people.person')}>
                    <span className="person">
                      <Avatar name={name} size={32} color="colorful" />
                      <span>
                        <span className="person-name">
                          <strong>{name}</strong>
                          {self && <Badge appearance="tint" size="small">{t('people.you')}</Badge>}
                        </span>
                        <span className="muted small person-email">{u.email}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label={t('people.role')}>
                    <Select aria-label={t('aria.roleFor', { name })} value={u.role} disabled={self || busy} onChange={(_e, d) => actions.setRole(u, d.value)}>
                      {ROLE_KEYS.map((key) => <option key={key} value={key}>{t(`role.${key}`)}</option>)}
                    </Select>
                  </td>
                  <td data-label={t('people.status')}>
                    <Badge appearance="tint" color={STATUS_COLOR[u.status]}>{t(`status.${u.status}`)}</Badge>
                  </td>
                  <td data-label={t('people.team')} className="small">
                    {u.teams?.length
                      ? u.teams.map((team) => team.name + (team.kind === 'manager' ? ` (${t('teams.kind.manager')})` : '')).join(', ')
                      : <span className="muted">{u.role === 'admin' ? '—' : t('people.noTeam')}</span>}
                  </td>
                  <td data-label={t('people.lastActive')} className="muted small">
                    {u.lastActiveAt ? (
                      <time dateTime={u.lastActiveAt} title={new Date(u.lastActiveAt).toLocaleString(locale)}>
                        {relativeTime(u.lastActiveAt, now, locale) ?? t('lastActive.justNow')}
                      </time>
                    ) : t('lastActive.never')}
                  </td>
                  <td data-label={t('people.joined')} className="muted small">
                    {new Date(u.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="row-actions">
                    {self ? (
                      <span className="muted small">{t('people.self')}</span>
                    ) : u.status === 'pending' ? (
                      <Button appearance="primary" size="small" icon={<Checkmark20Regular />} disabled={busy} onClick={() => actions.approve(u, u.role)} aria-label={t('aria.approve', { name })}>
                        {t('btn.approve')}
                      </Button>
                    ) : u.status === 'active' ? (
                      <Button size="small" icon={<PersonProhibited20Regular />} disabled={busy} onClick={() => actions.turnOff(u)} aria-label={t('aria.turnOff', { name })}>
                        {t('btn.turnOff')}
                      </Button>
                    ) : (
                      <Button size="small" icon={<ArrowCounterclockwise20Regular />} disabled={busy} onClick={() => actions.restore(u)} aria-label={t('aria.restore', { name })}>
                        {t('btn.restore')}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}

function PanelSkeleton({ rows = 2 }) {
  const t = useT()
  return (
    <Skeleton aria-label={t('app.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          <SkeletonItem shape="circle" size={36} />
          <SkeletonItem size={16} style={{ flex: 1 }} />
        </div>
      ))}
    </Skeleton>
  )
}
