import { boot } from 'quasar/wrappers'
import { useAuthStore } from '../stores/auth-store'
import { useNotification } from '../composables/useNotification'
import { ref, readonly } from 'vue'
import { Router, useRouter } from 'vue-router'
import { getCrossTabTokenService } from '../services/CrossTabTokenService'

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
    // If already refreshing in this tab, return the existing promise
    if (isRefreshing.value && refreshPromise.value) {
      console.log('🔄 [auth-session] Already refreshing in this tab, reusing promise')
      return refreshPromise.value
    }

    const crossTabTokenService = getCrossTabTokenService()

    // Check if another tab is already refreshing
    if (crossTabTokenService.isAnyTabRefreshing()) {
      console.log('🔄 [auth-session] Another tab is refreshing, waiting...')

      // Wait for the other tab to complete
      const refreshCompleted = await crossTabTokenService.waitForRefresh(10000)

      if (refreshCompleted && authStore.token) {
        console.log('✅ [auth-session] Using refreshed token from another tab')
        return authStore.token
      }

      // If wait failed or no new token, try to refresh ourselves
      console.log('⚠️ [auth-session] Other tab refresh timeout or failed, attempting our own refresh')
    }

    // Try to acquire the refresh lock
    const lockAcquired = await crossTabTokenService.acquireRefreshLock()

    if (!lockAcquired) {
      // Another tab got the lock, wait for it
      console.log('🔄 [auth-session] Another tab acquired lock, waiting...')

      const refreshCompleted = await crossTabTokenService.waitForRefresh(10000)

      if (refreshCompleted && authStore.token) {
        return authStore.token
      } else {
        throw new Error('Token refresh failed in another tab')
      }
    }

    // We got the lock, proceed with refresh
    isRefreshing.value = true
    refreshPromise.value = authStore.actionRefreshToken()
      .then((token) => {
        // Release lock and broadcast success
        crossTabTokenService.releaseRefreshLock(
          true,
          token,
          authStore.refreshToken,
          authStore.tokenExpires as number
        )
        return token
      })
      .catch((err) => {
        console.error('Token refresh failed:', err)
        // Release lock and broadcast failure
        crossTabTokenService.releaseRefreshLock(false)
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

  // Register router guard for proactive token refresh
  // This runs BEFORE the main router guards in router/index.ts
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

    const authRoutes = ['AuthLoginPage', 'AuthRegisterPage', 'AuthForgotPasswordPage', 'AuthRestorePasswordPage']

    // Proactively check auth status and refresh token if needed (5 min before expiry)
    if (authStore.isAuthenticated) {
      try {
        const isAuthenticated = await authSession.checkAuthStatus()
        if (!isAuthenticated) {
          // Token refresh failed, redirect to login
          next({
            name: 'AuthLoginPage',
            query: { redirect: to.fullPath }
          })
          return
        }
      } catch (error) {
        console.error('Token refresh failed during navigation:', error)
        // Continue with navigation - axios interceptor will handle 401s as fallback
      }
    }

    // Check if user is trying to access auth pages while authenticated
    if (authStore.isAuthenticated && authRoutes.includes(to.name as string)) {
      // Allow OIDC flows even when authenticated
      if (to.query.oidc_flow === 'true') {
        next()
      } else {
        next({ name: 'HomePage' })
      }
      return
    }

    // Let other guards handle the rest
    next()
  })
})
