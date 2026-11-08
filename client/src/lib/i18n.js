import { createContext, useCallback, useContext } from 'react'
import { LANGUAGES, STRINGS } from './strings.js'

export const TEXT_SIZES = { standard: 1, large: 1.125, xlarge: 1.25 }
export const PreferencesContext = createContext(null)

export const usePreferences = () => useContext(PreferencesContext)

// Returns t(key, vars) for the chosen language, falling back to English for any missing string.
export function useT() {
  const { language } = usePreferences()
  return useCallback(
    (key, vars) => {
      const text = STRINGS[language][key] ?? STRINGS.en[key] ?? key
      return vars ? text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '') : text
    },
    [language],
  )
}

export function useLocale() {
  return LANGUAGES[usePreferences().language].locale
}
