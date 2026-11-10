import { afterEach, describe, expect, it, vi } from 'vitest'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { GRAPH_SCOPES, getApiToken, getGraphToken, loginRequest } from '../auth/msal.js'
import { calendarWindow, errorKind, formatDuration, formatWhen, getProfile, GraphError, graphRequest, listEvents, toEvent } from './graph.js'
import { memberSections } from './sections.js'

const account = { homeAccountId: 'home-1', username: 'officer@example.com' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const getToken = async () => 'graph-token'
const msalError = (errorCode) => Object.assign(new Error(errorCode), { errorCode })

afterEach(() => vi.unstubAllGlobals())

describe('Graph scopes', () => {
  it('are read-only and never use .default', () => {
    const all = Object.values(GRAPH_SCOPES).flat()
    expect(all).toEqual(['User.Read', 'Calendars.Read', 'Tasks.Read'])
    for (const scope of all) expect(scope).not.toMatch(/Write|Send|Manage|\.default/)
  })

  it('are not asked for at sign-in beyond User.Read', () => {
    const atSignIn = [...loginRequest.scopes, ...loginRequest.extraScopesToConsent]
    expect(atSignIn.some((s) => /Calendars|Tasks|Mail|Chat|Sites/.test(s))).toBe(false)
  })

  it('stay separate from the SyncAI API scope', async () => {
    const instance = { acquireTokenSilent: vi.fn(async ({ scopes }) => ({ accessToken: scopes.join(' ') })) }
    const api = await getApiToken(instance, account)
    const graph = await getGraphToken(instance, account, GRAPH_SCOPES.calendar)
    expect(api).toMatch(/^api:\/\/.*\/access_as_user$/)
    expect(graph).toBe('Calendars.Read')
    expect(instance.acquireTokenSilent.mock.calls[1][0].scopes).toEqual(['Calendars.Read'])
  })
})

describe('getGraphToken', () => {
  const needsConsent = () => ({
    acquireTokenSilent: vi.fn().mockRejectedValue(new InteractionRequiredAuthError('consent_required')),
    acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
  })

  it('never opens Microsoft consent on its own', async () => {
    const instance = needsConsent()
    await expect(getGraphToken(instance, account, GRAPH_SCOPES.calendar)).rejects.toBeInstanceOf(InteractionRequiredAuthError)
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()
  })

  it('asks for consent to exactly the requested scopes after a click', async () => {
    const instance = needsConsent()
    const err = await getGraphToken(instance, account, GRAPH_SCOPES.calendar, { interactive: true }).catch((e) => e)
    expect(errorKind(err)).toBe('consent')
    expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1)
    expect(instance.acquireTokenRedirect.mock.calls[0][0]).toMatchObject({ scopes: ['Calendars.Read'], account, loginHint: account.username })
  })

  it('does not redirect for errors that consent cannot fix', async () => {
    const instance = { acquireTokenSilent: vi.fn().mockRejectedValue(msalError('no_network_connectivity')), acquireTokenRedirect: vi.fn() }
    const err = await getGraphToken(instance, account, GRAPH_SCOPES.calendar, { interactive: true }).catch((e) => e)
    expect(errorKind(err)).toBe('network')
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()
  })

  it('reports a second interaction and a missing account', async () => {
    const instance = needsConsent()
    instance.acquireTokenRedirect.mockRejectedValue(msalError('interaction_in_progress'))
    expect(errorKind(await getGraphToken(instance, account, GRAPH_SCOPES.calendar, { interactive: true }).catch((e) => e))).toBe('busy')
    expect(errorKind(await getGraphToken(instance, null, GRAPH_SCOPES.calendar).catch((e) => e))).toBe('account')
    expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(1)
  })
})

describe('errorKind', () => {
  it('maps cancellation, denial and unknown token failures', () => {
    expect(errorKind(msalError('user_cancelled'))).toBe('cancelled')
    expect(errorKind(msalError('access_denied'))).toBe('cancelled')
    expect(errorKind(msalError('something_else'))).toBe('token')
  })
})

