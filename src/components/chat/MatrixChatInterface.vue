<template>
  <div class="matrix-chat-interface" :class="[`mode-${mode}`]">
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
        />
      </div>

      <!-- Messages -->
      <div v-else-if="messages.length > 0" class="messages-list">
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
                    />
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
            <q-icon name="more_horiz" size="16px" class="typing-dots" color="grey-6" />
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
          />
        </div>

        <!-- Upload Progress Indicator -->
        <div v-if="isSending" class="upload-progress q-mt-sm">
          <q-linear-progress
            indeterminate
            color="primary"
            size="2px"
            class="q-mb-xs"
          />
          <div class="text-caption text-grey-6 text-center">
            <q-icon name="fas fa-cloud-upload-alt" size="xs" class="q-mr-xs" />
            Uploading file...
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
import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { RoomEvent } from 'matrix-js-sdk'
import { matrixClientService } from '../../services/matrixClientService'
import { chatApi } from '../../api/chat'
import { groupsApi } from '../../api/groups'

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
const countdownTimer = ref<number | null>(null)

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
    case 'sent': return 'check'
    case 'delivered': return 'sym_r_done_all'
    case 'read': return 'sym_r_done_all'
    case 'failed': return 'error'
    default: return 'check'
  }
}

const getMessageStatusColor = (status?: string): string => {
  switch (status) {
    case 'sending': return 'grey'
    case 'sent': return 'grey'
    case 'delivered': return 'blue'
    case 'read': return 'blue'
    case 'failed': return 'negative'
    default: return 'grey'
  }
}

const sendMessage = async () => {
  if (!canSendMessage.value) return

  const text = messageText.value.trim()
  if (!text) return

  isSending.value = true

  try {
    // Create optimistic message
    const optimisticMessage: Message = {
      id: Date.now().toString(),
      type: 'text',
      sender: {
        id: 'current-user',
        name: 'You'
      },
      content: {
        body: text
      },
      timestamp: new Date(),
      isOwn: true,
      status: 'sending'
    }

    messages.value.push(optimisticMessage)
    messageText.value = ''

    // Focus the input field after sending message
    await nextTick()
    messageInput.value?.$el?.querySelector('input')?.focus()

    await scrollToBottom()

    // Send message via Matrix client directly
    if (props.roomId) {
      console.log('📤 Sending Matrix message to room:', props.roomId)
      await matrixClientService.sendMessage(props.roomId, {
        body: text,
        msgtype: 'm.text'
      })
    } else {
      console.error('❌ No Matrix room ID available for sending message')
      throw new Error('No Matrix room ID available')
    }

    // Update message status
    optimisticMessage.status = 'sent'

    // Stop typing indicator when message is sent
    await stopTyping()

    console.log('✅ Message sent successfully')
  } catch (error) {
    console.error('❌ Failed to send message:', error)
    // Update message status to failed
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage) {
      lastMessage.status = 'failed'
    }
  } finally {
    isSending.value = false
  }
}

const triggerFileUpload = () => {
  fileInput.value?.$el?.querySelector('input')?.click()
}

const handleFileUpload = async () => {
  console.log('🚀 handleFileUpload called', {
    hasFile: !!selectedFile.value,
    fileName: selectedFile.value?.name,
    roomId: props.roomId
  })

  if (!selectedFile.value || !props.roomId) {
    console.warn('❌ Missing file or roomId', {
      hasFile: !!selectedFile.value,
      roomId: props.roomId
    })
    return
  }

  try {
    console.log('📎 Starting file upload:', selectedFile.value.name)
    isSending.value = true

    // Validate file type (basic security check)
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      // Documents
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      // Media
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm', 'video/ogg'
    ]

    if (!allowedTypes.includes(selectedFile.value.type) && selectedFile.value.type !== '') {
      console.warn('⚠️ Unknown file type, allowing upload:', selectedFile.value.type)
    }

    // Upload file via Matrix client
    console.log('🚀 Uploading file via Matrix client:', {
      fileName: selectedFile.value.name,
      fileType: selectedFile.value.type,
      fileSize: selectedFile.value.size,
      roomId: props.roomId
    })

    await matrixClientService.uploadAndSendFile(props.roomId, selectedFile.value)

    console.log('✅ File uploaded and sent successfully - waiting for Matrix timeline event...')

    // Show success notification
    quasar.notify({
      type: 'positive',
      message: 'File uploaded successfully',
      icon: 'fas fa-check',
      position: 'top',
      timeout: 2000
    })
  } catch (error) {
    console.error('❌ Failed to upload file:', error)

    // Show error notification
    quasar.notify({
      type: 'negative',
      message: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      icon: 'fas fa-exclamation-triangle',
      position: 'top',
      timeout: 5000
    })
  } finally {
    selectedFile.value = null
    isSending.value = false

    // Clear the file input
    if (fileInput.value) {
      fileInput.value.removeFile()
    }
  }
}

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
    await matrixClientService.connect()
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

