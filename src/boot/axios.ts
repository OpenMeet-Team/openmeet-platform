import { boot } from 'quasar/wrappers'
import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from '../stores/auth-store'
import { useNotification } from '../composables/useNotification'
import { useVersionErrorHandling } from '../composables/useVersionErrorHandling'
import getEnv from '../utils/env'
import { getCrossTabTokenService } from '../services/CrossTabTokenService'

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

// Cross-tab token service instance
const crossTabTokenService = getCrossTabTokenService()

// Queue for requests waiting for token refresh
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

        // Handle token refresh with cross-tab coordination
        if (authStore.refreshToken) {
          // Check if another tab is already refreshing
          if (crossTabTokenService.isAnyTabRefreshing()) {
            console.log('🔄 Another tab is refreshing, waiting...')

            // Wait for the other tab to complete
            const refreshCompleted = await crossTabTokenService.waitForRefresh(10000)

            if (refreshCompleted) {
              // Check if we have new tokens (other tab should have updated localStorage)
              const updatedToken = authStore.token
              if (updatedToken && updatedToken !== originalRequest.headers.Authorization?.replace('Bearer ', '')) {
                console.log('✅ Using refreshed token from another tab')
                originalRequest.headers.Authorization = `Bearer ${updatedToken}`
                return api(originalRequest)
              }
            }

            // If wait failed or no new token, try to refresh ourselves
            console.log('⚠️ Other tab refresh timeout or failed, attempting our own refresh')
          }

          // Try to acquire the refresh lock
          const lockAcquired = await crossTabTokenService.acquireRefreshLock()

          if (!lockAcquired) {
            // Another tab got the lock first, queue this request
            console.log('🔄 Another tab acquired lock, queueing request for:', originalRequest.url)

            // Wait for refresh to complete
            const refreshCompleted = await crossTabTokenService.waitForRefresh(10000)

            if (refreshCompleted && authStore.token) {
              originalRequest.headers.Authorization = `Bearer ${authStore.token}`
              return api(originalRequest)
            } else {
              // Refresh failed or timed out
              authStore.actionClearAuth()
              error('Your session has expired. Please log in again.')
              router.push({
                name: 'AuthLoginPage',
                query: { redirect: router.currentRoute.value.fullPath }
              })
              return Promise.reject(new Error('Token refresh failed'))
            }
          }

          console.log('🔄 This tab is refreshing the token...')

          try {
            const newToken = await authStore.actionRefreshToken()
            console.log('✅ Token refresh successful')

            // Release lock and broadcast success with new tokens
            crossTabTokenService.releaseRefreshLock(
              true,
              newToken,
              authStore.refreshToken,
              authStore.tokenExpires as number
            )

            // Process all queued requests with the new token
            processQueue(null, newToken)

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return api(originalRequest)
          } catch (refreshError) {
            console.log('🔴 Token refresh failed:', refreshError)

            // Release lock and broadcast failure
            crossTabTokenService.releaseRefreshLock(false)

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
