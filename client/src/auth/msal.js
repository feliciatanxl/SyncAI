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

// The signed-in person's Microsoft profile photo as an object URL, or null when they have none or Microsoft
// won't share it. Uses the User.Read consent from sign-in and never redirects: initials are a fine fallback.
export async function getProfilePhoto(instance, account) {
  try {
    const { accessToken } = await instance.acquireTokenSilent({ scopes: ['User.Read'], account })
    const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', { headers: { Authorization: `Bearer ${accessToken}` } })
    return res.ok ? URL.createObjectURL(await res.blob()) : null
  } catch {
    return null
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
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
      instance.setActiveAccount(event.payload.account)
      markSignedIn()
    }
  })
  return instance
}

// A real Microsoft sign-in just finished: the next load of the signed-in area records it once (see takeSignedIn).
const SIGNED_IN = 'syncai.justSignedIn'
function markSignedIn() {
  try { sessionStorage.setItem(SIGNED_IN, '1') } catch { /* storage blocked: the visit is recorded as an open instead */ }
}
export function takeSignedIn() {
  try {
    const value = sessionStorage.getItem(SIGNED_IN)
    sessionStorage.removeItem(SIGNED_IN)
    return value === '1'
  } catch {
    return false
  }
}
