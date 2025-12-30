/**
 * Deep Link Handler Utility
 *
 * Parses deep link URLs (from Android App Links, iOS Universal Links, or custom schemes)
 * and extracts the route path and query parameters for Vue Router navigation.
 *
 * This is used by the Capacitor boot file to handle OAuth callback URLs
 * and other deep links in the native Android and iOS apps.
 *
 * Platform support:
 * - Android: Uses App Links (verified HTTPS URLs)
 * - iOS: Uses Universal Links (associated domains)
 * Both platforms use the same @capacitor/app 'appUrlOpen' event
 *
 * Note: This utility is domain-agnostic to support multi-tenant deployments
 * where users may have their own custom domains.
 *
 * @see https://capacitorjs.com/docs/guides/deep-links
 */

export interface DeepLinkResult {
  path: string
  query: Record<string, string>
}

/**
 * Parse a deep link URL and extract the path and query parameters.
 *
 * @param url The full URL to parse (e.g., https://platform.example.com/auth/google/callback?code=abc)
 * @returns The parsed path and query, or null if the URL is invalid
 *
 * @example
 * parseDeepLink('https://platform.example.com/auth/google/callback?code=abc123')
 * // Returns: { path: '/auth/google/callback', query: { code: 'abc123' } }
 */
export function parseDeepLink (url: string): DeepLinkResult | null {
  try {
    const parsed = new URL(url)

    // Extract the path
    const path = parsed.pathname

    // Convert URLSearchParams to object
    const query: Record<string, string> = {}
    parsed.searchParams.forEach((value, key) => {
      query[key] = value
    })

    return { path, query }
  } catch {
    return null
  }
}

/**
 * Check if a URL path is an OAuth callback route.
 *
 * @param path The URL path to check
 * @returns true if the path is an OAuth callback route
 */
export function isOAuthCallbackPath (path: string): boolean {
  const oauthCallbackPaths = [
    '/auth/google/callback',
    '/auth/github/callback',
    '/auth/bluesky/callback',
    '/auth/matrix/callback',
    '/auth/calendar/callback'
  ]

  return oauthCallbackPaths.includes(path)
}

/**
 * Check if a URL matches the current app's domain.
 *
 * This is domain-agnostic to support multi-tenant deployments where
 * users may have their own custom domains. We validate against
 * window.location.origin to ensure the deep link is for this app instance.
 *
 * @param url The URL to check
 * @returns true if the URL matches the current app's domain
 */
export function isValidDeepLinkDomain (url: string): boolean {
  try {
    const parsed = new URL(url)
    const currentOrigin = new URL(window.location.origin)

    // Match if the hostname matches the current app's hostname
    return parsed.hostname === currentOrigin.hostname
  } catch {
    return false
  }
}
