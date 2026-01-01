import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseDeepLink,
  isValidDeepLinkDomain
} from '../../../../src/utils/deepLinkHandler'

/**
 * Test for deep link handling utility.
 *
 * This utility parses OAuth callback URLs from deep links
 * and extracts the route path and query parameters needed
 * to navigate the Vue Router to the appropriate callback page.
 *
 * Note: Tests are domain-agnostic to support multi-tenant deployments.
 */

describe('parseDeepLink', () => {
  describe('OAuth callback URLs', () => {
    it('should parse Google OAuth callback URL', () => {
      const url = 'https://platform.example.com/auth/google/callback?code=4/0abc123&state=xyz789'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.path).toBe('/auth/google/callback')
      expect(result?.query.code).toBe('4/0abc123')
      expect(result?.query.state).toBe('xyz789')
    })

    it('should parse GitHub OAuth callback URL', () => {
      const url = 'https://platform.example.com/auth/github/callback?code=abc123def456&state=randomstate'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.path).toBe('/auth/github/callback')
      expect(result?.query.code).toBe('abc123def456')
      expect(result?.query.state).toBe('randomstate')
    })

    it('should parse Bluesky OAuth callback URL', () => {
      const url = 'https://platform.example.com/auth/bluesky/callback?state=session123&code=authcode456'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.path).toBe('/auth/bluesky/callback')
      expect(result?.query.state).toBe('session123')
      expect(result?.query.code).toBe('authcode456')
    })

    it('should parse OAuth error callback', () => {
      const url = 'https://platform.example.com/auth/google/callback?error=access_denied&error_description=User%20denied'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.path).toBe('/auth/google/callback')
      expect(result?.query.error).toBe('access_denied')
      expect(result?.query.error_description).toBe('User denied')
    })
  })

  describe('any domain (multi-tenant support)', () => {
    it('should parse URLs from any domain', () => {
      const url1 = 'https://mycompany.com/auth/google/callback?code=abc123'
      const url2 = 'https://events.nonprofit.org/auth/bluesky/callback?code=xyz789'
      const url3 = 'https://community.startup.io/auth/github/callback?code=def456'

      expect(parseDeepLink(url1)?.path).toBe('/auth/google/callback')
      expect(parseDeepLink(url2)?.path).toBe('/auth/bluesky/callback')
      expect(parseDeepLink(url3)?.path).toBe('/auth/github/callback')
    })
  })

  describe('edge cases', () => {
    it('should return null for invalid URL', () => {
      const result = parseDeepLink('not-a-valid-url')

      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = parseDeepLink('')

      expect(result).toBeNull()
    })

    it('should handle callback URL with no query parameters', () => {
      const url = 'https://platform.example.com/auth/google/callback'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.path).toBe('/auth/google/callback')
      expect(Object.keys(result?.query || {})).toHaveLength(0)
    })

    it('should handle complex query parameters with special characters', () => {
      const url = 'https://platform.example.com/auth/callback?redirect=https%3A%2F%2Fexample.com%2Fpath&token=abc%3D%3D'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.query.redirect).toBe('https://example.com/path')
      expect(result?.query.token).toBe('abc==')
    })
  })

  describe('non-auth paths', () => {
    it('should parse regular app deep links', () => {
      const url = 'https://platform.example.com/events/my-cool-event'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.path).toBe('/events/my-cool-event')
    })

    it('should parse group deep links', () => {
      const url = 'https://platform.example.com/groups/my-group?tab=events'

      const result = parseDeepLink(url)

      expect(result).not.toBeNull()
      expect(result?.path).toBe('/groups/my-group')
      expect(result?.query.tab).toBe('events')
    })
  })
})

describe('parseDeepLink with custom URL scheme', () => {
  it('should parse custom scheme OAuth callback URL with single slash', () => {
    const result = parseDeepLink('net.openmeet.platform:/auth/google/callback?token=abc123')

    expect(result).not.toBeNull()
    expect(result?.path).toBe('/auth/google/callback')
    expect(result?.query.token).toBe('abc123')
  })

  it('should parse custom scheme OAuth callback URL with double slash', () => {
    const result = parseDeepLink('net.openmeet.platform://auth/google/callback?token=abc123')

    expect(result).not.toBeNull()
    expect(result?.path).toBe('/auth/google/callback')
    expect(result?.query.token).toBe('abc123')
  })

  it('should parse GitHub OAuth callback with custom scheme', () => {
    const result = parseDeepLink('net.openmeet.platform:/auth/github/callback?code=ghcode&state=xyz')

    expect(result).not.toBeNull()
    expect(result?.path).toBe('/auth/github/callback')
    expect(result?.query.code).toBe('ghcode')
    expect(result?.query.state).toBe('xyz')
  })

  it('should parse Bluesky OAuth callback with custom scheme', () => {
    const result = parseDeepLink('net.openmeet.platform:/auth/bluesky/callback?code=bskycode&state=abc')

    expect(result).not.toBeNull()
    expect(result?.path).toBe('/auth/bluesky/callback')
    expect(result?.query.code).toBe('bskycode')
    expect(result?.query.state).toBe('abc')
  })
})

