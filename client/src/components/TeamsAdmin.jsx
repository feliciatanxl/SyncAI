import { useCallback, useEffect, useState } from 'react'
import {
  Avatar, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input,
  MessageBar, MessageBarBody, MessageBarTitle, SearchBox, Select, Spinner,
} from '@fluentui/react-components'
import {
  Add20Regular, ChevronDown20Regular, ChevronUp20Regular, Delete20Regular, Dismiss16Regular,
  Dismiss20Regular, Edit20Regular, Info16Regular, PeopleTeam24Regular, PeopleTeam20Regular,
  Person20Regular, ShieldPerson20Regular,
} from '@fluentui/react-icons'
import { apiRequest } from '../lib/api.js'
import { useT } from '../lib/i18n.js'
import PageHeader, { HeroStat } from './PageHeader.jsx'

const SUGGESTIONS = ['North estate team', 'South maintenance team', 'Zone 1 operations', 'Central facilities team']

const inTeamAsMember = (u) => (u.teams ?? []).some((t) => t.kind === 'member')

// Admin page for arranging teams. Admins see who is in which team, never anyone's work.
export default function TeamsAdmin({ getToken, people, nameOf, notify, onPeopleChanged }) {
  const t = useT()
  const [teams, setTeams] = useState(null)
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null) // { mode: 'create' | 'rename' | 'delete', team? }
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())



  useEffect(() => {
    if (!dialog) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDialog(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialog])

  const errorText = useCallback((err) => (err.body?.code ? t(`teamError.${err.body.code}`, { team: err.body.team ?? '' }) : err.message), [t])

  const load = useCallback((signal) => apiRequest('/teams', { getToken, signal }).then((list) => {
    setTeams(list)
    if (list?.length === 1) setExpandedIds((prev) => (prev.size === 0 ? new Set([list[0].id]) : prev))
  }, (err) => err.name !== 'AbortError' && setError(err)), [getToken])
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Runs a change, then refreshes teams and people so every page agrees.
  async function run(request, success) {
    setBusy(true)
    try {
      await request()
      await Promise.all([load(), onPeopleChanged()])
      notify(success)
      return true
    } catch (err) {
      notify(errorText(err), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const openDialog = (mode, team) => {
    setName(team?.name ?? '')
    setDialog({ mode, team })
  }

  async function submitDialog(e) {
    e?.preventDefault()
    const { mode, team } = dialog
    const trimmed = name.trim()
    const ok = mode === 'create'
      ? await run(async () => {
          const res = await apiRequest('/teams', { method: 'POST', body: { name: trimmed }, getToken })
          if (res?.id) setExpandedIds((prev) => new Set([...prev, res.id]))
        }, t('toast.teamCreated', { team: trimmed }))
      : mode === 'rename'
        ? await run(() => apiRequest(`/teams/${team.id}`, { method: 'PATCH', body: { name: trimmed }, getToken }), t('toast.teamRenamed', { team: trimmed }))
        : await run(() => apiRequest(`/teams/${team.id}`, { method: 'DELETE', getToken }), t('toast.teamDeleted', { team: team.name }))
    if (ok) setDialog(null)
  }

  const add = (team, userId, kind) => {
    const person = people.find((p) => p.id === userId)
    return run(() => apiRequest(`/teams/${team.id}/members`, { method: 'POST', body: { userId, kind }, getToken }), t('toast.addedToTeam', { name: nameOf(person), team: team.name }))
  }
  const remove = (team, person) =>
    run(() => apiRequest(`/teams/${team.id}/members/${person.id}`, { method: 'DELETE', getToken }), t('toast.removedFromTeam', { name: nameOf(person), team: team.name }))

  const activeMembers = (people ?? []).filter((p) => p.role === 'member' && p.status === 'active')
  const placed = activeMembers.filter(inTeamAsMember).length

  // Filter teams by search query
  const q = query.trim().toLowerCase()
  const shownTeams = (teams ?? []).filter((team) => {
    if (!q) return true
    if (team.name.toLowerCase().includes(q)) return true
    return team.people.some((p) => (nameOf(p).toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q))))
  })

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpanded = shownTeams.length > 0 && shownTeams.every((t) => expandedIds.has(t.id))
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(shownTeams.map((t) => t.id)))
    }
  }

  return (
    <>
      <PageHeader icon={<PeopleTeam24Regular />} title={t('nav.teams')} description={t('teams.lead')}>
        <HeroStat value={teams ? teams.length : '–'} label={t('teams.stat.teams')} />
        <HeroStat value={people ? placed : '–'} label={t('teams.stat.placed')} />
        <HeroStat value={people ? activeMembers.length - placed : '–'} label={t('teams.stat.unplaced')} tone={activeMembers.length - placed > 0 ? 'warn' : undefined} />
      </PageHeader>

      {error ? (
        <MessageBar intent="error" className="portal-error">
          <MessageBarBody><MessageBarTitle>{t('err.loadTeams')}</MessageBarTitle>{error.message}</MessageBarBody>
        </MessageBar>
      ) : teams == null ? (
        <div className="panel"><Spinner size="small" label={t('app.loading')} /></div>
      ) : teams.length === 0 ? (
        <div className="panel empty-card">
          <div className="empty-card-content">
            <span className="empty-card-icon" aria-hidden="true"><PeopleTeam24Regular /></span>
            <div>
              <h3>{t('teams.emptyTitle')}</h3>
              <p className="muted">{t('teams.empty')}</p>
            </div>
          </div>
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => openDialog('create')}>{t('teams.new')}</Button>
        </div>
      ) : (
        <>
          <div className="teams-toolbar">
            <div className="teams-toolbar-left">
              <SearchBox
                className="teams-search"
                placeholder={t('teams.search')}
                value={query}
                onChange={(_e, d) => setQuery(d.value)}
                aria-label={t('teams.search')}
              />
              <Button
                appearance="subtle"
                icon={allExpanded ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                onClick={toggleAll}
              >
                {allExpanded ? t('teams.collapseAll') : t('teams.expandAll')}
              </Button>
            </div>
            <div className="teams-toolbar-right">
              <Button appearance="primary" icon={<Add20Regular />} onClick={() => openDialog('create')}>
                {t('teams.new')}
              </Button>
            </div>
          </div>

          {shownTeams.length === 0 ? (
            <div className="panel empty">
              <PeopleTeam20Regular />
              <p>{t('teams.noMatch', { q: query })}</p>
            </div>
          ) : (
            <div className="teams-list">
              {shownTeams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  people={people ?? []}
                  nameOf={nameOf}
                  busy={busy}
                  isExpanded={expandedIds.has(team.id)}
                  onToggle={() => toggleExpand(team.id)}
                  onAdd={add}
                  onRemove={remove}
                  onRename={() => openDialog('rename', team)}
                  onDelete={() => openDialog('delete', team)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Microsoft 365 style Slide-Over Panel for Create & Rename */}
      {Boolean(dialog && dialog.mode !== 'delete') && (
        <div className="ms-drawer-backdrop" onClick={() => setDialog(null)}>
          <aside
            className="ms-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ms-drawer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ms-drawer-header">
              <div className="ms-drawer-title-group">
                <span className="ms-drawer-icon" aria-hidden="true">
                  {dialog.mode === 'create' ? <PeopleTeam24Regular /> : <Edit20Regular />}
                </span>
                <div>
                  <h2 id="ms-drawer-title">{dialog.mode === 'create' ? t('teams.new') : t('teams.rename')}</h2>
                  <p className="ms-drawer-subtitle">
                    {dialog.mode === 'create' ? t('teams.drawerSubtitle') : t('teams.renameSubtitle')}
                  </p>
                </div>
              </div>
              <Button
                appearance="subtle"
                icon={<Dismiss20Regular />}
                aria-label={t('teams.cancel')}
                onClick={() => setDialog(null)}
                className="ms-drawer-close"
              />
            </header>

            <form onSubmit={submitDialog} className="ms-drawer-form">
              <div className="ms-drawer-body">
                <div className="ms-drawer-callout">
                  <Info16Regular />
                  <p>{t('teams.drawerCallout')}</p>
                </div>

                <Field
                  label={<span className="ms-field-label">{t('teams.name')} <span className="ms-required">*</span></span>}
                  hint={<span className="ms-field-hint">{t('teams.nameHint')}</span>}
                >
                  <Input
                    size="large"
                    value={name}
                    onChange={(_e, d) => setName(d.value)}
                    maxLength={80}
                    placeholder={t('teams.namePlaceholder')}
                    autoFocus
                    className="ms-drawer-input"
                  />
                </Field>

                {dialog.mode === 'create' && (
                  <div className="ms-drawer-suggestions">
                    <span className="ms-suggestions-title">{t('teams.suggestions')}</span>
                    <div className="ms-suggestions-chips">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="ms-chip"
                          onClick={() => setName(s)}
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <footer className="ms-drawer-footer">
                <Button
                  type="submit"
                  appearance="primary"
                  disabled={busy || !name.trim()}
                >
                  {dialog.mode === 'create' ? t('teams.create') : t('teams.save')}
                </Button>
                <Button appearance="secondary" onClick={() => setDialog(null)}>
                  {t('teams.cancel')}
                </Button>
              </footer>
            </form>
          </aside>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(dialog && dialog.mode === 'delete')} onOpenChange={(_e, d) => !d.open && setDialog(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{dialog?.team && t('teams.deleteTitle', { team: dialog.team.name })}</DialogTitle>
            <DialogContent>{t('teams.deleteBody')}</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDialog(null)}>{t('teams.cancel')}</Button>
              <Button appearance="primary" onClick={submitDialog} disabled={busy}>{t('teams.delete')}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}

function TeamCard({ team, people, nameOf, busy, isExpanded, onToggle, onAdd, onRemove, onRename, onDelete }) {
  const t = useT()
  const managers = team.people.filter((p) => p.kind === 'manager')
  const members = team.people.filter((p) => p.kind === 'member')
  const inThisTeam = new Set(team.people.map((p) => p.id))
  const eligible = {
    manager: people.filter((p) => p.role === 'manager' && p.status !== 'disabled' && !inThisTeam.has(p.id)),
    member: people.filter((p) => p.role === 'member' && p.status !== 'disabled' && !inTeamAsMember(p)),
  }

  const managerCountLabel = managers.length === 1 ? t('teams.managerCountOne') : t('teams.managerCount', { n: managers.length })
  const memberCountLabel = members.length === 1 ? t('teams.memberCountOne') : t('teams.memberCount', { n: members.length })

  return (
    <section className={`team-card ${isExpanded ? 'is-expanded' : ''}`} aria-labelledby={`team-${team.id}`}>
      <div
        className="team-card-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      >
        <div className="team-card-main">
          <span className="team-card-icon" aria-hidden="true"><PeopleTeam20Regular /></span>
          <div className="team-card-info">
            <div className="team-card-title-row">
              <h2 id={`team-${team.id}`}>{team.name}</h2>
              <span className="muted small">
                {team.people.length === 1 ? t('teams.countOne') : t('teams.count', { n: team.people.length })}
              </span>
            </div>
            <div className="team-badges-row">
              <span className="team-badge is-manager">
                <ShieldPerson20Regular /> {managerCountLabel}
              </span>
              <span className="team-badge">
                <Person20Regular /> {memberCountLabel}
              </span>
              {team.people.length > 0 && (
                <div className="team-avatar-stack" aria-hidden="true">
                  {team.people.slice(0, 3).map((p) => (
                    <Avatar key={p.id} name={nameOf(p)} size={24} color="colorful" />
                  ))}
                  {team.people.length > 3 && (
                    <span className="team-avatar-more">+{team.people.length - 3}</span>
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
            icon={<Edit20Regular />}
            onClick={onRename}
            aria-label={t('teams.renameNamed', { team: team.name })}
            title={t('teams.rename')}
          />
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete20Regular />}
            onClick={onDelete}
            disabled={team.people.length > 0}
            aria-label={t('teams.deleteNamed', { team: team.name })}
            title={team.people.length > 0 ? t('teams.deleteBlocked') : t('teams.delete')}
          />
          <Button
            appearance="subtle"
            size="small"
            icon={isExpanded ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
            onClick={onToggle}
            aria-label={isExpanded ? t('teams.collapseAll') : t('teams.expandAll')}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="team-card-content">
          <TeamSection
            kind="manager"
            title={t('teams.managers')}
            team={team}
            list={managers}
            eligible={eligible.manager}
            nameOf={nameOf}
            busy={busy}
            onAdd={onAdd}
            onRemove={onRemove}
          />
          <TeamSection
            kind="member"
            title={t('teams.members')}
            team={team}
            list={members}
            eligible={eligible.member}
            nameOf={nameOf}
            busy={busy}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        </div>
      )}
    </section>
  )
}

function TeamSection({ kind, title, team, list, eligible, nameOf, busy, onAdd, onRemove }) {
  const t = useT()
  const [pick, setPick] = useState('')

  return (
    <div className="team-section-box">
      <div className="team-section-header">
        <h3>
          {kind === 'manager' ? <ShieldPerson20Regular /> : <Person20Regular />}
          {title}
        </h3>
        <span className="team-section-count">{list.length}</span>
      </div>

      {list.length === 0 ? (
        <p className="team-empty-state-text">
          {kind === 'manager' ? t('teams.noManagers') : t('teams.noMembers')}
        </p>
      ) : (
        <ul className="team-people-list">
          {list.map((p) => (
            <li key={p.id} className="team-person-item">
              <Avatar name={nameOf(p)} size={32} color="colorful" />
              <div className="team-person-details">
                <strong>{nameOf(p)}</strong>
                <span>{p.email}</span>
              </div>
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss16Regular />}
                disabled={busy}
                onClick={() => onRemove(team, p)}
                aria-label={t('aria.removeFromTeam', { name: nameOf(p), team: team.name })}
                title={t('teams.remove')}
              />
            </li>
          ))}
        </ul>
      )}

      {eligible.length > 0 ? (
        <div className="team-add-form">
          <Select
            value={pick}
            onChange={(_e, d) => setPick(d.value)}
            disabled={busy}
            aria-label={kind === 'manager' ? t('teams.addManager') : t('teams.addMember')}
          >
            <option value="">{t('teams.pick')}</option>
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>{nameOf(p)}</option>
            ))}
          </Select>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            disabled={busy || !pick}
            onClick={async () => {
              if (await onAdd(team, pick, kind)) setPick('')
            }}
          >
            {t('teams.create') === 'Create team' ? 'Add' : '添加'}
          </Button>
        </div>
      ) : (
        <div className="team-all-assigned-hint">
          <Info16Regular />
          <span>{kind === 'manager' ? t('teams.allManagersAssigned') : t('teams.allMembersAssigned')}</span>
        </div>
      )}
    </div>
  )
}
