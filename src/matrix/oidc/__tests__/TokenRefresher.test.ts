/**
 * Unit tests for TokenRefresher class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TokenRefresher } from '../TokenRefresher'
import type { AccessTokens } from 'matrix-js-sdk'
import type { IdTokenClaims } from 'oidc-client-ts'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock console methods to reduce noise in tests
const consoleMock = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}
Object.defineProperty(console, 'log', { value: consoleMock.log })
Object.defineProperty(console, 'error', { value: consoleMock.error })
Object.defineProperty(console, 'warn', { value: consoleMock.warn })

// Mock the parent class method
const mockDoRefreshAccessToken = vi.fn()
vi.mock('matrix-js-sdk', () => ({
  OidcTokenRefresher: class {
    async doRefreshAccessToken (refreshToken: string): Promise<AccessTokens> {
      return mockDoRefreshAccessToken(refreshToken)
    }
  }
}))

describe('TokenRefresher', () => {
  let tokenRefresher: TokenRefresher
  const mockConfig = {
    issuer: 'https://mas.example.com',
    clientId: 'test-client-id',
    redirectUri: 'https://app.example.com/callback',
    deviceId: 'test-device-id',
    userId: '@testuser:example.com'
  }
  const mockIdTokenClaims: IdTokenClaims = {
    iss: mockConfig.issuer,
    sub: 'test-subject',
    aud: mockConfig.clientId,
    exp: Date.now() / 1000 + 3600,
    iat: Date.now() / 1000
  }

  beforeEach(() => {
    vi.clearAllMocks()
    tokenRefresher = new TokenRefresher(
      mockConfig.issuer,
      mockConfig.clientId,
      mockConfig.redirectUri,
      mockConfig.deviceId,
      mockIdTokenClaims,
      mockConfig.userId
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create TokenRefresher with correct configuration', () => {
      expect(tokenRefresher).toBeInstanceOf(TokenRefresher)
      expect(consoleMock.log).toHaveBeenCalledWith(
        '🔧 Creating TokenRefresher with configuration:',
        expect.objectContaining({
          issuer: mockConfig.issuer,
          clientId: mockConfig.clientId,
          redirectUri: mockConfig.redirectUri,
          deviceId: mockConfig.deviceId,
          userId: mockConfig.userId,
          hasIdTokenClaims: true
        })
      )
    })

    it('should log successful creation', () => {
      expect(consoleMock.log).toHaveBeenCalledWith('✅ TokenRefresher created successfully')
    })
  })

  describe('doRefreshAccessToken', () => {
    const mockTokens: AccessTokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    }

    it('should successfully refresh tokens', async () => {
      mockDoRefreshAccessToken.mockResolvedValue(mockTokens)

      const result = await tokenRefresher.doRefreshAccessToken('old-refresh-token')

      expect(result).toEqual(mockTokens)
      expect(mockDoRefreshAccessToken).toHaveBeenCalledWith('old-refresh-token')
      expect(consoleMock.log).toHaveBeenCalledWith(
        '🔄 TokenRefresher.doRefreshAccessToken() called - starting token refresh',
        expect.objectContaining({
          hasRefreshToken: true,
          refreshTokenLength: 'old-refresh-token'.length
        })
      )
      expect(consoleMock.log).toHaveBeenCalledWith(
        '✅ TokenRefresher.doRefreshAccessToken() successful:',
        expect.objectContaining({
          hasAccessToken: true,
          hasRefreshToken: true,
          accessTokenLength: mockTokens.accessToken.length
        })
      )
    })

    it('should handle token refresh errors', async () => {
      const mockError = new Error('Token refresh failed')
      mockDoRefreshAccessToken.mockRejectedValue(mockError)

      await expect(tokenRefresher.doRefreshAccessToken('old-refresh-token')).rejects.toThrow('Token refresh failed')
      expect(consoleMock.error).toHaveBeenCalledWith('❌ TokenRefresher.doRefreshAccessToken() failed:', mockError)
    })

    it('should handle empty refresh token', async () => {
      mockDoRefreshAccessToken.mockResolvedValue(mockTokens)

      await tokenRefresher.doRefreshAccessToken('')

      expect(consoleMock.log).toHaveBeenCalledWith(
        '🔄 TokenRefresher.doRefreshAccessToken() called - starting token refresh',
        expect.objectContaining({
          hasRefreshToken: false,
          refreshTokenLength: 0
        })
      )
    })
  })

  describe('persistTokens', () => {
    const mockTokens: AccessTokens = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token'
    }

    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null)
    })

    it('should persist tokens to localStorage with correct keys', async () => {
      await tokenRefresher.persistTokens(mockTokens)

      const expectedAccessTokenKey = `matrix_access_token_${mockConfig.userId}_${mockConfig.deviceId}`
      const expectedRefreshTokenKey = `matrix_refresh_token_${mockConfig.userId}_${mockConfig.deviceId}`

      expect(localStorageMock.setItem).toHaveBeenCalledWith(expectedAccessTokenKey, mockTokens.accessToken)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(expectedRefreshTokenKey, mockTokens.refreshToken)
      expect(consoleMock.log).toHaveBeenCalledWith('🔑 Persisting refreshed OIDC tokens to storage')
      expect(consoleMock.log).toHaveBeenCalledWith('✅ OIDC tokens persisted successfully')
    })

    it('should handle tokens without refresh token', async () => {
      const tokensWithoutRefresh: AccessTokens = {
        accessToken: 'test-access-token'
      }

      await tokenRefresher.persistTokens(tokensWithoutRefresh)

      const expectedAccessTokenKey = `matrix_access_token_${mockConfig.userId}_${mockConfig.deviceId}`
      expect(localStorageMock.setItem).toHaveBeenCalledWith(expectedAccessTokenKey, tokensWithoutRefresh.accessToken)
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining('matrix_refresh_token'),
        expect.anything()
      )
    })

    it('should update existing matrix credentials', async () => {
      const existingCredentials = {
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
        userId: mockConfig.userId
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingCredentials))

      await tokenRefresher.persistTokens(mockTokens)

      expect(localStorageMock.getItem).toHaveBeenCalledWith('matrix_credentials')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'matrix_credentials',
        expect.stringContaining(mockTokens.accessToken)
      )
      expect(consoleMock.log).toHaveBeenCalledWith('✅ Updated stored Matrix credentials with refreshed tokens')
    })

    it('should handle corrupted stored credentials gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-json')

      await tokenRefresher.persistTokens(mockTokens)

      expect(consoleMock.warn).toHaveBeenCalledWith('⚠️ Failed to update stored credentials:', expect.any(Error))
      // Should still persist individual tokens
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.stringContaining('matrix_access_token'),
        mockTokens.accessToken
      )
    })

    it('should handle localStorage errors', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      await expect(tokenRefresher.persistTokens(mockTokens)).rejects.toThrow('localStorage error')
      expect(consoleMock.error).toHaveBeenCalledWith('❌ Failed to persist OIDC tokens:', expect.any(Error))
    })
  })
})
