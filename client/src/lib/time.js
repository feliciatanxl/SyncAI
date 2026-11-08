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
