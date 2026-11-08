import { useCallback, useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { useNavigate } from 'react-router-dom'
import { Button, MessageBar, MessageBarBody, MessageBarTitle, Spinner } from '@fluentui/react-components'
import { BrandLink } from '../components/Brand.jsx'
import { getApiToken, getProfilePhoto, loginRequest } from '../auth/msal.js'
import { apiRequest } from '../lib/api.js'
import { useT } from '../lib/i18n.js'
import AdminPortal from './AdminPortal.jsx'
import MemberPortal from './MemberPortal.jsx'

// Signed-in entry point: finds out who you are from the API, then opens the admin or member portal.
export default function Workspace() {
  const t = useT()
  const { instance } = useMsal()
  const navigate = useNavigate()
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  // MSAL returns a fresh account object on every render, so effects key on the stable ID instead.
  const accountId = account?.homeAccountId

  const getToken = useCallback(() => getApiToken(instance, instance.getAccount({ homeAccountId: accountId })), [instance, accountId])

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/me', { getToken, signal: controller.signal })
      .then(setMe)
      .catch((err) => err.name !== 'AbortError' && setError(err))
    return () => controller.abort()
  }, [getToken, attempt])

  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    let url = null
    let live = true
    getProfilePhoto(instance, instance.getAccount({ homeAccountId: accountId })).then((u) => {
      url = u
      if (live) setPhoto(u)
    })
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [instance, accountId])

  // Records the sign-out (best effort, 3 seconds at most: logging must never keep anyone signed in), then clears
  // SyncAI's session only, skipping Microsoft's "You signed out" page; the browser stays signed in to Microsoft.
  async function signOut() {
    try {
      await apiRequest('/signout', { method: 'POST', getToken, signal: AbortSignal.timeout(3000) })
    } catch {
      // Sign out anyway.
    }
    await instance.logoutRedirect({ account, onRedirectNavigate: () => false })
    navigate('/', { replace: true })
  }

  const switchAccount = () => instance.loginRedirect(loginRequest)
  const common = { me, photo, tenantId: account?.tenantId, onSignOut: signOut, onSwitchAccount: switchAccount }

  if (me?.role === 'admin' && me.status === 'active') return <AdminPortal {...common} getToken={getToken} />
  if (me) return <MemberPortal {...common} />

  return (
    <div className="workspace">
      <header className="site-header">
        <div className="wrap header-inner">
          <BrandLink />
          <Button appearance="subtle" onClick={signOut}>{t('account.signOut')}</Button>
        </div>
      </header>
      <main id="main" className="wrap workspace-main">
        {error ? (
          <MessageBar intent="error" className="workspace-card">
            <MessageBarBody><MessageBarTitle>{t('ws.error')}</MessageBarTitle>{error.message}</MessageBarBody>
            <Button size="small" onClick={() => { setError(null); setAttempt((n) => n + 1) }}>{t('app.retry')}</Button>
          </MessageBar>
        ) : (
          <div className="center-page"><Spinner label={t('ws.checking')} /></div>
        )}
      </main>
    </div>
  )
}
