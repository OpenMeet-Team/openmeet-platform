<template>
  <div class="matrix-chat-interface" :class="[`mode-${mode}`]" data-cy="matrix-chat-interface">
    <!-- Chat Header (for inline mode only - mobile header is handled by parent) -->
    <div
      v-if="mode === 'inline'"
      class="chat-header q-pa-md"
    >
      <div class="row items-center">
        <div class="col">
          <div class="text-subtitle1">{{ roomName || 'Chat Room' }}</div>
          <div class="text-caption">
            {{ getRoomStatusText() }}
          </div>
        </div>
        <q-btn
          icon="sym_r_fullscreen"
          flat
          round
          @click="$emit('expand')"
        />
      </div>
    </div>

    <!-- Messages Container -->
    <div
      class="messages-container q-pa-md"
      :style="getMessagesContainerStyle()"
      ref="messagesContainer"
      data-cy="messages-container"
    >
      <!-- Connection Status -->
      <div v-if="!isConnected" class="connection-status text-center q-pa-md">
        <q-spinner v-if="isConnecting" size="24px" />
        <div class="text-body2 text-grey-6 q-mt-sm">
          {{ isConnecting ? 'Connecting to chat...' : getRoomStatusText() }}
        </div>
        <div v-if="hasOidcConfigError()" class="text-caption text-orange q-mt-sm">
          Matrix chat server configuration issue. Please contact support.
        </div>
        <q-btn
          v-if="!isConnecting && !hasOidcConfigError()"
          :label="getConnectButtonLabel()"
          color="primary"
          outline
          size="sm"
          @click="reconnect"
          :disable="isRateLimited()"
          class="q-mt-sm"
          data-cy="matrix-connect-button"
        />
      </div>

      <!-- Messages -->
      <div v-else-if="messages.length > 0" class="messages-list" data-cy="messages-list">
        <!-- Loading indicator for older messages -->
        <div v-if="isLoading && messages.length === 0" class="loading-older-messages text-center q-pa-md">
          <q-spinner size="20px" color="primary" />
          <div class="text-caption text-grey-6 q-mt-xs">Loading messages...</div>
        </div>

        <div
          v-for="message in messages"
          :key="message.id"
          class="message-item"
          :class="getMessageClass(message)"
        >
          <div class="row q-gutter-sm no-wrap">
            <!-- Avatar -->
            <q-avatar
              :size="mode === 'mobile' ? '32px' : '40px'"
              v-if="!message.isOwn || mode === 'desktop'"
            >
              <img v-if="message.sender.avatar" :src="message.sender.avatar" />
              <div v-else class="avatar-fallback" :style="{ backgroundColor: getSenderColor(message.sender.id) }">
                {{ message.sender.name?.charAt(0)?.toUpperCase() || '?' }}
              </div>
            </q-avatar>

            <!-- Message Content -->
            <div class="message-content" :class="{ 'own-message': message.isOwn }">
              <!-- Sender Name (for group chats) -->
              <div
                v-if="!message.isOwn && showSenderNames"
                class="sender-name q-mb-xs row items-baseline"
              >
                <div class="text-weight-bold" :style="{ color: getSenderColor(message.sender.id) }">
                  {{ cleanDisplayName(message.sender.name, message.sender.id) }}
                  <span class="matrix-id-subscript">{{ message.sender.id }}</span>
                </div>
                <div class="message-time text-caption text-grey-6 q-ml-sm">
                  {{ formatTime(message.timestamp) }}
                </div>
              </div>

              <!-- Message Body -->
              <div class="message-body">
                <!-- Text Message -->
                <div v-if="message.type === 'text'" class="text-message">
                  <div class="message-text" v-html="formatMessageText(message.content.body)"></div>
                  <!-- Timestamp and status - always show for all messages within bubble -->
                  <span class="message-time-inline text-caption q-ml-sm">
                    {{ formatTime(message.timestamp) }}
                    <q-icon
                      v-if="message.isOwn"
                      :name="getMessageStatusIcon(message.status)"
                      :color="getMessageStatusColor(message.status)"
                      size="12px"
                      class="q-ml-xs"
                    >
                      <q-tooltip v-if="message.status === 'failed'" class="text-body2">
                        {{ message.errorMessage || 'Failed to send message. Click to retry.' }}
                      </q-tooltip>
                    </q-icon>
                    <!-- Read Receipt Indicators -->
                    <q-chip
                      v-if="message.isOwn && message.readReceipts && message.readReceipts.length > 0"
                      dense
                      size="10px"
                      color="primary"
                      text-color="white"
                      class="read-receipts-chip q-ml-xs"
                    >
                      <q-tooltip class="text-body2">
                        Read by: {{ message.readReceipts.map(r => r.userName).join(', ') }}
                      </q-tooltip>
                      <q-icon name="fas fa-eye" size="xs" class="q-mr-xs" />
                      <span class="read-receipt-text">
                        {{ message.readReceipts.length }} read
                      </span>
                    </q-chip>

                    <!-- Delete button inline with timestamp -->
                    <q-icon
                      v-if="canDeleteMessage(message)"
                      name="fas fa-trash"
                      size="10px"
                      color="negative"
                      class="delete-message-btn q-ml-xs cursor-pointer"
                      @click="deleteMessage(message)"
                    >
                      <q-tooltip class="text-body2">Delete message</q-tooltip>
                    </q-icon>
                  </span>
                </div>

                <!-- Image Message -->
                <div v-else-if="message.type === 'image'" class="image-message">
                  <img
                    :src="getImageUrl(message.content.url)"
                    :alt="message.content.filename"
                    class="message-image cursor-pointer"
                    :style="getImageStyle()"
                    @click="showImageModal(getImageUrl(message.content.url))"
                  />
                  <div v-if="message.content.filename" class="text-caption q-mt-xs">
                    {{ message.content.filename }}
                  </div>
                </div>

                <!-- File Message -->
                <div v-else-if="message.type === 'file'" class="file-message">
                  <q-card flat bordered class="file-card">
                    <q-card-section class="q-pa-sm">
                      <div class="row items-center">
                        <q-icon :name="getFileIcon(message.content.mimetype)" class="q-mr-sm" />
                        <div class="col">
                          <div class="text-body2">{{ message.content.filename }}</div>
                          <div class="text-caption text-grey-6">
                            {{ formatFileSize(message.content.size) }}
                          </div>
                        </div>
                        <q-btn
                          icon="download"
                          flat
                          round
                          size="sm"
                          @click="downloadFile(getImageUrl(message.content.url), message.content.filename)"
                        />
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state text-center q-pa-lg">
        <q-icon name="fas fa-comments" size="48px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-6">Start the conversation</div>
        <div class="text-body2 text-grey-5">Send a message to begin</div>
      </div>

      <!-- Typing Indicators -->
      <div v-if="typingUsers.length > 0" class="typing-indicator q-mt-md">
        <div class="row items-center q-gutter-xs">
          <!-- Show avatars for up to 3 typing users -->
          <div v-for="user in typingUsers.slice(0, 3)" :key="user.userId" class="typing-user-avatar">
            <q-avatar size="24px">
              <div class="avatar-fallback typing-avatar" :style="{ backgroundColor: getSenderColor(user.userId) }">
                {{ user.userName?.charAt(0)?.toUpperCase() || '?' }}
              </div>
            </q-avatar>
          </div>
          <!-- Show typing dots animation -->
          <div class="typing-dots-container q-mr-sm">
            <q-icon name="fas fa-ellipsis-h" size="16px" class="typing-dots" color="grey-6" />
          </div>
          <!-- Show typing text -->
          <span class="text-caption text-grey-6 typing-text">
            {{ formatTypingUsers(typingUsers) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Typing Notification Badge (when user is viewing older messages) -->
    <div v-if="showTypingNotification && typingUsers.length > 0" class="typing-notification-badge">
      <q-btn
        :label="`${formatTypingUsers(typingUsers)} - Scroll to see`"
        icon="keyboard_arrow_down"
        color="primary"
        size="sm"
        rounded
        @click="scrollToBottom(true)"
        class="typing-scroll-btn"
      />
    </div>

    <!-- Message Input -->
    <div class="message-input-container">
      <div class="message-input q-pa-md">
        <div class="row items-end q-gutter-sm">
          <!-- File Upload Button -->
          <q-btn
            :icon="isSending ? 'fas fa-spinner fa-spin' : 'fas fa-paperclip'"
            flat
            round
            :size="mode === 'mobile' ? 'md' : 'sm'"
            @click="triggerFileUpload"
            :disable="!canSendMessages || isSending"
            :title="isSending ? 'Uploading file...' : 'Attach file'"
          />
          <q-file
            ref="fileInput"
            v-model="selectedFile"
            style="display: none;"
            accept="*/*"
          />

          <!-- Message Input Field -->
          <q-input
            ref="messageInput"
            v-model="messageText"
            :placeholder="getInputPlaceholder()"
            dense
            outlined
            autogrow
            :rows="1"
            :max-height="100"
            class="col"
            :disable="!canSendMessages"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown="handleTyping"
            @blur="stopTyping"
            data-cy="chat-input"
          >
            <!-- Emoji Picker Button -->
            <template v-slot:prepend>
              <q-btn
                icon="fas fa-smile"
                flat
                round
                size="sm"
                @click="showEmojiPicker = !showEmojiPicker"
                :disable="!canSendMessages"
              />
            </template>
          </q-input>

          <!-- Send Button -->
          <q-btn
            icon="sym_r_send"
            color="primary"
            round
            :size="mode === 'mobile' ? 'md' : 'sm'"
            @click="sendMessage"
            :loading="isSending"
            :disable="!canSendMessage"
            data-cy="send-button"
          />
        </div>

        <!-- Sending Progress Indicator -->
        <div v-if="isSending" class="upload-progress q-mt-sm">
          <q-linear-progress
            indeterminate
            color="primary"
            size="2px"
            class="q-mb-xs"
          />
          <div class="text-caption text-grey-6 text-center">
            <q-icon name="fas fa-paper-plane" size="xs" class="q-mr-xs" />
            Sending message...
          </div>
        </div>

        <!-- Emoji Picker -->
        <div v-if="showEmojiPicker" class="emoji-picker q-mt-sm">
          <div class="emoji-grid q-pa-sm bg-grey-1 rounded-borders">
            <q-btn
              v-for="emoji in commonEmojis"
              :key="emoji"
              :label="emoji"
              flat
              size="sm"
              @click="addEmoji(emoji)"
              class="emoji-btn"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Image Modal -->
    <q-dialog v-model="imageModal" maximized>
      <q-card>
        <q-card-section class="row items-center">
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="q-pa-none flex flex-center">
          <img :src="imageModalSrc" style="max-width: 100%; max-height: 90vh;" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useQuasar } from 'quasar'
import { format } from 'date-fns'
import { RoomEvent, MatrixEvent, Room } from 'matrix-js-sdk'
import { matrixClientService } from '../../services/matrixClientService'

// Add type declaration for global window property
declare global {
  interface Window {
    matrixRetryAfter?: number;
  }
}

interface Message {
  id: string
  type: 'text' | 'image' | 'file'
  sender: {
    id: string
    name: string
    avatar?: string
  }
  content: {
    body?: string
    url?: string
    filename?: string
    mimetype?: string
    size?: number
  }
  timestamp: Date
  isOwn: boolean
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  readReceipts?: Array<{ userId: string, userName: string, timestamp: number }>
  isRedacted?: boolean
  errorMessage?: string
}

interface Props {
  roomId: string
  contextType: 'direct' | 'group' | 'event'
  contextId: string
  mode: 'desktop' | 'mobile' | 'inline'
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: '400px'
})

