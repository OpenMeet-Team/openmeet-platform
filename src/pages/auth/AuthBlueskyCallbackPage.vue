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
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { useSocialAuthError } from '../../composables/useSocialAuthError'
import SocialAuthError from '../../components/auth/SocialAuthError.vue'

const route = useRoute()
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

    // Use route.query for Capacitor deep links (Vue Router passes query as object)
    // Fall back to window.location.search for web browser navigation
    let params: URLSearchParams
    if (Object.keys(route.query).length > 0) {
      // Capacitor deep link: convert route.query object to URLSearchParams
      params = new URLSearchParams()
      for (const [key, value] of Object.entries(route.query)) {
        if (typeof value === 'string') {
          params.set(key, value)
        }
      }
      console.log('Using route.query (Capacitor deep link)')
    } else {
      // Web browser: use window.location.search
      params = new URLSearchParams(window.location.search)
      console.log('Using window.location.search (web browser)')
    }

    console.log('Params - token:', params.get('token') ? 'present' : 'missing')
    console.log('Params - refreshToken:', params.get('refreshToken') ? 'present' : 'missing')
    console.log('Params - tokenExpires:', params.get('tokenExpires'))
    console.log('Params - profile:', params.get('profile') ? `present (${params.get('profile')?.length} chars)` : 'missing')
    const success = await authStore.handleBlueskyCallback(params)

    console.log('AuthBlueskyCallbackPage success', success)

    if (success) {
      // Check if user needs to provide email
      const user = authStore.getUser

      const hasValidEmail = user.email && user.email !== '' && user.email !== null && user.email !== 'null'

      if (!hasValidEmail) {
        window.location.replace('/auth/collect-email')
      } else {
        // Check for OIDC flow continuation first
        const oidcDataStr = localStorage.getItem('oidc_flow_data')

        if (oidcDataStr) {
          try {
            const oidcData = JSON.parse(oidcDataStr)
            const maxAge = 5 * 60 * 1000 // 5 minutes

            if (Date.now() - oidcData.timestamp < maxAge) {
              console.log('🔄 OIDC Flow: Continuing OIDC flow after Bluesky login, redirecting to:', oidcData.returnUrl)

              // Get the user's JWT token to include in the redirect
              const token = authStore.token
              if (token) {
                const url = new URL(oidcData.returnUrl)
                url.searchParams.set('user_token', token)
                console.log('🔄 OIDC Flow: Added user token to OIDC redirect')

                // Clear both stored data
                localStorage.removeItem('oidc_flow_data')
                localStorage.removeItem('bluesky_auth_return_url')

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

        // Check for RSVP intent after OIDC check
        const rsvpIntentStr = localStorage.getItem('rsvp_intent')

        if (rsvpIntentStr) {
          try {
            const rsvpIntent = JSON.parse(rsvpIntentStr)
            const maxAge = 5 * 60 * 1000 // 5 minutes

            if (Date.now() - rsvpIntent.timestamp < maxAge) {
              console.log('🎉 RSVP Intent: Completing RSVP after Bluesky login for event:', rsvpIntent.eventSlug)

              // Complete the RSVP using the event store
              const { useEventStore } = await import('../../stores/event-store')
              const eventStore = useEventStore()

              await eventStore.actionAttendEvent(rsvpIntent.eventSlug, {
                status: rsvpIntent.status
              })

              // Clean up both RSVP intent and bluesky return URL
              localStorage.removeItem('rsvp_intent')
              localStorage.removeItem('bluesky_auth_return_url')

              // Redirect back to event page
              window.location.href = rsvpIntent.returnUrl
              return
            } else {
              console.log('🎉 RSVP Intent: RSVP intent expired, clearing')
              localStorage.removeItem('rsvp_intent')
            }
          } catch (error) {
            console.error('🎉 RSVP Intent: Error completing RSVP intent:', error)
            localStorage.removeItem('rsvp_intent')
          }
        }

        // Normal redirect: Get the return URL from localStorage, or default to home
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
