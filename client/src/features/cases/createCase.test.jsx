// @vitest-environment jsdom
// Create Case through the real form: from an empty dashboard to one saved case, and a refused save that shows nothing as saved.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { PreferencesContext } from '../../lib/i18n.js'
import { ApiError } from '../../lib/api.js'
import CaseActionCentre from './CaseActionCentre.jsx'
import { CASE_STRINGS } from './caseStrings.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
// jsdom has no ResizeObserver; Fluent's positioning only needs it to exist.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
const en = CASE_STRINGS.en
const manager = { id: 'm1', status: 'active', role: 'manager', displayName: 'Manager' }
const teams = [{ id: 'team-1', name: 'Team A', officers: [{ id: 'm1', name: 'Manager' }, { id: 'o1', name: 'Officer One' }] }]

// Stands in for the API: list() returns what create() has stored, like the server does after a save.
function fakeApi({ fail } = {}) {
  const cases = []
  const sent = []
  return {
    sent,
    mode: 'api',
    list: async () => ({ cases: structuredClone(cases), officers: teams[0].officers, managedOfficerIds: ['o1'], teams, categories: ['Maintenance', 'Cleaning'] }),
    create: async (fields) => {
      sent.push(fields)
      if (fail) throw new ApiError(403, { message: 'You can’t create cases for that team.' })
      const kase = {
        id: 'c-new', number: 'CAS-2026-0001', title: fields.title, category: fields.category, stage: 'open', ownerId: fields.ownerId,
        estate: fields.estate, unit: fields.location, urgency: fields.urgency, description: fields.description, deadline: fields.deadline,
        resident: null, taskRefs: [], blockers: [], checkpoints: [], evidence: [], timeline: [], communications: [], history: [], pendingRequest: null,
      }
      cases.push(kase)
      return kase
    },
  }
}

let root, el
afterEach(() => { act(() => root?.unmount()); el?.remove() })
async function render(node) {
  el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root.render(<PreferencesContext.Provider value={{ language: 'en' }}><FluentProvider theme={webLightTheme}>{node}</FluentProvider></PreferencesContext.Provider>))
}
const button = (label, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const control = (label) => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent.replace('*', '').trim() === label)
  return document.getElementById(l.htmlFor)
}
// Sets a value the way typing or choosing would, so React's onChange runs.
function fill(label, value) {
  const node = control(label)
  const proto = Object.getPrototypeOf(node)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value)
  node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}
async function fillForm() {
  await act(async () => {
    fill(en['cases.create.f.title'], 'Fictional lift fault')
    fill(en['cases.create.f.category'], 'Maintenance')
    fill(en['cases.create.f.description'], 'Fictional: lift stops between floors.')
    fill(en['cases.create.f.estate'], 'Zone A')
    fill(en['cases.create.f.location'], 'Lift B')
    fill(en['cases.create.f.officer'], 'o1')
    fill(en['cases.create.f.deadline'], '2030-01-15T10:00')
  })
}
const counts = () => [...el.querySelectorAll('.case-stat strong')].map((s) => s.textContent)

describe('Create Case', () => {
  it('goes from an empty dashboard to a saved case in the list, counts and Next Up', async () => {
    const api = fakeApi()
    await render(<CaseActionCentre me={manager} service={api} />)
    expect(counts()).toEqual(['0', '0', '0', '0'])
    expect(el.textContent).toContain(en['cases.next.clear'])

    await act(async () => button(en['cases.create.button']).click())
    // Required fields are checked before anything is sent.
    await act(async () => button(en['cases.create.save'], document.querySelector('[role=dialog]')).click())
    expect(api.sent).toEqual([])
    expect(document.body.textContent).toContain(en['cases.create.required'])

    await fillForm()
    await act(async () => button(en['cases.create.save'], document.querySelector('[role=dialog]')).click())
    expect(api.sent[0]).toMatchObject({ title: 'Fictional lift fault', teamId: 'team-1', ownerId: 'o1', urgency: 'medium', followUpDue: null })
    expect(api.sent[0].deadline).toMatch(/^2030-01-15T/)
    expect(counts()[0]).toBe('1')
    // The confirmation dialog shows the stored case.
    const dialog = document.querySelector('.case-created-dialog')
    expect(dialog.textContent).toContain(en['cases.create.doneTitle'])
    expect(dialog.textContent).toContain('CAS-2026-0001')
    expect(dialog.textContent).toContain('Officer One')
    expect(el.textContent).toContain('Fictional lift fault')
    expect(el.textContent).not.toContain(en['cases.next.clear'])
  })

  it('shows the server’s refusal and does not pretend the case was saved', async () => {
    const api = fakeApi({ fail: true })
    await render(<CaseActionCentre me={manager} service={api} />)
    await act(async () => button(en['cases.create.button']).click())
    await fillForm()
    await act(async () => button(en['cases.create.save'], document.querySelector('[role=dialog]')).click())
    expect(document.body.textContent).toContain('You can’t create cases for that team.')
    expect(document.querySelector('.case-created-dialog')).toBeNull()
    expect(counts()[0]).toBe('0')
  })

  it('is not offered to someone with no team to create cases in', async () => {
    const api = { ...fakeApi(), list: async () => ({ cases: [], officers: [], managedOfficerIds: [], teams: [], categories: [] }) }
    await render(<CaseActionCentre me={manager} service={api} />)
    expect(button(en['cases.create.button'])).toBeUndefined()
    expect(el.textContent).toContain(en['cases.create.noTeams'])
  })
})
