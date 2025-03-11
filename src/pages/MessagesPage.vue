<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import DashboardTitle from '../components/dashboard/DashboardTitle.vue'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import MessagesComponent from '../components/messages/MessagesComponent.vue'
import { useChatStore } from '../stores/chat-store'
import { LoadingBar, QScrollArea } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { getImageSrc } from '../utils/imageUtils'
import { useNavigation } from '../composables/useNavigation'
import { useNotification } from '../composables/useNotification'

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
  const unreadMessages = activeChat.value?.messages?.filter(message => {
    // Type-safe check for flags property and includes method
    return typeof message === 'object' && message !== null &&
           (!Array.isArray(message.flags) || !message.flags.includes('read'))
  })

  if (unreadMessages?.length) {
    // Safe type conversion
    const messageIds = unreadMessages
      .map(message => message.id)
      .filter((id): id is number => typeof id === 'number')

    if (messageIds.length > 0) {
      useChatStore().actionSetMessagesRead(messageIds)
    }
  }
}

const { error } = useNotification()

onMounted(async () => {
  LoadingBar.start()
  useChatStore().isLoading = true

  try {
    // Initialize Matrix connection for real-time updates
    await useChatStore().actionInitializeMatrix()

    // Fetch initial chat data
    await fetchChat()

    // Scroll to the end of the chat
    scrollToEnd(0)

    // Mark messages as read
    markMessagesAsRead()
  } catch (err) {
    console.error('Error initializing chat:', err)
    error('Failed to load chat messages')
  } finally {
    LoadingBar.stop()
    useChatStore().isLoading = false
  }
})

const fetchChat = async () => {
  try {
    // Fetch the chat list data without setting up polling
    await useChatStore().actionGetChatList(route.query)
    return true
  } catch (err) {
    console.error('Failed to get chat list:', err)
    error('Failed to get chat list')
    return false
  }
}

onBeforeUnmount(() => {
  useChatStore().$reset()
})

watch(() => route.query, async () => {
  useChatStore().isLoadingChat = true
  fetchChat().then(() => {
    scrollToEnd(0)

    markMessagesAsRead()
  }).finally(() => {
    useChatStore().isLoadingChat = false
  })
})

const searchQuery = ref('')

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

// Remove unused functions since they're now handled by MessagesComponent

onBeforeUnmount(() => {
  // Clean up Matrix-related resources
  useChatStore().actionCleanup()
  useChatStore().$reset()
})
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
                <!-- <q-item-label caption>{{ new Date(chat.messages[0].timestamp * 1000).toLocaleString() }}</q-item-label> -->
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

            <!-- Messages using the new unified component -->
            <MessagesComponent
              v-if="activeChat.roomId"
              :room-id="activeChat.roomId"
              context-type="direct"
              :context-id="activeChat.ulid"
              :can-read="true"
              :can-write="true"
              :can-manage="false"
              class="col"
            />
            <NoContentComponent v-else class="col" icon="sym_r_chat" label="No messages yet" />
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
