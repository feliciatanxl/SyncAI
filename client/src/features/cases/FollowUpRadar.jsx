import { useState } from 'react'
import { Badge, Button } from '@fluentui/react-components'
import { ChevronDown16Regular, ChevronUp16Regular, Info16Regular, Open16Regular, Radar20Regular } from '@fluentui/react-icons'
import { useT } from '../../lib/i18n.js'
import { CountBadge, Countdown } from './CaseViews.jsx'

// Outstanding commitments found by fixed rules. Labelled as rule-based so nobody mistakes it for a model.
export default function FollowUpRadar({ findings, now, onOpen, onAct }) {
  const t = useT()
  const [open, setOpen] = useState(null)
  const [all, setAll] = useState(false)
  const shown = all ? findings : findings.slice(0, 3)
  return (
    <details id="radar" className="panel case-radar case-collapsible">
      <summary className="panel-head">
        <h2 id="radar-h"><Radar20Regular /> {t('cases.radar.title')} <CountBadge n={findings.length} urgent /></h2>
      </summary>
      <p className="muted small">{t('cases.radar.lead')}</p>
      {findings.length === 0 ? <p className="empty">{t('cases.radar.empty')}</p> : (
        <ul className="radar-list">
          {shown.map((f) => (
            <li key={f.id} className={`radar-item radar-${f.severity}`}>
              <div className="radar-main">
                <div className="radar-head">
                  <div className="radar-title">
                    <strong>{f.title}</strong>
                    {f.severity === 'critical' && <Badge appearance="filled" color="danger">{t('cases.critical')}</Badge>}
                  </div>
                  <Countdown due={f.due} now={now} />
                </div>
                <p className="radar-case small"><span className="case-id">{f.caseNumber}</span> {f.caseTitle}</p>
                <dl className="radar-facts small">
                  <div><dt>{t('cases.record')}</dt><dd>{f.record.label}</dd></div>
                  <div><dt>{t('cases.next')}</dt><dd>{f.nextStep}</dd></div>
                </dl>
                {open === f.id && (
                  <div className="radar-why small" id={`why-${f.id}`}>
                    <p><strong>{t('cases.why.found')}</strong> {f.reason}</p>
                    <p><strong>{t('cases.why.rule')}</strong> {f.threshold}</p>
                    <p className="muted">{t('cases.why.review')}</p>
                  </div>
                )}
              </div>
              <div className="radar-actions">
                <Button size="small" icon={<Open16Regular />} onClick={() => onOpen(f.caseId)}>{t('cases.view')}</Button>
                <Button size="small" appearance="subtle" icon={<Info16Regular />} aria-expanded={open === f.id} aria-controls={`why-${f.id}`} onClick={() => setOpen(open === f.id ? null : f.id)}>
                  {t('cases.why')}
                </Button>
                <Button size="small" appearance="primary" onClick={() => onAct(f)}>{t('cases.act')}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {findings.length > 3 && (
        <div className="radar-more-wrap">
          <Button appearance="subtle" className="radar-more" icon={all ? <ChevronUp16Regular /> : <ChevronDown16Regular />} iconPosition="after" onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? t('cases.radar.less') : t('cases.radar.all')}
          </Button>
        </div>
      )}
    </details>
  )
}
