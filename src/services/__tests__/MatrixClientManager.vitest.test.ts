/**
 * Tests for MatrixClientManager
 *
 * Focus on testing the critical client lifecycle management functionality
 * that forms the foundation of the entire Matrix integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { MatrixClient } from 'matrix-js-sdk'
import { MatrixClientManager, setSecretStorageBeingAccessed, cacheSecretStorageKeyForBootstrap, clearSecretStorageCache, withSecretStorageKeyCache } from '../MatrixClientManager'

// Type for crypto mock
type MockCrypto = {
  getKeyBackupInfo?: () => Promise<unknown>
  ready?: boolean
}

// Mock the logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock Matrix SDK
const mockMatrixClient = {
  isLoggedIn: vi.fn(() => false),
  getAccessToken: vi.fn(() => null),
  startClient: vi.fn().mockResolvedValue(undefined),
  stopClient: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  getCrypto: vi.fn(() => null),
  getKeyBackupInfo: vi.fn().mockResolvedValue(null),
  logout: vi.fn().mockResolvedValue({}),
  getDeviceId: vi.fn(() => 'test-device-id'),
  getUserId: vi.fn(() => '@test:example.com'),
  clearStores: vi.fn().mockResolvedValue(undefined),
  getClientWellKnown: vi.fn(() => ({})),
  initRustCrypto: vi.fn().mockResolvedValue(undefined),
  whoami: vi.fn().mockResolvedValue({ user_id: '@test:example.com' }),
  store: {
    deleteAllData: vi.fn().mockResolvedValue(undefined),
    startup: vi.fn().mockResolvedValue(undefined)
  }
} as unknown as MatrixClient

vi.mock('matrix-js-sdk', () => ({
  createClient: vi.fn(() => mockMatrixClient),
  ClientEvent: {
    Sync: 'sync',
    Session: 'session'
  },
  HttpApiEvent: {
    SessionLoggedOut: 'sessionLoggedOut'
  },
  IndexedDBStore: vi.fn().mockImplementation(() => ({
    startup: vi.fn().mockResolvedValue(undefined),
    deleteAllData: vi.fn().mockResolvedValue(undefined)
  })),
  IndexedDBCryptoStore: vi.fn().mockImplementation(() => ({
    startup: vi.fn().mockResolvedValue(undefined)
  })),
  LocalStorageCryptoStore: vi.fn().mockImplementation(() => ({
    startup: vi.fn().mockResolvedValue(undefined)
  })),
  MemoryCryptoStore: vi.fn().mockImplementation(() => ({
    startup: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock other dependencies
vi.mock('../../utils/matrixUtils', () => ({
  parseRoomAlias: vi.fn()
}))

vi.mock('../../matrix/oidc/TokenRefresher', () => ({
  TokenRefresher: vi.fn()
}))

// Mock oidc-client-ts
vi.mock('oidc-client-ts', () => ({}))

describe('MatrixClientManager', () => {
  let manager: MatrixClientManager

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock client state to default values
    vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(false)
    vi.mocked(mockMatrixClient.getAccessToken).mockReturnValue(null)
    vi.mocked(mockMatrixClient.getCrypto).mockReturnValue(null)
    vi.mocked(mockMatrixClient.initRustCrypto).mockResolvedValue(undefined)

    // Get fresh instance
    manager = MatrixClientManager.getInstance()

    // Clear any existing client state
    manager.clearClient()
  })

  afterEach(async () => {
    try {
      await manager.clearClient()
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MatrixClientManager.getInstance()
      const instance2 = MatrixClientManager.getInstance()

      expect(instance1).toBe(instance2)
      expect(instance1).toBe(manager)
    })
  })

  describe('Client State Management', () => {
    it('should start with no client available', () => {
      expect(manager.getClient()).toBeNull()
      expect(manager.isClientAvailable()).toBe(false)
      expect(manager.isReady()).toBe(false)
      expect(manager.isCryptoReady()).toBe(false)
      expect(manager.isCryptoInitializing()).toBe(false)
    })

    it('should track client availability correctly', async () => {
      expect(manager.isClientAvailable()).toBe(false)

      // Initialize client
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })

      // Mock client as logged in
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
      vi.mocked(mockMatrixClient.getAccessToken).mockReturnValue('test-token')

      expect(manager.isClientAvailable()).toBe(true)
      expect(manager.getClient()).toBe(mockMatrixClient)
    })

    it('should distinguish between client available and fully ready', async () => {
      // Initialize but don't start
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })

      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)

      // Client available but not ready (not started)
      expect(manager.isClientAvailable()).toBe(true)
      expect(manager.isReady()).toBe(false)

      // Start client
      await manager.startClient()

      // Now should be ready
      expect(manager.isReady()).toBe(true)
    })
  })

  describe('Client Initialization', () => {
    it('should prevent concurrent initialization', async () => {
      const credentials = {
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      }

      // Start two initializations concurrently
      const promise1 = manager.initializeClient(credentials)
      const promise2 = manager.initializeClient(credentials)

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Both should resolve to the same client
      expect(result1).toBe(result2)
      expect(result1).toBe(mockMatrixClient)
    })

    it('should handle initialization errors gracefully', async () => {
      const { createClient } = await import('matrix-js-sdk')
      vi.mocked(createClient).mockImplementationOnce(() => {
        throw new Error('Failed to create client')
      })

      await expect(manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })).rejects.toThrow('Failed to create client')

      // Manager should be in clean state after error
      expect(manager.getClient()).toBeNull()
      expect(manager.isClientAvailable()).toBe(false)
    })

    it('should support different authentication modes', async () => {
      // Mock client as logged in for this test
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)

      // Test with access token
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })

      expect(manager.isClientAvailable()).toBe(true)

      // Clear and test with OIDC
      await manager.clearClient()

      // Re-enable logged in state after clear
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)

      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'oidc-access-token',
        userId: '@test:example.com',
        deviceId: 'test-device',
        idTokenClaims: {
          sub: 'test-user',
          iss: 'https://oidc.example.com',
          aud: 'test-client',
          exp: Date.now() + 3600000,
          iat: Date.now()
        },
        oidcIssuer: 'https://oidc.example.com',
        oidcClientId: 'test-client'
      })

      expect(manager.isClientAvailable()).toBe(true)
    })
  })

  describe('Client Lifecycle', () => {
    beforeEach(async () => {
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
    })

    it('should start client correctly', async () => {
      await manager.startClient()

      expect(mockMatrixClient.startClient).toHaveBeenCalled()
      expect(manager.isReady()).toBe(true)
    })

    it('should handle start client errors', async () => {
      vi.mocked(mockMatrixClient.startClient).mockRejectedValueOnce(new Error('Start failed'))

      await expect(manager.startClient()).rejects.toThrow('Start failed')
      expect(manager.isReady()).toBe(false)
    })

    it('should restart client with throttling', async () => {
      await manager.startClient()

      // First restart should work immediately
      await manager.restartClient()

      expect(mockMatrixClient.stopClient).toHaveBeenCalled()
      expect(mockMatrixClient.startClient).toHaveBeenCalledTimes(2)
    })

    it('should shutdown gracefully', async () => {
      await manager.startClient()
      await manager.shutdown()

      expect(mockMatrixClient.stopClient).toHaveBeenCalled()
      expect(manager.isReady()).toBe(false)
    })
  })

  describe('Client Cleanup', () => {
    beforeEach(async () => {
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
      await manager.startClient()
    })

    it('should clear client properly', async () => {
      expect(manager.isReady()).toBe(true)

      await manager.clearClient()

      expect(mockMatrixClient.stopClient).toHaveBeenCalled()
      expect(manager.getClient()).toBeNull()
      expect(manager.isClientAvailable()).toBe(false)
      expect(manager.isReady()).toBe(false)
    })

    it('should clear client and credentials', async () => {
      // Mock client as logged in for this test
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)

      // First initialize a client
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })

      expect(manager.isClientAvailable()).toBe(true)

      await manager.clearClientAndCredentials()

      // clearClientAndCredentials stops the client but doesn't call logout
      expect(mockMatrixClient.stopClient).toHaveBeenCalled()
      expect(manager.getClient()).toBeNull()
      expect(manager.isClientAvailable()).toBe(false)
    })

    it('should handle shutdown during initialization', async () => {
      // Start a new initialization
      const initPromise = manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'new-token',
        userId: '@test:example.com',
        deviceId: 'new-device'
      })

      // Shutdown before init completes
      await manager.shutdown()

      // Init should still complete but client should be stopped
      await initPromise
      expect(manager.isReady()).toBe(false)
    })
  })

  describe('Crypto Management', () => {
    beforeEach(async () => {
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
    })

    it('should track crypto initialization state', async () => {
      expect(manager.isCryptoReady()).toBe(false)
      expect(manager.isCryptoInitializing()).toBe(false)

      // Mock crypto becoming available
      const mockCrypto: MockCrypto = { getKeyBackupInfo: vi.fn().mockResolvedValue(null) }
      vi.mocked(mockMatrixClient.getCrypto).mockReturnValue(mockCrypto as unknown as ReturnType<MatrixClient['getCrypto']>)

      const success = await manager.initializeCrypto('@test:example.com', 'test-device')

      expect(success).toBe(true)
      expect(manager.isCryptoReady()).toBe(true)
      expect(manager.isCryptoInitializing()).toBe(false)
    })

    it('should prevent concurrent crypto initialization', async () => {
      const promise1 = manager.initializeCrypto('@test:example.com', 'test-device')
      const promise2 = manager.initializeCrypto('@test:example.com', 'test-device')

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toBe(result2)
    })

    it('should handle crypto initialization failures', async () => {
      // Mock client as logged in and crypto as available for initial success
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
      vi.mocked(mockMatrixClient.getCrypto).mockReturnValue({ ready: true } as unknown as ReturnType<MatrixClient['getCrypto']>)

      // Initialize client first - this should work (crypto gets initialized automatically)
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })

      // At this point crypto should be ready from the automatic initialization
      expect(manager.isCryptoReady()).toBe(true)

      // Now reset crypto state by clearing and creating a fresh scenario
      // Clear client to reset crypto state
      await manager.clearClient()

      // Set up client again but with initRustCrypto failing and crypto not available
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
      vi.mocked(mockMatrixClient.getCrypto).mockReturnValue(null) // No crypto available after failed init
      vi.mocked(mockMatrixClient.initRustCrypto).mockRejectedValueOnce(new Error('Crypto initialization failed'))

      // Try to initialize - this should fail during the automatic crypto init
      await expect(manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })).rejects.toThrow('Crypto initialization failed')

      // After the failed initialization, crypto should not be ready
      expect(manager.isCryptoReady()).toBe(false)
    })
  })

  describe('Error Recovery', () => {
    it('should handle session logout events', async () => {
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })

      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
      await manager.startClient()

      manager.setupEventListeners()

      // Simulate session logout
      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(false)

      expect(manager.isClientAvailable()).toBe(false)
      expect(manager.isReady()).toBe(false)
    })
  })

  describe('Storage Management', () => {
    it('should clear device storage', () => {
      const userId = '@test:example.com'

      expect(() => {
        manager.clearAllDeviceStorage(userId)
      }).not.toThrow()
    })

    it('should clear persistent device ID', () => {
      const userId = '@test:example.com'

      expect(() => {
        manager.clearPersistentDeviceId(userId)
      }).not.toThrow()
    })

    it('should reset Matrix completely', async () => {
      const userId = '@test:example.com'

      await expect(manager.resetMatrixCompletely(userId)).resolves.not.toThrow()
    })
  })

  describe('Navigation Cleanup', () => {
    it('should handle navigation cleanup', async () => {
      await manager.initializeClient({
        homeserverUrl: 'https://matrix.example.com',
        accessToken: 'test-token',
        userId: '@test:example.com',
        deviceId: 'test-device'
      })

      vi.mocked(mockMatrixClient.isLoggedIn).mockReturnValue(true)
      await manager.startClient()

      await manager.cleanupOnNavigation('new-context', 'old-context')

      // Should still be available after navigation cleanup
      expect(manager.isClientAvailable()).toBe(true)
    })
  })
})

describe('Secret Storage Functions', () => {
  beforeEach(() => {
    clearSecretStorageCache()
  })

  afterEach(() => {
    clearSecretStorageCache()
  })

  describe('setSecretStorageBeingAccessed', () => {
    it('should set access state', () => {
      expect(() => {
        setSecretStorageBeingAccessed(true)
        setSecretStorageBeingAccessed(false)
      }).not.toThrow()
    })
  })

  describe('cacheSecretStorageKeyForBootstrap', () => {
    it('should cache key for bootstrap', () => {
      const keyId = 'test-key-id'
      const keyInfo = { name: 'test-key' }
      const key = new Uint8Array([1, 2, 3, 4])

      expect(() => {
        cacheSecretStorageKeyForBootstrap(keyId, keyInfo, key)
      }).not.toThrow()
    })
  })

  describe('clearSecretStorageCache', () => {
    it('should clear cache without errors', () => {
      // Cache some data first
      cacheSecretStorageKeyForBootstrap('key1', {}, new Uint8Array([1, 2, 3]))
      cacheSecretStorageKeyForBootstrap('key2', {}, new Uint8Array([4, 5, 6]))

      expect(() => {
        clearSecretStorageCache()
      }).not.toThrow()
    })
  })

  describe('withSecretStorageKeyCache', () => {
    it('should execute function with cache enabled', async () => {
      const testFunction = vi.fn().mockResolvedValue('test-result')

      const result = await withSecretStorageKeyCache(testFunction)

      expect(testFunction).toHaveBeenCalledOnce()
      expect(result).toBe('test-result')
    })

    it('should clear cache even if function throws', async () => {
      const testFunction = vi.fn().mockRejectedValue(new Error('Test error'))

      await expect(withSecretStorageKeyCache(testFunction)).rejects.toThrow('Test error')

      expect(testFunction).toHaveBeenCalledOnce()
      // Cache should be cleared even on error (we can't directly test this but the function should not throw)
    })

    it('should handle multiple nested cache operations', async () => {
      const innerFunction = vi.fn().mockResolvedValue('inner-result')
      const outerFunction = vi.fn().mockImplementation(async () => {
        return await withSecretStorageKeyCache(innerFunction)
      })

      const result = await withSecretStorageKeyCache(outerFunction)

      expect(outerFunction).toHaveBeenCalledOnce()
      expect(innerFunction).toHaveBeenCalledOnce()
      expect(result).toBe('inner-result')
    })
  })
})
