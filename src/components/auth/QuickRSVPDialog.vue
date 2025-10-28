<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="quick-rsvp-card" style="min-width: 400px">
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
          <div class="text-h5 text-bold">Quick RSVP</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            RSVP to {{ eventName }}
          </div>
        </q-card-section>

        <q-form @submit="onSubmit" class="q-px-md q-pb-md">
          <q-card-section class="q-pt-none">
            <!-- Callout Box -->
            <q-banner class="bg-blue-1 text-blue-9 q-mb-md" rounded dense>
              <template v-slot:avatar>
                <q-icon name="sym_r_celebration" color="blue-9" />
              </template>
              <div class="text-weight-medium">New to OpenMeet?</div>
              <div class="text-caption">
                Enter your info to create an account and RSVP in one step!
              </div>
            </q-banner>

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

            <div class="text-caption text-grey-7 q-mt-md">
              <q-icon name="sym_r_info" size="xs" class="q-mr-xs" />
              We'll create your free account and send you a calendar invite.
            </div>
          </q-card-section>

          <q-card-actions align="right" class="q-px-md q-pb-md">
            <q-btn
              flat
              label="Cancel"
              color="grey-7"
              @click="onCancel"
              :disable="loading"
              data-cy="quick-rsvp-cancel"
            />
            <q-btn
              type="submit"
              label="Register & RSVP"
              color="primary"
              :loading="loading"
              data-cy="quick-rsvp-submit"
            />
          </q-card-actions>
        </q-form>

        <!-- Login Link -->
        <q-separator class="q-mx-md" />
        <div class="text-center text-body2 q-my-md">
          Have an account?
          <a @click="redirectToLogin" class="text-primary cursor-pointer text-weight-bold">
            Log in
          </a>
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { authApi } from '../../api/auth'
import { Notify } from 'quasar'

const props = defineProps<{
  modelValue: boolean
  eventSlug: string
  eventName: string
  status?: 'confirmed' | 'cancelled'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': []
}>()

type ViewType = 'quick-rsvp' | 'success'

// Dialog state
const showDialog = ref(props.modelValue)
const currentView = ref<ViewType>('quick-rsvp')
const loading = ref(false)

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
      status: props.status || 'confirmed'
    })

    // Store the submitted email for display in success message
    submittedEmail.value = email.value

    // Show success view
    currentView.value = 'success'

    // Emit success event (no verification code needed)
    emit('success')
  } catch (error: unknown) {
    console.error('Quick RSVP error:', error)

    // Check for 409 Conflict (existing user) - Luma-style flow
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as { response?: { status?: number; data?: { message?: string } } }

      if (apiError.response?.status === 409) {
        const errorMessage = apiError.response.data?.message || 'An account with this email already exists. Please sign in to RSVP.'

        // Close the dialog
        showDialog.value = false

        // Store RSVP intent for after sign-in
        const rsvpIntent = {
          eventSlug: props.eventSlug,
          status: props.status || 'confirmed',
          timestamp: Date.now(),
          returnUrl: window.location.href
        }
        localStorage.setItem('rsvp_intent', JSON.stringify(rsvpIntent))

        // Show notification
        Notify.create({
          type: 'info',
          message: errorMessage,
          position: 'top',
          timeout: 5000
        })

        // Redirect to login page with context
        const loginUrl = `/auth/login?email=${encodeURIComponent(email.value)}&returnUrl=${encodeURIComponent(window.location.href)}&context=quick-rsvp`
        window.location.href = loginUrl
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
    status: props.status || 'confirmed',
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
</script>

<style scoped lang="scss">
.quick-rsvp-card {
  max-width: 500px;
}

.social-login-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
