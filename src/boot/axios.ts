import { boot } from 'quasar/wrappers'
import axios, { AxiosInstance } from 'axios'
import * as process from 'node:process'

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

    return config
  })

  api.interceptors.response.use(
    response => response,
    error => {
      console.error('API error:', error)
      return Promise.reject(error)
    }
  )

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api }
