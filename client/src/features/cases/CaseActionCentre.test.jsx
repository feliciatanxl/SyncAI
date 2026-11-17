import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { PreferencesContext } from '../../lib/i18n.js'
import CaseActionCentre from './CaseActionCentre.jsx'
import { CaseDetailsBody, DETAIL_TABS } from './CaseDetails.jsx'
import { demoCases, demoOfficers } from './demoCases.js'

const member = { id: 'u1', status: 'active', role: 'member', displayName: 'Officer One' }
const now = new Date()
const wrap = (node) => renderToString(
  <PreferencesContext.Provider value={{ language: 'en' }}><FluentProvider theme={webLightTheme}>{node}</FluentProvider></PreferencesContext.Provider>,
)

describe('CaseDetailsBody', () => {
  const kase = demoCases(member, now)[0]
  const officers = demoOfficers(member)
  const props = { kase, me: member, now, officers, officerName: (id) => officers.find((o) => o.id === id)?.name, actions: {}, onTab: () => {}, onMove: () => {} }

  it.each(DETAIL_TABS)('renders the %s section without raw data', (tab) => {
    const html = wrap(<CaseDetailsBody {...props} tab={tab} />)
    expect(html).toContain('Timeline &amp; notes')
    expect(html).not.toMatch(/\{"|\[object Object\]|undefined/)
  })

  it('shows the case’s own records', () => {
    expect(wrap(<CaseDetailsBody {...props} tab="evidence" />)).toContain('Joint inspection notice copy')
    expect(wrap(<CaseDetailsBody {...props} tab="brief" />)).toContain('Recommended next actions')
    expect(wrap(<CaseDetailsBody {...props} tab="comms" />)).toContain('simulated')
  })
})

describe('CaseActionCentre', () => {
  const pending = { mode: 'api', list: () => new Promise(() => {}) }

  it('shows a loading state first', () => {
    const html = wrap(<CaseActionCentre me={member} service={pending} />)
    expect(html).toContain('Loading cases')
    expect(html).not.toContain('Demo data')
  })

  it('renders nothing for admins and inactive accounts', () => {
    expect(wrap(<CaseActionCentre me={{ ...member, role: 'admin' }} service={pending} />)).not.toContain('Case Action Centre')
    expect(wrap(<CaseActionCentre me={{ ...member, status: 'pending' }} service={pending} />)).not.toContain('Case Action Centre')
  })

  it('never labels cases as demo data', () => {
    expect(wrap(<CaseActionCentre me={member} service={{ ...pending, mode: 'demo' }} />)).not.toMatch(/demo/i)
  })
})
