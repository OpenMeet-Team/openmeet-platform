import { type IdTokenClaims } from 'oidc-client-ts'
import { decodeIdToken } from 'matrix-js-sdk'

const clientIdStorageKey = 'mx_oidc_client_id'
const tokenIssuerStorageKey = 'mx_oidc_token_issuer'
const idTokenStorageKey = 'mx_oidc_id_token'

/**
 * Persists OIDC clientId, issuer, and idToken in localStorage
 * Following Element Web's pattern for OIDC persistence
 * Only set after successful authentication
 */
export const persistOidcAuthenticatedSettings = (clientId: string, issuer: string, idToken: string): void => {
  localStorage.setItem(clientIdStorageKey, clientId)
  localStorage.setItem(tokenIssuerStorageKey, issuer)
  localStorage.setItem(idTokenStorageKey, idToken)
}

/**
 * Retrieve stored OIDC issuer from localStorage
 * When user has token from OIDC issuer, this will be set
 * @returns issuer or undefined
 */
export const getStoredOidcTokenIssuer = (): string | undefined => {
  return localStorage.getItem(tokenIssuerStorageKey) ?? undefined
}

/**
 * Retrieves stored OIDC client id from localStorage
 * @returns clientId or undefined
 */
export const getStoredOidcClientId = (): string | undefined => {
  return localStorage.getItem(clientIdStorageKey) ?? undefined
}

/**
 * Retrieve stored id token claims from stored id token
 * @returns idTokenClaims or undefined
 */
export const getStoredOidcIdTokenClaims = (): IdTokenClaims | undefined => {
  const idToken = getStoredOidcIdToken()
  if (idToken) {
    return decodeIdToken(idToken)
  }
  return undefined
}

/**
 * Retrieve stored id token from localStorage
 * @returns idToken or undefined
 */
export const getStoredOidcIdToken = (): string | undefined => {
  return localStorage.getItem(idTokenStorageKey) ?? undefined
}

/**
 * Clear all stored OIDC settings
 * Used during logout
 */
export const clearStoredOidcSettings = (): void => {
  localStorage.removeItem(clientIdStorageKey)
  localStorage.removeItem(tokenIssuerStorageKey)
  localStorage.removeItem(idTokenStorageKey)
}
