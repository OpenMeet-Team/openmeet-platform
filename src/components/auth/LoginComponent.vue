<template>
  <q-card class="login-card q-pa-sm" data-cy="login-card">
    <!-- Dev Mode Banner -->
    <q-banner v-if="isDev" class="bg-grey-3">
      Development Mode
    </q-banner>

    <!-- Quick RSVP Context Banner -->
    <q-banner v-if="isQuickRsvpContext" class="bg-blue-1 text-blue-9" rounded dense>
      <template v-slot:avatar>
        <q-icon name="sym_r_celebration" color="blue-9" />
      </template>
      <div class="text-weight-medium">Sign in to complete your RSVP</div>
      <div class="text-caption">
        Your account already exists. Sign in to confirm your RSVP.
      </div>
    </q-banner>

    <!-- Login Mode Tabs -->
    <q-tabs
      v-model="loginMode"
      class="text-grey-7"
      active-color="primary"
      indicator-color="primary"
      dense
    >
      <q-tab name="password" label="Password" data-cy="login-password-tab" />
      <q-tab name="code" label="Email Code" data-cy="login-code-tab" />
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="loginMode" animated>
      <!-- Password Login -->
      <q-tab-panel name="password">
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
      </q-tab-panel>

      <!-- Passwordless Login (Email Code) -->
      <q-tab-panel name="code">
        <q-card-section>
          <div class="text-h5 text-bold">Login with Email Code</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            No password needed - we'll send a code to your email
          </div>
        </q-card-section>

        <q-card-section v-if="!codeSent">
          <q-form @submit.prevent="onRequestCode" class="q-gutter-md">
            <q-input
              filled
              v-model="codeEmail"
              label="Email"
              type="email"
              data-cy="login-code-email"
              :rules="[(val: string) => !!val || 'Email is required']"
            />

            <div class="q-mt-md">
              <q-btn
                block
                no-caps
                rounded
                class="full-width"
                label="Send Login Code"
                :loading="isLoadingCode"
                type="submit"
                color="primary"
                data-cy="login-request-code"
              />
            </div>

            <div class="text-grey-6 text-center q-mt-md">
              No account yet?
              <router-link class="router-link-inherit text-bold text-primary" :to="{name: 'AuthRegisterPage', query: route.query}">
                Registration
              </router-link>
            </div>
          </q-form>
        </q-card-section>

        <q-card-section v-else>
          <q-form @submit.prevent="onVerifyCode" class="q-gutter-md">
            <q-banner class="bg-positive text-white q-mb-md" rounded>
              <template v-slot:avatar>
                <q-icon name="sym_r_mail" color="white" />
              </template>
              Code sent to {{ codeEmail }}
            </q-banner>

            <q-input
              filled
              v-model="loginCode"
              label="Enter 6-digit code"
              data-cy="login-code-input"
              mask="######"
              unmasked-value
              :rules="[
                (val: string) => !!val || 'Code is required',
                (val: string) => val.length === 6 || 'Code must be 6 digits'
              ]"
              autofocus
              inputmode="numeric"
            >
              <template v-slot:prepend>
                <q-icon name="sym_r_lock" />
              </template>
              <template v-slot:hint>
                Check your email for the 6-digit code
              </template>
            </q-input>

            <div class="q-mt-md">
              <q-btn
                block
                no-caps
                rounded
                class="full-width"
                label="Verify & Login"
                :loading="isLoading"
                type="submit"
                color="primary"
                data-cy="login-verify-code"
              />
            </div>

            <div class="text-center q-mt-md">
              <q-btn
                flat
                no-caps
                label="Use a different email"
                color="grey-7"
                @click="resetCodeForm"
                data-cy="login-reset-code"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-tab-panel>
    </q-tab-panels>
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
import { authApi } from '../../api/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

// Password login state
const email = ref<string>(route.query.email as string || '')
const password = ref<string>('')
const isPwd = ref<boolean>(true)
const isLoading = ref<boolean>(false)

// Passwordless login state
const loginMode = ref<'password' | 'code'>('password')
const codeEmail = ref<string>(route.query.email as string || '')
const loginCode = ref<string>('')
const codeSent = ref<boolean>(false)
const isLoadingCode = ref<boolean>(false)

// Quick RSVP context
const isQuickRsvpContext = computed(() => route.query.context === 'quick-rsvp')

const emits = defineEmits(['login', 'to'])
const { warning, success } = useNotification()

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

