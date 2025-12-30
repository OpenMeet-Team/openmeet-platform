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
 * Check if a URL's domain is valid for deep link handling.
 *
 * Domain validation is based on APP_CONFIG.APP_VALID_DEEP_LINK_DOMAINS.
 * This is important in Capacitor apps where window.location.origin is
 * 'https://localhost', so we cannot use it for validation.
 *
 * The function matches domains as suffixes, so configuring "openmeet.net"
 * will match "platform.openmeet.net", "platform.dev.openmeet.net", etc.
 *
 * Fallback: If APP_VALID_DEEP_LINK_DOMAINS is not configured, falls back
 * to the domain from APP_API_URL.
 *
 * @param url The URL to check
 * @returns true if the URL's domain is in the allowed list
 */
export function isValidDeepLinkDomain (url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Get allowed domains from config
    const config = window.APP_CONFIG
    if (!config) {
      return false
    }

    let allowedDomains = config.APP_VALID_DEEP_LINK_DOMAINS

    // Fallback to API URL domain if no explicit domains configured
    if (!allowedDomains || allowedDomains.length === 0) {
      if (config.APP_API_URL) {
        try {
          const apiUrl = new URL(config.APP_API_URL)
          allowedDomains = [apiUrl.hostname]
        } catch {
          return false
        }
      } else {
        return false
      }
    }

    // Check if hostname matches any allowed domain
    // Match exact domain or as a subdomain suffix (e.g., "platform.openmeet.net" matches "openmeet.net")
    return allowedDomains.some(domain => {
      const normalizedDomain = domain.toLowerCase()
      return hostname === normalizedDomain ||
             hostname.endsWith('.' + normalizedDomain)
    })
  } catch {
    return false
  }
}
