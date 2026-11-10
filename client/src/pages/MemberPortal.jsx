import { useEffect, useState } from 'react'
import { Badge, Button } from '@fluentui/react-components'
import {
  ArrowRight16Regular, BrainCircuit24Regular, ChatSparkle20Regular, CalendarLtr20Regular, CalendarLtr24Regular, Grid20Regular, PeopleTeam20Regular,
  PersonClock24Regular, PersonProhibited24Regular, Settings20Regular, Sparkle20Regular,
  TaskListLtr20Regular, TaskListLtr24Regular, CheckmarkCircle20Filled, Circle20Regular, Clock20Regular, DismissCircle20Regular,
} from '@fluentui/react-icons'
import AssistantChat from '../components/AssistantChat.jsx'
import HowItDecides from '../components/HowItDecides.jsx'
import MicrosoftToDo from '../components/MicrosoftToDo.jsx'
import MyTeam from '../components/MyTeam.jsx'
import OutlookCalendar from '../components/OutlookCalendar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PortalShell from '../components/PortalShell.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import { clearReturnSection, returnSection } from '../auth/msal.js'
import { useLocale, useT } from '../lib/i18n.js'
import { memberSections } from '../lib/sections.js'
import { greetingKey, greetingName, useNow } from '../lib/time.js'

const ICONS = {
  overview: <Grid20Regular />,
  assistant: <ChatSparkle20Regular />,
  tasks: <TaskListLtr20Regular />,
  plan: <CalendarLtr20Regular />,
  team: <PeopleTeam20Regular />,
  decides: <Sparkle20Regular />,
  settings: <Settings20Regular />,
}
const FACTOR_NUMBERS = [1, 2, 3, 4]

// Portal for team members and managers. Tasks, plans and team workload arrive with the planning engine,
// so those pages explain what's coming instead of showing made-up data.
export default function MemberPortal({ me, photo, chat, tenantId, getToken, onSignOut, onSwitchAccount }) {
  const t = useT()
  // Back from Microsoft's consent screen: reopen the section that asked (cleared once read).
  const [section, setSection] = useState(() => returnSection('overview'))
  useEffect(clearReturnSection, [])
  const ids = memberSections(me)
  const current = ids.includes(section) ? section : 'overview'
  const active = me.status === 'active'
  const name = me.displayName || me.email || t('app.unnamed')

  return (
    <PortalShell
      tag={active ? t(`role.${me.role}`) : t(`status.${me.status}`)}
      sections={ids.map((id) => ({ id, icon: ICONS[id] }))}
      section={current}
      onSection={setSection}
      account={{ name, email: me.email, photo, tenantId, onSwitchAccount, onSignOut }}
    >
      {current === 'overview' ? (
        <Overview me={me} name={name} goTo={setSection} />
      ) : current === 'tasks' ? (
        <ComingSoon icon={<TaskListLtr24Regular />} title={t('nav.tasks')} heading={t('member.tasks.heading')} text={t('member.tasks.text')} goTo={setSection}>
          <MicrosoftToDo me={me} />
        </ComingSoon>
      ) : current === 'plan' ? (
        <ComingSoon icon={<CalendarLtr24Regular />} title={t('nav.plan')} heading={t('member.plan.heading')} text={t('member.plan.text')} goTo={setSection}>
          <OutlookCalendar me={me} />
        </ComingSoon>
      ) : current === 'team' ? (
        <MyTeam getToken={getToken} />
      ) : current === 'assistant' ? (
        <AssistantChat me={me} name={name} chat={chat} goTo={setSection} available={ids} />
      ) : current === 'decides' ? (
        <HowItDecides />
      ) : (
        <SettingsPanel />
      )}
    </PortalShell>
  )
}

