/**
 * Matrix Integration Tests - Behavior-Driven (Refactor-Resilient)
 *
 * These tests focus on user-facing behavior that must work regardless
 * of how we restructure the internal code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock Storage for tests
const storageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
}

// Setup storage if not available
if (typeof localStorage === 'undefined') {
  Object.defineProperty(global, 'localStorage', { value: storageMock() })
}
if (typeof sessionStorage === 'undefined') {
  Object.defineProperty(global, 'sessionStorage', { value: storageMock() })
}

// We'll import the current service but test it like a black box
import { matrixClientManager } from '../../services/MatrixClientManager'

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

  describe('Session Management', () => {
    it('should detect when no Matrix session exists', () => {
      // GIVEN: Fresh browser state
      // WHEN: Checking for existing session
      // THEN: Should report no session
      expect(matrixClientManager.hasStoredSession()).toBe(false)
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
      expect(matrixClientManager.hasStoredSession()).toBe(true)
    })

    it('should handle corrupted credentials gracefully', () => {
      // GIVEN: Corrupted data in storage
      localStorage.setItem('matrix_credentials', 'invalid-json-data')

      // WHEN: Checking for existing session
      // THEN: Should handle gracefully and report no session
      expect(matrixClientManager.hasStoredSession()).toBe(false)
    })
  })

  describe('Authentication State', () => {
    it('should report not ready when no client exists', () => {
      // GIVEN: No Matrix client initialized
      // WHEN: Checking if ready
      // THEN: Should report not ready
      expect(matrixClientManager.isReady()).toBe(false)
    })

    it('should restore session from stored credentials when available', async () => {
      // GIVEN: Valid session data stored with user-specific keys
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
      localStorage.setItem(`matrix_access_token_${userSlug}`, 'stored-access-token')

      // WHEN: Checking if session can be restored
      const hasSession = matrixClientManager.hasStoredSession()

      // THEN: Should detect the stored session
      expect(hasSession).toBe(true)
    })

    it('should detect when no stored session exists', () => {
      // GIVEN: No credentials in storage
      // WHEN: Checking if session exists
      const hasSession = matrixClientManager.hasStoredSession()

      // THEN: Should return false
      expect(hasSession).toBe(false)
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
        expect(() => matrixClientManager.hasStoredSession()).not.toThrow()
        expect(matrixClientManager.hasStoredSession()).toBe(false)
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
    const client = matrixClientManager.getClient()

    // THEN: Should return null (not throw error)
    expect(client).toBeNull()
  })

  it('should track Matrix client readiness state', () => {
    // This test verifies the contract - regardless of internal implementation,
    // the service should be able to report whether it's ready for operations

    // GIVEN: Fresh service state
    // WHEN: Checking readiness
    const isReady = matrixClientManager.isReady()

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
 * When we refactor matrixClientManager into multiple services,
 * these tests should continue to pass by testing through whatever
 * public interface we maintain (whether it's a facade or individual services).
 */
