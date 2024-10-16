<template>
  <q-card class="register-card">
      <q-card-section>
        <div class="text-h6">Register</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="onSubmit" class="q-gutter-md">
          <q-input
            filled
            v-model="firstName"
            label="First name"
            :rules="[
              (val: string) => !!val || 'First name name is required',
            ]"
          />

          <q-input
            filled
            v-model="lastName"
            label="Last name"
            :rules="[
              (val: string) => !!val || 'Last name is required',
            ]"
          />

          <q-input
            filled
            v-model="email"
            label="Your Email"
            type="email"
            :rules="[
              (val: string) => !!val || 'Email is required',
              (val: string) => validateEmail(val) || 'Please enter a valid email address'
            ]"
          />

          <q-input
            filled
            v-model="password"
            label="Password"
            :type="isPwd ? 'password' : 'text'"
            :rules="[
              (val: string) => !!val || 'Password is required',
              (val: string) => val.length >= 8 || 'Password must be at least 8 characters'
            ]"
          >
            <template v-slot:append>
              <q-icon
                :name="isPwd ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                class="cursor-pointer"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>

          <q-input
            filled
            v-model="confirmPassword"
            label="Confirm Password"
            :type="isConfirmPwd ? 'password' : 'text'"
            :rules="[
              (val: string) => !!val || 'Please confirm your password',
              (val: string) => val === password || 'Passwords do not match'
            ]"
          >
            <template v-slot:append>
              <q-icon
                :name="isConfirmPwd ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                class="cursor-pointer"
                @click="isConfirmPwd = !isConfirmPwd"
              />
            </template>
          </q-input>

          <q-toggle v-model="accept" :rules="[(val: boolean) => val || 'To continue, please check the box to accept the terms and conditions.']">
              I accept the <a href="https://biz.openmeet.net/terms" target="_blank" class="text-primary">terms</a>.
          </q-toggle>

          <div>
            <q-btn no-caps label="Register" type="submit" color="primary"/>
          </div>
        </q-form>
      </q-card-section>

      <q-card-section class="text-center q-pt-none">
        <p class="text-grey-6">
          Already have an account?
          <q-btn padding="none" no-caps flat color="primary" label="Login" :to="{name: 'AuthLoginPage'}"/>
        </p>
      </q-card-section>
    </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from 'stores/auth-store.ts'

const emits = defineEmits(['register'])
const firstName = ref<string>('')
const lastName = ref<string>('')
const email = ref<string>('')
const password = ref<string>('')
const confirmPassword = ref<string>('')
const isPwd = ref<boolean>(true)
const isConfirmPwd = ref<boolean>(true)
const accept = ref<boolean>(false)
const authStore = useAuthStore()
import { validateEmail } from 'src/utils/validation'
import { useRoute, useRouter } from 'vue-router'
import { useNotification } from 'src/composables/useNotification.ts'
import { useMeta } from 'quasar'

const router = useRouter()
const route = useRoute()
const { error, warning } = useNotification()

const onSubmit = async () => {
  if (!accept.value) return warning('Please accept our terms')

  return authStore.actionRegister({
    firstName: firstName.value,
    lastName: lastName.value,
    email: email.value,
    password: password.value
  }).then(() => {
    firstName.value = ''
    lastName.value = ''
    email.value = ''
    password.value = ''
    confirmPassword.value = ''
    accept.value = false

    emits('register')
    return router.push((route.query.redirect || '/') as string)
  }).catch(() => {
    error('Registration failed. Please try again.')
  })
}

useMeta({
  title: 'Registration'
})
</script>

<style scoped>
.register-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
}
</style>
