<template>
  <q-page class="flex flex-center">
    <q-spinner-dots size="40px" color="primary" />
    <div class="q-mt-md">Processing login...</div>
    <div class="q-mt-md">{{ loginError }}</div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth-store'

const authStore = useAuthStore()
const loginError = ref('')
onMounted(async () => {
  try {
    console.log('AuthBlueskyCallbackPage mounted')
    const params = new URLSearchParams(window.location.search)
    const success = await authStore.handleBlueskyCallback(params)

    console.log('AuthBlueskyCallbackPage success', success)

    if (success) {
      // Check if user needs to provide email
      const user = authStore.getUser
      if (!user.email) {
        window.location.replace('/auth/collect-email')
      } else {
        // Get the return URL from localStorage, or default to home
        const returnUrl = localStorage.getItem('bluesky_auth_return_url') || '/'
        localStorage.removeItem('bluesky_auth_return_url') // Clean up

        // Redirect back to the original page
        window.location.replace(returnUrl)
      }
    } else {
      throw new Error('Auth callback failed')
    }
  } catch (error) {
    console.error('Auth callback detailed error:', error)
    loginError.value = error.message || 'Authentication failed'

    // Redirect to login page after a short delay
    setTimeout(() => {
      window.location.replace('/auth/login')
    }, 3000)
  }
})
</script>
