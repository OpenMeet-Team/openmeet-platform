<template>
  <q-card flat bordered class="q-pa-md c-discussion-message-component">
    <div class="row items-center justify-between full-width">
      <div class="column">
        <div class="row items-center">
          <span class="text-weight-medium">{{ getSenderDisplayName(message.sender) }}</span>
          <span class="q-ml-md text-caption text-grey" v-if="message.origin_server_ts">
            {{ getRoundedHumanReadableDateDifference(new Date(message.origin_server_ts), new Date()) }} ago
          </span>
        </div>
      </div>
      <div class="row items-center q-gutter-x-sm">
        <q-btn v-if="useDiscussionStore().permissions.canWrite" flat round size="sm" icon="sym_r_reply" @click.stop="onReply" />
        <template v-if="useDiscussionStore().permissions.canManage">
          <q-btn class="hidden" flat round size="sm" icon="sym_r_edit" @click.stop="onEdit" /> <!-- TODO: make visible -->
          <q-btn flat round size="sm" icon="sym_r_delete" @click.stop="onDelete" />
        </template>
      </div>
    </div>
    <div class="text-body2 q-mt-md" v-html="message.content.body"></div>
  </q-card>
</template>

<script setup lang="ts">
import { useDiscussionStore } from '../../stores/discussion-store'
import { MatrixMessage } from '../../types/matrix'
import { getRoundedHumanReadableDateDifference } from '../../utils/dateUtils'

interface Props {
  message: MatrixMessage
}

interface Emits {
  (e: 'delete', id: string): void
  (e: 'edit', id: string, content: string): void
  (e: 'reply', id: string): void
}

const emit = defineEmits<Emits>()

const onDelete = () => {
  emit('delete', props.message.event_id)
}

const onReply = () => {
  emit('reply', props.message.event_id)
}

const onEdit = () => {
  emit('edit', props.message.event_id, props.message.content.body)
}

// Helper function to extract display name from Matrix user ID
const getSenderDisplayName = (senderId: string) => {
  // Matrix user IDs are in the format @username:domain.com
  // Extract the username part
  const match = senderId.match(/@([^:]+)/)
  return match ? match[1] : senderId
}

const props = defineProps<Props>()
</script>
