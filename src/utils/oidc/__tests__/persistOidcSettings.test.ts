/**
 * Unit tests for OIDC persistence utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  persistOidcAuthenticatedSettings,
  getStoredOidcTokenIssuer,
  getStoredOidcClientId,
  getStoredOidcIdTokenClaims,
  getStoredOidcIdToken,
  clearStoredOidcSettings
} from '../persistOidcSettings'
import type { IdTokenClaims } from 'oidc-client-ts'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock matrix-js-sdk decodeIdToken function
const mockDecodeIdToken = vi.fn()
vi.mock('matrix-js-sdk', () => ({
  decodeIdToken: mockDecodeIdToken
}))

describe('OIDC Persistence Utilities', () => {
  const mockOidcData = {
    clientId: 'test-client-id',
    issuer: 'https://mas.example.com',
    idToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  }

  const mockIdTokenClaims: IdTokenClaims = {
    iss: mockOidcData.issuer,
    sub: 'test-subject',
    aud: mockOidcData.clientId,
    exp: Date.now() / 1000 + 3600,
    iat: Date.now() / 1000
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('persistOidcAuthenticatedSettings', () => {
    it('should store all OIDC settings in localStorage', () => {
      persistOidcAuthenticatedSettings(mockOidcData.clientId, mockOidcData.issuer, mockOidcData.idToken)

      expect(localStorageMock.setItem).toHaveBeenCalledWith('mx_oidc_client_id', mockOidcData.clientId)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('mx_oidc_token_issuer', mockOidcData.issuer)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('mx_oidc_id_token', mockOidcData.idToken)
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(3)
    })

    it('should handle empty string values', () => {
      persistOidcAuthenticatedSettings('', '', '')

      expect(localStorageMock.setItem).toHaveBeenCalledWith('mx_oidc_client_id', '')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('mx_oidc_token_issuer', '')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('mx_oidc_id_token', '')
    })
  })

  describe('getStoredOidcTokenIssuer', () => {
    it('should return stored issuer when available', () => {
      localStorageMock.getItem.mockReturnValue(mockOidcData.issuer)

      const result = getStoredOidcTokenIssuer()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_token_issuer')
      expect(result).toBe(mockOidcData.issuer)
    })

    it('should return undefined when issuer is not stored', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = getStoredOidcTokenIssuer()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_token_issuer')
      expect(result).toBeUndefined()
    })

    it('should return undefined when localStorage returns empty string', () => {
      localStorageMock.getItem.mockReturnValue('')

      const result = getStoredOidcTokenIssuer()

      expect(result).toBeUndefined()
    })
  })

  describe('getStoredOidcClientId', () => {
    it('should return stored client ID when available', () => {
      localStorageMock.getItem.mockReturnValue(mockOidcData.clientId)

      const result = getStoredOidcClientId()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_client_id')
      expect(result).toBe(mockOidcData.clientId)
    })

    it('should return undefined when client ID is not stored', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = getStoredOidcClientId()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_client_id')
      expect(result).toBeUndefined()
    })
  })

  describe('getStoredOidcIdToken', () => {
    it('should return stored ID token when available', () => {
      localStorageMock.getItem.mockReturnValue(mockOidcData.idToken)

      const result = getStoredOidcIdToken()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_id_token')
      expect(result).toBe(mockOidcData.idToken)
    })

    it('should return undefined when ID token is not stored', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = getStoredOidcIdToken()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_id_token')
      expect(result).toBeUndefined()
    })
  })

  describe('getStoredOidcIdTokenClaims', () => {
    it('should return decoded ID token claims when token is available', () => {
      localStorageMock.getItem.mockReturnValue(mockOidcData.idToken)
      mockDecodeIdToken.mockReturnValue(mockIdTokenClaims)

      const result = getStoredOidcIdTokenClaims()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_id_token')
      expect(mockDecodeIdToken).toHaveBeenCalledWith(mockOidcData.idToken)
      expect(result).toEqual(mockIdTokenClaims)
    })

    it('should return undefined when ID token is not stored', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = getStoredOidcIdTokenClaims()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('mx_oidc_id_token')
      expect(mockDecodeIdToken).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should handle decoding errors gracefully', () => {
      localStorageMock.getItem.mockReturnValue(mockOidcData.idToken)
      mockDecodeIdToken.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      expect(() => getStoredOidcIdTokenClaims()).toThrow('Invalid token')
      expect(mockDecodeIdToken).toHaveBeenCalledWith(mockOidcData.idToken)
    })

    it('should return undefined when stored token is empty string', () => {
      localStorageMock.getItem.mockReturnValue('')

      const result = getStoredOidcIdTokenClaims()

      expect(result).toBeUndefined()
      expect(mockDecodeIdToken).not.toHaveBeenCalled()
    })
  })

  describe('clearStoredOidcSettings', () => {
    it('should remove all OIDC settings from localStorage', () => {
      clearStoredOidcSettings()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('mx_oidc_client_id')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('mx_oidc_token_issuer')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('mx_oidc_id_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(3)
    })
  })

  describe('Integration scenarios', () => {
    it('should persist and retrieve complete OIDC flow', () => {
      // Persist settings
      persistOidcAuthenticatedSettings(mockOidcData.clientId, mockOidcData.issuer, mockOidcData.idToken)

      // Mock localStorage to return the persisted values
      localStorageMock.getItem.mockImplementation((key: string) => {
        switch (key) {
          case 'mx_oidc_client_id':
            return mockOidcData.clientId
          case 'mx_oidc_token_issuer':
            return mockOidcData.issuer
          case 'mx_oidc_id_token':
            return mockOidcData.idToken
          default:
            return null
        }
      })
      mockDecodeIdToken.mockReturnValue(mockIdTokenClaims)

      // Retrieve and verify
      expect(getStoredOidcClientId()).toBe(mockOidcData.clientId)
      expect(getStoredOidcTokenIssuer()).toBe(mockOidcData.issuer)
      expect(getStoredOidcIdToken()).toBe(mockOidcData.idToken)
      expect(getStoredOidcIdTokenClaims()).toEqual(mockIdTokenClaims)
    })

    it('should handle complete logout flow', () => {
      // First persist some settings
      persistOidcAuthenticatedSettings(mockOidcData.clientId, mockOidcData.issuer, mockOidcData.idToken)

      // Clear settings
      clearStoredOidcSettings()

      // Mock localStorage to return null after clearing
      localStorageMock.getItem.mockReturnValue(null)

      // Verify all values are undefined
      expect(getStoredOidcClientId()).toBeUndefined()
      expect(getStoredOidcTokenIssuer()).toBeUndefined()
      expect(getStoredOidcIdToken()).toBeUndefined()
      expect(getStoredOidcIdTokenClaims()).toBeUndefined()
    })
  })
})
