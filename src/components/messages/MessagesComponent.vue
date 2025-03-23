<template>
  <div class="messages-component" data-cy="chat-container">
    <!-- Loading state -->
    <q-inner-loading :showing="isLoading">
      <q-spinner-dots size="40px" color="primary" />
    </q-inner-loading>

    <!-- No messages state -->
    <q-card-section v-if="messagesList.length === 0 && !isLoading">
      <div class="column items-center justify-center q-py-lg">
        <q-icon name="sym_r_comment" size="64px" color="grey-5" />
        <div class="text-subtitle1 q-mt-md text-grey-7">
          {{ canWrite ? 'Start the conversation' : 'No messages yet' }}
        </div>
      </div>
    </q-card-section>

    <!-- Messages list with virtual scrolling for better performance -->
    <div v-if="messagesList.length > 0" class="messages-container q-pa-md" ref="messagesContainer">
      <!-- Load more button -->
      <div class="text-center q-mb-md" v-if="hasMoreMessages">
        <q-btn flat color="primary" @click="loadMoreMessages" :loading="isLoadingMore">
          Load Earlier Messages
        </q-btn>
      </div>

      <!-- Day separators and messages -->
      <template v-for="(messageGroup, date) in groupedMessages" :key="date">
        <!-- Date separator -->
        <div class="date-separator q-my-md text-center">
          <div class="date-line"></div>
          <div class="date-label bg-white dark:bg-dark q-px-sm">{{ formatDateLabel(date) }}</div>
        </div>

        <!-- Messages for this date -->
        <div v-for="message in messageGroup" :key="message.event_id || message.eventId" class="q-mb-md">
          <message-item
            :message="message"
            :is-current-user="isCurrentUser(message.sender)"
            :can-manage="canManage"
            :ref="el => { if (message.event_id === unreadMessageId) unreadMessageRef = el }"
            @reply="replyToMessage"
            @delete="promptDeleteMessage"
            @edit="startEditMessage"
          />
        </div>
      </template>

      <!-- New message indicator -->
      <q-btn
        v-if="showScrollToBottom"
        round
        color="primary"
        icon="keyboard_arrow_down"
        size="sm"
        class="scroll-to-bottom-btn"
        @click="scrollToBottom"
      />
    </div>

    <!-- Message input -->
    <div class="message-input-container q-px-md q-pb-md">
      <q-input
        ref="messageInput"
        filled
        v-model="newMessage"
        label="Type a message"
        @keyup.enter="sendMessage"
        @keydown="handleTyping"
        counter
        :disable="!canWrite"
        maxlength="700"
        data-cy="chat-input"
      >
        <template v-slot:after>
          <q-btn
            :loading="isSendingMessage"
            icon="sym_r_send"
            round
            color="primary"
            @click="sendMessage"
            :disabled="!newMessage.trim()"
            data-cy="send-message-button"
          />
        </template>
      </q-input>

      <!-- Typing indicator -->
      <div v-if="typingUsersList.length > 0" class="typing-indicator q-pl-sm text-grey-7">
        <span>{{ formatTypingUsers }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useMessageStore } from '../../stores/unified-message-store'
import { useAuthStore } from '../../stores/auth-store'
import { ensureMatrixUser, getMatrixDisplayName } from '../../utils/matrixUtils'
import { matrixService } from '../../services/matrixService'
import MessageItem from './MessageItem.vue'
import { useQuasar } from 'quasar'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { MatrixMessage } from '../../types/matrix'

const props = defineProps({
  roomId: {
    type: String,
    required: true
  },
  contextType: {
    type: String,
    default: 'general',
    validator: (value: string) => ['general', 'event', 'group', 'direct'].includes(value)
  },
  contextId: {
    type: String,
    default: ''
  },
  canRead: {
    type: Boolean,
    default: true
  },
  canWrite: {
    type: Boolean,
    default: false
  },
  canManage: {
    type: Boolean,
    default: false
  }
})

const $q = useQuasar()
const messageStore = useMessageStore()
const authStore = useAuthStore()
const messageInput = ref<HTMLInputElement | null>(null)

// Local state
const newMessage = ref('')
const isLoading = ref(false)
const isLoadingMore = ref(false)
const hasMoreMessages = ref(false)
const paginationToken = ref('')
const lastTyping = ref(0)
const typingDebounce = 2000 // 2 seconds
const messagesContainer = ref<HTMLElement | null>(null)
const unreadMessageId = ref('')
const unreadMessageRef = ref(null)
const showScrollToBottom = ref(false)
const autoScrollToBottom = ref(true)
const lastScrollPosition = ref(0)
const isScrollingProgrammatically = ref(false)