const handlePostLoginRedirect = async (): Promise<void> => {
  // Check if there's an OIDC flow to continue
  const oidcDataStr = localStorage.getItem('oidc_flow_data')

  if (oidcDataStr) {
    try {
      const oidcData = JSON.parse(oidcDataStr)

      // Check if the data is not too old (5 minutes max)
      const maxAge = 5 * 60 * 1000 // 5 minutes
      if (Date.now() - oidcData.timestamp < maxAge) {
        console.log('🔄 OIDC Flow: Continuing OIDC flow after login, redirecting to:', oidcData.returnUrl)

        // Clear the stored data
        localStorage.removeItem('oidc_flow_data')

        // Redirect to the OIDC auth endpoint (uses session cookies for auth)
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

  // Check for RSVP intent (from Quick RSVP flow)
  const rsvpIntentStr = localStorage.getItem('rsvp_intent')

  if (rsvpIntentStr) {
    try {
      const rsvpIntent = JSON.parse(rsvpIntentStr)
      const maxAge = 5 * 60 * 1000 // 5 minutes

      if (Date.now() - rsvpIntent.timestamp < maxAge) {
        console.log('🎉 RSVP Intent: Completing RSVP after login for event:', rsvpIntent.eventSlug)

        // Complete the RSVP using the event store
        const { useEventStore } = await import('../../stores/event-store')
        const eventStore = useEventStore()

        try {
          await eventStore.actionAttendEvent(rsvpIntent.eventSlug, {
            status: rsvpIntent.status
          })

          // Clean up RSVP intent
          localStorage.removeItem('rsvp_intent')

          // Redirect back to event page
          window.location.href = rsvpIntent.returnUrl
          return
        } catch (error) {
          console.error('🎉 RSVP Intent: Error completing RSVP:', error)
          localStorage.removeItem('rsvp_intent')
          // Fall through to normal redirect
        }
      } else {
        console.log('🎉 RSVP Intent: RSVP intent expired, clearing')
        localStorage.removeItem('rsvp_intent')
      }
    } catch (error) {
      console.error('🎉 RSVP Intent: Error parsing RSVP intent:', error)
      localStorage.removeItem('rsvp_intent')
    }
  }

  // Normal redirect logic
  const returnUrl = route.query.returnUrl as string
  if (returnUrl) {
    window.location.href = returnUrl
  } else {
    router.replace((route.query.redirect || (route.path.startsWith('/auth') ? '/' : '')) as string)
  }
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

// Passwordless login handlers
const onRequestCode = async (): Promise<void> => {
  if (!codeEmail.value || !validateEmail(codeEmail.value)) {
    warning('Please provide a valid email')
    return
  }

  try {
    isLoadingCode.value = true
    await authApi.requestLoginCode({ email: codeEmail.value })

    codeSent.value = true
    success('Login code sent! Check your email.')
  } catch (error: unknown) {
    console.error('Error requesting login code:', error)

    // Check for 404 - user doesn't exist
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as { response?: { status?: number } }
      if (apiError.response?.status === 404) {
        warning('No account found with this email. Please register first.')
        return
      }
    }
    warning('Failed to send login code. Please try again.')
  } finally {
    isLoadingCode.value = false
  }
}

const onVerifyCode = async (): Promise<void> => {
  if (!loginCode.value || loginCode.value.length !== 6) {
    warning('Please enter the 6-digit code')
    return
  }

  try {
    isLoading.value = true

    // Store OIDC flow data before login
    storeOidcFlowData()

    const response = await authApi.verifyEmailCode({
      code: loginCode.value,
      email: codeEmail.value
    })

    // Store auth data (same as password login)
    authStore.actionSetToken(response.data.token)
    authStore.actionSetRefreshToken(response.data.refreshToken)
    authStore.actionSetTokenExpires(response.data.tokenExpires)
    authStore.actionSetUser(response.data.user)

    // Initialize Matrix if ready
    await authStore.initializeMatrixIfReady()

    emits('login')

    // Check for OIDC flow after successful login
    handlePostLoginRedirect()
  } catch (error) {
    console.error('Error verifying code:', error)
    warning('Invalid or expired code. Please try again.')
    loginCode.value = '' // Clear the code input
  } finally {
    isLoading.value = false
  }
}

const resetCodeForm = (): void => {
  codeSent.value = false
  loginCode.value = ''
  codeEmail.value = ''
}

// Store OIDC flow data when component mounts
onMounted(() => {
  storeOidcFlowData()

  // If this is an OIDC flow, wait for auth store initialization before checking authentication
  if (route.query.oidc_flow === 'true') {
    // Wait for auth store to initialize before checking authentication
    authStore.waitForInitialization().then(() => {
      if (authStore.isAuthenticated) {
        console.log('🔄 OIDC Flow: User already authenticated, continuing OIDC flow immediately')
        handlePostLoginRedirect()
      }
    })
  }
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
