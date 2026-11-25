export const EVENT_SOURCE = {
  outlook: 'outlook',
  duty: 'syncai-duty',
}

// FullCalendar consumes a shared shape. Instance IDs from Outlook keep recurring occurrences distinct.
export function calendarEventMap({ duties, outlook, outlookLabels }) {
  const entries = new Map()

  function add(source, data, input) {
    const id = source + ':' + data.id
    if (entries.has(id)) return
    entries.set(id, {
      data, input: {
        id, ...input, display: 'block', interactive: true, editable: false,
        backgroundColor: 'transparent', borderColor: 'transparent',
        startEditable: false, durationEditable: false, extendedProps: { source },
      },
    })
  }

  for (const duty of duties) {
    add(EVENT_SOURCE.duty, duty, { title: duty.title, start: duty.startAt, end: duty.endAt, allDay: false })
  }
  for (const event of outlook) {
    const boundary = (date) => event.allDay ? date.toISOString().slice(0, 10) : date.toISOString()
    add(EVENT_SOURCE.outlook, event, {
      title: event.restricted ? outlookLabels.busy : event.subject || outlookLabels.untitled,
      start: boundary(event.start), end: boundary(event.end), allDay: event.allDay,
    })
  }
  return entries
}
