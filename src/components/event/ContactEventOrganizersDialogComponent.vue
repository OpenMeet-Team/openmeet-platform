<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Contact Event Organizers</div>
        <q-space />
        <q-btn icon="sym_r_close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-grey-7 q-mb-md">
          Send a message to the organizers of "{{ event?.name }}"
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

          <!-- Submit Actions -->
          <div class="row justify-end q-gutter-sm q-pt-md">
            <q-btn
              label="Cancel"
              color="grey-7"
              flat
              @click="onDialogCancel"
              data-cy="cancel-btn"
            />
            <q-btn
              label="Send Message"
              color="primary"
              type="submit"
              :loading="loading"
              data-cy="send-btn"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useEventStore } from '../../stores/event-store'

interface Props {
  event: {
    slug: string
    name: string
  }
}

const props = defineProps<Props>()

defineEmits([
  ...useDialogPluginComponent.emits
])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const eventStore = useEventStore()

// Form state
const contactType = ref<'question' | 'report' | 'feedback'>('question')
const subject = ref('')
const message = ref('')
const loading = ref(false)

const contactTypeOptions = [
  { label: 'Question', value: 'question' },
  { label: 'Report Issue', value: 'report' },
  { label: 'Feedback', value: 'feedback' }
]

const onSubmit = async () => {
  if (!contactType.value || !subject.value.trim() || !message.value.trim()) {
    return
  }

  loading.value = true

  try {
    const result = await eventStore.actionContactOrganizers(
      props.event.slug,
      contactType.value,
      subject.value.trim(),
      message.value.trim()
    )

    onDialogOK({
      success: true,
      result
    })
  } catch (error) {
    // Error handling is done in the store
    console.error('Failed to send message to organizers:', error)
  } finally {
    loading.value = false
  }
}
</script>
