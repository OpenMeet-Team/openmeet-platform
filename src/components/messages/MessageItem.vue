<template>
  <div
    class="message-item q-pa-md"
    :class="{
      'my-message': isCurrentUser,
      'system-message': isSystemMessage,
      'highlighted': isHighlighted
    }"
  >
    <div class="row items-start no-wrap">
      <!-- User avatar -->
      <q-avatar v-if="!isSystemMessage" size="40px" :color="avatarColor" text-color="white" class="q-mr-md">
        {{ avatarInitials }}
      </q-avatar>

      <!-- Message content -->
      <div class="col message-content">
        <div class="message-header row items-center justify-between q-mb-xs" v-if="!isSystemMessage">
          <div class="sender-name text-weight-bold">{{ senderName }}</div>
          <div class="timestamp text-grey-7 text-caption">{{ formattedTime }}</div>
        </div>

        <!-- Different message types -->
        <div v-if="isSystemMessage" class="system-message-content text-center text-grey q-py-xs">
          {{ messageBody }}
        </div>
        <div v-else-if="isImageMessage" class="image-message q-mt-sm">
          <img :src="imageUrl" @click="openImageViewer" class="message-image" />
        </div>
        <div v-else-if="isFileMessage" class="file-message q-mt-sm">
          <q-btn
            outline
            color="primary"
            no-caps
            class="full-width text-left"
            :href="fileUrl"
            target="_blank"
          >
            <q-icon name="attach_file" left />
            {{ fileName }}
            <div class="text-caption">{{ fileSize }}</div>
          </q-btn>
        </div>
        <div v-else class="message-body" v-html="formattedMessageBody"></div>

        <!-- Message reactions if any -->
        <div v-if="hasReactions" class="reactions-container q-mt-xs">
          <q-chip
            v-for="(count, reaction) in reactions"
            :key="reaction"
            dense
            size="sm"
            :color="userReacted(reaction) ? 'primary' : 'grey-3'"
            :text-color="userReacted(reaction) ? 'white' : 'grey-8'"
            @click="toggleReaction(reaction)"
          >
            {{ reaction }} {{ count }}
          </q-chip>
        </div>
      </div>
    </div>

    <!-- Message actions -->
    <div class="message-actions q-mt-sm" v-if="!isSystemMessage && (isCurrentUser || canManage)">
      <q-btn flat dense size="sm" icon="sym_r_edit" v-if="isCurrentUser" @click="$emit('edit', message)" />
      <q-btn flat dense size="sm" icon="sym_r_delete" v-if="isCurrentUser || canManage" @click="$emit('delete', getMessageId())" />
      <q-btn flat dense size="sm" icon="sym_r_reply" @click="$emit('reply', getMessageId())" />
      <q-btn flat dense size="sm" icon="sym_r_add_reaction" @click="showReactionPicker = true" />
    </div>

    <!-- Reaction picker -->
    <q-menu v-model="showReactionPicker" anchor="bottom right" self="top right">
      <div class="reaction-picker q-pa-sm">
        <q-btn flat dense v-for="emoji in commonEmojis" :key="emoji" :label="emoji" @click="addReaction(emoji)" />
      </div>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MatrixMessage } from '../../types/matrix'
import { formatDistanceToNow } from 'date-fns'
import { useQuasar } from 'quasar'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useAuthStore } from '../../stores/auth-store'

const $q = useQuasar()
const authStore = useAuthStore()

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
  },
  isHighlighted: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['reply', 'edit', 'delete', 'reaction'])

// Local state
const showReactionPicker = ref(false)
const commonEmojis = ['👍', '👎', '❤️', '😂', '😮', '😢', '🎉', '🙏']

// Message type detection
const isSystemMessage = computed(() => {
  if (!props.message.content) return false
  if (typeof props.message.content !== 'object') return false

  const msgtype = props.message.content.msgtype as string || ''
  return msgtype === 'm.room.member' || (msgtype === 'm.room.message' && props.message.content.body?.startsWith('* '))
})

const isImageMessage = computed(() => {
  if (!props.message.content) return false
  if (typeof props.message.content !== 'object') return false

  const msgtype = props.message.content.msgtype as string || ''
  return msgtype === 'm.image'
})

const isFileMessage = computed(() => {
  if (!props.message.content) return false
  if (typeof props.message.content !== 'object') return false

  const msgtype = props.message.content.msgtype as string || ''
  return msgtype === 'm.file'
})

