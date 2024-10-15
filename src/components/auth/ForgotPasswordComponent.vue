<template>
  <q-page class="flex flex-center">
    <q-card class="forgot-password-card">
      <q-card-section>
        <div class="text-h6">Forgot Password</div>
      </q-card-section>

      <q-card-section>
        <p class="text-body2 q-mb-md">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
        <q-form @submit="onSubmit" class="q-gutter-md">
          <q-input
            filled
            v-model="email"
            label="Email"
            type="email"
            :rules="[
              (val: string) => !!val || 'Email is required',
              (val: string) => validateEmail(val) || 'Please enter a valid email address'
            ]"
          >
            <template v-slot:prepend>
              <q-icon name="sym_r_email"/>
            </template>
          </q-input>

          <div class="text-grey-6">
            Remember your password?
            <q-btn no-caps padding="none" flat color="primary" label="Login" :to="{name: 'AuthLoginPage'}"/>
          </div>

          <div>
            <q-btn no-caps
              label="Send Reset Instructions"
              type="submit"
              color="primary"
              :loading="loading"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <q-dialog v-model="showSuccessDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Password Reset Email Sent</div>
        </q-card-section>

        <q-card-section>
          We've sent password reset instructions to your email address. Please check your inbox and follow the
          instructions to reset your password.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup/>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from 'stores/auth-store.ts'
import { validateEmail } from 'src/utils/validation.ts'
import { useNotification } from 'src/composables/useNotification.ts'

const email = ref('')
const loading = ref(false)
const showSuccessDialog = ref(false)
const authStore = useAuthStore()
const { error } = useNotification()

const onSubmit = async () => {
  try {
    loading.value = true

    await authStore.actionForgotPassword({ email: email.value })

    showSuccessDialog.value = true

    // Reset form field after successful submission
    email.value = ''
  } catch (err) {
    console.log(err)
    error('Failed to send reset instructions. Please try again.')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.forgot-password-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
}
</style>
