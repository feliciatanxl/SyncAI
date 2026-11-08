// Branded page banner shared by every portal page, in the same navy-to-blue style as the Overview.
// `children` go on the right: usually HeroStat summaries or an action.
export default function PageHeader({ icon, eyebrow, title, badge, description, children }) {
  return (
    <header className="page-hero">
      <span className="page-hero-icon" aria-hidden="true">{icon}</span>
      <div className="page-hero-text">
        {eyebrow && <p className="page-hero-eyebrow">{eyebrow}</p>}
        <h1>{title} {badge}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-hero-aside">{children}</div>}
    </header>
  )
}

export function HeroStat({ value, label, tone }) {
  return (
    <div className={`hero-stat ${tone ? `hero-stat-${tone}` : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
