import { Badge, Button } from '@fluentui/react-components'
import { ArrowSwap16Regular, Open16Regular } from '@fluentui/react-icons'
import { useLocale, useT } from '../../lib/i18n.js'
import { caseStage, deadlineCountdown, formatDuration, STAGES } from './caseLogic.js'

const URGENCY_COLOR = { critical: 'danger', high: 'warning', medium: 'informative', low: 'subtle' }
const STAGE_COLOR = { open: 'subtle', in_progress: 'brand', pending_external: 'warning', ready_for_closure: 'informative', closed: 'success' }

export const UrgencyBadge = ({ urgency }) => {
  const t = useT()
  return <Badge className="case-badge" appearance="tint" color={URGENCY_COLOR[urgency] ?? 'subtle'}>{t(`cases.urgency.${urgency}`)}</Badge>
}

export const StageBadge = ({ stage }) => {
  const t = useT()
  return <Badge className="case-badge" appearance="outline" color={STAGE_COLOR[stage]}>{t(`cases.stage.${stage}`)}</Badge>
}

// "5 h left" / "Overdue by 2 h", coloured by urgency; the date itself is in the title for exactness.
export function Countdown({ due, now }) {
  const t = useT()
  const locale = useLocale()
  const { tone, minutes } = deadlineCountdown(due, now)
  if (tone === 'none') return <span className="muted">{t('cases.noDeadline')}</span>
  const text = tone === 'overdue' ? t('cases.overdue', { time: formatDuration(minutes) }) : t('cases.left', { time: formatDuration(minutes) })
  return <time className={`case-due case-due-${tone}`} dateTime={due} title={fmtDate(due, locale)}>{text}</time>
}

export const fmtDate = (iso, locale) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '')

// List view: a table on wide screens, stacked cards on phones (see .case-table in site.css).
export function CaseTable({ cases, followUpCount, officerName, now, onOpen, onMove }) {
  const t = useT()
  return (
    <table className="case-table">
      <thead>
        <tr>
          <th scope="col">{t('cases.col.case')}</th>
          <th scope="col">{t('cases.col.location')}</th>
          <th scope="col">{t('cases.col.officer')}</th>
          <th scope="col">{t('cases.col.urgency')}</th>
          <th scope="col">{t('cases.col.stage')}</th>
          <th scope="col">{t('cases.col.deadline')}</th>
          <th scope="col">{t('cases.col.followUps')}</th>
          <th scope="col"><span className="visually-hidden">{t('cases.col.actions')}</span></th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id}>
            <td data-label={t('cases.col.case')}>
              <div><span className="case-id">{c.number}</span><strong className="case-title">{c.title}</strong></div>
            </td>
            <td data-label={t('cases.col.location')}><div>{[c.block, c.unit].filter(Boolean).join(' · ')}<br /><span className="muted small">{c.estate}</span></div></td>
            <td data-label={t('cases.col.officer')}>{officerName(c.ownerId)}</td>
            <td data-label={t('cases.col.urgency')}><UrgencyBadge urgency={c.urgency} /></td>
            <td data-label={t('cases.col.stage')}><StageBadge stage={caseStage(c)} /></td>
            <td data-label={t('cases.col.deadline')}><Countdown due={c.deadline} now={now} /></td>
            <td data-label={t('cases.col.followUps')}>{followUpCount(c)}</td>
            <td className="case-actions">
              <Button size="small" icon={<Open16Regular />} onClick={() => onOpen(c.id)} aria-label={t('cases.viewNamed', { case: c.number })}>{t('cases.view')}</Button>
              <Button size="small" appearance="subtle" icon={<ArrowSwap16Regular />} onClick={() => onMove(c.id)} aria-label={t('cases.moveNamed', { case: c.number })}>{t('cases.move')}</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Kanban: five columns, each case in exactly one (caseStage). Moving is done with the Move button and the
// stage dialog, which checks the rules; there is no drag-and-drop to bypass them.
export function CaseBoard({ cases, followUpCount, officerName, now, onOpen, onMove }) {
  const t = useT()
  return (
    <div className="case-board" role="list" aria-label={t('cases.viewBoard')}>
      {STAGES.map((stage) => {
        const column = cases.filter((c) => caseStage(c) === stage)
        return (
          <section key={stage} className={`case-column case-column-${stage}`} role="listitem" aria-labelledby={`col-${stage}`}>
            <h3 id={`col-${stage}`}>{t(`cases.stage.${stage}`)} <span className="case-column-count">{column.length}</span></h3>
            {column.length === 0 ? <p className="muted small">{t('cases.columnEmpty')}</p> : (
              <ul>
                {column.map((c) => (
                  <li key={c.id} className="case-card">
                    <div className="case-card-top"><span className="case-id">{c.number}</span><UrgencyBadge urgency={c.urgency} /></div>
                    <strong className="case-title">{c.title}</strong>
                    <span className="muted small">{c.block} · {officerName(c.ownerId)}</span>
                    <div className="case-card-meta small">
                      <Countdown due={c.deadline} now={now} />
                      {followUpCount(c) > 0 && <span>{t('cases.followUpCount', { n: followUpCount(c) })}</span>}
                    </div>
                    {c.pendingRequest && <Badge appearance="tint" color="warning">{t('cases.awaitingDecision')}</Badge>}
                    <div className="case-card-actions">
                      <Button size="small" onClick={() => onOpen(c.id)} aria-label={t('cases.viewNamed', { case: c.number })}>{t('cases.view')}</Button>
                      <Button size="small" appearance="subtle" icon={<ArrowSwap16Regular />} onClick={() => onMove(c.id)} aria-label={t('cases.moveNamed', { case: c.number })}>{t('cases.move')}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
