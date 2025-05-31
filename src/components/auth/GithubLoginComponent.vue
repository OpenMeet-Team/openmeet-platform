<template>
  <div v-if="githubClientId" class="c-github-login-component github-auth-container row justify-center">
    <q-btn
      :loading="isLoading"
      :disable="isLoading"
      class="github-button"
      @click="handleGithubLogin"
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

    // GitHub OAuth configuration
    const redirectUri = `${window.location.origin}/auth/github/callback`

    // Generate random state for security
    const state = Math.random().toString(36).substring(7)
    sessionStorage.setItem('github_oauth_state', state)

    // Construct GitHub OAuth URL with state parameter
    const githubUrl = new URL('https://github.com/login/oauth/authorize')
    githubUrl.searchParams.append('client_id', githubClientId as string)
    githubUrl.searchParams.append('redirect_uri', redirectUri)
    githubUrl.searchParams.append('state', state)
    githubUrl.searchParams.append('scope', 'user:email') // Add required scopes

    // Open popup
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
    sessionStorage.removeItem('github_oauth_state')
  }
}
</script>

<style scoped>
.github-button {
  background: #24292e;
  color: white;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
  margin: 0 auto;
}

.github-button:hover {
  background: #2f363d;
}
</style>