// Prevent duplicate loading
const isLoading = ref(false)

const loadMessages = async () => {
  if (isLoading.value) {
    console.log('⚠️ Already loading messages, skipping duplicate call')
    return
  }

  isLoading.value = true
  try {
    console.log('📨 Loading messages for room:', props.roomId, 'context:', props.contextType, 'contextId:', props.contextId)

    let roomMessages = []
    let actualRoomId = props.roomId

    // First, ensure we're joined to the room and get the real Matrix room ID
    if (props.contextType === 'group' && props.contextId) {
      try {
        console.log('🏘️ Joining group chat for:', props.contextId)
        const joinResponse = await groupsApi.joinGroupChat(props.contextId)
        console.log('🔍 Group join response:', joinResponse.data)

        // Check different possible response structures
        const responseData = joinResponse.data as Record<string, unknown>
        if (responseData.matrixRoomId && typeof responseData.matrixRoomId === 'string') {
          actualRoomId = responseData.matrixRoomId
        } else if (responseData.roomId && typeof responseData.roomId === 'string') {
          actualRoomId = responseData.roomId
        }
        console.log('✅ Joined group chat, room ID:', actualRoomId)
      } catch (error) {
        console.warn('⚠️ Failed to join group chat:', error.response?.data || error.message)
      }

      // Now join the Matrix room directly using the Matrix client
      if (actualRoomId) {
        try {
          console.log('🚪 Joining Matrix room directly:', actualRoomId)
          await matrixClientService.joinRoom(actualRoomId)
          console.log('✅ Successfully joined Matrix room via client')
        } catch (error) {
          console.warn('⚠️ Failed to join Matrix room via client:', error.message)
        }
      }

      // Load group messages
      try {
        const messagesResponse = await chatApi.getGroupMessages(props.contextId)
        console.log('🔍 Group messages response:', messagesResponse.data)
        roomMessages = messagesResponse.data.messages || []
        console.log('📨 Loaded', roomMessages.length, 'group messages')
      } catch (error) {
        console.warn('⚠️ Failed to load group messages:', error.response?.data || error.message)
      }

      // If no messages from API and we have a Matrix room ID, try loading historical messages
      if ((!roomMessages || roomMessages.length === 0) && actualRoomId) {
        try {
          console.log('📨 No API messages found, loading Matrix historical messages for room:', actualRoomId)
          const matrixEvents = await matrixClientService.loadRoomHistory(actualRoomId, 100)
          const currentUserId = matrixClientService.getClient()?.getUserId()
          roomMessages = matrixEvents.map(event => {
            const senderId = event.getSender()
            const room = matrixClientService.getClient()?.getRoom(actualRoomId)
            const member = room?.getMember(senderId)
            return {
              eventId: event.getId(),
              senderId,
              senderName: member?.name || member?.rawDisplayName || senderId.split(':')[0].substring(1) || 'Unknown',
              senderAvatar: member?.getAvatarUrl?.(matrixClientService.getClient()?.baseUrl || '', 32, 32, 'crop', false, false) || undefined,
              content: event.getContent(),
              timestamp: event.getTs(),
              type: event.getContent().msgtype,
              isOwn: senderId === currentUserId
            }
          })
          console.log('📨 Loaded', roomMessages.length, 'Matrix historical messages for group')
        } catch (error) {
          console.warn('⚠️ Failed to load Matrix historical messages for group:', error)
        }
      }
    } else if (props.contextType === 'event' && props.contextId) {
      try {
        console.log('🎉 Joining event chat for:', props.contextId)
        const joinResponse = await chatApi.joinEventChatRoom(props.contextId)
        console.log('🔍 Event join response:', joinResponse.data)

        const responseData = joinResponse.data as Record<string, unknown>
        if (responseData.roomId && typeof responseData.roomId === 'string') {
          actualRoomId = responseData.roomId
        } else if (responseData.matrixRoomId && typeof responseData.matrixRoomId === 'string') {
          actualRoomId = responseData.matrixRoomId
        }
        console.log('✅ Joined event chat, room ID:', actualRoomId)
      } catch (error) {
        console.warn('⚠️ Failed to join event chat:', error.response?.data || error.message)
      }

      // Now join the Matrix room directly using the Matrix client
      if (actualRoomId) {
        try {
          console.log('🚪 Joining Matrix room directly:', actualRoomId)
          await matrixClientService.joinRoom(actualRoomId)
          console.log('✅ Successfully joined Matrix room via client')
        } catch (error) {
          console.warn('⚠️ Failed to join Matrix room via client:', error.message)
        }
      }

      // Load event messages
      try {
        const messagesResponse = await chatApi.getEventMessages(props.contextId)
        console.log('🔍 Event messages response:', messagesResponse.data)
        roomMessages = messagesResponse.data.messages || []
        console.log('📨 Loaded', roomMessages.length, 'event messages')
      } catch (error) {
        console.warn('⚠️ Failed to load event messages:', error.response?.data || error.message)
      }

      // If no messages from API and we have a Matrix room ID, try loading historical messages
      if ((!roomMessages || roomMessages.length === 0) && actualRoomId) {
        try {
          console.log('📨 No API messages found, loading Matrix historical messages for room:', actualRoomId)
          const matrixEvents = await matrixClientService.loadRoomHistory(actualRoomId, 100)
          const currentUserId = matrixClientService.getClient()?.getUserId()
          roomMessages = matrixEvents.map(event => {
            const senderId = event.getSender()
            const room = matrixClientService.getClient()?.getRoom(actualRoomId)
            const member = room?.getMember(senderId)
            return {
              eventId: event.getId(),
              senderId,
              senderName: member?.name || member?.rawDisplayName || senderId.split(':')[0].substring(1) || 'Unknown',
              senderAvatar: member?.getAvatarUrl?.(matrixClientService.getClient()?.baseUrl || '', 32, 32, 'crop', false, false) || undefined,
              content: event.getContent(),
              timestamp: event.getTs(),
              type: event.getContent().msgtype,
              isOwn: senderId === currentUserId
            }
          })
          console.log('📨 Loaded', roomMessages.length, 'Matrix historical messages for event')
        } catch (error) {
          console.warn('⚠️ Failed to load Matrix historical messages for event:', error)
        }
      }
    } else if (props.roomId) {
      // Use the provided room ID directly, but ensure we're joined
      actualRoomId = props.roomId

      // Ensure we're joined to the Matrix room
      try {
        console.log('🚪 Ensuring Matrix room membership for:', props.roomId)
        await matrixClientService.joinRoom(props.roomId)
        console.log('✅ Successfully joined Matrix room via client')
      } catch (error) {
        console.warn('⚠️ Failed to join Matrix room via client:', error.message)
      }

      // Load from Matrix client directly with historical message support
      try {
        console.log('📨 Loading Matrix messages with history for room:', props.roomId)
        const matrixEvents = await matrixClientService.loadRoomHistory(props.roomId, 50)
        const currentUserId = matrixClientService.getClient()?.getUserId()
        roomMessages = matrixEvents.map(event => {
          const senderId = event.getSender()
          const room = matrixClientService.getClient()?.getRoom(props.roomId)
          const member = room?.getMember(senderId)
          return {
            eventId: event.getId(),
            senderId,
            senderName: member?.name || member?.rawDisplayName || senderId.split(':')[0].substring(1) || 'Unknown',
            senderAvatar: member?.getAvatarUrl?.(matrixClientService.getClient()?.baseUrl || '', 32, 32, 'crop', false, false) || undefined,
            content: event.getContent(),
            timestamp: event.getTs(),
            type: event.getContent().msgtype,
            isOwn: senderId === currentUserId
          }
        })
        console.log('📨 Loaded', roomMessages.length, 'Matrix messages with history')
      } catch (error) {
        console.warn('⚠️ Failed to load Matrix messages with history:', error)
        roomMessages = []
      }
    }

    if (roomMessages && roomMessages.length > 0) {
      // Convert Matrix messages to our Message interface
      messages.value = roomMessages.map(msg => ({
        id: msg.eventId || msg.id || Date.now().toString(),
        type: msg.type === 'm.image' ? 'image' : 'text',
        sender: {
          id: msg.senderId || msg.sender?.id || 'unknown',
          name: msg.senderName || msg.sender?.name || msg.senderId || 'Unknown',
          avatar: msg.senderAvatar || msg.sender?.avatar
        },
        content: {
          body: msg.content?.body || msg.body || '',
          url: msg.content?.url,
          filename: msg.content?.filename
        },
        timestamp: new Date(msg.timestamp || msg.createdAt || Date.now()),
        isOwn: msg.isOwn !== undefined ? msg.isOwn : (msg.senderId === matrixClientService.getClient()?.getUserId()),
        status: 'read' as const
      }))

      console.log('✅ Converted', messages.value.length, 'messages for display')
      console.log('👤 Current user ID:', matrixClientService.getClient()?.getUserId())
      console.log('📝 Message ownership summary:', {
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
    isLoading.value = false
  }
}

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
  console.log('⌨️ Processing typing state:', {
    oldCount: oldTypingUsers?.length || 0,
    newCount: newTypingUsers.length,
    users: newTypingUsers.map(u => u.userName)
  })

  // Small delay to ensure typing indicator is rendered
  await nextTick()
  setTimeout(() => {
    if (newTypingUsers.length > 0) {
      // Someone is typing - always auto-scroll to show typing indicator
      console.log('📜 Auto-scrolling to show typing indicator for:', newTypingUsers.map(u => u.userName))
      scrollToBottom(true) // Use smooth scrolling for typing indicators
      showTypingNotification.value = false

      // Set timer to auto-dismiss if no activity for 10 seconds
      typingNotificationTimer.value = setTimeout(() => {
        showTypingNotification.value = false
        console.log('📜 Auto-dismissed typing notification after timeout')
      }, 10000) as unknown as number
    } else {
      // No one is typing anymore, hide notification
      console.log('📜 No one typing anymore, hiding notification')
      showTypingNotification.value = false
    }
  }, 100)
}, { deep: true })

// Watch for file selection
watch(selectedFile, (newFile, oldFile) => {
  console.log('📁 selectedFile changed:', {
    old: oldFile?.name || 'null',
    new: newFile?.name || 'null',
    hasFile: !!newFile
  })
  if (newFile && !oldFile) {
    console.log('🚀 New file selected, triggering upload...')
    handleFileUpload()
  }
})

// Start countdown timer
const startCountdownTimer = () => {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
  }

  countdownTimer.value = window.setInterval(() => {
    if (rateLimitCountdown.value > 0) {
      rateLimitCountdown.value -= 1000
      if (rateLimitCountdown.value <= 0) {
        rateLimitCountdown.value = 0
        if (countdownTimer.value) {
          clearInterval(countdownTimer.value)
          countdownTimer.value = null
        }
      }
    }
  }, 1000)
}

