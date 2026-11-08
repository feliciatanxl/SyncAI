import { describe, expect, it } from 'vitest'
import { LANGUAGES, STRINGS } from './strings.js'

describe('translations', () => {
  const english = Object.keys(STRINGS.en).sort()

  it.each(Object.keys(LANGUAGES))('%s has every English string and keeps its placeholders', (lang) => {
    expect(Object.keys(STRINGS[lang]).sort()).toEqual(english)
    for (const key of english) {
      const vars = (s) => (s.match(/\{\w+\}/g) || []).sort()
      expect(vars(STRINGS[lang][key]), `${lang} ${key}`).toEqual(vars(STRINGS.en[key]))
    }
  })
})
