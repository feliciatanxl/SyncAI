import { useState } from 'react'
import { Button, Popover, PopoverSurface, PopoverTrigger, Tab, TabList } from '@fluentui/react-components'
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

  return (
    <Popover open={open} onOpenChange={(_e, d) => setOpen(d.open)} positioning="below-end" withArrow={false}>
      <PopoverTrigger disableButtonEnhancement>
        <button
          type="button"
          className="notif-trigger"
          aria-label={unreadItems.length ? t('notif.labelUnread', { n: unreadItems.length }) : t('notif.label')}
        >
          <Alert24Filled aria-hidden="true" />
          {unreadItems.length > 0 && <span className="notif-count" aria-hidden="true">{unreadItems.length > 9 ? '9+' : unreadItems.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverSurface className="notif-card" aria-label={t('notif.title')}>
        <div className="notif-head">
          <div>
            <h2>{t('notif.title')}</h2>
            <p className="muted small">{t('notif.unreadCount', { n: unreadItems.length })}</p>
          </div>
          {unreadItems.length > 0 && (
            <Button appearance="subtle" onClick={() => markRead(items.map((n) => n.id))}>{t('notif.markRead')}</Button>
          )}
        </div>
        <TabList className="notif-tabs" selectedValue={filter} onTabSelect={(_e, d) => setFilter(d.value)} size="small">
          <Tab value="all">{t('notif.all', { n: items.length })}</Tab>
          <Tab value="unread">{t('notif.unread', { n: unreadItems.length })}</Tab>
        </TabList>

        {shown.length === 0 ? (
          <p className="notif-empty muted"><Alert20Regular aria-hidden="true" /> {filter === 'unread' && items.length ? t('notif.noneUnread') : t('notif.empty')}</p>
        ) : (
          <ul className="notif-list">
            {shown.map((n) => {
              const unread = !seen.has(n.id)
              return (
                <li key={n.id} className={`notif-item${unread ? ' is-unread' : ''}`}>
                  <div className="notif-item-head">
                    <strong>{n.title}</strong>
                    {n.tag && <span className={`notif-tag tone-${n.tone ?? 'info'}`}>{n.tag}</span>}
                  </div>
                  {n.detail && <p className="notif-detail muted small">{n.detail}</p>}
                  <div className="notif-item-actions">
                    <Button size="small" appearance="transparent" icon={<ArrowRight16Regular />} iconPosition="after" onClick={() => go(n)}>{n.action}</Button>
                    {unread && <Button size="small" appearance="transparent" onClick={() => markRead([n.id])}>{t('notif.markOne')}</Button>}
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
