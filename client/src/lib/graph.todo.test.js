import { afterEach, describe, expect, it, vi } from 'vitest'
import { GRAPH_SCOPES, getGraphToken, loginRequest } from '../auth/msal.js'
import { errorKind, formatDue, listTaskLists, listTasks, remembered, toTask } from './graph.js'

const account = { homeAccountId: 'home-1', username: 'officer@example.com' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const getToken = async () => 'graph-token'
const LISTS = 'https://graph.microsoft.com/v1.0/me/todo/lists'

afterEach(() => vi.unstubAllGlobals())

describe('To Do scope', () => {
  it('is Tasks.Read only, and leaves the calendar and sign-in scopes alone', () => {
    expect(GRAPH_SCOPES.tasks).toEqual(['Tasks.Read'])
    expect(GRAPH_SCOPES.calendar).toEqual(['Calendars.Read'])
    expect(Object.values(GRAPH_SCOPES).flat().some((s) => /Write|\.default|Shared|\.All/.test(s))).toBe(false)
    expect([...loginRequest.scopes, ...loginRequest.extraScopesToConsent].some((s) => s.includes('Tasks'))).toBe(false)
  })

  it('a connected calendar does not count as To Do consent', async () => {
    const instance = {
      acquireTokenSilent: vi.fn(async () => ({ accessToken: 'calendar-only', scopes: ['User.Read', 'Calendars.Read'] })),
      acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
    }
    expect(errorKind(await getGraphToken(instance, account, GRAPH_SCOPES.tasks).catch((e) => e))).toBe('consent')
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()

    await getGraphToken(instance, account, GRAPH_SCOPES.tasks, { interactive: true }).catch(() => null)
    expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1)
    expect(instance.acquireTokenRedirect.mock.calls[0][0].scopes).toEqual(['Tasks.Read'])
  })

  it('returns the token once Tasks.Read is granted', async () => {
    const instance = { acquireTokenSilent: vi.fn(async () => ({ accessToken: 'ok', scopes: ['Tasks.Read', 'User.Read'] })) }
    expect(await getGraphToken(instance, account, GRAPH_SCOPES.tasks)).toBe('ok')
  })
})

