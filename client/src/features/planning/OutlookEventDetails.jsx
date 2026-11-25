import { Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from '@fluentui/react-components'
import { formatDuration } from '../../lib/graph.js'
import { useLocale, useT } from '../../lib/i18n.js'

export default function OutlookEventDetails({ event, title, formatTime, formatAllDay, onClose }) {
  const t = useT()
  const locale = useLocale()
  return (
    <Dialog open onOpenChange={(_event, data) => { if (!data.open) onClose() }}>
      <DialogSurface className="planning-dialog">
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <Badge appearance="tint">Outlook · Read-only</Badge>
            <dl className="planning-details">
              {event.allDay ? <><dt>{t('cal.allDay')}</dt><dd>{formatAllDay(event)}</dd></> : (
                <><dt>Starts</dt><dd>{formatTime(event.start)}</dd><dt>Ends</dt><dd>{formatTime(event.end)}</dd></>
              )}
              {event.showAs && <><dt>Status</dt><dd>{t('cal.show.' + event.showAs)}</dd></>}
              {!event.allDay && event.minutes > 0 && <><dt>Duration</dt><dd>{formatDuration(event.minutes, locale)}</dd></>}
              {event.location && <><dt>Location</dt><dd>{event.location}</dd></>}
            </dl>
          </DialogContent>
          <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
