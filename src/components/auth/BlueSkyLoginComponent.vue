<!-- platform/src/components/auth/BlueskyLoginComponent.vue -->
<template>
  <div class="c-bluesky-login-component row justify-center">
    <q-btn
      :loading="isLoading"
      :disable="isLoading"
      no-caps
      @click="handleBlueskyLogin"
    >
      <template v-slot:default>
        <div class="row items-center no-wrap">
          <q-icon name="img:/bluesky-logo.svg" size="18px" class="q-mr-sm" />
          <span>{{ buttonText }}</span>
        </div>
      </template>

      <template v-slot:loading>
        <q-spinner-dots color="white" size="24px" />
      </template>
    </q-btn>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import getEnv from '../../utils/env'

const props = withDefaults(defineProps<{
  text?: 'join_with' | 'signin_with' | 'signup_with' | 'continue_with'
}>(), {
  text: 'join_with'
})

const isLoading = ref(false)
const $q = useQuasar()

const buttonText = computed(() => {
  const textMap = {
    join_with: 'Join with Bluesky',
    signin_with: 'Sign in with Bluesky',
    signup_with: 'Sign up with Bluesky',
    continue_with: 'Continue with Bluesky'
  }
  return textMap[props.text]
})

const handleBlueskyLogin = async () => {
  try {
    isLoading.value = true

    // Open a dialog to get the Bluesky handle
    $q.dialog({
      title: 'Enter your Bluesky handle',
      message: 'Please enter your Bluesky handle (e.g., alice.bsky.social)',
      prompt: {
        model: '',
        type: 'text'
      },
      cancel: true,
      persistent: true
    }).onOk(async (handle) => {
      try {
        const baseUrl = getEnv('APP_API_URL')
        const tenantId = getEnv('APP_TENANT_ID')

        // Get the authorization URL from the backend
        const response = await fetch(
          `${baseUrl}/api/v1/auth/bluesky/authorize?handle=${encodeURIComponent(handle)}&tenantId=${tenantId}`
        )
        // const { url } = await response.json()
        const url = await response.text()

        if (!url) {
          throw new Error('No authorization URL received')
        }

        // Open in popup window
        const width = 600
        const height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2

        const popup = window.open(
          url,
          'bluesky-auth',
          `width=${width},height=${height},left=${left},top=${top}`
        )

        if (popup) {
          // Add message event listener to handle auth result
          const messageHandler = (event: MessageEvent) => {
            // Verify the origin matches our window
            if (event.origin !== window.location.origin) return

            // Handle success or error
            if (event.data.error) {
              $q.notify({
                type: 'negative',
                message: 'Authentication failed'
              })
            } else {
              // Handle successful authentication
              window.location.reload()
            }

            // Clean up
            window.removeEventListener('message', messageHandler)
            clearInterval(timer)
            isLoading.value = false
          }

          window.addEventListener('message', messageHandler)

          // Check periodically if the popup is closed
          const timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer)
              window.removeEventListener('message', messageHandler)
              isLoading.value = false
            }
          }, 500)
        }
      } catch (error) {
        console.error('Failed to get auth URL:', error)
        $q.notify({
          type: 'negative',
          message: 'Failed to initiate Bluesky login'
        })
        isLoading.value = false
      }
    }).onCancel(() => {
      isLoading.value = false
    })
  } catch (error) {
    console.error('Bluesky auth error:', error)
    $q.notify({
      type: 'negative',
      message: 'Bluesky authentication failed'
    })
    isLoading.value = false
  }
}

</script>

<style scoped>
.q-dialog :deep(.q-field) {
  margin: 8px 0;
}
</style>
