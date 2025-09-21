<template>
  <div class="c-google-callback-page">
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
      <div class="text-subtitle1 q-mt-md">Completing authentication...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { useQuasar } from 'quasar'
import { useSocialAuthError } from '../../composables/useSocialAuthError'
import { authApi } from '../../api/auth'
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
  redirectToLogin
} = useSocialAuthError()

const handleCallback = async () => {
  try {
    const code = route.query.code as string
    const state = route.query.state as string
    const errorParam = route.query.error as string

    // Handle OAuth2 errors from Google
    if (errorParam) {
      throw new Error(`Google OAuth error: ${errorParam}`)
    }

    if (!code) {
      throw new Error('No authorization code received')
    }

    // Call OAuth2 endpoint
    const response = await authApi.googleOAuth2Login({
      code,
      redirectUri: window.location.origin + '/auth/google/callback',
      state
    })

    // Update auth store with the response
    authStore.actionSetToken(response.data.token)
    authStore.actionSetRefreshToken(response.data.refreshToken)
    authStore.actionSetTokenExpires(response.data.tokenExpires)
    authStore.actionSetUser(response.data.user)

    // Check for OIDC flow continuation first
    const oidcDataStr = localStorage.getItem('oidc_flow_data')

    if (oidcDataStr) {
      try {
        const oidcData = JSON.parse(oidcDataStr)
        const maxAge = 5 * 60 * 1000 // 5 minutes

        if (Date.now() - oidcData.timestamp < maxAge) {
          console.log('🔄 OIDC Flow: Continuing OIDC flow after Google login, redirecting to:', oidcData.returnUrl)

          // Get the user's JWT token to include in the redirect
          const token = authStore.token
          if (token) {
            const url = new URL(oidcData.returnUrl)
            url.searchParams.set('user_token', token)
            console.log('🔄 OIDC Flow: Added user token to OIDC redirect')

            // Clear OIDC data
            localStorage.removeItem('oidc_flow_data')

            // Redirect to the OIDC auth endpoint with token
            window.location.href = url.toString()
            return
          }
        } else {
          console.log('🔄 OIDC Flow: OIDC data expired, clearing')
          localStorage.removeItem('oidc_flow_data')
        }
      } catch (error) {
        console.error('🔄 OIDC Flow: Error parsing OIDC data:', error)
        localStorage.removeItem('oidc_flow_data')
      }
    }

    // Success - show notification and redirect
    $q.notify({
      type: 'positive',
      message: 'Successfully logged in with Google'
    })

    // Redirect to home or intended page
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } catch (err) {
    console.error('Google OAuth2 login error:', err?.response?.data || err)

    // Parse the error using our composable
    setError(err, 'google')
  }
}

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

onMounted(() => {
  handleCallback()
})
</script>

<style scoped>
.c-google-callback-page {
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
