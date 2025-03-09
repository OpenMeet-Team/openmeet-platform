<template>
  <router-view />
</template>

<script setup lang="ts">
import { Dark, useMeta } from 'quasar'
import { onBeforeMount, watch } from 'vue'
import getEnv from './utils/env'

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
  // Check if there's a saved preference in localStorage
  const storedDarkMode = localStorage.getItem('darkMode')

  if (storedDarkMode !== null) {
    // Use the stored preference
    const darkModePreference = storedDarkMode === 'true'
    Dark.set(darkModePreference)
  } else {
    // Default to light mode if no preference is stored
    Dark.set(false)
    localStorage.setItem('darkMode', 'false')
  }
})

// Watch for dark mode changes and save to localStorage
watch(() => Dark.isActive, (isDark) => {
  localStorage.setItem('darkMode', isDark.toString())
})
</script>
