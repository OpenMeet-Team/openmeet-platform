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
          icon="sym_r_more_vert"
          flat
          round
        >
          <q-menu>
            <q-list style="min-width: 180px">
              <q-item clickable v-close-popup @click="clearMatrixSessions">
                <q-item-section avatar>
                  <q-icon name="sym_r_clear_all" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Clear Matrix Sessions</q-item-label>
                  <q-item-label caption>Fix authentication issues</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="reconnect">
                <q-item-section avatar>
                  <q-icon name="sym_r_refresh" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Reconnect</q-item-label>
                  <q-item-label caption>Retry connection</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup @click="showChatHelp">
                <q-item-section avatar>
                  <q-icon name="sym_r_help" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Chat Help</q-item-label>
                  <q-item-label caption>Use other Element clients</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-btn
          icon="sym_r_open_in_new"
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
      <div v-if="isConnected && messages.length > 0" class="messages-list" data-cy="messages-list">
        <!-- Load More History Button -->
        <div class="load-more-history text-center q-pa-md">
          <q-btn
            v-if="!isLoadingOlderMessages && hasMoreHistory"
            @click="loadOlderMessages"
            label="Load More History"
            icon="sym_r_keyboard_arrow_up"
            color="primary"
            outline
            size="sm"
            dense
            data-cy="load-more-history-btn"
          />
          <div v-if="isLoadingOlderMessages" class="loading-older-messages text-center q-pa-sm">
            <q-spinner size="20px" color="primary" />
            <div class="text-caption text-grey-6 q-mt-xs">Loading older messages...</div>
          </div>
          <div v-if="!hasMoreHistory && messages.length > 4" class="text-caption text-grey-6">
            No more history available
          </div>
        </div>

        <!-- Loading indicator for initial messages -->
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
              class="message-avatar"
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
                <div class="text-weight-bold sender-display-name" :style="{ color: getSenderColor(message.sender.id) }">
                  {{ cleanDisplayName(message.sender.name, message.sender.id) }}
                </div>
                <div class="message-time text-caption q-ml-sm">
                  {{ formatTime(message.timestamp) }}
                </div>
              </div>

              <!-- Message Body -->
              <div class="message-body">
                <!-- Text Message -->
                <div v-if="message.type === 'text'" class="text-message">
                  <div class="message-text" v-html="formatMessageText(message.content.body)"></div>
                  <!-- Status and actions - only show for own messages -->
                  <div v-if="message.isOwn" class="message-actions text-caption q-mt-xs">
                    <q-icon
                      :name="getMessageStatusIcon(message.status)"
                      :color="getMessageStatusColor(message.status)"
                      size="12px"
                    >
                      <q-tooltip v-if="message.status === 'failed'" class="text-body2">
                        {{ message.errorMessage || 'Failed to send message. Click to retry.' }}
                      </q-tooltip>
                    </q-icon>
                    <!-- Read Receipt Indicators -->
                    <q-chip
                      v-if="message.readReceipts && message.readReceipts.length > 0"
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

                    <!-- Delete button -->
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
                  </div>
                </div>

                <!-- Image Message -->
                <div v-else-if="message.type === 'image'" class="image-message">
                  <div v-if="message.imageBlobUrl" class="authenticated-image-container">
                    <img
                      :src="message.imageBlobUrl"
                      :alt="message.content.filename"
                      class="message-image cursor-pointer"
                      :style="getImageStyle()"
                      @click="showImageModal(message.fullImageBlobUrl || message.imageBlobUrl)"
                    />
                  </div>
                  <div v-else class="image-loading">
                    <q-spinner color="primary" size="2em" />
                    <div class="text-caption q-mt-xs">Loading image...</div>
                  </div>
                  <div v-if="message.content.filename" class="text-caption q-mt-xs">
                    {{ message.content.filename }}
                  </div>
                </div>

                <!-- File Message -->
                <div v-else-if="message.type === 'file'" class="file-message">
                  <q-card flat bordered class="file-card">
                    <q-card-section class="q-pa-sm">
                      <div class="row items-center">
                        <q-icon :name="getFileIcon(message.content.mimetype)" class="q-mr-sm" size="24px" />
                        <div class="col">
                          <div class="text-body2 file-name">{{ message.content.filename }}</div>
                          <div class="text-caption text-grey-6">
                            {{ formatFileSize(message.content.size) }}
                          </div>
                        </div>
                        <div class="file-actions">
                          <q-btn
                            icon="sym_r_visibility"
                            flat
                            round
                            size="sm"
                            @click="previewFile(message.content)"
                            :title="'Preview ' + message.content.filename"
                            class="q-mr-xs"
                          />
                          <q-btn
                            icon="sym_r_download"
                            flat
                            round
                            size="sm"
                            @click="downloadFile(getFileUrl(message.content.url), message.content.filename)"
                            :title="'Download ' + message.content.filename"
                          />
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- Empty State with Load More History -->
      <div v-else-if="isConnected && messages.length === 0" class="empty-state text-center q-pa-lg">
        <!-- Load More History Button (show even when no messages) -->
        <div v-if="isConnected" class="load-more-history text-center q-pa-md">
          <q-btn
            v-if="!isLoadingOlderMessages && hasMoreHistory"
            @click="loadOlderMessages"
            label="Load More History"
            icon="sym_r_keyboard_arrow_up"
            color="primary"
            outline
            size="sm"
            dense
            data-cy="load-more-history-btn"
          />
          <div v-if="isLoadingOlderMessages" class="loading-older-messages text-center q-pa-sm">
            <q-spinner size="20px" color="primary" />
            <div class="text-caption text-grey-6 q-mt-xs">Loading older messages...</div>
          </div>
          <div v-if="!hasMoreHistory" class="text-caption text-grey-6 q-mb-md">
            No history available
          </div>
        </div>

        <q-icon name="fas fa-comments" size="48px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-6">Start the conversation</div>
        <div class="text-body2 text-grey-5">Send a message to begin</div>

        <!-- Simplified: Use the unified connect button instead of separate join room button -->
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
          <q-btn icon="sym_r_close" flat round dense v-close-popup />
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
import { MatrixEvent, Room, ClientEvent, RoomEvent } from 'matrix-js-sdk'
import { matrixClientService } from '../../services/matrixClientService'
import { matrixClientManager } from '../../services/MatrixClientManager'
import getEnv from '../../utils/env'

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
  // Authenticated image blob URLs
  imageBlobUrl?: string
  fullImageBlobUrl?: string
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
// Connection state tracking

