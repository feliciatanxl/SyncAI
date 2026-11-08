import { Link } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { Avatar } from '@fluentui/react-components'
import { authConfigured } from '../auth/msal.js'
import { BrandLink } from './Brand.jsx'

const signInLink = <Link to="/login" className="header-cta">Sign in</Link>

// Split out so MSAL hooks only run when MsalProvider is mounted.
function HeaderAccount() {
  const { instance, accounts } = useMsal()
  const account = instance.getActiveAccount() ?? accounts[0]
  if (!account) return signInLink
  const name = account.name || account.username
  return (
    <Link to="/app" className="header-account" aria-label={`Open your planner, signed in as ${name}`}>
      <span className="header-account-text">
        <strong>{name}</strong>
        <span>{account.username}</span>
      </span>
      <Avatar name={name} size={32} color="colorful" />
    </Link>
  )
}

export default function SiteLayout({ children, nav = true }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap header-inner">
          <BrandLink />
          {nav && (
            <nav aria-label="Main" className="site-nav">
              <a href="/#capabilities">Capabilities</a>
              <a href="/#priority">Priority logic</a>
              <a href="/#how">How it works</a>
              <a href="/#trust">Responsible AI</a>
            </nav>
          )}
          {authConfigured ? <HeaderAccount /> : signInLink}
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="wrap footer-inner">
          <div>
            <BrandLink />
            <p className="muted small">Your Work. Your Time. In Sync.</p>
          </div>
          <p className="muted small footer-note">© 2026 SyncAI. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}
