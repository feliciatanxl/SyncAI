import { describe, expect, it } from 'vitest'
import { calendarEventMap } from './calendarEvents.js'

const outlookLabels = { busy: 'Busy', untitled: 'No title' }
const duty = { id: 'shared', title: 'Duty', startAt: '2026-11-23T02:00:00.000Z', endAt: '2026-11-23T03:00:00.000Z' }
const meeting = { id: 'shared', subject: 'Meeting', start: new Date(duty.startAt), end: new Date(duty.endAt), allDay: false }

describe('unified calendar events', () => {
  it('namespaces identities, deduplicates repeated instances and leaves distinct occurrences visible', () => {
    const events = calendarEventMap({ duties: [duty, duty], outlook: [meeting, meeting, { ...meeting, id: 'next-occurrence' }], outlookLabels })
    expect([...events.keys()]).toEqual(['syncai-duty:shared', 'outlook:shared', 'outlook:next-occurrence'])
    for (const { input } of events.values()) expect(input).toMatchObject({ editable: false, startEditable: false, durationEditable: false })
  })

  it('preserves the exclusive end for all-day events and labels restricted events Busy', () => {
    const allDay = { ...meeting, allDay: true, restricted: true, start: new Date('2026-11-23'), end: new Date('2026-11-25') }
    const events = calendarEventMap({ duties: [], outlook: [allDay], outlookLabels })
    expect(events.get('outlook:shared').input).toMatchObject({
      title: 'Busy', start: '2026-11-23', end: '2026-11-25', allDay: true, extendedProps: { source: 'outlook' },
    })
  })
})
