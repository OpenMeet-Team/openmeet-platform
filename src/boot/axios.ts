import { boot } from 'quasar/wrappers'
import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from '../stores/auth-store'
import { useNotification } from '../composables/useNotification'
import { useAuthSession } from './auth-session'
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

export default boot(async ({ app }) => {
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
      const authSession = useAuthSession()
      const authStore = useAuthStore()

      if (err.response && err.response.status === 422) {
        Object.values(err.response.data.errors).forEach(message => error(message as string))
      } else if (err.response.status === 401) {
        if (originalRequest.url.includes('api/v1/auth/refresh')) {
          // Refresh token request failed
          authSession.handleAuthError()
          return Promise.reject(err)
        }

        if (!originalRequest._retry) {
          originalRequest._retry = true
          try {
            await authSession.refreshToken()
            originalRequest.headers.Authorization = `Bearer ${authStore?.token}`
            return api(originalRequest)
          } catch (refreshError) {
            // Token refresh failed, session will be cleared by handleAuthError
            return Promise.reject(refreshError)
          }
        }
      }

      return Promise.reject(err)
    }
  )

  app.config.globalProperties.$api = api
})

export { api }
