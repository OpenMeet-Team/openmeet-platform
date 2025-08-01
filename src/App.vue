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
    const authStore = useAuthStore()
    await authStore.initializeAuth()

    // Then initialize version checking
    await versionService.initializeVersionChecking()
    setupGlobalErrorHandling()

    // Initialize Matrix debug utilities - ALWAYS expose in test environments
    const isDev = import.meta.env.DEV
    const currentMode = import.meta.env.MODE
    const nodeEnv = process.env.NODE_ENV
    const qEnv = process.env.QENV
    const hostname = window.location.hostname
    const isTest = currentMode === 'test' || nodeEnv === 'test' || qEnv === 'test'
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
    const shouldExposeMatrixClient = isDev || isTest || isLocalhost

    logger.debug('🔍🔍🔍 MATRIX DEBUG ENVIRONMENT CHECK 🔍🔍🔍')
    logger.debug('DEV:', isDev)
    logger.debug('MODE:', currentMode)
    logger.debug('NODE_ENV:', nodeEnv)
    logger.debug('QENV:', qEnv)
    logger.debug('hostname:', hostname)
    logger.debug('isTest:', isTest)
    logger.debug('isLocalhost:', isLocalhost)
    logger.debug('shouldExposeDebug:', shouldExposeMatrixClient)
    logger.debug('🔍🔍🔍 END ENVIRONMENT CHECK 🔍🔍🔍')

    if (shouldExposeMatrixClient) {
      // Expose matrixDebug to window
      ;(window as unknown as { matrixDebug: unknown }).matrixDebug = matrixDebug
      logger.debug('🔍 Matrix debug utilities available at window.matrixDebug')
      logger.debug('🔍 Available methods:', Object.keys(matrixDebug))

      // Also expose matrixClientService for E2E testing
      const { matrixClientService } = await import('./services/matrixClientService')
      ;(window as unknown as { matrixClientService: unknown }).matrixClientService = matrixClientService
      logger.debug('🔍 Matrix client service available at window.matrixClientService')

      // Set a flag so we know debugging is enabled
      ;(window as unknown as { MATRIX_DEBUG_ENABLED: boolean }).MATRIX_DEBUG_ENABLED = true
      logger.debug('🔍 Matrix debugging enabled flag set to true')
    } else {
      logger.debug('🔍 Not exposing Matrix debugging (not dev, test, or localhost)')
    }
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
})

onUnmounted(() => {
  versionService.destroy()
})
</script>
