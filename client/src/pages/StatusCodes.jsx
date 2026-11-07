import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SearchBox } from '@fluentui/react-components'
import SiteLayout from '../components/SiteLayout.jsx'
import { CATEGORIES, HTTP_STATUSES } from '../lib/httpStatus.js'

// Reference of every status the API can return, each linking to its designed page.
export default function StatusCodes() {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (s) => !q || `${s.code} ${s.title} ${s.description} ${s.message}`.toLowerCase().includes(q)
    return Object.entries(CATEGORIES)
      .map(([key, cat]) => ({ key, ...cat, items: HTTP_STATUSES.filter((s) => s.category === key && match(s)) }))
      .filter((g) => g.items.length)
  }, [query])

  return (
    <SiteLayout nav={false}>
      <section className="section">
        <div className="wrap">
          <div className="section-head left">
            <p className="eyebrow">Developer reference</p>
            <h1>API status codes</h1>
            <p className="lead">Every HTTP status the SyncAI API may return, what it means, and what officers see. Select a code to preview its page.</p>
          </div>
          <SearchBox className="status-search" placeholder="Search by code or name, e.g. 429 or conflict" value={query} onChange={(_, d) => setQuery(d.value)} aria-label="Search status codes" />
          {groups.length === 0 && <p className="muted">No status codes match “{query}”.</p>}
          {groups.map((g) => (
            <section key={g.key} className="status-group" aria-labelledby={`grp-${g.key}`}>
              <h2 id={`grp-${g.key}`}><span className={`range tone-${g.key}`}>{g.range}</span> {g.label}</h2>
              <p className="muted">{g.summary}</p>
              <ul className="status-grid">
                {g.items.map((s) => (
                  <li key={s.code}>
                    <Link to={`/status/${s.code}`} className={`status-tile tone-${g.key}`}>
                      <span className="tile-code">{s.code}</span>
                      <span className="tile-title">{s.title}</span>
                      <span className="tile-desc">{s.message}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </SiteLayout>
  )
}
