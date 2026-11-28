import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from '@fluentui/react-components'
import { CheckmarkCircle48Filled } from '@fluentui/react-icons'
import { useLocale, useT } from '../../lib/i18n.js'
import { UrgencyBadge, fmtDate } from './CaseViews.jsx'

// Shown only after the server has saved the case and sent it back, so every detail here is the stored record.
export default function CaseCreatedDialog({ kase, officerName, onOpen, onClose }) {
  const t = useT()
  const locale = useLocale()
  return (
    <Dialog open={Boolean(kase)} onOpenChange={(_e, d) => !d.open && onClose()}>
      <DialogSurface className="case-created-dialog" aria-describedby="case-created-text">
        {kase && (
          <DialogBody>
            <DialogTitle className="case-created-title">
              <CheckmarkCircle48Filled className="case-created-icon" aria-hidden="true" />
              <span>{t('cases.create.doneTitle')}</span>
            </DialogTitle>
            <DialogContent>
              <p id="case-created-text" className="muted case-created-lead">{t('cases.create.doneText')}</p>
              <div className="case-created-card">
                <div className="case-created-head">
                  <span className="case-created-number">{kase.number}</span>
                  <UrgencyBadge urgency={kase.urgency} />
                </div>
                <strong className="case-created-name">{kase.title}</strong>
                <dl className="case-created-facts">
                  <div><dt>{t('cases.create.f.officer')}</dt><dd>{officerName(kase.ownerId)}</dd></div>
                  <div><dt>{t('cases.create.f.deadline')}</dt><dd>{kase.deadline ? fmtDate(kase.deadline, locale) : '—'}</dd></div>
                  <div><dt>{t('cases.create.f.location')}</dt><dd>{[kase.estate, kase.unit].filter(Boolean).join(' · ') || '—'}</dd></div>
                </dl>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose}>{t('cases.create.close')}</Button>
              <Button appearance="primary" onClick={onOpen}>{t('cases.create.open')}</Button>
            </DialogActions>
          </DialogBody>
        )}
      </DialogSurface>
    </Dialog>
  )
}
