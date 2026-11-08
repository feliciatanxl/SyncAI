import { describe, expect, it } from 'vitest'
import { greetingName } from './time.js'

describe('greetingName', () => {
  it('uses the given name after a comma in directory-style names', () => {
    expect(greetingName('TAN XIU LI, FELICIA')).toBe('FELICIA')
  })
  it('uses the first word otherwise', () => {
    expect(greetingName('fel tan')).toBe('fel')
    expect(greetingName('felthebest@outlook.com')).toBe('felthebest@outlook.com')
  })
})
