import { useCallback, useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { clearGraphReturnError, clearReturnSection, getGraphToken, graphReturnError, markReturnSection } from './msal.js'
import { errorInfo, remembered } from '../lib/graph.js'

// Shared by every panel that shows the signed-in person's own Microsoft Graph data (calendar, To Do).

// Graph token getters for the signed-in account. Only `interactive` ones may send the person to Microsoft.
export function useGraph() {
  const { instance } = useMsal()
  const accountId = (instance.getActiveAccount() ?? instance.getAllAccounts()[0])?.homeAccountId
  const tokenFor = useCallback(
    (scopes, interactive = false) => () =>
      getGraphToken(instance, accountId ? instance.getAccount({ homeAccountId: accountId }) : null, scopes, { interactive }),
    [instance, accountId],
  )
  return { tokenFor, accountId }
}

// Connection state for one Graph feature: { phase: loading | idle | ready, data, error, load }.
// `name` keys the one-automatic-attempt rule per feature and account; `section` is the portal section to
// reopen after Microsoft's consent screen; `fetchData(tokenFor, interactive, arg)` must be a stable function.
// load(interactive, arg) is for clicks only: Connect passes interactive, Refresh and pickers do not.
export function useGraphData(name, section, active, fetchData) {
  const { tokenFor, accountId } = useGraph()
  // A consent round trip that Microsoft refused (cancelled, admin approval needed) is reported once on return.
  const [state, setState] = useState(() => {
    const kind = graphReturnError()
    return { phase: 'loading', data: null, error: kind ? { kind } : null }
  })
  useEffect(clearGraphReturnError, [])

  // Resolves with the next state (as a setState updater) rather than setting it, so callers decide when.
  const run = useCallback(async (interactive = false, arg) => {
    if (interactive) markReturnSection(section)
    try {
      const data = await fetchData(tokenFor, interactive, arg)
      clearReturnSection()
      return () => ({ phase: 'ready', data, error: null })
    } catch (err) {
      const error = errorInfo(err)
      // Consent needed after a click means the browser is already on its way to Microsoft: keep the spinner.
      if (error.kind === 'consent' && interactive) return (s) => s
      clearReturnSection()
      // Not yet connected is a normal starting state, not an error (a refused consent stays on screen).
      return (s) => ({ ...s, phase: s.data ? 'ready' : 'idle', error: error.kind === 'consent' ? s.error : error })
    }
  }, [tokenFor, section, fetchData])

  const key = `${name}:${accountId}`
  // A click always asks Microsoft again; nothing else does (see `remembered`).
  const load = (interactive, arg) => {
    setState((s) => ({ ...s, phase: 'loading', error: null }))
    remembered(key, () => run(interactive, arg), true).then(setState)
  }

  // Silent check on arrival: shows the data straight away for people who already connected.
  useEffect(() => {
    if (!active) return undefined
    let live = true
    remembered(key, () => run()).then((next) => live && setState(next))
    return () => { live = false }
  }, [active, key, run])

  return { ...state, load }
}
