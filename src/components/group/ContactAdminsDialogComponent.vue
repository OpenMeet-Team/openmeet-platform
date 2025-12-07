<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Contact Group Admins</div>
        <q-space />
        <q-btn icon="sym_r_close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-grey-7 q-mb-md">
          Send a message to the administrators of "{{ group?.name }}"
        </div>

        <q-form @submit="onSubmit" class="q-gutter-md">
          <!-- Contact Type Selection -->
          <q-select
            v-model="contactType"
            :options="contactTypeOptions"
            label="Message Type"
            outlined
            emit-value
            map-options
            data-cy="contact-type-selector"
            :rules="[val => !!val || 'Please select a message type']"
          />

          <!-- Subject -->
          <q-input
            v-model="subject"
            label="Subject"
            outlined
            maxlength="200"
            counter
            data-cy="subject-input"
            :rules="[
              val => !!val || 'Subject is required',
              val => val.length <= 200 || 'Subject must be 200 characters or less'
            ]"
          />

          <!-- Message -->
          <q-input
            v-model="message"
            label="Message"
            type="textarea"
            outlined
            rows="6"
            maxlength="5000"
            counter
            data-cy="message-input"
            :rules="[
              val => !!val || 'Message is required',
              val => val.length <= 5000 || 'Message must be 5000 characters or less'
            ]"
          />

          <div class="text-caption text-grey-6">
            Your message will be sent to all group administrators and moderators.
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="Cancel" v-close-popup data-cy="cancel-button" />
        <q-btn
          :loading="isSubmitting"
          @click="onSubmit"
          color="primary"
          label="Send Message"
          data-cy="send-button"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useNotification } from '../../composables/useNotification'
import { useGroupStore } from '../../stores/group-store'
import type { GroupEntity } from '../../types'

interface Props {
  group: GroupEntity
}

const props = defineProps<Props>()

defineEmits<{
  ok: []
  hide: []
}>()

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent()
const { success, error } = useNotification()

const contactType = ref<'question' | 'report' | 'feedback' | ''>('')
const subject = ref('')
const message = ref('')
const isSubmitting = ref(false)

const contactTypeOptions = [
  { label: 'Question', value: 'question' },
  { label: 'Report an Issue', value: 'report' },
  { label: 'Feedback', value: 'feedback' }
]

const onSubmit = async () => {
  if (!contactType.value || !subject.value.trim() || !message.value.trim()) {
    error('Please fill in all required fields')
    return
  }

  if (subject.value.length > 200) {
    error('Subject must be 200 characters or less')
    return
  }

  if (message.value.length > 5000) {
    error('Message must be 5000 characters or less')
    return
  }

  isSubmitting.value = true

  try {
    await useGroupStore().actionContactAdmins(
      props.group.slug,
      contactType.value as 'question' | 'report' | 'feedback',
      subject.value.trim(),
      message.value.trim()
    )

    success('Your message has been sent to the group administrators')
    onDialogOK()
  } catch (err) {
    console.error('Error sending contact message:', err)
    error('Failed to send message. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}
</script>
