<template>
  <div class="c-github-callback-page">
    <SocialAuthError
      v-if="hasError"
      :error="error?.message || 'Authentication failed'"
      :auth-provider="error?.authProvider"
      :suggested-provider="error?.suggestedProvider"
      :is-popup="isPopup"
      @try-again="handleTryAgain"
      @cancel="handleCancel"
      @use-provider="handleUseProvider"
      @use-email-login="handleUseEmailLogin"
    />

    <div v-else class="loading-container">
      <q-spinner-dots size="40px" color="primary" />
      <div class="text-subtitle1 q-mt-md">Completing authentication...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { useQuasar } from 'quasar'
import { useSocialAuthError } from '../../composables/useSocialAuthError'
import SocialAuthError from '../../components/auth/SocialAuthError.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const $q = useQuasar()
const {
  error,
  hasError,
  setError,
  clearError,
  redirectToProvider,
  redirectToLogin,
  closePopupWithMessage
} = useSocialAuthError()

const isPopup = computed(() => !!window.opener)

const handleCallback = async () => {
  try {
    const code = route.query.code as string
    const returnedState = route.query.state as string
    const originalState = sessionStorage.getItem('github_oauth_state')

    if (!code) {
      throw new Error('No authorization code received')
    }

    // Verify state parameter
    if (returnedState !== originalState) {
      throw new Error('Invalid state parameter')
    }

    // Authenticate with GitHub
    await authStore.actionGithubLogin(code)

    // Success - handle based on whether we're in popup or regular page
    if (isPopup.value) {
      window.opener.location.reload()
      window.close()
    } else {
      $q.notify({
        type: 'positive',
        message: 'Successfully logged in with GitHub'
      })
      router.push('/')
    }
  } catch (err) {
    console.error('GitHub login error:', err?.response?.data || err)

    // Parse the error using our composable
    setError(err, 'github')

    // If in popup, close with enhanced error message for parent handling
    if (isPopup.value) {
      closePopupWithMessage()
    }
  }
}

// Event handlers for SocialAuthError component
const handleTryAgain = () => {
  clearError()
  if (isPopup.value) {
    // In popup, just close and let user try again from main page
    window.close()
  } else {
    // On regular page, redirect to login
    redirectToLogin()
  }
}

const handleCancel = () => {
  if (isPopup.value) {
    window.close()
  } else {
    redirectToLogin()
  }
}

const handleUseProvider = (provider: string) => {
  if (isPopup.value) {
    // Send message to parent to switch auth providers
    window.opener.postMessage(
      {
        switchToProvider: provider,
        message: `Please use ${provider} to sign in instead`
      },
      window.location.origin
    )
    window.close()
  } else {
    redirectToProvider(provider)
  }
}

const handleUseEmailLogin = () => {
  if (isPopup.value) {
    // Send message to parent to switch to email login
    window.opener.postMessage(
      {
        switchToProvider: 'email',
        message: 'Please use email and password to sign in instead'
      },
      window.location.origin
    )
    window.close()
  } else {
    redirectToLogin()
  }
}

onMounted(() => {
  handleCallback()
})
</script>

<style scoped>
.c-github-callback-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.loading-container {
  text-align: center;
}
</style>
