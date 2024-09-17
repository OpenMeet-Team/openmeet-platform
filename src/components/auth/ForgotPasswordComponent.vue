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
              val => !!val || 'Email is required',
              val => isValidEmail(val) || 'Please enter a valid email address'
            ]"
          >
            <template v-slot:prepend>
              <q-icon name="email"/>
            </template>
          </q-input>

          <div class="text-grey-6">
            Remember your password?
            <q-btn flat color="primary" label="Login" to="/auth/login"/>
          </div>

          <div>
            <q-btn
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
import { useQuasar } from 'quasar'
import { useAuthStore } from 'stores/auth-store.ts'

const $q = useQuasar()

const email = ref('')
const loading = ref(false)
const showSuccessDialog = ref(false)
const authStore = useAuthStore()

const isValidEmail = (val: string): boolean => {
  const emailPattern = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/
  return emailPattern.test(val)
}

const onSubmit = async () => {
  try {
    loading.value = true

    await authStore.actionForgotPassword({ email: email.value })

    showSuccessDialog.value = true

    // Reset form field after successful submission
    email.value = ''
  } catch (error) {
    $q.notify({
      color: 'negative',
      textColor: 'white',
      icon: 'warning',
      message: 'Failed to send reset instructions. Please try again.'
    })
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
