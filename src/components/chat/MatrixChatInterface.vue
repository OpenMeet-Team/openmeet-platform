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
              <q-item clickable v-close-popup @click="checkEncryptionStatus">
                <q-item-section avatar>
                  <q-icon name="sym_r_verified" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Check Encryption Status</q-item-label>
                  <q-item-label caption>View Matrix encryption details</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="showChatHelp">
                <q-item-section avatar>
                  <q-icon name="sym_r_help" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Chat Help</q-item-label>
                  <q-item-label caption>Use other Matrix clients</q-item-label>
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

      <!-- Historical Message Encryption Handler -->
      <HistoricalMessageHandler
        v-if="isConnected"
        :auto-prompt="true"
        :show-status="true"
        :room-id="props.roomId"
      />

      <!-- Experimental Encryption Warning -->
      <q-banner
        v-if="isConnected && isRoomEncrypted"
        class="bg-orange-1 text-orange-9 q-mb-md"
        rounded
        dense
      >
        <template v-slot:avatar>
          <q-icon name="sym_r_warning" color="orange" />
        </template>
        <div class="text-body2">
          <strong>⚠️ Experimental Encrypted Chat</strong>
        </div>
        <div class="text-caption q-mt-xs">
          This encrypted chat room is experimental. Message loss may occur and some features may not work properly.
        </div>
      </q-banner>

      <!-- Messages -->
      <div v-if="isConnected && debugTimelineEvents.length > 0" class="messages-list" data-cy="messages-list">
        <!-- Load More History Button -->
        <div class="load-more-history text-center q-pa-md">
          <q-btn
            v-if="!isPaginatingBack && canPaginateBack"
            @click="paginateBackward"
            label="Load More History"
            icon="sym_r_keyboard_arrow_up"
            color="primary"
            outline
            size="sm"
            dense
            data-cy="load-more-history-btn"
          />
          <div v-if="isPaginatingBack" class="loading-older-messages text-center q-pa-sm">
            <q-spinner size="20px" color="primary" />
            <div class="text-caption text-grey-6 q-mt-xs">Loading older messages...</div>
          </div>
          <div v-if="!canPaginateBack && timelineEvents.length > 4" class="text-caption text-grey-6">
            No more history available
          </div>
        </div>

        <!-- Loading indicator for initial messages -->
        <div v-if="isTimelineLoading && timelineEvents.length === 0" class="loading-older-messages text-center q-pa-md">
          <q-spinner size="20px" color="primary" />
          <div class="text-caption text-grey-6 q-mt-xs">Loading messages...</div>
        </div>

        <!-- Timeline Events with Date Separators -->
        <template v-for="(item) in timelineWithDateSeparators" :key="item.key">
          <!-- Date Separator -->
          <div v-if="item.type === 'date'" class="date-separator q-my-md">
            <div class="date-separator-line">
              <div class="date-separator-text text-caption text-grey-6 q-px-sm">
                {{ item.dateText }}
              </div>
            </div>
          </div>

          <!-- Event Tile -->
          <EventTile
            v-else
            :mxEvent="item.event as MatrixEvent"
            :mode="mode"
            :showSenderNames="showSenderNames"
            :currentUserId="matrixClientService.getClient()?.getUserId()"
            :currentRoom="currentRoom"
            :decryptionCounter="decryptionCounter"
            @deleteMessage="handleDeleteMessage"
          />
        </template>
      </div>

      <!-- Empty State with Load More History -->
      <div v-else-if="isConnected && debugTimelineEvents.length === 0" class="empty-state text-center q-pa-lg">
        <!-- Load More History Button (show even when no messages) -->
        <div v-if="isConnected" class="load-more-history text-center q-pa-md">
          <q-btn
            v-if="!isPaginatingBack && canPaginateBack"
            @click="paginateBackward"
            label="Load More History"
            icon="sym_r_keyboard_arrow_up"
            color="primary"
            outline
            size="sm"
            dense
            data-cy="load-more-history-btn"
          />
          <div v-if="isPaginatingBack" class="loading-older-messages text-center q-pa-sm">
            <q-spinner size="20px" color="primary" />
            <div class="text-caption text-grey-6 q-mt-xs">Loading older messages...</div>
          </div>
          <div v-if="!canPaginateBack" class="text-caption text-grey-6 q-mb-md">
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

    <!-- Recovery Key Dialog -->
    <q-dialog
      v-model="showRecoveryKeyDialog"
      persistent
      maximized
      transition-show="slide-up"
      transition-hide="slide-down"
    >
      <q-card class="recovery-key-dialog">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            <q-icon name="sym_r_key" color="orange" class="q-mr-sm" />
            Save Your New Recovery Key
          </div>
        </q-card-section>

        <q-card-section>
          <div class="recovery-key-content">
            <div class="text-body1 q-mb-md">
              <strong>Your encryption has been reset!</strong>
              Here's your new recovery key - you'll need this to unlock your encrypted messages if you forget your passphrase.
            </div>

            <q-banner class="bg-orange-1 text-orange-8 q-mb-md">
              <template v-slot:avatar>
                <q-icon name="sym_r_warning" color="orange" />
              </template>
              <strong>Important:</strong> Store this key safely in your password manager.
              You won't see it again and you'll need it to recover your messages!
            </q-banner>

            <q-card flat class="recovery-key-card q-mb-md">
              <q-card-section>
                <div class="recovery-key-text">{{ recoveryKey }}</div>
                <div class="recovery-key-actions q-mt-md">
                  <q-btn
                    flat
                    color="primary"
                    icon="sym_r_content_copy"
                    label="Copy Key"
                    @click="copyRecoveryKey"
                    class="q-mr-sm"
                  />
                  <q-btn
                    flat
                    color="grey-7"
                    icon="sym_r_download"
                    label="Download"
                    @click="downloadRecoveryKey"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-checkbox
              v-model="recoveryKeySaved"
              color="green"
              label="I have saved my recovery key safely"
              class="q-mb-md"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            unelevated
            color="green"
            label="Continue"
            @click="closeRecoveryKeyDialog"
            :disable="!recoveryKeySaved"
            icon="sym_r_check"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useQuasar } from 'quasar'
import { format, isToday, isYesterday, isSameDay } from 'date-fns'
import { MatrixEvent, Room, ClientEvent, RoomEvent, MatrixEventEvent } from 'matrix-js-sdk'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import { matrixClientService } from '../../services/matrixClientService'
import { matrixClientManager } from '../../services/MatrixClientManager'
import { matrixEncryptionService } from '../../services/MatrixEncryptionManager'
import getEnv from '../../utils/env'
import { logger } from '../../utils/logger'
import HistoricalMessageHandler from './encryption/HistoricalMessageHandler.vue'
import EventTile from './EventTile.vue'
import { useMatrixTimeline } from '../../composables/useMatrixTimeline'

