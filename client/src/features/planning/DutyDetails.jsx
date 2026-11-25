import { useState } from 'react'
import {
  Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, MessageBar, MessageBarBody,
} from '@fluentui/react-components'

export default function DutyDetails({ duty, priorityFactors, formatTime, onClose, onEdit, onCancel }) {
  const [confirmation, setConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const manageable = duty.canManage && duty.status !== 'cancelled'

  async function cancel() {
    setBusy(true)
    setError('')
    try {
      await onCancel(duty)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(_event, data) => { if (!data.open && !busy) onClose() }}>
      <DialogSurface className="planning-dialog">
        <DialogBody>
          <DialogTitle>{duty.title}</DialogTitle>
          <DialogContent>
            <Badge appearance="tint" color={duty.status === 'protected' ? 'informative' : 'subtle'}>
              {{ protected: 'Protected duty', unscheduled: 'Unscheduled', cancelled: 'Cancelled' }[duty.status]}
            </Badge>
            <dl className="planning-details">
              <dt>Assigned officer</dt><dd>{duty.officerName}</dd>
              <dt>Category</dt><dd>{duty.category}</dd>
              {duty.startAt && <><dt>Starts</dt><dd>{formatTime(duty.startAt)}</dd><dt>Ends</dt><dd>{formatTime(duty.endAt)}</dd></>}
              {duty.durationMinutes && <><dt>Duration</dt><dd>{duty.durationMinutes} min</dd></>}
              {duty.deadline && <><dt>Deadline</dt><dd>{formatTime(duty.deadline)}</dd></>}
              {duty.location && <><dt>Location</dt><dd>{duty.location}</dd></>}
              {duty.description && <><dt>Description</dt><dd>{duty.description}</dd></>}
              {priorityFactors.filter(({ key }) => duty.factors?.[key]).map(({ key, label }) => (
                <div className="planning-detail-pair" key={key}><dt>{label}</dt><dd>{duty.factors[key]}</dd></div>
              ))}
              {duty.remarks && <><dt>Remarks</dt><dd>{duty.remarks}</dd></>}
            </dl>
            {confirmation && <p>Cancel this assignment? It will be removed from the active calendar or backlog.</p>}
            {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={confirmation ? () => setConfirmation(false) : onClose}>{confirmation ? 'Keep duty' : 'Close'}</Button>
            {manageable && !confirmation && <Button onClick={() => setConfirmation(true)}>Cancel duty</Button>}
            {manageable && !confirmation && <Button appearance="primary" onClick={() => onEdit(duty)}>Edit duty</Button>}
            {confirmation && <Button appearance="primary" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</Button>}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
