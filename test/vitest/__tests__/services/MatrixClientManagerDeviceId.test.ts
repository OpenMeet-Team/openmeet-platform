import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Per-Tab Matrix Device ID Management Tests
 *
 * Tests the solution for multi-tab Matrix token synchronization issues.
 * When users open multiple tabs, each tab should get its own device ID to prevent
 * token refresh conflicts and 401 errors.
 *
 * Strategy:
 * - Tab 1: Claims primary device (reused across single-tab sessions)
 * - Tab 2+: Claims from device pool or requests new device
 * - Tab refresh: Reuses same device via sessionStorage
 * - Coordination: Web Locks API prevents device conflicts
 */

// Mock auth store BEFORE importing MatrixClientManager
vi.mock('../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    getUserSlug: 'test-user-slug',
    isInitialized: true,
    waitForInitialization: async () => {}
  }))
}))

// Now import after mocking
const { matrixClientManager } = await import('../../../../src/services/MatrixClientManager')

// Type for accessing private methods and properties in tests
type MatrixClientManagerPrivate = typeof matrixClientManager & {
  getDevicePool: (userSlug: string) => string[]
  addDeviceToPool: (userSlug: string, deviceId: string) => void
  claimDeviceFromPool: (userSlug: string) => Promise<string | null>
  getStoredDeviceId: () => Promise<string | null>
  setStoredDeviceId: (userId: string, deviceId: string) => Promise<void>
  deviceLockAcquired: boolean
  claimedDeviceId: string | null
}

// Mock storage
const mockLocalStorage = new Map<string, string>()
const mockSessionStorage = new Map<string, string>()

// Mock Web Locks API
interface LockGrantedCallback {
  (lock: { name: string } | null): Promise<void> | void
}

interface LockOptions {
  ifAvailable?: boolean
  signal?: AbortSignal
}

const activeLocks = new Set<string>()

const mockNavigatorLocks = {
  request: vi.fn((
    name: string,
    optionsOrCallback: LockOptions | LockGrantedCallback,
    callback?: LockGrantedCallback
  ) => {
    const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
    const lockCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback!

    return new Promise<void>((resolve) => {
      const ifAvailable = options.ifAvailable || false

      if (activeLocks.has(name) && ifAvailable) {
        // Lock not available, return null
        lockCallback(null)
        resolve()
      } else {
        // Lock available, grant it
        activeLocks.add(name)
        const lock = { name }

        const result = lockCallback(lock)

        // If callback returns a promise, wait for it
        if (result instanceof Promise) {
          result.then(() => {
            activeLocks.delete(name)
            resolve()
          }).catch(() => {
            activeLocks.delete(name)
            resolve()
          })
        } else {
          activeLocks.delete(name)
          resolve()
        }
      }
    })
  })
}

