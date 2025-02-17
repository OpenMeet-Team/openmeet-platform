import { boot } from 'quasar/wrappers'
import { useAuthStore } from '../stores/auth-store'
import { useNotification } from '../composables/useNotification'
import { ref, readonly } from 'vue'
import { useRouter } from 'vue-router'

// Create reactive state
const isRefreshing = ref(false)
const refreshPromise = ref<Promise<string> | null>(null)

// Create auth session management
export const useAuthSession = () => {
  const authStore = useAuthStore()
  const { error } = useNotification()
  const router = useRouter()

  const checkAuthStatus = async () => {
    if (!authStore.isAuthenticated) {
      return false
    }

    // Check if token needs refresh
    const tokenExpires = authStore.tokenExpires
    const now = Date.now()
    const threshold = 5 * 60 * 1000 // 5 minutes before expiry

    if (tokenExpires && now + threshold >= tokenExpires) {
      try {
        await refreshToken()
      } catch (err) {
        console.error('Failed to refresh token:', err)
        handleAuthError()
        return false
      }
    }

    return true
  }

  const refreshToken = async () => {
    // If already refreshing, return the existing promise
    if (isRefreshing.value && refreshPromise.value) {
      return refreshPromise.value
    }

    isRefreshing.value = true
    refreshPromise.value = authStore.actionRefreshToken()
      .catch((err) => {
        console.error('Token refresh failed:', err)
        handleAuthError()
        throw err
      })
      .finally(() => {
        isRefreshing.value = false
        refreshPromise.value = null
      })

    return refreshPromise.value
  }

  const handleAuthError = () => {
    authStore.actionClearAuth()
    error('Your session has expired. Please log in again.')
    router.push({
      name: 'AuthLoginPage',
      query: { redirect: router.currentRoute.value.fullPath }
    })
  }

  return {
    isRefreshing: readonly(isRefreshing),
    checkAuthStatus,
    refreshToken,
    handleAuthError
  }
}

export default boot(({ app, router }) => {
  // Make useAuthSession available globally
  app.config.globalProperties.$authSession = useAuthSession()

  // Enhance router navigation guard
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()
    const authSession = useAuthSession()

    const authRoutes = ['AuthLoginPage', 'AuthRegisterPage', 'AuthForgotPasswordPage', 'AuthRestorePasswordPage']

    if (to.matched.some(record => record.meta.requiresAuth)) {
      // Check auth status before proceeding
      const isAuthenticated = await authSession.checkAuthStatus()

      if (!isAuthenticated) {
        next({
          name: 'AuthLoginPage',
          query: { redirect: to.fullPath }
        })
      } else {
        next()
      }
    } else {
      if (authStore.isAuthenticated && authRoutes.includes(to.name as string)) {
        next({ name: 'HomePage' })
      } else {
        next()
      }
    }
  })
})
