<template>
  <q-page class="flex flex-center">
    <q-card class="login-card">
      <q-card-section>
        <div class="text-h6">{{ $t('auth.login') }}</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit.prevent="onSubmit" class="q-gutter-md">
          <q-input
            filled
            v-model="email"
            :label="$t('auth.email')"
            type="email"
            :rules="[val => !!val || $t('auth.emailRequired')]"
          />

          <q-input
            filled
            v-model="password"
            :label="$t('auth.password')"
            :type="isPwd ? 'password' : 'text'"
            :rules="[val => !!val || $t('auth.passwordRequired')]"
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
            No account yet?
            <q-btn flat color="primary" label="Registration" to="/auth/register"/>
          </div>
          <div class="text-grey-6">
            Forgot password?
            <q-btn flat color="primary" label="Restore" to="/auth/forgot-password"/>
          </div>

          <div>
            <q-btn label="Login" type="submit" color="primary"/>
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { login } from 'src/api/auth.ts'

const $q = useQuasar()

const email = ref<string>('')
const password = ref<string>('')
const isPwd = ref<boolean>(true)

const validateEmail = (email: string): boolean => {
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const onSubmit = (): void => {
  if (email.value && password.value && validateEmail(email.value)) {
    login({
      email: email.value,
      password: password.value
    }).then(response => {
      console.log('Login success:', response.data)

      $q.notify({
        color: 'green-4',
        textColor: 'white',
        icon: 'cloud_done',
        message: 'Login attempt successful'
      })
    }).catch(error => {
      console.error('Error logging in:', error)
    })
  } else {
    $q.notify({
      color: 'red-5',
      textColor: 'white',
      icon: 'warning',
      message: 'Please provide a valid email and password'
    })
  }
}
</script>

<style scoped>
.login-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
}
</style>
