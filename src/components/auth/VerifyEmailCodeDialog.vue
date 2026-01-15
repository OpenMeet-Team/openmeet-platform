<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="verify-code-card" style="min-width: 400px">
      <q-card-section>
        <div class="text-h5 text-bold">Verify Your Email</div>
        <div class="text-caption text-grey-7 q-mt-xs">
          We sent a verification code to {{ email }}
        </div>
      </q-card-section>

      <q-form @submit="onSubmit" class="q-px-md q-pb-md">
        <q-card-section class="q-pt-none">
          <q-input
            filled
            v-model="code"
            label="Verification Code"
            data-cy="verify-code-input"
            unmasked-value
            :rules="[
              (val: string) => !!val || 'Verification code is required'
            ]"
            autofocus
            inputmode="numeric"
            @paste="handlePaste"
          >
            <template v-slot:prepend>
              <q-icon name="sym_r_lock" />
            </template>
            <template v-slot:hint>
              Enter the code from your email
            </template>
          </q-input>

          <!-- Development only: Show the verification code if available -->
          <div v-if="devVerificationCode" class="q-mt-md q-pa-sm bg-warning text-white rounded-borders">
            <div class="text-caption">
              <q-icon name="sym_r_code" size="xs" class="q-mr-xs" />
              Development Mode - Your code: <strong>{{ devVerificationCode }}</strong>
            </div>
          </div>

          <div class="text-caption text-grey-7 q-mt-md">
            <q-icon name="sym_r_info" size="xs" class="q-mr-xs" />
            Didn't receive the code? Check your spam folder or request a new one.
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn
            flat
            label="Cancel"
            color="grey-7"
            @click="onCancel"
            :disable="loading"
            data-cy="verify-code-cancel"
          />
          <q-btn
            type="submit"
            label="Verify & Sign In"
            color="primary"
            :loading="loading"
            data-cy="verify-code-submit"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../stores/auth-store'
import { Notify } from 'quasar'
import getEnv from '../../utils/env'

const props = defineProps<{
  modelValue: boolean
  email: string
  verificationCode?: string // For development/testing
  context?: 'login' | 'account-merge' // Context for verification
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

const authStore = useAuthStore()
const showDialog = ref(props.modelValue)
const code = ref('')
const loading = ref(false)

// Show verification code in development mode
const isDevelopment = getEnv('NODE_ENV') === 'development'
const devVerificationCode = ref(isDevelopment ? props.verificationCode : undefined)

// Watch for external changes to modelValue
watch(() => props.modelValue, (newVal) => {
  showDialog.value = newVal
  if (newVal && isDevelopment && props.verificationCode) {
    devVerificationCode.value = props.verificationCode
  }
})

// Watch for internal changes to showDialog
watch(showDialog, (newVal) => {
  if (!newVal) {
    emit('update:modelValue', false)
  }
})

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedText = event.clipboardData?.getData('text') || ''
  // Extract only digits and limit to 6 characters
  const digits = pastedText.replace(/\D/g, '')
  code.value = digits.slice(0, 6)
}

const onSubmit = async () => {
  loading.value = true

  try {
    const response = await authApi.verifyEmailCode({
      code: code.value,
      email: props.email,
      context: props.context
    })

    // Store auth data (same as regular login)
    authStore.actionSetToken(response.data.token)
    authStore.actionSetRefreshToken(response.data.refreshToken)
    authStore.actionSetTokenExpires(response.data.tokenExpires)
    authStore.actionSetUser(response.data.user)

    // Initialize Matrix if ready (matching other login flows)
    await authStore.initializeMatrixIfReady()

    // Adjust success message based on context
    const successMessage = props.context === 'account-merge'
      ? 'Accounts merged successfully! You are now signed in.'
      : 'Email verified! You are now signed in.'

    Notify.create({
      type: 'positive',
      message: successMessage,
      position: 'top'
    })

    emit('success')
    showDialog.value = false

    // Show helpful tip about setting a password after a brief delay (only for non-merge)
    if (props.context !== 'account-merge') {
      setTimeout(() => {
        Notify.create({
          type: 'info',
          message: 'Tip: You can set a password in your profile settings to make future logins easier.',
          position: 'top',
          timeout: 5000,
          actions: [
            { label: 'Dismiss', color: 'white' }
          ]
        })
      }, 2000)
    }

    // No need to reload - the auth state watchers will handle UI updates
    // The EventAttendanceButton already watches authStore.isFullyAuthenticated
  } catch (error: unknown) {
    console.error('Verification error:', error)

    const errorMessage = (error && typeof error === 'object' && 'response' in error)
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Invalid or expired code. Please try again.'
      : 'Invalid or expired code. Please try again.'

    Notify.create({
      type: 'negative',
      message: errorMessage,
      position: 'top'
    })

    // Clear the code field on error
    code.value = ''
  } finally {
    loading.value = false
  }
}

const onCancel = () => {
  showDialog.value = false
}
</script>

<style scoped lang="scss">
.verify-code-card {
  max-width: 500px;
}
</style>
