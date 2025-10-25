<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card class="quick-rsvp-card" style="min-width: 400px">
      <q-card-section>
        <div class="text-h5 text-bold">Quick RSVP</div>
        <div class="text-caption text-grey-7 q-mt-xs">
          RSVP to {{ eventName }} - No password needed!
        </div>
      </q-card-section>

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

          <div class="text-caption text-grey-7 q-mt-md">
            <q-icon name="sym_r_info" size="xs" class="q-mr-xs" />
            We'll send a verification code to your email to complete your RSVP.
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
            label="Send Code"
            color="primary"
            :loading="loading"
            data-cy="quick-rsvp-submit"
          />
        </q-card-actions>
      </q-form>
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
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [email: string, verificationCode?: string]
}>()

const showDialog = ref(props.modelValue)
const name = ref('')
const email = ref('')
const loading = ref(false)

// Watch for external changes to modelValue
watch(() => props.modelValue, (newVal) => {
  showDialog.value = newVal
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
    const response = await authApi.quickRsvp({
      name: name.value,
      email: email.value,
      eventSlug: props.eventSlug
    })

    Notify.create({
      type: 'positive',
      message: response.data.message || 'Verification code sent! Check your email.',
      position: 'top'
    })

    // Emit success with email and optional verification code (for development/testing)
    emit('success', email.value, response.data.verificationCode)
    showDialog.value = false
  } catch (error: unknown) {
    console.error('Quick RSVP error:', error)

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

const onCancel = () => {
  showDialog.value = false
}
</script>

<style scoped lang="scss">
.quick-rsvp-card {
  max-width: 500px;
}
</style>
