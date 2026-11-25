import { describe, expect, it } from 'vitest'
import { dutyPayload, initialDuty, visibleDuties } from './planning.js'

describe('Team Calendar', () => {
  it('uses the clicked slot in Singapore time even when the browser is elsewhere', () => {
    const slot = new Date('2026-11-23T03:00:00.000Z')
    const form = initialDuty({ officerId: 'a', start: slot })
    expect(form).toMatchObject({ type: 'fixed', startAt: '2026-11-23T11:00', endAt: '2026-11-23T12:00' })
    expect(dutyPayload(form)).toMatchObject({ startAt: slot.toISOString(), endAt: '2026-11-23T04:00:00.000Z' })
  })

  it('clears booking times for a flexible assignment and validates a fixed end time', () => {
    const form = initialDuty({ start: new Date('2026-11-23T03:00:00.000Z') })
    expect(dutyPayload({ ...form, type: 'flexible' })).toMatchObject({ startAt: null, endAt: null })
    expect(() => dutyPayload({ ...form, endAt: form.startAt })).toThrow(/after it/)
  })

  it('intersects the team filters and keeps My Calendar scoped to the signed-in officer', () => {
    const assignments = [
      { id: '1', officerId: 'a', category: 'Inspection' },
      { id: '2', officerId: 'b', category: 'Maintenance' },
      { id: '3', officerId: 'a', category: 'Maintenance' },
    ]
    expect(visibleDuties(assignments, { mine: true, userId: 'a', officers: ['b'], category: '' }).map((d) => d.id)).toEqual(['1', '3'])
    expect(visibleDuties(assignments, { mine: false, officers: ['b'], category: 'Maintenance' }).map((d) => d.id)).toEqual(['2'])
    expect(visibleDuties(assignments, { mine: false, officers: ['a', 'b'], category: 'Maintenance' }).map((d) => d.id)).toEqual(['2', '3'])
  })
})
