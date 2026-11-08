import { EventType, InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser'

const env = import.meta.env
const clientId = env.VITE_ENTRA_CLIENT_ID
const tenantId = env.VITE_ENTRA_TENANT_ID

// Without an app registration the site still runs; the sign-in button explains what is missing.
export const authConfigured = Boolean(clientId && tenantId)

// The scope exposed under "Expose an API" in the app registration. Tokens for it are what the Express API accepts.
const apiScope = env.VITE_API_SCOPE || `api://${clientId}/access_as_user`

// Scopes for the sign-in itself. Consent to the API scope is asked for up front, so later token requests stay silent.
export const loginRequest = {
  scopes: ['openid', 'profile', 'User.Read'],
  extraScopesToConsent: [apiScope],
  prompt: 'select_account',
}

// Silent attempts that fail this way need the user at Microsoft. Personal accounts' sign-in page refuses to load
// in MSAL's hidden iframe, which surfaces as a timeout rather than an interaction-required error.
const NEEDS_REDIRECT = new Set(['timed_out', 'monitor_window_timeout'])

// Returns an access token for the SyncAI API, sending the user to Microsoft only if consent or sign-in is needed.
export async function getApiToken(instance, account) {
  const request = { scopes: [apiScope], account }
  try {
    return (await instance.acquireTokenSilent(request)).accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError || NEEDS_REDIRECT.has(err?.errorCode)) await instance.acquireTokenRedirect(request)
    throw err
  }
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