function Overview({ me, name, goTo }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const active = me.status === 'active'
  const heroText = active ? t('member.hero.active') : me.status === 'pending' ? t('ws.pendingBody') : t('ws.disabledBody')

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
          <h1 id="hero-h">{t(greetingKey(now), { name: greetingName(name) })}</h1>
          <p>{heroText}</p>
        </div>
        <div className="portal-hero-usp">
          <BrainCircuit24Regular />
          <span><strong>{t('usp.name')}</strong> {t('usp.short')}</span>
        </div>
      </section>

      {active ? (
        <div className="member-grid">
          <section className="panel member-today" aria-labelledby="today-h">
            <div className="panel-head">
              <h2 id="today-h">{t('member.today.title')}</h2>
              <Badge appearance="tint" color="brand">{t('member.soon')}</Badge>
            </div>
            {/* Illustration of a day plan's shape only: placeholder bars in the priority colours, no made-up tasks. */}
            <div className="plan-preview" aria-hidden="true">
              {['safety', 'deadline', 'service', 'admin'].map((kind) => (
                <div key={kind} className={`plan-row ${kind}`}>
                  <span className="plan-time" />
                  <span className="plan-bar" />
                  <span className="plan-tag" />
                </div>
              ))}
            </div>
            <div className="today-note">
              <CalendarLtr24Regular />
              <p><strong>{t('member.today.empty')}</strong><br /><span className="muted">{t('member.plan.text')}</span></p>
            </div>
            <Button icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => goTo('plan')}>{t('nav.plan')}</Button>
          </section>

          <section className="panel member-side" aria-labelledby="role-h">
            <div className="panel-head">
              <h2 id="role-h">{t('member.role.title')}</h2>
              <Badge appearance="tint" size="large">{t(`role.${me.role}`)}</Badge>
            </div>
            <p className="muted">{t(`role.${me.role}.text`)}</p>
            <TeamLines me={me} />
          </section>

          <SetupCard me={me} />

          <section className="panel panel-usp" aria-labelledby="usp-h">
            <div className="usp-intro">
              <p className="eyebrow">{t('usp.eyebrow')}</p>
              <h2 id="usp-h">{t('member.usp.title')}</h2>
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
      ) : (
        <div className="member-grid">
          <section className={`panel status-panel ${me.status}`} aria-labelledby="status-h">
            <span className="card-icon">{me.status === 'pending' ? <PersonClock24Regular /> : <PersonProhibited24Regular />}</span>
            <div>
              <h2 id="status-h">{me.status === 'pending' ? t('ws.pendingTitle') : t('ws.disabledTitle')}</h2>
              <p className="muted">{me.status === 'pending' ? t('member.pending.next') : t('ws.disabledBody')}</p>
            </div>
          </section>
          <SetupCard me={me} wide />
        </div>
      )}
    </>
  )
}

// What's ready for this person and what's still to come, from their real account state.
function SetupCard({ me, wide }) {
  const t = useT()
  const approval = { active: 'done', pending: 'waiting', disabled: 'off' }[me.status]
  const placed = (me.teams ?? []).some((team) => team.kind === (me.role === 'manager' ? 'manager' : 'member'))
  const steps = [
    { key: 'signedIn', state: 'done' },
    { key: 'approved', state: approval },
    { key: me.role === 'manager' ? 'teamManager' : 'team', state: placed ? 'done' : me.status === 'disabled' ? 'off' : 'waiting' },
    { key: 'tasks', state: 'soon' },
    { key: 'calendar', state: 'soon' },
  ]
  const icon = { done: <CheckmarkCircle20Filled />, waiting: <Clock20Regular />, off: <DismissCircle20Regular />, soon: <Circle20Regular /> }
  const label = { done: t('member.setup.done'), waiting: t('member.setup.waiting'), off: t('member.setup.off'), soon: t('member.soon') }

  return (
    <section className={`panel member-side setup-card ${wide ? 'wide' : ''}`} aria-labelledby="setup-h">
      <div className="panel-head">
        <h2 id="setup-h">{t('member.setup.title')}</h2>
      </div>
      <p className="muted">{t('member.setup.lead')}</p>
      <ol className="setup-list">
        {steps.map((s) => (
          <li key={s.key} className={`setup-step ${s.state}`}>
            <span className="setup-icon" aria-hidden="true">{icon[s.state]}</span>
            <span className="setup-name">{t(`member.setup.${s.key}`)}</span>
            <span className="setup-state">{label[s.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// Which team the person is in and who manages it, or which teams a manager leads.
function TeamLines({ me }) {
  const t = useT()
  const teams = me.teams ?? []
  const name = (u) => u.displayName || u.email
  if (me.role === 'manager') {
    const led = teams.filter((team) => team.kind === 'manager')
    return <p className="team-lines">{led.length ? t('member.managesLine', { teams: led.map((team) => team.name).join(', ') }) : t('member.noTeamManager')}</p>
  }
  const team = teams.find((x) => x.kind === 'member')
  if (!team) return <p className="team-lines muted">{t('member.noTeam')}</p>
  return (
    <p className="team-lines">
      {t('member.teamLine', { team: team.name })}
      {team.managers.length > 0 && <><br />{t('member.managerLine', { names: team.managers.map(name).join(', ') })}</>}
    </p>
  )
}

function ComingSoon({ icon, title, heading, text, goTo, children }) {
  const t = useT()
  return (
    <>
      <PageHeader icon={icon} title={title} badge={<span className="hero-badge">{t('member.soon')}</span>} description={heading} />
      {children}
      <section className="panel coming-soon">
        <span className="coming-icon" aria-hidden="true">{icon}</span>
        <p className="muted">{text}</p>
        <Button appearance="primary" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => goTo('decides')}>{t('usp.cta')}</Button>
      </section>
    </>
  )
}
