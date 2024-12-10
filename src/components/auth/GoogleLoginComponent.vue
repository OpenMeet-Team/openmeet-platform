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

const googleClientId = getEnv('APP_GOOGLE_CLIENT_ID')

// Types
interface GoogleResponse {
  credential: string;
  select_by: string;
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

// Methods
const initializeGoogleSignIn = () => {
  if (isInitialized.value || !googleClientId) return

  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = renderGoogleButton
  document.head.appendChild(script)
}

const renderGoogleButton = () => {
  if (!window.google?.accounts?.id) {
    error.value = 'Google Sign-In failed to load'
    return
  }

  try {
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleResponse,
      auto_select: props.autoLoad,
      cancel_on_tap_outside: false
    })

    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-button')!,
      {
        type: 'standard',
        theme: props.theme,
        size: props.size,
        text: props.text,
        shape: props.shape,
        logo_alignment: 'left'
      }
    )

    if (props.autoLoad) {
      window.google.accounts.id.prompt()
    }

    isInitialized.value = true
  } catch (err) {
    console.error('Google button render error:', err)
    error.value = 'Failed to initialize Google Sign-In'
  }
}

const handleGoogleResponse = async (response: GoogleResponse) => {
  try {
    isLoading.value = true
    error.value = null

    await authStore.actionGoogleLogin(response.credential)

    // Show success message
    $q.notify({
      type: 'positive',
      message: 'Successfully signed in!',
      position: 'top'
    })

    emit('success')

    // Redirect
  } catch (err) {
    console.error('Google auth error:', err)
    error.value = (err as Error).message || 'Authentication failed'
    emit('error', err as Error)
  } finally {
    isLoading.value = false
  }
}

const retryAuth = () => {
  error.value = null
  if (window.google?.accounts?.id) {
    window.google.accounts.id.prompt()
  }
}

// Cleanup
const cleanup = () => {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.cancel()
  }
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
          initialize: (options: object) => void;
          renderButton: (element: HTMLElement, config: object) => void;
          prompt: () => void;
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
