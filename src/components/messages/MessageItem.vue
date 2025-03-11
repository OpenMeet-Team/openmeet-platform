<template>
  <div
    class="message-item q-pa-md"
    :class="{ 'my-message': isCurrentUser }"
  >
    <div class="row items-start no-wrap">
      <!-- User avatar -->
      <q-avatar size="40px" color="primary" text-color="white" class="q-mr-md">
        {{ avatarInitials }}
      </q-avatar>

      <!-- Message content -->
      <div class="col">
        <div class="message-header row items-center justify-between q-mb-xs">
          <div class="sender-name text-weight-bold">{{ senderName }}</div>
          <div class="timestamp text-grey-7 text-caption">{{ formattedTime }}</div>
        </div>
        <div class="message-body">{{ messageBody }}</div>
      </div>
    </div>

    <!-- Message actions -->
    <div class="message-actions q-mt-sm" v-if="isCurrentUser || canManage">
      <q-btn flat dense size="sm" icon="edit" v-if="isCurrentUser" @click="$emit('edit', message)" />
      <q-btn flat dense size="sm" icon="delete" v-if="isCurrentUser || canManage" @click="$emit('delete', message.event_id)" />
      <q-btn flat dense size="sm" icon="reply" @click="$emit('reply', message.event_id)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MatrixMessage } from '../../types/matrix'
import { formatDistanceToNow } from 'date-fns'

const props = defineProps({
  message: {
    type: Object as () => MatrixMessage,
    required: true
  },
  isCurrentUser: {
    type: Boolean,
    default: false
  },
  canManage: {
    type: Boolean,
    default: false
  }
})

defineEmits(['reply', 'edit', 'delete'])

const senderName = computed(() => {
  // Use sender_name if available, otherwise extract from Matrix ID
  if (props.message.sender_name) {
    return props.message.sender_name
  }

  if (props.message.sender) {
    return props.message.sender.split(':')[0].substring(1)
  }

  return 'Unknown User'
})

const avatarInitials = computed(() => {
  const name = senderName.value
  return name.substring(0, 1).toUpperCase()
})

const messageBody = computed(() => {
  if (!props.message.content) return ''
  return typeof props.message.content === 'object' && 'body' in props.message.content
    ? props.message.content.body
    : ''
})

const formattedTime = computed(() => {
  const timestamp = props.message.origin_server_ts
  if (!timestamp) return ''

  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
})
</script>

<style scoped>
.message-item {
  border-radius: 8px;
  background-color: #f5f5f5;
  margin-bottom: 8px;
  transition: background-color 0.2s;
}

.my-message {
  background-color: #e3f2fd;
}

.message-actions {
  display: flex;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.message-body {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
