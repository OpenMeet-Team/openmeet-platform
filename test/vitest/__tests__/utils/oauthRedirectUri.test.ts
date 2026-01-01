import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildOAuthRedirectUri, buildOAuthState, isNativePlatform } from '../../../../src/utils/oauthRedirectUri'

// Mock @capacitor/core
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn()
  }
}))

// Mock env utility
vi.mock('../../../../src/utils/env', () => ({
  default: vi.fn()
}))

import { Capacitor } from '@capacitor/core'
import getEnv from '../../../../src/utils/env'

describe('oauthRedirectUri', () => {
  const mockGetEnv = getEnv as ReturnType<typeof vi.fn>
  const mockIsNativePlatform = Capacitor.isNativePlatform as ReturnType<typeof vi.fn>
  const mockGetPlatform = Capacitor.getPlatform as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to web platform
    mockIsNativePlatform.mockReturnValue(false)
    mockGetPlatform.mockReturnValue('web')
    mockGetEnv.mockImplementation((key: string) => {
      if (key === 'APP_API_URL') return 'https://api.openmeet.net'
      if (key === 'APP_TENANT_ID') return 'test-tenant-id'
      return undefined
    })
  })

  describe('buildOAuthRedirectUri', () => {
    it('should always return API callback URL for Google', () => {
      const result = buildOAuthRedirectUri('google')

      expect(result).toBe('https://api.openmeet.net/api/v1/auth/google/callback')
    })

    it('should always return API callback URL for GitHub', () => {
      const result = buildOAuthRedirectUri('github')

      expect(result).toBe('https://api.openmeet.net/api/v1/auth/github/callback')
    })

    it('should always return API callback URL for Bluesky', () => {
      const result = buildOAuthRedirectUri('bluesky')

      expect(result).toBe('https://api.openmeet.net/api/v1/auth/bluesky/callback')
    })

    it('should not include query params in URL (tenantId/platform go in state)', () => {
      const result = buildOAuthRedirectUri('google')

      expect(result).not.toContain('?')
      expect(result).not.toContain('tenantId')
      expect(result).not.toContain('platform=')
    })

    it('should use API URL from config', () => {
      mockGetEnv.mockImplementation((key: string) => {
        if (key === 'APP_API_URL') return 'https://api.dev.openmeet.net'
        return undefined
      })

      const result = buildOAuthRedirectUri('google')

      expect(result).toBe('https://api.dev.openmeet.net/api/v1/auth/google/callback')
    })

    it('should return same URL regardless of platform (web)', () => {
      mockIsNativePlatform.mockReturnValue(false)

      const result = buildOAuthRedirectUri('google')

      expect(result).toBe('https://api.openmeet.net/api/v1/auth/google/callback')
    })

    it('should return same URL regardless of platform (android)', () => {
      mockIsNativePlatform.mockReturnValue(true)
      mockGetPlatform.mockReturnValue('android')

      const result = buildOAuthRedirectUri('google')

      expect(result).toBe('https://api.openmeet.net/api/v1/auth/google/callback')
    })

    it('should return same URL regardless of platform (ios)', () => {
      mockIsNativePlatform.mockReturnValue(true)
      mockGetPlatform.mockReturnValue('ios')

      const result = buildOAuthRedirectUri('google')

      expect(result).toBe('https://api.openmeet.net/api/v1/auth/google/callback')
    })
  })

  describe('buildOAuthState', () => {
    it('should return base64-encoded JSON with tenantId and platform', () => {
      mockIsNativePlatform.mockReturnValue(false)
      mockGetPlatform.mockReturnValue('web')

      const result = buildOAuthState()
      const decoded = JSON.parse(atob(result))

      expect(decoded.tenantId).toBe('test-tenant-id')
      expect(decoded.platform).toBe('web')
      expect(decoded.nonce).toBeDefined()
    })

    it('should include platform=android on Android', () => {
      mockIsNativePlatform.mockReturnValue(true)
      mockGetPlatform.mockReturnValue('android')

      const result = buildOAuthState()
      const decoded = JSON.parse(atob(result))

      expect(decoded.platform).toBe('android')
    })

    it('should include platform=ios on iOS', () => {
      mockIsNativePlatform.mockReturnValue(true)
      mockGetPlatform.mockReturnValue('ios')

      const result = buildOAuthState()
      const decoded = JSON.parse(atob(result))

      expect(decoded.platform).toBe('ios')
    })

    it('should generate unique nonce each time', () => {
      const result1 = buildOAuthState()
      const result2 = buildOAuthState()

      const decoded1 = JSON.parse(atob(result1))
      const decoded2 = JSON.parse(atob(result2))

      expect(decoded1.nonce).not.toBe(decoded2.nonce)
    })
  })

  describe('isNativePlatform', () => {
    it('should return true when Capacitor reports native platform', () => {
      mockIsNativePlatform.mockReturnValue(true)

      expect(isNativePlatform()).toBe(true)
    })

    it('should return false when Capacitor reports web platform', () => {
      mockIsNativePlatform.mockReturnValue(false)

      expect(isNativePlatform()).toBe(false)
    })
  })
})
