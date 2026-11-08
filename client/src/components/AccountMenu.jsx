import { useState } from 'react'
import { Avatar, Badge, Button, Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components'
import { ChevronDown16Regular, Open16Regular, PersonSwap20Regular, SignOut20Regular } from '@fluentui/react-icons'
import { useT } from '../lib/i18n.js'

// Microsoft's fixed tenant ID for personal (Outlook.com, Hotmail) accounts.
const PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

// Account card in the style of Microsoft 365's: who you are, manage your Microsoft account, switch account, sign out.
export default function AccountMenu({ name, email, photo, tenantId, role, onSwitchAccount, onSignOut }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const manageUrl = tenantId === PERSONAL_TENANT ? 'https://account.microsoft.com/' : 'https://myaccount.microsoft.com/'
  const closeThen = (fn) => () => { setOpen(false); fn() }
  const image = photo ? { src: photo, alt: '' } : undefined

  return (
    <Popover open={open} onOpenChange={(_e, d) => setOpen(d.open)} positioning="below-end" withArrow={false}>
      <PopoverTrigger disableButtonEnhancement>
        <button type="button" className="account-trigger" aria-label={t('account.menu', { name })}>
          <span className="account-trigger-text">
            <strong>{name}</strong>
            <span>{email}</span>
          </span>
          <Avatar name={name} image={image} size={32} color="colorful" />
          <ChevronDown16Regular className="account-chevron" />
        </button>
      </PopoverTrigger>
      <PopoverSurface className="account-card" aria-label={t('account.label')}>
        <div className="account-card-top">
          <span className="account-card-brand">SyncAI</span>
          <Button appearance="transparent" size="small" icon={<SignOut20Regular />} onClick={closeThen(onSignOut)}>{t('account.signOut')}</Button>
        </div>
        <div className="account-card-who">
          <Avatar name={name} image={image} size={72} color="colorful" />
          <div>
            <strong>{name}</strong>
            <span className="muted">{email}</span>
            {role && <Badge appearance="tint" size="small">{role}</Badge>}
            <a href={manageUrl} target="_blank" rel="noreferrer">
              {t('account.manage')} <Open16Regular />
            </a>
          </div>
        </div>
        <button type="button" className="account-card-switch" onClick={closeThen(onSwitchAccount)}>
          <PersonSwap20Regular />
          {t('account.switch')}
        </button>
      </PopoverSurface>
    </Popover>
  )
}
