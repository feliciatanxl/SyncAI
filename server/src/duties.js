import { RuleError } from './teams.js'

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const CATEGORIES = ['Inspection', 'Resident Feedback', 'Cleaning', 'Horticulture', 'Contractor', 'Maintenance', 'Admin', 'Other']
export const PRIORITY_FACTORS = [
  { key: 'service', label: 'Service impact' },
  { key: 'safety', label: 'Safety' },
  { key: 'residents', label: "Residents’ well-being" },
  { key: 'concern', label: 'Actual concern' },
]

function invalid(message) {
  throw new RuleError(400, 'invalid_duty', message)
}

function text(value, label, limit, required = false) {
  if (value == null && !required) return ''
  if (typeof value !== 'string' || value.includes('\0')) invalid(label + ' must be text.')
  const cleaned = value.trim()
  if ((required && !cleaned) || cleaned.length > limit) invalid(label + ' must be ' + (required ? '1 to ' : 'at most ') + limit + ' characters.')
  return cleaned
}

function instant(value, label, required = false) {
  if (value == null && !required) return null
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) {
    invalid(label + ' must be a valid UTC timestamp.')
  }
  const date = new Date(value)
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 19) !== value.slice(0, 19) || date.getUTCFullYear() < 1) {
    invalid(label + ' must be a valid UTC timestamp.')
  }
  return date.toISOString()
}

export function calendarRange(query) {
  const start = instant(query.start, 'Range start', true)
  const end = instant(query.end, 'Range end', true)
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000
  if (days <= 0 || days > 62) invalid('Select a calendar range of up to 62 days.')
  return { start, end }
}

export function dutyInput(body) {
  const {
    officerId, category, type, durationMinutes, shareLocation = false, factors = {},
    startAt, endAt, deadline, title, description, location, remarks,
  } = body ?? {}
  if (typeof officerId !== 'string' || !UUID.test(officerId)) invalid('Choose an officer.')
  if (!CATEGORIES.includes(category)) invalid('Choose a duty category.')
  if (!['flexible', 'fixed'].includes(type)) invalid('Choose Flexible or Fixed time.')
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    invalid('Estimated duration must be between 1 and 1440 minutes.')
  }
  if (typeof shareLocation !== 'boolean') invalid('Choose whether the location is shared.')
  if (!factors || typeof factors !== 'object' || Array.isArray(factors)) invalid('Provide priority factors as text fields.')
  const fixed = type === 'fixed'
  if (!fixed && (startAt != null || endAt != null)) invalid('Flexible duties cannot have a booked time.')
  const start = fixed ? instant(startAt, 'Start time', true) : null
  const end = fixed ? instant(endAt, 'End time', true) : null
  if (fixed && end <= start) invalid('End time must be after start time.')
  return {
    officerId, category, type, durationMinutes, shareLocation,
    title: text(title, 'Title', 160, true),
    description: text(description, 'Description', 4000),
    location: text(location, 'Location', 250),
    remarks: text(remarks, 'Remarks', 2000),
    factors: Object.fromEntries(PRIORITY_FACTORS.map(({ key, label }) => [key, text(factors[key], label, 500)])),
    deadline: instant(deadline, 'Deadline'),
    startAt: start,
    endAt: end,
  }
}

export function dutyChange(body) {
  const { revision, cancel } = body ?? {}
  if (!Number.isInteger(revision) || revision < 1 || revision >= 2147483647) invalid('Provide the current assignment revision.')
  if (cancel !== undefined && typeof cancel !== 'boolean') invalid('Cancel must be true or false.')
  return { revision, cancel: cancel === true, input: cancel ? null : dutyInput(body) }
}
