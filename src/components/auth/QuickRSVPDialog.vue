<template>
  <q-dialog
    v-model="showDialog"
    persistent
    :full-width="isMobile"
    :full-height="isMobile"
    :transition-show="isMobile ? 'slide-up' : 'scale'"
    :transition-hide="isMobile ? 'slide-down' : 'scale'"
  >
    <q-card
      :class="{
        'quick-rsvp-card': !isMobile,
        'quick-rsvp-mobile': isMobile
      }"
    >
      <!-- Mobile Header Bar -->
      <q-bar v-if="isMobile && currentView !== 'success'" class="bg-primary text-white">
        <q-space />
        <div class="text-weight-medium">RSVP to Event</div>
        <q-space />
        <q-btn
          flat
          dense
          round
          icon="sym_r_close"
          @click="onCancel"
          :disable="loading"
        />
      </q-bar>

      <!-- Success View -->
      <div v-if="currentView === 'success'">
        <q-card-section class="text-center">
          <q-icon name="sym_r_check_circle" color="positive" size="64px" class="q-mb-md" />
          <div class="text-h5 text-bold q-mb-sm">You're registered!</div>
          <div class="text-body1 text-grey-7 q-mb-md">
            Check your email for a calendar invite.
          </div>
          <div class="text-caption text-grey-6">
            <q-icon name="sym_r_info" size="sm" class="q-mr-xs" />
            You'll receive event updates and reminders at {{ submittedEmail }}
          </div>
        </q-card-section>
        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn
            label="Done"
            color="primary"
            @click="onClose"
            data-cy="quick-rsvp-done"
          />
        </q-card-actions>
      </div>

      <!-- Quick RSVP Form View -->
      <div v-else>
        <q-card-section>
          <div class="text-h5 text-bold">RSVP to {{ eventName }}</div>
        </q-card-section>

        <!-- Section: Using Socials -->
        <div class="row items-center q-px-md q-py-sm q-mt-sm">
          <q-separator class="col" />
          <div class="text-h6 q-px-md">Using Socials</div>
          <q-separator class="col" />
        </div>

        <!-- Social Login Section -->
        <q-card-section class="q-pt-sm">
          <div @click="storeRsvpIntent">
            <GoogleLoginComponent @success="handleOAuthSuccess" />
          </div>
          <div @click="storeRsvpIntent" class="q-mt-sm">
            <GithubLoginComponent @success="handleOAuthSuccess" />
          </div>
          <div @click="storeRsvpIntent" class="q-mt-sm">
            <BlueSkyLoginComponent @success="handleOAuthSuccess" />
          </div>
        </q-card-section>

        <!-- Section: Or Quick RSVP -->
        <div class="row items-center q-px-md q-py-sm">
          <q-separator class="col" />
          <div class="text-h6 q-px-md">Or Quick RSVP</div>
          <q-separator class="col" />
        </div>

        <q-form @submit="onSubmit" class="q-px-md q-pb-md">
          <q-card-section class="q-pt-none">
            <q-input
              filled
              v-model="name"
              label="Your Name"
              data-cy="quick-rsvp-name"
              :rules="[
                (val: string) => !!val || 'Name is required'
              ]"
              autofocus
            >
              <template v-slot:prepend>
                <q-icon name="sym_r_person" />
              </template>
            </q-input>

            <q-input
              filled
              v-model="email"
              label="Your Email"
              type="email"
              data-cy="quick-rsvp-email"
              class="q-mt-md"
              :rules="[
                (val: string) => !!val || 'Email is required',
                (val: string) => validateEmail(val) || 'Please enter a valid email address'
              ]"
            >
              <template v-slot:prepend>
                <q-icon name="sym_r_mail" />
              </template>
            </q-input>
          </q-card-section>

          <q-card-actions :align="isMobile ? 'center' : 'right'" class="q-px-md q-pb-md">
            <q-btn
              v-if="!isMobile"
              flat
              label="Cancel"
              color="grey-7"
              @click="onCancel"
              :disable="loading"
              data-cy="quick-rsvp-cancel"
            />
            <q-btn
              type="submit"
              :label="isMobile ? 'Register & RSVP' : 'Register & RSVP'"
              color="primary"
              :loading="loading"
              :class="{ 'full-width': isMobile }"
              data-cy="quick-rsvp-submit"
            />
          </q-card-actions>
        </q-form>

        <!-- Section: Or Log In -->
        <div class="row items-center q-px-md q-py-sm">
          <q-separator class="col" />
          <div class="text-h6 q-px-md">Or Log In</div>
          <q-separator class="col" />
        </div>

        <!-- Login Button -->
        <div class="text-center q-px-md q-pb-md">
          <q-btn
            flat
            label="I Have an Account"
            color="primary"
            @click="redirectToLogin"
            :class="{ 'full-width': isMobile }"
            data-cy="quick-rsvp-login"
          />
        </div>
      </div>
    </q-card>
  </q-dialog>

  <!-- Verify Email Code Dialog (for existing users) -->
  <VerifyEmailCodeDialog
    v-model="showCodeDialog"
    :email="email"
    :verification-code="devVerificationCode"
    @success="onCodeVerifySuccess"
  />
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { authApi } from '../../api/auth'
import { Notify, useQuasar } from 'quasar'
import { useUnverifiedEmail } from '../../composables/useUnverifiedEmail'
import { EventAttendeeStatus } from '../../types'
import GoogleLoginComponent from './GoogleLoginComponent.vue'
import GithubLoginComponent from './GithubLoginComponent.vue'
import BlueSkyLoginComponent from './BlueSkyLoginComponent.vue'
import VerifyEmailCodeDialog from './VerifyEmailCodeDialog.vue'

