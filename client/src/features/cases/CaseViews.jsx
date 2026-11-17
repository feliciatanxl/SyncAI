import { useState } from 'react'
import { Avatar, Badge, Button, Tooltip } from '@fluentui/react-components'
import { ArrowSwap16Regular } from '@fluentui/react-icons'
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

function DueDate({ due }) {
  const locale = useLocale()
  return due ? <span className="muted small">{new Date(due).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span> : null
}

// Number in a circle on a collapsed panel heading, so people know what is inside before opening it.
export function CountBadge({ n, urgent }) {
  const t = useT()
  return <span className={`case-count-badge${urgent && n ? ' is-urgent' : ''}`} aria-label={t('cases.items', { n })}>{n}</span>
}

// Clicking anywhere on a row or card opens the case; its own buttons keep their own action.
// Mouse convenience only: the View case button stays the keyboard and screen-reader route.
const openOnClick = (open) => (e) => { if (!e.target.closest('button, a, input, select, textarea')) open() }

export const fmtDate = (iso, locale) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '')

// List view: a table on wide screens, stacked cards on phones (see .case-table in site.css).
export function CaseTable({ cases, followUpCount, officerName, now, onOpen, onMove }) {
  const t = useT()
  return (
    <div className="case-table-wrap">
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
          <tr
            key={c.id}
            className={`case-clickable urgency-${c.urgency}`}
            onClick={openOnClick(() => onOpen(c.id))}
            // Rows are the way into a case: focusable, and Enter or Space opens it.
            tabIndex={0}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(c.id) } }}
          >
            <td data-label={t('cases.col.case')}>
              <div className="case-cell-main"><span className="case-id">{c.number}</span><strong className="case-title">{c.title}</strong><span className="muted small">{c.category}</span></div>
            </td>
            <td data-label={t('cases.col.location')}><div>{[c.block, c.unit].filter(Boolean).join(' · ')}<br /><span className="muted small">{c.estate}</span></div></td>
            <td data-label={t('cases.col.officer')}><Tooltip content={officerName(c.ownerId)} relationship="label"><Avatar size={24} name={officerName(c.ownerId)} color="colorful" role="img" tabIndex={0} /></Tooltip></td>
            <td data-label={t('cases.col.urgency')}><UrgencyBadge urgency={c.urgency} /></td>
            <td data-label={t('cases.col.stage')}><StageBadge stage={caseStage(c)} /></td>
            <td data-label={t('cases.col.deadline')}><div className="case-cell-main"><Countdown due={c.deadline} now={now} /><DueDate due={c.deadline} /></div></td>
            <td data-label={t('cases.col.followUps')}><span className={`case-fu-pill${followUpCount(c) ? ' has' : ''}`}>{followUpCount(c)}</span></td>
            <td className="case-actions">
              <Tooltip content={t('cases.move')} relationship="description">
                <Button size="small" appearance="subtle" icon={<ArrowSwap16Regular />} onClick={() => onMove(c.id)} aria-label={t('cases.moveNamed', { case: c.number })} />
              </Tooltip>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

// Kanban: five columns, each case in exactly one (caseStage).
// Cards can be dragged onto another column; onDrop(caseId, stage) runs the same checks as the Move button,
// which stays as the keyboard and touch alternative (HTML5 drag-and-drop has no keyboard or touch support).
export function CaseBoard({ cases, followUpCount, officerName, now, onOpen, onMove, onDrop }) {
  const t = useT()
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)
  const fromStage = dragId ? caseStage(cases.find((c) => c.id === dragId) ?? {}) : null
  const end = () => { setDragId(null); setOver(null) }
  return (
    <div className="case-board" role="list" aria-label={t('cases.viewBoard')}>
      {STAGES.map((stage) => {
        const column = cases.filter((c) => caseStage(c) === stage)
        return (
          <section
            key={stage}
            className={`case-column case-column-${stage}${over === stage && stage !== fromStage ? ' is-drop-target' : ''}`}
            role="listitem"
            aria-labelledby={`col-${stage}`}
            onDragOver={(e) => { if (dragId && stage !== fromStage) { e.preventDefault(); setOver(stage) } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null) }}
            onDrop={(e) => { e.preventDefault(); const id = dragId; end(); if (id && stage !== fromStage) onDrop(id, stage) }}
          >
            <h3 id={`col-${stage}`}>{t(`cases.stage.${stage}`)} <span className="case-column-count">{column.length}</span></h3>
            {column.length === 0 ? <p className="muted small">{t('cases.columnEmpty')}</p> : (
              <ul>
                {column.map((c) => (
                  <li
                    key={c.id}
                    className={`case-card case-clickable urgency-${c.urgency}${dragId === c.id ? ' is-dragging' : ''}`}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.number); setDragId(c.id) }}
                    onDragEnd={end}
                    onClick={openOnClick(() => onOpen(c.id))}
                    title={t('cases.dragHint')}
                  >
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