const isConnected = computed(() => {
  const client = matrixClientService.getClient()
  const isReady = matrixClientService.isReady()
  const isLoggedIn = client?.isLoggedIn() ?? false
  return isReady && isLoggedIn
})
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

// Load More History state
const isLoadingOlderMessages = ref(false)
const hasMoreHistory = ref(true)
const currentHistoryLimit = ref(50)

// Use Matrix client service directly for real Matrix integration

// Refs
const messagesContainer = ref<HTMLElement>()
const messageInput = ref()
const fileInput = ref()
const countdownTimer = ref<ReturnType<typeof setInterval> | null>(null)

// Custom event listeners tracking for cleanup
let customEventListeners: (() => void)[] = []

// Helper function to resolve room aliases to actual Matrix rooms
const resolveRoom = async (roomIdOrAlias: string) => {
  const client = matrixClientService.getClient()
  if (!client) return null

  // First, try direct room ID lookup (for cached room IDs)
  if (roomIdOrAlias.startsWith('!')) {
    return client.getRoom(roomIdOrAlias)
  }

  // If it's a room alias, try to resolve it
  if (roomIdOrAlias.startsWith('#')) {
    try {
      // First check if we already have a room with this alias
      const rooms = client.getRooms()
      for (const room of rooms) {
        if (room.getCanonicalAlias() === roomIdOrAlias ||
            room.getAltAliases().includes(roomIdOrAlias)) {
          return room
        }
      }

      // If not found locally, resolve the alias via Matrix API
      console.log('🔍 Resolving room alias:', roomIdOrAlias)
      const aliasResponse = await client.getRoomIdForAlias(roomIdOrAlias)
      const roomId = aliasResponse.room_id

      // Try to get the room by resolved ID
      let room = client.getRoom(roomId)

      // If room still not found locally, join via alias
      if (!room) {
        console.log('🚪 Room not in local state, joining via alias:', roomIdOrAlias)
        const joinResult = await client.joinRoom(roomIdOrAlias)
        room = client.getRoom(joinResult.roomId)
      }

      return room
    } catch (error) {
      console.error('❌ Failed to resolve room alias:', roomIdOrAlias, error)
      return null
    }
  }

  // Fallback: try as room ID anyway
  return client.getRoom(roomIdOrAlias)
}

// Reactive room reference that resolves aliases
const currentRoom = ref<Room | null>(null)
const isResolvingRoom = ref(false)

// Function to update the current room when roomId changes
const updateCurrentRoom = async () => {
  if (!props.roomId || isResolvingRoom.value) return

  isResolvingRoom.value = true
  try {
    const room = await resolveRoom(props.roomId)
    currentRoom.value = room
    if (room) {
      console.log('✅ Resolved room:', room.roomId, 'from:', props.roomId)
    } else {
      console.warn('❌ Could not resolve room:', props.roomId)
    }
  } catch (error) {
    console.error('❌ Error resolving room:', error)
    currentRoom.value = null
  } finally {
    isResolvingRoom.value = false
  }
}

// Watch for roomId changes and resolve the room
watch(() => props.roomId, updateCurrentRoom, { immediate: true })

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
    case 'event': return isConnected.value ? `${count} messages` : 'Not connected'
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
  const room = currentRoom.value
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

  // Check if Matrix client is properly authenticated before attempting delete
  const client = matrixClientService.getClient()
  if (!client) {
    quasar.notify({
      type: 'warning',
      message: 'Chat connection not available. Please refresh the page.',
      position: 'top'
    })
    return
  }

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

    console.log('🗑️ Deleting message:', message.id, 'in room:', props.roomId)

    // Optimistically remove the message from UI for better UX
    const originalMessages = [...messages.value]
    messages.value = messages.value.filter(msg => msg.id !== message.id)

    try {
      await matrixClientService.redactMessage(props.roomId, message.id)
      console.log('✅ Message deleted successfully')

      // Show success feedback
      quasar.notify({
        type: 'positive',
        message: 'Message deleted',
        position: 'top',
        timeout: 2000
      })
    } catch (error) {
      // If deletion fails, restore the message
      messages.value = originalMessages
      throw error
    }
  } catch (error) {
    console.error('❌ Failed to delete message:', error)

    // Provide more specific error messages
    let errorMessage = 'Failed to delete message'
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorMessage = 'Authentication failed. Please refresh the page and try again.'
    } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      errorMessage = 'You do not have permission to delete this message.'
    }

    quasar.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 4000
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
  if (!mimetype) return 'sym_r_attach_file'
  if (mimetype.startsWith('image/')) return 'sym_r_image'
  if (mimetype.startsWith('video/')) return 'sym_r_videocam'
  if (mimetype.startsWith('audio/')) return 'sym_r_audiotrack'
  if (mimetype.includes('pdf')) return 'sym_r_picture_as_pdf'
  if (mimetype.includes('zip') || mimetype.includes('rar')) return 'sym_r_archive'
  return 'sym_r_attach_file'
}

