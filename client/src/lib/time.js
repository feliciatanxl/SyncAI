import { useEffect, useState } from 'react'

export const greetingKey = (now) => {
  const h = now.getHours()
  return h < 12 ? 'greet.morning' : h < 18 ? 'greet.afternoon' : 'greet.evening'
}

// The current time, re-read every 15 seconds so the clock and "Updated … ago" stay right without ticking seconds.
export function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// Name for the greeting. Directory names like "TAN XIU LI, FELICIA" put the given name after the comma.
export function greetingName(name) {
  const [before, after] = name.split(',')
  return (after?.trim() || before.trim()).split(/\s+/)[0]
}

// "5 minutes ago", "3 hours ago", "yesterday" in the chosen language. Returns null for under a minute.
export function relativeTime(date, now, locale) {
  const minutes = Math.floor((now - new Date(date)) / 60_000)
  if (minutes < 1) return null
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  if (minutes < 24 * 60) return rtf.format(-Math.floor(minutes / 60), 'hour')
  return rtf.format(-Math.floor(minutes / (24 * 60)), 'day')
}
