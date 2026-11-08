import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'))

// Verifies a Microsoft Entra v2 access token issued for the SyncAI API.
// Multitenant + personal accounts: the issuer depends on the account's tenant, so it is checked against the token's own tid.
export function createTokenVerifier({ clientId, allowedTenants = [] }) {
  return async function verifyToken(token) {
    const { tid } = decodeJwt(token)
    if (!tid) throw new Error('Token has no tenant')
    if (allowedTenants.length && !allowedTenants.includes(tid)) throw new Error('Tenant not allowed')
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://login.microsoftonline.com/${tid}/v2.0`,
      audience: [clientId, `api://${clientId}`],
    })
    return claimsToIdentity(payload)
  }
}

export function claimsToIdentity(claims) {
  if (!claims.tid || !claims.oid) throw new Error('Token is missing tid or oid')
  return {
    tenantId: claims.tid,
    objectId: claims.oid,
    email: (claims.preferred_username || claims.email || '').toLowerCase() || null,
    displayName: claims.name || null,
  }
}
