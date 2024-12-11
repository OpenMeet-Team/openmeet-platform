<!-- platform/src/components/auth/BlueskyLoginComponent.vue -->
<template>
  <div v-if="blueskyClientId" class="c-bluesky-login-component row justify-center">
    <q-btn
      :loading="isLoading"
      :disable="isLoading"
      no-caps
      @click="handleBlueskyLogin"
    >
      <template v-slot:default>
        <div class="row items-center no-wrap">
          <q-icon name="img:src/assets/bluesky-logo.svg" size="18px" class="q-mr-sm" />
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
// import { useAuthStore } from 'src/stores/auth-store'
import getEnv from 'src/utils/env'

const props = withDefaults(defineProps<{
  text?: 'join_with' | 'signin_with' | 'signup_with' | 'continue_with'
}>(), {
  text: 'join_with'
})

const isLoading = ref(false)
const $q = useQuasar()
// const authStore = useAuthStore()
const blueskyClientId = getEnv('APP_BLUESKY_CLIENT_ID')

const buttonText = computed(() => {
  const textMap = {
    join_with: 'Join with Bluesky',
    signin_with: 'Sign in with Bluesky',
    signup_with: 'Sign up with Bluesky',
    continue_with: 'Continue with Bluesky'
  }
  return textMap[props.text]
})

const handleBlueskyLogin = async () => {
  try {
    isLoading.value = true

    const redirectUri = `${window.location.origin}/auth/bluesky/callback`
    const state = Math.random().toString(36).substring(7)
    sessionStorage.setItem('bluesky_oauth_state', state)

    const blueskyUrl = new URL('https://bsky.app/oauth/authorize')
    blueskyUrl.searchParams.append('client_id', blueskyClientId as string)
    blueskyUrl.searchParams.append('redirect_uri', redirectUri)
    blueskyUrl.searchParams.append('scope', 'read write')
    blueskyUrl.searchParams.append('state', state)
    blueskyUrl.searchParams.append('response_type', 'code')

    const width = 600
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      blueskyUrl.toString(),
      'Bluesky Login',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    window.addEventListener('message', async (event) => {
      if (event.origin !== window.location.origin) return

      const { code, state: returnedState } = event.data

      if (returnedState !== sessionStorage.getItem('bluesky_oauth_state')) {
        throw new Error('Invalid state parameter')
      }

      if (code) {
        // await authStore.actionBlueskyLogin(code)
        $q.notify({
          type: 'positive',
          message: 'Successfully logged in with Bluesky'
        })
        popup?.close()
      }
    }, { once: true })
  } catch (error) {
    console.error('Bluesky auth error:', error)
    $q.notify({
      type: 'negative',
      message: 'Bluesky authentication failed'
    })
  } finally {
    isLoading.value = false
    sessionStorage.removeItem('bluesky_oauth_state')
  }
}
</script>

<style scoped>

</style>
