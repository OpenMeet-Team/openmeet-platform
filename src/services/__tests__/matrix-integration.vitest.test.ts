/**
 * Matrix Integration Tests - Behavior-Driven (Refactor-Resilient)
 *
 * These tests focus on user-facing behavior that must work regardless
 * of how we restructure the internal code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// We'll import the current service but test it like a black box
import matrixClientService from '../matrixClientService'

// Mock external dependencies but keep Matrix behavior intact
vi.mock('../../utils/env', () => ({
  default: vi.fn((key: string) => {
    const mockConfig = {
      APP_MATRIX_HOMESERVER_URL: 'https://matrix.example.com',
      APP_MAS_URL: 'https://mas.example.com',
      APP_TENANT_ID: 'test-tenant'
    }
    return mockConfig[key as keyof typeof mockConfig]
  })
}))

vi.mock('../../stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    user: { slug: 'test-user', email: 'test@example.com' },
    token: 'valid-token',
    getUserSlug: 'test-user'
  }))
}))

describe('Matrix Authentication Integration (Behavior-Driven)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Clear any stored state
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('User Connection Flow', () => {
    it('should track user consent for Matrix connection', () => {
      // GIVEN: User hasn't chosen to connect yet
      expect(matrixClientService.hasUserChosenToConnect()).toBe(false)

      // WHEN: User gives consent to connect
      matrixClientService.setUserChosenToConnect(true)

      // THEN: System should remember their choice
      expect(matrixClientService.hasUserChosenToConnect()).toBe(true)
    })

    it('should allow user to revoke consent', () => {
      // GIVEN: User previously consented
      matrixClientService.setUserChosenToConnect(true)
      expect(matrixClientService.hasUserChosenToConnect()).toBe(true)

      // WHEN: User revokes consent
      matrixClientService.setUserChosenToConnect(false)

      // THEN: System should forget their choice
      expect(matrixClientService.hasUserChosenToConnect()).toBe(false)
    })
  })

  describe('Session Management', () => {
    it('should detect when no Matrix session exists', () => {
      // GIVEN: Fresh browser state
      // WHEN: Checking for existing session
      // THEN: Should report no session
      expect(matrixClientService.hasStoredSession()).toBe(false)
    })

    it('should detect stored Matrix credentials', () => {
      // GIVEN: Valid Matrix credentials stored with user-specific key
      const userSlug = 'test-user' // Matches our mock auth store
      const mockCredentials = {
        homeserverUrl: 'https://matrix.example.com',
        userId: '@test:example.com',
        deviceId: 'TEST_DEVICE',
        accessToken: 'test-access-token',
        timestamp: Date.now(),
        hasSession: true,
        openMeetUserSlug: userSlug
      }

      // Store with user-specific key as the system expects
      localStorage.setItem(`matrix_session_${userSlug}`, JSON.stringify(mockCredentials))

      // WHEN: Checking for existing session
      // THEN: Should detect the session
      expect(matrixClientService.hasStoredSession()).toBe(true)
    })

    it('should handle corrupted credentials gracefully', () => {
      // GIVEN: Corrupted data in storage
      localStorage.setItem('matrix_credentials', 'invalid-json-data')

      // WHEN: Checking for existing session
      // THEN: Should handle gracefully and report no session
      expect(matrixClientService.hasStoredSession()).toBe(false)
    })
  })

  describe('Authentication State', () => {
    it('should report not ready when no client exists', () => {
      // GIVEN: No Matrix client initialized
      // WHEN: Checking if ready
      // THEN: Should report not ready
      expect(matrixClientService.isReady()).toBe(false)
    })

    it('should retrieve stored credentials when available', async () => {
      // GIVEN: Valid credentials stored with user-specific keys
      const userSlug = 'test-user' // Matches our mock auth store
      const mockCredentials = {
        homeserverUrl: 'https://matrix.example.com',
        userId: '@test:example.com',
        deviceId: 'TEST_DEVICE',
        timestamp: Date.now(),
        hasSession: true,
        openMeetUserSlug: userSlug
      }

      // Store session data and tokens separately as the system does
      localStorage.setItem(`matrix_session_${userSlug}`, JSON.stringify(mockCredentials))
      localStorage.setItem(`matrix_refresh_token_${userSlug}`, 'stored-refresh-token')
      sessionStorage.setItem(`matrix_access_token_${userSlug}`, 'stored-access-token')

      // WHEN: Getting stored credentials
      const credentials = await matrixClientService.getStoredCredentials()

      // THEN: Should return the stored credentials
      expect(credentials.accessToken).toBe('stored-access-token')
      expect(credentials.refreshToken).toBe('stored-refresh-token')
    })

    it('should return empty credentials when none stored', async () => {
      // GIVEN: No credentials in storage
      // WHEN: Getting stored credentials
      const credentials = await matrixClientService.getStoredCredentials()

      // THEN: Should return empty object
      expect(credentials).toEqual({})
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage being unavailable', () => {
      // GIVEN: localStorage throws errors (privacy mode, quota exceeded, etc.)
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage unavailable')
      })

      try {
        // WHEN: Checking for stored session
        // THEN: Should handle gracefully without crashing
        expect(() => matrixClientService.hasStoredSession()).not.toThrow()
        expect(matrixClientService.hasStoredSession()).toBe(false)
      } finally {
        localStorage.getItem = originalGetItem
      }
    })

    // TODO: Add test for tenant ID requirement
    // This requires more complex mocking setup - can be added later
  })
})

describe('Matrix Client State Management (Behavior-Driven)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should provide access to Matrix client when available', () => {
    // GIVEN: No client initialized yet
    // WHEN: Getting client
    const client = matrixClientService.getClient()

    // THEN: Should return null (not throw error)
    expect(client).toBeNull()
  })

  it('should track Matrix client readiness state', () => {
    // This test verifies the contract - regardless of internal implementation,
    // the service should be able to report whether it's ready for operations

    // GIVEN: Fresh service state
    // WHEN: Checking readiness
    const isReady = matrixClientService.isReady()

    // THEN: Should return a boolean (not undefined or throw error)
    expect(typeof isReady).toBe('boolean')
  })
})

/**
 * Test Philosophy Notes:
 *
 * These tests are designed to survive the refactoring by:
 * 1. Testing public API contracts, not internal implementation
 * 2. Focusing on user-facing behavior and state management
 * 3. Using black-box testing approach
 * 4. Avoiding mocking internal methods or testing call sequences
 * 5. Testing error conditions and edge cases that users encounter
 *
 * When we refactor matrixClientService into multiple services,
 * these tests should continue to pass by testing through whatever
 * public interface we maintain (whether it's a facade or individual services).
 */