// Computed values
const messagesList = computed(() => messageStore.currentRoomMessages)
const isSendingMessage = computed(() => messageStore.isSending)
const typingUsersList = computed(() => {
  return messageStore.typingUsersInCurrentRoom
    .filter(id => id !== authStore.user?.matrixUserId)
})

// Group messages by date for better UI organization
const groupedMessages = computed(() => {
  const groups: Record<string, MatrixMessage[]> = {}

  messagesList.value.forEach(message => {
    // Get timestamp (using either property name)
    const timestamp = message.origin_server_ts || message.timestamp || 0
    if (!timestamp) return

    // Format as YYYY-MM-DD for grouping
    const date = new Date(timestamp)
    const dateString = format(date, 'yyyy-MM-dd')

    if (!groups[dateString]) {
      groups[dateString] = []
    }

    groups[dateString].push(message)
  })

  return groups
})

const formatTypingUsers = computed(() => {
  if (typingUsersList.value.length === 0) return ''

  const names = typingUsersList.value.map(id => {
    // Try to get a readable name
    const displayName = getMatrixDisplayName(id)
    return displayName
  })

  if (names.length === 1) {
    return `${names[0]} is typing...`
  } else if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`
  } else {
    return `${names[0]} and ${names.length - 1} others are typing...`
  }
})

// Methods
const isCurrentUser = (senderId: string) => {
  return senderId === authStore.user?.matrixUserId
}

const formatDateLabel = (dateString: string) => {
  try {
    const date = parseISO(dateString)
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MMM d, yyyy')
  } catch (e) {
    return dateString
  }
}

const handleTyping = () => {
  if (!props.canWrite || !props.roomId) return

  const now = Date.now()
  if (now - lastTyping.value > typingDebounce) {
    lastTyping.value = now
    messageStore.sendTyping(props.roomId, true)
  }
}

const scrollToBottom = () => {
  if (!messagesContainer.value) return

  isScrollingProgrammatically.value = true
  messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  showScrollToBottom.value = false
  autoScrollToBottom.value = true

  setTimeout(() => {
    isScrollingProgrammatically.value = false
  }, 100)
}

const handleScroll = () => {
  if (!messagesContainer.value || isScrollingProgrammatically.value) return

  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
  const scrolledToBottom = Math.abs((scrollTop + clientHeight) - scrollHeight) < 50

  // Update auto-scroll flag based on user scroll position
  autoScrollToBottom.value = scrolledToBottom

  // Show scroll button when not at bottom
  showScrollToBottom.value = !scrolledToBottom

  // Save last scroll position
  lastScrollPosition.value = scrollTop
}

// These functions will be implemented in the future when we add read receipts support
// Commented out to avoid linting errors for unused functions
/*
const checkUnreadMessages = () => {
  // In the future, we could implement logic to highlight unread messages
  // based on read receipts from Matrix
}

const markMessagesAsRead = () => {
  // Implementation for marking messages as read would go here
  // This would use Matrix read receipts API
}
*/

const loadMessages = async () => {
  if (!props.roomId) return

  isLoading.value = true
  try {
    const result = await messageStore.loadMessages(50)
    hasMoreMessages.value = !!result.end
    paginationToken.value = result.end
  } catch (err) {
    console.error('Error loading messages:', err)
  } finally {
    isLoading.value = false
  }
}

const loadMoreMessages = async () => {
  if (!props.roomId || !paginationToken.value) return

  isLoadingMore.value = true
  try {
    const result = await messageStore.loadMessages(50, paginationToken.value)
    hasMoreMessages.value = !!result.end
    paginationToken.value = result.end
  } catch (err) {
    console.error('Error loading more messages:', err)
  } finally {
    isLoadingMore.value = false
  }
}

const sendMessage = async () => {
  if (!props.canWrite || !newMessage.value.trim()) return

  try {
    // First make sure we're scrolled to bottom for a new message
    autoScrollToBottom.value = true

    // Send the message
    await messageStore.sendMessage(newMessage.value.trim())
    newMessage.value = ''

    // Reset typing indicator
    if (props.roomId) {
      messageStore.sendTyping(props.roomId, false)
    }

    // Scroll to new message
    nextTick(() => {
      scrollToBottom()
      messageInput.value?.focus()
    })
  } catch (err) {
    console.error('Error sending message:', err)
    $q.notify({
      type: 'negative',
      message: 'Failed to send message. Please try again.'
    })
  }
}

// Message actions
const promptDeleteMessage = (messageId: string) => {
  $q.dialog({
    title: 'Delete Message',
    message: 'Are you sure you want to delete this message?',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await messageStore.deleteMessage(messageId)
    } catch (err) {
      console.error('Error deleting message:', err)
    }
  })
}

const startEditMessage = (/* _message: MatrixMessage */) => {
  // This is a placeholder for future edit functionality
  $q.notify({
    message: 'Edit functionality coming soon',
    color: 'info'
  })
}

const replyToMessage = (/* messageId: string */) => {
  // This is a placeholder for future reply functionality
  // In a linear chat model, we might just want to focus the input
  messageInput.value?.focus()
}

// Lifecycle
onMounted(async () => {
  // Initialize store with context
  messageStore.setContext(props.roomId, props.contextType as 'general' | 'group' | 'event' | 'direct', props.contextId)
  messageStore.setPermissions({
    canRead: props.canRead,
    canWrite: props.canWrite,
    canManage: props.canManage
  })

  // Ensure user has Matrix credentials if they can write
  if (props.canWrite) {
    await ensureMatrixUser()
  }

  // Initialize Matrix connection and load messages
  if (!messageStore.matrixConnected) {
    await messageStore.initializeMatrix()
  }

  // Explicitly join this specific room to ensure we receive messages for it
  // This is critical to fix the issue where some users don't receive messages
  try {
    console.log('!!!DEBUG!!! Explicitly joining room in MessagesComponent:', props.roomId)
    await matrixService.joinRoom(props.roomId)
    console.log('!!!DEBUG!!! Room joined successfully')
  } catch (err) {
    console.error('Error joining room:', err)
  }

  await loadMessages()

  // Set up scroll handler
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleScroll)

    // Scroll to bottom on initial load
    nextTick(() => {
      scrollToBottom()
    })
  }

  // Watch for changes to the messages list
  watch(
    messagesList,
    (newMessages) => {
      if (newMessages.length > 0 && autoScrollToBottom.value) {
        nextTick(() => {
          scrollToBottom()
        })
      }
    },
    { deep: true }
  )
})

onBeforeUnmount(() => {
  // Clean up typing indicator and other resources
  if (props.roomId && messageStore.isUserTyping) {
    messageStore.sendTyping(props.roomId, false).catch(console.error)
  }

  // Remove event listeners
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', handleScroll)
  }

  messageStore.cleanup()
})

// Watch for roomId changes to reload messages
watch(() => props.roomId, async (newRoomId, oldRoomId) => {
  if (newRoomId !== oldRoomId) {
    // Update context
    messageStore.setContext(newRoomId, props.contextType as 'general' | 'group' | 'event' | 'direct', props.contextId)
    messageStore.setPermissions({
      canRead: props.canRead,
      canWrite: props.canWrite,
      canManage: props.canManage
    })

    // Reset states
    paginationToken.value = ''
    autoScrollToBottom.value = true
    showScrollToBottom.value = false
    unreadMessageId.value = ''

    // Explicitly join the new room to make sure we receive events
    try {
      console.log('!!!DEBUG!!! Explicitly joining new room after change:', newRoomId)
      await matrixService.joinRoom(newRoomId)
      console.log('!!!DEBUG!!! New room joined successfully')
    } catch (err) {
      console.error('Error joining new room:', err)
    }

    // Load messages for new room
    await loadMessages()

    // Scroll to bottom after loading
    nextTick(() => {
      scrollToBottom()
    })
  }
})
</script>

<style lang="scss" scoped>
@import '../../css/quasar.variables.scss';

.messages-component {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.message-input-container {
  border-top: 1px solid #eee;
  padding-top: 12px;
}

.typing-indicator {
  font-size: 12px;
  height: 18px;
  margin-top: 4px;
}

.date-separator {
  position: relative;
  text-align: center;
  margin: 24px 0;
}

.date-line {
  position: absolute;
  width: 100%;
  height: 1px;
  background-color: rgba(0, 0, 0, 0.12);
  top: 50%;
  left: 0;
  z-index: 0;
}

.date-label {
  position: relative;
  display: inline-block;
  padding: 0 10px;
  font-size: 12px;
  color: #666;
  z-index: 1;
  background-color: white;
}

.scroll-to-bottom-btn {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 2;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

/* Dark mode styling */
.body--dark .message-input-container {
  border-top-color: rgba(255, 255, 255, 0.1);
}

.body--dark .date-line {
  background-color: rgba(255, 255, 255, 0.12);
}

.body--dark .date-label {
  background-color: $purple-500 !important;
  color: rgba(255, 255, 255, 0.7);
}
</style>
