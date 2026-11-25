import { useState } from 'react'
import { Badge, Button, Spinner } from '@fluentui/react-components'
import { PlugConnected20Regular } from '@fluentui/react-icons'
import { GRAPH_SCOPES, clearReturnSection, markReturnSection } from '../auth/msal.js'
import { errorInfo, getProfile } from '../lib/graph.js'
import { useT } from '../lib/i18n.js'
import { useGraph } from '../auth/useGraph.js'
import GraphErrorBar from './GraphErrorBar.jsx'

// Admin Settings: checks that Microsoft Graph answers for the admin's own account. Profile only, no calendar.
export function GraphConnectionTest() {
  const t = useT()
  const { tokenFor } = useGraph()
  const [state, setState] = useState({ busy: false, profile: null, error: null })

  async function run() {
    setState({ busy: true, profile: null, error: null })
    markReturnSection('settings')
    try {
      const profile = await getProfile(tokenFor(GRAPH_SCOPES.profile, true))
      clearReturnSection()
      setState({ busy: false, profile, error: null })
    } catch (err) {
      const error = errorInfo(err)
      if (error.kind === 'consent') return
      clearReturnSection()
      setState({ busy: false, profile: null, error })
    }
  }

  return (
    <section className="panel cal-panel graph-test" aria-labelledby="graph-test-h">
      <div className="cal-head">
        <span className="card-icon" aria-hidden="true"><PlugConnected20Regular /></span>
        <div className="cal-head-text">
          <h2 id="graph-test-h">{t('graph.test.title')}</h2>
          <p className="muted">{t('graph.test.lead')}</p>
        </div>
        {state.profile && <Badge appearance="tint" color="success" icon={<PlugConnected20Regular />}>{t('cal.live')}</Badge>}
      </div>
      <div className="cal-bar">
        <span className="cal-bar-text">{state.busy && <Spinner size="tiny" label={t('app.loading')} />}</span>
        <Button icon={<PlugConnected20Regular />} disabled={state.busy} onClick={run}>{t('graph.test.run')}</Button>
      </div>
      {state.error && <GraphErrorBar error={state.error} />}
      {state.profile && (
        <p role="status" className="cal-foot">
          <strong>{t('graph.test.ok')}</strong><br />
          <span className="muted">
            {[state.profile.displayName, state.profile.mail || state.profile.userPrincipalName, state.profile.jobTitle].filter(Boolean).join(' · ')}
          </span>
        </p>
      )}
    </section>
  )
}

