<template>
  <q-page class="flex flex-center">
    <q-spinner-dots size="40px" color="primary" />
    <div class="q-mt-md">Processing login...</div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, nextTick } from 'vue'
import { useAuthStore } from '../../stores/auth-store'

const authStore = useAuthStore()

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const success = await authStore.handleBlueskyCallback(params)

    if (success) {
      // Wait for next tick to ensure page is loaded
      await nextTick()
      // Force clean URL and navigate
      console.log('Clearing URL:', window.location.pathname)
      window.location.replace(window.location.origin + '/')
      console.log('Navigated to home')
    } else {
      throw new Error('Auth callback failed')
    }
  } catch (error) {
    console.error('Auth callback error:', error)
    window.location.replace(window.location.origin + '/auth/login')
    console.log('Navigated to login')
  }
})
</script>
