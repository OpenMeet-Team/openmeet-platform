<template>
  <div class="c-matrix-callback-page">
    <SocialAuthError
      v-if="hasError"
      :error="error?.message || 'Matrix authentication failed'"
      :auth-provider="'matrix'"
      :is-popup="isPopup"
      @try-again="handleTryAgain"
      @cancel="handleCancel"
      @use-email-login="handleUseEmailLogin"
    />

    <div v-else class="loading-container">
      <q-spinner-dots size="40px" color="primary" />
      <div class="text-subtitle1 q-mt-md">Completing Matrix authentication...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useSocialAuthError } from '../../composables/useSocialAuthError'
import SocialAuthError from '../../components/auth/SocialAuthError.vue'
import { matrixClientService } from '../../services/matrixClientService'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const {
  error,
  hasError,
  setError,
  clearError,
  redirectToLogin,
  closePopupWithMessage
} = useSocialAuthError()

const isPopup = computed(() => !!window.opener)

const handleCallback = async () => {
  try {
    const code = route.query.code as string
    const returnedState = route.query.state as string

    if (!code) {
      throw new Error('No authorization code received from Matrix Authentication Service')
    }

    console.log('🎫 Matrix OAuth2 callback received - state validation handled by native SDK')

    // Complete Matrix authentication using the authorization code
    // State validation is now handled by the native matrix-js-sdk
    await matrixClientService.completeOAuthLogin(code, returnedState)

    // The native SDK cleans up its own state storage

    // Get the original return URL if available
    const returnUrl = sessionStorage.getItem('matrixReturnUrl')
    sessionStorage.removeItem('matrixReturnUrl')

    // Success - handle based on whether we're in popup or regular page
    if (isPopup.value) {
      // Send success message to parent window
      window.opener.postMessage(
        {
          matrixAuthSuccess: true,
          message: 'Matrix authentication completed successfully'
        },
        window.location.origin
      )
      window.close()
    } else {
      $q.notify({
        type: 'positive',
        message: 'Successfully connected to Matrix chat',
        caption: 'You can now participate in event and group discussions'
      })

      // Return to the original page or dashboard
      if (returnUrl && returnUrl !== window.location.href) {
        // Use Vue router to navigate instead of full page reload
        const url = new URL(returnUrl, window.location.origin)
        router.push(url.pathname + url.search + url.hash)
      } else {
        router.push('/dashboard')
      }
    }
  } catch (err) {
    console.error('Matrix authentication error:', err?.response?.data || err)

    // Clean up OAuth state on error
    sessionStorage.removeItem('mas_oauth_state')
    sessionStorage.removeItem('mas_openmeet_context')
    sessionStorage.removeItem('matrixReturnUrl')

    // Parse the error using our composable
    setError(err, 'matrix')

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
    // On regular page, redirect to dashboard where user can try Matrix connect again
    router.push('/dashboard')
  }
}

const handleCancel = () => {
  if (isPopup.value) {
    window.close()
  } else {
    router.push('/dashboard')
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
.c-matrix-callback-page {
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
