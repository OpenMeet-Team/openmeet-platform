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
    console.log('AuthBlueskyCallbackPage window.opener', window.opener)

    if (success) {
      if (window.opener) {
        // Send success message to parent window
        window.opener.postMessage({ success: true }, window.location.origin)
        window.close()
      } else {
        loginError.value = 'No opener found'
        // window.location.replace(window.location.origin + '/')
      }
    } else {
      throw new Error('Auth callback failed')
    }
  } catch (error) {
    console.error('Auth callback detailed error:', error)
    if (window.opener) {
      window.opener.postMessage({ error: error.message, test: 'tom' }, window.location.origin)
      window.close()
    } else {
      loginError.value = 'No opener found'
      // window.location.replace(window.location.origin + '/auth/login')
    }
  }
})
</script>
