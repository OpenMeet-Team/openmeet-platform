import { boot } from 'quasar/wrappers'
import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from 'stores/auth-store.ts'
import { useRouter } from 'vue-router'

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
const api = axios.create({ baseURL: process.env.APP_API_URL })
export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  api.interceptors.request.use((config) => {
    if (process.env.APP_TENANT_ID) {
      config.headers['X-Tenant-ID'] = process.env.APP_TENANT_ID
    }

    if (useAuthStore().token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${useAuthStore().token}`
    }

    return config
  }, (error) => Promise.reject(error))

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      const router = useRouter()

      if (error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          const newToken = await useAuthStore().actionRefreshToken()
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        } catch (refreshError) {
          // Handle refresh failure
          await useAuthStore().actionLogout().then(() => router.push({ name: 'AuthLoginPage' }))
          return Promise.reject(refreshError)
        }
      }

      return Promise.reject(error)
    }
  )

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api }
