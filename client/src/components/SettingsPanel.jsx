import { Button } from '@fluentui/react-components'
import { ArrowReset20Regular, Settings24Regular, ShieldCheckmark24Regular, ShieldKeyhole20Regular } from '@fluentui/react-icons'
import { TEXT_SIZES, usePreferences, useT } from '../lib/i18n.js'
import { LANGUAGES } from '../lib/strings.js'
import PageHeader, { HeroStat } from './PageHeader.jsx'

// Large radio tiles rather than dropdowns: easier to see, tap and understand for every kind of user.
function Choice({ name, legend, hint, options, value, onChange }) {
  return (
    <fieldset className="settings-group">
      <legend>{legend}</legend>
      <p className="muted">{hint}</p>
      <div className="choice-grid">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="choice-body">
              {o.sample}
              <span className="choice-label" lang={o.lang}>{o.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function SettingsPanel({ onReset }) {
  const t = useT()
  const prefs = usePreferences()

  return (
    <>
      <PageHeader icon={<Settings24Regular />} title={t('nav.settings')} description={t('settings.lead')}>
        <HeroStat value={t(`size.${prefs.textSize}`)} label={t('settings.text')} />
        <HeroStat value={LANGUAGES[prefs.language].label} label={t('settings.language')} />
        <HeroStat value={t(`appearance.${prefs.appearance}`)} label={t('settings.appearance')} />
      </PageHeader>

      <div className="settings-layout">
        <div className="panel settings-form">
          <Choice
            name="textSize"
            legend={t('settings.text')}
            hint={t('settings.textHint')}
            value={prefs.textSize}
            onChange={(textSize) => prefs.update({ textSize })}
            options={Object.entries(TEXT_SIZES).map(([value, scale]) => ({
              value,
              label: t(`size.${value}`),
              sample: <span className="choice-sample" aria-hidden="true" style={{ fontSize: `${(scale - 1) * 5 + 1}rem` }}>A</span>,
            }))}
          />
          <Choice
            name="language"
            legend={t('settings.language')}
            hint={t('settings.languageHint')}
            value={prefs.language}
            onChange={(language) => prefs.update({ language })}
            options={Object.entries(LANGUAGES).map(([value, l]) => ({ value, label: l.label, lang: l.locale }))}
          />
          <Choice
            name="appearance"
            legend={t('settings.appearance')}
            hint={t('settings.appearanceHint')}
            value={prefs.appearance}
            onChange={(appearance) => prefs.update({ appearance })}
            options={['system', 'light', 'dark'].map((value) => ({
              value,
              label: t(`appearance.${value}`),
              sample: <span className={`choice-swatch ${value}`} aria-hidden="true" />,
            }))}
          />
          <div className="settings-actions">
            <Button icon={<ArrowReset20Regular />} onClick={() => { prefs.reset(); onReset?.() }}>{t('settings.reset')}</Button>
          </div>
        </div>

        <aside className="panel settings-preview" aria-label={t('settings.preview')}>
          <p className="eyebrow">{t('settings.preview')}</p>
          <div className="preview-task">
            <span className="card-icon"><ShieldCheckmark24Regular /></span>
            <div>
              <strong>{t('settings.previewTitle')}</strong>
              <p className="muted">{t('settings.previewText')}</p>
            </div>
          </div>
          <Button appearance="primary">{t('btn.approve')}</Button>
        </aside>
      </div>

      <p className="privacy-note small muted">
        <ShieldKeyhole20Regular /> {t('privacy.notice')}
      </p>
    </>
  )
}
