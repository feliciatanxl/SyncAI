import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@fluentui/react-components'
import {
  ArrowClockwise20Regular,
  CheckmarkCircle48Regular,
  CloudOff48Regular,
  DismissCircle48Regular,
  Info48Regular,
  ArrowForward48Regular,
  Warning48Regular,
} from '@fluentui/react-icons'
import SiteLayout from '../components/SiteLayout.jsx'
import { MicrosoftLogo } from '../components/Brand.jsx'
import { CATEGORIES, getStatus, NETWORK_ERROR } from '../lib/httpStatus.js'

const LOOK = {
  informational: { icon: <Info48Regular />, badge: 'informative' },
  success: { icon: <CheckmarkCircle48Regular />, badge: 'success' },
  redirection: { icon: <ArrowForward48Regular />, badge: 'brand' },
  clientError: { icon: <Warning48Regular />, badge: 'warning' },
  serverError: { icon: <DismissCircle48Regular />, badge: 'danger' },
  network: { icon: <CloudOff48Regular />, badge: 'subtle' },
}

const RETRYABLE = new Set([0, 408, 425, 429, 500, 502, 503, 504])

// Full-page view of one status. Used for /status/:code, the 404 catch-all,
// and anywhere an ApiError needs a whole page (pass `code`).
export default function StatusPage({ code: codeProp }) {
  const params = useParams()
  const navigate = useNavigate()
  const raw = codeProp ?? params.code
  const status = Number(raw) === 0 ? NETWORK_ERROR : getStatus(raw) ?? getStatus(404)
  const look = LOOK[status.category]
  const label = CATEGORIES[status.category]?.label ?? 'Network'

  return (
    <SiteLayout nav={false}>
      <section className="status-page" aria-labelledby="status-h">
        <div className={`status-icon tone-${status.category}`}>{look.icon}</div>
        <p className="status-code" aria-hidden="true">{status.code || '—'}</p>
        <h1 id="status-h"><span className="visually-hidden">{status.code ? `${status.code} ` : ''}</span>{status.title}</h1>
        <Badge appearance="tint" color={look.badge} className="status-badge">{label}</Badge>
        <p className="lead status-message">{status.message}</p>
        <div className="status-actions">
          {status.code === 401 && <Link to="/login" className="btn-microsoft"><MicrosoftLogo /> Sign in with Microsoft</Link>}
          {RETRYABLE.has(status.code) && (
            <button type="button" className="btn-primary" onClick={() => navigate(0)}><ArrowClockwise20Regular /> Try again</button>
          )}
          <Link to="/" className="btn-ghost">Go to home page</Link>
        </div>
        <details className="status-details">
          <summary>Technical details</summary>
          <p>{status.description}</p>
        </details>
      </section>
    </SiteLayout>
  )
}
