<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="admin-message-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Send Message to Group Members</div>
        <q-space />
        <q-btn icon="sym_r_close" flat round dense v-close-popup :aria-label="group?.name ? `Close dialog: Send message to ${group.name}` : 'Close dialog'" />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-grey-7 q-mb-md">
          Send an email message to members of "{{ group?.name }}"
        </div>

        <q-form @submit="onSubmit" class="q-gutter-md">
          <!-- Recipient Selection -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Recipients</div>

            <q-option-group
              v-model="recipientType"
              :options="[
                { label: `All Members (${availableMembers.length})`, value: 'all' },
                { label: 'Specific Members', value: 'specific' }
              ]"
              color="primary"
              data-cy="recipient-type-selector"
            />

            <!-- Member Selection (only show when specific is selected) -->
            <div v-if="recipientType === 'specific'" class="q-mt-md">
              <div class="row items-center q-mb-sm">
                <div class="text-body2">Select members ({{ selectedMemberSlugs.length }} selected)</div>
                <q-space />
                <q-btn
                  @click="selectAllMembers"
                  size="sm"
                  flat
                  color="primary"
                  label="Select All"
                  data-cy="select-all-members"
                />
                <q-btn
                  @click="clearMemberSelection"
                  size="sm"
                  flat
                  color="grey"
                  label="Clear"
                  class="q-ml-sm"
                  data-cy="clear-member-selection"
                />
              </div>

              <q-card flat bordered class="q-pa-md" style="max-height: 300px; overflow-y: auto;">
                <div v-if="availableMembers.length === 0" class="text-body2 text-grey-6 text-center q-py-md">
                  No members available
                </div>
                <div v-else>
                  <div
                    v-for="member in availableMembers"
                    :key="member.user.slug"
                    class="row items-center q-py-xs"
                  >
                    <q-checkbox
                      :model-value="selectedMemberSlugs.includes(member.user.slug)"
                      @update:model-value="(checked) => updateMemberSelection(member.user.slug, checked)"
                      :data-cy="`member-checkbox-${member.user.slug}`"
                    />
                    <div class="q-ml-sm">
                      <div class="text-body2">{{ member.user.name }}</div>
                      <div class="text-caption text-grey-6">{{ member.user.email }}</div>
                    </div>
                  </div>
                </div>
              </q-card>

              <!-- Selected Members Summary -->
              <div v-if="selectedMembers.length > 0" class="q-mt-sm">
                <div class="text-caption text-grey-6">
                  Selected: {{ selectedMembers.map(m => m.user.name).join(', ') }}
                </div>
              </div>
            </div>
          </div>
          <!-- Subject Field -->
          <q-input
            v-model="formData.subject"
            label="Subject *"
            filled
            :rules="[val => !!val || 'Subject is required', val => val.length <= 200 || 'Subject must be 200 characters or less']"
            counter
            maxlength="200"
            data-cy="admin-message-subject"
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
            data-cy="admin-message-content"
          />

          <!-- Preview Section -->
          <q-expansion-item
            v-model="showPreview"
            icon="sym_r_preview"
            label="Preview & Test"
            class="q-mt-md"
          >
            <q-card flat class="q-pa-md" :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-1'">
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
                data-cy="admin-message-preview-email"
              />

              <q-btn
                @click="sendPreview"
                :loading="isPreviewLoading"
                :disable="!formData.subject || !formData.message || !previewEmail || !/.+@.+\..+/.test(previewEmail)"
                color="secondary"
                label="Send Preview"
                icon="sym_r_send"
                no-caps
                data-cy="admin-message-preview-btn"
              />
            </q-card>
          </q-expansion-item>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" color="grey" @click="onCancel" data-cy="admin-message-cancel" />
        <q-btn
          @click="sendMessage"
          :loading="isSending"
          :disable="!canSend"
          color="primary"
          :label="`Send to ${recipientType === 'all' ? 'All' : recipientCount} Member${recipientCount !== 1 ? 's' : ''}`"
          icon="sym_r_send"
          no-caps
          data-cy="admin-message-send"
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
import { ref, computed } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useNotification } from '../../composables/useNotification'
import { groupsApi } from '../../api/groups'
import { GroupEntity } from '../../types'

// Props
interface Props {
  group: GroupEntity | null
  members?: Array<{
    id: number
    user: {
      id: number
      name: string
      email: string
      slug: string
      firstName?: string
      lastName?: string
    }
    groupRole: {
      name: string
    }
    createdAt: string
  }>
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

// Recipient targeting
const recipientType = ref<'all' | 'specific'>('all')
const selectedMemberSlugs = ref<string[]>([])

const lastResult = ref<{
  success: boolean
  deliveredCount: number
  failedCount: number
  messageId: string
} | null>(null)

// Computed properties
const availableMembers = computed(() => props.members || [])

const selectedMembers = computed(() =>
  availableMembers.value.filter(member => selectedMemberSlugs.value.includes(member.user.slug))
)

const recipientCount = computed(() => {
  if (recipientType.value === 'all') {
    return availableMembers.value.length
  }
  return selectedMemberSlugs.value.length
})

const canSend = computed(() => {
  const hasContent = formData.value.subject && formData.value.message
  const hasRecipients = recipientType.value === 'all' || selectedMemberSlugs.value.length > 0
  return hasContent && hasRecipients
})

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
  recipientType.value = 'all'
  selectedMemberSlugs.value = []
}

const updateMemberSelection = (memberSlug: string, checked: boolean) => {
  if (!memberSlug) {
    return
  }

  const currentSlugs = [...selectedMemberSlugs.value]
  const index = currentSlugs.indexOf(memberSlug)

  if (checked && index === -1) {
    currentSlugs.push(memberSlug)
  } else if (!checked && index > -1) {
    currentSlugs.splice(index, 1)
  }

  selectedMemberSlugs.value = currentSlugs
}

const selectAllMembers = () => {
  selectedMemberSlugs.value = availableMembers.value.map(member => member.user.slug)
}

const clearMemberSelection = () => {
  selectedMemberSlugs.value = []
}

const sendPreview = async () => {
  if (!props.group || !formData.value.subject || !formData.value.message || !previewEmail.value) {
    return
  }

  isPreviewLoading.value = true

  try {
    await groupsApi.previewAdminMessage(props.group.slug, {
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
  if (!props.group || !formData.value.subject || !formData.value.message) {
    return
  }

  isSending.value = true

  try {
    const messageData: {
      subject: string
      message: string
      targetUserIds?: number[]
    } = {
      subject: formData.value.subject,
      message: formData.value.message
    }

    if (recipientType.value === 'specific') {
      const selectedMemberObjects = selectedMembers.value
      messageData.targetUserIds = selectedMemberObjects
        .map(member => member.user.id)
        .filter(id => id != null)
    }

    const response = await groupsApi.sendAdminMessage(props.group.slug, messageData)

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
.admin-message-dialog {
  width: 100%;
  max-width: 800px;

  @media (min-width: 600px) {
    min-width: 600px;
  }
}

.q-expansion-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
</style>
