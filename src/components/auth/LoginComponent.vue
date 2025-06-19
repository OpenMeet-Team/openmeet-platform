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
          <GoogleLoginComponent class="q-mt-md" @success="handleOAuthSuccess" />
          <GithubLoginComponent class="q-mt-md" @success="handleOAuthSuccess" />
          <BlueSkyLoginComponent class="q-mt-md" @success="handleOAuthSuccess" />
        </div>
      </q-card-section>
    </q-form>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

// OIDC Flow Helper Functions
const storeOidcFlowData = (): void => {
  // Store OIDC flow data from URL parameters in localStorage
  if (route.query.oidc_flow === 'true') {
    const oidcData = {
      returnUrl: route.query.oidc_return_url as string,
      tenantId: route.query.oidc_tenant_id as string,
      timestamp: Date.now()
    }

    if (oidcData.returnUrl && oidcData.tenantId) {
      localStorage.setItem('oidc_flow_data', JSON.stringify(oidcData))
      console.log('🔄 OIDC Flow: Stored flow data in localStorage:', oidcData)
    }
  }
}

const handlePostLoginRedirect = (): void => {
  // Check if there's an OIDC flow to continue
  const oidcDataStr = localStorage.getItem('oidc_flow_data')

  if (oidcDataStr) {
    try {
      const oidcData = JSON.parse(oidcDataStr)

      // Check if the data is not too old (5 minutes max)
      const maxAge = 5 * 60 * 1000 // 5 minutes
      if (Date.now() - oidcData.timestamp < maxAge) {
        console.log('🔄 OIDC Flow: Continuing OIDC flow after login, redirecting to:', oidcData.returnUrl)

        // Get the user's JWT token to include in the redirect
        const token = authStore.token
        if (token) {
          const url = new URL(oidcData.returnUrl)
          url.searchParams.set('user_token', token)
          console.log('🔄 OIDC Flow: Added user token to OIDC redirect')

          // Clear the stored data
          localStorage.removeItem('oidc_flow_data')

          // Redirect to the OIDC auth endpoint with token
          window.location.href = url.toString()
          return
        }

        // Fallback: redirect without token
        localStorage.removeItem('oidc_flow_data')
        window.location.href = oidcData.returnUrl
        return
      } else {
        console.log('🔄 OIDC Flow: OIDC data expired, clearing')
        localStorage.removeItem('oidc_flow_data')
      }
    } catch (error) {
      console.error('🔄 OIDC Flow: Error parsing OIDC data:', error)
      localStorage.removeItem('oidc_flow_data')
    }
  }

  // Normal redirect logic
  router.replace((route.query.redirect || (route.path.startsWith('/auth') ? '/' : '')) as string)
}

const onSubmit = (): void => {
  if (email.value && password.value && validateEmail(email.value)) {
    isLoading.value = true

    // Store OIDC flow data in localStorage before login
    storeOidcFlowData()

    authStore.actionLogin({
      email: email.value,
      password: password.value
    }).then(() => {
      email.value = ''
      password.value = ''
      emits('login')

      // Check for OIDC flow after successful login
      handlePostLoginRedirect()
    }).catch(error => {
      console.error('Error logging in:', error)
      warning('Please provide a valid email and password')
    }).finally(() => {
      isLoading.value = false
    })
  }
}

const handleOAuthSuccess = () => {
  emits('login')

  // Check for OIDC flow after successful OAuth login
  handlePostLoginRedirect()
}

// Store OIDC flow data when component mounts
onMounted(() => {
  storeOidcFlowData()
})

</script>

<style scoped>
.login-card {
  width: 100%;
  max-width: 400px;
  min-width: 350px;
  border-radius: 24px;
}
</style>
