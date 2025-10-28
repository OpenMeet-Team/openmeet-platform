<template>
  <q-banner
    v-if="shouldShowBanner"
    class="bg-warning text-white q-pa-md"
    data-cy="verify-email-banner"
  >
    <template v-slot:avatar>
      <q-icon name="sym_r_mail" size="md" />
    </template>

    <div class="row items-center justify-between full-width">
      <div class="col">
        <div class="text-weight-bold q-mb-xs">
          Verify your email to manage your RSVPs
        </div>
        <div class="text-caption">
          You're just a couple clicks away from full account access
        </div>
      </div>

      <div class="col-auto q-ml-md">
        <q-btn
          flat
          label="Verify Email"
          color="white"
          @click="startVerification"
          data-cy="verify-email-button"
        />
      </div>
    </div>
  </q-banner>

  <!-- Verification Code Dialog -->
  <q-dialog v-model="showVerificationDialog" persistent>
    <q-card style="min-width: 400px">
      <!-- Step 1: Request Code -->
      <div v-if="verificationStep === 'request'">
        <q-card-section>
          <div class="text-h5 text-bold">Verify Your Email</div>
          <div class="text-body2 text-grey-7 q-mt-sm">
            We'll send a 6-digit verification code to {{ unverifiedEmail }}
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn
            flat
            label="Cancel"
            color="grey-7"
            @click="closeDialog"
            :disable="requestingCode"
          />
          <q-btn
            label="Send Code"
            color="primary"
            @click="requestVerificationCode"
            :loading="requestingCode"
            data-cy="send-verification-code-button"
          />
        </q-card-actions>
      </div>

      <!-- Step 2: Enter Code -->
      <div v-else-if="verificationStep === 'verify'">
        <q-card-section>
          <div class="text-h5 text-bold">Enter Verification Code</div>
          <div class="text-body2 text-grey-7 q-mt-sm q-mb-md">
            We sent a 6-digit code to {{ unverifiedEmail }}
          </div>

          <q-input
            v-model="verificationCode"
            label="6-Digit Code"
            placeholder="000000"
            mask="######"
            maxlength="6"
            outlined
            autofocus
            :error="!!codeError"
            :error-message="codeError"
            data-cy="verification-code-input"
            @keyup.enter="verifyCode"
          >
            <template v-slot:prepend>
              <q-icon name="sym_r_lock" />
            </template>
          </q-input>

          <div class="text-caption text-grey-7 q-mt-sm">
            Didn't receive the code?
            <a @click="requestVerificationCode" class="text-primary cursor-pointer">
              Resend
            </a>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn
            flat
            label="Cancel"
            color="grey-7"
            @click="closeDialog"
            :disable="verifyingCode"
          />
          <q-btn
            label="Verify"
            color="primary"
            @click="verifyCode"
            :loading="verifyingCode"
            :disable="verificationCode.length !== 6"
            data-cy="verify-code-button"
          />
        </q-card-actions>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import { authApi } from '../../api/auth'
import { Notify } from 'quasar'
import { useUnverifiedEmail } from '../../composables/useUnverifiedEmail'

const authStore = useAuthStore()
const { unverifiedEmail, clearUnverifiedEmail } = useUnverifiedEmail()
const showVerificationDialog = ref(false)
const verificationStep = ref<'request' | 'verify'>('request')
const verificationCode = ref('')
const codeError = ref<string | null>(null)
const requestingCode = ref(false)
const verifyingCode = ref(false)

// Check if we should show the banner (reactive - watches unverifiedEmail from composable)
const shouldShowBanner = computed(() => {
  // Only show if:
  // 1. User is not fully authenticated
  // 2. We have an unverified email
  return !authStore.isFullyAuthenticated && !!unverifiedEmail.value
})

const startVerification = () => {
  verificationStep.value = 'request'
  verificationCode.value = ''
  codeError.value = null
  showVerificationDialog.value = true
}

const closeDialog = () => {
  showVerificationDialog.value = false
  verificationCode.value = ''
  codeError.value = null
}

const requestVerificationCode = async () => {
  if (!unverifiedEmail.value) return

  requestingCode.value = true
  codeError.value = null

  try {
    await authApi.requestLoginCode({ email: unverifiedEmail.value })

    // Move to verify step
    verificationStep.value = 'verify'
    verificationCode.value = ''

    Notify.create({
      type: 'positive',
      message: 'Verification code sent! Check your email.',
      position: 'top',
      timeout: 3000
    })
  } catch (error: unknown) {
    console.error('Failed to request verification code:', error)

    const errorMessage = (error && typeof error === 'object' && 'response' in error)
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to send verification code. Please try again.'
      : 'Failed to send verification code. Please try again.'

    Notify.create({
      type: 'negative',
      message: errorMessage,
      position: 'top'
    })
  } finally {
    requestingCode.value = false
  }
}

const verifyCode = async () => {
  if (!unverifiedEmail.value || verificationCode.value.length !== 6) return

  verifyingCode.value = true
  codeError.value = null

  try {
    const response = await authApi.verifyEmailCode({
      email: unverifiedEmail.value,
      code: verificationCode.value
    })

    // Clear unverified email
    clearUnverifiedEmail()

    // Update auth store with the new session
    authStore.actionSetToken(response.data.token)
    authStore.actionSetRefreshToken(response.data.refreshToken)
    authStore.actionSetTokenExpires(response.data.tokenExpires)
    authStore.actionSetUser(response.data.user)

    Notify.create({
      type: 'positive',
      message: 'Email verified! You\'re now logged in.',
      position: 'top',
      timeout: 3000
    })

    // Close dialog
    closeDialog()

    // Reload current page to reflect logged-in state
    window.location.reload()
  } catch (error: unknown) {
    console.error('Failed to verify code:', error)

    const errorMessage = (error && typeof error === 'object' && 'response' in error)
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Invalid or expired code. Please try again.'
      : 'Invalid or expired code. Please try again.'

    codeError.value = errorMessage

    Notify.create({
      type: 'negative',
      message: errorMessage,
      position: 'top'
    })
  } finally {
    verifyingCode.value = false
  }
}
</script>

<style lang="scss" scoped>
.cursor-pointer {
  cursor: pointer;
  text-decoration: underline;
}
</style>
