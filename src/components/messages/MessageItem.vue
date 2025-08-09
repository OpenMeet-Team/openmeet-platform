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
            class="full-width text-left file-download-btn"
            :href="fileUrl"
            target="_blank"
          >
            <q-icon name="sym_r_attach_file" left />
            <div class="file-info">
              <div class="file-name">{{ fileName }}</div>
              <div class="file-size text-caption">{{ fileSize }}</div>
            </div>
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
import { matrixClientService } from '../../services/matrixClientService'

const $q = useQuasar()
const authStore = useAuthStore()

// Helper function to convert Matrix content URLs to HTTP URLs
const convertMatrixUrl = (url: string, width?: number, height?: number, isImage = false): string => {
  if (!url) return ''

  // If it's already an HTTP URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // If it's a Matrix content URL (mxc://), convert it to HTTP
  if (url.startsWith('mxc://')) {
    const client = matrixClientService.getClient()
    if (!client) {
      console.error('❌ convertMatrixUrl: Matrix client not available')
      return ''
    }

    let convertedUrl: string

    if (isImage) {
      // For images, use thumbnail dimensions and call thumbnail endpoint
      const finalWidth = width || 300
      const finalHeight = height || 300
      convertedUrl = matrixClientService.getContentUrl(url, finalWidth, finalHeight)
    } else {
      // For files, use download endpoint without dimensions
      convertedUrl = matrixClientService.getContentUrl(url)
    }

    if (!convertedUrl || convertedUrl === url || !convertedUrl.startsWith('http')) {
      console.error('❌ convertMatrixUrl: Matrix URL conversion failed or invalid')
      // Try manual conversion using homeserver URL
      const homeserverUrl = client.getHomeserverUrl()
      if (homeserverUrl && url.startsWith('mxc://')) {
        const mxcParts = url.substring(6).split('/')
        if (mxcParts.length === 2) {
          const manualUrl = `${homeserverUrl}/_matrix/media/v3/download/${mxcParts[0]}/${mxcParts[1]}`
          return manualUrl
        }
      }
      return url // Return original URL as fallback
    }

    return convertedUrl
  }

  return url
}

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
  const rawUrl = props.message.content.url as string || ''
  return convertMatrixUrl(rawUrl, undefined, undefined, true)
})

const fileName = computed(() => {
  if (!isFileMessage.value || !props.message.content) return ''
  return props.message.content.body as string || 'File'
})

const fileUrl = computed(() => {
  if (!isFileMessage.value || !props.message.content) return ''
  const rawUrl = props.message.content.url as string || ''
  // Files should use download endpoint, not thumbnail - pass false for isImage
  return convertMatrixUrl(rawUrl, undefined, undefined, false) || '#'
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

<style lang="scss" scoped>
@import '../../css/quasar.variables.scss';

.message-item {
  border-radius: 8px;
  background-color: #f5f5f5;
  margin-bottom: 8px;
  transition: all 0.2s;
  position: relative;
  color: rgba(0, 0, 0, 0.87);
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

// File download button styling for better contrast
.file-download-btn {
  // Force proper text color in light mode
  color: #1976d2 !important; // Primary blue color
  border-color: #1976d2 !important;

  .file-name {
    color: #1976d2 !important;
    font-weight: 500;
  }

  .file-size {
    color: #1976d2 !important;
    opacity: 0.8;
  }

  &:hover {
    background-color: rgba(25, 118, 210, 0.1) !important;
  }
}

.file-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-grow: 1;
}

.file-name {
  font-weight: 500;
  line-height: 1.2;
}

.file-size {
  opacity: 0.7;
  font-size: 0.75rem;
  margin-top: 2px;
}

// Dark mode specific overrides
body.body--dark {
  .file-download-btn.q-btn--outline {
    .file-name {
      color: var(--q-primary) !important;
    }

    .file-size {
      color: rgba(var(--q-primary-rgb), 0.8) !important;
    }
  }
}

.system-message-content {
  font-style: italic;
}

/* Dark mode styling */
.body--dark .message-item {
  background-color: $purple-600;
  color: rgba(255, 255, 255, 0.87);
}

.body--dark .my-message {
  background-color: $purple-500;
}

.body--dark .timestamp {
  color: rgba(255, 255, 255, 0.54) !important;
}

.body--dark .message-body :deep(a) {
  color: $purple-200;
}

.body--dark .date-label {
  background-color: $dark-page !important;
}
</style>
