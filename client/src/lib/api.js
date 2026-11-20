import { getStatus, NETWORK_ERROR } from './httpStatus.js'

const BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, body) {
    const info = status === 0 ? NETWORK_ERROR : getStatus(status) ?? { ...NETWORK_ERROR, code: status }
    super(body?.message || info.message)
    this.name = 'ApiError'
    this.status = status
    this.info = info
    this.body = body
  }
}

// Calls the SyncAI API. Resolves with the parsed body (null for 204), or throws ApiError.
// `getToken` is an async function returning an Entra access token, passed in by the caller.
export async function apiRequest(path, { method = 'GET', body, getToken, signal } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (getToken) headers.Authorization = `Bearer ${await getToken()}`

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, signal, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0)
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = res.status === 204 ? null : isJson ? await res.json().catch(() => null) : await res.text()
  if (!res.ok) throw new ApiError(res.status, isJson ? data : null)
  return data
}

// Like apiRequest, but for a plain-text answer streamed while it's written. Calls onText(textSoFar) as pieces
// arrive and resolves with the full text. Errors before streaming starts throw ApiError, as apiRequest does.
export async function apiStream(path, { body, getToken, signal, onText }) {
  const headers = { Accept: 'text/plain, application/json', 'Content-Type': 'application/json' }
  if (getToken) headers.Authorization = `Bearer ${await getToken()}`
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, signal, body: JSON.stringify(body) })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0)
  }
  if (!res.ok) {
    const isJson = res.headers.get('content-type')?.includes('application/json')
    throw new ApiError(res.status, isJson ? await res.json().catch(() => null) : null)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    onText?.(text)
  }
  return text
}
