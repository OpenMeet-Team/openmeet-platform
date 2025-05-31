import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

export interface SocialAuthError {
  message: string
  authProvider?: string
  suggestedProvider?: string
  isEnhanced: boolean
}

export function useSocialAuthError () {
  const router = useRouter()
  const error = ref<SocialAuthError | null>(null)

  const parseSocialAuthError = (err: unknown, fallbackProvider?: string): SocialAuthError => {
    // Type assertion for axios error structure
    const axiosError = err as {
      response?: {
        data?: {
          errors?: Record<string, string>
          message?: string
        }
        status?: number
      }
      message?: string
    }

    // Check if this is an enhanced social auth error from our API
    if (axiosError.response?.data?.errors?.social_auth) {
      const errorData = axiosError.response.data.errors
      return {
        message: errorData.social_auth,
        authProvider: errorData.auth_provider || fallbackProvider,
        suggestedProvider: errorData.suggested_provider,
        isEnhanced: true
      }
    }

    // Check for other 422 errors with email conflicts
    if (axiosError.response?.status === 422 && axiosError.response?.data?.errors?.email) {
      const emailError = axiosError.response.data.errors.email
      let suggestedProvider: string | undefined

      // Try to extract suggested provider from error message
      if (emailError.includes('google')) {
        suggestedProvider = 'google'
      } else if (emailError.includes('github')) {
        suggestedProvider = 'github'
      } else if (emailError.includes('bluesky')) {
        suggestedProvider = 'bluesky'
      } else if (emailError.includes('email')) {
        suggestedProvider = 'email'
      }

      return {
        message: emailError,
        authProvider: fallbackProvider,
        suggestedProvider,
        isEnhanced: false
      }
    }

    // Fallback for generic errors
    const message = axiosError.response?.data?.message ||
                   axiosError.message ||
                   'Authentication failed. Please try again.'

    return {
      message,
      authProvider: fallbackProvider,
      suggestedProvider: undefined,
      isEnhanced: false
    }
  }

  const setError = (err: unknown, fallbackProvider?: string) => {
    error.value = parseSocialAuthError(err, fallbackProvider)
  }

  const clearError = () => {
    error.value = null
  }

  const hasError = computed(() => !!error.value)
  const isEnhancedError = computed(() => error.value?.isEnhanced || false)
  const hasSuggestion = computed(() => !!error.value?.suggestedProvider)

  // Navigation helpers
  const redirectToProvider = (provider: string) => {
    const routes = {
      google: '/auth/login', // Same page, different button
      github: '/auth/login', // Same page, different button
      bluesky: '/auth/login', // Same page, different button
      email: '/auth/login'
    }

    router.push(routes[provider] || '/auth/login')
  }

  const redirectToEmailLogin = () => {
    router.push('/auth/login')
  }

  const redirectToLogin = () => {
    router.push('/auth/login')
  }

  const closePopupWithMessage = (message?: string) => {
    if (window.opener) {
      window.opener.postMessage(
        {
          error: message || error.value?.message || 'Authentication failed',
          authProvider: error.value?.authProvider,
          suggestedProvider: error.value?.suggestedProvider
        },
        window.location.origin
      )
      window.close()
    }
  }

  return {
    error: computed(() => error.value),
    hasError,
    isEnhancedError,
    hasSuggestion,
    setError,
    clearError,
    parseSocialAuthError,
    redirectToProvider,
    redirectToEmailLogin,
    redirectToLogin,
    closePopupWithMessage
  }
}
