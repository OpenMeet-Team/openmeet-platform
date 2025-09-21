<!-- platform/src/components/auth/GoogleLoginButton.vue -->
<template>
  <div v-if="googleClientId" class="google-auth-container">
    <!-- Custom Google Button (redirect-based, no popup) -->
    <q-btn
      :loading="isLoading"
      :disable="isLoading"
      class="google-button"
      @click="handleGoogleLogin"
      no-caps
      outline
      style="width: 100%; height: 40px; border-color: #dadce0; color: #3c4043;"
    >
      <template v-slot:default>
        <div class="row items-center no-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" class="q-mr-sm">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>{{ buttonText }}</span>
        </div>
      </template>

      <template v-slot:loading>
        <q-spinner-dots color="primary" size="20px" />
      </template>
    </q-btn>

    <!-- Enhanced Error Display -->
    <div v-if="socialAuthError" class="q-mt-sm">
      <SocialAuthError
        :error="socialAuthError.message"
        :auth-provider="socialAuthError.authProvider"
        :suggested-provider="socialAuthError.suggestedProvider"
        :is-popup="false"
        @try-again="handleTryAgain"
        @cancel="handleCancel"
        @use-provider="handleUseProvider"
        @use-email-login="handleUseEmailLogin"
      />
    </div>

    <!-- Simple Error Alert for non-social auth errors -->
    <q-banner v-else-if="error" dense rounded class="text-white bg-negative q-mt-sm">
      {{ error }}
      <template v-slot:action>
        <q-btn flat color="white" label="Retry" @click="retryAuth" />
      </template>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useSocialAuthError } from '../../composables/useSocialAuthError'
import SocialAuthError from './SocialAuthError.vue'
import getEnv from '../../utils/env'

const googleClientId = getEnv('APP_GOOGLE_CLIENT_ID') as string

// Props & Emits
const props = withDefaults(defineProps<{
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
}>(), {
  text: 'continue_with'
})

interface Emits {
  (e: 'success'): void;
  (e: 'error', error: Error): void;
}

const emit = defineEmits<Emits>()

// State
const isLoading = ref(false)
const error = ref<string | null>(null)

// Computed
const buttonText = computed(() => {
  const textMap = {
    signin_with: 'Sign in with Google',
    signup_with: 'Sign up with Google',
    continue_with: 'Continue with Google',
    signin: 'Sign in'
  }
  return textMap[props.text]
})

// Composables
const $q = useQuasar()
const {
  error: socialAuthError,
  clearError: clearSocialAuthError
} = useSocialAuthError()

// Methods
const handleGoogleLogin = () => {
  try {
    isLoading.value = true
    error.value = null

    // Google OAuth2 redirect URL (no popup needed)
    const redirectUri = `${window.location.origin}/auth/google/callback`
    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

    googleUrl.searchParams.append('client_id', googleClientId)
    googleUrl.searchParams.append('redirect_uri', redirectUri)
    googleUrl.searchParams.append('response_type', 'code')
    googleUrl.searchParams.append('scope', 'openid email profile')
    googleUrl.searchParams.append('access_type', 'offline')
    googleUrl.searchParams.append('prompt', 'select_account')

    // Redirect to Google (no popup)
    window.location.href = googleUrl.toString()
  } catch (err) {
    console.error('Google OAuth error:', err)
    error.value = 'Failed to start Google authentication'
    isLoading.value = false
    emit('error', err as Error)
  }
}

// Event handlers for SocialAuthError component
const handleTryAgain = () => {
  clearSocialAuthError()
  handleGoogleLogin()
}

const handleCancel = () => {
  clearSocialAuthError()
  error.value = null
}

const handleUseProvider = (provider: string) => {
  clearSocialAuthError()
  $q.notify({
    type: 'info',
    message: `Please use the ${provider.charAt(0).toUpperCase() + provider.slice(1)} button instead`,
    timeout: 5000,
    position: 'top'
  })
}

const handleUseEmailLogin = () => {
  clearSocialAuthError()
  $q.notify({
    type: 'info',
    message: 'Please use the email and password form above instead',
    timeout: 5000,
    position: 'top'
  })
}

</script>

<style scoped>
.google-auth-container {
  position: relative;
  width: 100%;
}

.google-button {
  border-radius: 4px;
  font-family: 'Roboto', sans-serif;
  font-size: 14px;
  font-weight: 500;
}

.google-button:hover {
  box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.30), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
}
</style>
