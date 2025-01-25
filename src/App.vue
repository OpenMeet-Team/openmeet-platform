<template>
  <div>
    <h1>SSR Test: {{ message }}</h1>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, useSSRContext } from 'vue'
import { Dark, useMeta } from 'quasar'
import getEnv from './utils/env'

const message = ref('Loading...')

// SSR data fetching
if (import.meta.env.SSR) {
  const ssrContext = useSSRContext()
  if (ssrContext) {
    ssrContext.meta = {
      title: 'SSR Test',
      description: 'Testing SSR setup',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' http://localhost:* https://localhost:*"
      ].join('; ')
    }
    message.value = 'Server Side Rendered!'
  }
}

// Client-side hydration
onMounted(() => {
  message.value = 'Client Side Hydrated!'
  const storedDarkMode = localStorage.getItem('darkMode')
  if (storedDarkMode !== null) {
    Dark.set(storedDarkMode === 'true')
  }
})

useMeta({
  title: '',
  titleTemplate: title => `${title} | ${getEnv('APP_TENANT_NAME')}`,
  meta: {
    description: { content: getEnv('APP_TENANT_DESCRIPTION') },
    'og:image': { content: getEnv('APP_TENANT_IMAGE') }
  }
})
</script>
