// HTTP status codes used by the SyncAI API and shown on the client's status pages.
// `description` is the technical meaning; `message` is what a user sees.

export const CATEGORIES = {
  informational: { range: '1xx', label: 'Informational', summary: 'Protocol-level information. Users never see these.' },
  success: { range: '2xx', label: 'Success', summary: 'The request was received and handled.' },
  redirection: { range: '3xx', label: 'Redirection', summary: 'The client must take another step to finish the request.' },
  clientError: { range: '4xx', label: 'Client error', summary: 'Something about the request needs to change.' },
  serverError: { range: '5xx', label: 'Server error', summary: 'The server could not complete a valid request.' },
}

const DEFAULT_MESSAGE = {
  informational: 'Your request is still being handled.',
  success: 'Done.',
  redirection: 'This page has moved. You should be taken to the right place automatically.',
  clientError: "We couldn't complete that request. Check what you entered and try again.",
  serverError: 'Something went wrong on our side. Please try again in a few minutes.',
}

// [code, reason phrase, technical description, user-facing message (optional)]
const CODES = [
  [100, 'Continue', 'Interim response: the first part of the request was received and the client should send the rest.'],
  [101, 'Switching Protocols', 'Sent in reply to an Upgrade header; the server is switching to the requested protocol.'],
  [102, 'Processing', 'WebDAV. The server has received the request and is processing it, but has no response yet.'],
  [103, 'Early Hints', 'Used with the Link header so the browser can start preloading resources before the final response.'],

  [200, 'OK', 'The request succeeded. The body depends on the method: the resource for GET, the result for POST.'],
  [201, 'Created', 'The request succeeded and created a resource. The Location header points to it.', 'Saved.'],
  [202, 'Accepted', 'The request was accepted for processing but is not finished, as with long-running or batch jobs.', "We've started on it. This can take a moment."],
  [203, 'Non-Authoritative Information', 'The returned metadata came from a local or third-party copy, not the origin server.'],
  [204, 'No Content', 'The request succeeded and there is no body to return, as after PUT, POST or DELETE.', 'Done.'],
  [205, 'Reset Content', 'The client should reset the document that sent the request.'],
  [206, 'Partial Content', 'Only the part of the resource asked for in the Range header is returned.'],
  [207, 'Multi-Status', 'WebDAV. Several operations ran; the body holds the status of each.'],
  [208, 'Already Reported', 'WebDAV. The same resource was already listed earlier in the response body.'],
  [226, 'IM Used', 'The GET succeeded and the response is the result of instance manipulations applied to the resource.'],

  [300, 'Multiple Choices', 'The request has more than one possible response; the client should choose one.'],
  [301, 'Moved Permanently', 'The resource has a new permanent URL, given in the Location header.'],
  [302, 'Found', 'The resource is temporarily at another URL, given in the Location header.'],
  [303, 'See Other', 'The response is at another URL and should be fetched with GET.'],
  [304, 'Not Modified', 'The resource has not changed, so the cached copy can be used.'],
  [305, 'Use Proxy', 'Deprecated. The resource must be accessed through a proxy.'],
  [306, 'Unused', 'Reserved and no longer used.'],
  [307, 'Temporary Redirect', 'Like 302, but the client must repeat the request with the same method.'],
  [308, 'Permanent Redirect', 'Like 301, but the client must repeat the request with the same method.'],

  [400, 'Bad Request', 'The server could not understand the request because of invalid syntax. Do not repeat it unchanged.', "Some of the details weren't valid. Check the highlighted fields and try again."],
  [401, 'Unauthorized', 'The request needs authentication. Repeat it with a valid Authorization header.', 'Your session has ended. Sign in with your Microsoft account to continue.'],
  [402, 'Payment Required', 'Reserved for future use in digital payment systems.'],
  [403, 'Forbidden', "The server knows who you are, but you don't have access to this resource.", "You don't have access to this. If you think you should, ask your supervisor or administrator."],
  [404, 'Not Found', 'The server cannot find the requested resource.', "We couldn't find that page or record. It may have been moved or deleted."],
  [405, 'Method Not Allowed', 'The method is known but not allowed for this resource.'],
  [406, 'Not Acceptable', 'No content matches the Accept header the client sent.'],
  [407, 'Proxy Authentication Required', 'The client must first authenticate with the proxy.'],
  [408, 'Request Timeout', 'The server did not receive a complete request in time.', 'That took too long. Check your connection and try again.'],
  [409, 'Conflict', 'The request conflicts with the current state of the resource.', 'Someone else changed this while you were editing. Refresh to see the latest version, then try again.'],
  [410, 'Gone', 'The resource is no longer available and will not come back.', 'This item has been removed.'],
  [411, 'Length Required', 'The server needs a Content-Length header.'],
  [412, 'Precondition Failed', 'A precondition in the request headers was not met.', 'This changed since you opened it. Refresh and try again.'],
  [413, 'Content Too Large', 'The request body is larger than the server allows.', 'That file or request is too large.'],
  [414, 'URI Too Long', 'The URL is longer than the server can handle.'],
  [415, 'Unsupported Media Type', 'The Content-Type of the request is not supported.', "That file type isn't supported."],
  [416, 'Range Not Satisfiable', 'The range in the Range header cannot be served.'],
  [417, 'Expectation Failed', 'The server cannot meet the Expect header.'],
  [418, "I'm a teapot", 'RFC 2324 April Fools code. Some services use it to refuse automated requests.'],
  [420, 'Enhance Your Calm', 'Non-standard (Twitter). The client is being rate-limited.'],
  [422, 'Unprocessable Content', 'The syntax is valid but the content cannot be processed, for example a validation failure.', "Some of the details don't add up, for example an end time before the start time. Fix them and try again."],
  [423, 'Locked', 'WebDAV. The resource is locked.', 'This item is locked while someone else is working on it.'],
  [424, 'Failed Dependency', 'WebDAV. The request failed because an earlier request failed.'],
  [425, 'Too Early', 'The server will not risk processing a request that might be replayed.'],
  [426, 'Upgrade Required', 'The client must switch to a different protocol.'],
  [428, 'Precondition Required', 'The server requires the request to be conditional.'],
  [429, 'Too Many Requests', 'The client sent too many requests in a given time (rate limiting).', "You're going a bit fast. Wait a moment, then try again."],
  [431, 'Request Header Fields Too Large', 'The request headers are too large.'],
  [444, 'No Response', 'Non-standard (Nginx). The server closed the connection without a response.'],
  [449, 'Retry With', 'Non-standard (Microsoft). Retry after performing the required action.'],
  [450, 'Blocked by Windows Parental Controls', 'Non-standard (Microsoft). Parental controls are blocking the page.'],
  [451, 'Unavailable For Legal Reasons', 'The resource cannot legally be provided.'],
  [499, 'Client Closed Request', 'Non-standard (Nginx). The client closed the connection before the server responded.'],

  [500, 'Internal Server Error', 'The server hit an unexpected condition.', 'Something went wrong on our side. Please try again. If it keeps happening, tell your administrator.'],
  [501, 'Not Implemented', 'The server does not support the functionality needed.', "This feature isn't available yet."],
  [502, 'Bad Gateway', 'The server, acting as a gateway, got an invalid response from an upstream service.', "We couldn't reach a connected service, such as Microsoft 365. Please try again shortly."],
  [503, 'Service Unavailable', 'The server is not ready to handle the request, for example during maintenance or overload.', 'SyncAI is temporarily unavailable, possibly for maintenance. Please try again in a few minutes.'],
  [504, 'Gateway Timeout', 'The server, acting as a gateway, did not get a response in time.', 'A connected service took too long to respond. Please try again.'],
  [505, 'HTTP Version Not Supported', 'The HTTP version in the request is not supported.'],
  [506, 'Variant Also Negotiates', 'Server configuration error in content negotiation.'],
  [507, 'Insufficient Storage', 'WebDAV. The server cannot store what is needed to complete the request.'],
  [508, 'Loop Detected', 'WebDAV. The server detected an infinite loop.'],
  [510, 'Not Extended', 'Further extensions to the request are required.'],
  [511, 'Network Authentication Required', 'The client must authenticate to get network access, for example on a captive Wi-Fi portal.', 'Your network needs you to sign in first, for example on public Wi-Fi.'],
]

