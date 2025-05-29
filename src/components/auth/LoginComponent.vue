<template>
  <q-card class="login-card q-pa-sm" data-cy="login-card">
    <!-- Dev Mode Banner -->
    <q-banner v-if="isDev" class="bg-grey-3">
      Development Mode
    </q-banner>

    <q-form @submit.prevent="onSubmit" class="q-gutter-md" data-cy="login-form">

      <q-card-section>
        <div class="text-h5 text-bold">Login</div>
      </q-card-section>

      <q-card-section>
        <q-input
          filled
          v-model="email"
          label="Email"
          type="email"
          data-cy="login-email"
          :rules="[(val: string) => !!val || 'Email is required']"
        />

        <q-input
          filled
          v-model="password"
          label="Password"
          data-cy="login-password"
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
          <router-link class="router-link-inherit text-bold text-primary" :to="{name: 'AuthRegisterPage', query: route.query}">
            Registration
          </router-link>
        </div>
        <div class="text-grey-6">
          Forgot password?
          <router-link class="router-link-inherit text-bold text-primary" :to="{name: 'AuthForgotPasswordPage', query: route.query}">
            Restore
          </router-link>
        </div>
        <div class="q-mt-md">
          <q-btn block no-caps rounded class="full-width" label="Login" :loading="isLoading" type="submit" color="primary" data-cy="login-submit"/>
        </div>

        <div class="text-grey-6">
          <GoogleLoginComponent class="q-mt-md" @success="emits('login')" />
          <GithubLoginComponent class="q-mt-md" @success="emits('login')" />
          <BlueSkyLoginComponent class="q-mt-md" @success="emits('login')" />
        </div>
      </q-card-section>
    </q-form>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import { useRoute, useRouter } from 'vue-router'
import { validateEmail } from '../../utils/validation'
import { useNotification } from '../../composables/useNotification'
import GoogleLoginComponent from './GoogleLoginComponent.vue'
import GithubLoginComponent from './GithubLoginComponent.vue'
import BlueSkyLoginComponent from './BlueSkyLoginComponent.vue'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref<string>('')
const password = ref<string>('')
const isPwd = ref<boolean>(true)
const isLoading = ref<boolean>(false)
const emits = defineEmits(['login', 'to'])
const { warning } = useNotification()

const isDev = computed(() => process.env.NODE_ENV === 'development')

const onSubmit = (): void => {
  if (email.value && password.value && validateEmail(email.value)) {
    isLoading.value = true
    authStore.actionLogin({
      email: email.value,
      password: password.value
    }).then(() => {
      email.value = ''
      password.value = ''
      emits('login')
      return router.replace((route.query.redirect || (route.path.startsWith('/auth') ? '/' : '')) as string)
    }).catch(error => {
      console.error('Error logging in:', error)
      warning('Please provide a valid email and password')
    }).finally(() => {
      isLoading.value = false
    })
  }
}

</script>

<style scoped>
.login-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
  border-radius: 24px;
}
</style>
