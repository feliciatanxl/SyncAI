// Small read-only Microsoft Graph client. Every call is a GET with a delegated token the caller supplies
// (see getGraphToken in auth/msal.js); tokens are never stored, logged or sent anywhere but Graph.
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// Everything that can go wrong, reduced to a `kind` the UI has a message for (strings: graph.err.<kind>).
export class GraphError extends Error {
  constructor(kind, status = 0, code = null) {
    super(`Microsoft Graph request failed (${kind})`)
    this.name = 'GraphError'
    this.kind = kind
    this.status = status
    this.code = code
  }
}

const MSAL_KINDS = {
  user_cancelled: 'cancelled',
  access_denied: 'cancelled',
  interaction_in_progress: 'busy',
  no_account_error: 'account',
  no_account_found: 'account',
  login_required: 'account',
  account_mismatch: 'account',
  no_network_connectivity: 'network',
  post_request_failed: 'network',
  get_request_failed: 'network',
  timed_out: 'consent',
  monitor_window_timeout: 'consent',
}

// Maps a GraphError or an MSAL error to one of: consent, cancelled, busy, account, token, permission,
// unsupported, network, unavailable.
export function errorKind(err) {
  if (err instanceof GraphError) return err.kind
  if (MSAL_KINDS[err?.errorCode]) return MSAL_KINDS[err.errorCode]
  if (err?.name === 'InteractionRequiredAuthError') return 'consent'
  return 'token'
}

function httpKind(status, code) {
  if (status === 401) return 'token'
  if (status === 403) return 'permission'
  // Guests and personal accounts have no Exchange Online mailbox in the tenant they signed in to.
  if (status === 404 || /Mailbox|NotSupported/i.test(code ?? '')) return 'unsupported'
  return 'unavailable'
}

// GET a Graph path (or a full @odata.nextLink) and return the parsed body, or throw GraphError.
export async function graphRequest(pathOrUrl, { getToken, signal, headers } = {}) {
  const url = pathOrUrl.startsWith('/') ? `${GRAPH_BASE}${pathOrUrl}` : pathOrUrl
  // A nextLink comes from a response body: the token must never follow it off Graph.
  if (!url.startsWith(`${GRAPH_BASE}/`)) throw new GraphError('unavailable')
  const token = await getToken()
  let res
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json', ...headers, Authorization: `Bearer ${token}` } })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new GraphError('network')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new GraphError(httpKind(res.status, body?.error?.code), res.status, body?.error?.code ?? null)
  return body
}

export const getProfile = (getToken, signal) =>
  graphRequest('/me?$select=displayName,mail,userPrincipalName,jobTitle', { getToken, signal })

// Only fields Calendars.ReadBasic returns. Body, attendees and attachments need Calendars.Read, so they are
// left out rather than asking for more permission.
const EVENT_FIELDS = 'id,subject,start,end,isAllDay,showAs,isCancelled,location'
const SHOW_AS = new Set(['free', 'tentative', 'busy', 'oof', 'workingElsewhere'])

// Graph sends wall-clock times without an offset; we ask for UTC (Prefer header below), so they parse as UTC.
function toDate(stamp) {
  if (!stamp?.dateTime) return null
  const text = /(Z|[+-]\d\d:\d\d)$/.test(stamp.dateTime) ? stamp.dateTime : `${stamp.dateTime.slice(0, 23)}Z`
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

// One Graph event as the UI needs it, or null if it is cancelled or has no usable times.
export function toEvent(raw) {
  const start = toDate(raw.start)
  const end = toDate(raw.end)
  if (!start || !end || raw.isCancelled) return null
  return {
    id: raw.id,
    subject: raw.subject?.trim() || null,
    start,
    end,
    allDay: Boolean(raw.isAllDay),
    minutes: Math.max(0, Math.round((end - start) / 60_000)),
    showAs: SHOW_AS.has(raw.showAs) ? raw.showAs : null,
    location: raw.location?.displayName?.trim() || null,
  }
}

export function calendarWindow(now, days = 7) {
  return { start: now, end: new Date(now.getTime() + days * 86_400_000) }
}

// The signed-in person's own events between two instants, soonest first, following Graph's paging.
// shortcut: stops after maxPages x 50 events and reports `truncated`, raise maxPages if a week ever needs more.
export async function listEvents({ getToken, start, end, signal, maxPages = 4 }) {
  const query = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $select: EVENT_FIELDS,
    $orderby: 'start/dateTime',
    $top: '50',
  })
  let url = `/me/calendarView?${query}`
  const events = []
  for (let page = 0; url && page < maxPages; page++) {
    const data = await graphRequest(url, { getToken, signal, headers: { Prefer: 'outlook.timezone="UTC"' } })
    events.push(...(data?.value ?? []).map(toEvent).filter(Boolean))
    url = data?.['@odata.nextLink']
  }
  return { events, truncated: Boolean(url) }
}

// Date and time range in the viewer's own timezone (or `timeZone`, for tests). All-day events are calendar
// dates, not instants, so they are read in UTC to stop them sliding to the day before or after.
export function formatWhen(event, locale, timeZone) {
  const date = { weekday: 'short', day: 'numeric', month: 'short', timeZone: event.allDay ? 'UTC' : timeZone }
  if (event.allDay) return { date: event.start.toLocaleDateString(locale, date), time: null }
  const time = (d) => d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone })
  return { date: event.start.toLocaleDateString(locale, date), time: `${time(event.start)} – ${time(event.end)}` }
}

export function formatDuration(minutes, locale) {
  const part = (n, unit) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(n)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours > 0 && part(hours, 'hour'), (rest > 0 || hours === 0) && part(rest, 'minute')].filter(Boolean).join(' ')
}
