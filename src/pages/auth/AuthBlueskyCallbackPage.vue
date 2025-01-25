<template>
  <q-page class="flex flex-center">
    <q-spinner v-if="isProcessing" color="primary" size="3em" />
  </q-page>
</template>

<script setup lang="ts">
console.log('AuthBlueskyCallbackPage started')
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../stores/auth-store'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const $q = useQuasar()
const authStore = useAuthStore()
const isProcessing = ref(false)

const handleNavigation = async (targetRoute: string) => {
  // Use replace instead of push to avoid adding to history stack
  await router.replace({ name: targetRoute }, () => {
    console.log(`Navigation to ${targetRoute} completed`)
  }, (error) => {
    console.error(`Navigation to ${targetRoute} failed:`, error)
  })
  // window.location.href = targetRoute
}

onMounted(async () => {
  console.log('AuthBlueskyCallbackPage mounted')
  if (isProcessing.value) {
    console.log('Already processing Bluesky callback')
    return
  }

  isProcessing.value = true
  console.log('Starting Bluesky callback processing')

  try {
    // Store current URL parameters before clearing
    const params = new URLSearchParams(window.location.search)
    console.log('Processing callback with params:', params.toString())

    // Clear URL parameters without using history API directly
    await router.replace({
      path: route.path,
      query: {}
    })

    // Process the callback with stored parameters
    const success = await authStore.handleBlueskyCallback(params)
    console.log('Callback processing result:', success)

    if (success) {
      await handleNavigation('HomePage')
    } else {
      throw new Error('Login failed - missing required parameters')
    }
  } catch (error) {
    console.error('Bluesky callback processing failed:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to complete Bluesky login',
      position: 'top'
    })

    await handleNavigation('AuthLoginPage')
  } finally {
    isProcessing.value = false
    console.log('Finished Bluesky callback processing')
  }
})
</script>
