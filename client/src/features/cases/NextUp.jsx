import { Button } from '@fluentui/react-components'
import { ArrowRight16Regular, CheckmarkCircle24Regular, Flash20Regular } from '@fluentui/react-icons'
import { useT } from '../../lib/i18n.js'
import { caseStage, detectFollowUps } from './caseLogic.js'
import { Countdown, UrgencyBadge } from './CaseViews.jsx'

// The few cases to work on first this shift, in priority order, each with one obvious button.
export default function NextUp({ cases, now, officerName, onStart }) {
  const t = useT()
  const next = cases.filter((c) => caseStage(c) !== 'closed').slice(0, 3)
  return (
    <section id="next-up" className="panel case-next" aria-labelledby="next-h">
      <div className="panel-head">
        <h2 id="next-h"><Flash20Regular /> {t('cases.next.title')}</h2>
      </div>
      <p className="muted small">{t('cases.next.lead')}</p>
      {next.length === 0 ? (
        <p className="empty"><CheckmarkCircle24Regular /> {t('cases.next.clear')}</p>
      ) : (
        <ol className="next-list">
          {next.map((c, i) => {
            const top = detectFollowUps(c, now)[0]
            return (
              <li key={c.id} className={`next-item urgency-${c.urgency}`}>
                <span className="next-rank" aria-hidden="true">{i + 1}</span>
                <div className="next-main">
                  <div className="next-top">
                    <span className="case-id">{c.number}</span>
                    <UrgencyBadge urgency={c.urgency} />
                    <Countdown due={c.deadline} now={now} />
                  </div>
                  <strong className="case-title">{c.title}</strong>
                  <span className="muted small">{[c.block, c.unit].filter(Boolean).join(' · ')} · {officerName(c.ownerId)}</span>
                  <p className="next-step small"><strong>{t('cases.next')}:</strong> {top ? top.nextStep : t('cases.next.review')}</p>
                </div>
                <Button
                  appearance={i === 0 ? 'primary' : 'secondary'}
                  icon={<ArrowRight16Regular />}
                  iconPosition="after"
                  onClick={() => onStart(c.id, top ? 'followUps' : 'timeline')}
                  aria-label={t('cases.next.startNamed', { case: c.number })}
                >
                  {t('cases.next.start')}
                </Button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