defineEmits<{
  'back': []
  'expand': []
}>()

// Quasar instance for dark mode detection
const quasar = useQuasar()

// State
const messageText = ref('')
const selectedFile = ref<File | null>(null)
const messages = ref<Message[]>([])
const typingUsers = ref<{ userId: string, userName: string }[]>([])
const isConnected = ref(false)
const isConnecting = ref(false)
const isSending = ref(false)
const showEmojiPicker = ref(false)
const imageModal = ref(false)
const imageModalSrc = ref('')
const roomName = ref('')
const canSendMessages = ref(true)
const rateLimitCountdown = ref(0)
const lastAuthError = ref('')
const showTypingNotification = ref(false)
const lastReadReceiptSent = ref<string | null>(null)
const messageCount = ref(0)
const typingNotificationTimer = ref<number | null>(null)

// Use Matrix client service directly for real Matrix integration

// Refs
const messagesContainer = ref<HTMLElement>()
const messageInput = ref()
const fileInput = ref()
const countdownTimer = ref<ReturnType<typeof setInterval> | null>(null)

// Custom event listeners tracking for cleanup
let customEventListeners: (() => void)[] = []

// Mock data
const commonEmojis = ['😀', '😊', '😂', '❤️', '👍', '👏', '🎉', '🔥', '💯', '🤔', '😎', '👋']
const senderColors = {
  light: ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#d32f2f', '#455a64'],
  dark: ['#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#f48fb1', '#90a4ae']
}