// Lifecycle
onMounted(async () => {
  isConnecting.value = true

  try {
    console.log('🔌 MatrixChatInterface initializing for:', {
      roomId: props.roomId,
      contextType: props.contextType,
      contextId: props.contextId,
      mode: props.mode
    })

    // Check if Matrix client is already ready
    if (matrixClientService.isReady()) {
      console.log('✅ Matrix client already initialized and ready')
      isConnected.value = true
      lastAuthError.value = '' // Clear any previous errors
      roomName.value = `${props.contextType} Chat`

      // Set up Matrix event listeners for real-time updates
      setupMatrixEventListeners()

      // Load messages only if we have a room ID
      if (props.roomId) {
        await loadMessages()
        await scrollToBottom()
      }
      return
    }

    // Try to initialize Matrix connection (but don't force auth)
    await matrixClientService.initializeClient()
    console.log('✅ Matrix client initialized successfully')

    isConnected.value = true
    lastAuthError.value = '' // Clear any previous errors
    roomName.value = `${props.contextType} Chat`

    // Set up Matrix event listeners for real-time updates
    setupMatrixEventListeners()

    // Load messages only if we have a room ID
    if (props.roomId) {
      await loadMessages()
      await scrollToBottom()
    }
  } catch (error: unknown) {
    console.log('💬 Matrix client not authenticated, showing connect button')
    isConnected.value = false

    // Check for rate limiting error - handle both object and nested error formats
    const errorObj = (error as Record<string, unknown>)
    const nestedError = errorObj.errcode ? errorObj : (errorObj.data || errorObj)
    const errorMessage = (error as Error).message

    if ((nestedError as Record<string, unknown>).errcode === 'M_LIMIT_EXCEEDED' || (errorMessage && errorMessage.includes('Too Many Requests'))) {
      const retryAfterMs = (nestedError as Record<string, unknown>).retry_after_ms as number
      if (retryAfterMs) {
        const retryAfterMinutes = Math.ceil(retryAfterMs / 60000)
        console.warn(`⚠️ Rate limited - please try again in ${retryAfterMinutes} minutes (${retryAfterMs}ms)`)
        // Store the retry time for UI display
        window.matrixRetryAfter = Date.now() + retryAfterMs
        rateLimitCountdown.value = retryAfterMs
        startCountdownTimer()
      } else {
        console.warn('⚠️ Rate limited - no retry time provided')
        window.matrixRetryAfter = Date.now() + 300000 // Default to 5 minutes
        rateLimitCountdown.value = 300000
        startCountdownTimer()
      }
    } else if (errorMessage && errorMessage.includes('Manual authentication required')) {
      console.log('🔑 Manual authentication required - user needs to click Connect')
    } else {
      console.warn('⚠️ Matrix connection issue:', errorMessage)
    }
  } finally {
    isConnecting.value = false
  }

  // Set up periodic sync health check to detect and fix sync issues
  const syncHealthCheckInterval = setInterval(() => {
    if (isConnected.value && matrixClientService.isReady()) {
      const client = matrixClientService.getClient()
      if (client) {
        const syncState = client.getSyncState()

        if (syncState === 'ERROR' || syncState === 'STOPPED') {
          console.warn('⚠️ Matrix sync is in error state, attempting to restart...')
          try {
            client.startClient({
              initialSyncLimit: 20,
              includeArchivedRooms: false,
              lazyLoadMembers: true
            })
          } catch (error) {
            console.error('❌ Failed to restart Matrix sync:', error)
          }
        } else if (syncState === 'SYNCING' || syncState === 'PREPARED') {
          // Check if messages are stale (no new timeline events in a while)
          const room = client.getRoom(props.roomId)
          if (room && messages.value.length > 0) {
            const lastMessage = messages.value[messages.value.length - 1]
            const timeSinceLastMessage = Date.now() - lastMessage.timestamp.getTime()

            // If it's been more than 5 minutes since last message and we suspect there should be activity
            // we can optionally trigger a gentle refresh (but be careful not to be too aggressive)
            if (timeSinceLastMessage > 300000) { // 5 minutes
              // Just log for now - aggressive refreshing can cause issues
              console.log('📊 No recent messages detected in Matrix sync health check')
            }
          }
        }
      }
    }
  }, 30000) // Check every 30 seconds

  // Store interval for cleanup
  customEventListeners.push(() => clearInterval(syncHealthCheckInterval))

  // Set up scroll listener to detect when user manually scrolls to bottom
  const setupScrollListener = () => {
    const handleScroll = () => {
      const container = messagesContainer.value
      if (container && showTypingNotification.value) {
        const scrollTop = container.scrollTop
        const scrollHeight = container.scrollHeight
        const clientHeight = container.clientHeight
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight

        // If user manually scrolled to bottom, hide typing notification
        if (distanceFromBottom < 50) {
          showTypingNotification.value = false
        }
      }
    }

    // Add scroll listener
    setTimeout(() => {
      if (messagesContainer.value) {
        messagesContainer.value.addEventListener('scroll', handleScroll)
        customEventListeners.push(() => {
          if (messagesContainer.value) {
            messagesContainer.value.removeEventListener('scroll', handleScroll)
          }
        })
      }
    }, 100)
  }

  setupScrollListener()
})

