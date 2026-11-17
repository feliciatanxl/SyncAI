import { useState } from 'react'
import { Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components'
import { Alert20Regular, Alert24Filled, ArrowRight16Regular } from '@fluentui/react-icons'
import { useT } from '../lib/i18n.js'

const SEEN_KEY = 'syncai.notifications.seen'

function readSeen(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(`${SEEN_KEY}.${userId}`)) ?? [])
  } catch {
    return new Set()
  }
}

// In-app notifications in the header. `items`: [{ id, title, detail, tag, tone, section, action }] built by the
// portal from data SyncAI already has; ids change when the underlying thing changes, so a new event shows as unread.
// Read state is remembered per person in this browser only (a convenience, not a record).
export default function NotificationBell({ userId, items, onOpen }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [seen, setSeen] = useState(() => readSeen(userId))
  const unreadItems = items.filter((n) => !seen.has(n.id))
  const shown = filter === 'unread' ? unreadItems : items

  const save = (next) => {
    setSeen(next)
    try { localStorage.setItem(`${SEEN_KEY}.${userId}`, JSON.stringify([...next])) } catch { /* storage blocked: keep in memory */ }
  }
  const markRead = (ids) => save(new Set([...seen, ...ids]))
  const go = (n) => {
    markRead([n.id])
    setOpen(false)
    onOpen(n.section)
  }
  const tabs = [['all', t('notif.all', { n: items.length })], ['unread', t('notif.unread', { n: unreadItems.length })]]

  return (
    <Popover open={open} onOpenChange={(_e, d) => setOpen(d.open)} positioning="below-end" withArrow={false}>
      <PopoverTrigger disableButtonEnhancement>
        <button type="button" className="notif-trigger" aria-label={unreadItems.length ? t('notif.labelUnread', { n: unreadItems.length }) : t('notif.label')}>
          <Alert24Filled aria-hidden="true" />
          {unreadItems.length > 0 && <span className="notif-count" aria-hidden="true">{unreadItems.length > 9 ? '9+' : unreadItems.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverSurface className="notif-card" aria-label={t('notif.title')}>
        <div className="notif-head">
          <div className="notif-head-text">
            <h2>{t('notif.title')}</h2>
            <p>{t('notif.unreadCount', { n: unreadItems.length })}</p>
          </div>
          {unreadItems.length > 0 && (
            <button type="button" className="notif-link" onClick={() => markRead(items.map((n) => n.id))}>{t('notif.markRead')}</button>
          )}
        </div>

        <div className="notif-tabs" role="tablist" aria-label={t('notif.title')}>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className="notif-tab" onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="notif-empty"><Alert20Regular aria-hidden="true" /> {filter === 'unread' && items.length ? t('notif.noneUnread') : t('notif.empty')}</p>
        ) : (
          <ul className="notif-list" role="tabpanel">
            {shown.map((n) => {
              const unread = !seen.has(n.id)
              return (
                <li key={n.id} className={`notif-item${unread ? ' is-unread' : ''}`}>
                  <div className="notif-item-head">
                    <strong>{n.title}</strong>
                    {n.tag && <span className={`notif-tag tone-${n.tone ?? 'info'}`}>{n.tag}</span>}
                  </div>
                  {n.detail && <p className="notif-detail">{n.detail}</p>}
                  <div className="notif-item-actions">
                    <button type="button" className="notif-link" onClick={() => go(n)}>{n.action} <ArrowRight16Regular aria-hidden="true" /></button>
                    {unread && <button type="button" className="notif-link" onClick={() => markRead([n.id])}>{t('notif.markOne')}</button>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverSurface>
    </Popover>
  )
}