// Computed
const canSendMessage = computed(() => {
  return canSendMessages.value && messageText.value.trim().length > 0 && !isSending.value
})

const showSenderNames = computed(() => {
  return props.contextType !== 'direct'
})

// Methods
const getMessagesContainerStyle = () => {
  if (props.mode === 'inline') {
    return `height: calc(${props.height} - 120px); overflow-y: auto;`
  }
  if (props.mode === 'mobile') {
    return 'flex: 1; overflow-y: auto;'
  }
  return 'flex: 1; overflow-y: auto; max-height: calc(80vh - 200px);'
}

const getImageStyle = () => {
  const maxWidth = props.mode === 'mobile' ? '100%' : '300px'
  return `max-width: ${maxWidth}; border-radius: 8px;`
}

const getMessageClass = (message: Message) => {
  return {
    'own-message-item': message.isOwn,
    'other-message-item': !message.isOwn,
    'q-mb-sm': props.mode === 'mobile',
    'q-mb-md': props.mode !== 'mobile'
  }
}

const getInputPlaceholder = () => {
  if (!canSendMessages.value) return 'You cannot send messages in this chat'
  return 'Type a message...'
}

const getSenderColor = (senderId: string): string => {
  const index = senderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const isDarkMode = quasar.dark.isActive
  const colors = isDarkMode ? senderColors.dark : senderColors.light
  return colors[index % colors.length]
}

const cleanDisplayName = (displayName: string, userId: string): string => {
  // Remove Matrix ID from display name if it's included
  // Pattern: "Name (@user:server.com)" or "Name (user:server.com)"
  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    `\\s*\\(${escapedUserId}\\)\\s*`, // Exact match in parentheses
    `\\s*\\(@?${escapedUserId.replace('@', '')}\\)\\s*` // With or without @ in parentheses
  ]

  let cleaned = displayName
  for (const pattern of patterns) {
    cleaned = cleaned.replace(new RegExp(pattern, 'g'), '').trim()
  }

  return cleaned || displayName // Return original if cleaning results in empty string
}

const getRoomStatusText = (): string => {
  if (!isConnected.value) {
    // Check if we're rate limited
    if (rateLimitCountdown.value > 0) {
      const remainingMinutes = Math.ceil(rateLimitCountdown.value / 60000)
      const remainingSeconds = Math.ceil((rateLimitCountdown.value % 60000) / 1000)
      if (remainingMinutes > 1) {
        return `Rate limited - try again in ${remainingMinutes} min`
      } else {
        return `Rate limited - try again in ${remainingSeconds}s`
      }
    }
    return 'Matrix chat unavailable'
  }

  const count = messages.value.length
  switch (props.contextType) {
    case 'direct': return isConnected.value ? 'Online' : 'Offline'
    case 'group': return `${count} messages`
    case 'event': return 'Event discussion'
    default: return ''
  }
}

const isRateLimited = (): boolean => {
  return rateLimitCountdown.value > 0
}

const getConnectButtonLabel = (): string => {
  if (rateLimitCountdown.value > 0) {
    const remainingMinutes = Math.ceil(rateLimitCountdown.value / 60000)
    const remainingSeconds = Math.ceil((rateLimitCountdown.value % 60000) / 1000)
    if (remainingMinutes > 1) {
      return `Try again in ${remainingMinutes} min`
    } else {
      return `Try again in ${remainingSeconds}s`
    }
  }
  return 'Connect'
}

const hasOidcConfigError = (): boolean => {
  return lastAuthError.value.includes('OIDC authentication is not configured') ||
         lastAuthError.value.includes('404')
}

const formatMessageText = (text: string): string => {
  // Enhanced markdown and URL formatting
  return text
    // Convert URLs to clickable links (must be first to avoid conflicts)
    .replace(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>')
    // Bold text: **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic text: *text* (but not inside URLs or already processed bold)
    .replace(/(?<!\*)\*([^*\s][^*]*[^*\s]|\S)\*(?!\*)/g, '<em>$1</em>')
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Strikethrough: ~~text~~
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    // Line breaks: convert \n to <br>
    .replace(/\n/g, '<br>')
}

const formatTime = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return 'now'
  if (diff < 3600000) return format(date, 'HH:mm')
  if (diff < 86400000) return format(date, 'HH:mm')
  return format(date, 'MMM d, HH:mm')
}

