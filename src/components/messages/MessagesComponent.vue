<template>
  <div class="messages-component">
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

    <!-- Messages list -->
    <div v-if="messagesList.length > 0" class="messages-container q-pa-md">
      <!-- Load more button -->
      <div class="text-center q-mb-md" v-if="hasMoreMessages">
        <q-btn flat color="primary" @click="loadMoreMessages" :loading="isLoadingMore">
          Load Earlier Messages
        </q-btn>
      </div>

      <!-- Messages in chronological order -->
      <div v-for="message in messagesList" :key="message.event_id" class="q-mb-md">
        <message-item
          :message="message"
          :is-current-user="isCurrentUser(message.sender)"
          :can-manage="canManage"
          @reply="replyToMessage"
          @delete="promptDeleteMessage"
          @edit="startEditMessage"
        />
      </div>
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
      >
        <template v-slot:after>
          <q-btn
            :loading="isSendingMessage"
            icon="sym_r_send"
            round
            color="primary"
            @click="sendMessage"
            :disabled="!newMessage.trim()"
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
import MessageItem from './MessageItem.vue'
import { useQuasar } from 'quasar'

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

// Computed values
const messagesList = computed(() => messageStore.currentRoomMessages)
const isSendingMessage = computed(() => messageStore.isSending)
const typingUsersList = computed(() => {
  return messageStore.typingUsersInCurrentRoom
    .filter(id => id !== authStore.user?.matrixUserId)
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

const handleTyping = () => {
  if (!props.canWrite || !props.roomId) return

  const now = Date.now()
  if (now - lastTyping.value > typingDebounce) {
    lastTyping.value = now
    messageStore.sendTyping(props.roomId, true)
  }
}

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
    await messageStore.sendMessage(newMessage.value.trim())
    newMessage.value = ''

    // Reset typing indicator
    if (props.roomId) {
      messageStore.sendTyping(props.roomId, false)
    }

    // Focus the input field again
    nextTick(() => {
      messageInput.value?.focus()
    })
  } catch (err) {
    console.error('Error sending message:', err)
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

  await loadMessages()
})

onBeforeUnmount(() => {
  // Clean up typing indicator and other resources
  if (props.roomId && messageStore.isUserTyping) {
    messageStore.sendTyping(props.roomId, false).catch(console.error)
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

    // Reset pagination
    paginationToken.value = ''

    // Load messages for new room
    await loadMessages()
  }
})
</script>

<style scoped>
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
</style>
