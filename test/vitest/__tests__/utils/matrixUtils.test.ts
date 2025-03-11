import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureMatrixUser, getMatrixDisplayName } from '../../../../src/utils/matrixUtils'
import { UserEntity } from '../../../../src/types'

// Create a partial user type for testing
type PartialUserEntity = Pick<UserEntity, 'id' | 'ulid' | 'slug' | 'email' | 'matrixUserId'>

// Mock dependencies
vi.mock('../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    user: {
      id: 1,
      matrixUserId: null
    },
    actionSetUser: vi.fn()
  })
}))

vi.mock('../../../../src/api/auth', () => ({
  authApi: {
    provisionMatrixUser: vi.fn()
  }
}))

vi.mock('../../../../src/composables/useNotification', () => ({
  useNotification: vi.fn().mockReturnValue({
    error: vi.fn()
  })
}))

import { useAuthStore } from '../../../../src/stores/auth-store'
import { authApi } from '../../../../src/api/auth'
import { useNotification } from '../../../../src/composables/useNotification'

describe('Matrix Utils', () => {
  const mockAuthStore = useAuthStore()
  const mockAuthApi = authApi
  const mockNotification = useNotification()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureMatrixUser', () => {
    it('should return true if user already has Matrix ID', async () => {
      // Override the mock for this test
      vi.mocked(useAuthStore).mockReturnValueOnce({
        ...mockAuthStore,
        user: {
          id: 1,
          ulid: 'user123',
          slug: 'test-user',
          email: 'test@example.com',
          matrixUserId: '@test:matrix.org'
        } as PartialUserEntity
      })

      const result = await ensureMatrixUser()
      expect(result).toBe(true)
      expect(mockAuthApi.provisionMatrixUser).not.toHaveBeenCalled()
    })

    it('should provision a Matrix user if not already present', async () => {
      const matrixData = {
        matrixUserId: '@newuser:matrix.org',
        matrixAccessToken: 'token123',
        matrixDeviceId: 'device123'
      }

      vi.mocked(authApi.provisionMatrixUser).mockResolvedValueOnce({
        data: matrixData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as import('axios').InternalAxiosRequestConfig
      })

      const result = await ensureMatrixUser()

      expect(result).toBe(true)
      expect(mockAuthApi.provisionMatrixUser).toHaveBeenCalledTimes(1)
      expect(mockAuthStore.actionSetUser).toHaveBeenCalledWith({
        id: 1,
        matrixUserId: null,
        ...matrixData
      })
    })

    it('should handle errors during Matrix user provisioning', async () => {
      vi.mocked(authApi.provisionMatrixUser).mockRejectedValueOnce(new Error('API error'))

      // Mock NODE_ENV to simulate production for testing error notifications
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const result = await ensureMatrixUser()

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv

      expect(result).toBe(false)
      expect(mockAuthApi.provisionMatrixUser).toHaveBeenCalledTimes(1)
      expect(mockNotification.error).toHaveBeenCalledWith('Failed to set up chat account. Please try again later.')
    })
  })

  describe('getMatrixDisplayName', () => {
    it('should extract username from Matrix ID', () => {
      expect(getMatrixDisplayName('@alice:matrix.org')).toBe('alice')
      expect(getMatrixDisplayName('@bob:example.com')).toBe('bob')
    })

    it('should return original ID if pattern doesn\'t match', () => {
      expect(getMatrixDisplayName('invalid-id')).toBe('invalid-id')
    })

    it('should return "Unknown User" for empty input', () => {
      expect(getMatrixDisplayName('')).toBe('Unknown User')
    })
  })
})
