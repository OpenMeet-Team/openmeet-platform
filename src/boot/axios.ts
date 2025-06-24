import { boot } from 'quasar/wrappers'
import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from '../stores/auth-store'
import { useNotification } from '../composables/useNotification'
import { useVersionErrorHandling } from '../composables/useVersionErrorHandling'
import getEnv from '../utils/env'

declare module 'vue' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
    $api: AxiosInstance;
  }
}

// Create api without baseURL initially
const api = axios.create()
const { error } = useNotification()
const { handlePotentialVersionError } = useVersionErrorHandling()

// Global refresh state management
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })

  failedQueue = []
}

export default boot(async ({ app, router }) => {
  // Wait for config to be available
  while (!window.APP_CONFIG?.APP_API_URL) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  // Now we can safely set the baseURL
  api.defaults.baseURL = window.APP_CONFIG.APP_API_URL
  
  // Enable credentials for cross-domain requests to handle OIDC session cookies
  api.defaults.withCredentials = true

  // for use inside Vue files (Options API) through this.$axios and this.$api
  app.config.globalProperties.$axios = axios

  api.interceptors.request.use((config) => {
    const authStore = useAuthStore()
    const token = authStore?.token

    config.headers['X-Tenant-ID'] = getEnv('QENV') === 'test' ? 'testing' : window.APP_CONFIG?.APP_TENANT_ID || getEnv('APP_TENANT_ID')

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  }, (err) => Promise.reject(err))

  api.interceptors.response.use(
    (response) => response,
    async (err) => {
      const originalRequest = err.config
      const authStore = useAuthStore()

      if (err.response && err.response.status === 422) {
        Object.values(err.response.data.errors).forEach(message => error(message as string))
      } else if (err.response?.status === 401) {
        console.log('🔴 401 Error in axios interceptor:', {
          url: originalRequest.url,
          hasRefreshToken: !!authStore.refreshToken,
          alreadyRetried: originalRequest._retry,
          refreshTokenValue: authStore.refreshToken ? authStore.refreshToken.substring(0, 20) + '...' : 'null'
        })

        if (originalRequest.url.includes('api/v1/auth/refresh')) {
          console.log('🔴 Refresh token request failed, clearing auth')
          // Refresh token request failed
          authStore.actionClearAuth()
          error('Your session has expired. Please log in again.')
          router.push({
            name: 'AuthLoginPage',
            query: { redirect: router.currentRoute.value.fullPath }
          })
          return Promise.reject(err)
        }

        // Handle token refresh with deduplication
        if (authStore.refreshToken) {
          if (isRefreshing) {
            // If refresh is already in progress, queue this request
            console.log('🔄 Refresh in progress, queueing request for:', originalRequest.url)
            return new Promise((resolve, reject) => {
              failedQueue.push({
                resolve: (token: string) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`
                  resolve(api(originalRequest))
                },
                reject: (error: unknown) => {
                  reject(error)
                }
              })
            })
          }

          // Mark that we're refreshing to prevent concurrent attempts
          isRefreshing = true
          console.log('🔄 Starting token refresh...')

          try {
            const newToken = await authStore.actionRefreshToken()
            console.log('✅ Token refresh successful, processing queued requests')

            // Process all queued requests with the new token
            processQueue(null, newToken)

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return api(originalRequest)
          } catch (refreshError) {
            console.log('🔴 Token refresh failed:', refreshError)

            // Process queue with error (this will reject all queued requests)
            processQueue(refreshError, null)

            // Clear auth and redirect only on actual refresh failure
            authStore.actionClearAuth()
            error('Your session has expired. Please log in again.')
            router.push({
              name: 'AuthLoginPage',
              query: { redirect: router.currentRoute.value.fullPath }
            })
            return Promise.reject(refreshError)
          } finally {
            // Reset refresh state
            isRefreshing = false
          }
        } else if (originalRequest.url.includes('/api/v1/auth/')) {
          // Don't show error for auth-related endpoints
          return Promise.reject(err)
        } else if (originalRequest.headers.Authorization) {
          // If we had an Authorization header but got 401 and can't refresh
          error('Authentication required for this action')
          router.push({
            name: 'AuthLoginPage',
            query: { redirect: router.currentRoute.value.fullPath }
          })
          return Promise.reject(err)
        }
        // For requests without Authorization that get 401, just pass through the error
        // This allows public pages to handle auth requirements gracefully
      }

      handlePotentialVersionError(err)
      return Promise.reject(err)
    }
  )

  app.config.globalProperties.$api = api
})

export { api }
