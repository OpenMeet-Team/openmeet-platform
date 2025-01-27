<template>
  <q-page class="flex flex-center">
    <q-spinner-dots size="40px" color="primary" />
    <div class="q-mt-md">Processing login...</div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth-store'

console.log('AuthBlueskyCallbackPage start')
const authStore = useAuthStore()

onMounted(async () => {
  console.log('AuthBlueskyCallbackPage onMounted - START')
  try {
    const params = new URLSearchParams(window.location.search)
    const paramsObj = Object.fromEntries(params.entries())
    console.log('AuthBlueskyCallbackPage URL:', window.location.href)
    console.log('AuthBlueskyCallbackPage params object:', paramsObj)

    const success = await authStore.handleBlueskyCallback(params)
    console.log('Bluesky callback success:', success)

    if (success) {
      if (window.opener) {
        console.log('Closing popup and reloading parent')
        window.opener.location.reload()
        // window.close()
      } else {
        console.log('Redirecting to home')
        window.location.replace(window.location.origin + '/')
      }
    } else {
      throw new Error('Auth callback failed')
    }
  } catch (error) {
    console.error('Auth callback detailed error:', error)
    if (window.opener) {
      window.opener.postMessage({ error: 'Auth failed' }, window.location.origin)
      window.close()
    } else {
      window.location.replace(window.location.origin + '/auth/login')
    }
  }
})
</script>
