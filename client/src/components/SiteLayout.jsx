import { Link } from 'react-router-dom'
import { BrandLink } from './Brand.jsx'

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
          <Link to="/login" className="header-cta">Sign in</Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="wrap footer-inner">
          <div>
            <BrandLink />
            <p className="muted small">Your Work. Your Time. In Sync.</p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <a href="/#capabilities">Capabilities</a>
            <a href="/#priority">Priority logic</a>
            <a href="/#how">How it works</a>
            <a href="/#trust">Responsible AI</a>
            <Link to="/login">Sign in</Link>
          </nav>
          <p className="muted small footer-note">© 2026 SyncAI. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}
