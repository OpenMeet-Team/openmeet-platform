import { setActivePinia, createPinia } from 'pinia'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '../../../../src/stores/auth-store'
import { authApi } from '../../../../src/api/auth'
import { LocalStorage } from 'quasar'
import { UserRole, UserEntity } from '../../../../src/types'

// Mock the API
vi.mock('../../../../src/api/auth')
vi.mock('../../../../src/services/analyticsService', () => ({
  default: {
    identify: vi.fn(),
    trackEvent: vi.fn(),
    reset: vi.fn()
  }
}))

// Mock LocalStorage
vi.mock('quasar', async () => {
  const actual = await vi.importActual('quasar')
  return {
    ...actual,
    LocalStorage: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
  }
})

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should start with isInitialized as false', () => {
      const store = useAuthStore()
      expect(store.isInitialized).toBe(false)
      expect(store.isInitializing).toBe(false)
    })

    it('should not report isAuthenticated until initialized', async () => {
      // Setup LocalStorage to have a token
      vi.mocked(LocalStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'refreshToken') return 'test-refresh-token'
        if (key === 'tokenExpires') return String(Date.now() + 3600000)
        if (key === 'user') return JSON.stringify({ id: 1, email: 'test@example.com' })
        return null
      })

      const store = useAuthStore()

      // Even with token in storage, should not be authenticated until initialized
      expect(store.isFullyAuthenticated).toBe(false)
    })

    it('should initialize and validate stored auth on startup', async () => {
      const mockUser: UserEntity = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        slug: 'test-user',
        ulid: 'test-ulid',
        role: {
          id: 1,
          name: UserRole.User,
          permissions: []
        }
      }

      // Setup LocalStorage
      vi.mocked(LocalStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return 'valid-token'
        if (key === 'refreshToken') return 'valid-refresh-token'
        if (key === 'tokenExpires') return String(Date.now() + 3600000)
        if (key === 'user') return JSON.stringify(mockUser)
        return null
      })

      // Mock successful API call
      vi.mocked(authApi.getMe).mockResolvedValue({
        data: mockUser,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      })

      const store = useAuthStore()

      // Initialize auth
      await store.initializeAuth()

      expect(store.isInitialized).toBe(true)
      expect(store.isInitializing).toBe(false)
      expect(store.isFullyAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
      expect(authApi.getMe).toHaveBeenCalled()
    })

    it('should clear auth if token validation fails', async () => {
      // Setup LocalStorage with token
      vi.mocked(LocalStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return 'invalid-token'
        if (key === 'refreshToken') return 'invalid-refresh-token'
        return null
      })

      // Mock failed API call
      vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthorized'))

      const store = useAuthStore()

      // Initialize auth
      await store.initializeAuth()

      expect(store.isInitialized).toBe(true)
      expect(store.isFullyAuthenticated).toBe(false)
      expect(store.token).toBe('')
      expect(LocalStorage.removeItem).toHaveBeenCalledWith('token')
      expect(LocalStorage.removeItem).toHaveBeenCalledWith('refreshToken')
    })

    it('should handle initialization when no token exists', async () => {
      // Setup LocalStorage with no token
      vi.mocked(LocalStorage.getItem).mockReturnValue(null)

      const store = useAuthStore()

      // Initialize auth
      await store.initializeAuth()

      expect(store.isInitialized).toBe(true)
      expect(store.isFullyAuthenticated).toBe(false)
      expect(authApi.getMe).not.toHaveBeenCalled()
    })

    it('should only initialize once even if called multiple times', async () => {
      vi.mocked(LocalStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        return null
      })

      vi.mocked(authApi.getMe).mockResolvedValue({
        data: { id: 1, email: 'test@example.com' } as UserEntity,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      })

      const store = useAuthStore()

      // Call initialize multiple times
      const promise1 = store.initializeAuth()
      const promise2 = store.initializeAuth()
      const promise3 = store.initializeAuth()

      await Promise.all([promise1, promise2, promise3])

      // Should only call API once
      expect(authApi.getMe).toHaveBeenCalledTimes(1)
      expect(store.isInitialized).toBe(true)
    })
  })

  describe('isFullyAuthenticated getter', () => {
    it('should return false when not initialized', () => {
      const store = useAuthStore()
      store.token = 'test-token'
      store.isInitialized = false

      expect(store.isFullyAuthenticated).toBe(false)
    })

    it('should return false when initialized but no token', () => {
      const store = useAuthStore()
      store.token = ''
      store.isInitialized = true

      expect(store.isFullyAuthenticated).toBe(false)
    })

    it('should return true when initialized and has token', () => {
      const store = useAuthStore()
      store.token = 'test-token'
      store.isInitialized = true

      expect(store.isFullyAuthenticated).toBe(true)
    })
  })

  describe('waitForInitialization', () => {
    it('should resolve immediately if already initialized', async () => {
      const store = useAuthStore()
      store.isInitialized = true

      const start = Date.now()
      await store.waitForInitialization()
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10) // Should be almost instant
    })

    it('should wait for initialization to complete', async () => {
      const store = useAuthStore()
      store.isInitialized = false

      // Start waiting
      const waitPromise = store.waitForInitialization()

      // Simulate initialization completing after 100ms
      setTimeout(() => {
        store.isInitialized = true
      }, 100)

      await waitPromise
      expect(store.isInitialized).toBe(true)
    })
  })
})
