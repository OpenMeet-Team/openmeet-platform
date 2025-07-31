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

    // Initialize Matrix debug utilities in development
    if (import.meta.env.DEV) {
      console.log('🔍 Matrix debug utilities available at window.matrixDebug')
      console.log('🔍 Available methods:', Object.keys(matrixDebug))

      // Also expose matrixClientService for E2E testing
      const { matrixClientService } = await import('./services/matrixClientService')
      ;(window as unknown as { matrixClientService: unknown }).matrixClientService = matrixClientService
      console.log('🔍 Matrix client service available at window.matrixClientService (dev only)')
    }
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
})

onUnmounted(() => {
  versionService.destroy()
})
</script>