// Check if current user can delete a message
const canDeleteMessage = (message: Message): boolean => {
  if (!message.id || message.id.includes('welcome')) return false

  // Can always delete your own messages
  if (message.isOwn) return true

  // Check Matrix room permissions for moderation capabilities
  const room = matrixClientService.getClient()?.getRoom(props.roomId)
  const currentUserId = matrixClientService.getClient()?.getUserId()

  if (!room || !currentUserId) {
    console.log('🔍 canDeleteMessage: No room or currentUserId', { room: !!room, currentUserId })
    return false
  }

  // Get current user's power level
  const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '')
  if (!powerLevels) {
    console.log('🔍 canDeleteMessage: No power levels found in room')
    return false
  }

  const content = powerLevels.getContent()
  const userPowerLevel = content.users?.[currentUserId] ?? content.users_default ?? 0
  const redactLevel = content.redact ?? 50 // Default redact level is 50

  console.log('🔍 canDeleteMessage power level check:', {
    currentUserId: currentUserId.split(':')[0].substring(1),
    fullCurrentUserId: currentUserId,
    userPowerLevel,
    redactLevel,
    canDelete: userPowerLevel >= redactLevel,
    allUsers: Object.keys(content.users || {}),
    userPowerLevels: content.users,
    powerLevelsContent: content
  })

  // Can delete if user has sufficient power level
  return userPowerLevel >= redactLevel
}

// Delete/redact a message
const deleteMessage = async (message: Message) => {
  if (!message.id || !canDeleteMessage(message)) return

  try {
    // Show confirmation dialog
    const confirm = await new Promise<boolean>((resolve) => {
      quasar.dialog({
        title: 'Delete Message',
        message: message.isOwn
          ? 'Are you sure you want to delete this message?'
          : 'Are you sure you want to delete this message? This action cannot be undone.',
        cancel: true,
        persistent: true
      }).onOk(() => resolve(true))
        .onCancel(() => resolve(false))
    })

    if (!confirm) return

    console.log('🗑️ Deleting message:', message.id)
    await matrixClientService.redactMessage(props.roomId, message.id)
    console.log('✅ Message deleted successfully')
  } catch (error) {
    console.error('❌ Failed to delete message:', error)
    quasar.notify({
      type: 'negative',
      message: 'Failed to delete message',
      position: 'top'
    })
  }
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown size'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const formatTypingUsers = (users: { userId: string, userName: string }[]): string => {
  if (users.length === 0) return ''
  if (users.length === 1) return `${users[0].userName} is typing...`
  if (users.length === 2) return `${users[0].userName} and ${users[1].userName} are typing...`
  return `${users.length} people are typing...`
}

const getFileIcon = (mimetype?: string): string => {
  if (!mimetype) return 'attach_file'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('video/')) return 'videocam'
  if (mimetype.startsWith('audio/')) return 'audiotrack'
  if (mimetype.includes('pdf')) return 'picture_as_pdf'
  if (mimetype.includes('zip') || mimetype.includes('rar')) return 'archive'
  return 'attach_file'
}

const getImageUrl = (url: string): string => {
  if (!url) {
    console.warn('⚠️ getImageUrl: Empty URL provided')
    return ''
  }

  // If it's already an HTTP URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.log('🔗 getImageUrl: Using HTTP URL as-is:', url)
    return url
  }

  // If it's a Matrix content URL (mxc://), convert it to HTTP
  if (url.startsWith('mxc://')) {
    const client = matrixClientService.getClient()
    if (!client) {
      console.error('❌ getImageUrl: Matrix client not available')
      return ''
    }

    const convertedUrl = matrixClientService.getContentUrl(url)
    console.log('🖼️ getImageUrl: Converting Matrix URL:', {
      original: url,
      converted: convertedUrl,
      baseUrl: client.baseUrl,
      isValid: convertedUrl && convertedUrl !== url && convertedUrl.startsWith('http')
    })

    if (!convertedUrl || convertedUrl === url || !convertedUrl.startsWith('http')) {
      console.error('❌ getImageUrl: Matrix URL conversion failed or invalid')
      return ''
    }

    return convertedUrl
  }

  // Fallback - return original URL
  console.log('🔗 getImageUrl: Using original URL:', url)
  return url
}

const getMessageStatusIcon = (status?: string): string => {
  switch (status) {
    case 'sending': return 'schedule'
    case 'sent': return 'sym_r_done'
    case 'delivered': return 'sym_r_done_all'
    case 'read': return 'sym_r_done_all'
    case 'failed': return 'fas fa-exclamation-triangle'
    default: return 'sym_r_done'
  }
}

const getMessageStatusColor = (status?: string): string => {
  switch (status) {
    case 'sending': return 'grey-6'
    case 'sent': return 'white'
    case 'delivered': return 'green'
    case 'read': return 'green'
    case 'failed': return 'negative'
    default: return 'white'
  }
}

const sendMessage = async () => {
  if (!canSendMessage.value) return

  const text = messageText.value.trim()
  if (!text) return

  isSending.value = true

  try {
    // Clear message input immediately
    messageText.value = ''

    // Focus the input field after sending message
    await nextTick()
    messageInput.value?.$el?.querySelector('input')?.focus()

    // Send message via Matrix client directly - let Matrix SDK handle optimistic rendering
    if (props.roomId) {
      console.log('📤 Sending Matrix message to room:', props.roomId)
      await matrixClientService.sendMessage(props.roomId, {
        body: text,
        msgtype: 'm.text'
      })
      console.log('✅ Message sent successfully - Matrix SDK will handle display')
    } else {
      console.error('❌ No Matrix room ID available for sending message')
      throw new Error('No Matrix room ID available')
    }

    // Stop typing indicator when message is sent
    await stopTyping()
  } catch (error) {
    console.error('❌ Failed to send message:', error)
    // Show error to user but don't manipulate messages array
    $q.notify({
      type: 'negative',
      message: 'Failed to send message: ' + (error instanceof Error ? error.message : 'Unknown error'),
      timeout: 3000
    })

    // Put the text back in the input if sending failed
    messageText.value = text
  } finally {
    isSending.value = false
  }
}

const triggerFileUpload = () => {
  fileInput.value?.$el?.querySelector('input')?.click()
}