// Matrix event listener cleanup functions
let matrixTimelineListener: ((event: MatrixEvent, room: Room, toStartOfTimeline: boolean) => void) | null = null
let customEventListeners: (() => void)[] = []

// Set up Matrix SDK event listeners for real-time message updates
const setupMatrixEventListeners = () => {
  if (!props.roomId) return

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      console.warn('⚠️ Matrix client not available for event listeners')
      return
    }

    const room = client.getRoom(props.roomId)
    if (!room) {
      console.warn('⚠️ Matrix room not found for event listeners:', props.roomId)
      return
    }

    console.log('🎧 Setting up Matrix event listeners for room:', props.roomId)

    // Listen directly to Matrix room timeline events
    matrixTimelineListener = (event: MatrixEvent, room: Room, toStartOfTimeline: boolean) => {
      if (event.getType() === 'm.room.message' && room.roomId === props.roomId) {
        console.log('📨 Real-time Matrix message received:', {
          eventId: event.getId(),
          sender: event.getSender(),
          isHistorical: toStartOfTimeline
        })

        // Add message to the messages array reactively
        addMessageToTimeline(event, toStartOfTimeline)
      }
    }

    // Attach the listener to the specific room
    room.on(RoomEvent.Timeline, matrixTimelineListener)

    // Handle timeline reset events that require full reload
    const handleMatrixTimelineReset = (event: CustomEvent) => {
      if (event.detail.roomId === props.roomId) {
        console.log('🔄 Matrix timeline reset detected for room:', props.roomId)
        // Force reload messages after timeline reset
        setTimeout(() => {
          console.log('🔄 Reloading messages after timeline reset...')
          loadMessages()
        }, 500)
      }
    }

    const handleMatrixTyping = (event: CustomEvent) => {
      console.log('🎯 handleMatrixTyping called with:', {
        eventRoomId: event.detail.roomId,
        propsRoomId: props.roomId,
        matches: event.detail.roomId === props.roomId,
        detail: event.detail
      })

      if (event.detail.roomId === props.roomId) {
        const { userId, userName, typing } = event.detail
        const currentUserId = matrixClientService.getClient()?.getUserId()

        // Don't show our own typing indicator
        if (userId === currentUserId) return

        console.log('⌨️ Typing event received:', { userId, userName, typing })

        if (typing) {
          // Add user to typing list if not already there
          const existingIndex = typingUsers.value.findIndex(user => user.userId === userId)
          if (existingIndex === -1) {
            console.log('➕ Adding user to typing list:', userName, 'Current count:', typingUsers.value.length)
            typingUsers.value.push({ userId, userName })
            console.log('✅ User added. New count:', typingUsers.value.length, 'Users:', typingUsers.value.map(u => u.userName))

            // Set timeout to automatically remove user after 10 seconds (Matrix timeout)
            setTimeout(() => {
              const index = typingUsers.value.findIndex(user => user.userId === userId)
              if (index !== -1) {
                typingUsers.value.splice(index, 1)
                console.log('⌨️ Auto-removed typing user due to timeout:', userName)
              }
            }, 12000) // Slightly longer than Matrix timeout for safety
          } else {
            console.log('👤 User already in typing list:', userName)
          }
        } else {
          // Remove user from typing list
          const existingIndex = typingUsers.value.findIndex(user => user.userId === userId)
          if (existingIndex !== -1) {
            console.log('➖ Removing user from typing list:', userName, 'Current count:', typingUsers.value.length)
            typingUsers.value.splice(existingIndex, 1)
            console.log('✅ User removed. New count:', typingUsers.value.length, 'Users:', typingUsers.value.map(u => u.userName))
          } else {
            console.log('❌ User not found in typing list:', userName)
          }
        }
      }
    }

    const handleMatrixRedaction = (event: CustomEvent) => {
      if (event.detail.roomId === props.roomId) {
        const { redactedEventId, sender } = event.detail
        console.log('🗑️ Redaction event received:', { redactedEventId, sender })

        // Find and remove the redacted message from our messages array
        const messageIndex = messages.value.findIndex(msg => msg.id === redactedEventId)
        if (messageIndex !== -1) {
          const redactedMessage = messages.value[messageIndex]
          console.log('🗑️ Removing redacted message:', redactedMessage.content.body?.substring(0, 50))

          // Replace message content with redaction placeholder
          redactedMessage.content = {
            body: '[This message was deleted]',
            msgtype: 'm.text'
          } as { body: string; msgtype: string; [key: string]: unknown }
          redactedMessage.isRedacted = true

          console.log('✅ Message marked as redacted')
        } else {
          console.log('⚠️ Could not find message to redact:', redactedEventId)
        }
      }
    }

    // Add custom event listeners (only for events that need special handling)
    window.addEventListener('matrix:timeline-reset', handleMatrixTimelineReset)
    window.addEventListener('matrix:typing', handleMatrixTyping)
    window.addEventListener('matrix:redaction', handleMatrixRedaction)

    // Store cleanup functions
    customEventListeners = [
      () => window.removeEventListener('matrix:timeline-reset', handleMatrixTimelineReset),
      () => window.removeEventListener('matrix:typing', handleMatrixTyping),
      () => window.removeEventListener('matrix:redaction', handleMatrixRedaction)
    ]

    console.log('✅ Matrix event listeners configured successfully')
  } catch (error) {
    console.error('❌ Failed to set up Matrix event listeners:', error)
  }
}