const props = defineProps<{
  modelValue: boolean
  eventSlug: string
  eventName: string
  status?: EventAttendeeStatus.Confirmed | EventAttendeeStatus.Cancelled
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [{ status: EventAttendeeStatus.Confirmed | EventAttendeeStatus.Cancelled }]
}>()

const { setUnverifiedEmail } = useUnverifiedEmail()
const $q = useQuasar()

type ViewType = 'quick-rsvp' | 'success'

// Mobile detection
const isMobile = computed(() => $q.platform.is.mobile || $q.screen.width < 600)

// Dialog state
const showDialog = ref(props.modelValue)
const currentView = ref<ViewType>('quick-rsvp')
const loading = ref(false)
const showCodeDialog = ref(false)
const devVerificationCode = ref<string | undefined>(undefined)

// Quick RSVP form state
const name = ref('')
const email = ref('')
const submittedEmail = ref('')

// Watch for external changes to modelValue
watch(() => props.modelValue, (newVal) => {
  showDialog.value = newVal
  // Reset all state when dialog is opened
  if (newVal) {
    currentView.value = 'quick-rsvp'
    name.value = ''
    email.value = ''
    submittedEmail.value = ''
  }
})

// Watch for internal changes to showDialog
watch(showDialog, (newVal) => {
  if (!newVal) {
    emit('update:modelValue', false)
  }
})

const validateEmail = (val: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(val)
}