// Removed unused handleFileUpload function in Phase 2

const addEmoji = (emoji: string) => {
  messageText.value += emoji
  showEmojiPicker.value = false
}

// Typing indicator state
const isTyping = ref(false)
const typingTimer = ref<number | null>(null)

const handleTyping = async () => {
  if (!isConnected.value || !props.roomId) return

  try {
    // Only send typing if we weren't already typing
    if (!isTyping.value) {
      await matrixClientService.sendTyping(props.roomId, true, 10000) // 10 second timeout
      isTyping.value = true
      console.log('⌨️ Started typing indicator')
    }

    // Clear existing timer
    if (typingTimer.value) {
      clearTimeout(typingTimer.value)
    }

    // Set timer to stop typing after 3 seconds of inactivity
    typingTimer.value = window.setTimeout(async () => {
      await stopTyping()
    }, 3000)
  } catch (error) {
    console.warn('⚠️ Failed to send typing indicator:', error)
  }
}

const stopTyping = async () => {
  if (!isConnected.value || !props.roomId || !isTyping.value) return

  try {
    await matrixClientService.sendTyping(props.roomId, false)
    isTyping.value = false
    console.log('⌨️ Stopped typing indicator')

    // Clear timer
    if (typingTimer.value) {
      clearTimeout(typingTimer.value)
      typingTimer.value = null
    }
  } catch (error) {
    console.warn('⚠️ Failed to stop typing indicator:', error)
  }
}

const showImageModal = (src: string) => {
  imageModalSrc.value = src
  imageModal.value = true
}

const downloadFile = (url: string, filename: string) => {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

const scrollToBottom = async (smooth = false) => {
  await nextTick()
  if (messagesContainer.value) {
    if (smooth) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: 'smooth'
      })
    } else {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }
}

const sendReadReceipts = async () => {
  if (!props.roomId || !isConnected.value) return

  try {
    // Find the last message that's not from us
    const lastOtherMessage = messages.value
      .slice()
      .reverse()
      .find(msg => !msg.isOwn && msg.id && !msg.id.includes('welcome'))

    if (lastOtherMessage && lastOtherMessage.id && lastOtherMessage.id !== lastReadReceiptSent.value) {
      console.log('📨 Sending read receipt for message:', lastOtherMessage.id)
      await matrixClientService.sendReadReceipt(props.roomId, lastOtherMessage.id)
      lastReadReceiptSent.value = lastOtherMessage.id
    }
  } catch (error) {
    console.warn('⚠️ Failed to send read receipt:', error)
  }
}

const updateReadReceipts = async () => {
  console.log('🔍 updateReadReceipts called - roomId:', props.roomId, 'connected:', isConnected.value)
  if (!props.roomId || !isConnected.value) return

  try {
    // Update read receipts for all messages
    const currentUserId = matrixClientService.getClient()?.getUserId()
    if (!currentUserId) return

    const room = matrixClientService.getClient()?.getRoom(props.roomId)
    if (!room) return

    // Optimization: Only process recent messages (last 30) to avoid performance issues
    const recentMessages = messages.value.slice(-30)
    const recentMessageIds = recentMessages.map(m => m.id).filter(Boolean)

    console.log(`🔄 Processing read receipts for ${recentMessages.length} recent messages (of ${messages.value.length} total)`)

    // Get all other users in the room (exclude current user)
    const otherUsers = room.getMembers()
      .filter(member => member.userId !== currentUserId)

    console.log('👥 Room members (excluding self):', otherUsers.map(m => ({
      userId: m.userId.split(':')[0].substring(1),
      name: m.name || m.rawDisplayName || 'Unknown'
    })))

    // Build a cache of all receipt data in one pass
    const receiptCache = new Map<string, Array<{ userId: string, timestamp: number }>>()

    for (const messageId of recentMessageIds) {
      if (messageId && !messageId.includes('welcome')) {
        const receipts = matrixClientService.getReadReceipts(props.roomId, messageId)
        receiptCache.set(messageId, receipts)

        if (receipts.length > 0) {
          console.log(`📨 Message ${messageId.substring(0, 8)}... has ${receipts.length} read receipts:`,
            receipts.map(r => ({
              user: r.userId.split(':')[0].substring(1),
              timestamp: new Date(r.timestamp).toLocaleTimeString()
            })))
        }
      }
    }

    // Find the latest read position for each user using cached data
    const userReadPositions = new Map<string, { eventId: string, messageIndex: number }>()

    for (const member of otherUsers) {
      const userId = member.userId
      let latestReadEventId: string | null = null
      let latestTimestamp = 0
      let messageIndex = -1

      // Check cached receipts to find this user's latest read message
      for (let i = 0; i < recentMessages.length; i++) {
        const message = recentMessages[i]
        if (!message.id) continue

        const receipts = receiptCache.get(message.id) || []
        const userReceipt = receipts.find(r => r.userId === userId)

        if (userReceipt && userReceipt.timestamp > latestTimestamp) {
          latestTimestamp = userReceipt.timestamp
          latestReadEventId = message.id
          messageIndex = i
        }
      }

      if (latestReadEventId && messageIndex >= 0) {
        userReadPositions.set(userId, { eventId: latestReadEventId, messageIndex })
      }
    }

    console.log('👀 User read positions:', Array.from(userReadPositions.entries()).map(([userId, pos]) => ({
      user: userId.split(':')[0].substring(1),
      lastRead: pos.eventId.substring(0, 8) + '...',
      index: pos.messageIndex
    })))

    // Debug: Show which users have NO read receipts
    const usersWithoutReceipts = otherUsers.filter(member => !userReadPositions.has(member.userId))
    if (usersWithoutReceipts.length > 0) {
      console.log('⚠️ Users with NO read receipts:', usersWithoutReceipts.map(m => ({
        userId: m.userId.split(':')[0].substring(1),
        name: m.name || m.rawDisplayName || 'Unknown'
      })))
    }

    // Apply read receipts to recent messages only
    for (let i = 0; i < recentMessages.length; i++) {
      const message = recentMessages[i]
      if (!message.id || message.id.includes('welcome')) continue

      const messageReadBy: Array<{ userId: string, userName: string, timestamp: number }> = []

      // Check if each user has read this message (if they read this message or any later message)
      for (const [userId, readPosition] of userReadPositions.entries()) {
        if (readPosition.messageIndex >= i) {
          const member = room.getMember(userId)
          messageReadBy.push({
            userId,
            userName: member?.name || member?.rawDisplayName || userId.split(':')[0].substring(1) || 'Unknown',
            timestamp: Date.now()
          })
        }
      }

      message.readReceipts = messageReadBy
      if (messageReadBy.length > 0) {
        console.log(`📋 Message ${message.id.substring(0, 8)}... read by:`, messageReadBy.map(r => r.userName))
      }
    }

    // Clear read receipts for older messages to save memory
    const olderMessages = messages.value.slice(0, -30)
    for (const message of olderMessages) {
      message.readReceipts = []
    }
  } catch (error) {
    console.warn('⚠️ Failed to update read receipts:', error)
  }
}

