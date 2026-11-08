import { describe, expect, it } from 'vitest'
import { greetingName, relativeTime } from './time.js'

describe('greetingName', () => {
  it('uses the given name after a comma in directory-style names', () => {
    expect(greetingName('TAN XIU LI, FELICIA')).toBe('FELICIA')
  })
  it('uses the first word otherwise', () => {
    expect(greetingName('fel tan')).toBe('fel')
    expect(greetingName('felthebest@outlook.com')).toBe('felthebest@outlook.com')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-11-08T12:00:00Z')
  const ago = (ms) => new Date(now - ms)
  it('picks minutes, hours or days', () => {
    expect(relativeTime(ago(30_000), now, 'en')).toBe(null)
    expect(relativeTime(ago(5 * 60_000), now, 'en')).toBe('5 minutes ago')
    expect(relativeTime(ago(3 * 3_600_000), now, 'en')).toBe('3 hours ago')
    expect(relativeTime(ago(26 * 3_600_000), now, 'en')).toBe('yesterday')
  })
})
