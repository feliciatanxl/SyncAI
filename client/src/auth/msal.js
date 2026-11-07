import { EventType, PublicClientApplication } from '@azure/msal-browser'

const env = import.meta.env
const clientId = env.VITE_ENTRA_CLIENT_ID
const tenantId = env.VITE_ENTRA_TENANT_ID

// Without an app registration the site still runs; the sign-in button explains what is missing.
export const authConfigured = Boolean(clientId && tenantId)

// Scopes for the sign-in itself. The API scope is added once the Express API is registered.
export const loginRequest = {
  scopes: ['openid', 'profile', 'User.Read'],
  prompt: 'select_account',
}

export async function createMsalInstance() {
  if (!authConfigured) return null
  const instance = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: env.VITE_ENTRA_REDIRECT_URI || `${window.location.origin}/login`,
      postLogoutRedirectUri: `${window.location.origin}/`,
    },
    cache: { cacheLocation: 'sessionStorage' },
  })
  await instance.initialize()
  const [first] = instance.getAllAccounts()
  if (first && !instance.getActiveAccount()) instance.setActiveAccount(first)
  instance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) instance.setActiveAccount(event.payload.account)
  })
  return instance
}
