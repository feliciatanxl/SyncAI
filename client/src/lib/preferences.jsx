import { useCallback, useEffect, useMemo, useState } from 'react'
import { webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { LANGUAGES, STRINGS } from './strings.js'
import { PreferencesContext, TEXT_SIZES } from './i18n.js'

const DEFAULTS = { textSize: 'standard', language: 'en', appearance: 'system' }
const STORAGE_KEY = 'syncai.preferences'

// Per-device convenience only, so a blocked or empty storage simply falls back to the defaults.
function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    return {
      textSize: saved.textSize in TEXT_SIZES ? saved.textSize : DEFAULTS.textSize,
      language: saved.language in STRINGS ? saved.language : DEFAULTS.language,
      appearance: ['system', 'light', 'dark'].includes(saved.appearance) ? saved.appearance : DEFAULTS.appearance,
    }
  } catch {
    return DEFAULTS
  }
}

// Fluent sizes its components in px, so its font tokens are scaled alongside the page's rem-based text.
function scaledTheme(base, scale) {
  if (scale === 1) return base
  const theme = { ...base }
  for (const [key, value] of Object.entries(base)) {
    if ((key.startsWith('fontSize') || key.startsWith('lineHeight')) && value.endsWith('px')) {
      theme[key] = `${Math.round(parseFloat(value) * scale)}px`
    }
  }
  return theme
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function useSystemDark() {
  const [dark, setDark] = useState(darkQuery.matches)
  useEffect(() => {
    const onChange = (e) => setDark(e.matches)
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [])
  return dark
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(loadSaved)
  const systemDark = useSystemDark()
  const dark = prefs.appearance === 'dark' || (prefs.appearance === 'system' && systemDark)
  const scale = TEXT_SIZES[prefs.textSize]

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* storage blocked: keep in memory */ }
    const root = document.documentElement
    root.lang = LANGUAGES[prefs.language].locale
    root.style.fontSize = `${scale * 100}%`
    root.style.colorScheme = dark ? 'dark' : 'light'
  }, [prefs, scale, dark])

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), [])
  const reset = useCallback(() => setPrefs(DEFAULTS), [])
  const theme = useMemo(() => scaledTheme(dark ? webDarkTheme : webLightTheme, scale), [dark, scale])
  const value = useMemo(() => ({ ...prefs, update, reset, theme }), [prefs, update, reset, theme])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
