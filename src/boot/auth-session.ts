import { boot } from 'quasar/wrappers'
import { useAuthStore } from '../stores/auth-store'
import { useNotification } from '../composables/useNotification'
import { ref, readonly } from 'vue'
import { Router, useRouter } from 'vue-router'

// Create reactive state
const isRefreshing = ref(false)
const refreshPromise = ref<Promise<string> | null>(null)

// Create auth session factory that takes router as a parameter
export const createAuthSession = (router: Router) => {
  const authStore = useAuthStore()
  const { error } = useNotification()

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

// Composable for use in Vue components
export const useAuthSession = () => {
  // This will throw an error if called outside of a setup function
  // Import and use the global $authSession instead in services
  const router = useRouter()
  return createAuthSession(router)
}

export default boot(({ app, router }) => {
  // Create an instance with the router and store it globally
  const authSession = createAuthSession(router)

  // Make authSession available globally
  app.config.globalProperties.$authSession = authSession

  // Enhance router navigation guard
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

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
