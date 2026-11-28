// @vitest-environment jsdom
// What the Case Action Centre and the bell show for real API results: empty lists, failures, and a change of person.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { PreferencesContext } from '../../lib/i18n.js'
import { ApiError } from '../../lib/api.js'
import NotificationBell from '../../components/NotificationBell.jsx'
import CaseActionCentre from './CaseActionCentre.jsx'
import { CASE_STRINGS } from './caseStrings.js'
import { caseNotifications } from './caseNotifications.js'
import { caseSummary, shiftCounts } from './caseLogic.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const en = CASE_STRINGS.en
const managerA = { id: 'mA', status: 'active', role: 'manager', displayName: 'Manager A' }
const managerB = { id: 'mB', status: 'active', role: 'manager', displayName: 'Manager B' }
const empty = { cases: [], officers: [{ id: 'mA', name: 'Manager A' }], managedOfficerIds: [] }

let root, el
afterEach(() => { act(() => root?.unmount()); el?.remove() })
async function render(node) {
  el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root.render(wrap(node)))
}
const wrap = (node) => <PreferencesContext.Provider value={{ language: 'en' }}><FluentProvider theme={webLightTheme}>{node}</FluentProvider></PreferencesContext.Provider>
const text = () => el.textContent
const service = (list) => ({ mode: 'api', list })

describe('an empty authorised case list from the API', () => {
  it('counts zero everywhere', async () => {
    expect(caseSummary([], new Date())).toEqual({ open: 0, followUps: 0, blocked: 0, ready: 0 })
    expect(shiftCounts([], new Date())).toEqual({ overdue: 0, dueSoon: 0 })
    await render(<CaseActionCentre me={managerA} service={service(async () => empty)} />)
    const cards = [...el.querySelectorAll('.case-stat strong')].map((s) => s.textContent)
    expect(cards).toEqual(['0', '0', '0', '0'])
    expect(text()).toContain(en['cases.shift.overdue'])
  })

  it('shows no Next Up items, an empty radar and no list or Kanban cards', async () => {
    await render(<CaseActionCentre me={managerA} service={service(async () => empty)} />)
    expect(text()).toContain(en['cases.next.clear'])
    expect(text()).toContain(en['cases.radar.empty'])
    expect(text()).toContain(en['cases.empty'])
    expect(el.querySelectorAll('.case-card, tbody tr, [draggable="true"]').length).toBe(0)
  })

  it('produces no case notifications, so the bell shows no unread badge', async () => {
    expect(caseNotifications([], managerA)).toEqual([])
    await render(<NotificationBell userId="mA" items={[]} onOpen={() => {}} />)
    expect(el.querySelector('.notif-count')).toBeNull()
  })
})

describe('API failures are errors, never empty results or demo cases', () => {
  it('shows the error state with the server’s message', async () => {
    await render(<CaseActionCentre me={managerA} service={service(async () => { throw new ApiError(500, { message: 'Something went wrong on our side.' }) })} />)
    expect(text()).toContain(en['cases.loadFailed'])
    expect(text()).toContain('Something went wrong on our side.')
    expect(text()).not.toContain(en['cases.empty'])
    expect(text()).not.toMatch(/CAS-2026|Blk 211/)
    expect(el.querySelectorAll('.case-stat').length).toBe(0)
  })

  it('shows a separate unauthorised state for 403', async () => {
    await render(<CaseActionCentre me={managerA} service={service(async () => { throw new ApiError(403, { message: 'nope' }) })} />)
    expect(text()).toContain(en['cases.forbidden'])
    expect(text()).not.toContain(en['cases.loadFailed'])
  })
})

describe('switching person', () => {
  it('drops the previous person’s cases before the next person’s load finishes', async () => {
    const secret = { id: 'c1', number: 'SECRET-1', title: 'Team A only', stage: 'open', ownerId: 'mA', urgency: 'high', estate: 'Zone A', blockers: [], checkpoints: [], evidence: [], timeline: [], history: [], communications: [], pendingRequest: null }
    const svcA = service(async () => ({ ...empty, cases: [secret] }))
    await render(<CaseActionCentre me={managerA} service={svcA} />)
    expect(text()).toContain('SECRET-1')
    await act(async () => root.render(wrap(<CaseActionCentre me={managerB} service={service(() => new Promise(() => {}))} />)))
    expect(text()).not.toContain('SECRET-1')
    expect(text()).toContain(en['cases.loading'])
  })
})