const getFileUrl = (url: string): string => {
  if (!url) {
    console.warn('⚠️ getFileUrl: Empty URL provided')
    return ''
  }

  // If it's already an HTTP URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.log('🔗 getFileUrl: Using HTTP URL as-is:', url)
    return url
  }

  // Handle Matrix content URLs (mxc://) for file downloads
  if (url.startsWith('mxc://')) {
    const client = matrixClientService.getClient()
    if (!client) {
      console.error('❌ getFileUrl: Matrix client not available')
      return ''
    }

    // For files, use download endpoint without dimensions
    const convertedUrl = matrixClientService.getContentUrl(url)
    console.log('📎 getFileUrl: Converting Matrix URL for file download:', {
      original: url,
      converted: convertedUrl,
      baseUrl: client.baseUrl,
      isValid: convertedUrl && convertedUrl !== url && convertedUrl.startsWith('http')
    })

    if (!convertedUrl || convertedUrl === url || !convertedUrl.startsWith('http')) {
      console.error('❌ getFileUrl: Matrix URL conversion failed or invalid')
      return ''
    }

    return convertedUrl
  }

  // Fallback - return original URL
  console.log('🔗 getFileUrl: Using original URL:', url)
  return url
}

// Load authenticated images and create blob URLs
const loadAuthenticatedImage = async (message: Message): Promise<void> => {
  if (!message.content?.url || message.imageBlobUrl) return

  try {
    const client = matrixClientService.getClient()
    const accessToken = client?.getAccessToken()

    if (!accessToken) {
      console.error('❌ No access token for image loading')
      return
    }

    // Get thumbnail URL for timeline display (300x300)
    const thumbnailUrl = matrixClientService.getContentUrl(message.content.url, 300, 300)

    // Get full-size URL for modal display
    const fullSizeUrl = matrixClientService.getContentUrl(message.content.url)

    // Load thumbnail image
    const thumbnailResponse = await fetch(thumbnailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (thumbnailResponse.ok) {
      const thumbnailBlob = await thumbnailResponse.blob()
      message.imageBlobUrl = URL.createObjectURL(thumbnailBlob)
    }

    // Load full-size image for modal
    if (thumbnailUrl !== fullSizeUrl) {
      const fullSizeResponse = await fetch(fullSizeUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      if (fullSizeResponse.ok) {
        const fullSizeBlob = await fullSizeResponse.blob()
        message.fullImageBlobUrl = URL.createObjectURL(fullSizeBlob)
      }
    } else {
      message.fullImageBlobUrl = message.imageBlobUrl
    }
  } catch (error) {
    console.error('❌ Failed to load authenticated image:', error)
  }
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
    const roomId = currentRoom.value?.roomId
    if (roomId) {
      await matrixClientService.sendMessage(roomId, {
        body: text,
        msgtype: 'm.text'
      })
    } else {
      console.error('❌ No Matrix room ID available for sending message')
      throw new Error('No Matrix room ID available')
    }

    // Stop typing indicator when message is sent
    await stopTyping()
  } catch (error) {
    console.error('❌ Failed to send message:', error)
    // Show error to user but don't manipulate messages array
    quasar.notify({
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

// Show chat help dialog
const showChatHelp = () => {
  // Get the homeserver URL from environment
  const homeserverUrl = getEnv('MATRIX_HOMESERVER_URL')

  quasar.dialog({
    title: 'Chat Help - Use Other Element Clients',
    message: `
      <div style="text-align: left;">
        <p><strong>Did you know?</strong> You can use other Matrix/Element clients to access this chat from your phone or computer:</p>
        
        <p><strong>Mobile Apps:</strong></p>
        <ul>
          <li><strong>Element:</strong> Available on iOS and Android app stores</li>
          <li><strong>FluffyChat:</strong> Alternative client for mobile</li>
          <li><strong>SchildiChat:</strong> Enhanced Element fork</li>
        </ul>
        
        <p><strong>Desktop Apps:</strong></p>
        <ul>
          <li><strong>Element Desktop:</strong> Available for Windows, Mac, and Linux</li>
          <li><strong>Nheko:</strong> Lightweight desktop client</li>
        </ul>
        
        <p><strong>How to connect:</strong></p>
        <ol>
          <li>Download and install any Matrix/Element client</li>
          <li><strong>Set the homeserver to:</strong> <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">${homeserverUrl}</code></li>
          <li><strong>Sign in using your OpenMeet credentials</strong> (same username/email and password you use for OpenMeet)</li>
          <li>Look for your event/group chatrooms in the room list</li>
        </ol>
        
        <p><em>Your messages will sync across all clients!</em></p>
        <p><small><strong>Note:</strong> Make sure to use the correct homeserver URL above - this connects you to OpenMeet's Matrix server.</small></p>
      </div>
    `,
    html: true,
    ok: 'Got it',
    class: 'chat-help-dialog'
  })
}

// Room joining is now handled in the unified reconnect function

// Typing indicator state
const isTyping = ref(false)
const typingTimer = ref<number | null>(null)

const handleTyping = async () => {
  const roomId = currentRoom.value?.roomId
  if (!isConnected.value || !roomId) return

  try {
    // Only send typing if we weren't already typing
    if (!isTyping.value) {
      await matrixClientService.sendTyping(roomId, true, 10000) // 10 second timeout
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
  const roomId = currentRoom.value?.roomId
  if (!isConnected.value || !roomId || !isTyping.value) return

  try {
    await matrixClientService.sendTyping(roomId, false)
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

const downloadFile = async (url: string, filename: string) => {
  try {
    console.log('📥 Starting file download:', { url, filename })

    // Get Matrix access token for direct authentication (Element Web approach)
    const client = matrixClientService.getClient()
    const accessToken = client?.getAccessToken()

    if (!accessToken) {
      throw new Error('No Matrix access token available')
    }

    console.log('🔑 Using direct token auth, token available:', !!accessToken)

    // Make authenticated request directly to Matrix server
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    // Get the blob data
    const blob = await response.blob()

    // Create blob URL and download
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()

    // Clean up blob URL
    URL.revokeObjectURL(blobUrl)

    console.log('✅ File download completed:', filename)
  } catch (error) {
    console.error('❌ File download failed:', error)
    // Fallback to direct link
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }
}

const previewFile = async (content: { url?: string; filename?: string; mimetype?: string }) => {
  if (!content.url || !content.filename) {
    console.warn('Missing file URL or filename for preview')
    return
  }

  const fileUrl = getFileUrl(content.url)
  console.log('📎 Previewing file:', {
    originalUrl: content.url,
    convertedUrl: fileUrl,
    filename: content.filename,
    mimetype: content.mimetype
  })

  if (!fileUrl) {
    console.error('❌ Failed to convert file URL for preview')
    return
  }

  try {
    // Get Matrix access token for authenticated preview
    const client = matrixClientService.getClient()
    const accessToken = client?.getAccessToken()

    if (!accessToken) {
      throw new Error('No Matrix access token available')
    }

    console.log('🔑 Using authenticated preview for file:', content.filename)

    // Fetch file with authentication
    const response = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Preview failed: ${response.status} ${response.statusText}`)
    }

    // Get the blob data
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    // For images, show in a dialog
    if (content.mimetype?.startsWith('image/')) {
      showImageModal(blobUrl)
      // Clean up blob URL after a delay to allow image to load
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
      return
    }

    // For text files and other previewable content, open in new tab
    window.open(blobUrl, '_blank')

    // Clean up blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)
  } catch (error) {
    console.error('❌ File preview failed:', error)
    quasar.notify({
      type: 'negative',
      message: 'Failed to preview file: ' + (error instanceof Error ? error.message : 'Unknown error'),
      timeout: 3000
    })
  }
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
      const roomId = currentRoom.value?.roomId
      if (roomId) {
        await matrixClientService.sendReadReceipt(roomId, lastOtherMessage.id)
      }
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

    const room = currentRoom.value
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
      for (const [userId, readPosition] of Array.from(userReadPositions.entries())) {
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

  try {
    console.log('🔄 Attempting to reconnect Matrix client...')

    // First try to refresh the Matrix token
    try {
      await matrixClientManager.refreshMatrixToken()
      console.log('✅ Matrix token refreshed successfully')
    } catch (tokenError) {
      console.warn('⚠️ Token refresh failed, continuing with existing token:', tokenError)
    }

    // Check if Matrix client is already available and just needs to reconnect
    if (matrixClientService.isReady()) {
      console.log('🔌 Matrix client already ready, just updating connection status')
      roomName.value = props.contextType === 'event' ? 'Event Chatroom' : props.contextType === 'group' ? 'Group Chatroom' : `${props.contextType} Chat`

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

    // After successful Matrix connection, ensure we're invited to the chat room
    if (props.contextType === 'event' && props.contextId) {
      try {
        console.log('🎪 Joining event chat room using Matrix-native approach')
        const result = await matrixClientService.joinEventChatRoom(props.contextId)
        console.log('✅ Event chat room joined successfully:', result.roomInfo)
        // Force Matrix client to sync to pick up new invitation
        await matrixClientService.forceSyncAfterInvitation('event', props.contextId)
        // Update current room to use the actual room ID from join result
        if (result.room?.roomId) {
          console.log('🏠 Using actual room ID from join result:', result.room.roomId)
          currentRoom.value = result.room
          // Load messages with the correct room ID
          await loadMessages()
        } else {
          // Fallback: update current room state and load messages
          await updateCurrentRoom()
          await loadMessages()
        }
      } catch (error) {
        console.error('❌ EXCEPTION: Failed to join event chat room')
        console.error('❌ Error details:', error)
        console.error('❌ Error message:', error.message)

        // Check if this is a Matrix authentication requirement error
        const errorMessage = error.message || ''
        if (errorMessage.includes('has not authenticated with Matrix') ||
            errorMessage.includes('must complete Matrix authentication')) {
          console.log('🔑 User needs Matrix authentication before accessing chat')
          // Don't throw - this is a normal flow that requires authentication
        } else {
          // Other errors - log but don't break the connection
          console.warn('⚠️ Non-authentication error joining event chat room')
        }
      }
    }

    if (props.contextType === 'group' && props.contextId) {
      try {
        console.log(`🎯 Joining group chat room using Matrix-native approach: ${props.contextId}`)
        const result = await matrixClientService.joinGroupChatRoom(props.contextId)
        console.log('✅ Group chat room joined successfully:', result.roomInfo)
        // Force Matrix client to sync to pick up new invitation
        await matrixClientService.forceSyncAfterInvitation('group', props.contextId)
        // Update current room to use the actual room ID from join result
        if (result.room?.roomId) {
          console.log('🏠 Using actual room ID from join result:', result.room.roomId)
          currentRoom.value = result.room
          // Load messages with the correct room ID
          await loadMessages()
        } else {
          // Fallback: update current room state and load messages
          await updateCurrentRoom()
          await loadMessages()
        }
      } catch (error) {
        console.warn('⚠️ Failed to join group chat room (continuing anyway):', error)
        // Don't throw - connection to Matrix itself succeeded
      }
    }

    lastAuthError.value = '' // Clear any previous errors
    roomName.value = `${props.contextType} Chat`

    // Reload messages if we have a room ID
    if (props.roomId) {
      await loadMessages()
      await scrollToBottom()
    }
  } catch (error: unknown) {
    console.error('❌ Failed to connect Matrix client:', error)

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

const clearMatrixSessions = async () => {
  try {
    console.log('🧹 User requested Matrix session clearing...')

    // Show confirmation dialog
    const confirmed = confirm(
      'This will clear all Matrix sessions and require you to sign in again. ' +
      'This can help fix authentication and message history issues. Continue?'
    )

    if (!confirmed) {
      return
    }

    // Clear all Matrix sessions via service
    await matrixClientService.clearAllMatrixSessions()

    // Reset component state
    isConnecting.value = false
    messages.value = []

    console.log('✅ Matrix sessions cleared, user will need to re-authenticate')
    alert('Matrix sessions cleared successfully! Please refresh the page to sign in again.')
  } catch (error) {
    console.error('❌ Failed to clear Matrix sessions:', error)
    alert('Failed to clear Matrix sessions. Please try again or contact support.')
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

  // Listen for sync state changes to retry loading messages
  client.on(ClientEvent.Sync, handleSyncStateChange)
  customEventListeners.push(() => client.off(ClientEvent.Sync, handleSyncStateChange))

  const handleTimelineEvent = (event: MatrixEvent, room: Room, toStartOfTimeline: boolean) => {
    // Match room by ID or alias - props.roomId might be alias, room.roomId is always actual ID
    const isMatchingRoom = room.roomId === props.roomId ||
                          room.getCanonicalAlias() === props.roomId ||
                          room.getAltAliases().includes(props.roomId)

    if (!isMatchingRoom || toStartOfTimeline) {
      return // Only handle live events for this room
    }

    const eventType = event.getType()
    if (eventType !== 'm.room.message' && eventType !== 'm.room.redaction') {
      return // Only handle message and redaction events
    }

    console.log('📨 Matrix timeline event received for room:', props.roomId, 'type:', eventType)

    // Handle redaction events (message deletions)
    if (eventType === 'm.room.redaction') {
      const redactedEventId = event.getContent().redacts
      if (redactedEventId) {
        console.log('🗑️ Processing redaction for message:', redactedEventId)
        // Remove the message from the UI
        messages.value = messages.value.filter(msg => msg.id !== redactedEventId)
        console.log('✅ Message removed from UI after redaction')
      }
      return
    }

    // Process regular message events
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
      status: senderId === currentUserId ? 'sent' as const : 'read' as const
    }

    // Check if message already exists to prevent duplicates
    if (messages.value.find(msg => msg.id === newMessage.id)) {
      console.log('⚠️ Message already exists, skipping duplicate:', newMessage.id)
      return
    }

    // Add message to the UI
    messages.value.push(newMessage)
    console.log('✅ New message added to UI:', newMessage.id)

    // Load authenticated image if it's an image message
    if (newMessage.type === 'image') {
      loadAuthenticatedImage(newMessage)
    }

    // Auto-scroll to new message
    nextTick(() => {
      scrollToBottom(true)
    })
  }

  // Re-enabled timeline event listener for real-time message updates
  console.log('🎧 Setting up timeline event listener for room:', props.roomId)
  client.on(RoomEvent.Timeline, handleTimelineEvent)
  customEventListeners.push(() => client.off(RoomEvent.Timeline, handleTimelineEvent))

  console.log('✅ Direct Matrix SDK event listeners set up')
}

// Load older messages with pagination
const loadOlderMessages = async () => {
  if (isLoadingOlderMessages.value || !hasMoreHistory.value) {
    console.log('⚠️ Already loading older messages or no more history available')
    return
  }

  console.log('📜 Loading older messages with increased limit')
  isLoadingOlderMessages.value = true

  try {
    const previousMessageCount = messages.value.length
    const newLimit = currentHistoryLimit.value + 25 // Load 25 more messages

    console.log(`🔄 Loading room history with limit ${newLimit} (currently have ${previousMessageCount} messages)`)

    // Skip waitForRoomReady if sync is stuck - try to get room directly
    const client = matrixClientService.getClient()
    if (!client) {
      console.warn('⚠️ No Matrix client available')
      return
    }

    const room = currentRoom.value
    if (!room) {
      console.warn('⚠️ Room not available for loading older messages:', props.roomId)
      console.log('🔍 Available rooms:', client.getRooms().map(r => r.roomId))
      return
    }

    console.log(`✅ Got room directly (sync state: ${client.getSyncState()})`)

    // Use the loadRoomHistory method with increased limit
    const events = await matrixClientService.loadRoomHistory(props.roomId, newLimit)

    if (events.length === 0) {
      console.log('📭 No messages found in room history')
      hasMoreHistory.value = false
      return
    }

    // Convert Matrix events to our Message format
    const formattedMessages = events.map(event => {
      const content = event.getContent()
      const sender = event.getSender()
      const senderName = event.sender?.name || sender || 'Unknown'
      const currentUser = matrixClientService.getClient()?.getUserId()

      return {
        id: event.getId() || `${event.getTs()}-${sender}`,
        type: content.msgtype === 'm.image' ? 'image' as const : 'text' as const,
        sender: {
          id: sender || 'unknown',
          name: senderName,
          avatar: event.sender?.getAvatarUrl(matrixClientService.getClient()?.baseUrl || '', 32, 32, 'crop', false, false) || undefined
        },
        content: {
          body: content.body || '',
          url: content.url,
          filename: content.body,
          mimetype: content.info?.mimetype,
          size: content.info?.size
        },
        timestamp: new Date(event.getTs()),
        isOwn: sender === currentUser,
        status: 'sent' as const
      }
    })

    messages.value = formattedMessages
    currentHistoryLimit.value = newLimit

    // Check if we loaded new messages
    if (formattedMessages.length === previousMessageCount) {
      console.log('📭 No new messages loaded - reached end of history')
      hasMoreHistory.value = false
    } else {
      console.log(`📨 Loaded ${formattedMessages.length - previousMessageCount} new older messages`)
    }
  } catch (error) {
    console.error('❌ Failed to load older messages:', error)
  } finally {
    isLoadingOlderMessages.value = false
  }
}

// Prevent duplicate loading
const isLoading = ref(false)

const loadMessages = async () => {
  if (isLoading.value) {
    console.log('⚠️ Already loading messages, skipping duplicate call')
    return
  }

  console.log('🏗️ DEBUG: Starting loadMessages(), setting isLoading=true')
  console.log('🏗️ DEBUG: Current Matrix client sync state:', matrixClientService.getClient()?.getSyncState())
  isLoading.value = true

  // Clear messages immediately when switching rooms for better UX
  messages.value = []

  try {
    console.log('🏗️ Phase 2: Loading messages with Element-web pattern for room:', props.roomId)

    // Element-web pattern: Work with SYNCING state, don't wait for PREPARED
    const client = matrixClientService.getClient()
    if (!client) {
      console.warn('⚠️ No Matrix client available')
      return
    }

    const syncState = client.getSyncState()
    console.log(`🔄 Matrix client sync state: ${syncState}`)

    // Be more lenient with sync states - sometimes the client works even when not in perfect state
    const workingStates = ['SYNCING', 'PREPARED', 'CATCHUP', 'RECONNECTING', 'STOPPED']
    if (!workingStates.includes(syncState || '')) {
      console.warn(`⚠️ Matrix client not in working state: ${syncState}, but attempting to proceed anyway`)
      // Don't return early - try to load messages anyway
    }

    // Get room directly without waiting for PREPARED state
    const room = currentRoom.value
    if (!room) {
      console.warn('⚠️ Room not available:', props.roomId)
      const availableRooms = client.getRooms()
      console.log('🏗️ DEBUG: Available rooms:', availableRooms.map(r => r.roomId))
      console.log('❌ Expected room not found, attempting to join room')

      // Try to join the room if it's not available
      try {
        console.log('🔄 Attempting to join room:', props.roomId)
        await client.joinRoom(props.roomId)
        console.log('✅ Successfully joined room, retrying message load...')
        // Give it a moment to sync
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (joinError) {
        console.warn('⚠️ Failed to join room:', joinError)
        return
      }
    }

    // Get the room again (might be newly joined)
    const finalRoom = currentRoom.value
    if (!finalRoom) {
      console.error('❌ Still no room available after join attempt:', props.roomId)
      return
    }

    console.log('✅ Room available, proceeding with message loading')
    console.log('🏗️ DEBUG: Room member count:', finalRoom.getJoinedMembers().length)

    // Load historical messages using the robust pagination method from matrixClientService
    console.log('📨 Loading historical messages with pagination support')
    let events: MatrixEvent[] = []

    // Always attempt to load historical messages to ensure history is visible
    console.log('📨 Loading historical messages with pagination to ensure history is shown...')
    try {
      // Use the service's loadRoomHistory method which handles proper pagination
      // Load at least 20 messages initially to ensure we have history to show
      const initialLoad = 20
      events = await matrixClientService.loadRoomHistory(props.roomId, initialLoad)
      console.log(`📊 Loaded ${events.length} historical messages via pagination (requested ${initialLoad})`)

      // If we got messages, update hasMoreHistory flag
      if (events.length > 0) {
        hasMoreHistory.value = true
        console.log('✅ Historical messages loaded, hasMoreHistory set to true')
      } else {
        console.log('⚠️ No historical messages loaded via pagination')
      }
    } catch (error) {
      console.warn('⚠️ Failed to load historical messages via pagination, falling back to timeline:', error)
      // Fallback - try direct timeline access
      const timeline = finalRoom.getLiveTimeline()
      const timelineEvents = timeline.getEvents().filter(event => event.getType() === 'm.room.message')
      events = timelineEvents
      console.log(`📊 Fallback: ${events.length} events from current timeline`)
    }

    const currentUserId = matrixClientService.getClient()?.getUserId()
    const roomMessages = events
      .map(event => {
        const senderId = event.getSender()
        const member = finalRoom?.getMember(senderId)
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
        otherMessages: messages.value.filter(m => !m.isOwn).length,
        oldestMessage: messages.value[0]?.timestamp,
        newestMessage: messages.value[messages.value.length - 1]?.timestamp
      })

      // Load authenticated images for all image messages
      const imageMessages = messages.value.filter(m => m.type === 'image')
      console.log(`🖼️ Loading ${imageMessages.length} authenticated images...`)
      imageMessages.forEach(message => loadAuthenticatedImage(message))
    } else {
      console.log('⚠️ No messages found after processing. Debug info:', {
        eventsCount: events.length,
        eventsTypes: events.map(e => e.getType()),
        roomId: props.roomId,
        currentUserId: matrixClientService.getClient()?.getUserId(),
        syncState: matrixClientService.getClient()?.getSyncState()
      })

      // For debugging, let's try to get more info about the room
      const roomTimeline = finalRoom.getLiveTimeline()
      console.log('🔍 Room debug info:', {
        roomMembers: finalRoom.getJoinedMembers().map(m => ({ id: m.userId, name: m.name })),
        allTimelineEvents: roomTimeline.getEvents().length,
        roomName: finalRoom.name,
        roomTopic: finalRoom.currentState?.getStateEvents('m.room.topic', '')?.getContent()?.topic
      })

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

// Add a retry mechanism for loading messages when sync state changes
const handleSyncStateChange = async (state: string) => {
  console.log('🔄 Matrix sync state changed to:', state)
  if (state === 'PREPARED' && props.roomId) {
    // If room resolution failed before, retry now that sync is complete
    if (!currentRoom.value) {
      console.log('🔄 Sync completed, retrying room resolution for:', props.roomId)
      await updateCurrentRoom()
    }

    // If no messages loaded yet, retry loading them
    if (messages.value.length === 0) {
      console.log('🔄 Sync completed and no messages loaded yet, retrying loadMessages')
      await loadMessages()
      await scrollToBottom()
    }
  }
}

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

// Handle file upload when a file is selected
watch(selectedFile, async (newFile) => {
  console.log('🔍 File watcher triggered:', { newFile: newFile?.name, roomId: props.roomId })

  if (!newFile || !props.roomId) {
    console.log('⚠️ File upload cancelled - missing file or room ID')
    return
  }

  console.log('📎 Starting file upload process:', {
    fileName: newFile.name,
    fileSize: newFile.size,
    fileType: newFile.type,
    roomId: props.roomId
  })

  isSending.value = true

  try {
    console.log('🔄 Checking Matrix client availability...')

    // Check if Matrix client is available
    const client = matrixClientService.getClient()
    console.log('🔍 Matrix client check result:', { hasClient: !!client })

    if (!client) {
      console.error('❌ Matrix client not available')
      throw new Error('Matrix client not available - please connect to Matrix first')
    }

    console.log('🔑 Matrix client status:', {
      hasClient: !!client,
      isLoggedIn: client.isLoggedIn(),
      userId: client.getUserId(),
      baseUrl: client.getHomeserverUrl()
    })

    console.log('📤 About to call uploadAndSendFile...')
    const result = await matrixClientService.uploadAndSendFile(props.roomId, newFile)
    console.log('✅ uploadAndSendFile completed, result:', result)
    console.log('✅ File uploaded successfully!')

    // Clear the selected file
    selectedFile.value = null
  } catch (error) {
    console.error('❌ Failed to upload file:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    })

    quasar.notify({
      type: 'negative',
      message: 'Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'),
      timeout: 3000
    })
  } finally {
    isSending.value = false
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
      lastAuthError.value = '' // Clear any previous errors
      roomName.value = props.contextType === 'event' ? 'Event Chatroom' : props.contextType === 'group' ? 'Group Chatroom' : `${props.contextType} Chat`

      // Set up service-based event listeners for real-time updates
      setupServiceEventListeners()

      // Load messages only if we have a room ID
      if (props.roomId) {
        await loadMessages()
        await scrollToBottom()
        messagesLoaded = true
      }
    } else {
      // Try to initialize Matrix connection (but don't force auth)
      try {
        await matrixClientService.initializeClient()
      } catch (authError) {
        console.log('🔑 Matrix client needs authentication:', authError.message)
        // Don't throw - just log and show connect button to user
        lastAuthError.value = '' // Clear error to show connect button
        isConnecting.value = false
        return // Exit early to show connect button
      }

      // After successful Matrix connection, ensure we're invited to the chat room
      // This handles cases where the bot invitation failed during RSVP
      if (props.contextType === 'event' && props.contextId) {
        try {
          const result = await matrixClientService.joinEventChatRoom(props.contextId)
          // Force Matrix client to sync to pick up new invitation
          await matrixClientService.forceSyncAfterInvitation('event', props.contextId)
          // Update current room to use the actual room ID from join result
          if (result.room?.roomId) {
            console.log('🏠 Using actual room ID from join result:', result.room.roomId)
            currentRoom.value = result.room
            // Load messages with the correct room ID
            await loadMessages()
          } else {
            // Fallback: update current room state and load messages
            await updateCurrentRoom()
            await loadMessages()
          }
        } catch (error) {
          console.warn('Failed to join event chat room:', error)
          // Don't throw - connection to Matrix itself succeeded
        }
      } else if (props.contextType === 'group' && props.contextId) {
        try {
          const result = await matrixClientService.joinGroupChatRoom(props.contextId)
          // Force Matrix client to sync to pick up new invitation
          await matrixClientService.forceSyncAfterInvitation('group', props.contextId)
          // Update current room to use the actual room ID from join result
          if (result.room?.roomId) {
            console.log('🏠 Using actual room ID from join result:', result.room.roomId)
            currentRoom.value = result.room
            // Load messages with the correct room ID
            await loadMessages()
          } else {
            // Fallback: update current room state and load messages
            await updateCurrentRoom()
            await loadMessages()
          }
        } catch (error) {
          console.warn('Failed to join group chat room:', error)
          // Don't throw - connection to Matrix itself succeeded
        }
      }

      lastAuthError.value = '' // Clear any previous errors
      roomName.value = props.contextType === 'event' ? 'Event Chatroom' : props.contextType === 'group' ? 'Group Chatroom' : `${props.contextType} Chat`

      // Set up service-based event listeners for real-time updates
      setupServiceEventListeners()

      // Load messages if we have a room ID and we haven't loaded them already
      if (props.roomId && !messagesLoaded) {
        await loadMessages()
        await scrollToBottom()
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize Matrix chat:', error)
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
  max-width: 70%;
  min-width: 0;
  flex: 0 1 auto;
}

/* Base message body styles */
.message-body {
  padding: 0.75rem 1rem;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Own message styling */
.own-message-item .message-body {
  background: var(--q-primary) !important;
  color: white !important;
  border-radius: 1rem 1rem 0.25rem 1rem !important;
}

/* Other users' message styling */
.other-message-item .message-body {
  background: #AF9EE8 !important;
  color: white !important;
  border-radius: 0.25rem 1rem 1rem 1rem !important;
  border: 1px solid rgba(0, 0, 0, 0.12) !important;
}

/* Dark mode overrides */
.q-dark .other-message-item .message-body {
  background: #4A3F66 !important;
  color: white !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

.q-dark .own-message-item .message-body {
  background: #1976d2 !important;
  color: white !important;
}

/* Dark mode text visibility fixes */
.q-dark .message-time {
  color: rgba(255, 255, 255, 0.7) !important;
}

.q-dark .sender-name {
  color: rgba(255, 255, 255, 0.9) !important;
}

.q-dark .matrix-id-subscript {
  color: rgba(255, 255, 255, 0.6) !important;
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

/* Improved Message Styling */
.message-item {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  align-items: flex-start;
}

.own-message-item {
  flex-direction: row-reverse;
  margin-left: 20%;
  justify-content: flex-start;
}

.other-message-item {
  flex-direction: row;
  margin-right: 20%;
  justify-content: flex-start;
}

.message-avatar {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 0.25rem;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.message-content {
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.sender-name {
  margin-bottom: 0.25rem;
}

.sender-display-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.message-time {
  opacity: 0.7;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.message-text {
  word-wrap: break-word;
  line-height: 1.4;
}

.text-message {
  position: relative;
}

.message-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.file-card {
  border-radius: 8px;
  background: #4238A6; /* Purple-500 from palette for white text readability */
  border: 1px solid #4238A6;
  max-width: 300px;
  transition: all 0.2s ease;
  color: white; /* White text for readability on dark background */
}

.file-card:hover {
  background: #5b4fc7; /* Slightly lighter purple on hover */
  border-color: #5b4fc7;
}

.file-name {
  font-weight: 500;
  word-break: break-word;
}

.file-actions {
  display: flex;
  gap: 0.25rem;
}

/* Authenticated image styling */
.authenticated-image-container {
  max-width: 400px;
}

.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  min-height: 150px;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  margin: 0.5rem 0;
}

.message-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.message-image:hover {
  transform: scale(1.02);
}

/* Dark mode support - duplicate rule removed */

.q-dark .avatar-fallback {
  border-color: rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Light mode avatar improvements */
.avatar-fallback {
  border: 2px solid rgba(0, 0, 0, 0.1);
}

.q-dark .avatar-fallback {
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.q-dark .file-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.q-dark .file-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

</style>
