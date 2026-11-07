import { Link } from 'react-router-dom'

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0F6CBD" />
      <path d="M9 12.5a7 7 0 0 1 12.2-3.4M23 19.5a7 7 0 0 1-12.2 3.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M21.6 5.6v4h-4M10.4 26.4v-4h4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