describe('isValidDeepLinkDomain', () => {
  // Store original APP_CONFIG
  const originalAppConfig = window.APP_CONFIG

  beforeEach(() => {
    // Reset APP_CONFIG for each test
    window.APP_CONFIG = undefined
  })

  afterEach(() => {
    // Restore original config
    window.APP_CONFIG = originalAppConfig
  })

  describe('with APP_VALID_DEEP_LINK_DOMAINS configured', () => {
    it('should return true when URL matches configured domain exactly', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['example.com']
      }

      expect(isValidDeepLinkDomain('https://example.com/auth/callback')).toBe(true)
    })

    it('should return true when URL is a subdomain of configured domain', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net']
      }

      // Should match subdomains like platform.openmeet.net, platform.dev.openmeet.net
      expect(isValidDeepLinkDomain('https://platform.openmeet.net/auth/callback')).toBe(true)
      expect(isValidDeepLinkDomain('https://platform.dev.openmeet.net/auth/callback')).toBe(true)
      expect(isValidDeepLinkDomain('https://api.openmeet.net/auth/callback')).toBe(true)
    })

    it('should return true when URL matches any of multiple configured domains', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net', 'mycompany.com']
      }

      expect(isValidDeepLinkDomain('https://platform.openmeet.net/auth/callback')).toBe(true)
      expect(isValidDeepLinkDomain('https://events.mycompany.com/auth/callback')).toBe(true)
    })

    it('should return false when URL does not match any configured domain', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net']
      }

      expect(isValidDeepLinkDomain('https://evil.com/auth/callback')).toBe(false)
      expect(isValidDeepLinkDomain('https://openmeet.net.evil.com/auth/callback')).toBe(false)
    })

    it('should not match partial domain names (security)', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net']
      }

      // Should NOT match 'fakeopenmeet.net' - domain must end with '.openmeet.net' or be exactly 'openmeet.net'
      expect(isValidDeepLinkDomain('https://fakeopenmeet.net/auth/callback')).toBe(false)
      expect(isValidDeepLinkDomain('https://not-openmeet.net/auth/callback')).toBe(false)
    })
  })

  describe('fallback to APP_API_URL when no domains configured', () => {
    it('should use domain from APP_API_URL as fallback', () => {
      window.APP_CONFIG = {
        APP_API_URL: 'https://api.openmeet.net'
      }

      // Should accept the API domain
      expect(isValidDeepLinkDomain('https://api.openmeet.net/auth/callback')).toBe(true)
    })

    it('should reject URLs from other domains when using API URL fallback', () => {
      window.APP_CONFIG = {
        APP_API_URL: 'https://api.openmeet.net'
      }

      expect(isValidDeepLinkDomain('https://evil.com/auth/callback')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should return false when no config is available', () => {
      window.APP_CONFIG = undefined

      expect(isValidDeepLinkDomain('https://example.com/auth/callback')).toBe(false)
    })

    it('should return false for invalid URLs', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net']
      }

      expect(isValidDeepLinkDomain('not-a-url')).toBe(false)
      expect(isValidDeepLinkDomain('')).toBe(false)
    })

    it('should be case-insensitive for hostname comparison', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net']
      }

      // URL parsing normalizes hostnames to lowercase
      expect(isValidDeepLinkDomain('https://PLATFORM.OPENMEET.NET/events')).toBe(true)
    })

    it('should handle empty domains array', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: []
      }

      expect(isValidDeepLinkDomain('https://example.com/auth/callback')).toBe(false)
    })
  })

  describe('custom URL scheme (OAuth mobile)', () => {
    it('should return true for custom scheme URLs with single slash', () => {
      // Custom scheme should be accepted when configured
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net'],
        APP_CUSTOM_URL_SCHEME: 'net.openmeet.platform'
      }

      expect(isValidDeepLinkDomain('net.openmeet.platform:/auth/google/callback?token=abc')).toBe(true)
      expect(isValidDeepLinkDomain('net.openmeet.platform:/auth/github/callback?token=abc')).toBe(true)
      expect(isValidDeepLinkDomain('net.openmeet.platform:/auth/bluesky/callback?token=abc')).toBe(true)
    })

    it('should return true for custom scheme URLs with double slash', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net'],
        APP_CUSTOM_URL_SCHEME: 'net.openmeet.platform'
      }

      expect(isValidDeepLinkDomain('net.openmeet.platform://auth/google/callback?token=abc')).toBe(true)
    })

    it('should return false for custom scheme when not configured', () => {
      // Custom scheme should NOT be accepted if not configured (security)
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net']
        // No APP_CUSTOM_URL_SCHEME configured
      }

      expect(isValidDeepLinkDomain('net.openmeet.platform:/auth/callback?token=abc')).toBe(false)
    })

    it('should reject other custom schemes (security)', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net'],
        APP_CUSTOM_URL_SCHEME: 'net.openmeet.platform'
      }

      expect(isValidDeepLinkDomain('malicious.scheme:/auth/callback?token=abc')).toBe(false)
      expect(isValidDeepLinkDomain('net.openmeet.platform.fake:/auth/callback')).toBe(false)
      expect(isValidDeepLinkDomain('com.openmeet.platform:/auth/callback')).toBe(false)
    })

    it('should reject variations of the custom scheme (security)', () => {
      window.APP_CONFIG = {
        APP_VALID_DEEP_LINK_DOMAINS: ['openmeet.net'],
        APP_CUSTOM_URL_SCHEME: 'net.openmeet.platform'
      }

      // Must be exactly net.openmeet.platform, not variations
      expect(isValidDeepLinkDomain('net.openmeet.platforms:/auth/callback')).toBe(false)
      expect(isValidDeepLinkDomain('xnet.openmeet.platform:/auth/callback')).toBe(false)
    })

    it('should work with different custom schemes for other deployments', () => {
      // Configurable for multi-tenant/forked deployments
      window.APP_CONFIG = {
        APP_CUSTOM_URL_SCHEME: 'com.mycompany.events'
      }

      expect(isValidDeepLinkDomain('com.mycompany.events:/auth/callback?token=abc')).toBe(true)
      expect(isValidDeepLinkDomain('net.openmeet.platform:/auth/callback?token=abc')).toBe(false)
    })
  })
})