// Add a new message to the timeline reactively
const addMessageToTimeline = (event: MatrixEvent, toStartOfTimeline: boolean) => {
  try {
    const senderId = event.getSender()
    const room = matrixClientService.getClient()?.getRoom(props.roomId)
    const member = room?.getMember(senderId)

    // Determine message type based on msgtype and mimetype
    const content = event.getContent()
    const msgtype = content.msgtype
    const mimetype = content.info?.mimetype || ''

    let messageType: 'text' | 'image' | 'file' = 'text'
    if (msgtype === 'm.image' || (msgtype === 'm.file' && mimetype.startsWith('image/'))) {
      messageType = 'image'
    } else if (msgtype === 'm.file') {
      messageType = 'file'
    }

    const messageData = {
      id: event.getId(),
      type: messageType,
      sender: {
        id: senderId,
        name: member?.name || member?.rawDisplayName || senderId.split(':')[0].substring(1) || 'Unknown',
        avatar: member?.getAvatarUrl?.(matrixClientService.getClient()?.baseUrl || '', 32, 32, 'crop', false, false) || undefined
      },
      content: {
        body: content.body || '',
        url: content.url,
        filename: content.filename,
        mimetype,
        size: content.info?.size
      },
      timestamp: new Date(event.getTs()),
      isOwn: event.getSender() === matrixClientService.getClient()?.getUserId(),
      status: 'read' as const
    }

    // Check for duplicates - either by ID or by content + timestamp for optimistic messages
    const existingIndex = messages.value.findIndex(msg => {
      // Exact ID match
      if (msg.id === messageData.id) return true

      // For own messages, check if optimistic message matches content and is recent
      if (messageData.isOwn && msg.isOwn && msg.content.body === messageData.content.body) {
        const timeDiff = Math.abs(messageData.timestamp.getTime() - msg.timestamp.getTime())
        return timeDiff < 10000 // Within 10 seconds
      }

      return false
    })

    if (existingIndex === -1) {
      if (toStartOfTimeline) {
        // Historical message - add to beginning
        messages.value.unshift(messageData)
      } else {
        // Live message - add to end
        messages.value.push(messageData)
        // Scroll to bottom for new messages
        nextTick(() => scrollToBottom())
      }
      console.log('✅ Added new message to timeline:', messageData.id)
    } else {
      // Replace optimistic message with real Matrix event
      messages.value[existingIndex] = messageData
      console.log('🔄 Replaced optimistic message with Matrix event:', messageData.id)
    }
  } catch (error) {
    console.error('❌ Failed to add message to timeline:', error)
  }
}

