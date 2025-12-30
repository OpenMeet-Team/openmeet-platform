import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseDeepLink,
  isOAuthCallbackPath,
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

describe('isOAuthCallbackPath', () => {
  it('should return true for Google OAuth callback', () => {
    expect(isOAuthCallbackPath('/auth/google/callback')).toBe(true)
  })

  it('should return true for GitHub OAuth callback', () => {
    expect(isOAuthCallbackPath('/auth/github/callback')).toBe(true)
  })

  it('should return true for Bluesky OAuth callback', () => {
    expect(isOAuthCallbackPath('/auth/bluesky/callback')).toBe(true)
  })

  it('should return true for Matrix callback', () => {
    expect(isOAuthCallbackPath('/auth/matrix/callback')).toBe(true)
  })

  it('should return true for Calendar callback', () => {
    expect(isOAuthCallbackPath('/auth/calendar/callback')).toBe(true)
  })

  it('should return false for non-OAuth paths', () => {
    expect(isOAuthCallbackPath('/events')).toBe(false)
    expect(isOAuthCallbackPath('/auth/login')).toBe(false)
    expect(isOAuthCallbackPath('/groups/my-group')).toBe(false)
  })
})

describe('isValidDeepLinkDomain', () => {
  // Mock window.location for these tests
  const originalLocation = window.location

  beforeEach(() => {
    // Reset to a known state
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://platform.example.com' },
      writable: true
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true
    })
  })

  it('should return true when URL matches current app domain', () => {
    expect(isValidDeepLinkDomain('https://platform.example.com/events')).toBe(true)
    expect(isValidDeepLinkDomain('https://platform.example.com/auth/google/callback')).toBe(true)
  })

  it('should return false when URL does not match current app domain', () => {
    expect(isValidDeepLinkDomain('https://other-site.com/events')).toBe(false)
    expect(isValidDeepLinkDomain('https://evil.com/callback')).toBe(false)
  })

  it('should work with different tenant domains', () => {
    // Simulate a different tenant
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://events.mycompany.com' },
      writable: true
    })

    expect(isValidDeepLinkDomain('https://events.mycompany.com/auth/callback')).toBe(true)
    expect(isValidDeepLinkDomain('https://platform.openmeet.net/auth/callback')).toBe(false)
  })

  it('should return false for invalid URLs', () => {
    expect(isValidDeepLinkDomain('not-a-url')).toBe(false)
    expect(isValidDeepLinkDomain('')).toBe(false)
  })

  it('should be case-insensitive for hostname comparison', () => {
    // Note: URL parsing normalizes hostnames to lowercase
    expect(isValidDeepLinkDomain('https://PLATFORM.EXAMPLE.COM/events')).toBe(true)
  })
})
