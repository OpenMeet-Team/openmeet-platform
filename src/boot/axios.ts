import { boot } from 'quasar/wrappers'
import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from 'stores/auth-store.ts'
import { useNotification } from 'src/composables/useNotification.ts'

declare module 'vue' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
    $api: AxiosInstance;
  }
}

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
// if testing set from env, otherwise use default tenant id
console.log('###### appEnv', process.env.APP_ENV)
console.log('###### tenantId', process.env.APP_TENANT_ID)
console.log('###### appApiUrl', process.env.APP_API_URL)
console.log('###### env', process.env)

const api = axios.create({ baseURL: process.env.APP_API_URL })
const { error } = useNotification()
export default boot(({ app, router }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api
  app.config.globalProperties.$axios = axios

  api.interceptors.request.use((config) => {
    const authStore = useAuthStore()
    const token = authStore?.token

    config.headers['X-Tenant-ID'] = process.env.APP_TENANT_ID

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
      } else if (err.response.status === 401 && originalRequest.url.includes('api/v1/auth/refresh')) {
        authStore.actionClearAuth()
        router.push({ name: 'HomePage' })
        return Promise.reject(err)
      } else if (err.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        await authStore.actionRefreshToken()
        originalRequest.headers.Authorization = `Bearer ${authStore?.token}`
        return api(originalRequest)
      }

      return Promise.reject(err)
    }
  )

  app.config.globalProperties.$api = api
})

export { api }
