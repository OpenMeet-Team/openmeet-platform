<template>
  <q-page class="flex flex-center">
    <q-card class="auth-card q-pa-lg">
      <q-card-section>
        <div class="text-h6">Complete Your Profile</div>
        <div class="text-subtitle2">Please provide your email address to continue</div>
      </q-card-section>

      <!-- Banner for merge scenario -->
      <q-banner v-if="mergeDetected" class="bg-info text-white q-mb-md" rounded>
        <template v-slot:avatar>
          <q-icon name="sym_r_merge" color="white" />
        </template>
        <div class="text-body2">
          We found an existing account with this email. Enter the verification code
          we sent to complete the merge. Your RSVPs will be preserved.
        </div>
      </q-banner>

      <q-card-section>
        <q-form @submit="onEmailSubmit" class="q-gutter-md">
          <q-input
            v-model="email"
            label="Email"
            type="email"
            :disable="mergeDetected"
            :rules="[
              val => !!val || 'Email is required',
              val => /^[^@]+@[^@]+\.[^@]+$/.test(val) || 'Please enter a valid email'
            ]"
          />

          <div class="text-caption text-grey-7">
            Your email will be used for important notifications and account recovery
          </div>

          <q-card-actions align="right" class="q-mt-md">
            <q-btn
              v-if="!mergeDetected"
              label="Submit"
              type="submit"
              color="primary"
              :loading="loading"
            />
            <q-btn
              v-else
              label="Enter Verification Code"
              color="primary"
              @click="showVerificationDialog = true"
            />
          </q-card-actions>
        </q-form>
      </q-card-section>

      <!-- Verification Dialog for account merge -->
      <VerifyEmailCodeDialog
        v-model="showVerificationDialog"
        :email="email"
        :verification-code="devVerificationCode"
        context="account-merge"
        @success="onMergeSuccess"
      />
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import { useNotification } from '../../composables/useNotification'
import { authApi } from '../../api/auth'
import VerifyEmailCodeDialog from '../../components/auth/VerifyEmailCodeDialog.vue'
import getEnv from '../../utils/env'

const authStore = useAuthStore()
const { success, error: showError } = useNotification()
const email = ref('')
const loading = ref(false)
const mergeDetected = ref(false)
const showVerificationDialog = ref(false)
const devVerificationCode = ref<string | undefined>()

const isDevelopment = getEnv('NODE_ENV') === 'development'

interface MergeConflictResponse {
  status: number
  mergeAvailable: boolean
  message: string
  verificationCode?: string
}

const onEmailSubmit = async () => {
  loading.value = true
  try {
    const user = authStore.getUser
    const response = await authApi.updateMe({
      ...user,
      email: email.value
    })

    authStore.actionSetUser(response.data)
    success('Email updated successfully')
    window.location.replace('/')
  } catch (err: unknown) {
    console.error('Failed to update email:', err)

    // Check if it's a merge scenario (409 Conflict with mergeAvailable)
    if (err && typeof err === 'object' && 'response' in err) {
      const apiError = err as { response?: { status?: number; data?: MergeConflictResponse } }

      if (apiError.response?.status === 409 && apiError.response?.data?.mergeAvailable) {
        // Merge scenario detected - verification code was already sent by backend
        mergeDetected.value = true

        // Store dev verification code if provided
        if (isDevelopment && apiError.response.data.verificationCode) {
          devVerificationCode.value = apiError.response.data.verificationCode
        }

        // Show the verification dialog
        showVerificationDialog.value = true
        success('Verification code sent to your email')
        return
      }

      // Not eligible for merge - show the error message
      if (apiError.response?.status === 409) {
        showError(apiError.response.data?.message || 'This email is already in use by another account.')
        return
      }
    }

    // Generic error
    showError('Failed to update email')
  } finally {
    loading.value = false
  }
}

const onMergeSuccess = () => {
  // Verification was successful, user is now logged in as merged account
  // Redirect to home after a brief delay
  setTimeout(() => {
    window.location.replace('/')
  }, 1000)
}
</script>

<style lang="scss" scoped>
.auth-card {
  width: 100%;
  max-width: 500px;
}
</style>