beforeEach(() => {
  // Clear storage mocks
  mockLocalStorage.clear()
  mockSessionStorage.clear()
  activeLocks.clear()

  // Clear cached device ID in MatrixClientManager
  const manager = matrixClientManager as MatrixClientManagerPrivate
  manager.deviceLockAcquired = false
  manager.claimedDeviceId = null

  // Setup global mocks
  global.localStorage = {
    getItem: (key: string) => mockLocalStorage.get(key) || null,
    setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
    removeItem: (key: string) => mockLocalStorage.delete(key),
    clear: () => mockLocalStorage.clear(),
    key: (index: number) => Array.from(mockLocalStorage.keys())[index] || null,
    length: mockLocalStorage.size
  } as Storage

  global.sessionStorage = {
    getItem: (key: string) => mockSessionStorage.get(key) || null,
    setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
    removeItem: (key: string) => mockSessionStorage.delete(key),
    clear: () => mockSessionStorage.clear(),
    key: (index: number) => Array.from(mockSessionStorage.keys())[index] || null,
    length: mockSessionStorage.size
  } as Storage

  // Mock navigator.locks
  Object.defineProperty(global.navigator, 'locks', {
    value: mockNavigatorLocks,
    writable: true,
    configurable: true
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('MatrixClientManager - Per-Tab Device ID Management', () => {
  describe('Device Pool Management', () => {
    it('should initialize empty device pool', () => {
      // Access private method for testing
      const manager = matrixClientManager as MatrixClientManagerPrivate
      const pool = manager.getDevicePool('test-user-slug')

      expect(pool).toEqual([])
    })

    it('should add device to pool', () => {
      const manager = matrixClientManager as MatrixClientManagerPrivate

      manager.addDeviceToPool('test-user-slug', 'DEVICE_001')
      manager.addDeviceToPool('test-user-slug', 'DEVICE_002')

      const pool = manager.getDevicePool('test-user-slug')
      expect(pool).toEqual(['DEVICE_001', 'DEVICE_002'])
    })

    it('should not add duplicate devices to pool', () => {
      const manager = matrixClientManager as MatrixClientManagerPrivate

      manager.addDeviceToPool('test-user-slug', 'DEVICE_001')
      manager.addDeviceToPool('test-user-slug', 'DEVICE_001')

      const pool = manager.getDevicePool('test-user-slug')
      expect(pool).toEqual(['DEVICE_001'])
    })

    it('should store device pool in localStorage', () => {
      const manager = matrixClientManager as MatrixClientManagerPrivate

      manager.addDeviceToPool('test-user-slug', 'DEVICE_001')

      const poolJson = localStorage.getItem('matrix_device_pool_test-user-slug')
      expect(poolJson).toBeTruthy()
      expect(JSON.parse(poolJson!)).toEqual(['DEVICE_001'])
    })
  })

  describe('getStoredDeviceId() - Tab Refresh Scenario', () => {
    it('should reuse device ID from sessionStorage on tab refresh with primary lock', async () => {
      // Simulate tab refresh: sessionStorage has primary device ID and lock flag
      sessionStorage.setItem('matrix_tab_device_id', 'DEVICE_PRIMARY')
      sessionStorage.setItem('matrix_has_primary_lock', 'true')
      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_PRIMARY')

      const manager = matrixClientManager as MatrixClientManagerPrivate
      const deviceIdPromise = manager.getStoredDeviceId()

      // Wait for lock verification
      await new Promise(resolve => setTimeout(resolve, 10))
      const deviceId = await deviceIdPromise

      expect(deviceId).toBe('DEVICE_PRIMARY')
      // Should have verified the lock
      expect(mockNavigatorLocks.request).toHaveBeenCalledWith(
        'matrix_primary_device',
        expect.objectContaining({ ifAvailable: true }),
        expect.any(Function)
      )
    })

    it('should reuse pool device ID from sessionStorage on tab refresh', async () => {
      // Simulate tab refresh: sessionStorage has pool device ID (no primary lock flag)
      sessionStorage.setItem('matrix_tab_device_id', 'DEVICE_POOL')
      localStorage.setItem('matrix_device_pool_test-user-slug', JSON.stringify(['DEVICE_POOL']))

      const manager = matrixClientManager as MatrixClientManagerPrivate
      const deviceIdPromise = manager.getStoredDeviceId()

      // Wait for lock verification
      await new Promise(resolve => setTimeout(resolve, 10))
      const deviceId = await deviceIdPromise

      expect(deviceId).toBe('DEVICE_POOL')
      // Should have verified the pool device lock
      expect(mockNavigatorLocks.request).toHaveBeenCalledWith(
        'matrix_device_DEVICE_POOL',
        expect.objectContaining({ ifAvailable: true }),
        expect.any(Function)
      )
    })
  })

  describe('getStoredDeviceId() - First Tab (Primary Device)', () => {
    it('should claim primary device when available', async () => {
      // Setup: Primary device exists in localStorage
      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_PRIMARY')

      const manager = matrixClientManager as MatrixClientManagerPrivate

      // First tab tries to get device ID
      const deviceIdPromise = manager.getStoredDeviceId()

      // Wait a bit for the Web Lock to be processed
      await new Promise(resolve => setTimeout(resolve, 10))

      const deviceId = await deviceIdPromise

      expect(deviceId).toBe('DEVICE_PRIMARY')
      expect(sessionStorage.getItem('matrix_tab_device_id')).toBe('DEVICE_PRIMARY')
      expect(sessionStorage.getItem('matrix_has_primary_lock')).toBe('true')
    })

    it('should return null when no devices available (first login)', async () => {
      // No devices in storage at all
      const manager = matrixClientManager as MatrixClientManagerPrivate
      const deviceId = await manager.getStoredDeviceId()

      expect(deviceId).toBeNull()
    })
  })

  describe('getStoredDeviceId() - Second Tab (Pool Device)', () => {
    it('should claim device from pool when primary is locked', async () => {
      // Setup: Primary device and pool exist
      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_PRIMARY')
      localStorage.setItem('matrix_device_pool_test-user-slug', JSON.stringify(['DEVICE_002']))

      // Simulate first tab holding primary lock
      activeLocks.add('matrix_primary_device')

      const manager = matrixClientManager as MatrixClientManagerPrivate

      // Second tab tries to get device ID
      const deviceIdPromise = manager.getStoredDeviceId()

      // Wait for locks to be processed
      await new Promise(resolve => setTimeout(resolve, 10))

      const deviceId = await deviceIdPromise

      expect(deviceId).toBe('DEVICE_002')
      expect(sessionStorage.getItem('matrix_tab_device_id')).toBe('DEVICE_002')
    })

    it('should return null when primary locked and pool empty', async () => {
      // Setup: Primary exists but pool is empty
      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_PRIMARY')

      // Simulate first tab holding primary lock
      activeLocks.add('matrix_primary_device')

      const manager = matrixClientManager as MatrixClientManagerPrivate

      // Second tab tries to get device ID
      const deviceIdPromise = manager.getStoredDeviceId()

      // Wait for locks to be processed
      await new Promise(resolve => setTimeout(resolve, 10))

      const deviceId = await deviceIdPromise

      // Should return null to request new device from server
      expect(deviceId).toBeNull()
    })

    it('should skip locked pool devices and claim available one', async () => {
      // Setup: Multiple devices in pool
      localStorage.setItem('matrix_device_pool_test-user-slug', JSON.stringify(['DEVICE_002', 'DEVICE_003']))

      // Simulate DEVICE_002 being locked by another tab
      activeLocks.add('matrix_device_DEVICE_002')

      const manager = matrixClientManager as MatrixClientManagerPrivate

      const deviceIdPromise = manager.getStoredDeviceId()
      await new Promise(resolve => setTimeout(resolve, 10))
      const deviceId = await deviceIdPromise

      // Should claim DEVICE_003 since DEVICE_002 is locked
      expect(deviceId).toBe('DEVICE_003')
    })
  })

  describe('setStoredDeviceId() - Primary Device', () => {
    it('should store as primary device when none exists', async () => {
      const manager = matrixClientManager as MatrixClientManagerPrivate

      await manager.setStoredDeviceId('@test:matrix.org', 'DEVICE_NEW')

      expect(localStorage.getItem('matrix_primary_device_id_test-user-slug')).toBe('DEVICE_NEW')
      expect(sessionStorage.getItem('matrix_tab_device_id')).toBe('DEVICE_NEW')
      expect(sessionStorage.getItem('matrix_has_primary_lock')).toBe('true')
    })

    it('should update primary device when tab has primary lock', async () => {
      // Setup: This tab has the primary lock
      sessionStorage.setItem('matrix_has_primary_lock', 'true')
      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_OLD')

      const manager = matrixClientManager as MatrixClientManagerPrivate

      await manager.setStoredDeviceId('@test:matrix.org', 'DEVICE_UPDATED')

      expect(localStorage.getItem('matrix_primary_device_id_test-user-slug')).toBe('DEVICE_UPDATED')
      expect(sessionStorage.getItem('matrix_tab_device_id')).toBe('DEVICE_UPDATED')
    })
  })

  describe('setStoredDeviceId() - Pool Device', () => {
    it('should add to pool when primary exists and no primary lock', async () => {
      // Setup: Primary device exists but this tab doesn't have the lock
      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_PRIMARY')

      const manager = matrixClientManager as MatrixClientManagerPrivate

      await manager.setStoredDeviceId('@test:matrix.org', 'DEVICE_SECONDARY')

      expect(sessionStorage.getItem('matrix_tab_device_id')).toBe('DEVICE_SECONDARY')

      const poolJson = localStorage.getItem('matrix_device_pool_test-user-slug')
      expect(poolJson).toBeTruthy()
      expect(JSON.parse(poolJson!)).toContain('DEVICE_SECONDARY')
    })
  })

  describe('Web Locks API Fallback', () => {
    it('should fallback to primary device when Web Locks unavailable', async () => {
      // Remove Web Locks API
      Object.defineProperty(global.navigator, 'locks', {
        value: undefined,
        writable: true,
        configurable: true
      })

      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_PRIMARY')

      const manager = matrixClientManager as MatrixClientManagerPrivate
      const deviceId = await manager.getStoredDeviceId()

      expect(deviceId).toBe('DEVICE_PRIMARY')
      expect(sessionStorage.getItem('matrix_tab_device_id')).toBe('DEVICE_PRIMARY')
      expect(sessionStorage.getItem('matrix_has_primary_lock')).toBe('true')
    })
  })

  describe('Integration: Multi-Tab Scenario', () => {
    it('should coordinate device claiming across multiple tabs', async () => {
      // Setup initial state
      localStorage.setItem('matrix_primary_device_id_test-user-slug', 'DEVICE_PRIMARY')
      localStorage.setItem('matrix_device_pool_test-user-slug', JSON.stringify(['DEVICE_002', 'DEVICE_003']))

      const manager = matrixClientManager as MatrixClientManagerPrivate

      // Tab 1: Claims primary device
      const tab1DevicePromise = manager.getStoredDeviceId()
      await new Promise(resolve => setTimeout(resolve, 10))
      const tab1Device = await tab1DevicePromise

      expect(tab1Device).toBe('DEVICE_PRIMARY')

      // Simulate Tab 2 as a completely separate tab instance
      // Clear sessionStorage (tabs don't share sessionStorage)
      mockSessionStorage.clear()
      // Clear the cache to simulate a fresh MatrixClientManager instance in Tab 2
      manager.deviceLockAcquired = false
      manager.claimedDeviceId = null

      // Tab 2: Should get device from pool since primary is locked
      const tab2DevicePromise = manager.getStoredDeviceId()
      await new Promise(resolve => setTimeout(resolve, 10))
      const tab2Device = await tab2DevicePromise

      expect(tab2Device).toBe('DEVICE_002')

      // Verify both tabs got different devices
      expect(tab1Device).not.toBe(tab2Device)
    })
  })

  describe('Edge Cases', () => {
    it('should handle corrupted device pool JSON', () => {
      const manager = matrixClientManager as MatrixClientManagerPrivate
      localStorage.setItem('matrix_device_pool_test-user-slug', 'invalid-json')

      const pool = manager.getDevicePool('test-user-slug')

      // Should return empty array on parse error
      expect(pool).toEqual([])
    })
  })
})
