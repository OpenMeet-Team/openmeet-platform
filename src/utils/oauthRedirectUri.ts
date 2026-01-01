import { Capacitor } from '@capacitor/core'
import getEnv from './env'

export type OAuthProvider = 'google' | 'github' | 'bluesky'

export interface OAuthStateData {
  tenantId: string
  platform: 'android' | 'ios' | 'web'
  nonce: string // For CSRF protection
}

/**
 * Builds the OAuth redirect URI - always uses API callback.
 *
 * Both web and mobile use the API callback URL. The API handles the OAuth
 * code exchange and redirects based on the platform in the state parameter:
 * - Web: redirects to frontend URL with tokens
 * - Mobile: redirects to custom URL scheme (net.openmeet.platform://)
 *
 * This allows using a single callback URL for all platforms, which is
 * required for providers like GitHub that only allow one callback URL.
 *
 * @param provider - The OAuth provider (google, github, bluesky)
 * @returns The API callback URL (no query params - tenantId/platform go in state)
 */
export function buildOAuthRedirectUri (provider: OAuthProvider): string {
  const apiUrl = getEnv('APP_API_URL') as string
  return `${apiUrl}/api/v1/auth/${provider}/callback`
}

/**
 * Builds the OAuth state parameter with encoded tenantId and platform.
 * This is used because redirect_uri must be an exact match (no query params).
 *
 * @returns Base64-encoded state string containing tenantId, platform, and nonce
 */
export function buildOAuthState (): string {
  const isNative = Capacitor.isNativePlatform()
  const tenantId = getEnv('APP_TENANT_ID') as string || ''
  const platform = isNative ? Capacitor.getPlatform() as 'android' | 'ios' : 'web'

  // Generate random nonce for CSRF protection
  const nonce = Math.random().toString(36).substring(2, 15)

  const stateData: OAuthStateData = {
    tenantId,
    platform,
    nonce
  }

  // Encode as base64 for URL safety
  return btoa(JSON.stringify(stateData))
}

/**
 * Check if we're on a native mobile platform
 */
export function isNativePlatform (): boolean {
  return Capacitor.isNativePlatform()
}
