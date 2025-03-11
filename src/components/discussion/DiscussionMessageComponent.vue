<template>
  <q-card flat bordered class="q-pa-md c-discussion-message-component">
    <div class="row items-center justify-between full-width">
      <div class="column">
        <div class="row items-center">
          <span class="text-weight-medium">{{ getSenderName }}</span>
          <span class="q-ml-md text-caption text-grey" v-if="getTimestamp">
            {{ getRoundedHumanReadableDateDifference(new Date(getTimestamp), new Date()) }} ago
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
    <div class="text-body2 q-mt-md" v-html="getMessageContent"></div>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
const props = defineProps<Props>()

const getMessageContent = computed(() => {
  if (typeof props.message.content === 'string') {
    return props.message.content
  } else if (props.message.content && typeof props.message.content.body === 'string') {
    return props.message.content.body
  }
  return ''
})

const getSenderName = computed(() => {
  // Extract username from Matrix ID
  if (props.message.sender) {
    return props.message.sender.split(':')[0].substring(1)
  }
  return 'Unknown User'
})

const getTimestamp = computed(() => {
  return props.message.origin_server_ts
    ? new Date(props.message.origin_server_ts)
    : null
})

const getMessageId = computed(() => {
  return props.message.event_id
})

const onDelete = () => {
  emit('delete', getMessageId.value)
}

const onReply = () => {
  emit('reply', getMessageId.value)
}

const stripHtml = (str: string): string => {
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

const onEdit = () => {
  let content = ''

  // Handle different content types safely
  try {
    // Use type assertion to safely work with content
    const messageContent = props.message.content as Record<string, unknown> | string

    if (messageContent === null || messageContent === undefined) {
      content = ''
    } else if (typeof messageContent === 'object') {
      if ('body' in messageContent && typeof messageContent.body === 'string') {
        content = stripHtml(messageContent.body)
      }
    } else if (typeof messageContent === 'string') {
      content = stripHtml(messageContent)
    }
  } catch (e) {
    console.error('Error processing message content:', e)
    content = ''
  }

  emit('edit', getMessageId.value, content)
}
</script>
