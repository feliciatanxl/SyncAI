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

// Microsoft Graph scopes, asked for one feature at a time (incremental consent) and never at sign-in beyond
// User.Read. Read-only by design: nothing here may end in .ReadWrite, .Send or .default.
export const GRAPH_SCOPES = {
  profile: ['User.Read'],
  calendar: ['Calendars.ReadBasic'],
}

// Returns an access token for Microsoft Graph. This is NOT a SyncAI API token: use getApiToken for Express.
// Silent by default; pass { interactive: true } only from a click handler, which sends the user to Microsoft
// to consent to exactly `scopes`. A silent failure that needs the user is thrown for the caller to explain.
export async function getGraphToken(instance, account, scopes, { interactive = false } = {}) {
  if (!account) throw Object.assign(new Error('No signed-in Microsoft account.'), { errorCode: 'no_account_error' })
  // loginHint keeps the consent screen on the signed-in account rather than offering another one.
  const request = { scopes, account, loginHint: account.username }
  try {
    return (await instance.acquireTokenSilent(request)).accessToken
  } catch (err) {
    const needsUser = err instanceof InteractionRequiredAuthError || NEEDS_REDIRECT.has(err?.errorCode)
    if (needsUser && interactive) await instance.acquireTokenRedirect(request)
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
  const redirectResponse = await instance.handleRedirectPromise().catch(() => null)
  if (redirectResponse?.account) {
    instance.setActiveAccount(redirectResponse.account)
    markSignedIn()
  }
  const [first] = instance.getAllAccounts()
  if (first && !instance.getActiveAccount()) instance.setActiveAccount(first)
  instance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS) {
      const account = event.payload?.account || (event.payload?.homeAccountId ? event.payload : null)
      if (account) {
        instance.setActiveAccount(account)
        markSignedIn()
      }
    }
  })
  return instance
}

// A real Microsoft sign-in just finished: the next load of the signed-in area records it once (see takeSignedIn).
const SIGNED_IN = 'syncai.justSignedIn'
export function clearSignedIn() {
  try { sessionStorage.removeItem(SIGNED_IN) } catch {}
}
export function markSignedIn() {
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

// Consent sends the browser to Microsoft and back, which resets the portal to Overview. The section that asked
// is remembered for that one round trip so the person lands where they clicked Connect.
const RETURN_SECTION = 'syncai.returnSection'
export function markReturnSection(section) {
  try { sessionStorage.setItem(RETURN_SECTION, section) } catch { /* storage blocked: they land on Overview */ }
}
export function returnSection(fallback) {
  try { return sessionStorage.getItem(RETURN_SECTION) || fallback } catch { return fallback }
}
export function clearReturnSection() {
  try { sessionStorage.removeItem(RETURN_SECTION) } catch {}
}
