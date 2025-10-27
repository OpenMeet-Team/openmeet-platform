import { mount, flushPromises } from '@vue/test-utils'
import VerifyEmailPage from '../VerifyEmailPage.vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar, Notify } from 'quasar'
import { authApi } from '../../../api/auth'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../../stores/auth-store'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// Mock the authApi
vi.mock('../../../api/auth', () => ({
  authApi: {
    verifyEmailCode: vi.fn()
  }
}))

// Mock SpinnerComponent
vi.mock('../../../components/common/SpinnerComponent.vue', () => ({
  default: {
    name: 'SpinnerComponent',
    template: '<div data-testid="spinner">{{ message }}</div>',
    props: ['message']
  }
}))

// Mock Notify
const mockNotify = vi.fn()
Notify.create = mockNotify

describe('VerifyEmailPage', () => {
  let authStore: ReturnType<typeof useAuthStore>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockClear()
    setActivePinia(createPinia())
    authStore = useAuthStore()
    vi.spyOn(authStore, 'actionSetToken')
    vi.spyOn(authStore, 'actionSetRefreshToken')
    vi.spyOn(authStore, 'actionSetTokenExpires')
    vi.spyOn(authStore, 'actionSetUser')
    vi.spyOn(authStore, 'initializeMatrixIfReady').mockResolvedValue()

    // Create a test router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/verify-email', name: 'VerifyEmailPage', component: VerifyEmailPage },
        { path: '/', name: 'HomePage', component: { template: '<div>Home</div>' } },
        { path: '/events/:slug', name: 'EventPage', component: { template: '<div>Event</div>' } },
        { path: '/dashboard/events', name: 'DashboardEventsPage', component: { template: '<div>Dashboard</div>' } },
        { path: '/profile', name: 'ProfilePage', component: { template: '<div>Profile</div>' } }
      ]
    })
  })

  const mountComponent = async (queryParams = {}) => {
    // Set the route with query params
    await router.push({
      name: 'VerifyEmailPage',
      query: queryParams
    })

    const wrapper = mount(VerifyEmailPage, {
      global: {
        plugins: [Quasar, router]
      }
    })

    // Wait for onMounted to complete
    await flushPromises()
    return wrapper
  }

  describe('Missing Parameters', () => {
    it('should show error when code is missing', async () => {
      const wrapper = await mountComponent({
        email: 'test@example.com'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isSuccess).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).message).toBe('Invalid verification link')

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Missing verification code or email. Please check your email link.',
        position: 'top'
      })
    })

    it('should show error when email is missing', async () => {
      const wrapper = await mountComponent({
        code: '123456'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isSuccess).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).message).toBe('Invalid verification link')

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Missing verification code or email. Please check your email link.',
        position: 'top'
      })
    })
  })

  describe('Successful Verification', () => {
    it('should successfully verify email and authenticate user', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: {
            id: '123',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.verifyEmailCode).mockResolvedValue(mockResponse)

      const wrapper = await mountComponent({
        code: '123456',
        email: 'test@example.com'
      })

      // Verify API was called
      expect(authApi.verifyEmailCode).toHaveBeenCalledWith({
        code: '123456',
        email: 'test@example.com'
      })

      // Verify auth store was updated
      expect(authStore.actionSetToken).toHaveBeenCalledWith('test-token')
      expect(authStore.actionSetRefreshToken).toHaveBeenCalledWith('test-refresh-token')
      expect(authStore.actionSetTokenExpires).toHaveBeenCalledWith(3600)
      expect(authStore.actionSetUser).toHaveBeenCalledWith(mockResponse.data.user)
      expect(authStore.initializeMatrixIfReady).toHaveBeenCalled()

      // Verify UI state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isSuccess).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).message).toBe('Email Verified Successfully!')

      // Verify success notification
      expect(mockNotify).toHaveBeenCalledWith({
        type: 'positive',
        message: 'Welcome to OpenMeet! Your email has been verified.',
        position: 'top',
        timeout: 3000
      })
    })

    it('should store event slug when provided', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: { id: '123', email: 'test@example.com' }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.verifyEmailCode).mockResolvedValue(mockResponse)

      const wrapper = await mountComponent({
        code: '123456',
        email: 'test@example.com',
        event: 'test-event-slug'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).eventSlug).toBe('test-event-slug')
    })

    it('should have null event slug when not provided', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: { id: '123', email: 'test@example.com' }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.verifyEmailCode).mockResolvedValue(mockResponse)

      const wrapper = await mountComponent({
        code: '123456',
        email: 'test@example.com'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).eventSlug).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid verification code', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Invalid verification code'
          }
        }
      }
      vi.mocked(authApi.verifyEmailCode).mockRejectedValue(mockError)

      const wrapper = await mountComponent({
        code: '999999',
        email: 'test@example.com'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isSuccess).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).message).toBe('Invalid verification code')

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Invalid verification code',
        position: 'top',
        timeout: 5000
      })
    })

    it('should handle expired verification code', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Verification code has expired'
          }
        }
      }
      vi.mocked(authApi.verifyEmailCode).mockRejectedValue(mockError)

      const wrapper = await mountComponent({
        code: '123456',
        email: 'test@example.com'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isSuccess).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).message).toBe('Verification code has expired')

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Verification code has expired',
        position: 'top',
        timeout: 5000
      })
    })

    it('should handle generic errors with fallback message', async () => {
      vi.mocked(authApi.verifyEmailCode).mockRejectedValue(new Error('Network error'))

      const wrapper = await mountComponent({
        code: '123456',
        email: 'test@example.com'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isSuccess).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).message).toBe('Verification failed')

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Verification failed',
        position: 'top',
        timeout: 5000
      })
    })
  })
})
