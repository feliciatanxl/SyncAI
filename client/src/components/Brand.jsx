import { Link } from 'react-router-dom'

export function Logo({ size = 28 }) {
  return <img src="/syncai-logo.png" width={size} height={size} alt="" />
}

export function BrandLink() {
  return (
    <Link to="/" className="brand" aria-label="SyncAI home">
      <Logo />
      <span>SyncAI</span>
    </Link>
  )
}

// Microsoft's four-square mark, as required on "Sign in with Microsoft" buttons.
export function MicrosoftLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}
