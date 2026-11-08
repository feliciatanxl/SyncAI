import { useCallback, useEffect, useState } from 'react'
import {
  Avatar, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input,
  MessageBar, MessageBarBody, MessageBarTitle, Select, Spinner,
} from '@fluentui/react-components'
import { Add20Regular, Delete20Regular, Dismiss16Regular, Edit20Regular, PeopleTeam24Regular, PeopleTeam20Regular } from '@fluentui/react-icons'
import { apiRequest } from '../lib/api.js'
import { useT } from '../lib/i18n.js'
import PageHeader, { HeroStat } from './PageHeader.jsx'

const inTeamAsMember = (u) => (u.teams ?? []).some((t) => t.kind === 'member')

// Admin page for arranging teams. Admins see who is in which team, never anyone's work.
export default function TeamsAdmin({ getToken, people, nameOf, notify, onPeopleChanged }) {
  const t = useT()
  const [teams, setTeams] = useState(null)
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null) // { mode: 'create' | 'rename' | 'delete', team? }
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const errorText = useCallback((err) => (err.body?.code ? t(`teamError.${err.body.code}`, { team: err.body.team ?? '' }) : err.message), [t])

  const load = useCallback((signal) => apiRequest('/teams', { getToken, signal }).then(setTeams, (err) => err.name !== 'AbortError' && setError(err)), [getToken])
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
      ? await run(() => apiRequest('/teams', { method: 'POST', body: { name: trimmed }, getToken }), t('toast.teamCreated', { team: trimmed }))
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

  return (
    <>
      <PageHeader icon={<PeopleTeam24Regular />} title={t('nav.teams')} description={t('teams.lead')}>
        <HeroStat value={teams ? teams.length : '–'} label={t('teams.stat.teams')} />
        <HeroStat value={people ? placed : '–'} label={t('teams.stat.placed')} />
        <HeroStat value={people ? activeMembers.length - placed : '–'} label={t('teams.stat.unplaced')} tone={activeMembers.length - placed > 0 ? 'warn' : undefined} />
        <Button className="hero-button" icon={<Add20Regular />} onClick={() => openDialog('create')}>{t('teams.new')}</Button>
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
          <p><strong>{t('teams.emptyTitle')}</strong><br />{t('teams.empty')}</p>
        </div>
      ) : (
        <div className="team-grid">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} people={people ?? []} nameOf={nameOf} busy={busy}
              onAdd={add} onRemove={remove} onRename={() => openDialog('rename', team)} onDelete={() => openDialog('delete', team)} />
          ))}
        </div>
      )}

      <Dialog open={Boolean(dialog)} onOpenChange={(_e, d) => !d.open && setDialog(null)}>
        <DialogSurface>
          <form onSubmit={submitDialog}>
            <DialogBody>
              <DialogTitle>
                {dialog?.mode === 'create' ? t('teams.new') : dialog?.mode === 'rename' ? t('teams.rename') : t('teams.deleteTitle', { team: dialog?.team?.name ?? '' })}
              </DialogTitle>
              <DialogContent>
                {dialog?.mode === 'delete' ? (
                  t('teams.deleteBody')
                ) : (
                  <Field label={t('teams.name')} hint={t('teams.nameHint')}>
                    <Input value={name} onChange={(_e, d) => setName(d.value)} maxLength={80} placeholder={t('teams.namePlaceholder')} autoFocus />
                  </Field>
                )}
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" onClick={() => setDialog(null)}>{t('teams.cancel')}</Button>
                <Button type="submit" appearance="primary" disabled={busy || (dialog?.mode !== 'delete' && !name.trim())}>
                  {dialog?.mode === 'create' ? t('teams.create') : dialog?.mode === 'rename' ? t('teams.save') : t('teams.delete')}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </>
  )
}

function TeamCard({ team, people, nameOf, busy, onAdd, onRemove, onRename, onDelete }) {
  const t = useT()
  const managers = team.people.filter((p) => p.kind === 'manager')
  const members = team.people.filter((p) => p.kind === 'member')
  const inThisTeam = new Set(team.people.map((p) => p.id))
  const eligible = {
    manager: people.filter((p) => p.role === 'manager' && p.status !== 'disabled' && !inThisTeam.has(p.id)),
    member: people.filter((p) => p.role === 'member' && p.status !== 'disabled' && !inTeamAsMember(p)),
  }

  return (
    <section className="panel team-card" aria-labelledby={`team-${team.id}`}>
      <div className="team-card-head">
        <span className="team-card-icon" aria-hidden="true"><PeopleTeam20Regular /></span>
        <h2 id={`team-${team.id}`}>{team.name}</h2>
        <span className="muted small team-count">{(team.people.length === 1 ? t('teams.countOne') : t('teams.count', { n: team.people.length }))}</span>
        <Button appearance="subtle" size="small" icon={<Edit20Regular />} onClick={onRename} aria-label={t('teams.renameNamed', { team: team.name })} title={t('teams.rename')} />
        <Button appearance="subtle" size="small" icon={<Delete20Regular />} onClick={onDelete} disabled={team.people.length > 0}
          aria-label={t('teams.deleteNamed', { team: team.name })} title={team.people.length > 0 ? t('teams.deleteBlocked') : t('teams.delete')} />
      </div>
      {['manager', 'member'].map((kind) => (
        <TeamGroup key={kind} kind={kind} team={team} list={kind === 'manager' ? managers : members}
          eligible={eligible[kind]} nameOf={nameOf} busy={busy} onAdd={onAdd} onRemove={onRemove} />
      ))}
    </section>
  )
}

function TeamGroup({ kind, team, list, eligible, nameOf, busy, onAdd, onRemove }) {
  const t = useT()
  const [pick, setPick] = useState('')
  const label = kind === 'manager' ? t('teams.managers') : t('teams.members')
  return (
    <div className="team-group">
      <h3>{label} <span className="muted">{list.length}</span></h3>
      {list.length === 0 ? (
        <p className="muted small team-none">{kind === 'manager' ? t('teams.noManagers') : t('teams.noMembers')}</p>
      ) : (
        <ul className="team-people">
          {list.map((p) => (
            <li key={p.id}>
              <Avatar name={nameOf(p)} size={28} color="colorful" />
              <span className="team-person"><strong>{nameOf(p)}</strong><span className="muted small">{p.email}</span></span>
              <Button appearance="subtle" size="small" icon={<Dismiss16Regular />} disabled={busy} onClick={() => onRemove(team, p)}
                aria-label={t('aria.removeFromTeam', { name: nameOf(p), team: team.name })} title={t('teams.remove')} />
            </li>
          ))}
        </ul>
      )}
      <div className="team-add">
        <Select value={pick} onChange={(_e, d) => setPick(d.value)} disabled={busy || eligible.length === 0}
          aria-label={kind === 'manager' ? t('teams.addManager') : t('teams.addMember')}>
          <option value="">{eligible.length === 0 ? t('teams.noneEligible') : t('teams.pick')}</option>
          {eligible.map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
        </Select>
        <Button icon={<Add20Regular />} disabled={busy || !pick} onClick={async () => { if (await onAdd(team, pick, kind)) setPick('') }}>
          {kind === 'manager' ? t('teams.addManager') : t('teams.addMember')}
        </Button>
      </div>
    </div>
  )
}
