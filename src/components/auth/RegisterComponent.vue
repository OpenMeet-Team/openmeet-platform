<template>
  <q-page class="flex flex-center">
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
              val => !!val || 'First name name is required',
            ]"
          />

          <q-input
            filled
            v-model="lastName"
            label="Last name"
            :rules="[
              val => !!val || 'Last name is required',
            ]"
          />

          <q-input
            filled
            v-model="email"
            label="Your Email"
            type="email"
            :rules="[
              val => !!val || 'Email is required',
              val => validateEmail(val) || 'Please enter a valid email address'
            ]"
          />

          <q-input
            filled
            v-model="password"
            label="Password"
            :type="isPwd ? 'password' : 'text'"
            :rules="[
              val => !!val || 'Password is required',
              val => val.length >= 8 || 'Password must be at least 8 characters'
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
              val => !!val || 'Please confirm your password',
              val => val === password || 'Passwords do not match'
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
  </q-page>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar'
import { ref } from 'vue'
import { useAuthStore } from 'stores/auth-store.ts'

const $q = useQuasar()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isPwd = ref(true)
const isConfirmPwd = ref(true)
const authStore = useAuthStore()
import { validateEmail } from 'src/utils/validation'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const onSubmit = async () => {
  return authStore.actionRegister({
    firstName: firstName.value,
    lastName: lastName.value,
    email: email.value,
    password: password.value
  }).then(response => {
    console.log(response.data)

    firstName.value = ''
    lastName.value = ''
    email.value = ''
    password.value = ''
    confirmPassword.value = ''

    return router.push((route.query.redirect || '/') as string)
  }).catch(error => {
    console.log(error)
    $q.notify({
      color: 'negative',
      textColor: 'white',
      icon: 'warning',
      message: 'Registration failed. Please try again.'
    })
  })
}
</script>

<style scoped>
.register-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
}
</style>