describe('graphRequest', () => {
  it('sends the token only to Microsoft Graph', async () => {
    const fetchMock = vi.fn(async () => json({ displayName: 'Officer' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getProfile(getToken)).toEqual({ displayName: 'Officer' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/^https:\/\/graph\.microsoft\.com\/v1\.0\/me\?/)
    expect(init.headers.Authorization).toBe('Bearer graph-token')
    expect(init.method).toBeUndefined()

    await expect(graphRequest('https://evil.example/v1.0/me', { getToken })).rejects.toMatchObject({ kind: 'unavailable' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    [403, 'ErrorAccessDenied', 'denied'],
    [401, 'InvalidAuthenticationToken', 'token'],
    [404, 'MailboxNotEnabledForRESTAPI', 'unsupported'],
    [400, 'MailboxNotSupportedForRESTAPI', 'unsupported'],
    [503, 'ServiceUnavailable', 'unavailable'],
  ])('turns HTTP %i %s into "%s"', async (status, code, kind) => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code, message: 'secret detail' } }, status)))
    const err = await graphRequest('/me', { getToken }).catch((e) => e)
    expect(err).toBeInstanceOf(GraphError)
    expect(err).toMatchObject({ kind, status, code })
    expect(err.message).not.toContain('graph-token')
  })

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(graphRequest('/me', { getToken })).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('calendar events', () => {
  const raw = {
    id: 'evt-1',
    subject: ' Lift inspection ',
    start: { dateTime: '2026-11-10T01:00:00.0000000', timeZone: 'UTC' },
    end: { dateTime: '2026-11-10T02:30:00.0000000', timeZone: 'UTC' },
    isAllDay: false,
    showAs: 'busy',
    location: { displayName: 'Block A' },
  }

  it('transforms a Graph event', () => {
    expect(toEvent(raw)).toEqual({
      id: 'evt-1',
      subject: 'Lift inspection',
      start: new Date('2026-11-10T01:00:00Z'),
      end: new Date('2026-11-10T02:30:00Z'),
      allDay: false,
      minutes: 90,
      showAs: 'busy',
      location: 'Block A',
    })
  })

  it('omits what Microsoft did not return, and drops cancelled or broken events', () => {
    expect(toEvent({ id: 'x', start: raw.start, end: raw.end })).toMatchObject({ subject: null, showAs: null, location: null })
    expect(toEvent({ ...raw, isCancelled: true })).toBe(null)
    expect(toEvent({ ...raw, start: null })).toBe(null)
  })

  it('converts UTC times to the viewer’s timezone', () => {
    const event = toEvent(raw)
    expect(formatWhen(event, 'en-SG', 'Asia/Singapore').time).toMatch(/^9:00\s?am – 10:30\s?am$/i)
    expect(formatWhen(event, 'en-SG', 'America/Los_Angeles').date).toMatch(/9 Nov/)
  })

  it('keeps all-day events on their own date in every timezone', () => {
    const allDay = toEvent({ ...raw, isAllDay: true, start: { dateTime: '2026-11-12T00:00:00.0000000' }, end: { dateTime: '2026-11-13T00:00:00.0000000' } })
    expect(formatWhen(allDay, 'en-SG', 'America/Los_Angeles')).toEqual({ date: expect.stringMatching(/12 Nov/), time: null })
  })

  it('formats durations', () => {
    expect(formatDuration(90, 'en')).toBe('1 hr 30 min')
    expect(formatDuration(60, 'en')).toBe('1 hr')
    expect(formatDuration(0, 'en')).toBe('0 min')
  })
})

describe('listEvents', () => {
  const { start, end } = calendarWindow(new Date('2026-11-10T04:00:00Z'))
  const event = (id) => ({ id, start: { dateTime: '2026-11-11T01:00:00.0000000' }, end: { dateTime: '2026-11-11T02:00:00.0000000' } })

  it('asks calendarView for a valid UTC window and only read-basic fields', async () => {
    const fetchMock = vi.fn(async () => json({ value: [] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await listEvents({ getToken, start, end })).toEqual({ events: [], truncated: false })
    const [url, init] = fetchMock.mock.calls[0]
    const query = new URL(url).searchParams
    expect(new URL(url).pathname).toBe('/v1.0/me/calendarView')
    expect(query.get('startDateTime')).toBe('2026-11-10T04:00:00.000Z')
    expect(query.get('endDateTime')).toBe('2026-11-17T04:00:00.000Z')
    expect(query.get('$select')).not.toMatch(/body|attendees|attachments/)
    expect(init.headers.Prefer).toBe('outlook.timezone="UTC"')
  })

  it('follows @odata.nextLink and stops at the page limit', async () => {
    const next = 'https://graph.microsoft.com/v1.0/me/calendarView?$skip=50'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ value: [event('a')], '@odata.nextLink': next }))
      .mockResolvedValueOnce(json({ value: [event('b')] }))
    vi.stubGlobal('fetch', fetchMock)
    const all = await listEvents({ getToken, start, end })
    expect(all.events.map((e) => e.id)).toEqual(['a', 'b'])
    expect(all.truncated).toBe(false)
    expect(fetchMock.mock.calls[1][0]).toBe(next)

    vi.stubGlobal('fetch', vi.fn(async () => json({ value: [event('c')], '@odata.nextLink': next })))
    expect(await listEvents({ getToken, start, end, maxPages: 2 })).toMatchObject({ truncated: true, events: [{ id: 'c' }, { id: 'c' }] })
  })

  it('surfaces a refused calendar after a single request', async () => {
    const fetchMock = vi.fn(async () => json({ error: { code: 'ErrorAccessDenied' } }, 403))
    vi.stubGlobal('fetch', fetchMock)
    await expect(listEvents({ getToken, start, end })).rejects.toMatchObject({ kind: 'denied', status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('memberSections', () => {
  it('gives the plan (and its calendar) to active members and managers only', () => {
    expect(memberSections({ status: 'active', role: 'member' })).toContain('plan')
    expect(memberSections({ status: 'active', role: 'manager' })).toEqual(expect.arrayContaining(['plan', 'team']))
    expect(memberSections({ status: 'active', role: 'member' })).not.toContain('team')
    for (const status of ['pending', 'disabled']) {
      for (const role of ['member', 'manager']) expect(memberSections({ status, role })).not.toContain('plan')
    }
  })
})
