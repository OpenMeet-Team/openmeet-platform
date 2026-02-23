import { mount, flushPromises } from '@vue/test-utils'
import TokenLoginPage from '../TokenLoginPage.vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar } from 'quasar'
import { authApi } from '../../../api/auth'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../../stores/auth-store'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// Mock the authApi
vi.mock('../../../api/auth', () => ({
  authApi: {
    exchangeLoginLink: vi.fn(),
    getMe: vi.fn()
  }
}))

describe('TokenLoginPage', () => {
  let authStore: ReturnType<typeof useAuthStore>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    vi.clearAllMocks()
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
        { path: '/auth/token-login', name: 'TokenLoginPage', component: TokenLoginPage },
        { path: '/', name: 'HomePage', component: { template: '<div>Home</div>' } },
        { path: '/events/:slug', name: 'EventPage', component: { template: '<div>Event</div>' } },
        { path: '/auth/login', name: 'AuthLoginPage', component: { template: '<div>Login</div>' } }
      ]
    })
  })

  const mountComponent = async (queryParams = {}) => {
    await router.push({
      name: 'TokenLoginPage',
      query: queryParams
    })

    const wrapper = mount(TokenLoginPage, {
      global: {
        plugins: [Quasar, router],
        stubs: {
          // Stub QPage to just render its slot, avoiding "QPage needs to be a deep child of QLayout" warning
          'q-page': {
            template: '<div><slot /></div>'
          }
        }
      }
    })

    await flushPromises()
    return wrapper
  }

  describe('Missing Parameters', () => {
    it('should show error when code is missing', async () => {
      const wrapper = await mountComponent({})

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).errorMessage).toBeTruthy()

      // Should not call the API
      expect(authApi.exchangeLoginLink).not.toHaveBeenCalled()

      // Should show the error UI with a link to login
      expect(wrapper.text()).toContain('Login link expired or invalid')
    })
  })

  describe('Successful Token Exchange', () => {
    it('should exchange code for tokens and redirect to home by default', async () => {
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
      vi.mocked(authApi.exchangeLoginLink).mockResolvedValue(mockResponse)

      await mountComponent({
        code: 'abc123'
      })

      // Verify API was called with the code
      expect(authApi.exchangeLoginLink).toHaveBeenCalledWith('abc123')

      // Verify auth store was updated
      expect(authStore.actionSetToken).toHaveBeenCalledWith('test-token')
      expect(authStore.actionSetRefreshToken).toHaveBeenCalledWith('test-refresh-token')
      expect(authStore.actionSetTokenExpires).toHaveBeenCalledWith(3600)
      expect(authStore.actionSetUser).toHaveBeenCalledWith(mockResponse.data.user)

      // Verify redirect to home (default)
      expect(router.currentRoute.value.path).toBe('/')
    })

    it('should redirect to the specified redirect path', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: {
            id: '123',
            email: 'test@example.com'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.exchangeLoginLink).mockResolvedValue(mockResponse)

      await mountComponent({
        code: 'abc123',
        redirect: '/events/my-event'
      })

      expect(authApi.exchangeLoginLink).toHaveBeenCalledWith('abc123')
      expect(router.currentRoute.value.path).toBe('/events/my-event')
    })

    it('should sanitize redirect param and reject absolute URLs', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: {
            id: '123',
            email: 'test@example.com'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.exchangeLoginLink).mockResolvedValue(mockResponse)

      await mountComponent({
        code: 'abc123',
        redirect: 'https://evil.com/steal-tokens'
      })

      // Should redirect to home, not the malicious URL
      expect(router.currentRoute.value.path).toBe('/')
    })

    it('should sanitize redirect param and reject protocol-relative URLs', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: {
            id: '123',
            email: 'test@example.com'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.exchangeLoginLink).mockResolvedValue(mockResponse)

      await mountComponent({
        code: 'abc123',
        redirect: '//evil.com/steal-tokens'
      })

      // Should redirect to home, not the malicious URL
      expect(router.currentRoute.value.path).toBe('/')
    })
  })

  describe('Error Handling', () => {
    it('should show error message when API returns error', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Login link has expired'
          }
        }
      }
      vi.mocked(authApi.exchangeLoginLink).mockRejectedValue(mockError)

      const wrapper = await mountComponent({
        code: 'expired-code'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).errorMessage).toBeTruthy()

      // Should show error UI
      expect(wrapper.text()).toContain('Login link expired or invalid')
    })

    it('should show fallback error message for generic errors', async () => {
      vi.mocked(authApi.exchangeLoginLink).mockRejectedValue(new Error('Network error'))

      const wrapper = await mountComponent({
        code: 'some-code'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).errorMessage).toBeTruthy()

      expect(wrapper.text()).toContain('Login link expired or invalid')
    })

    it('should show a link to the login page on error', async () => {
      vi.mocked(authApi.exchangeLoginLink).mockRejectedValue(new Error('fail'))

      const wrapper = await mountComponent({
        code: 'bad-code'
      })

      // Should have a link to the login page
      const loginLink = wrapper.find('[data-cy="token-login-go-to-login"]')
      expect(loginLink.exists()).toBe(true)
    })
  })

  describe('Loading State', () => {
    it('should show loading state while exchanging token', async () => {
      // Create a promise that we control
      let resolveExchange: (value: unknown) => void
      const exchangePromise = new Promise((resolve) => {
        resolveExchange = resolve
      })
      vi.mocked(authApi.exchangeLoginLink).mockReturnValue(exchangePromise as never)

      // Mount without flushing all promises
      await router.push({
        name: 'TokenLoginPage',
        query: { code: 'abc123' }
      })

      const wrapper = mount(TokenLoginPage, {
        global: {
          plugins: [Quasar, router],
          stubs: {
            'q-page': {
              template: '<div><slot /></div>'
            }
          }
        }
      })

      // Should be loading immediately after mount triggers onMounted
      await wrapper.vm.$nextTick()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(true)

      // Now resolve the exchange
      resolveExchange!({
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: { id: '123', email: 'test@example.com' }
        }
      })

      await flushPromises()

      // After successful exchange, loading should be false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((wrapper.vm as any).isLoading).toBe(false)
    })
  })
})
