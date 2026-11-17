import { useState } from 'react'
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, MessageBar, MessageBarBody, Radio, RadioGroup, Textarea,
} from '@fluentui/react-components'
import { useT } from '../../lib/i18n.js'
import { caseStage, checkTransition, STAGES } from './caseLogic.js'

// Move a case to another stage. Every option shows whether it's allowed and why, before anything is sent;
// the service checks again, and a team member's closure becomes a request for their manager.
export default function CaseStageDialog({ kase, me, managedOfficerIds, onClose, onSubmit }) {
  const t = useT()
  const current = kase ? caseStage(kase) : null
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const check = kase && target ? checkTransition(kase, target, me, managedOfficerIds) : null

  async function submit(e) {
    e.preventDefault()
    if (!check?.allowed) return
    if (check.needsReason && !reason.trim()) return setError(t('cases.reasonRequired'))
    setBusy(true)
    setError(null)
    try {
      await onSubmit(kase.id, target, reason)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(kase)} onOpenChange={(_e, d) => !d.open && onClose()}>
      <DialogSurface className="case-stage-dialog">
        {kase && (
          <form onSubmit={submit}>
            <DialogBody>
              <DialogTitle>{t('cases.moveTitle', { case: kase.number })}</DialogTitle>
              <DialogContent>
                <p className="muted small">{kase.title} · {t('cases.currentStage', { stage: t(`cases.stage.${current}`) })}</p>
                <RadioGroup value={target} onChange={(_e, d) => { setTarget(d.value); setError(null) }} aria-label={t('cases.moveTarget')}>
                  {STAGES.filter((s) => s !== current).map((s) => {
                    const c = checkTransition(kase, s, me, managedOfficerIds)
                    return (
                      <Radio key={s} value={s} label={<span>{t(`cases.stage.${s}`)}{!c.allowed && <span className="muted small"> — {t('cases.notAllowed')}</span>}</span>} />
                    )
                  })}
                </RadioGroup>
                {check && (
                  <MessageBar intent={check.allowed ? (check.needsApproval ? 'warning' : 'info') : 'error'} className="case-stage-check">
                    <MessageBarBody>{check.message || t('cases.allowed')}</MessageBarBody>
                  </MessageBar>
                )}
                {check?.allowed && (
                  <Field label={check.needsReason ? t('cases.reason') : t('cases.reasonOptional')} required={check.needsReason}>
                    <Textarea value={reason} onChange={(_e, d) => setReason(d.value)} resize="vertical" />
                  </Field>
                )}
                {error && <MessageBar intent="error" className="case-stage-check"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" onClick={onClose}>{t('cases.cancel')}</Button>
                <Button appearance="primary" type="submit" disabled={!check?.allowed || busy}>
                  {check?.needsApproval ? t('cases.requestClosure') : t('cases.confirmMove')}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        )}
      </DialogSurface>
    </Dialog>
  )
}
