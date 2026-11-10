// Small read-only Microsoft Graph client. Every call is a GET with a delegated token the caller supplies
// (see getGraphToken in auth/msal.js); tokens are never stored, logged or sent anywhere but Graph.
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// Everything that can go wrong, reduced to a `kind` the UI has a message for (strings: graph.err.<kind>).
export class GraphError extends Error {
  constructor(kind, status = 0, code = null, { detail = null, requestId = null } = {}) {
    super(`Microsoft Graph request failed (${kind})`)
    this.name = 'GraphError'
    this.kind = kind
    this.status = status
    this.code = code
    this.detail = detail
    this.requestId = requestId
  }
}

// Microsoft's own error text, cut short and with anything shaped like a token or key removed.
export function sanitise(message) {
  if (typeof message !== 'string' || !message.trim()) return null
  return message.replace(/[\w+/=.-]{40,}/g, '[removed]').replace(/\s+/g, ' ').trim().slice(0, 240)
}

// What the UI shows for a failure: the kind, plus Microsoft's status, code, message and request ID when known.
export function errorInfo(err) {
  const kind = errorKind(err)
  if (err instanceof GraphError) return { kind, status: err.status, code: err.code, detail: err.detail, requestId: err.requestId }
  return { kind, status: null, code: err?.errorCode ?? null, detail: null, requestId: null }
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

// Maps a GraphError or an MSAL error to one of: consent, cancelled, admin, busy, account, token, audience,
// permission, denied, unsupported, network, unavailable.
export function errorKind(err) {
  if (err instanceof GraphError) return err.kind
  // AADSTS90094 / 900941: the tenant only lets an administrator consent to this permission.
  if (/AADSTS90094|admin(istrator)? (consent|approval)/i.test(`${err?.errorMessage ?? ''} ${err?.message ?? ''}`)) return 'admin'
  if (MSAL_KINDS[err?.errorCode]) return MSAL_KINDS[err.errorCode]
  if (err?.name === 'InteractionRequiredAuthError') return 'consent'
  return 'token'
}

const MISSING_PERMISSION = /Authorization_RequestDenied|InsufficientPrivileges|insufficient privileges|missing (scope|permission)|required scopes/i

function httpKind(status, code, message) {
  if (status === 401) return /audience/i.test(message ?? '') ? 'audience' : 'token'
  if (status === 403) {
    if (/Mailbox|NotSupported/i.test(code ?? '')) return 'unsupported'
    // A 403 is not always a consent problem: only call it "permission" when Microsoft says a scope is missing.
    // ErrorAccessDenied with the scope already in the token is Microsoft refusing this mailbox or account.
    return MISSING_PERMISSION.test(`${code} ${message}`) ? 'permission' : 'denied'
  }
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
  if (!res.ok) {
    const error = body?.error ?? {}
    const inner = error.innerError ?? error.innererror ?? {}
    throw new GraphError(httpKind(res.status, error.code, error.message), res.status, error.code ?? null, {
      detail: sanitise(error.message),
      requestId: inner['request-id'] ?? res.headers.get('request-id') ?? null,
    })
  }
  return body
}

// One automatic attempt per key for each page load: remounts (React StrictMode, leaving and reopening a
// section) reuse the first result instead of asking Microsoft again, so a refused request is sent once.
// `fresh` is for a person's own click on Connect or Refresh.
const attempts = new Map()
export function remembered(key, run, fresh = false) {
  if (fresh || !attempts.has(key)) attempts.set(key, run())
  return attempts.get(key)
}

// Every item of a paged Graph collection, following @odata.nextLink for at most maxPages requests.
async function graphPages(url, options, maxPages) {
  const items = []
  for (let page = 0; url && page < maxPages; page++) {
    const data = await graphRequest(url, options)
    items.push(...(data?.value ?? []))
    url = data?.['@odata.nextLink']
  }
  return { items, truncated: Boolean(url) }
}

export const getProfile = (getToken, signal) =>
  graphRequest('/me?$select=displayName,mail,userPrincipalName,jobTitle', { getToken, signal })

// Only what the list shows. Calendars.Read would also allow body, attendees and attachments, but SyncAI
// has no use for them, so they are never requested.
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
  const { items, truncated } = await graphPages(`/me/calendarView?${query}`, { getToken, signal, headers: { Prefer: 'outlook.timezone="UTC"' } }, maxPages)
  return { events: items.map(toEvent).filter(Boolean), truncated }
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

// ---- Microsoft To Do (read-only, Tasks.Read) ----

const TASK_STATUS = new Set(['notStarted', 'inProgress', 'completed', 'waitingOnOthers', 'deferred'])
const IMPORTANCE = new Set(['low', 'normal', 'high'])

// The signed-in person's own To Do lists, their default list first.
export async function listTaskLists({ getToken, signal, maxPages = 4 }) {
  const { items } = await graphPages('/me/todo/lists', { getToken, signal }, maxPages)
  return items
    .map((raw) => ({ id: raw.id, name: raw.displayName?.trim() || null, isDefault: raw.wellknownListName === 'defaultList' }))
    .sort((a, b) => b.isDefault - a.isDefault)
}

// One Graph todoTask as the UI needs it. Most tasks have no due date, so `due` is often null.
// shortcut: due times are read as UTC, which is what To Do sends; honour dueDateTime.timeZone if that changes.
export function toTask(raw) {
  const status = TASK_STATUS.has(raw.status) ? raw.status : 'notStarted'
  return {
    id: raw.id,
    title: raw.title?.trim() || null,
    status,
    done: status === 'completed',
    importance: IMPORTANCE.has(raw.importance) ? raw.importance : 'normal',
    due: toDate(raw.dueDateTime),
  }
}

// Open tasks before completed ones; within each, soonest due first and tasks without a due date last.
function byOpenThenDue(a, b) {
  return a.done - b.done || (a.due ?? Infinity) - (b.due ?? Infinity)
}

// The tasks of one of the person's own lists, following Graph's paging.
// shortcut: stops after maxPages x 100 tasks and reports `truncated`, raise maxPages for longer lists.
export async function listTasks({ getToken, listId, signal, maxPages = 5 }) {
  const { items, truncated } = await graphPages(`/me/todo/lists/${encodeURIComponent(listId)}/tasks?$top=100`, { getToken, signal }, maxPages)
  return { tasks: items.map(toTask).sort(byOpenThenDue), truncated }
}

// A due date in the viewer's own timezone (or `timeZone`, for tests): To Do stores "due on the 12th" as
// midnight where the person set it, so the local date is the one they meant.
export function formatDue(task, locale, timeZone) {
  return task.due ? task.due.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }) : null
}
