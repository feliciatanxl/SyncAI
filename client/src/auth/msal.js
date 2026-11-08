import { EventType, InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser'

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

// The scope exposed under "Expose an API" in the app registration. Tokens for it are what the Express API accepts.
const apiScope = env.VITE_API_SCOPE || `api://${clientId}/access_as_user`

// Returns an access token for the SyncAI API, sending the user to Microsoft only if consent or sign-in is needed.
export async function getApiToken(instance, account) {
  const request = { scopes: [apiScope], account }
  try {
    return (await instance.acquireTokenSilent(request)).accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) await instance.acquireTokenRedirect(request)
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
