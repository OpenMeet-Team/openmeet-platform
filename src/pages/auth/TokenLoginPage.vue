<template>
  <q-page padding>
    <div class="c-token-login-page">
      <div v-if="isLoading" class="loading-container">
        <q-spinner-dots size="40px" color="primary" />
        <div class="text-subtitle1 q-mt-md">Signing you in...</div>
      </div>

      <div v-else-if="errorMessage" class="text-center q-mt-xl">
        <q-icon
          name="sym_r_error"
          color="negative"
          size="64px"
          class="q-mb-md"
        />
        <h1 class="text-h4 q-mb-md">Login link expired or invalid</h1>
        <div class="text-body1 text-grey-7 q-mb-lg">
          This login link may have already been used or has expired. Please request a new one.
        </div>
        <q-btn
          color="primary"
          no-caps
          label="Go to Login"
          :to="{ name: 'AuthLoginPage' }"
          data-cy="token-login-go-to-login"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { authApi } from '../../api/auth'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isLoading = ref(true)
const errorMessage = ref('')

/**
 * Sanitize the redirect path to prevent open redirect attacks.
 * Only allows relative paths starting with '/'.
 */
const sanitizeRedirect = (redirect: string | null | undefined): string => {
  if (!redirect || typeof redirect !== 'string') {
    return '/'
  }
  // Must start with / and must not contain :// (protocol) or start with //
  if (!redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('://')) {
    return '/'
  }
  return redirect
}

onMounted(async () => {
  const code = route.query.code as string
  const redirect = route.query.redirect as string

  if (!code) {
    isLoading.value = false
    errorMessage.value = 'No login code provided'
    return
  }

  await exchangeToken(code, redirect)
})

const exchangeToken = async (code: string, redirect?: string) => {
  try {
    isLoading.value = true

    const response = await authApi.exchangeLoginLink(code)

    // Store auth data (same pattern as GoogleCallbackPage / VerifyEmailPage)
    authStore.actionSetToken(response.data.token)
    authStore.actionSetRefreshToken(response.data.refreshToken)
    authStore.actionSetTokenExpires(response.data.tokenExpires)
    authStore.actionSetUser(response.data.user)

    // Redirect to the intended destination
    const safePath = sanitizeRedirect(redirect)
    router.push(safePath)
  } catch (error: unknown) {
    console.error('Token login error:', error)

    errorMessage.value = (error && typeof error === 'object' && 'response' in error)
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Login link expired or invalid'
      : 'Login link expired or invalid'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.c-token-login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.loading-container {
  text-align: center;
}
</style>
