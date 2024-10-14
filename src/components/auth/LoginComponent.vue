<template>
  <q-card class="login-card">
    <q-card-section>
      <div class="text-h6">Login</div>
    </q-card-section>

    <q-card-section>
      <q-form @submit.prevent="onSubmit" class="q-gutter-md">
        <q-input
          filled
          v-model="email"
          label="Email"
          type="email"
          :rules="[(val: string) => !!val || 'Email is required']"
        />

        <q-input
          filled
          v-model="password"
          label="Password"
          :type="isPwd ? 'password' : 'text'"
          :rules="[(val: string) => !!val || 'Password is required']"
        >
          <template v-slot:append>
            <q-icon
              :name="isPwd ? 'sym_r_visibility_off' : 'sym_r_visibility'"
              class="cursor-pointer"
              @click="isPwd = !isPwd"
            />
          </template>
        </q-input>

        <div class="text-grey-6">
          No account yet?
          <q-btn padding="none" no-caps flat color="primary" label="Registration" :to="{name: 'AuthRegisterPage'}"/>
        </div>
        <div class="text-grey-6">
          Forgot password?
          <q-btn padding="none" no-caps flat color="primary" label="Restore" :to="{name: 'AuthForgotPasswordPage'}"/>
        </div>

        <div>
          <q-btn no-caps label="Login" type="submit" color="primary"/>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from 'stores/auth-store.ts'
import { useRoute, useRouter } from 'vue-router'
import { validateEmail } from 'src/utils/validation'
import { useNotification } from 'src/composables/useNotification.ts'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref<string>('')
const password = ref<string>('')
const isPwd = ref<boolean>(true)

const emits = defineEmits(['login', 'to'])
const { warning } = useNotification()

const onSubmit = (): void => {
  if (email.value && password.value && validateEmail(email.value)) {
    authStore.actionLogin({
      email: email.value,
      password: password.value
    }).then(() => {
      email.value = ''
      password.value = ''
      emits('login')
      return router.push((route.query.redirect || '/') as string)
    }).catch(error => {
      console.error('Error logging in:', error)
      warning('Please provide a valid email and password')
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
