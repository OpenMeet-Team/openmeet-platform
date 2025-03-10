<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import DashboardTitle from '../components/dashboard/DashboardTitle.vue'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import { useChatStore } from '../stores/chat-store'
import { LoadingBar, QScrollArea } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { getImageSrc } from '../utils/imageUtils'
import { useNavigation } from '../composables/useNavigation'
import { nextTick } from 'process'
import { useNotification } from '../composables/useNotification'
import { MatrixMessage } from '../types/matrix'

// Legacy Zulip message type - will be removed in future
interface ZulipMessageEntity {
  id: number
  sender_id: number
  content: string
  sender_full_name: string
  timestamp: number
  flags?: string[]
  [key: string]: unknown
}

// Union type for messages during transition period
type MessageType = MatrixMessage | ZulipMessageEntity

// User entity type
interface UserEntity {
  matrixUserId?: string
  zulipUserId?: number
  [key: string]: unknown
}

const route = useRoute()
const chatList = computed(() => useChatStore().chatList)
const chatScrollArea = ref<InstanceType<typeof QScrollArea> | null>(null)
const router = useRouter()

const scrollToEnd = (delay = 0) => {
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (chatScrollArea.value) {
          chatScrollArea.value.setScrollPercentage('vertical', 1, delay)
        }
      })
    })
  })
}

const markMessagesAsRead = () => {
  if (activeChat.value?.messages?.length && activeChat.value?.roomId) {
    try {
      const latestMessage = activeChat.value.messages[activeChat.value.messages.length - 1] as MessageType

      // For Matrix messages, we use event_id
      let messageId: string
      if (isMatrixMessage(latestMessage)) {
        messageId = latestMessage.event_id
      } else if ('id' in latestMessage) {
        // Legacy Zulip message
        messageId = String(latestMessage.id)
      } else {
        // If we can't determine the message ID, skip marking as read
        console.warn('Unable to determine message ID for marking as read')
        return
      }

      useChatStore().actionSetMessagesRead(activeChat.value.roomId, messageId)
    } catch (err) {
      console.error('Error marking messages as read:', err)
    }
  }
}

const updateInterval = ref(10000)
const chatInterval = ref()
const { error } = useNotification()

onMounted(async () => {
  LoadingBar.start()
  useChatStore().isLoading = true
  fetchChat().then(() => {
    LoadingBar.stop()
    useChatStore().isLoading = false
    scrollToEnd(0)
    markMessagesAsRead()
  }).catch(err => {
    console.error('Error fetching chat:', err)
    LoadingBar.stop()
    useChatStore().isLoading = false
    error('Failed to load chat messages')
  })
})

const fetchChat = () => {
  if (chatInterval.value) {
    clearInterval(chatInterval.value)
  }
  return useChatStore().actionGetChatList(route.query).then(() => {
    chatInterval.value = setInterval(() => fetchChat(), updateInterval.value)
  }).catch((err) => {
    console.error('Failed to get chat list:', err)
    error('Failed to get chat list')
    clearInterval(chatInterval.value)
  })
}

onBeforeUnmount(() => {
  useChatStore().$reset()
})

watch(() => route.query, async () => {
  useChatStore().isLoadingChat = true
  fetchChat().then(() => {
    scrollToEnd(0)
    markMessagesAsRead()
  }).catch(err => {
    console.error('Error fetching chat on route change:', err)
  }).finally(() => {
    useChatStore().isLoadingChat = false
  })
})

const searchQuery = ref('')
const newMessage = ref('')

const activeChat = computed(() => useChatStore().activeChat)
const filteredChatList = computed(() => {
  return chatList.value?.filter(chat =>
    searchQuery.value
      ? chat.participant?.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
      : true
  )
})

const avatarSrc = getImageSrc(null)

const { navigateToChat } = useNavigation()

function sendMessage () {
  if (newMessage.value.trim() && activeChat.value && activeChat.value.roomId) {
    const message = newMessage.value.trim()
    newMessage.value = ''

    useChatStore().actionSendMessage(activeChat.value.roomId, message).then(() => {
      scrollToEnd(500)
    }).catch(err => {
      console.error('Error sending message:', err)
      error('Failed to send message')
      // Restore the message if sending failed
      newMessage.value = message
    })
  }
}

onBeforeUnmount(() => {
  clearInterval(chatInterval.value)
  useChatStore().$reset()
})

// Helper function to extract display name from Matrix user ID
const getDisplayName = (senderId: string): string => {
  // Matrix user IDs are in the format @username:domain.com
  // Extract the username part
  const match = senderId.match(/@([^:]+)/)
  return match ? match[1] : senderId
}

// Type guard to check if a message is a Matrix message
const isMatrixMessage = (message: MessageType): message is MatrixMessage => {
  return message && 'event_id' in message && 'sender' in message && 'content' in message && typeof message.content === 'object'
}

// Helper function to check if a message is sent by the current user
const isMessageFromCurrentUser = (message: MessageType, currentUser: UserEntity): boolean => {
  try {
    if (isMatrixMessage(message) && currentUser?.matrixUserId) {
      return message.sender === currentUser.matrixUserId
    } else if (!isMatrixMessage(message) && currentUser?.zulipUserId) {
      // Legacy support for Zulip messages
      return message.sender_id === currentUser.zulipUserId
    }
  } catch (err) {
    console.error('Error checking if message is from current user:', err)
  }
  return false
}

