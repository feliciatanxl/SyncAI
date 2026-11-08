import { CheckmarkCircle24Regular, Eye24Regular, ShieldCheckmark24Regular } from '@fluentui/react-icons'
import { useT } from '../lib/i18n.js'

const FACTOR_NUMBERS = [1, 2, 3, 4]

// The USP explained in plain language; shared by every portal.
export default function HowItDecides() {
  const t = useT()
  const principles = [
    { n: 1, icon: <Eye24Regular /> },
    { n: 2, icon: <CheckmarkCircle24Regular /> },
    { n: 3, icon: <ShieldCheckmark24Regular /> },
  ]
  return (
    <>
      <div className="section-title">
        <p className="eyebrow">{t('usp.eyebrow')}</p>
        <h1>{t('usp.name')}</h1>
        <p className="muted">{t('decides.lead')}</p>
      </div>
      <ol className="factor-cards">
        {FACTOR_NUMBERS.map((n) => (
          <li key={n} className="panel">
            <span className="factor-n" aria-hidden="true">{n}</span>
            <div><h2>{t(`factor${n}.title`)}</h2><p className="muted">{t(`factor${n}.text`)}</p></div>
          </li>
        ))}
      </ol>
      <div className="principles">
        {principles.map((p) => (
          <div key={p.n} className="panel">
            <span className="card-icon">{p.icon}</span>
            <h2>{t(`principle${p.n}.title`)}</h2>
            <p className="muted">{t(`principle${p.n}.text`)}</p>
          </div>
        ))}
      </div>
    </>
  )
}
