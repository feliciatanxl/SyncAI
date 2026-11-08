import { useEffect, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  SearchBox,
  Spinner,
} from '@fluentui/react-components'
import {
  ChevronDown20Regular,
  ChevronUp20Regular,
  PeopleTeam20Regular,
  PeopleTeam24Regular,
  Person20Regular,
  PresenceAvailable12Filled,
} from '@fluentui/react-icons'
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
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/my-teams', { getToken, signal: controller.signal }).then(
      (list) => {
        setTeams(list)
        if (list && list.length > 0) {
          // By default expand the first team (or all if 2 or fewer) so it feels approachable
          setExpandedIds(new Set(list.length <= 2 ? list.map((item) => item.id) : [list[0].id]))
        }
      },
      (err) => err.name !== 'AbortError' && setError(err)
    )
    return () => controller.abort()
  }, [getToken])

  const allMembers = (teams ?? []).flatMap((team) => team.members)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const totalActiveToday = allMembers.filter((m) => m.lastActiveAt && new Date(m.lastActiveAt) >= today).length
  const nameOf = (m) => m.displayName || m.email

  // Filter teams and their members based on search box
  const q = query.trim().toLowerCase()
  const shownTeams = (teams ?? []).filter((team) => {
    if (!q) return true
    if (team.name.toLowerCase().includes(q)) return true
    return (team.members ?? []).some(
      (m) => nameOf(m).toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q))
    )
  })

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpanded = shownTeams.length > 0 && shownTeams.every((team) => expandedIds.has(team.id))
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(shownTeams.map((team) => team.id)))
    }
  }

  const hasMultipleTeams = (teams ?? []).length > 1
  const hasAnyMembers = allMembers.length > 0
  const showToolbar = hasMultipleTeams || hasAnyMembers

  return (
    <>
      <PageHeader icon={<PeopleTeam24Regular />} title={t('nav.team')} description={t('myteam.lead')}>
        <HeroStat value={teams ? teams.length : '–'} label={t('myteam.stat.teams')} />
        <HeroStat value={teams ? allMembers.length : '–'} label={t('myteam.stat.members')} />
        <HeroStat value={teams ? totalActiveToday : '–'} label={t('myteam.stat.activeToday')} />
      </PageHeader>

      {error ? (
        <MessageBar intent="error" className="portal-error">
          <MessageBarBody>
            <MessageBarTitle>{t('err.loadTeams')}</MessageBarTitle>
            {error.message}
          </MessageBarBody>
        </MessageBar>
      ) : teams == null ? (
        <div className="panel">
          <Spinner size="small" label={t('app.loading')} />
        </div>
      ) : teams.length === 0 ? (
        <div className="panel empty-card">
          <div className="empty-card-header">
            <div className="empty-card-content">
              <span className="empty-card-icon" aria-hidden="true">
                <PeopleTeam24Regular />
              </span>
              <div className="empty-card-text">
                <h3>{t('myteam.emptyTitle')}</h3>
                <p>{t('myteam.none')}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {showToolbar && (
            <div className="teams-toolbar">
              <div className="teams-toolbar-left">
                <SearchBox
                  className="teams-search"
                  placeholder={t('myteam.search')}
                  value={query}
                  onChange={(_e, d) => setQuery(d.value)}
                  aria-label={t('myteam.search')}
                />
                {hasMultipleTeams && (
                  <Button
                    appearance="subtle"
                    icon={allExpanded ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                    onClick={toggleAll}
                  >
                    {allExpanded ? t('teams.collapseAll') : t('teams.expandAll')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {shownTeams.length === 0 ? (
            <div className="panel empty">
              <PeopleTeam20Regular />
              <p>{t('myteam.noMatch', { q: query })}</p>
            </div>
          ) : (
            <div className="teams-list">
              {shownTeams.map((team) => {
                const isExpanded = expandedIds.has(team.id)
                const teamMembers = team.members ?? []
                const activeCount = teamMembers.filter(
                  (m) => m.lastActiveAt && new Date(m.lastActiveAt) >= today
                ).length
                const memberCountLabel =
                  teamMembers.length === 1
                    ? t('teams.memberCountOne')
                    : t('teams.memberCount', { n: teamMembers.length })

                return (
                  <section
                    key={team.id}
                    className={`team-card ${isExpanded ? 'is-expanded' : ''}`}
                    aria-labelledby={`myteam-${team.id}`}
                  >
                    <div
                      className="team-card-header"
                      onClick={() => toggleExpand(team.id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleExpand(team.id)
                        }
                      }}
                    >
                      <div className="team-card-main">
                        <span className="team-card-icon" aria-hidden="true">
                          <PeopleTeam20Regular />
                        </span>
                        <div className="team-card-info">
                          <div className="team-card-title-row">
                            <h2 id={`myteam-${team.id}`}>{team.name}</h2>
                          </div>
                          <div className="team-badges-row">
                            <span className="team-badge">
                              <Person20Regular /> {memberCountLabel}
                            </span>
                            {activeCount > 0 && (
                              <span className="team-badge is-active">
                                <PresenceAvailable12Filled />{' '}
                                {activeCount === 1
                                  ? t('myteam.activeCountOne')
                                  : t('myteam.activeCount', { n: activeCount })}
                              </span>
                            )}
                            {teamMembers.length > 0 && (
                              <div className="team-avatar-stack" aria-hidden="true">
                                {teamMembers.slice(0, 4).map((m) => (
                                  <Avatar key={m.id} name={nameOf(m)} size={24} color="colorful" />
                                ))}
                                {teamMembers.length > 4 && (
                                  <span className="team-avatar-more">+{teamMembers.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="team-card-controls" onClick={(e) => e.stopPropagation()}>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={isExpanded ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                          onClick={() => toggleExpand(team.id)}
                          aria-label={isExpanded ? t('teams.collapseAll') : t('teams.expandAll')}
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="myteam-content">
                        {teamMembers.length === 0 ? (
                          <div className="myteam-empty-state">
                            <div className="myteam-empty-icon" aria-hidden="true">
                              <Person20Regular />
                            </div>
                            <h3>{t('teams.noMembers')}</h3>
                            <p>{t('myteam.emptyMembersHint')}</p>
                          </div>
                        ) : (
                          <ul className="team-people-list">
                            {teamMembers.map((m) => (
                              <li key={m.id} className="team-person-item">
                                <Avatar name={nameOf(m)} size={36} color="colorful" />
                                <div className="team-person-details">
                                  <div className="team-person-name-row">
                                    <strong>{nameOf(m)}</strong>
                                    <Badge appearance="tint" color={STATUS_COLOR[m.status]}>
                                      {t(`status.${m.status}`)}
                                    </Badge>
                                  </div>
                                  <span>{m.email}</span>
                                </div>
                                <div className="team-person-meta">
                                  <span className="team-last">
                                    {m.lastActiveAt ? (
                                      <time
                                        dateTime={m.lastActiveAt}
                                        title={new Date(m.lastActiveAt).toLocaleString(locale)}
                                      >
                                        {relativeTime(m.lastActiveAt, now, locale) ?? t('lastActive.justNow')}
                                      </time>
                                    ) : (
                                      t('lastActive.never')
                                    )}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