const onSubmit = async () => {
  loading.value = true

  try {
    await authApi.quickRsvp({
      name: name.value,
      email: email.value,
      eventSlug: props.eventSlug,
      status: props.status || EventAttendeeStatus.Confirmed
    })

    // Store the submitted email for display in success message
    submittedEmail.value = email.value

    // Store unverified email reactively for verification banner
    setUnverifiedEmail(email.value)

    // Show success view
    currentView.value = 'success'

    // Emit success event with status for temporary UI update
    emit('success', { status: props.status || EventAttendeeStatus.Confirmed })
  } catch (error: unknown) {
    console.error('Quick RSVP error:', error)

    // Check for 409 Conflict (existing user) - Stay in dialog and send code
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as { response?: { status?: number; data?: { message?: string } } }

      if (apiError.response?.status === 409) {
        // Send verification code to existing user
        try {
          const response = await authApi.requestLoginCode({ email: email.value })

          // Store dev verification code if available
          if (response.data && 'verificationCode' in response.data) {
            devVerificationCode.value = (response.data as { verificationCode: string }).verificationCode
          }

          // Close Quick RSVP dialog and show code verification dialog
          showDialog.value = false
          showCodeDialog.value = true

          // Store RSVP intent for after verification
          const rsvpIntent = {
            eventSlug: props.eventSlug,
            status: props.status || EventAttendeeStatus.Confirmed,
            timestamp: Date.now(),
            returnUrl: window.location.href
          }
          localStorage.setItem('rsvp_intent', JSON.stringify(rsvpIntent))

          console.log('🎉 RSVP Intent: Stored for existing user, showing code dialog')
        } catch (codeError) {
          console.error('Failed to send verification code:', codeError)
          Notify.create({
            type: 'negative',
            message: 'Failed to send verification code. Please try again.',
            position: 'top'
          })
        }
        return
      }
    }

    // Handle other errors
    const errorMessage = (error && typeof error === 'object' && 'response' in error)
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to send RSVP. Please try again.'
      : 'Failed to send RSVP. Please try again.'

    Notify.create({
      type: 'negative',
      message: errorMessage,
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const redirectToLogin = () => {
  // Close the dialog
  showDialog.value = false

  // Store RSVP intent in localStorage
  const rsvpIntent = {
    eventSlug: props.eventSlug,
    status: props.status || EventAttendeeStatus.Confirmed,
    timestamp: Date.now(),
    returnUrl: window.location.href
  }
  localStorage.setItem('rsvp_intent', JSON.stringify(rsvpIntent))

  // Redirect to login page with context
  const loginUrl = `/auth/login?email=${encodeURIComponent(email.value)}&returnUrl=${encodeURIComponent(window.location.href)}&context=quick-rsvp`
  window.location.href = loginUrl
}

const onCancel = () => {
  showDialog.value = false
}

const onClose = () => {
  showDialog.value = false
}

const storeRsvpIntent = () => {
  // Store RSVP intent before OAuth redirect (called on click before button handler)
  const rsvpIntent = {
    eventSlug: props.eventSlug,
    status: props.status || EventAttendeeStatus.Confirmed,
    timestamp: Date.now(),
    returnUrl: window.location.href
  }
  localStorage.setItem('rsvp_intent', JSON.stringify(rsvpIntent))
  console.log('🎉 RSVP Intent: Stored RSVP intent before OAuth redirect:', rsvpIntent)
}

const onCodeVerifySuccess = async () => {
  console.log('🎉 onCodeVerifySuccess called - starting RSVP completion')
  console.log('Event slug:', props.eventSlug)
  console.log('Status:', props.status)

  // Code verified and user logged in - now complete RSVP
  try {
    const { useEventStore } = await import('../../stores/event-store')
    const eventStore = useEventStore()

    console.log('About to call actionAttendEvent...')
    await eventStore.actionAttendEvent(props.eventSlug, {
      status: props.status || EventAttendeeStatus.Confirmed
    })

    // Clear RSVP intent
    localStorage.removeItem('rsvp_intent')

    // Emit success event
    emit('success', { status: props.status || EventAttendeeStatus.Confirmed })

    console.log('✅ RSVP completed successfully after code verification')

    Notify.create({
      type: 'positive',
      message: 'RSVP confirmed!',
      position: 'top'
    })
  } catch (error) {
    console.error('❌ Failed to complete RSVP after verification:', error)
    Notify.create({
      type: 'negative',
      message: 'Verified but failed to complete RSVP. Please try again.',
      position: 'top'
    })
  }
}

const handleOAuthSuccess = () => {
  // OAuth login successful - close dialog
  // RSVP intent was already stored in storeRsvpIntent
  showDialog.value = false
}
</script>

<style scoped lang="scss">
.quick-rsvp-card {
  min-width: 400px;
  max-width: 500px;
}

.quick-rsvp-mobile {
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  margin: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;

  // Make content scrollable
  :deep(.q-card__section) {
    flex-shrink: 0;
  }

  // Ensure form can scroll if needed
  :deep(form) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  // Make buttons stick to bottom on mobile
  :deep(.q-card__actions) {
    position: sticky;
    bottom: 0;
    border-top: 1px solid var(--q-separator-color);
    z-index: 1;
  }
}

.social-login-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
