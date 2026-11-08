import { useCallback, useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { useNavigate } from 'react-router-dom'
import { Button, MessageBar, MessageBarBody, MessageBarTitle, Spinner } from '@fluentui/react-components'
import { ArrowLeft20Regular, Settings20Regular } from '@fluentui/react-icons'
import { BrandLink } from '../components/Brand.jsx'
import { getApiToken, getProfilePhoto, loginRequest } from '../auth/msal.js'
import AccountMenu from '../components/AccountMenu.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import { apiRequest } from '../lib/api.js'
import { useT } from '../lib/i18n.js'
import AdminPortal from './AdminPortal.jsx'

// Signed-in home for everyone who isn't an active admin. The team member and manager screens come next.
export default function Workspace() {
  const t = useT()
  const { instance } = useMsal()
  const navigate = useNavigate()
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)
  const [view, setView] = useState('home')
  // MSAL returns a fresh account object on every render, so the effect keys on the stable ID instead.
  const accountId = account?.homeAccountId

  const getToken = useCallback(() => getApiToken(instance, instance.getAccount({ homeAccountId: accountId })), [instance, accountId])

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/me', { getToken, signal: controller.signal })
      .then(setMe)
      .catch((err) => err.name !== 'AbortError' && setError(err))
    return () => controller.abort()
  }, [getToken])

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

  // Clears SyncAI's session only, skipping Microsoft's "You signed out" page; the browser stays signed in to Microsoft.
  async function signOut() {
    await instance.logoutRedirect({ account, onRedirectNavigate: () => false })
    navigate('/', { replace: true })
  }

  const switchAccount = () => instance.loginRedirect(loginRequest)
  const name = account?.name || account?.username || ''

  if (me?.role === 'admin' && me.status === 'active') {
    return <AdminPortal me={me} photo={photo} tenantId={account?.tenantId} getToken={getToken} onSignOut={signOut} onSwitchAccount={switchAccount} />
  }

  return (
    <div className="workspace">
      <header className="site-header">
        <div className="wrap header-inner">
          <BrandLink />
          <div className="workspace-actions">
            <Button
              appearance="subtle"
              icon={<Settings20Regular />}
              aria-label={t('nav.settings')}
              aria-current={view === 'settings' ? 'page' : undefined}
              onClick={() => setView('settings')}
            >
              <span className="hide-sm">{t('nav.settings')}</span>
            </Button>
            <AccountMenu
              name={name}
              email={account?.username}
              photo={photo}
              tenantId={account?.tenantId}
              role={me?.status === 'active' ? t(`role.${me.role}`) : undefined}
              onSwitchAccount={switchAccount}
              onSignOut={signOut}
            />
          </div>
        </div>
      </header>
      <main id="main" className="wrap workspace-main">
        {view === 'settings' ? (
          <>
            <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => setView('home')} className="back-link">{t('nav.home')}</Button>
            <SettingsPanel />
          </>
        ) : (
          <>
            <p className="eyebrow">{t('ws.signedIn')}</p>
            <h1>{t('ws.welcome', { name })}</h1>
            <p className="muted">{account?.username}</p>
            <div className="card workspace-card"><AccessStatus me={me} error={error} /></div>
          </>
        )}
      </main>
    </div>
  )
}

function AccessStatus({ me, error }) {
  const t = useT()
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody><MessageBarTitle>{t('ws.error')}</MessageBarTitle>{error.message}</MessageBarBody>
      </MessageBar>
    )
  }
  if (!me) return <Spinner size="small" label={t('ws.checking')} />
  const [title, body] = me.status === 'pending'
    ? [t('ws.pendingTitle'), t('ws.pendingBody')]
    : me.status === 'disabled'
      ? [t('ws.disabledTitle'), t('ws.disabledBody')]
      : [t('ws.activeTitle'), t('ws.activeBody', { role: t(`role.${me.role}`) })]
  return (
    <>
      <h2>{title}</h2>
      <p>{body}</p>
    </>
  )
}
