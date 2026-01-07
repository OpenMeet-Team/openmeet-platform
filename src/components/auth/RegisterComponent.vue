<template>
  <q-card class="register-card q-pa-sm">
    <q-card-section>
      <div class="text-h5 text-bold">Create your account</div>
      <div class="text-body2 text-grey-7 q-mt-xs">Join thousands of community organizers</div>
    </q-card-section>

    <!-- OAuth options first -->
    <q-card-section class="q-pt-none" v-if="!showVerification">
      <GoogleLoginComponent @success="emits('register')" />
      <BlueSkyLoginComponent class="q-mt-sm" @success="emits('register')" />
      <GithubLoginComponent class="q-mt-sm" @success="emits('register')" />
    </q-card-section>

    <!-- Divider -->
    <div class="row items-center q-px-md q-my-sm" v-if="!showVerification">
      <div class="col"><q-separator /></div>
      <div class="col-auto q-px-md text-grey-6 text-caption">or use email</div>
      <div class="col"><q-separator /></div>
    </div>

    <q-form @submit="onSubmit" class="q-gutter-md" data-cy="register-form" v-if="!showVerification">
      <q-card-section class="q-pt-none">
        <q-input
          filled
          v-model="fullName"
          data-cy="register-full-name"
          label="Your name"
          placeholder="e.g., Jane Doe"
          :rules="[
              (val: string) => !!val || 'Name is required',
            ]"
        />

        <q-input
          filled
          v-model="email"
          data-cy="register-email"
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
          data-cy="register-password"
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
          data-cy="register-confirm-password"
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

        <div class="row items-center">
          <q-toggle v-model="accept"
                    data-cy="register-accept"
                    :rules="[(val: boolean) => val || 'To continue, please check the box to accept the terms and conditions.']"/>
          I accept the <a href="https://biz.openmeet.net/terms" target="_blank" class="q-ml-xs text-primary router-link-inherit">terms</a>.
        </div>

        <div class="text-grey-6">
          Already have an account?
          <AuthLoginLinkComponent/>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn no-caps label="Register" data-cy="register-submit" class="full-width" rounded :loading="isLoading" type="submit" color="primary"/>
      </q-card-actions>
    </q-form>

    <!-- Email Verification Dialog -->
    <VerifyEmailCodeDialog
      v-model="showVerification"
      :email="email"
      @success="onVerificationSuccess"
    />
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import { validateEmail } from '../../utils/validation'
import { useRoute, useRouter } from 'vue-router'
import { useNotification } from '../../composables/useNotification'
import { useMeta } from 'quasar'
import AuthLoginLinkComponent from '../../components/auth/AuthLoginLinkComponent.vue'
import GoogleLoginComponent from './GoogleLoginComponent.vue'
import GithubLoginComponent from './GithubLoginComponent.vue'
import BlueSkyLoginComponent from './BlueSkyLoginComponent.vue'
import VerifyEmailCodeDialog from './VerifyEmailCodeDialog.vue'

const emits = defineEmits(['register'])
const fullName = ref<string>('')
const email = ref<string>('')
const password = ref<string>('')
const confirmPassword = ref<string>('')
const isPwd = ref<boolean>(true)
const isConfirmPwd = ref<boolean>(true)
const accept = ref<boolean>(false)
const authStore = useAuthStore()
const isLoading = ref<boolean>(false)
const showVerification = ref<boolean>(false)

const router = useRouter()
const route = useRoute()
const { error, warning } = useNotification()

// Split full name into first and last name for the backend
const splitName = (name: string): { firstName: string; lastName: string } => {
  const trimmed = name.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

const onSubmit = async () => {
  if (!accept.value) return warning('Please accept our terms')

  isLoading.value = true
  const { firstName, lastName } = splitName(fullName.value)

  return authStore.actionRegister({
    firstName,
    lastName,
    email: email.value,
    password: password.value
  }).then(() => {
    // Registration succeeded - show verification dialog
    // Response no longer includes tokens, only a message
    showVerification.value = true
  }).catch(() => {
    error('Registration failed. Please try again.')
  }).finally(() => {
    isLoading.value = false
  })
}

const onVerificationSuccess = () => {
  // Email verified and user logged in
  emits('register')
  return router.push((route.query.redirect || '/') as string)
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
  border-radius: 24px;
}
</style>
