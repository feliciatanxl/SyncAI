export const PLANNING_ZONE = 'Asia/Singapore'
export const DEFAULT_PLANNING_VIEW = 'timeGridWeek'

const localParts = new Intl.DateTimeFormat('sv-SE', {
  timeZone: PLANNING_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export const toPlanningInput = (value) => value ? localParts.format(new Date(value)).replace(' ', 'T') : ''

// EMS schedules use Singapore time. The browser's timezone does not change a booking.
export const fromPlanningInput = (value) => value ? new Date(value + ':00+08:00').toISOString() : null

export function initialDuty({ officerId, start, duty }) {
  return {
    officerId: duty?.officerId || officerId || '',
    title: duty?.title || '',
    category: duty?.category || '',
    type: duty?.type || (start ? 'fixed' : 'flexible'),
    description: duty?.description || '',
    durationMinutes: duty?.durationMinutes ?? 60,
    deadline: toPlanningInput(duty?.deadline),
    startAt: toPlanningInput(duty?.startAt || start),
    endAt: toPlanningInput(duty?.endAt || (start && new Date(+start + 60 * 60_000))),
    location: duty?.location || '',
    shareLocation: duty?.shareLocation ?? false,
    factors: duty?.factors || {},
    remarks: duty?.remarks || '',
  }
}

export function dutyPayload(form) {
  const startAt = form.type === 'fixed' ? fromPlanningInput(form.startAt) : null
  const endAt = form.type === 'fixed' ? fromPlanningInput(form.endAt) : null
  if (form.type === 'fixed' && (!startAt || !endAt || endAt <= startAt)) {
    throw new Error('Enter a start time and an end time after it.')
  }
  return {
    ...form, startAt, endAt, deadline: fromPlanningInput(form.deadline), durationMinutes: Number(form.durationMinutes),
  }
}

export function visibleDuties(assignments, { mine, userId, officers, category }) {
  return assignments.filter((duty) =>
    (mine ? duty.officerId === userId : !officers.length || officers.includes(duty.officerId))
    && (!category || duty.category === category),
  )
}
