<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="flex flex-center column">
        <q-spinner-dots size="40" color="primary" />
        <div class="q-mt-md">Processing login...</div>
        <div v-if="error" class="text-negative q-mt-sm">{{ error }}</div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'stores/auth-store'
import { useRouter } from 'vue-router'

console.log('AuthBlueskyCallbackPage script loaded')

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const error = ref('')

async function handleBlueskyCallback () {
  console.log('handleBlueskyCallback called')
  try {
    const params = new URLSearchParams(window.location.search)
    console.log('URL params:', Object.fromEntries(params.entries()))

    const success = await authStore.handleBlueskyCallback(params)
    console.log('Callback handled with success:', success)

    if (success && authStore.isAuthenticated) {
      console.log('Authentication successful, redirecting to home')
      await router.push('/')
    } else {
      throw new Error('Authentication failed')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Bluesky callback error:', err)
    error.value = message
    $q.notify({
      type: 'negative',
      message: 'Failed to complete Bluesky login',
      caption: process.env.DEV ? message : undefined
    })
    setTimeout(async () => {
      await router.push('/auth/login')
    }, 2000)
  }
}

onMounted(() => {
  console.log('AuthBlueskyCallbackPage mounted')
  handleBlueskyCallback()
})
</script>
