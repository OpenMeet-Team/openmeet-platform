<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Send Message to Event Attendees</div>
        <q-space />
        <q-btn icon="sym_r_close" flat round dense v-close-popup aria-label="Close dialog" />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-grey-7 q-mb-md">
          Send an email message to all attendees of "{{ event?.name }}"
        </div>

        <q-form @submit="onSubmit" class="q-gutter-md">
          <!-- Subject Field -->
          <q-input
            v-model="formData.subject"
            label="Subject *"
            filled
            :rules="[val => !!val || 'Subject is required', val => val.length <= 200 || 'Subject must be 200 characters or less']"
            counter
            maxlength="200"
            data-cy="event-admin-message-subject"
          />

          <!-- Message Field -->
          <q-input
            v-model="formData.message"
            label="Message *"
            type="textarea"
            filled
            rows="8"
            :rules="[val => !!val || 'Message is required', val => val.length <= 5000 || 'Message must be 5000 characters or less']"
            counter
            maxlength="5000"
            data-cy="event-admin-message-content"
          />

          <!-- Preview Section -->
          <q-expansion-item
            v-model="showPreview"
            icon="sym_r_preview"
            label="Preview & Test"
            class="q-mt-md"
          >
            <q-card flat class="q-pa-md bg-grey-1">
              <div class="text-body2 q-mb-md">
                Send a test email to yourself to preview how the message will look.
              </div>

              <q-input
                v-model="previewEmail"
                label="Test Email Address"
                type="email"
                filled
                :rules="[val => !val || /.+@.+\..+/.test(val) || 'Please enter a valid email address']"
                class="q-mb-md"
                data-cy="event-admin-message-preview-email"
              />

              <q-btn
                @click="sendPreview"
                :loading="isPreviewLoading"
                :disable="!formData.subject || !formData.message || !previewEmail || !/.+@.+\..+/.test(previewEmail)"
                color="secondary"
                label="Send Preview"
                icon="sym_r_send"
                no-caps
                data-cy="event-admin-message-preview-btn"
              />
            </q-card>
          </q-expansion-item>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" color="grey" @click="onCancel" data-cy="event-admin-message-cancel" />
        <q-btn
          @click="sendMessage"
          :loading="isSending"
          :disable="!formData.subject || !formData.message"
          color="primary"
          label="Send to All Attendees"
          icon="sym_r_send"
          no-caps
          data-cy="event-admin-message-send"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Success Dialog -->
  <q-dialog v-model="showSuccessDialog">
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center">
        <q-avatar icon="sym_r_check_circle" color="positive" text-color="white" />
        <span class="q-ml-sm text-h6">Message Sent Successfully!</span>
      </q-card-section>

      <q-card-section>
        <div class="text-body1">
          Your message "{{ formData.subject }}" has been sent successfully.
        </div>
        <div class="text-body2 text-grey-7 q-mt-sm" v-if="lastResult">
          • {{ lastResult.deliveredCount }} emails delivered
          • {{ lastResult.failedCount }} emails failed
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="closeSuccessDialog" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useNotification } from '../../composables/useNotification'
import { eventsApi } from '../../api/events'
import { EventEntity } from '../../types'

// Props
interface Props {
  event: EventEntity | null
}
const props = defineProps<Props>()

// Composables
const { success, error } = useNotification()
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

// Define emits for Quasar dialog
defineEmits([
  ...useDialogPluginComponent.emits
])

// Reactive data
const showPreview = ref(false)
const showSuccessDialog = ref(false)
const isSending = ref(false)
const isPreviewLoading = ref(false)
const previewEmail = ref('')

const formData = ref({
  subject: '',
  message: ''
})

const lastResult = ref<{
  success: boolean
  deliveredCount: number
  failedCount: number
  messageId: string
} | null>(null)

// Methods
const onCancel = () => {
  onDialogCancel()
}

const resetForm = () => {
  formData.value = {
    subject: '',
    message: ''
  }
  previewEmail.value = ''
  showPreview.value = false
  lastResult.value = null
}

const sendPreview = async () => {
  if (!props.event || !formData.value.subject || !formData.value.message || !previewEmail.value) {
    return
  }

  isPreviewLoading.value = true

  try {
    await eventsApi.previewAdminMessage(props.event.slug, {
      subject: formData.value.subject,
      message: formData.value.message,
      testEmail: previewEmail.value
    })

    success(`Preview email sent to ${previewEmail.value}`)
  } catch (err: unknown) {
    console.error('Preview failed:', err)
    const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    error(errorMessage || 'Failed to send preview email')
  } finally {
    isPreviewLoading.value = false
  }
}

const sendMessage = async () => {
  if (!props.event || !formData.value.subject || !formData.value.message) {
    return
  }

  isSending.value = true

  try {
    const response = await eventsApi.sendAdminMessage(props.event.slug, {
      subject: formData.value.subject,
      message: formData.value.message
    })

    lastResult.value = response.data
    showSuccessDialog.value = true
    onDialogOK(response.data)
  } catch (err: unknown) {
    console.error('Send message failed:', err)
    const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    error(errorMessage || 'Failed to send admin message')
  } finally {
    isSending.value = false
  }
}

const closeSuccessDialog = () => {
  showSuccessDialog.value = false
  resetForm()
}

const onSubmit = () => {
  // Form submission is handled by individual buttons
}
</script>

<style scoped lang="scss">
.q-expansion-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
</style>