// Helper function to get the message key for v-for
const getMessageKey = (message: MessageType): string => {
  try {
    if (isMatrixMessage(message)) {
      return message.event_id
    } else if ('id' in message) {
      // Legacy support for Zulip messages
      return String(message.id)
    }
  } catch (err) {
    console.error('Error getting message key:', err)
  }
  // Fallback to random key if we can't determine the message ID
  return Math.random().toString()
}

// Helper function to get the sender name
const getSenderName = (message: MessageType): string => {
  try {
    if (isMatrixMessage(message)) {
      return getDisplayName(message.sender)
    } else if ('sender_full_name' in message) {
      // Legacy support for Zulip messages
      return message.sender_full_name || ''
    }
  } catch (err) {
    console.error('Error getting sender name:', err)
  }
  return 'Unknown User'
}

// Helper function to get the message content
const getMessageContent = (message: MessageType): string => {
  try {
    if (isMatrixMessage(message)) {
      return message.content.body
    } else if ('content' in message && typeof message.content === 'string') {
      // Legacy support for Zulip messages
      return message.content
    }
  } catch (err) {
    console.error('Error getting message content:', err)
  }
  return ''
}

// Helper function to get the message timestamp
const getMessageTimestamp = (message: MessageType): number => {
  try {
    if (isMatrixMessage(message)) {
      return message.origin_server_ts
    } else if ('timestamp' in message) {
      // Legacy support for Zulip messages
      return message.timestamp * 1000
    }
  } catch (err) {
    console.error('Error getting message timestamp:', err)
  }
  return Date.now()
}
</script>

<template>
  <q-page padding style="max-width: 1024px;" class="q-mx-auto c-messages-page q-pb-xl">
    <DashboardTitle defaultBack label="Messages" />

    <SpinnerComponent v-if="useChatStore().isLoading" />

    <div v-else class="messages-page row q-col-gutter-md">
      <div class="col-4">
        <q-card flat bordered class="full-height">
          <q-input v-model="searchQuery" @clear="searchQuery = ''" filled type="search" label="Search people" clearable
            class="q-ma-md">
            <template v-slot:append>
              <q-icon name="sym_r_search" />
            </template>
          </q-input>

          <q-list separator v-if="filteredChatList?.length" style="max-height: 100%;">
            <q-item v-for="chat in filteredChatList" :key="chat.id" clickable v-ripple
              :active="activeChat && activeChat.id === chat.id" @click="navigateToChat({ chat: chat.ulid })"
              data-cy="chat-item">
              <q-item-section avatar>
                <q-avatar>
                  <img :src="chat.participant.photo ? getImageSrc(chat.participant.photo) : avatarSrc" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ chat.participant.firstName }} {{ chat.participant.lastName }}</q-item-label>
                <q-item-label caption>{{ chat.participant.name }}</q-item-label>
              </q-item-section>
              <q-item-section side v-if="chat.messages">
                <q-badge v-if="chat.messages?.length" color="red">{{ chat.messages.length }}</q-badge>
              </q-item-section>
            </q-item>
          </q-list>
          <NoContentComponent v-else icon="sym_r_chat" label="No chats yet" />
        </q-card>
      </div>

      <!-- Chat area -->
      <div class="col relative-position">
        <SpinnerComponent v-if="useChatStore().isLoadingChat" />
        <template v-else>
          <div class="full-height column" data-cy="chat-messages" v-if="activeChat">
            <!-- Chat header -->
            <q-card flat bordered>
              <q-card-section class="row items-center col">
                <div class="row items-center">
                  <div class="row col items-center">
                    <q-avatar size="48px" class="q-mr-md">
                      <img
                        :src="activeChat.participant.photo ? getImageSrc(activeChat.participant.photo) : avatarSrc" />
                    </q-avatar>
                    <div class="text-h6">{{ activeChat.participant?.firstName }} {{ activeChat.participant?.lastName }}
                    </div>
                  </div>

                  <q-btn round dense flat icon="sym_r_close" @click="router.push({ name: 'MessagesPage' })">
                    <q-tooltip>Close chat</q-tooltip>
                  </q-btn>
                </div>
              </q-card-section>
            </q-card>

            <!-- Messages -->
            <q-scroll-area ref="chatScrollArea" class="col q-mt-md" v-if="activeChat.messages?.length">
              <div v-for="message in activeChat.messages" :key="getMessageKey(message)" class="q-mb-md q-px-md">
                <div style="max-width: 100%;"
                  :class="['flex', isMessageFromCurrentUser(message, activeChat.user) ? 'justify-end' : 'justify-start']">
                  <q-chat-message data-cy="chat-message"
                    :name="getSenderName(message)"
                    :text="[getMessageContent(message)]"
                    text-html
                    :sent="isMessageFromCurrentUser(message, activeChat.user)"
                    :stamp="new Date(getMessageTimestamp(message)).toLocaleString()" />
                </div>
              </div>
            </q-scroll-area>
            <NoContentComponent v-else class="col" icon="sym_r_chat" label="No messages yet" />

            <!-- Message input -->
            <q-input data-cy="chat-message-input" :loading="useChatStore().isSendingMessage" v-model="newMessage" filled
              resi label="Type a message" @keyup.enter="sendMessage">
              <template v-slot:after>
                <q-btn round dense flat icon="sym_r_send" @click="sendMessage" />
              </template>
            </q-input>
          </div>
          <NoContentComponent v-else class="full-height" icon="sym_r_chat" label="Select a chat to start messaging" />
        </template>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.messages-page {
  min-height: calc(100vh - 260px);
  /* height: calc(100vh - 165px); */
  /* Adjust based on your layout */
}
</style>
