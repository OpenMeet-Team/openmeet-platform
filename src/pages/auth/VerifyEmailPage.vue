<template>
  <q-page padding>
    <SpinnerComponent v-if="isLoading" message="Verifying your email..." />
    <div v-else class="text-center q-mt-xl">
      <q-icon
        :name="isSuccess ? 'sym_r_check_circle' : 'sym_r_error'"
        :color="isSuccess ? 'positive' : 'negative'"
        size="64px"
        class="q-mb-md"
      />
      <h1 class="text-h4 q-mb-md">{{ message }}</h1>
      <div v-if="isSuccess" class="text-body1 text-grey-7 q-mb-lg">
        You're now logged in and can access all features!
      </div>
      <div class="row q-gutter-md justify-center">
        <q-btn
          v-if="eventSlug"
          color="primary"
          no-caps
          label="View Event"
          :to="{ name: 'EventPage', params: { slug: eventSlug } }"
          data-cy="verify-email-view-event"
        />
        <q-btn
          v-else
          color="primary"
          no-caps
          label="Go to Home"
          :to="{ name: 'HomePage' }"
          data-cy="verify-email-home"
        />
        <q-btn
          outline
          color="primary"
          no-caps
          label="View My Events"
          :to="{ name: 'DashboardEventsPage' }"
          data-cy="verify-email-dashboard"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { authApi } from '../../api/auth'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { Notify } from 'quasar'

const route = useRoute()
const authStore = useAuthStore()
const isLoading = ref(true)
const isSuccess = ref(false)
const message = ref('')
const eventSlug = ref<string | null>(null)

onMounted(async () => {
  const code = route.query.code as string
  const email = route.query.email as string
  eventSlug.value = (route.query.event as string) || null

  if (!code || !email) {
    isLoading.value = false
    isSuccess.value = false
    message.value = 'Invalid verification link'

    Notify.create({
      type: 'negative',
      message: 'Missing verification code or email. Please check your email link.',
      position: 'top'
    })
    return
  }

  await verifyEmail(code, email)
})

const verifyEmail = async (code: string, email: string) => {
  try {
    isLoading.value = true

    const response = await authApi.verifyEmailCode({ code, email })

    // Store auth data (same as login flow)
    authStore.actionSetToken(response.data.token)
    authStore.actionSetRefreshToken(response.data.refreshToken)
    authStore.actionSetTokenExpires(response.data.tokenExpires)
    authStore.actionSetUser(response.data.user)

    // Initialize Matrix if ready (matching other login flows)
    await authStore.initializeMatrixIfReady()

    isSuccess.value = true
    message.value = 'Email Verified Successfully!'

    Notify.create({
      type: 'positive',
      message: 'Welcome to OpenMeet! Your email has been verified.',
      position: 'top',
      timeout: 3000
    })
  } catch (error: unknown) {
    console.error('Email verification error:', error)

    isSuccess.value = false

    const errorMessage = (error && typeof error === 'object' && 'response' in error)
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Verification failed'
      : 'Verification failed'

    message.value = errorMessage

    Notify.create({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 5000
    })
  } finally {
    isLoading.value = false
  }
}

</script>