onUnmounted(() => {
  // Cleanup Matrix event listeners
  if (matrixTimelineListener && props.roomId) {
    try {
      const client = matrixClientService.getClient()
      const room = client?.getRoom(props.roomId)
      if (room) {
        room.off(RoomEvent.Timeline, matrixTimelineListener)
        console.log('🧹 Removed Matrix room timeline listener')
      }
    } catch (error) {
      console.warn('⚠️ Failed to remove Matrix room timeline listener:', error)
    }
  }

  // Cleanup custom event listeners
  customEventListeners.forEach(cleanup => cleanup())
  customEventListeners = []

  // Cleanup countdown timer
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
  }

  // Cleanup typing notification timer
  if (typingNotificationTimer.value) {
    clearTimeout(typingNotificationTimer.value)
  }

  // Cleanup typing timer and stop typing indicator
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }

  // Stop typing indicator on cleanup
  if (isTyping.value) {
    stopTyping().catch(console.warn)
  }

  console.log('🧹 MatrixChatInterface cleanup completed')
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

.mode-mobile {
  height: 100%;
  position: relative;
  overflow: hidden;
}

.mode-mobile .messages-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 140px; /* Reserve even more space for input + footer */
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 20px;
}

.mode-mobile .message-input-container {
  position: fixed;
  bottom: 60px; /* Increased spacing above system footer/navigation */
  left: 0;
  right: 0;
  min-height: 70px;
  background: var(--q-color-surface);
  border-top: 1px solid var(--q-color-separator);
  border-radius: 8px 8px 0 0;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
  z-index: 1000;
  padding: 12px;
  margin: 0 4px;
}

