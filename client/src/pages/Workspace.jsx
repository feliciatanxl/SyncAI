import { useMsal } from '@azure/msal-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@fluentui/react-components'
import { SignOut20Regular } from '@fluentui/react-icons'
import { BrandLink } from '../components/Brand.jsx'

// Placeholder for the signed-in planner. The team member and manager screens come next.
export default function Workspace() {
  const { instance } = useMsal()
  const navigate = useNavigate()
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]

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
        <div className="card workspace-card">
          <h2>Your planner is on the way</h2>
          <p>Sign-in works. The task list, Smart Planner and team workload screens will appear here as they are built.</p>
        </div>
      </main>
    </div>
  )
}
