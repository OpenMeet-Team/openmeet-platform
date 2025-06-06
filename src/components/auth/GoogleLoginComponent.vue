<!-- platform/src/components/auth/GoogleLoginButton.vue -->
<template>
  <div v-if="googleClientId" class="google-auth-container">
    <!-- Google Button Container -->
    <div id="google-signin-button" :class="{ 'invisible': isLoading }" />


    <!-- Loading State -->
    <q-inner-loading :showing="isLoading">
      <q-spinner-dots size="30px" color="primary" />
    </q-inner-loading>

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
import { ref, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../stores/auth-store'
import { useSocialAuthError } from '../../composables/useSocialAuthError'
import SocialAuthError from './SocialAuthError.vue'
import getEnv from '../../utils/env'

const googleClientId = getEnv('APP_GOOGLE_CLIENT_ID') as string

// Types
interface GoogleResponse {
  credential: string;
  select_by: string;
}

interface GoogleInitializeConfig {
  client_id: string;
  callback: (response: GoogleResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  prompt_parent_id?: string;
  itp_support?: boolean;
}

interface GoogleButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: string | number;
  click_listener?: () => void;
}

// Props & Emits
const props = withDefaults(defineProps < {
  autoLoad?: boolean;
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
} >(), {
  autoLoad: false,
  theme: 'outline',
  size: 'large',
  shape: 'rectangular',
  text: 'continue_with'
})

interface Emits {
  (e: 'success'): void;
  (e: 'error', error: Error): void;
}

const emit = defineEmits<Emits>()

// State
const isLoading = ref(false)
const error = ref < string | null >(null)
const isInitialized = ref(false)

// Composables
const $q = useQuasar()
const authStore = useAuthStore()
const {
  error: socialAuthError,
  setError: setSocialAuthError,
  clearError: clearSocialAuthError,
  parseSocialAuthError
} = useSocialAuthError()

// Add these state variables
const COOLDOWN_PERIOD = 2000 // 2 second cooldown between attempts
const PROMPT_COOLDOWN = 5000 // 5 seconds between prompts
let lastAuthAttempt = 0
let lastPromptTime = 0
let isAuthInProgress = false

// Methods
const initializeGoogleSignIn = () => {
  if (isInitialized.value || !googleClientId) {
    console.log('GoogleLogin: Skipping initialization - already initialized or no client ID', { isInitialized: isInitialized.value, hasClientId: !!googleClientId })
    return
  }

  console.log('GoogleLogin: Starting initialization with client ID:', googleClientId)
  cleanup()

  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    console.log('GoogleLogin: Script loaded, checking window.google:', !!window.google?.accounts?.id)
    if (!window.google?.accounts?.id || typeof googleClientId !== 'string') {
      error.value = 'Google Sign-In failed to load'
      console.error('GoogleLogin: Failed to load Google API or invalid client ID')
      return
    }

    console.log('GoogleLogin: Initializing Google Sign-In API')
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      prompt_parent_id: 'google-signin-button',
      itp_support: true
    })

    renderButton()
  }

  script.onerror = (err) => {
    console.error('GoogleLogin: Failed to load Google script:', err)
    error.value = 'Failed to load Google authentication script'
  }

  document.head.appendChild(script)
}

const renderButton = () => {
  const buttonContainer = document.getElementById('google-signin-button')
  console.log('GoogleLogin: Attempting to render button', {
    hasContainer: !!buttonContainer,
    hasGoogleAPI: !!window.google?.accounts?.id,
    containerRect: buttonContainer?.getBoundingClientRect()
  })

  if (buttonContainer && window.google?.accounts?.id) {
    buttonContainer.innerHTML = ''

    console.log('GoogleLogin: Rendering button with config:', {
      type: 'standard',
      theme: props.theme,
      size: props.size,
      text: props.text,
      shape: props.shape,
      logo_alignment: 'left',
      width: '100%'
    })

    try {
      window.google.accounts.id.renderButton(
        buttonContainer,
        {
          type: 'standard',
          theme: props.theme,
          size: props.size,
          text: props.text,
          shape: props.shape,
          logo_alignment: 'left',
          width: '100%',
          click_listener: handleButtonClick
        }
      )
      console.log('GoogleLogin: Button rendered successfully')
      isInitialized.value = true
    } catch (renderError) {
      console.error('GoogleLogin: Error rendering button:', renderError)
      error.value = 'Failed to render Google Sign-In button'
    }
  } else {
    console.error('GoogleLogin: Cannot render button - missing container or Google API')
  }
}

