import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { MessageBar, MessageBarBody, MessageBarTitle, Spinner } from '@fluentui/react-components'
import { LockClosed16Regular } from '@fluentui/react-icons'
import { authConfigured, loginRequest } from '../auth/msal.js'
import { BrandLink, MicrosoftLogo } from '../components/Brand.jsx'

export default function Login() {
  return (
    <div className="login-page">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="login-aside" aria-hidden="true">
        <BrandLink />
        <div>
          <h2>Smarter priorities. More realistic plans.</h2>
          <p>Safety first, deadlines protected, and a day that actually fits.</p>
        </div>
        <p className="small">EM Services · Problem statement 12i</p>
      </aside>
      <main id="main" className="login-main">
        <div className="login-card">
          <div className="login-brand-mobile"><BrandLink /></div>
          <h1>Sign in to SyncAI</h1>
          <p className="muted">Use your organisation’s Microsoft account. SyncAI has no separate username or password.</p>
          {authConfigured ? <MicrosoftSignIn /> : <NotConfigured />}
          <p className="login-foot small muted">
            <LockClosed16Regular /> Sign-in is handled by Microsoft Entra ID. SyncAI never sees your password.
          </p>
        </div>
      </main>
    </div>
  )
}

function MicrosoftSignIn() {
  const { instance, inProgress } = useMsal()
  const signedIn = useIsAuthenticated()
  const location = useLocation()
  const [error, setError] = useState(null)

  if (signedIn) return <Navigate to={location.state?.from || '/app'} replace />
  const busy = inProgress !== InteractionStatus.None

  async function signIn() {
    setError(null)
    try {
      await instance.loginRedirect(loginRequest)
    } catch (err) {
      if (err?.errorCode !== 'user_cancelled') setError(err?.errorMessage || err?.message || 'Sign-in failed.')
    }
  }

  return (
    <>
      {error && (
        <MessageBar intent="error" className="login-message">
          <MessageBarBody><MessageBarTitle>Couldn’t sign you in</MessageBarTitle>{error}</MessageBarBody>
        </MessageBar>
      )}
      <button type="button" className="btn-microsoft wide" onClick={signIn} disabled={busy}>
        {busy ? <Spinner size="tiny" /> : <MicrosoftLogo />}
        {busy ? 'Connecting to Microsoft…' : 'Sign in with Microsoft'}
      </button>
    </>
  )
}

function NotConfigured() {
  return (
    <>
      <MessageBar intent="warning" className="login-message">
        <MessageBarBody>
          <MessageBarTitle>Microsoft sign-in isn’t set up yet</MessageBarTitle>
          Add <code>VITE_ENTRA_CLIENT_ID</code> and <code>VITE_ENTRA_TENANT_ID</code> to <code>client/.env.local</code> (see <code>.env.example</code>), then restart the dev server.
        </MessageBarBody>
      </MessageBar>
      <button type="button" className="btn-microsoft wide" disabled>
        <MicrosoftLogo /> Sign in with Microsoft
      </button>
    </>
  )
}
