import { Navigate, useLocation } from 'react-router-dom'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { Spinner } from '@fluentui/react-components'
import { authConfigured } from '../auth/msal.js'

export default function RequireAuth({ children }) {
  if (!authConfigured) return <Navigate to="/login" replace />
  return <Guard>{children}</Guard>
}

// Split out so MSAL hooks only run when MsalProvider is mounted.
function Guard({ children }) {
  const { inProgress } = useMsal()
  const signedIn = useIsAuthenticated()
  const location = useLocation()
  if (signedIn) return children
  if (inProgress !== InteractionStatus.None) return <div className="center-page"><Spinner label="Checking your sign-in…" /></div>
  return <Navigate to="/login" replace state={{ from: location.pathname }} />
}
