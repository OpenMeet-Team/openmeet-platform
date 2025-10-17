<template>
  <router-view />
  <UpdateNotificationComponent />
</template>

<script setup lang="ts">
import { Dark, useMeta } from 'quasar'
import { onBeforeMount, onMounted, onUnmounted } from 'vue'
import getEnv from './utils/env'
import UpdateNotificationComponent from './components/common/UpdateNotificationComponent.vue'
import { versionService } from './services/versionService'
import { setupGlobalErrorHandling } from './composables/useVersionErrorHandling'
import { useAuthStore } from './stores/auth-store'
import matrixDebug from './utils/matrixDebug'
import { logger } from './utils/logger'

defineOptions({
  name: 'App'
})

useMeta({
  title: '',
  titleTemplate: title => `${title} | ${getEnv('APP_TENANT_NAME')}`,
  meta: {
    description: { content: getEnv('APP_TENANT_DESCRIPTION') },
    'og:image': { content: getEnv('APP_TENANT_IMAGE') }
  }
})

// Cross-tab auth sync handler - store reference for cleanup
const authStore = useAuthStore()
const handleStorageChange = (event: StorageEvent) => {
  // Handle token changes (login/logout/refresh in another tab)
  // Note: Storage events only fire in OTHER tabs, not the tab that made the change
  if (event.key === 'token') {
    // Token was removed (logout in another tab)
    if (event.newValue === null && event.oldValue !== null) {
      logger.debug('🚪 User logged out in another tab, reloading page')
      // Don't call actionClearAuth() - storage was already cleared by the other tab
      // Just reload to update UI to logged-out state
      window.location.reload()
    } else if (event.newValue !== null && event.oldValue === null) {
      // Token was added (login in another tab)
      logger.debug('🔑 User logged in on another tab, reloading page')
      window.location.reload()
    } else if (event.newValue !== null && event.oldValue !== null && event.newValue !== event.oldValue) {
      // Token was refreshed in another tab
      logger.debug('🔄 Token refreshed in another tab, updating local store')
      // Update only the token in the store without resetting entire state
      // This preserves Matrix client state and other per-tab data
      // Skip localStorage write since it's already there (prevents infinite loop)
      authStore.actionSetToken(event.newValue, true)
    }
  }
  // Also sync refresh token changes
  if (event.key === 'refreshToken' && event.newValue !== null && event.newValue !== event.oldValue) {
    logger.debug('🔄 Refresh token updated in another tab')
    // Update only the refresh token without affecting Matrix state
    // Skip localStorage write since it's already there (prevents infinite loop)
    authStore.actionSetRefreshToken(event.newValue, true)
  }
  // Also sync token expiration changes
  if (event.key === 'tokenExpires' && event.newValue !== null && event.newValue !== event.oldValue) {
    logger.debug('🔄 Token expiration updated in another tab')
    // Skip localStorage write since it's already there (prevents infinite loop)
    authStore.actionSetTokenExpires(Number(event.newValue), true)
  }
}

onBeforeMount(() => {
  const storedDarkMode = localStorage.getItem('darkMode')
  if (storedDarkMode !== null) {
    const darkModePreference = storedDarkMode === 'true'
    Dark.set(darkModePreference)
  }
})

onMounted(async () => {
  try {
    // Initialize auth first
    await authStore.initializeAuth()

    // Set up cross-tab authentication sync
    window.addEventListener('storage', handleStorageChange)

    // Then initialize version checking
    await versionService.initializeVersionChecking()
    setupGlobalErrorHandling()

    // Matrix client initialization is now handled by auth store when user logs in
    // This ensures Matrix is initialized after login and cleared after logout

    // Initialize Matrix debug utilities - ONLY expose in secure development environments
    const isDev = import.meta.env.DEV
    const currentMode = import.meta.env.MODE
    const nodeEnv = process.env.NODE_ENV
    const qEnv = process.env.QENV
    const hostname = window.location.hostname
    const isTest = currentMode === 'test' || nodeEnv === 'test' || qEnv === 'test'

    // SECURITY: Only expose in true development environments, never in production
    // Removed localhost check as it can be true in production docker deployments
    const shouldExposeMatrixClient = (isDev && isTest) ||
      (nodeEnv === 'development' && (hostname === 'localhost' || hostname === '127.0.0.1')) ||
      (currentMode === 'development' && !import.meta.env.PROD)

    logger.debug('🔍🔍🔍 MATRIX DEBUG ENVIRONMENT CHECK 🔍🔍🔍')
    logger.debug('DEV:', isDev)
    logger.debug('MODE:', currentMode)
    logger.debug('NODE_ENV:', nodeEnv)
    logger.debug('QENV:', qEnv)
    logger.debug('hostname:', hostname)
    logger.debug('isTest:', isTest)
    logger.debug('shouldExposeDebug:', shouldExposeMatrixClient)
    logger.debug('🔍🔍🔍 END ENVIRONMENT CHECK 🔍🔍🔍')

    if (shouldExposeMatrixClient) {
      // Expose safe debugging utilities to window
      ;(window as unknown as { matrixDebug: unknown }).matrixDebug = matrixDebug
      logger.debug('🔍 Matrix debug utilities available at window.matrixDebug')
      logger.debug('🔍 Available methods:', Object.keys(matrixDebug))

      // SECURITY: Only expose matrixClientManager in test environments for E2E testing
      // Never expose in any production-like environment to prevent credential leakage
      if (isTest && (qEnv === 'test' || currentMode === 'test')) {
        const { matrixClientManager } = await import('./services/MatrixClientManager')
        ;(window as unknown as { matrixClientManager: unknown }).matrixClientManager = matrixClientManager
        logger.debug('🔍 Matrix client manager available at window.matrixClientManager (TEST ONLY)')
      } else {
        logger.debug('🔒 Matrix client manager NOT exposed (production security)')
      }

      // Set a flag so we know debugging is enabled
      ;(window as unknown as { MATRIX_DEBUG_ENABLED: boolean }).MATRIX_DEBUG_ENABLED = true
      logger.debug('🔍 Matrix debugging enabled flag set to true')
    } else {
      logger.debug('🔒 Matrix debugging disabled (production environment)')
    }
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
})

onUnmounted(() => {
  // Clean up storage event listener
  window.removeEventListener('storage', handleStorageChange)
  versionService.destroy()
})
</script>
