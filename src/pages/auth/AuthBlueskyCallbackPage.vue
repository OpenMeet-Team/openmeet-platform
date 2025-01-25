<template>
  <q-page class="flex flex-center">
    <q-spinner-dots size="40px" color="primary" />
    <div class="q-mt-md">Processing login...</div>
  </q-page>
</template>

<script setup lang="ts">
import { useAuthStore } from '../../stores/auth-store'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { onMounted } from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const $q = useQuasar()

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const success = await authStore.handleBlueskyCallback(params)

    if (success) {
      // Clear the token from URL for security
      window.history.replaceState({}, document.title, window.location.pathname)
      await router.push({ name: 'HomePage' })
    } else {
      throw new Error('Login failed')
    }
  } catch (error) {
    console.error('Bluesky callback error:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to complete Bluesky login'
    })
    await router.push({ name: 'AuthLoginPage' })
  }
})
</script>
