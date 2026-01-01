<template>
  <div v-if="githubClientId" class="c-github-login-component github-auth-container row justify-center">
    <q-btn
      :loading="isLoading"
      :disable="isLoading"
      class="github-button"
      @click="handleGithubLogin"
      no-caps
      outline
      style="width: 100%; height: 40px;"
    >
      <template v-slot:default>
        <div class="row items-center no-wrap">
          <q-icon name="fab fa-github" size="18px" class="q-mr-sm" />
          <span>{{ buttonText }}</span>
        </div>
      </template>

      <template v-slot:loading>
        <q-spinner-dots color="white" size="24px" />
      </template>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../stores/auth-store'
import getEnv from '../../utils/env'
import { buildOAuthRedirectUri, buildOAuthState, isNativePlatform } from '../../utils/oauthRedirectUri'

const props = withDefaults(defineProps<{
  text?: 'join_with' | 'signin_with' | 'signup_with' | 'continue_with'
}>(), {
  text: 'join_with'
})

const isLoading = ref(false)
const $q = useQuasar()
const authStore = useAuthStore()
const githubClientId = getEnv('APP_GITHUB_CLIENT_ID')

const buttonText = computed(() => {
  const textMap = {
    join_with: 'Join with GitHub',
    signin_with: 'Sign in with GitHub',
    signup_with: 'Sign up with GitHub',
    continue_with: 'Continue with GitHub'
  }
  return textMap[props.text]
})

const handleGithubLogin = async () => {
  try {
    isLoading.value = true

    // Build redirect URI based on platform (web vs mobile)
    // On mobile: redirects to API which redirects to custom URL scheme
    // On web: redirects to frontend callback page
    const redirectUri = buildOAuthRedirectUri('github')

    // Always use buildOAuthState which includes tenantId + platform
    // Server-side OAuth flow requires tenantId in state for all platforms
    const isMobile = isNativePlatform()
    const state = buildOAuthState()

    // Construct GitHub OAuth URL with state parameter
    const githubUrl = new URL('https://github.com/login/oauth/authorize')
    githubUrl.searchParams.append('client_id', githubClientId as string)
    githubUrl.searchParams.append('redirect_uri', redirectUri)
    githubUrl.searchParams.append('state', state)
    githubUrl.searchParams.append('scope', 'user:email') // Add required scopes

    // On mobile, use direct redirect since popups don't work well
    if (isMobile) {
      window.location.href = githubUrl.toString()
      return
    }

    // On web, use popup for better UX
    const width = 600
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      githubUrl.toString(),
      'GitHub Login',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Handle the OAuth callback message
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      const { code, error, switchToProvider, message } = event.data

      if (code) {
        await authStore.actionGithubLogin(code)
        $q.notify({
          type: 'positive',
          message: 'Successfully logged in with GitHub'
        })
        popup?.close()
      } else if (error) {
        console.error('GitHub auth error from popup:', error)
        $q.notify({
          type: 'negative',
          message: message || error,
          timeout: 8000, // Longer timeout for error messages
          html: true
        })
        popup?.close()
      } else if (switchToProvider) {
        $q.notify({
          type: 'info',
          message: message || `Please try ${switchToProvider} instead`,
          timeout: 6000
        })
        popup?.close()
      }
    }

    window.addEventListener('message', handleMessage, { once: true })

    // Add timeout to clean up if authentication takes too long
    setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      popup?.close()
      isLoading.value = false
      $q.notify({
        type: 'negative',
        message: 'Authentication timeout'
      })
    }, 300000) // 5 minute timeout
  } catch (error) {
    console.error('GitHub auth error:', error)
    $q.notify({
      type: 'negative',
      message: 'GitHub authentication failed'
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.github-button {
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  border-color: var(--q-dark-page, #dadce0) !important;
  color: var(--q-dark-page, #3c4043) !important;
}

/* Dark mode support */
.body--dark .github-button {
  border-color: rgba(255, 255, 255, 0.28) !important;
  color: rgba(255, 255, 255, 0.87) !important;
}

.github-button:hover {
  box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.30), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
}
</style>
