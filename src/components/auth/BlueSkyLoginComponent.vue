<template>
<!-- platform/src/components/auth/BlueskyLoginComponent.vue -->
  <div class="c-bluesky-login-component row justify-center">
    <q-btn
      data-cy="bluesky-login-button"
      :loading="isLoading"
      :disable="isLoading"
      no-caps
      outline
      class="bluesky-button"
      @click="handleBlueskyLogin"
      style="width: 100%; height: 40px;"
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
import { Capacitor } from '@capacitor/core'
import getEnv from '../../utils/env'

type LoginText = 'join_with' | 'signin_with' | 'signup_with' | 'continue_with'

const props = defineProps({
  text: {
    type: String as () => LoginText,
    default: 'join_with',
    validator: (value: string): value is LoginText => {
      return ['join_with', 'signin_with', 'signup_with', 'continue_with'].includes(value)
    }
  }
})

const isLoading = ref(false)
const $q = useQuasar()

const buttonText = computed(() => {
  const textMap = {
    join_with: 'Join with AT Protocol',
    signin_with: 'Sign in with AT Protocol',
    signup_with: 'Sign in with AT Protocol',
    continue_with: 'Continue with AT Protocol'
  }
  return textMap[props.text]
})

const handleBlueskyLogin = async () => {
  try {
    isLoading.value = true

    // Open a dialog to get the Bluesky handle
    $q.dialog({
      title: 'Enter your AT Protocol handle',
      message: 'Please enter your AT Protocol handle (e.g., alice.bsky.social)',
      prompt: {
        model: '',
        type: 'text'
      },
      cancel: true,
      persistent: true
    }).onOk(async (handle) => {
      try {
        // Strip @ prefix if present to accept both formats
        const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

        const baseUrl = getEnv('APP_API_URL')
        const tenantId = getEnv('APP_TENANT_ID')

        // Build authorize URL with platform parameter for mobile apps
        const authorizeUrl = new URL(`${baseUrl}/api/v1/auth/bluesky/authorize`)
        authorizeUrl.searchParams.set('handle', cleanHandle)
        authorizeUrl.searchParams.set('tenantId', tenantId as string)

        // Add platform parameter for mobile apps (used for custom URL scheme redirect)
        if (Capacitor.isNativePlatform()) {
          authorizeUrl.searchParams.set('platform', Capacitor.getPlatform())
        }

        // Get the authorization URL from the backend
        const response = await fetch(authorizeUrl.toString())

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Auth URL request failed:', response.status, errorText)
          throw new Error(`Failed to get authorization URL: ${response.status}`)
        }

        const url = await response.text()

        if (!url || !url.startsWith('http')) {
          throw new Error('Invalid authorization URL received')
        }

        // Redirect to Bluesky auth in the same window
        // Store the current URL to return to after authentication
        localStorage.setItem('bluesky_auth_return_url', window.location.href)

        // Redirect the main window to the auth URL
        window.location.href = url
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
      message: 'AT Protocol authentication failed'
    })
    isLoading.value = false
  }
}

</script>

<style scoped>
.q-dialog :deep(.q-field) {
  margin: 8px 0;
}

.bluesky-button {
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  border-color: var(--q-dark-page, #dadce0) !important;
  color: var(--q-dark-page, #3c4043) !important;
}

/* Dark mode support */
.body--dark .bluesky-button {
  border-color: rgba(255, 255, 255, 0.28) !important;
  color: rgba(255, 255, 255, 0.87) !important;
}

.bluesky-button:hover {
  box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.30), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
}
</style>
