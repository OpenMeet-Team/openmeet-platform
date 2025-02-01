<template>
  <div class="c-github-callback-page">
    <q-card v-if="error" class="error-card q-pa-md">
      <q-card-section>
        <div class="text-h6 text-negative">Authentication Failed</div>
        <div class="text-body2">{{ error }}</div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Try Again" color="primary" @click="redirectToLogin" />
      </q-card-actions>
    </q-card>

    <div v-else class="loading-container">
      <q-spinner-dots size="40px" color="primary" />
      <div class="text-subtitle1 q-mt-md">Completing authentication...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { useQuasar } from 'quasar'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const $q = useQuasar()
const error = ref<string | null>(null)

const handleCallback = async () => {
  try {
    console.log('Starting GitHub callback handler')
    const code = route.query.code as string
    console.log('Received code:', code)

    const returnedState = route.query.state as string
    const originalState = sessionStorage.getItem('github_oauth_state')
    console.log('State verification:', { returnedState, originalState })

    if (!code) {
      throw new Error('No authorization code received')
    }

    // Verify state parameter
    if (returnedState !== originalState) {
      throw new Error('Invalid state parameter')
    }

    // Send message to opener window
    if (window.opener) {
      await authStore.actionGithubLogin(code)
      window.opener.location.reload()
      window.close()
    } else {
      await authStore.actionGithubLogin(code)
      $q.notify({
        type: 'positive',
        message: 'Successfully logged in with GitHub'
      })
      router.push('/')
    }
  } catch (err) {
    console.error('GitHub callback detailed error:', err)
    if (err.response) {
      console.error('Error response:', err.response.data)
    }
    error.value = err instanceof Error ? err.message : 'Authentication failed'

    // If in popup, send error to parent
    if (window.opener) {
      window.opener.postMessage(
        { error: error.value },
        window.location.origin
      )
      window.close()
    }
  }
}

const redirectToLogin = () => {
  if (window.opener) {
    window.close()
  } else {
    router.push('/auth/login')
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

.error-card {
  max-width: 400px;
  width: 90%;
}
</style>
