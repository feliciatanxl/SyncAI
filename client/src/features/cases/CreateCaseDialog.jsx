import { useState } from 'react'
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, MessageBar, MessageBarBody, Select, Spinner, Textarea,
} from '@fluentui/react-components'
import { useT } from '../../lib/i18n.js'
import { URGENCIES } from './caseLogic.js'

const REQUIRED = ['title', 'category', 'description', 'estate', 'location', 'urgency', 'teamId', 'ownerId', 'deadline']
// <input type="datetime-local"> value -> ISO string (it's in the browser's local time).
const toIso = (local) => (local ? new Date(local).toISOString() : null)

// New case form. `teams` come from the server and hold only the teams and officers this person may choose;
// the server checks both again. Nothing is shown as saved until `onCreate` resolves with the stored case.
export default function CreateCaseDialog({ open, teams, categories, onClose, onCreate }) {
  const t = useT()
  const blank = () => ({
    title: '', category: '', description: '', estate: '', location: '', urgency: 'medium',
    teamId: teams[0]?.id ?? '', ownerId: teams[0]?.officers[0]?.id ?? '', deadline: '', followUpDue: '',
  })
  const [form, setForm] = useState(blank)
  const [missing, setMissing] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const team = teams.find((x) => x.id === form.teamId)

  const set = (key) => (_e, d) => {
    setForm((f) => (key === 'teamId'
      ? { ...f, teamId: d.value, ownerId: teams.find((x) => x.id === d.value)?.officers[0]?.id ?? '' }
      : { ...f, [key]: d.value }))
    setMissing((m) => m.filter((k) => k !== key))
  }
  const close = () => { if (!busy) { setForm(blank()); setMissing([]); setError(null); onClose() } }

  async function submit(e) {
    e.preventDefault()
    const gaps = REQUIRED.filter((k) => !String(form[k]).trim())
    if (gaps.length) return setMissing(gaps)
    setBusy(true)
    setError(null)
    try {
      const created = await onCreate({ ...form, deadline: toIso(form.deadline), followUpDue: toIso(form.followUpDue) })
      setForm(blank())
      onClose(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const field = (key, label, control, extra = {}) => (
    <Field label={label} required={REQUIRED.includes(key)} validationMessage={missing.includes(key) ? t('cases.create.required') : undefined} {...extra}>
      {control}
    </Field>
  )

  return (
    <Dialog open={open} onOpenChange={(_e, d) => !d.open && close()}>
      <DialogSurface className="case-create-dialog">
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <DialogTitle>{t('cases.create.title')}</DialogTitle>
            <DialogContent>
              <p className="muted small">{t('cases.create.lead')}</p>
              <div className="case-create-grid">
                {field('title', t('cases.create.f.title'), <Input value={form.title} onChange={set('title')} maxLength={200} />, { className: 'span-2' })}
                {field('category', t('cases.create.f.category'), (
                  <Select value={form.category} onChange={set('category')}>
                    <option value="">{t('cases.create.choose')}</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                ))}
                {field('urgency', t('cases.create.f.urgency'), (
                  <Select value={form.urgency} onChange={set('urgency')}>
                    {URGENCIES.map((u) => <option key={u} value={u}>{t(`cases.urgency.${u}`)}</option>)}
                  </Select>
                ))}
                {field('description', t('cases.create.f.description'), <Textarea value={form.description} onChange={set('description')} maxLength={2000} resize="vertical" />, { className: 'span-2' })}
                {field('estate', t('cases.create.f.estate'), <Input value={form.estate} onChange={set('estate')} maxLength={80} />)}
                {field('location', t('cases.create.f.location'), <Input value={form.location} onChange={set('location')} maxLength={120} />)}
                {field('teamId', t('cases.create.f.team'), (
                  <Select value={form.teamId} onChange={set('teamId')}>
                    {teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </Select>
                ))}
                {field('ownerId', t('cases.create.f.officer'), (
                  <Select value={form.ownerId} onChange={set('ownerId')}>
                    {(team?.officers ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                ))}
                {field('deadline', t('cases.create.f.deadline'), <Input type="datetime-local" value={form.deadline} onChange={set('deadline')} />)}
                {field('followUpDue', t('cases.create.f.followUp'), <Input type="datetime-local" value={form.followUpDue} onChange={set('followUpDue')} />)}
              </div>
              {error && <MessageBar intent="error" className="case-stage-check"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={close} disabled={busy}>{t('cases.cancel')}</Button>
              <Button appearance="primary" type="submit" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
                {busy ? t('cases.create.saving') : t('cases.create.save')}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  )
}
