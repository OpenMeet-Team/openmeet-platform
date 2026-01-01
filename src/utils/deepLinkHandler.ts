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
 * - Android: Uses App Links (verified HTTPS URLs) or custom URL scheme
 * - iOS: Uses Universal Links (associated domains) or custom URL scheme
 * Both platforms use the same @capacitor/app 'appUrlOpen' event
 *
 * Custom URL Scheme:
 * For OAuth callbacks on mobile, browsers cannot intercept HTTPS redirects within the
 * same session. Custom URL schemes (e.g., net.openmeet.platform:/) allow the browser
 * to hand control back to the app. Configure via APP_CUSTOM_URL_SCHEME in config.json.
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
 * Check if a URL uses a custom URL scheme (non-HTTP/HTTPS protocol).
 * @param url The URL to check
 * @returns true if the URL uses a custom scheme
 */
function isCustomSchemeUrl (url: string): boolean {
  try {
    const parsed = new URL(url)
    return !parsed.protocol.startsWith('http')
  } catch {
    return false
  }
}

/**
 * Get the custom URL scheme from the URL's protocol.
 * Strips the trailing colon (e.g., "net.openmeet.platform:" -> "net.openmeet.platform")
 * @param url The URL to extract scheme from
 * @returns The scheme without the colon, or null if URL is invalid
 */
function getUrlScheme (url: string): string | null {
  try {
    const parsed = new URL(url)
    // Remove trailing colon from protocol
    return parsed.protocol.slice(0, -1)
  } catch {
    return null
  }
}

/**
 * Parse a deep link URL and extract the path and query parameters.
 *
 * Handles both HTTPS URLs and custom scheme URLs:
 * - https://example.com/auth/callback -> path: /auth/callback
 * - myapp:/auth/callback -> path: /auth/callback
 * - myapp://auth/callback -> path: /auth/callback (hostname becomes part of path)
 *
 * @param url The full URL to parse (e.g., https://platform.example.com/auth/google/callback?code=abc)
 * @returns The parsed path and query, or null if the URL is invalid
 *
 * @example
 * parseDeepLink('https://platform.example.com/auth/google/callback?code=abc123')
 * // Returns: { path: '/auth/google/callback', query: { code: 'abc123' } }
 *
 * parseDeepLink('net.openmeet.platform:/auth/google/callback?token=abc')
 * // Returns: { path: '/auth/google/callback', query: { token: 'abc' } }
 */
export function parseDeepLink (url: string): DeepLinkResult | null {
  try {
    const parsed = new URL(url)

    let path: string

    // For custom scheme URLs with double-slash (scheme://path), the URL parser
    // treats the first segment as hostname. We need to reconstruct the full path.
    // Example: "myapp://auth/callback" -> hostname="auth", pathname="/callback"
    // We want: "/auth/callback"
    if (isCustomSchemeUrl(url) && parsed.hostname) {
      // Reconstruct path by prepending hostname
      path = '/' + parsed.hostname + parsed.pathname
    } else {
      path = parsed.pathname
    }

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
 * Check if a URL's domain or scheme is valid for deep link handling.
 *
 * For HTTPS URLs:
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
 * For custom URL schemes:
 * Validates that the URL scheme matches APP_CONFIG.APP_CUSTOM_URL_SCHEME exactly.
 * This is used for mobile OAuth callbacks where browsers cannot intercept
 * HTTPS redirects within the same session.
 *
 * @param url The URL to check
 * @returns true if the URL's domain is in the allowed list, or uses the configured custom scheme
 */
export function isValidDeepLinkDomain (url: string): boolean {
  try {
    const parsed = new URL(url)

    // Get config
    const config = window.APP_CONFIG
    if (!config) {
      return false
    }

    // Check for custom URL scheme first
    if (isCustomSchemeUrl(url)) {
      const scheme = getUrlScheme(url)
      const configuredScheme = config.APP_CUSTOM_URL_SCHEME

      // Custom scheme must be configured and must match exactly
      if (!configuredScheme || !scheme) {
        return false
      }

      return scheme === configuredScheme
    }

    // For HTTPS URLs, check domain
    const hostname = parsed.hostname.toLowerCase()

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
