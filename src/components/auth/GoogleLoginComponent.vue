<!-- platform/src/components/auth/GoogleLoginButton.vue -->
<template>
  <div v-if="googleClientId" class="google-auth-container">
    <!-- Google Button Container -->
    <div id="google-signin-button" :class="{ 'invisible': isLoading }" />

    <!-- Loading State -->
    <q-inner-loading :showing="isLoading">
      <q-spinner-dots size="30px" color="primary" />
    </q-inner-loading>

    <!-- Error Alert -->
    <q-banner v-if="error" dense rounded class="text-white bg-negative q-mt-sm">
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
import { useAuthStore } from 'src/stores/auth-store'
import getEnv from 'src/utils/env'

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

const emit = defineEmits < Emits >()

// State
const isLoading = ref(false)
const error = ref < string | null >(null)
const isInitialized = ref(false)

// Composables
const $q = useQuasar()
const authStore = useAuthStore()

// Add these state variables
const COOLDOWN_PERIOD = 2000 // 2 second cooldown between attempts
const PROMPT_COOLDOWN = 5000 // 5 seconds between prompts
let lastAuthAttempt = 0
let lastPromptTime = 0
let isAuthInProgress = false

// Methods
const initializeGoogleSignIn = () => {
  if (isInitialized.value || !googleClientId) return

  cleanup()

  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    if (!window.google?.accounts?.id || typeof googleClientId !== 'string') {
      error.value = 'Google Sign-In failed to load'
      return
    }

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

  document.head.appendChild(script)
}

const renderButton = () => {
  const buttonContainer = document.getElementById('google-signin-button')
  if (buttonContainer && window.google?.accounts?.id) {
    buttonContainer.innerHTML = ''
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
    isInitialized.value = true
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

    await authStore.actionGoogleLogin(response.credential)

    $q.notify({
      type: 'positive',
      message: 'Successfully signed in!',
      position: 'top'
    })

    emit('success')
  } catch (err) {
    console.error('Google auth error:', err)
    error.value = 'Authentication failed. Please try again.'
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
  isLoading.value = true

  try {
    cleanup()
    await new Promise(resolve => setTimeout(resolve, COOLDOWN_PERIOD))
    window.location.reload()
  } finally {
    isLoading.value = false
  }
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
