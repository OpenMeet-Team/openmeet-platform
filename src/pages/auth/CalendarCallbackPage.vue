<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { exchangeAuthCode } from '../../api/calendar'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const loading = ref(true)
const error = ref<string | null>(null)
const success = ref(false)

onMounted(async () => {
  const { code, state, error: oauthError, type } = route.query

  if (oauthError) {
    error.value = `OAuth error: ${oauthError}`
    loading.value = false
    return
  }

  if (!code || !state || !type) {
    error.value = 'Missing required OAuth parameters'
    loading.value = false
    return
  }

  if (!['google', 'outlook', 'apple'].includes(type as string)) {
    error.value = 'Invalid calendar type'
    loading.value = false
    return
  }

  try {
    const response = await exchangeAuthCode(
      type as 'google' | 'outlook' | 'apple',
      code as string,
      state as string
    )

    success.value = true

    $q.notify({
      type: 'positive',
      message: `Successfully connected ${response.data.name}!`,
      timeout: 3000
    })

    // Redirect to profile page after 2 seconds
    setTimeout(() => {
      router.push('/dashboard/profile')
    }, 2000)
  } catch (err: unknown) {
    console.error('OAuth callback error:', err)
    const errorMessage = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : 'Failed to connect calendar'
    error.value = errorMessage || 'Failed to connect calendar'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <q-page class="flex flex-center">
    <div class="text-center" style="max-width: 400px;">
      <!-- Loading State -->
      <div v-if="loading">
        <q-spinner-dots size="4em" color="primary" />
        <div class="text-h6 q-mt-md">Connecting your calendar...</div>
        <div class="text-body2 text-grey-6 q-mt-sm">
          Please wait while we complete the connection.
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="success">
        <q-icon name="sym_r_check_circle" size="4em" color="positive" />
        <div class="text-h6 text-positive q-mt-md">Calendar Connected!</div>
        <div class="text-body2 text-grey-6 q-mt-sm">
          Redirecting you to your profile settings...
        </div>
        <q-linear-progress
          :value="1"
          color="positive"
          class="q-mt-md"
          animation-speed="2000"
        />
      </div>

      <!-- Error State -->
      <div v-else-if="error">
        <q-icon name="sym_r_error" size="4em" color="negative" />
        <div class="text-h6 text-negative q-mt-md">Connection Failed</div>
        <div class="text-body2 text-grey-7 q-mt-sm q-mb-lg">
          {{ error }}
        </div>

        <div class="q-gutter-sm">
          <q-btn
            color="primary"
            label="Try Again"
            @click="router.push('/dashboard/profile')"
          />
          <q-btn
            flat
            color="grey"
            label="Go to Dashboard"
            @click="router.push('/dashboard')"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.q-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.text-center {
  background: white;
  border-radius: 16px;
  padding: 3rem 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
</style>
