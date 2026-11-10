import { afterEach, describe, expect, it, vi } from 'vitest'
import { GRAPH_SCOPES, getGraphToken, hasScopes } from '../auth/msal.js'
import { errorInfo, errorKind, graphRequest, remembered, sanitise } from './graph.js'

const account = { homeAccountId: 'home-1', username: 'officer@example.com' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const getToken = async () => 'graph-token'

afterEach(() => vi.unstubAllGlobals())

describe('Graph error diagnostics', () => {
  const denied = {
    error: {
      code: 'ErrorAccessDenied',
      message: 'Access is denied. Check credentials and try again.',
      innerError: { 'request-id': 'req-123', date: '2026-11-10T04:00:00' },
    },
  }

  it('keeps status, code, message and request ID from a 403 body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(denied, 403)))
    const err = await graphRequest('/me/calendarView', { getToken }).catch((e) => e)
    expect(errorInfo(err)).toEqual({
      kind: 'denied',
      status: 403,
      code: 'ErrorAccessDenied',
      detail: 'Access is denied. Check credentials and try again.',
      requestId: 'req-123',
    })
  })

  it('does not call an access-denied 403 a consent or admin problem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(denied, 403)))
    const { kind } = errorInfo(await graphRequest('/me', { getToken }).catch((e) => e))
    expect(['permission', 'admin', 'consent']).not.toContain(kind)
  })

  it('recognises a missing delegated scope from the Graph message', async () => {
    const body = { error: { code: 'Authorization_RequestDenied', message: 'Insufficient privileges to complete the operation.' } }
    vi.stubGlobal('fetch', vi.fn(async () => json(body, 403)))
    await expect(graphRequest('/me', { getToken })).rejects.toMatchObject({ kind: 'permission' })
  })

  it('recognises a token issued for the wrong audience', async () => {
    const body = { error: { code: 'InvalidAuthenticationToken', message: 'Access token validation failure. Invalid audience.' } }
    vi.stubGlobal('fetch', vi.fn(async () => json(body, 401)))
    await expect(graphRequest('/me', { getToken })).rejects.toMatchObject({ kind: 'audience', status: 401 })
  })

  it('reports an account without a mailbox as unsupported, even on a 403', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'MailboxNotEnabledForRESTAPI' } }, 403)))
    await expect(graphRequest('/me/calendarView', { getToken })).rejects.toMatchObject({ kind: 'unsupported' })
  })

  it('falls back to the response header for the request ID and survives a non-JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Forbidden', { status: 403, headers: { 'request-id': 'hdr-9' } })))
    await expect(graphRequest('/me', { getToken })).rejects.toMatchObject({ kind: 'denied', code: null, detail: null, requestId: 'hdr-9' })
  })

  it('never lets a token-shaped string through in the message', () => {
    const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJodHRwczovL2dyYXBoIn0.c2lnbmF0dXJl'
    expect(sanitise(`Token ${token} was rejected`)).toBe('Token [removed] was rejected')
    expect(sanitise('')).toBe(null)
    expect(sanitise('word '.repeat(100)).length).toBeLessThanOrEqual(240)
  })

  it('tells admin-consent and cancelled sign-ins apart', () => {
    const admin = Object.assign(new Error('x'), { errorCode: 'access_denied', errorMessage: 'AADSTS90094: Admin consent is required.' })
    expect(errorKind(admin)).toBe('admin')
    const cancelled = Object.assign(new Error('x'), { errorCode: 'user_cancelled' })
    expect(errorInfo(cancelled)).toMatchObject({ kind: 'cancelled', status: null, code: 'user_cancelled' })
  })
})

describe('granted scopes', () => {
  it('matches short and full-URL scope names in any case', () => {
    expect(hasScopes(['User.Read', 'calendars.readbasic'], ['Calendars.ReadBasic'])).toBe(true)
    expect(hasScopes(['https://graph.microsoft.com/Calendars.ReadBasic'], ['Calendars.ReadBasic'])).toBe(true)
    expect(hasScopes(['User.Read', 'openid'], ['Calendars.ReadBasic'])).toBe(false)
    expect(hasScopes(['Calendars.Read'], ['Calendars.ReadBasic'])).toBe(false)
    expect(hasScopes(undefined, ['Calendars.ReadBasic'])).toBe(true)
  })

  it('treats a silent token without the calendar scope as consent still needed', async () => {
    const instance = {
      acquireTokenSilent: vi.fn(async () => ({ accessToken: 'only-user-read', scopes: ['User.Read', 'openid', 'profile'] })),
      acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
    }
    expect(errorKind(await getGraphToken(instance, account, GRAPH_SCOPES.calendar).catch((e) => e))).toBe('consent')
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()

    await getGraphToken(instance, account, GRAPH_SCOPES.calendar, { interactive: true }).catch(() => null)
    expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1)
    expect(instance.acquireTokenRedirect.mock.calls[0][0]).toMatchObject({ scopes: ['Calendars.ReadBasic'], prompt: 'consent' })
  })

  it('returns the token when the scope was granted', async () => {
    const instance = { acquireTokenSilent: vi.fn(async () => ({ accessToken: 'ok', scopes: ['Calendars.ReadBasic', 'User.Read'] })) }
    expect(await getGraphToken(instance, account, GRAPH_SCOPES.calendar)).toBe('ok')
  })
})

describe('remembered', () => {
  it('sends a refused request once across remounts, and again only on an explicit retry', async () => {
    const fetchMock = vi.fn(async () => json({ error: { code: 'ErrorAccessDenied' } }, 403))
    vi.stubGlobal('fetch', fetchMock)
    const attempt = () => graphRequest('/me/calendarView', { getToken }).catch((e) => e.kind)

    expect(await remembered('test:denied', attempt)).toBe('denied')
    expect(await remembered('test:denied', attempt)).toBe('denied')
    expect(await remembered('test:denied', attempt)).toBe('denied')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    expect(await remembered('test:denied', attempt, true)).toBe('denied')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps accounts apart', async () => {
    const run = vi.fn(async () => 'events')
    await remembered('test:a', run)
    await remembered('test:b', run)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
