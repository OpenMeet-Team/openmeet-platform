<template>
  <q-page class="flex flex-center">
    <SocialAuthError 
      v-if="hasError" 
      :error="error?.message || 'Authentication failed'"
      :auth-provider="error?.authProvider"
      :suggested-provider="error?.suggestedProvider"
      :is-popup="false"
      @try-again="handleTryAgain"
      @cancel="handleCancel" 
      @use-provider="handleUseProvider"
      @use-email-login="handleUseEmailLogin"
    />
    
    <div v-else class="loading-container">
      <q-spinner-dots size="40px" color="primary" />
      <div class="q-mt-md">Processing login...</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import { useSocialAuthError } from '../../composables/useSocialAuthError'
import SocialAuthError from '../../components/auth/SocialAuthError.vue'

const authStore = useAuthStore()
const { 
  error, 
  hasError, 
  setError, 
  clearError, 
  redirectToProvider, 
  redirectToLogin 
} = useSocialAuthError()
// Event handlers for SocialAuthError component  
const handleTryAgain = () => {
  clearError()
  redirectToLogin()
}

const handleCancel = () => {
  redirectToLogin()
}

const handleUseProvider = (provider: string) => {
  redirectToProvider(provider)
}

const handleUseEmailLogin = () => {
  redirectToLogin()
}

onMounted(async () => {
  try {
    console.log('AuthBlueskyCallbackPage mounted')
    const params = new URLSearchParams(window.location.search)
    const success = await authStore.handleBlueskyCallback(params)

    console.log('AuthBlueskyCallbackPage success', success)

    if (success) {
      // Check if user needs to provide email
      const user = authStore.getUser

      const hasValidEmail = user.email && user.email !== '' && user.email !== null && user.email !== 'null'

      if (!hasValidEmail) {
        window.location.replace('/auth/collect-email')
      } else {
        // Get the return URL from localStorage, or default to home
        const returnUrl = localStorage.getItem('bluesky_auth_return_url') || '/'
        localStorage.removeItem('bluesky_auth_return_url') // Clean up

        // Redirect back to the original page
        window.location.replace(returnUrl)
      }
    } else {
      throw new Error('Auth callback failed')
    }
  } catch (authError) {
    console.error('Auth callback detailed error:', authError)
    
    // Parse the error using our composable
    setError(authError, 'bluesky')
  }
})
</script>
