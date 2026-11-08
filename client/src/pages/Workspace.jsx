import { useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { useNavigate } from 'react-router-dom'
import { Button, MessageBar, MessageBarBody, MessageBarTitle, Spinner } from '@fluentui/react-components'
import { SignOut20Regular } from '@fluentui/react-icons'
import { BrandLink } from '../components/Brand.jsx'
import { getApiToken } from '../auth/msal.js'
import { apiRequest } from '../lib/api.js'

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', member: 'Team member' }

// Placeholder for the signed-in planner. The team member and manager screens come next.
export default function Workspace() {
  const { instance } = useMsal()
  const navigate = useNavigate()
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)
  // MSAL returns a fresh account object on every render, so the effect keys on the stable ID instead.
  const accountId = account?.homeAccountId

  useEffect(() => {
    const controller = new AbortController()
    const signedIn = instance.getAccount({ homeAccountId: accountId })
    apiRequest('/me', { getToken: () => getApiToken(instance, signedIn), signal: controller.signal })
      .then(setMe)
      .catch((err) => err.name !== 'AbortError' && setError(err))
    return () => controller.abort()
  }, [instance, accountId])

  // Clears SyncAI's session only, skipping Microsoft's "You signed out" page; the browser stays signed in to Microsoft.
  async function signOut() {
    await instance.logoutRedirect({ account, onRedirectNavigate: () => false })
    navigate('/', { replace: true })
  }

  return (
    <div className="workspace">
      <header className="site-header">
        <div className="wrap header-inner">
          <BrandLink />
          <Button appearance="subtle" icon={<SignOut20Regular />} onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <main id="main" className="wrap workspace-main">
        <p className="eyebrow">Signed in with Microsoft</p>
        <h1>Welcome, {account?.name || account?.username || 'there'}</h1>
        <p className="muted">{account?.username}</p>
        <div className="card workspace-card"><AccessStatus me={me} error={error} /></div>
      </main>
    </div>
  )
}

function AccessStatus({ me, error }) {
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody><MessageBarTitle>Couldn’t reach SyncAI</MessageBarTitle>{error.message}</MessageBarBody>
      </MessageBar>
    )
  }
  if (!me) return <Spinner size="small" label="Checking your access…" />
  if (me.status === 'pending') {
    return (
      <>
        <h2>Waiting for approval</h2>
        <p>Your account is registered. An admin needs to approve it before you can use SyncAI.</p>
      </>
    )
  }
  if (me.status === 'disabled') {
    return (
      <>
        <h2>Access turned off</h2>
        <p>Your SyncAI access has been disabled. Contact your admin if you think this is a mistake.</p>
      </>
    )
  }
  return (
    <>
      <h2>Your planner is on the way</h2>
      <p>You’re signed in as <strong>{ROLE_LABEL[me.role]}</strong>. The task list, Smart Planner and team workload screens will appear here as they are built.</p>
    </>
  )
}
