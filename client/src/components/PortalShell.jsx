import { Info20Regular } from '@fluentui/react-icons'
import AccountMenu from './AccountMenu.jsx'
import { BrandLink } from './Brand.jsx'
import { useT } from '../lib/i18n.js'

// The frame every signed-in portal shares: header with role tag and account menu, sidebar (a tab strip on
// small screens) and the main area. `badges` maps a section id to an element shown after its label.
export default function PortalShell({ tag, sections, section, onSection, badges = {}, account, children }) {
  const t = useT()
  return (
    <div className="portal">
      <header className="portal-header">
        <BrandLink />
        {tag && <span className="portal-tag">{tag}</span>}
        <div className="portal-account">
          <AccountMenu {...account} />
        </div>
      </header>

      <div className="portal-body">
        <nav className="portal-nav" aria-label={t('app.portal')}>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className="portal-nav-item"
              aria-current={section === s.id ? 'page' : undefined}
              onClick={() => onSection(s.id)}
            >
              {s.icon}
              <span>{t(`nav.${s.id}`)}</span>
              {badges[s.id]}
            </button>
          ))}
          <p className="portal-nav-note small">
            <Info20Regular /> {t('nav.note')}
          </p>
        </nav>

        <main id="main" className="portal-main">{children}</main>
      </div>
    </div>
  )
}
