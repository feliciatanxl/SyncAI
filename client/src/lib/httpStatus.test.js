import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './api.js'
import { HTTP, HTTP_STATUSES, categoryOf, getStatus, isError } from './httpStatus.js'

describe('httpStatus', () => {
  it('lists every code once, in the right category, with a message', () => {
    const codes = HTTP_STATUSES.map((s) => s.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const s of HTTP_STATUSES) {
      expect(s.category).toBe(categoryOf(s.code))
      expect(s.message).toBeTruthy()
    }
    expect(codes).toEqual(expect.arrayContaining([100, 200, 201, 204, 301, 304, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504, 511]))
  })

  it('exposes named constants', () => {
    expect(HTTP.OK).toBe(200)
    expect(HTTP.NOT_FOUND).toBe(404)
    expect(HTTP.I_M_A_TEAPOT).toBe(418)
    expect(HTTP.TOO_MANY_REQUESTS).toBe(429)
    expect(HTTP.SERVICE_UNAVAILABLE).toBe(503)
  })

  it('falls back to the category for unlisted codes and rejects nonsense', () => {
    expect(getStatus('404').title).toBe('Not Found')
    expect(getStatus(499).category).toBe('clientError')
    expect(getStatus(599)).toMatchObject({ code: 599, category: 'serverError' })
    expect(getStatus(42)).toBeNull()
    expect(getStatus('abc')).toBeNull()
    expect(isError(404)).toBe(true)
    expect(isError(304)).toBe(false)
  })
})

describe('apiRequest', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respond = (status, body, type = 'application/json') =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': type } })))

  it('returns parsed JSON and null for 204', async () => {
    respond(200, { ok: true })
    await expect(apiRequest('/tasks')).resolves.toEqual({ ok: true })
    respond(204)
    await expect(apiRequest('/tasks/1', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('throws ApiError with status info, preferring the server message', async () => {
    respond(403, { message: 'Supervisors only' })
    const err = await apiRequest('/team').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(err.info.title).toBe('Forbidden')
    expect(err.message).toBe('Supervisors only')

    respond(503, undefined)
    const down = await apiRequest('/tasks').catch((e) => e)
    expect(down.message).toMatch(/temporarily unavailable/)
  })

  it('reports a network failure as status 0 and sends the bearer token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const err = await apiRequest('/tasks').catch((e) => e)
    expect(err.status).toBe(0)
    expect(err.info.category).toBe('network')

    respond(200, [])
    await apiRequest('/tasks', { getToken: async () => 'abc' })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
  })
})
