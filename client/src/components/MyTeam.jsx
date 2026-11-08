import { useEffect, useState } from 'react'
import { Avatar, Badge, MessageBar, MessageBarBody, MessageBarTitle, Spinner } from '@fluentui/react-components'
import { Info20Regular, PeopleTeam20Regular, PeopleTeam24Regular } from '@fluentui/react-icons'
import { apiRequest } from '../lib/api.js'
import { useLocale, useT } from '../lib/i18n.js'
import { relativeTime, useNow } from '../lib/time.js'
import PageHeader, { HeroStat } from './PageHeader.jsx'

const STATUS_COLOR = { pending: 'warning', active: 'success', disabled: 'subtle' }

// A manager's view of the teams they lead. The server only ever returns those teams.
export default function MyTeam({ getToken }) {
  const t = useT()
  const locale = useLocale()
  const now = useNow()
  const [teams, setTeams] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/my-teams', { getToken, signal: controller.signal }).then(setTeams, (err) => err.name !== 'AbortError' && setError(err))
    return () => controller.abort()
  }, [getToken])

  const members = (teams ?? []).flatMap((team) => team.members)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const activeToday = members.filter((m) => m.lastActiveAt && new Date(m.lastActiveAt) >= today).length
  const nameOf = (m) => m.displayName || m.email

  return (
    <>
      <PageHeader icon={<PeopleTeam24Regular />} title={t('nav.team')} description={t('myteam.lead')}>
        <HeroStat value={teams ? teams.length : '–'} label={t('myteam.stat.teams')} />
        <HeroStat value={teams ? members.length : '–'} label={t('myteam.stat.members')} />
        <HeroStat value={teams ? activeToday : '–'} label={t('myteam.stat.activeToday')} />
      </PageHeader>

      {error ? (
        <MessageBar intent="error" className="portal-error">
          <MessageBarBody><MessageBarTitle>{t('err.loadTeams')}</MessageBarTitle>{error.message}</MessageBarBody>
        </MessageBar>
      ) : teams == null ? (
        <div className="panel"><Spinner size="small" label={t('app.loading')} /></div>
      ) : teams.length === 0 ? (
        <div className="panel empty">
          <PeopleTeam20Regular />
          <p>{t('myteam.none')}</p>
        </div>
      ) : (
        <>
          <p className="soon-note"><Info20Regular /> {t('myteam.workloadSoon')}</p>
          {teams.map((team) => (
            <section key={team.id} className="panel team-card" aria-labelledby={`myteam-${team.id}`}>
              <div className="team-card-head">
                <span className="team-card-icon" aria-hidden="true"><PeopleTeam20Regular /></span>
                <h2 id={`myteam-${team.id}`}>{team.name}</h2>
                <span className="muted small team-count">{(team.members.length === 1 ? t('teams.countOne') : t('teams.count', { n: team.members.length }))}</span>
              </div>
              {team.members.length === 0 ? (
                <p className="muted small team-none">{t('teams.noMembers')}</p>
              ) : (
                <ul className="team-people">
                  {team.members.map((m) => (
                    <li key={m.id}>
                      <Avatar name={nameOf(m)} size={32} color="colorful" />
                      <span className="team-person"><strong>{nameOf(m)}</strong><span className="muted small">{m.email}</span></span>
                      <Badge appearance="tint" color={STATUS_COLOR[m.status]}>{t(`status.${m.status}`)}</Badge>
                      <span className="muted small team-last">
                        {m.lastActiveAt ? (
                          <time dateTime={m.lastActiveAt} title={new Date(m.lastActiveAt).toLocaleString(locale)}>
                            {relativeTime(m.lastActiveAt, now, locale) ?? t('lastActive.justNow')}
                          </time>
                        ) : t('lastActive.never')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </>
  )
}
