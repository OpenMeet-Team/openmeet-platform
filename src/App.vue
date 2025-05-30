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
    await versionService.initializeVersionChecking()
    setupGlobalErrorHandling()
  } catch (error) {
    console.error('Failed to initialize version checking:', error)
  }
})

onUnmounted(() => {
  versionService.destroy()
})
</script>