const senderName = computed(() => {
  // Always show "You" for current user messages
  if (props.isCurrentUser) {
    return 'You'
  }

  // Use sender_name if available - this is the display name from Matrix
  // It should contain the user's actual name from OpenMeet
  if (props.message.sender_name) {
    return props.message.sender_name
  }

  // Use generic "Other User" for any Matrix IDs
  if (props.message.sender) {
    // This is a fallback that should ideally never be used, since we should always
    // have a sender_name from the Matrix server with the user's real name
    return 'Other User'
  }

  return 'Unknown User'
})

const avatarColor = computed(() => {
  // Generate a consistent color based on the sender ID
  if (!props.message.sender) return 'primary'

  // Simple hash function to generate a color index
  const hash = props.message.sender.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0)
  }, 0)

  // List of colors from Quasar palette
  const colors = ['primary', 'secondary', 'accent', 'positive', 'negative', 'info', 'warning', 'purple', 'indigo', 'blue', 'teal', 'green', 'orange', 'pink']

  return colors[hash % colors.length]
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

const formattedMessageBody = computed(() => {
  const body = messageBody.value
  if (!body) return ''

  // Check if the message contains markdown
  const containsMarkdown = body.includes('#') || body.includes('*') || body.includes('_') ||
                          body.includes('~') || body.includes('```') || body.includes('>')

  if (containsMarkdown) {
    // Convert markdown to HTML and sanitize
    const html = marked.parse(body, { breaks: true }) as string
    return DOMPurify.sanitize(html)
  }

  // Add simple URL linking
  return body.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
})

const imageUrl = computed(() => {
  if (!isImageMessage.value || !props.message.content) return ''
  return props.message.content.url as string || ''
})

const fileName = computed(() => {
  if (!isFileMessage.value || !props.message.content) return ''
  return props.message.content.body as string || 'File'
})

const fileUrl = computed(() => {
  if (!isFileMessage.value || !props.message.content) return ''
  return props.message.content.url as string || '#'
})

const fileSize = computed(() => {
  if (!isFileMessage.value || !props.message.content) return ''
  const info = props.message.content.info as { size?: number } || {}
  const size = info.size || 0

  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${Math.round(size / (1024 * 1024))} MB`
})

const formattedTime = computed(() => {
  const timestamp = props.message.origin_server_ts || props.message.timestamp
  if (!timestamp) return ''

  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
})

// Reactions
const hasReactions = computed(() => {
  if (!props.message.content?.reactions) return false
  return Object.keys(props.message.content.reactions).length > 0
})

const reactions = computed(() => {
  if (!props.message.content?.reactions) return {}
  return props.message.content.reactions
})

const userReacted = (reaction: string) => {
  if (!props.message.content?.reactions || !props.message.content.reactions[reaction]) return false
  return (props.message.content.reactions[reaction] as string[]).includes(authStore.user?.matrixUserId || '')
}

const getMessageId = () => {
  return props.message.event_id || props.message.eventId || ''
}

// Interaction functions
const openImageViewer = () => {
  if (!imageUrl.value) return

  $q.dialog({
    component: 'img',
    componentProps: {
      src: imageUrl.value,
      alt: 'Image message'
    },
    maximized: true
  })
}

const toggleReaction = (reaction: string) => {
  // This would be implemented in a real app to toggle the user's reaction
  emit('reaction', {
    messageId: getMessageId(),
    reaction,
    action: userReacted(reaction) ? 'remove' : 'add'
  })

  // Close the reaction picker
  showReactionPicker.value = false
}

const addReaction = (emoji: string) => {
  toggleReaction(emoji)
}
</script>

<style scoped>
.message-item {
  border-radius: 8px;
  background-color: #f5f5f5;
  margin-bottom: 8px;
  transition: all 0.2s;
  position: relative;
}

.my-message {
  background-color: #e3f2fd;
}

.system-message {
  background-color: transparent !important;
  padding: 4px 8px !important;
  margin: 4px 0;
}

.highlighted {
  border-left: 3px solid var(--q-primary);
  animation: highlight-fade 2s ease-in-out;
}

@keyframes highlight-fade {
  0% { background-color: rgba(var(--q-primary-rgb), 0.2); }
  100% { background-color: inherit; }
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

.message-body :deep(a) {
  color: var(--q-primary);
  text-decoration: none;
}

.message-body :deep(a:hover) {
  text-decoration: underline;
}

.message-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;
  cursor: pointer;
}

.reactions-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.reaction-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 180px;
}

.system-message-content {
  font-style: italic;
}
</style>
