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
        // Strip @ prefix if present to accept both formats
        const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

        const baseUrl = getEnv('APP_API_URL')
        const tenantId = getEnv('APP_TENANT_ID')

        // Get the authorization URL from the backend
        const response = await fetch(
          `${baseUrl}/api/v1/auth/bluesky/authorize?handle=${encodeURIComponent(cleanHandle)}&tenantId=${tenantId}`
        )
        const url = await response.text()

        if (!url) {
          throw new Error('No authorization URL received')
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