// Add click handler to control prompt timing
const handleButtonClick = async () => {
  const now = Date.now()
  if (isAuthInProgress || now - lastPromptTime < PROMPT_COOLDOWN) {
    console.log('Auth in progress or cooldown active')
    return
  }

  try {
    isAuthInProgress = true
    lastPromptTime = now
    error.value = null

    // Use One Tap
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt()
    }
  } catch (err) {
    console.error('Google prompt error:', err)
    error.value = 'Failed to start authentication'
  } finally {
    // Reset after delay
    setTimeout(() => {
      isAuthInProgress = false
    }, PROMPT_COOLDOWN)
  }
}

const handleGoogleResponse = async (response: GoogleResponse) => {
  if (!response?.credential) {
    console.log('Invalid response received')
    return
  }

  try {
    const now = Date.now()
    if (now - lastAuthAttempt < COOLDOWN_PERIOD) {
      console.log('Auth attempt too soon')
      return
    }

    lastAuthAttempt = now
    isLoading.value = true
    error.value = null
    clearSocialAuthError()

    await authStore.actionGoogleLogin(response.credential)

    $q.notify({
      type: 'positive',
      message: 'Successfully signed in!',
      position: 'top'
    })

    emit('success')
  } catch (err) {
    console.error('Google auth error:', err)

    // Parse the error to see if it's a social auth conflict
    const parsedError = parseSocialAuthError(err, 'google')

    if (parsedError.suggestedProvider) {
      // This is an enhanced social auth error - use the enhanced display
      setSocialAuthError(err, 'google')
    } else {
      // Regular error - use simple banner
      error.value = 'Authentication failed. Please try again.'
    }

    emit('error', err as Error)
  } finally {
    isLoading.value = false
    isAuthInProgress = false
  }
}

const retryAuth = async () => {
  const now = Date.now()
  if (now - lastAuthAttempt < COOLDOWN_PERIOD) {
    error.value = 'Please wait a moment before trying again'
    return
  }

  error.value = null
  clearSocialAuthError()
  isLoading.value = true

  try {
    cleanup()
    await new Promise(resolve => setTimeout(resolve, COOLDOWN_PERIOD))
    window.location.reload()
  } finally {
    isLoading.value = false
  }
}

// Event handlers for SocialAuthError component
const handleTryAgain = () => {
  clearSocialAuthError()
  retryAuth()
}

const handleCancel = () => {
  clearSocialAuthError()
  error.value = null
}

const handleUseProvider = (provider: string) => {
  clearSocialAuthError()
  // For in-page component, we can show a notification guiding to the other provider
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

const cleanup = () => {
  isAuthInProgress = false

  if (window.google?.accounts?.id) {
    try {
      window.google.accounts.id.cancel()
      const buttonEl = document.getElementById('google-signin-button')
      if (buttonEl) {
        buttonEl.innerHTML = ''
      }
    } catch (err) {
      console.error('Cleanup error:', err)
    }
  }

  // Remove any existing Google scripts
  document.querySelectorAll('script[src*="accounts.google.com/gsi/client"]')
    .forEach(script => script.remove())

  isInitialized.value = false
}

// Lifecycle
onMounted(() => {
  initializeGoogleSignIn()
})

onUnmounted(() => {
  cleanup()
})

// Type augmentation for window object
declare global {
  interface Window {
    google?: {
      accounts?: {
        id: {
          initialize: (config: GoogleInitializeConfig) => void;
          renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
          }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}
</script>

<style scoped>
.google-auth-container {
  position: relative;
  min-height: 40px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#google-signin-button {
  min-height: 40px;
  width: 100%;
  display: flex;
  justify-content: center;
}

.invisible {
  visibility: hidden;
}
</style>