.mode-mobile .message-input {
  padding: 0 !important;
}

.mode-inline {
  border-radius: 8px;
  overflow: hidden;
}

.messages-container {
  -webkit-overflow-scrolling: touch;
}

.message-item {
  margin-bottom: 8px;
}

.own-message-item {
  margin-left: 20%;
}

.other-message-item {
  margin-right: 20%;
}

.message-content {
  flex: 1;
}

.own-message .message-body {
  background: #1976d2;
  color: white;
  padding: 8px 12px;
  border-radius: 18px 18px 4px 18px;
  margin-left: auto;
  max-width: fit-content;
  position: relative;
}

.message-body {
  background: #f3e5f5;
  color: var(--q-color-on-surface);
  padding: 8px 12px;
  border-radius: 18px 18px 18px 4px;
  max-width: fit-content;
  position: relative;
}

/* Ensure all messages have bubble styling */
.message-content:not(.own-message) .message-body {
  background: #f3e5f5;
  color: var(--q-color-on-surface);
  border-radius: 4px 18px 18px 18px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.message-content.own-message .message-body {
  background: #1976d2;
  color: white;
  border-radius: 18px 4px 18px 18px;
  margin-left: auto;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}

/* Dark mode support for message bubbles */
.body--dark .message-body {
  background: #4a148c;
  color: var(--q-color-grey-2);
}

.body--dark .message-content:not(.own-message) .message-body {
  background: #4a148c;
  color: var(--q-color-grey-2);
  box-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.body--dark .message-content.own-message .message-body {
  background: #1976d2;
  color: white;
  box-shadow: 0 1px 2px rgba(0,0,0,0.4);
}

/* Message input container styling */
.message-input-container {
  background: var(--q-color-surface);
  border-top: 1px solid var(--q-color-separator);
}

.message-input {
  border-top: 1px solid var(--q-color-separator);
}

/* Dark mode input field styling */
.body--dark .message-input-container {
  background: var(--q-color-surface);
  border-top: 1px solid var(--q-color-separator);
}

/* Chat header styling */
.chat-header {
  background: var(--q-color-grey-2);
  color: var(--q-color-on-surface);
}

/* Dark mode chat header */
.body--dark .chat-header {
  background: var(--q-color-grey-9);
  color: var(--q-color-grey-2);
}

/* Matrix ID subscript styling */
.matrix-id-subscript {
  font-size: 0.65em;
  font-weight: normal;
  color: var(--q-color-grey-6);
  margin-left: 0.25em;
  vertical-align: baseline;
  opacity: 0.8;
}

/* Dark mode matrix ID subscript */
.body--dark .matrix-id-subscript {
  color: var(--q-color-grey-5);
}

/* Inline timestamp styling */
.message-time-inline {
  font-size: 0.75em;
  opacity: 0.8;
  white-space: nowrap;
  align-self: flex-end;
  color: rgba(255, 255, 255, 0.7);
}

/* Timestamp color for non-own messages */
.message-content:not(.own-message) .message-time-inline {
  color: var(--q-color-grey-6);
}

/* Dark mode timestamp colors */
.body--dark .message-content:not(.own-message) .message-time-inline {
  color: var(--q-color-grey-5);
}

.body--dark .message-content.own-message .message-time-inline {
  color: rgba(255, 255, 255, 0.7);
}

/* Make text message container flex to position timestamp */
.text-message {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 0.25em;
}

.message-text {
  flex: 1;
  min-width: 0;
}

/* Message formatting styles */
.message-text .message-link {
  color: #1976d2;
  text-decoration: underline;
  word-break: break-all;
}

.message-text .message-link:hover {
  color: #1565c0;
  text-decoration: underline;
}

.message-text .inline-code {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.message-text strong {
  font-weight: 600;
}

.message-text em {
  font-style: italic;
}

.message-text del {
  text-decoration: line-through;
  opacity: 0.7;
}

/* Delete button styling */
.delete-message-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
  vertical-align: middle;
}

/* Show delete button on message hover */
.message-content:hover .delete-message-btn {
  opacity: 0.9;
}

.delete-message-btn:hover {
  opacity: 1 !important;
  transform: scale(1.1);
}

/* Read receipts chip styling */
.read-receipts-chip {
  font-size: 10px;
  height: 18px;
  vertical-align: middle;
}

.read-receipts-chip .read-receipt-text {
  font-size: 10px;
  line-height: 1;
}

.message-image {
  border-radius: 8px;
  max-width: 100%;
}

/* Avatar fallback styling */
.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.85em;
  border-radius: 50%;
  text-transform: uppercase;
}

/* Responsive avatar font sizes */
.mode-mobile .avatar-fallback {
  font-size: 0.75em;
}

.mode-desktop .avatar-fallback,
.mode-inline .avatar-fallback {
  font-size: 0.9em;
}

/* Read receipt indicators */
.read-receipts {
  display: inline-flex;
  align-items: center;
  font-size: 0.7em;
  opacity: 0.8;
}

.read-receipt-count {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 1px 4px;
  font-size: 0.75em;
  font-weight: bold;
  min-width: 12px;
  text-align: center;
}

.read-receipt-count.multiple-readers {
  background: rgba(76, 175, 80, 0.3);
  color: rgba(255, 255, 255, 0.95);
}

/* Read receipts for non-own messages in bubbles */
.message-content:not(.own-message) .read-receipt-count {
  background: rgba(0, 0, 0, 0.1);
  color: var(--q-color-grey-7);
}

.message-content:not(.own-message) .read-receipt-count.multiple-readers {
  background: rgba(76, 175, 80, 0.2);
  color: var(--q-color-grey-8);
}

/* Dark mode read receipts */
.body--dark .message-content:not(.own-message) .read-receipt-count {
  background: rgba(255, 255, 255, 0.1);
  color: var(--q-color-grey-4);
}

.body--dark .message-content:not(.own-message) .read-receipt-count.multiple-readers {
  background: rgba(76, 175, 80, 0.3);
  color: var(--q-color-grey-3);
}

.file-card {
  max-width: 300px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.emoji-btn {
  min-width: 40px;
  height: 40px;
}

/* Typing indicator styles */
.typing-indicator {
  padding: 8px 16px;
  margin-bottom: 8px;
}

.typing-user-avatar {
  position: relative;
}

.typing-avatar {
  font-size: 0.7em;
  opacity: 0.9;
}

.typing-dots-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
}

/* Dark mode typing dots container */
.body--dark .typing-dots-container {
  background: rgba(255, 255, 255, 0.1);
}

.typing-dots {
  animation: typing 1.5s infinite;
}

.typing-text {
  font-style: italic;
  opacity: 0.8;
}

@keyframes typing {
  0%, 20% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
  80%, 100% { opacity: 0.4; transform: scale(1); }
}

/* Typing notification badge */
.typing-notification-badge {
  position: absolute;
  bottom: 85px; /* Above message input */
  right: 16px;
  z-index: 100;
  animation: slideUpFade 0.3s ease-out;
}

.mode-mobile .typing-notification-badge {
  bottom: 155px; /* Account for mobile input positioning */
  right: 20px;
}

.typing-scroll-btn {
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  font-size: 0.75em;
  max-width: 250px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

@keyframes slideUpFade {
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
