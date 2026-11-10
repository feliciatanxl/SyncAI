import { MessageBar, MessageBarBody } from '@fluentui/react-components'
import { useT } from '../lib/i18n.js'

// The friendly message, then exactly what Microsoft answered (status, code, its own words, request ID) so a
// failure can be diagnosed or reported. Never contains a token.
export default function GraphErrorBar({ error }) {
  const t = useT()
  const facts = [error.status && `HTTP ${error.status}`, error.code, error.requestId && t('graph.err.requestId', { id: error.requestId })].filter(Boolean)
  return (
    <MessageBar intent={error.kind === 'cancelled' ? 'warning' : 'error'} className="cal-error" layout="multiline">
      <MessageBarBody>
        {t(`graph.err.${error.kind}`)}
        {(facts.length > 0 || error.detail) && (
          <span className="cal-error-detail small">
            {facts.length > 0 && <span>{t('graph.err.details')} {facts.join(' · ')}</span>}
            {error.detail && <span lang="en">{error.detail}</span>}
          </span>
        )}
      </MessageBarBody>
    </MessageBar>
  )
}