export function categoryOf(code) {
  if (code >= 100 && code < 200) return 'informational'
  if (code >= 200 && code < 300) return 'success'
  if (code >= 300 && code < 400) return 'redirection'
  if (code >= 400 && code < 500) return 'clientError'
  if (code >= 500 && code < 600) return 'serverError'
  return null
}

export const HTTP_STATUSES = CODES.map(([code, title, description, message]) => {
  const category = categoryOf(code)
  return { code, title, description, category, message: message ?? DEFAULT_MESSAGE[category] }
})

const BY_CODE = new Map(HTTP_STATUSES.map((s) => [s.code, s]))

// Named constants for API code, e.g. HTTP.NOT_FOUND === 404.
export const HTTP = Object.fromEntries(
  HTTP_STATUSES.map((s) => [s.title.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''), s.code]),
)

// Unlisted codes in a valid range still get their category's wording.
export function getStatus(code) {
  const n = Number(code)
  if (BY_CODE.has(n)) return BY_CODE.get(n)
  const category = Number.isInteger(n) ? categoryOf(n) : null
  if (!category) return null
  return { code: n, title: `${CATEGORIES[category].label} ${n}`, description: CATEGORIES[category].summary, category, message: DEFAULT_MESSAGE[category] }
}

export const isError = (code) => code >= 400 && code < 600

// Not an HTTP code: fetch failed before any response (offline, DNS, CORS).
export const NETWORK_ERROR = {
  code: 0,
  title: 'Network error',
  description: 'The request never reached the server.',
  category: 'network',
  message: "We couldn't connect. Check your internet connection and try again.",
}
