import { useState } from 'react'
import { Button, CounterBadge, Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components'
import { Alert20Regular, Alert24Regular, ChevronRight16Regular } from '@fluentui/react-icons'
import { useT } from '../lib/i18n.js'

const SEEN_KEY = 'syncai.notifications.seen'

function readSeen(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(`${SEEN_KEY}.${userId}`)) ?? [])
  } catch {
    return new Set()
  }
}

// In-app notifications in the header. `items`: [{ id, title, detail, section, tone }] built by the portal from data
// SyncAI already has; ids change when the underlying thing changes, so a new event shows as unread again.
// "Mark all as read" is remembered per person in this browser only (a convenience, not a record).
export default function NotificationBell({ userId, items, onOpen }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => readSeen(userId))
  const unread = items.filter((n) => !seen.has(n.id)).length

  const markAllRead = () => {
    const next = new Set(items.map((n) => n.id))
    setSeen(next)
    try { localStorage.setItem(`${SEEN_KEY}.${userId}`, JSON.stringify([...next])) } catch { /* storage blocked: keep in memory */ }
  }
  const go = (n) => {
    setOpen(false)
    onOpen(n.section)
  }

  return (
    <Popover open={open} onOpenChange={(_e, d) => setOpen(d.open)} positioning="below-end" withArrow={false}>
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          className="notif-trigger"
          icon={<Alert24Regular />}
          aria-label={unread ? t('notif.labelUnread', { n: unread }) : t('notif.label')}
        >
          {unread > 0 && <CounterBadge className="notif-count" count={unread} size="small" color="danger" overflowCount={9} aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className="notif-card" aria-label={t('notif.title')}>
        <div className="notif-head">
          <strong>{t('notif.title')}</strong>
          {unread > 0 && <Button size="small" appearance="transparent" onClick={markAllRead}>{t('notif.markRead')}</Button>}
        </div>
        {items.length === 0 ? (
          <p className="notif-empty muted"><Alert20Regular aria-hidden="true" /> {t('notif.empty')}</p>
        ) : (
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" className={`notif-item tone-${n.tone ?? 'info'}${seen.has(n.id) ? '' : ' is-unread'}`} onClick={() => go(n)}>
                  <span className="notif-dot" aria-hidden="true" />
                  <span className="notif-text">
                    <strong>{n.title}</strong>
                    {n.detail && <span className="muted small">{n.detail}</span>}
                  </span>
                  <ChevronRight16Regular aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverSurface>
    </Popover>
  )
}