describe('listTaskLists', () => {
  it('reads the person’s own lists with a GET, default list first, across pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ value: [{ id: 'b', displayName: 'Estate rounds', wellknownListName: 'none' }], '@odata.nextLink': `${LISTS}?$skip=1` }))
      .mockResolvedValueOnce(json({ value: [{ id: 'a', displayName: 'Tasks', wellknownListName: 'defaultList' }] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await listTaskLists({ getToken })).toEqual([
      { id: 'a', name: 'Tasks', isDefault: true },
      { id: 'b', name: 'Estate rounds', isDefault: false },
    ])
    expect(fetchMock.mock.calls[0][0]).toBe(LISTS)
    expect(fetchMock.mock.calls[1][0]).toBe(`${LISTS}?$skip=1`)
    for (const [, init] of fetchMock.mock.calls) expect(init.method).toBeUndefined()
  })

  it('returns nothing for an account with no lists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ value: [] })))
    expect(await listTaskLists({ getToken })).toEqual([])
  })

  it.each([
    [401, 'InvalidAuthenticationToken', 'token'],
    [403, 'ErrorAccessDenied', 'denied'],
    [404, 'MailboxNotEnabledForRESTAPI', 'unsupported'],
  ])('reports HTTP %i %s as "%s" after one request', async (status, code, kind) => {
    const fetchMock = vi.fn(async () => json({ error: { code, message: 'x' } }, status))
    vi.stubGlobal('fetch', fetchMock)
    await expect(listTaskLists({ getToken })).rejects.toMatchObject({ kind, status, code })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(listTaskLists({ getToken })).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('toTask', () => {
  const raw = {
    id: 't1',
    title: ' Check lift certificate ',
    status: 'inProgress',
    importance: 'high',
    dueDateTime: { dateTime: '2026-11-11T16:00:00.0000000', timeZone: 'UTC' },
  }

  it('transforms a Graph task', () => {
    expect(toTask(raw)).toEqual({ id: 't1', title: 'Check lift certificate', status: 'inProgress', done: false, importance: 'high', due: new Date('2026-11-11T16:00:00Z') })
  })

  it('handles a task with no due date, title, status or importance', () => {
    expect(toTask({ id: 't2' })).toEqual({ id: 't2', title: null, status: 'notStarted', done: false, importance: 'normal', due: null })
    expect(formatDue(toTask({ id: 't2' }), 'en-SG')).toBe(null)
  })

  it('marks only completed tasks as done', () => {
    expect(toTask({ ...raw, status: 'completed' }).done).toBe(true)
    for (const status of ['notStarted', 'inProgress', 'waitingOnOthers', 'deferred']) expect(toTask({ ...raw, status }).done).toBe(false)
  })

  it('shows the due date in the viewer’s timezone', () => {
    // Midnight on 12 Nov in Singapore is 16:00 UTC on the 11th.
    expect(formatDue(toTask(raw), 'en-SG', 'Asia/Singapore')).toMatch(/12 Nov/)
    expect(formatDue(toTask(raw), 'en-SG', 'UTC')).toMatch(/11 Nov/)
  })
})

describe('listTasks', () => {
  const task = (id, extra) => ({ id, title: id, status: 'notStarted', ...extra })

  it('reads one list by its ID, read-only', async () => {
    const fetchMock = vi.fn(async () => json({ value: [] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await listTasks({ getToken, listId: 'AAMk/ad=' })).toEqual({ tasks: [], truncated: false })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${LISTS}/AAMk%2Fad%3D/tasks?$top=100`)
    expect(init.method).toBeUndefined()
    expect(init.headers.Authorization).toBe('Bearer graph-token')
  })

  it('follows paging, then puts open tasks first by due date with undated ones last', async () => {
    const next = `${LISTS}/a/tasks?$skip=100`
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({
        value: [task('done', { status: 'completed', dueDateTime: { dateTime: '2026-11-01T00:00:00.0000000' } }), task('undated')],
        '@odata.nextLink': next,
      }))
      .mockResolvedValueOnce(json({
        value: [task('later', { dueDateTime: { dateTime: '2026-11-20T00:00:00.0000000' } }), task('sooner', { dueDateTime: { dateTime: '2026-11-12T00:00:00.0000000' } })],
      }))
    vi.stubGlobal('fetch', fetchMock)
    const { tasks, truncated } = await listTasks({ getToken, listId: 'a' })
    expect(tasks.map((t) => t.id)).toEqual(['sooner', 'later', 'undated', 'done'])
    expect(truncated).toBe(false)
    expect(fetchMock.mock.calls[1][0]).toBe(next)
  })

  it('stops at the page limit and says so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ value: [task('x')], '@odata.nextLink': `${LISTS}/a/tasks?$skip=100` })))
    expect(await listTasks({ getToken, listId: 'a', maxPages: 2 })).toMatchObject({ truncated: true, tasks: [{ id: 'x' }, { id: 'x' }] })
  })
})

describe('To Do requests', () => {
  it('are sent once per account until the person asks again', async () => {
    const fetchMock = vi.fn(async () => json({ error: { code: 'ErrorAccessDenied' } }, 403))
    vi.stubGlobal('fetch', fetchMock)
    const attempt = () => listTaskLists({ getToken }).catch((e) => e.kind)

    await remembered('todo:home-1', attempt)
    await remembered('todo:home-1', attempt)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await remembered('todo:home-2', attempt)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await remembered('todo:home-1', attempt, true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('only ever address the signed-in person (/me)', async () => {
    const fetchMock = vi.fn(async () => json({ value: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await listTaskLists({ getToken })
    await listTasks({ getToken, listId: 'a' })
    for (const [url] of fetchMock.mock.calls) expect(url).toMatch(/^https:\/\/graph\.microsoft\.com\/v1\.0\/me\/todo\//)
  })
})