// Add type declaration for global window property
declare global {
  interface Window {
    matrixRetryAfter?: number;
  }
}

// Message interface removed - now working directly with MatrixEvent objects

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
const typingUsers = ref<{ userId: string, userName: string }[]>([])

// Recovery key dialog state
const showRecoveryKeyDialog = ref(false)
const recoveryKey = ref('')
const recoveryKeySaved = ref(false)

// Connection state tracking

const isConnected = computed(() => {
  const client = matrixClientService.getClient()
  const isReady = matrixClientService.isReady()
  const isLoggedIn = client?.isLoggedIn() ?? false

  // Consider connected if we have a resolved room and no auth errors
  // This handles cases where Matrix client restarts but we're still functional
  const hasResolvedRoom = !!currentRoom.value
  const noAuthErrors = !lastAuthError.value

  const result = (isReady && isLoggedIn) || (hasResolvedRoom && noAuthErrors)

  // Debug logging
  logger.debug('🔍 isConnected computed:', {
    client: !!client,
    isReady,
    isLoggedIn,
    hasResolvedRoom,
    noAuthErrors,
    result,
    timelineEvents: timelineEvents.value.length
  })

  return result
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

// Matrix Timeline - Following Element Web's TimelineWindow pattern
// Removed - currentUserId is accessed directly where needed
// Room resolution with proper alias handling
const resolvedRoomId = ref<string | null>(null)
const isResolvingRoom = ref(false)

const currentRoom = computed(() => {
  const client = matrixClientService.getClient()
  if (!client || !resolvedRoomId.value) return null
  return matrixClientService.getRoom(resolvedRoomId.value)
})

// Check if the current room is encrypted
const isRoomEncrypted = computed(() => {
  const room = currentRoom.value
  if (!room) return false

  const client = matrixClientService.getClient()
  if (!client) return false

  // Check if the room has encryption enabled
  return client.isRoomEncrypted(room.roomId)
})

// Function to resolve room alias to room ID and join if needed
const updateCurrentRoom = async () => {
  if (!props.roomId || isResolvingRoom.value) return

  const client = matrixClientService.getClient()
  if (!client) return

  isResolvingRoom.value = true

  try {
    let roomId = props.roomId

    // If it's a room alias (starts with #), resolve it first
    if (props.roomId.startsWith('#')) {
      logger.debug('🔍 Resolving room alias:', props.roomId)
      const aliasResult = await client.getRoomIdForAlias(props.roomId)
      roomId = aliasResult.room_id
      logger.debug('✅ Room alias resolved:', { alias: props.roomId, roomId })
    }

    // Check if we're already in the room
    let room = matrixClientService.getRoom(roomId)
    if (!room) {
      logger.debug('🚪 Room not found, attempting to join:', roomId)
      room = await matrixClientService.joinRoom(roomId)
      logger.debug('✅ Successfully joined room:', roomId)
    }

    resolvedRoomId.value = roomId
    logger.debug('🏠 Room resolved and available:', { roomId, hasRoom: !!room })
  } catch (error) {
    logger.error('❌ Failed to resolve/join room:', error)
    resolvedRoomId.value = null
  } finally {
    isResolvingRoom.value = false
  }
}

// Timeline reactive refs for proper composable integration
const timelineClient = computed(() => matrixClientService.getClient())
const timelineSet = computed(() => currentRoom.value?.getUnfilteredTimelineSet())

// Initialize timeline composable with empty options initially
// We'll manually initialize when client and timeline set become available
const {
  events: timelineEvents,
  isLoading: isTimelineLoading,
  canPaginateBack,
  isPaginatingBack,
  decryptionCounter,
  initializeTimeline,
  loadOlderMessages: paginateBackward,
  refreshEvents
} = useMatrixTimeline({
  windowLimit: 50 // Reduced from 1000 to improve initial load performance
})

// Initialize timeline only once when dependencies are first available
let timelineInitialized = false
watch([timelineClient, timelineSet], async ([newClient, newTimelineSet]) => {
  if (newClient && newTimelineSet && !timelineInitialized) {
    logger.debug('🚀 Initializing timeline for the first time')
    try {
      await initializeTimeline(undefined, newClient, newTimelineSet)
      timelineInitialized = true
      logger.debug('✅ Timeline initialization completed successfully')
    } catch (error) {
      logger.error('❌ Timeline initialization failed:', error)
    }
  }
}, { immediate: true })

// Debug room resolution
watch(currentRoom, (newRoom) => {
  logger.debug('🏠 currentRoom changed:', {
    hasRoom: !!newRoom,
    roomId: newRoom?.roomId,
    propsRoomId: props.roomId
  })
}, { immediate: true })

// Debug timeline events changes
watch(timelineEvents, (newEvents, oldEvents) => {
  logger.debug('📊 timelineEvents changed:', {
    newCount: newEvents.length,
    oldCount: oldEvents?.length,
    lastEventId: newEvents[newEvents.length - 1]?.getId(),
    lastEventType: newEvents[newEvents.length - 1]?.getType(),
    isConnected: isConnected.value,
    shouldShowMessagesList: isConnected.value && newEvents.length > 0
  })
}, { immediate: true })

// Use timeline events directly - no need for debug wrapper
const debugTimelineEvents = timelineEvents

// Timeline with date separators
interface TimelineItem {
  type: 'event' | 'date'
  key: string
  event?: MatrixEvent
  dateText?: string
  date?: Date
}

interface TimelineEventItem extends TimelineItem {
  type: 'event'
  event: MatrixEvent
}

interface TimelineDateItem extends TimelineItem {
  type: 'date'
  dateText: string
  date: Date
}

const timelineWithDateSeparators = computed((): (TimelineEventItem | TimelineDateItem)[] => {
  const events = debugTimelineEvents.value
  if (events.length === 0) return []

  const result: (TimelineEventItem | TimelineDateItem)[] = []
  let lastDate: Date | null = null

  for (const event of events) {
    const eventDate = new Date(event.getTs())

    // Check if we need a date separator
    if (!lastDate || !isSameDay(eventDate, lastDate)) {
      // Format the date text
      let dateText: string
      if (isToday(eventDate)) {
        dateText = 'Today'
      } else if (isYesterday(eventDate)) {
        dateText = 'Yesterday'
      } else {
        dateText = format(eventDate, 'EEEE, MMMM d, yyyy')
      }

      // Add date separator
      result.push({
        type: 'date',
        key: `date-${format(eventDate, 'yyyy-MM-dd')}`,
        dateText,
        date: eventDate
      } as TimelineDateItem)

      lastDate = eventDate
    }

    // Add the event
    result.push({
      type: 'event',
      key: `${event.getId()}-${decryptionCounter.value}`,
      event
    } as TimelineEventItem)
  }

  return result
})

// Use Matrix client service directly for real Matrix integration

// Refs
const messagesContainer = ref<HTMLElement>()
const messageInput = ref()
const fileInput = ref()
const countdownTimer = ref<ReturnType<typeof setInterval> | null>(null)

// Custom event listeners tracking for cleanup
let customEventListeners: (() => void)[] = []

// resolveRoom function removed - unused

// Watch for roomId changes and resolve the room
watch(() => props.roomId, updateCurrentRoom, { immediate: true })

// Also watch for Matrix client availability
watch(() => matrixClientService.getClient(), (newClient) => {
  if (newClient) {
    logger.debug('🔌 Matrix client became available, updating room')
    updateCurrentRoom()
  }
}, { immediate: true })

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

// getImageStyle function removed - unused

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

// cleanDisplayName function removed - unused

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

  const count = timelineEvents.value.length
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

  // Check if this is a first-time setup
  const needsSetup = !matrixClientService.hasUserChosenToConnect() ||
                     matrixClientService.needsEncryptionSetup?.() || false

  return needsSetup ? 'Set Up Secure Chat' : 'Connect'
}

const hasOidcConfigError = (): boolean => {
  return lastAuthError.value.includes('OIDC authentication is not configured') ||
         lastAuthError.value.includes('404')
}

// formatTime function removed - unused

// formatFileSize function removed - unused

const formatTypingUsers = (users: { userId: string, userName: string }[]): string => {
  if (users.length === 0) return ''
  if (users.length === 1) return `${users[0].userName} is typing...`
  if (users.length === 2) return `${users[0].userName} and ${users[1].userName} are typing...`
  return `${users.length} people are typing...`
}

// getFileIcon function removed - unused

// getFileUrl function removed - unused

// Load authenticated images and create blob URLs
interface MessageWithImageBlob {
  content?: { url?: string }
  imageBlobUrl?: string
  [key: string]: unknown
}

const loadAuthenticatedImage = async (message: MessageWithImageBlob): Promise<void> => {
  if (!message.content?.url || message.imageBlobUrl) return

  try {
    const client = matrixClientService.getClient()
    const accessToken = client?.getAccessToken()

    if (!accessToken) {
      logger.error('No access token for image loading')
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
    logger.error('Failed to load authenticated image:', error)
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
      logger.error('❌ No Matrix room ID available for sending message')
      throw new Error('No Matrix room ID available')
    }

    // Stop typing indicator when message is sent
    await stopTyping()
  } catch (error) {
    logger.error('❌ Failed to send message:', error)
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
    title: 'Chat Help - Use Other Matrix Clients',
    message: `
      <div style="text-align: left;">
        <p><strong>Did you know?</strong> You can use other Matrix clients to access this chat from your phone or computer:</p>

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
      // Started typing indicator
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
    logger.warn('⚠️ Failed to send typing indicator:', error)
  }
}

const stopTyping = async () => {
  const roomId = currentRoom.value?.roomId
  if (!isConnected.value || !roomId || !isTyping.value) return

  try {
    await matrixClientService.sendTyping(roomId, false)
    isTyping.value = false
    // Stopped typing indicator

    // Clear timer
    if (typingTimer.value) {
      clearTimeout(typingTimer.value)
      typingTimer.value = null
    }
  } catch (error) {
    logger.warn('⚠️ Failed to stop typing indicator:', error)
  }
}

// showImageModal function removed - unused

// Recovery key dialog functions
const handleRecoveryKeyGenerated = (event: CustomEvent) => {
  const { recoveryKey: key, context } = event.detail
  recoveryKey.value = key
  showRecoveryKeyDialog.value = true
  recoveryKeySaved.value = false

  logger.debug('🔑 Recovery key dialog shown', { context, keyLength: key?.length })
}

const handleDeviceMismatchRecovered = (event: CustomEvent) => {
  const { oldDeviceId } = event.detail

  logger.warn('🔄 Device ID mismatch recovery detected', { oldDeviceId })

  // Show user-friendly notification about device recovery
  quasar.notify({
    type: 'warning',
    message: 'Device ID mismatch recovered',
    caption: 'Please refresh the page to use the corrected device settings and restore full functionality.',
    timeout: 10000,
    actions: [
      {
        label: 'Refresh Now',
        handler: () => window.location.reload(),
        color: 'white'
      },
      {
        label: 'Dismiss',
        handler: () => {},
        color: 'white'
      }
    ]
  })
}

const closeRecoveryKeyDialog = () => {
  if (recoveryKeySaved.value) {
    showRecoveryKeyDialog.value = false
    recoveryKey.value = ''
    recoveryKeySaved.value = false
  }
}

const copyRecoveryKey = async () => {
  try {
    await navigator.clipboard.writeText(recoveryKey.value)
    quasar.notify({
      type: 'positive',
      message: 'Recovery key copied to clipboard',
      position: 'top'
    })
  } catch (err) {
    logger.error('Failed to copy recovery key:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = recoveryKey.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    quasar.notify({
      type: 'positive',
      message: 'Recovery key copied to clipboard',
      position: 'top'
    })
  }
}

const downloadRecoveryKey = () => {
  const element = document.createElement('a')
  const file = new Blob([
    'OpenMeet Matrix Recovery Key\n',
    `Generated: ${new Date().toISOString()}\n`,
    `Room: ${roomName.value || 'Unknown'}\n`,
    '\n',
    `Recovery Key:\n${recoveryKey.value}\n`,
    '\n',
    'IMPORTANT: Store this key safely. You need it to unlock your encrypted messages if you lose access to your account.\n'
  ], { type: 'text/plain' })
  element.href = URL.createObjectURL(file)
  element.download = `openmeet-matrix-recovery-key-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  URL.revokeObjectURL(element.href)
  quasar.notify({
    type: 'positive',
    message: 'Recovery key downloaded',
    position: 'top'
  })
}

// downloadFile function removed - unused

// previewFile function removed - unused

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
    // Note: Read receipts based on timeline events not yet implemented
    // Will be added in a future iteration
    const lastOtherMessage = null

    if (lastOtherMessage && lastOtherMessage.id && lastOtherMessage.id !== lastReadReceiptSent.value) {
      const roomId = currentRoom.value?.roomId
      if (roomId) {
        await matrixClientService.sendReadReceipt(roomId, lastOtherMessage.id)
      }
      lastReadReceiptSent.value = lastOtherMessage.id
    }
  } catch (error) {
    logger.warn('⚠️ Failed to send read receipt:', error)
  }
}

