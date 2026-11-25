import { useCallback, useEffect, useRef, useState } from 'react'
import { useGraph } from '../../auth/useGraph.js'
import { clearGraphReturnError, clearReturnSection, GRAPH_SCOPES, graphReturnError, markReturnSection } from '../../auth/msal.js'
import { errorInfo, listEvents } from '../../lib/graph.js'

export default function useOutlookEvents(enabled, period, scopeRevision) {
  const { tokenFor, accountId } = useGraph()
  const key = enabled && period && accountId ? JSON.stringify([accountId, scopeRevision, period.revision]) : null
  const start = period?.start
  const end = period?.end
  const [result, setResult] = useState(null)
  const [redirectError, setRedirectError] = useState(graphReturnError)
  const request = useRef(null)
  useEffect(clearGraphReturnError, [])

  const read = useCallback((interactive = false) => {
    if (!key) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    if (interactive) markReturnSection('plan')
    const getToken = tokenFor(GRAPH_SCOPES.calendar, interactive)
    listEvents({ getToken, start: new Date(start), end: new Date(end), signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted) return
        if (interactive) clearReturnSection()
        setResult({ key, phase: 'ready', ...data })
      },
      (cause) => {
        if (controller.signal.aborted) return
        const error = errorInfo(cause)
        if (interactive && error.kind === 'consent') return
        if (interactive) clearReturnSection()
        setResult(error.kind === 'consent' ? { key, phase: 'disconnected' } : { key, phase: 'error', error })
      },
    )
  }, [key, start, end, tokenFor])

  useEffect(() => {
    read()
    return () => request.current?.abort()
  }, [read])

  function refresh(interactive = false) {
    if (!key) return
    setRedirectError(null)
    setResult({ key, phase: 'loading' })
    read(interactive)
  }

  if (!enabled) return { phase: 'hidden' }
  if (!accountId) return { phase: 'error', error: { kind: 'account' } }
  const current = key && result?.key === key ? result : { phase: 'loading' }
  const error = current.error || (current.phase === 'disconnected' && redirectError ? { kind: redirectError } : null)
  return { ...current, error, refresh }
}
