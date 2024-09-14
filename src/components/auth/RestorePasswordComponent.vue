<template>
  <q-page class="flex flex-center">
    <q-card class="restore-password-card">
      <q-card-section>
        <div class="text-h6">Restore Password</div>
      </q-card-section>

      <q-card-section>
        <p class="text-body2 q-mb-md">
          Enter your email address and new password.
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

          <q-input
            filled
            v-model="password"
            label="New Password"
            :type="isPwd ? 'password' : 'text'"
            :rules="[
              val => !!val || 'Password is required',
              val => val.length >= 8 || 'Password must be at least 8 characters'
            ]"
          >
            <template v-slot:append>
              <q-icon
                :name="isPwd ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>

          <div class="text-grey-6">
            Remember your password?
            <q-btn flat color="primary" label="Login" to="/auth/login"/>
          </div>

          <div>
            <q-btn
              label="Reset password"
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
          <div class="text-h6">New Password is set!</div>
        </q-card-section>

        <q-card-section>
          Please log in using your newly created password
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" to="auth/login" v-close-popup/>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { restorePassword } from 'src/api/auth.ts'
import { useRoute } from 'vue-router'

const $q = useQuasar()
const route = useRoute()

const email = ref('')
const password = ref('')
const token: string = (route.query.token as string | null) ?? ''
const isPwd = ref(true)
const loading = ref(false)
const showSuccessDialog = ref(false)

const isValidEmail = (val: string): boolean => {
  const emailPattern = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/
  return emailPattern.test(val)
}

const onSubmit = async () => {
  try {
    loading.value = true
    // Here you would typically send a request to your API to initiate the password reset process
    console.log('Requesting password reset for:', email.value)

    await restorePassword({ email: email.value, password: password.value, token })

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
.restore-password-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
}
</style>
