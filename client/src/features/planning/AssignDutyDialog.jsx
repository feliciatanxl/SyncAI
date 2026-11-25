import { useState } from 'react'
import {
  Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Textarea,
} from '@fluentui/react-components'
import { dutyPayload, initialDuty } from './planning.js'

export default function AssignDutyDialog({ options, officers, categories, priorityFactors, onClose, onSave }) {
  const { duty } = options
  const [form, setForm] = useState(() => initialDuty(options))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }))
  const bind = (key) => ({ value: form[key], onChange: (event) => set(key, event.target.value) })

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(duty, dutyPayload(form))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(_event, data) => { if (!data.open && !busy) onClose() }}>
      <DialogSurface className="planning-dialog">
        <form onSubmit={submit}>
          <DialogBody>
            <DialogTitle>{duty ? 'Edit duty assignment' : 'Assign duty'}</DialogTitle>
            <DialogContent>
              <fieldset className="planning-form" disabled={busy}>
                <Field label="Duty title" required hint="Visible to authorised teammates." className="planning-form-wide">
                  <Input {...bind('title')} required maxLength={160} />
                </Field>
                <Field label="Assigned officer" required>
                  <Select {...bind('officerId')} required>
                    <option value="">Select an officer</option>
                    {officers.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                  </Select>
                </Field>
                <Field label="Duty category" required>
                  <Select {...bind('category')} required>
                    <option value="">Select a category</option>
                    {categories.map((category) => <option key={category}>{category}</option>)}
                  </Select>
                </Field>
                <Field label="Assignment type" required>
                  <Select {...bind('type')}>
                    <option value="flexible">Flexible · Unscheduled</option>
                    <option value="fixed">Fixed time · Protected</option>
                  </Select>
                </Field>
                <Field label="Estimated duration (minutes)" required>
                  <Input {...bind('durationMinutes')} value={String(form.durationMinutes)} type="number" min={1} max={1440} required />
                </Field>
                {form.type === 'fixed' && (
                  <>
                    <Field label="Starts (Singapore time)" required>
                      <Input {...bind('startAt')} type="datetime-local" required />
                    </Field>
                    <Field label="Ends (Singapore time)" required>
                      <Input {...bind('endAt')} type="datetime-local" required />
                    </Field>
                    <p className="planning-form-wide small muted">Fixed duties are protected. Check availability before booking.</p>
                  </>
                )}
                <Field label="Deadline (Singapore time)">
                  <Input {...bind('deadline')} type="datetime-local" />
                </Field>
                <Field label="Location">
                  <Input {...bind('location')} maxLength={250} />
                </Field>
                <Checkbox className="planning-form-wide" label="Share location with authorised teammates" checked={form.shareLocation}
                  onChange={(_event, data) => set('shareLocation', data.checked === true)} />
                <Field label="Description" className="planning-form-wide">
                  <Textarea {...bind('description')} maxLength={4000} resize="vertical" />
                </Field>
                <fieldset className="planning-form planning-form-wide planning-factors">
                  <legend>EM Services priority factors</legend>
                  {priorityFactors.map(({ key, label }) => (
                    <Field key={key} label={label}>
                      <Textarea value={form.factors[key] || ''} maxLength={500} resize="vertical"
                        onChange={(_event, data) => set('factors', { ...form.factors, [key]: data.value })} />
                    </Field>
                  ))}
                </fieldset>
                <Field label="Additional remarks" className="planning-form-wide">
                  <Textarea {...bind('remarks')} maxLength={2000} resize="vertical" />
                </Field>
              </fieldset>
              {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} disabled={busy}>Close</Button>
              <Button appearance="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save duty'}</Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  )
}
