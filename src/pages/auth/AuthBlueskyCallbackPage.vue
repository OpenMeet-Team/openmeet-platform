<template>
  <q-page class="flex flex-center">
    <q-spinner-dots size="40px" color="primary" />
    <div class="q-mt-md">Processing login...</div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth-store'

const authStore = useAuthStore()

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)

    const success = await authStore.handleBlueskyCallback(params)

    if (success) {
      if (window.opener) {
        window.opener.location.reload()
        window.close()
      } else {
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
