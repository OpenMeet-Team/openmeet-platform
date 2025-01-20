<template>
  <q-page class="flex flex-center">
    <q-spinner-dots size="40px" color="primary" />
    <div class="q-mt-md">Processing login...</div>
  </q-page>
</template>

<script setup lang="ts">
import { useAuthStore } from 'stores/auth-store'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { onMounted } from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const $q = useQuasar()

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)

    // // Debug logging
    // console.log('Callback params:', {
    //   token: params.get('token')?.substring(0, 20) + '...',
    //   refreshToken: params.get('refreshToken')?.substring(0, 20) + '...',
    //   tokenExpires: params.get('tokenExpires'),
    //   user: params.get('user')
    // })

    const success = await authStore.handleBlueskyCallback(params)
    // console.log('Auth store callback result:', success)

    if (success) {
      // Clear the token from URL for security
      window.history.replaceState({}, document.title, window.location.pathname)
      // console.log('Redirecting to HomePage')
      await router.push({ name: 'HomePage' })
    } else {
      throw new Error('Login failed')
    }
  } catch (error) {
    console.error('Bluesky callback error:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to complete Bluesky login',
      // Add more error details in development
      caption: process.env.DEV ? (error as Error).message : undefined
    })
    await router.push({ name: 'AuthLoginPage' })
  }
})
</script>