const reconnect = async () => {
  isConnecting.value = true
  isConnected.value = false

  try {
    console.log('🔄 Attempting to reconnect Matrix client...')

    // Check if Matrix client is already available and just needs to reconnect
    if (matrixClientService.isReady()) {
      console.log('🔌 Matrix client already ready, just updating connection status')
      isConnected.value = true
      roomName.value = `${props.contextType} Chat`

      // Reload messages if we have a room ID
      if (props.roomId) {
        await loadMessages()
        await scrollToBottom()
      }
      return
    }

    // Try to connect to Matrix client (this will handle authentication)
    await matrixClientService.connectToMatrix()
    console.log('✅ Matrix client connected successfully')

    isConnected.value = true
    lastAuthError.value = '' // Clear any previous errors
    roomName.value = `${props.contextType} Chat`

    // Reload messages if we have a room ID
    if (props.roomId) {
      await loadMessages()
      await scrollToBottom()
    }
  } catch (error: unknown) {
    console.error('❌ Failed to connect Matrix client:', error)
    isConnected.value = false

    // Check for rate limiting error - handle both object and nested error formats
    const errorObj = (error as Record<string, unknown>)
    const nestedError = errorObj.errcode ? errorObj : (errorObj.data || errorObj)
    const errorMessage = (error as Error).message

    if ((nestedError as Record<string, unknown>).errcode === 'M_LIMIT_EXCEEDED' || (errorMessage && errorMessage.includes('Too Many Requests'))) {
      // FIRST: Check if rate limit was already set by Matrix client service (most reliable)
      const existingRetryTime = window.matrixRetryAfter
      console.warn('🔍 Rate limit detected - checking existing timer:', {
        existingRetryTime,
        currentTime: Date.now(),
        hasValidExisting: !!(existingRetryTime && existingRetryTime > Date.now())
      })

      if (existingRetryTime && existingRetryTime > Date.now()) {
        // Use the existing rate limit set by Matrix client service
        const remainingMs = existingRetryTime - Date.now()
        const remainingSeconds = Math.ceil(remainingMs / 1000)
        console.warn(`⚠️ Using Matrix client service rate limit - retry in ${remainingSeconds} seconds (${remainingMs}ms remaining)`)
        rateLimitCountdown.value = remainingMs
        startCountdownTimer()
      } else {
        // Fallback: try to extract retry_after_ms from the error
        let retryAfterMs = (nestedError as Record<string, unknown>).retry_after_ms as number

        // Check alternative locations for retry time
        if (!retryAfterMs) {
          retryAfterMs = (nestedError as Record<string, unknown>).retry_after as number
        }
        if (!retryAfterMs && (errorObj as { retry_after_ms?: number }).retry_after_ms) {
          retryAfterMs = (errorObj as { retry_after_ms?: number }).retry_after_ms
        }
        if (!retryAfterMs && (errorObj as { data?: { retry_after_ms?: number } }).data?.retry_after_ms) {
          retryAfterMs = (errorObj as { data?: { retry_after_ms?: number } }).data.retry_after_ms
        }

        if (retryAfterMs && retryAfterMs > 0) {
          const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
          console.warn(`⚠️ Rate limited - extracted from error, retry in ${retryAfterSeconds} seconds (${retryAfterMs}ms)`)
          window.matrixRetryAfter = Date.now() + retryAfterMs
          rateLimitCountdown.value = retryAfterMs
          startCountdownTimer()
        } else {
          console.warn('⚠️ Rate limited - no retry time found anywhere, using 5 minute default')
          window.matrixRetryAfter = Date.now() + 300000 // Default to 5 minutes
          rateLimitCountdown.value = 300000
          startCountdownTimer()
        }
      }
    } else if (errorMessage && errorMessage.includes('OIDC authentication is not configured')) {
      console.warn('⚠️ Matrix OIDC is not configured on the server')
      lastAuthError.value = errorMessage
    } else if (errorMessage && errorMessage.includes('login token')) {
      console.warn('⚠️ Authentication failed - please refresh the page to re-authenticate')
      lastAuthError.value = errorMessage
    } else if (errorMessage && errorMessage.includes('credentials expired')) {
      console.warn('⚠️ Session expired - please refresh the page to re-authenticate')
      lastAuthError.value = errorMessage
    }
  } finally {
    isConnecting.value = false
  }
}

// Removed unused recreateEventRoom and recreateGroupRoom functions in Phase 2

// Start countdown timer for rate limiting
const startCountdownTimer = () => {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
  }

  countdownTimer.value = setInterval(() => {
    if (rateLimitCountdown.value > 0) {
      rateLimitCountdown.value -= 1000
    } else {
      clearInterval(countdownTimer.value!)
      countdownTimer.value = null
    }
  }, 1000)
}