const updateReadReceipts = async () => {
  // Update read receipts called
  if (!props.roomId || !isConnected.value) return

  try {
    // Update read receipts for all messages
    const currentUserId = matrixClientService.getClient()?.getUserId()
    if (!currentUserId) return

    const room = currentRoom.value
    if (!room) return

    // Optimization: Only process recent events (last 30) to avoid performance issues
    const recentEvents = timelineEvents.value.slice(-30)
    const recentEventIds = recentEvents.map(e => e.getId()).filter(Boolean)

    // Processing read receipts for recent messages

    // Get all other users in the room (exclude current user)
    const otherUsers = room.getMembers()
      .filter(member => member.userId !== currentUserId)

    // Processing room members for read receipts

    // Build a cache of all receipt data in one pass
    const receiptCache = new Map<string, Array<{ userId: string, timestamp: number }>>()

    for (const messageId of recentEventIds) {
      if (messageId && !messageId.includes('welcome')) {
        const receipts = matrixClientService.getReadReceipts(props.roomId, messageId)
        receiptCache.set(messageId, receipts)

        if (receipts.length > 0) {
          // Message has read receipts
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
      for (let i = 0; i < recentEvents.length; i++) {
        const event = recentEvents[i]
        const message = { id: event.getId() }
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

    // User read positions calculated

    // Debug: Show which users have NO read receipts
    const usersWithoutReceipts = otherUsers.filter(member => !userReadPositions.has(member.userId))
    if (usersWithoutReceipts.length > 0) {
      // Some users have no read receipts
    }

    // Apply read receipts to recent messages only
    for (let i = 0; i < recentEvents.length; i++) {
      const event = recentEvents[i]
      const message = { id: event.getId(), readReceipts: [] }
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
        // Message read by users
      }
    }
  } catch (error) {
    logger.warn('⚠️ Failed to update read receipts:', error)
  }
}

const reconnect = async () => {
  isConnecting.value = true

  try {
    // Attempting to reconnect Matrix client

    // First try to refresh the Matrix token
    try {
      await matrixClientManager.refreshMatrixToken()
      // Matrix token refreshed successfully
    } catch (tokenError) {
      logger.warn('⚠️ Token refresh failed, continuing with existing token:', tokenError)
    }

    // Check if Matrix client is already available and just needs to reconnect
    if (matrixClientService.isReady()) {
      // Matrix client already ready
      roomName.value = props.contextType === 'event' ? 'Event Chatroom' : props.contextType === 'group' ? 'Group Chatroom' : `${props.contextType} Chat`

      // Reload messages if we have a room ID
      if (props.roomId) {
        await initializeTimeline()
        await scrollToBottom()
      }
      return
    }

    // Check if user has stored credentials for reconnection
    if (matrixClientService.hasStoredSession()) {
      // Try to reconnect using stored credentials (no MAS auth flow)
      logger.debug('🔄 Attempting reconnection with stored credentials')
      await matrixClientService.initializeClient()
    } else {
      // No stored credentials - user needs to manually connect
      logger.debug('🔑 No stored credentials for reconnect, showing connect button')
      lastAuthError.value = 'Matrix connection required. Please click Connect to continue.'
      isConnecting.value = false
      return
    }
    // Matrix client connected successfully

    // After successful Matrix connection, ensure we're invited to the chat room
    if (props.contextType === 'event' && props.contextId) {
      try {
        // Joining event chat room
        const result = await matrixClientService.joinEventChatRoom(props.contextId)
        // Event chat room joined successfully
        // Force Matrix client to sync to pick up new invitation
        await matrixClientService.forceSyncAfterInvitation('event', props.contextId)
        // Update current room to use the actual room ID from join result
        if (result.room?.roomId) {
          // Using actual room ID from join result
          resolvedRoomId.value = result.room.roomId
          // Load messages with the correct room ID
          await initializeTimeline()
        } else {
          // Fallback: update current room state and load messages
          await updateCurrentRoom()
          await initializeTimeline()
        }
      } catch (error) {
        logger.error('❌ EXCEPTION: Failed to join event chat room')
        logger.error('❌ Error details:', error)
        logger.error('❌ Error message:', error.message)

        // Check if this is a Matrix authentication requirement error
        const errorMessage = error.message || ''
        if (errorMessage.includes('has not authenticated with Matrix') ||
            errorMessage.includes('must complete Matrix authentication')) {
          // User needs Matrix authentication
          // Don't throw - this is a normal flow that requires authentication
        } else {
          // Other errors - log but don't break the connection
          logger.warn('⚠️ Non-authentication error joining event chat room')
        }
      }
    }

    if (props.contextType === 'group' && props.contextId) {
      try {
        // Joining group chat room
        const result = await matrixClientService.joinGroupChatRoom(props.contextId)
        // Group chat room joined successfully
        // Force Matrix client to sync to pick up new invitation
        await matrixClientService.forceSyncAfterInvitation('group', props.contextId)
        // Update current room to use the actual room ID from join result
        if (result.room?.roomId) {
          // Using actual room ID from join result
          resolvedRoomId.value = result.room.roomId
          // Load messages with the correct room ID
          await initializeTimeline()
        } else {
          // Fallback: update current room state and load messages
          await updateCurrentRoom()
          await initializeTimeline()
        }
      } catch (error) {
        logger.warn('⚠️ Failed to join group chat room (continuing anyway):', error)
        // Don't throw - connection to Matrix itself succeeded
      }
    }

    lastAuthError.value = '' // Clear any previous errors
    roomName.value = `${props.contextType} Chat`

    // Reload messages if we have a room ID
    if (props.roomId) {
      await initializeTimeline()
      await scrollToBottom()
    }
  } catch (error: unknown) {
    logger.error('❌ Failed to connect Matrix client:', error)

    // Check for rate limiting error - handle both object and nested error formats
    const errorObj = (error as Record<string, unknown>)
    const nestedError = errorObj.errcode ? errorObj : (errorObj.data || errorObj)
    const errorMessage = (error as Error).message

    if ((nestedError as Record<string, unknown>).errcode === 'M_LIMIT_EXCEEDED' || (errorMessage && errorMessage.includes('Too Many Requests'))) {
      // FIRST: Check if rate limit was already set by Matrix client service (most reliable)
      const existingRetryTime = window.matrixRetryAfter
      logger.warn('🔍 Rate limit detected - checking existing timer:', {
        existingRetryTime,
        currentTime: Date.now(),
        hasValidExisting: !!(existingRetryTime && existingRetryTime > Date.now())
      })

      if (existingRetryTime && existingRetryTime > Date.now()) {
        // Use the existing rate limit set by Matrix client service
        const remainingMs = existingRetryTime - Date.now()
        const remainingSeconds = Math.ceil(remainingMs / 1000)
        logger.warn(`⚠️ Using Matrix client service rate limit - retry in ${remainingSeconds} seconds (${remainingMs}ms remaining)`)
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
          logger.warn(`⚠️ Rate limited - extracted from error, retry in ${retryAfterSeconds} seconds (${retryAfterMs}ms)`)
          window.matrixRetryAfter = Date.now() + retryAfterMs
          rateLimitCountdown.value = retryAfterMs
          startCountdownTimer()
        } else {
          logger.warn('⚠️ Rate limited - no retry time found anywhere, using 5 minute default')
          window.matrixRetryAfter = Date.now() + 300000 // Default to 5 minutes
          rateLimitCountdown.value = 300000
          startCountdownTimer()
        }
      }
    } else if (errorMessage && errorMessage.includes('OIDC authentication is not configured')) {
      logger.warn('⚠️ Matrix OIDC is not configured on the server')
      lastAuthError.value = errorMessage
    } else if (errorMessage && errorMessage.includes('login token')) {
      logger.warn('⚠️ Authentication failed - please refresh the page to re-authenticate')
      lastAuthError.value = errorMessage
    } else if (errorMessage && errorMessage.includes('credentials expired')) {
      logger.warn('⚠️ Session expired - please refresh the page to re-authenticate')
      lastAuthError.value = errorMessage
    }
  } finally {
    isConnecting.value = false
  }
}

const clearMatrixSessions = async () => {
  try {
    // User requested Matrix session clearing

    // Show confirmation dialog
    const confirmed = confirm(
      'This will clear all Matrix sessions and require you to sign in again. ' +
      'This can help fix authentication and message history issues. Continue?'
    )

    if (!confirmed) {
      return
    }

    // Clear all Matrix data including encryption keys via service
    await matrixClientService.clearAllMatrixData()

    // Reset component state
    isConnecting.value = false

    // Matrix sessions cleared - show user-friendly notification
    quasar.notify({
      type: 'positive',
      message: 'Matrix sessions cleared successfully! Please refresh the page to sign in again.',
      timeout: 5000,
      actions: [{ label: 'Refresh', handler: () => window.location.reload() }]
    })
  } catch (error) {
    logger.error('❌ Failed to clear Matrix sessions:', error)
    quasar.notify({
      type: 'negative',
      message: 'Failed to clear Matrix sessions',
      caption: 'Please try again or contact support if the problem persists',
      timeout: 8000,
      actions: [{ label: 'Retry', handler: () => clearMatrixSessions() }]
    })
  }
}

// Matrix encryption status check (same as preferences form)
const checkEncryptionStatus = async () => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      quasar.notify({
        type: 'negative',
        message: 'Matrix client not available',
        timeout: 3000
      })
      return
    }

    const crypto = client.getCrypto()
    if (!crypto) {
      quasar.notify({
        type: 'negative',
        message: 'Matrix encryption not available',
        timeout: 3000
      })
      return
    }

    // Get encryption status using the same logic as preferences form
    const [secretStorageReady, crossSigningReady, hasBackup] = await Promise.all([
      crypto.isSecretStorageReady(),
      crypto.getCrossSigningStatus().then(status => {
        const hasPublicKeys = !!(status?.publicKeysOnDevice)
        return hasPublicKeys
      }).catch(() => false),
      crypto.getKeyBackupInfo().then(info => !!info).catch(() => false)
    ])

    const userId = client.getUserId()
    const deviceId = client.getDeviceId()

    let deviceTrusted = false
    let verificationDetails = ''
    if (userId && deviceId) {
      const deviceInfo = await crypto.getDeviceVerificationStatus(userId, deviceId)
      const isLocallyVerified = deviceInfo?.localVerified || false
      const isCrossSigningVerified = deviceInfo?.crossSigningVerified || false
      const isSDKVerified = deviceInfo?.isVerified() || false
      deviceTrusted = isLocallyVerified && isCrossSigningVerified
      verificationDetails = `Local: ${isLocallyVerified ? '✅' : '❌'}, Cross-signing: ${isCrossSigningVerified ? '✅' : '❌'}, SDK: ${isSDKVerified ? '✅' : '❌'}`
    }

    // Show status dialog
    quasar.dialog({
      title: 'Matrix Encryption Status',
      message: `
        • User ID: ${userId || 'Unknown'}
        • Device ID: ${deviceId || 'Unknown'}
        • Secret Storage: ${secretStorageReady ? '✅ Ready' : '❌ Not Ready'}
        • Cross-Signing: ${crossSigningReady ? '✅ Ready' : '❌ Not Ready'}
        • Key Backup: ${hasBackup ? '✅ Available' : '❌ Not Available'}
        • Current Device: ${deviceTrusted ? '✅ Fully Verified' : '❌ Not Fully Verified'} (${verificationDetails})
      `,
      html: true,
      ok: 'Close'
    })
  } catch (error) {
    logger.error('Failed to check Matrix status:', error)
    quasar.notify({
      type: 'negative',
      message: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timeout: 5000
    })
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

// Load older messages with pagination

// Prevent duplicate loading

/**
 * Handle crypto events for timeline refresh (Element Web pattern)
 */
const onKeyBackupStatus = (enabled: boolean) => {
  logger.debug(`🔑 Key backup status changed: ${enabled} - refreshing timeline`)
  // Element Web calls forceUpdate(), we use timeline composable refreshEvents
  if (enabled && timelineEvents.value.length > 0) {
    refreshEvents()
  }
}

const onEventDecrypted = (event: MatrixEvent) => {
  logger.debug(`🔓 Event decrypted: ${event.getId()} - checking if timeline refresh needed`)
  // If the decrypted event is in current room, refresh timeline
  if (event.getRoomId() === props.roomId && !event.isDecryptionFailure()) {
    logger.debug('✅ Event successfully decrypted for current room')
    refreshEvents()
  }
}

const onKeysChanged = () => {
  logger.debug('🔑 Cross-signing keys changed - checking if timeline refresh needed')

  // Circuit breaker: prevent timeline refresh loops during client restart
  if (matrixEncryptionService?.isClientRestartInProgress()) {
    logger.debug('🚫 Cross-signing key change ignored - client restart in progress')
    return
  }

  // This could indicate successful key restore, refresh timeline
  if (timelineEvents.value.length > 0) {
    refreshEvents()
  }
}

// Removed unused loadOlderMessages function in Phase 2

// Watchers - only reload when roomId actually changes
watch(() => props.roomId, async (newRoomId, oldRoomId) => {
  logger.debug(`🔄 [${instanceId}] Props.roomId changed:`, {
    oldRoomId,
    newRoomId,
    timestamp: new Date().toISOString(),
    stackTrace: new Error().stack?.split('\n').slice(1, 4).map(line => line.trim())
  })

  if (newRoomId && newRoomId !== oldRoomId) {
    logger.debug(`🔄 [${instanceId}] Triggering timeline reload due to roomId change`)
    await initializeTimeline()
    await scrollToBottom()
  }
})

// Watch all props for changes
watch(() => [props.roomId, props.contextType, props.contextId, props.mode], ([newRoomId, newContextType, newContextId, newMode], [oldRoomId, oldContextType, oldContextId, oldMode]) => {
  logger.debug(`🔄 [${instanceId}] Props changed:`, {
    roomId: { old: oldRoomId, new: newRoomId },
    contextType: { old: oldContextType, new: newContextType },
    contextId: { old: oldContextId, new: newContextId },
    mode: { old: oldMode, new: newMode },
    timestamp: new Date().toISOString()
  })
}, { deep: true })

// Add a retry mechanism for loading messages when sync state changes
const handleSyncStateChange = async (state: string, prevState?: string) => {
  logger.debug('🔄 Matrix sync state changed:', { state, prevState, roomId: props.roomId })

  // Also check for 'SYNCING' state which often precedes room availability
  if ((state === 'PREPARED' || state === 'SYNCING') && props.roomId) {
    // If room resolution failed before, retry now that sync is active
    if (!currentRoom.value) {
      logger.debug('🔄 Sync state active, retrying room resolution for:', props.roomId)
      await updateCurrentRoom()
    }
  }
}

// Update message count when timeline events change
watch(timelineEvents, (newEvents) => {
  messageCount.value = newEvents.length
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

// Track if listeners are already set up to prevent duplicates
let listenersSetUp = false

// Set up Matrix client event listeners
const setupMatrixEventListeners = () => {
  const client = matrixClientService.getClient()
  if (!client) {
    logger.warn('⚠️ Matrix client not available for event listeners')
    return
  }

  if (listenersSetUp) {
    logger.debug('✅ Matrix client event listeners already set up, skipping')
    return
  }

  logger.debug('🔌 Setting up Matrix client event listeners')
  listenersSetUp = true

  // Initialize encryption in background for group chats (matches UnifiedChatComponent pattern)
  logger.debug('🔐 Starting background encryption initialization for single-room interface')
  matrixEncryptionService.initializeEncryptionBackground()
    .then(() => {
      logger.debug('✅ Background encryption initialization completed for group chat')
    })
    .catch(error => {
      logger.warn('⚠️ Background encryption initialization error:', error)
    })

  // Listen for sync state changes to retry room resolution
  client.on(ClientEvent.Sync, handleSyncStateChange)

  // Listen for crypto events to refresh timeline when decryption becomes available (Element Web pattern)
  client.on(CryptoEvent.KeyBackupStatus, onKeyBackupStatus)
  client.on(CryptoEvent.KeysChanged, onKeysChanged)
  client.on(MatrixEventEvent.Decrypted, onEventDecrypted)

  // Listen for live timeline events (new messages) - following Element Web's pattern
  const handleTimelineEvent = async (
    event: MatrixEvent,
    room: Room | undefined,
    toStartOfTimeline: boolean | undefined,
    removed: boolean,
    data: { timeline?: unknown; liveEvent?: boolean }
  ) => {
    // Debug: Log all timeline events to understand filtering
    logger.debug('🔍 Timeline event received:', {
      eventType: event.getType(),
      roomId: room?.roomId,
      currentRoomId: props.roomId,
      toStartOfTimeline,
      dataStructure: data,
      hasRoom: !!room,
      hasData: !!data,
      liveEvent: data?.liveEvent
    })

    // Follow Element Web's filtering pattern exactly

    // ignore events for other rooms - check both room ID and aliases
    if (!room) {
      logger.debug('❌ Filtered: no room')
      return
    }

    const roomId = room.roomId
    const roomAlias = room.getCanonicalAlias() || room.getAltAliases()?.[0]
    const matchesRoom = roomId === props.roomId || roomAlias === props.roomId

    if (!matchesRoom) {
      logger.debug('❌ Filtered: wrong room', {
        eventRoomId: roomId,
        eventRoomAlias: roomAlias,
        currentRoomId: props.roomId,
        matches: matchesRoom
      })
      return
    }

    logger.debug('✅ Room match found:', { eventRoomId: roomId, currentRoomId: props.roomId })

    // ignore events from filtered timelines
    if (data?.timeline && typeof data.timeline === 'object' && 'getTimelineSet' in data.timeline) {
      const timeline = data.timeline as { getTimelineSet(): unknown }
      if (timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) {
        logger.debug('❌ Filtered: filtered timeline')
        return
      }
    }

    // ignore anything but real-time updates at the end of the room
    if (toStartOfTimeline || !data?.liveEvent) {
      logger.debug('❌ Filtered: not live event', { toStartOfTimeline, liveEvent: data?.liveEvent })
      return
    }

    const eventType = event.getType()
    if (eventType === 'm.room.message' || eventType === 'm.room.encrypted') {
      // Debug encrypted message content extraction
      const rawContent = event.getContent()
      const clearContent = eventType === 'm.room.encrypted' ? event.getClearContent() : null

      logger.debug('📨 Live timeline event (Element Web pattern):', {
        eventId: event.getId(),
        roomId: room.roomId,
        currentRoomId: props.roomId,
        sender: event.getSender(),
        eventType,
        rawContent,
        clearContent,
        timestamp: new Date(event.getTs()).toLocaleTimeString()
      })

      // Instead of reloading all messages, just add this new message

      // For encrypted events, trigger immediate decryption attempt FIRST
      if (eventType === 'm.room.encrypted') {
        const client = matrixClientService.getClient()
        if (client) {
          try {
            // Attempt to decrypt the event immediately - Element-Web pattern
            await client.decryptEventIfNeeded(event)
            logger.debug('✅ Event decrypted successfully for live display')
          } catch (error) {
            logger.warn('⚠️ Failed to decrypt event immediately:', error)
          }
        }
      }

      // AFTER decryption attempt, get the content (decrypted if successful)
      const content = eventType === 'm.room.encrypted'
        ? (event.getClearContent() || event.getContent())
        : event.getContent()
      const senderId = event.getSender()
      const member = room.getMember(senderId || '')

      // Debug the final content being used
      logger.debug('🔍 Message content extraction:', {
        eventType,
        finalContent: content,
        hasBody: !!content?.body,
        bodyContent: content?.body,
        msgtype: content?.msgtype
      })

      // Create the new message object with proper type detection
      const msgtype = content.msgtype || 'm.text'
      const messageType = msgtype === 'm.image' ? 'image' : msgtype === 'm.file' ? 'file' : 'text'

      const newMessage = {
        id: event.getId() || '',
        type: messageType as 'text' | 'image' | 'file',
        sender: {
          id: senderId || '',
          name: member?.name || member?.rawDisplayName || senderId?.split(':')[0].substring(1) || 'Unknown',
          avatar: member?.getAvatarUrl?.(matrixClientService.getClient()?.baseUrl || '', 32, 32, 'crop', false, false) || undefined
        },
        content: messageType === 'text' ? {
          body: content.body || (eventType === 'm.room.encrypted' ? '🔒 [Unable to decrypt message]' : '')
        } : {
          body: content.body || content.filename || (eventType === 'm.room.encrypted' ? '🔒 [Encrypted file]' : ''),
          filename: content.filename,
          url: content.url,
          info: content.info,
          msgtype: content.msgtype
        },
        timestamp: new Date(event.getTs()),
        isOwn: senderId === matrixClientService.getClient()?.getUserId(),
        status: 'read' as const
      }

      logger.debug('📄 Message type detected:', { msgtype, messageType, content })

      logger.debug('✅ Added new live message to chat:', newMessage.content.body)

      // Load authenticated image for image messages
      if (newMessage.type === 'image') {
        logger.debug('🖼️ Loading authenticated image for new live message:', newMessage.content.filename)
        loadAuthenticatedImage(newMessage)
      }

      // Only scroll if this is not our own message (to avoid disrupting typing)
      if (!newMessage.isOwn) {
        await nextTick()
        await scrollToBottom(true) // smooth scroll for new messages
      }
    }
  }

  // Timeline events are now handled by useMatrixTimeline composable
  // client.on(RoomEvent.Timeline, handleTimelineEvent)

  // Note: Event decryption is now handled by useMatrixTimeline composable

  // Note: Event decryption is now handled by useMatrixTimeline composable
  // client.on(MatrixEventEvent.Decrypted, handleEventDecrypted)

  // Store cleanup function for onUnmounted
  onUnmounted(() => {
    if (client) {
      client.off(ClientEvent.Sync, handleSyncStateChange)
      client.off(RoomEvent.Timeline, handleTimelineEvent)
      // client.off(MatrixEventEvent.Decrypted, handleEventDecrypted)
    }
  })
}

// Handle file upload when a file is selected
watch(selectedFile, async (newFile) => {
  const roomId = currentRoom.value?.roomId
  logger.debug('🔍 File watcher triggered:', { newFile: newFile?.name, roomId })

  if (!newFile || !roomId) {
    logger.debug('⚠️ File upload cancelled - missing file or room ID')
    return
  }

  logger.debug('📎 Starting file upload process:', {
    fileName: newFile.name,
    fileSize: newFile.size,
    fileType: newFile.type,
    roomId: props.roomId
  })

  isSending.value = true

  try {
    logger.debug('🔄 Checking Matrix client availability...')

    // Check if Matrix client is available
    const client = matrixClientService.getClient()
    logger.debug('🔍 Matrix client check result:', { hasClient: !!client })

    if (!client) {
      logger.error('❌ Matrix client not available')
      throw new Error('Matrix client not available - please connect to Matrix first')
    }

    logger.debug('🔑 Matrix client status:', {
      hasClient: !!client,
      isLoggedIn: client.isLoggedIn(),
      userId: client.getUserId(),
      baseUrl: client.getHomeserverUrl()
    })

    // Use the resolved room ID (same as text messages) instead of the room alias
    const roomId = currentRoom.value?.roomId
    if (!roomId) {
      throw new Error('No room ID available for file upload')
    }

    logger.debug('📤 About to call uploadAndSendFile with resolved room ID:', roomId)
    const result = await matrixClientService.uploadAndSendFile(roomId, newFile)
    logger.debug('✅ uploadAndSendFile completed, result:', result)
    logger.debug('✅ File uploaded successfully!')

    // Clear the selected file
    selectedFile.value = null
  } catch (error) {
    logger.error('❌ Failed to upload file:', error)
    logger.error('❌ Error details:', {
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
  logger.debug('🎯 Typing users watcher triggered!', {
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
    logger.debug('⌨️ Someone is typing, scrolling to bottom')
    await scrollToBottom()
  }
})

// Generate unique instance ID for debugging
const instanceId = Math.random().toString(36).substring(2, 8)

// Connection and room management
// Matrix ready event handler (defined outside onMounted for cleanup access)
const handleMatrixReady = () => {
  logger.debug('🎧 Matrix client ready - setting up timeline event listeners')
  setupMatrixEventListeners()
}

// Invalid token recovery event handler (resets UI state when tokens are cleared)
const handleInvalidTokenRecovery = () => {
  logger.debug('🚫 Invalid token recovery event received, resetting UI state')
  try {
    lastAuthError.value = 'Matrix authentication expired. Please click "Connect" to re-authenticate.'
    isConnecting.value = false
  } catch (error) {
    // Ignore Vue readonly property errors during cleanup
    logger.warn('⚠️ Error during token recovery cleanup (expected during component teardown):', error.message)
  }
}

// Token error event handler (handles real-time token failures)
const handleTokenError = (event) => {
  logger.debug('🚫 Matrix token error received:', event.detail)
  logger.debug('🔧 Current UI state before token error handling:', {
    isConnected: isConnected.value,
    lastAuthError: lastAuthError.value,
    isConnecting: isConnecting.value
  })
  try {
    lastAuthError.value = 'Your session has expired. Please click "Connect" to re-authenticate.'
    isConnecting.value = false
    logger.debug('✅ Token error handled - Connect button should now be visible')
  } catch (error) {
    logger.warn('⚠️ Error during token error handling:', error.message)
  }
}

// Token refresh failure event handler (handles SDK token refresh failures)
const handleTokenRefreshFailure = (event) => {
  logger.debug('🚫 Matrix token refresh failed:', event.detail)
  try {
    lastAuthError.value = 'Session expired and could not be renewed. Please click "Connect" to re-authenticate.'
    isConnecting.value = false
  } catch (error) {
    logger.warn('⚠️ Error during token refresh failure handling:', error.message)
  }
}

// Handle delete message
const handleDeleteMessage = async (event: MatrixEvent) => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('Cannot delete message: no Matrix client available')
      return
    }

    const roomId = event.getRoomId()
    const eventId = event.getId()

    if (!roomId || !eventId) {
      logger.warn('Cannot delete message: missing room ID or event ID')
      return
    }

    logger.debug('🗑️ Deleting message:', { roomId, eventId })
    await client.redactEvent(roomId, eventId)
    logger.debug('✅ Message deleted successfully')

    // Force timeline refresh to show the redacted message
    await nextTick()
    refreshEvents()
    logger.debug('🔄 Timeline refreshed after deletion')

    quasar.notify({
      type: 'positive',
      message: 'Message deleted',
      timeout: 2000
    })
  } catch (error) {
    logger.error('❌ Failed to delete message:', error)
    quasar.notify({
      type: 'negative',
      message: 'Failed to delete message: ' + (error instanceof Error ? error.message : 'Unknown error'),
      timeout: 3000
    })
  }
}

onMounted(async () => {
  isConnecting.value = true

  // Listen for Matrix client ready events to ensure event listeners are set up
  window.addEventListener('matrix:ready', handleMatrixReady)

  // Listen for invalid token recovery events to reset UI state
  window.addEventListener('matrix:invalidTokenRecovery', handleInvalidTokenRecovery)

  // Listen for token error events to reactively show Connect button
  window.addEventListener('matrix:tokenError', handleTokenError)
  window.addEventListener('matrix:tokenRefreshFailure', handleTokenRefreshFailure)
  // Listen for recovery key generation events from encryption reset
  window.addEventListener('matrix-recovery-key-generated', handleRecoveryKeyGenerated)

  // Listen for device ID mismatch recovery events
  window.addEventListener('matrix-device-mismatch-recovered', handleDeviceMismatchRecovered)

  try {
    logger.debug(`🔌 [${instanceId}] MatrixChatInterface initializing for:`, {
      roomId: props.roomId,
      contextType: props.contextType,
      contextId: props.contextId,
      mode: props.mode,
      timestamp: new Date().toISOString(),
      currentPath: window.location.pathname,
      currentHash: window.location.hash,
      userAgent: navigator.userAgent.substring(0, 100)
    })

    // Add stack trace to see what caused the mount
    logger.debug(`📍 [${instanceId}] Mount stack trace:`, new Error().stack?.split('\n').slice(1, 6).map(line => line.trim()))

    let messagesLoaded = false

    // Check if Matrix client is already ready
    if (matrixClientService.isReady()) {
      lastAuthError.value = '' // Clear any previous errors
      roomName.value = props.contextType === 'event' ? 'Event Chatroom' : props.contextType === 'group' ? 'Group Chatroom' : `${props.contextType} Chat`

      // Set up Matrix client event listeners (with duplicate protection)
      setupMatrixEventListeners()

      // Load messages only if we have a room ID
      if (props.roomId) {
        await initializeTimeline()
        await scrollToBottom()
        messagesLoaded = true
      }
    } else {
      // Check if user has stored credentials before attempting auto-connection
      if (matrixClientService.hasStoredSession()) {
        // Try to initialize Matrix connection using stored credentials only
        try {
          logger.debug('🔑 Found stored credentials, attempting auto-connection')
          await matrixClientService.initializeClient()
        } catch (authError) {
          logger.debug('🔑 Stored credentials failed:', authError.message)
          lastAuthError.value = 'Matrix session expired. Please connect to continue.'
          isConnecting.value = false
          return // Exit early to show connect button
        }
      } else {
        // No stored credentials - show connect button without attempting auth
        logger.debug('🔑 No stored credentials, showing connect button')
        lastAuthError.value = '' // Clear error to show clean connect button
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
            // Using actual room ID from join result
            resolvedRoomId.value = result.room.roomId
            // Load messages with the correct room ID
            await initializeTimeline()
          } else {
            // Fallback: update current room state and load messages
            await updateCurrentRoom()
            await initializeTimeline()
          }
        } catch (error) {
          logger.warn('Failed to join event chat room:', error)
          // Don't throw - connection to Matrix itself succeeded
        }
      } else if (props.contextType === 'group' && props.contextId) {
        try {
          const result = await matrixClientService.joinGroupChatRoom(props.contextId)
          // Force Matrix client to sync to pick up new invitation
          await matrixClientService.forceSyncAfterInvitation('group', props.contextId)
          // Update current room to use the actual room ID from join result
          if (result.room?.roomId) {
            // Using actual room ID from join result
            resolvedRoomId.value = result.room.roomId
            // Load messages with the correct room ID
            await initializeTimeline()
          } else {
            // Fallback: update current room state and load messages
            await updateCurrentRoom()
            await initializeTimeline()
          }
        } catch (error) {
          logger.warn('Failed to join group chat room:', error)
          // Don't throw - connection to Matrix itself succeeded
        }
      }

      lastAuthError.value = '' // Clear any previous errors
      roomName.value = props.contextType === 'event' ? 'Event Chatroom' : props.contextType === 'group' ? 'Group Chatroom' : `${props.contextType} Chat`

      // Set up Matrix client event listeners (with duplicate protection)
      setupMatrixEventListeners()

      // Load messages if we have a room ID and we haven't loaded them already
      if (props.roomId && !messagesLoaded) {
        await initializeTimeline()
        await scrollToBottom()
      }
    }
  } catch (error) {
    logger.error('❌ Failed to initialize Matrix chat:', error)
    lastAuthError.value = error.message || 'Connection failed'
  } finally {
    isConnecting.value = false
  }
})

// Component cleanup
onUnmounted(() => {
  logger.debug(`🧹 [${instanceId}] MatrixChatInterface cleanup started`, {
    roomId: props.roomId,
    contextType: props.contextType,
    timestamp: new Date().toISOString(),
    currentPath: window.location.pathname,
    currentHash: window.location.hash,
    reason: 'Component unmounting'
  })

  // Add stack trace to see what caused the unmount
  logger.debug(`📍 [${instanceId}] Unmount stack trace:`, new Error().stack?.split('\n').slice(1, 6).map(line => line.trim()))

  // Reset listener flag so next instance can set up listeners
  listenersSetUp = false

  // Cleanup Matrix ready event listener
  window.removeEventListener('matrix:ready', handleMatrixReady)

  // Cleanup invalid token recovery event listener
  window.removeEventListener('matrix:invalidTokenRecovery', handleInvalidTokenRecovery)

  // Cleanup token error event listeners
  window.removeEventListener('matrix:tokenError', handleTokenError)
  window.removeEventListener('matrix:tokenRefreshFailure', handleTokenRefreshFailure)
  // Cleanup recovery key event listener
  window.removeEventListener('matrix-recovery-key-generated', handleRecoveryKeyGenerated)

  // Cleanup device mismatch recovery event listener
  window.removeEventListener('matrix-device-mismatch-recovered', handleDeviceMismatchRecovered)

  // Cleanup custom event listeners
  customEventListeners.forEach(cleanup => cleanup())
  customEventListeners = []

  logger.debug(`🧹 [${instanceId}] MatrixChatInterface cleanup completed`)
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

/* Date Separator Styling */
.date-separator {
  display: flex;
  align-items: center;
  margin: 1rem 0;
}

.date-separator-line {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-separator-line::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--q-separator-color, rgba(0, 0, 0, 0.12));
}

.date-separator-text {
  background: var(--q-page-bg, white);
  position: relative;
  z-index: 1;
  font-weight: 500;
  padding: 0 0.5rem;
}

/* Dark mode date separator */
.q-dark .date-separator-text {
  background: var(--q-dark-page);
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

/* Recovery Key Dialog Styles */
.recovery-key-dialog {
  max-width: 600px;
  margin: auto;
}

.recovery-key-card {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.recovery-key-text {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  word-break: break-all;
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #ddd;
  user-select: all;
}

.recovery-key-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.q-dark .recovery-key-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.q-dark .recovery-key-text {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #f5f5f5;
}

</style>
