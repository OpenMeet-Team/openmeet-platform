<template>
  <router-view />
</template>

<script setup lang="ts">
import { Dark, useMeta } from 'quasar'
import { onBeforeMount } from 'vue'
import getEnv from './utils/env'

defineOptions({
  name: 'App'
})

useMeta({
  title: '',
  titleTemplate: title => `${title} | ${getEnv('APP_TENANT_NAME') || 'OpenMeet'}`,
  meta: {
    description: { content: getEnv('APP_TENANT_DESCRIPTION') || 'Building communities' },
    'og:image': { content: getEnv('APP_TENANT_IMAGE') || '/default-image.jpg' }
  }
})

onBeforeMount(() => {
  const storedDarkMode = localStorage.getItem('darkMode')
  if (storedDarkMode !== null) {
    const darkModePreference = storedDarkMode === 'true'
    Dark.set(darkModePreference)
  }
})
</script>