// Set up service-based event listeners for Matrix events
const setupServiceEventListeners = () => {
  console.log('🎧 Setting up service-based event listeners for room:', props.roomId)

  // Clear any existing listeners
  customEventListeners.forEach(cleanup => cleanup())
  customEventListeners = []

  // Listen directly to Matrix SDK events (Element-web pattern)
  const client = matrixClientService.getClient()
  if (!client) {
    console.warn('⚠️ Matrix client not available for event listeners')
    return
  }

  const handleTimelineEvent = (event: MatrixEvent, room: Room, toStartOfTimeline: boolean) => {
    if (room.roomId !== props.roomId || toStartOfTimeline) {
      return // Only handle live events for this room
    }

    const eventType = event.getType()
    if (eventType !== 'm.room.message') {
      return // Only handle message events
    }

    console.log('📨 Matrix timeline event received for room:', props.roomId)

    // Process the Matrix event directly
    const content = event.getContent()
    const senderId = event.getSender()
    const currentUserId = client.getUserId()
    const member = room.getMember(senderId)

    const newMessage = {
      id: event.getId(),
      type: (content.msgtype === 'm.image' ? 'image' : content.msgtype === 'm.file' ? 'file' : 'text') as 'text' | 'image' | 'file',
      sender: {
        id: senderId,
        name: member?.name || member?.rawDisplayName || senderId.split(':')[0].substring(1) || 'Unknown',
        avatar: member?.getAvatarUrl?.(client.baseUrl || '', 32, 32, 'crop', false, false) || undefined
      },
      content: {
        body: content.body,
        url: content.url,
        filename: content.filename,
        mimetype: content.info?.mimetype,
        size: content.info?.size
      },
      timestamp: new Date(event.getTs()),
      isOwn: senderId === currentUserId,
      status: (senderId === currentUserId ? 'sent' : 'read') as const
    }

    // Add message - Matrix SDK should handle deduplication
    messages.value.push(newMessage)

    // Auto-scroll to new message
    nextTick(() => {
      scrollToBottom(true)
    })
  }

  // Add Matrix SDK event listener
  client.on(RoomEvent.Timeline, handleTimelineEvent)
  customEventListeners.push(() => client.off(RoomEvent.Timeline, handleTimelineEvent))

  console.log('✅ Direct Matrix SDK event listeners set up')
}

// Prevent duplicate loading
const isLoading = ref(false)

const loadMessages = async () => {
  if (isLoading.value) {
    console.log('⚠️ Already loading messages, skipping duplicate call')
    return
  }

  console.log('🏗️ DEBUG: Starting loadMessages(), setting isLoading=true')
  isLoading.value = true
  try {
    console.log('🏗️ Phase 2: Loading messages with pure Matrix SDK for room:', props.roomId)

    // Use new waitForRoomReady method (Element-web pattern)
    console.log('⏳ Waiting for room to be ready...')
    const room = await matrixClientService.waitForRoomReady(props.roomId)
    if (!room) {
      console.warn('⚠️ Room not available after sync:', props.roomId)
      messages.value = []
      console.log('🏗️ DEBUG: Room not found, setting isLoading=false in early return')
      // Early return will still trigger finally block, so isLoading will be reset
      return
    }
    console.log('✅ Room ready, proceeding with message loading')

    // Load historical messages using the robust pagination method from matrixClientService
    console.log('📨 Loading historical messages with pagination support')
    let events: MatrixEvent[] = []
    
    try {
      // Use the service's loadRoomHistory method which handles proper pagination
      events = await matrixClientService.loadRoomHistory(props.roomId, 50)
      console.log(`📊 Loaded ${events.length} historical messages via pagination`)
    } catch (error) {
      console.warn('⚠️ Failed to load historical messages, falling back to timeline:', error)
      // Fallback to timeline events if pagination fails
      const timeline = room.getLiveTimeline()
      events = timeline.getEvents().filter(event => event.getType() === 'm.room.message')
      console.log(`📊 Fallback: ${events.length} events from timeline`)
    }

    const currentUserId = matrixClientService.getClient()?.getUserId()
    const roomMessages = events
      .map(event => {
        const senderId = event.getSender()
        const member = room?.getMember(senderId)
        const content = event.getContent()
        const msgtype = content.msgtype

        return {
          id: event.getId(),
          type: (msgtype === 'm.image' ? 'image' : msgtype === 'm.file' ? 'file' : 'text') as 'text' | 'image' | 'file',
          sender: {
            id: senderId,
            name: member?.name || member?.rawDisplayName || senderId.split(':')[0].substring(1) || 'Unknown',
            avatar: member?.getAvatarUrl?.(matrixClientService.getClient()?.baseUrl || '', 32, 32, 'crop', false, false) || undefined
          },
          content: {
            body: content.body,
            url: content.url,
            filename: content.filename,
            mimetype: content.info?.mimetype,
            size: content.info?.size
          },
          timestamp: new Date(event.getTs()),
          isOwn: senderId === currentUserId,
          status: 'read' as const
        }
      })

    // Set the converted messages to display
    if (roomMessages && roomMessages.length > 0) {
      messages.value = roomMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      messageCount.value = messages.value.length
      console.log('✅ Messages loaded and sorted:', {
        totalMessages: messages.value.length,
        ownMessages: messages.value.filter(m => m.isOwn).length,
        otherMessages: messages.value.filter(m => !m.isOwn).length
      })
    } else {
      // No messages found - create a welcome message
      messages.value = [{
        id: 'welcome',
        type: 'text',
        sender: {
          id: 'system',
          name: 'System'
        },
        content: {
          body: `Welcome to the ${props.contextType} discussion! Start the conversation by sending a message.`
        },
        timestamp: new Date(),
        isOwn: false,
        status: 'read' as const
      }]
      console.log('ℹ️ No messages found, showing welcome message')
    }
  } catch (error) {
    console.error('❌ Failed to load messages:', error)
    messages.value = []
  } finally {
    console.log('🏗️ DEBUG: loadMessages() completed, setting isLoading=false')
    isLoading.value = false
  }
}

// Removed unused loadOlderMessages function in Phase 2

// Watchers - only reload when roomId actually changes
watch(() => props.roomId, async (newRoomId, oldRoomId) => {
  if (newRoomId && newRoomId !== oldRoomId) {
    console.log('🔄 Room ID changed from', oldRoomId, 'to', newRoomId)
    await loadMessages()
    await scrollToBottom()
  }
})

// Update message count when messages change
watch(messages, (newMessages) => {
  messageCount.value = newMessages.length
}, { immediate: true })

// Send read receipts when message count or connection state changes
watch([messageCount, isConnected], async ([newCount]) => {
  if (isConnected.value && newCount > 0) {
    // Small delay to ensure messages are rendered
    setTimeout(() => {
      sendReadReceipts()
      updateReadReceipts()
    }, 500)
  }
})

// Auto-scroll when typing indicators appear or disappear
watch(typingUsers, async (newTypingUsers, oldTypingUsers) => {
  console.log('🎯 Typing users watcher triggered!', {
    newCount: newTypingUsers.length,
    oldCount: oldTypingUsers?.length || 0,
    newUsers: newTypingUsers.map(u => u.userName),
    oldUsers: oldTypingUsers?.map(u => u.userName) || []
  })

  // Clear existing timer
  if (typingNotificationTimer.value) {
    clearTimeout(typingNotificationTimer.value)
    typingNotificationTimer.value = null
  }

  // Always handle typing state changes - auto-scroll when someone is typing
  if (newTypingUsers.length > 0) {
    console.log('⌨️ Someone is typing, scrolling to bottom')
    await scrollToBottom()
  }
})

// Generate unique instance ID for debugging
const instanceId = Math.random().toString(36).substring(2, 8)

// Connection and room management
onMounted(async () => {
  isConnecting.value = true

  try {
    console.log(`🔌 [${instanceId}] MatrixChatInterface initializing for:`, {
      roomId: props.roomId,
      contextType: props.contextType,
      contextId: props.contextId,
      mode: props.mode
    })

    let messagesLoaded = false

    // Check if Matrix client is already ready
    if (matrixClientService.isReady()) {
      console.log(`✅ [${instanceId}] Matrix client already initialized and ready`)
      isConnected.value = true
      lastAuthError.value = '' // Clear any previous errors
      roomName.value = `${props.contextType} Chat`

      // Set up service-based event listeners for real-time updates
      setupServiceEventListeners()

      // Load messages only if we have a room ID
      if (props.roomId) {
        console.log(`📨 [${instanceId}] Loading messages (client ready path)`)
        await loadMessages()
        await scrollToBottom()
        messagesLoaded = true
        console.log(`✅ [${instanceId}] Messages loaded and UI ready`)
      }
    } else {
      console.log(`⚠️ [${instanceId}] Matrix client not ready, will need to authenticate`)
      isConnected.value = false

      // Try to initialize Matrix connection (but don't force auth)
      await matrixClientService.initializeClient()
      console.log(`✅ [${instanceId}] Matrix client initialized successfully`)

      isConnected.value = true
      lastAuthError.value = '' // Clear any previous errors
      roomName.value = `${props.contextType} Chat`

      // Set up service-based event listeners for real-time updates
      setupServiceEventListeners()

      // Load messages if we have a room ID and we haven't loaded them already
      if (props.roomId && !messagesLoaded) {
        console.log(`📨 [${instanceId}] Loading messages (initialization path)`)
        await loadMessages()
        await scrollToBottom()
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize Matrix chat:', error)
    isConnected.value = false
    lastAuthError.value = error.message || 'Connection failed'
  } finally {
    isConnecting.value = false
  }
})

// Component cleanup
onUnmounted(() => {
  console.log(`🧹 [${instanceId}] MatrixChatInterface cleanup started`)

  // Cleanup custom event listeners
  customEventListeners.forEach(cleanup => cleanup())
  customEventListeners = []

  console.log(`🧹 [${instanceId}] MatrixChatInterface cleanup completed`)
})
</script>

<style scoped>
.matrix-chat-interface {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mode-mobile {
  height: 100%;
}

.mode-inline {
  height: 100%;
}

.mode-desktop {
  height: 100%;
  max-height: 80vh;
}

.chat-header {
  flex-shrink: 0;
  border-bottom: 1px solid var(--q-separator-color);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.messages-list {
  flex: 1;
  padding: 1rem;
}

.message-item {
  margin-bottom: 0.75rem;
}

.own-message-item {
  margin-left: 20%;
  display: flex;
  justify-content: flex-end;
}

.other-message-item {
  margin-right: 20%;
  display: flex;
  justify-content: flex-start;
}

.message-content {
  max-width: 100%;
}

.own-message .message-body {
  background: var(--q-primary);
  color: white;
  border-radius: 18px 4px 18px 18px;
}

.message-body {
  background: var(--q-dark-page);
  border-radius: 4px 18px 18px 18px;
  padding: 0.75rem 1rem;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
  white-space: nowrap;
}

.sender-name {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.matrix-id-subscript {
  font-size: 0.7rem;
  opacity: 0.6;
  margin-left: 0.25rem;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  border-radius: 50%;
}

.typing-indicator {
  padding: 0.5rem 1rem;
  font-style: italic;
  opacity: 0.7;
  background: var(--q-dark-page);
  border-radius: 18px;
  margin: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;
}

.input-container {
  flex-shrink: 0;
  padding: 1rem;
  border-top: 1px solid var(--q-separator-color);
  background: var(--q-card);
}

.connection-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.emoji-picker-container {
  position: absolute;
  bottom: 60px;
  right: 1rem;
  z-index: 1000;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.message-slide-enter-active {
  transition: all 0.3s ease-out;
}

.message-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.message-slide-enter-to {
  opacity: 1;
  transform: translateY(0);
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 599px) {
  .own-message-item {
    margin-left: 10%;
  }

  .other-message-item {
    margin-right: 10%;
  }
}
</style>
