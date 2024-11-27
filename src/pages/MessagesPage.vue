<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import DashboardTitle from 'src/components/dashboard/DashboardTitle.vue'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import { useChatStore } from 'src/stores/chat-store'
import { LoadingBar, QScrollArea } from 'quasar'
import { useRoute } from 'vue-router'
import { getImageSrc } from 'src/utils/imageUtils'
import { useNavigation } from 'src/composables/useNavigation'
import { nextTick } from 'process'
import { useNotification } from 'src/composables/useNotification'

const route = useRoute()
const chatList = computed(() => useChatStore().chatList)
const chatScrollArea = ref<InstanceType<typeof QScrollArea> | null>(null)

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
  const unreadMessages = activeChat.value?.messages?.filter(message => !message.flags || !message.flags.includes('read'))
  if (unreadMessages?.length) {
    useChatStore().actionSetMessagesRead(unreadMessages.map(message => message.id))
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
  })
})

const fetchChat = () => {
  if (chatInterval.value) {
    clearInterval(chatInterval.value)
  }
  return useChatStore().actionGetChatList(route.query).then(() => {
    chatInterval.value = setInterval(() => fetchChat(), updateInterval.value)
  }).catch(() => {
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
  }).finally(() => {
    useChatStore().isLoadingChat = false
  })
})

const searchQuery = ref('')
const newMessage = ref('')

const activeChat = computed(() => useChatStore().activeChat)
const filteredChatList = computed(() => {
  return chatList.value?.filter(chat =>
    chat.participant?.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const avatarSrc = getImageSrc(null)

const { navigateToChat } = useNavigation()

function sendMessage () {
  if (newMessage.value.trim() && activeChat.value) {
    const message = newMessage.value
    newMessage.value = ''

    useChatStore().actionSendMessage(activeChat.value.ulid, {
      content: message.trim(),
      sender_id: activeChat.value.user.zulipUserId as number,
      sender_full_name: activeChat.value.user.name as string,
      timestamp: new Date().getTime()
    }).then(() => {
      scrollToEnd(500)
    })
  }
}

onBeforeUnmount(() => {
  clearInterval(chatInterval.value)
  useChatStore().$reset()
})
</script>

<template>
  <q-page padding style="max-width: 1024px;" class="q-mx-auto c-messages-page">
    <DashboardTitle defaultBack label="Messages" />

    <SpinnerComponent v-if="useChatStore().isLoading" />

    <div v-else class="messages-page row q-mt-md q-gutter-md">
      <div class="col-4">
        <q-card flat bordered style="min-height: 98%">
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
                <q-item-label>{{ chat.participant.name }}</q-item-label>
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
      <div class="col q-pa-md relative-position">
        <SpinnerComponent v-if="useChatStore().isLoadingChat" />
        <template v-else>
          <div class="full-height column" data-cy="chat-messages" v-if="activeChat">
            <!-- Chat header -->
            <div class="row items-center q-mb-md">
              <q-avatar size="48px" class="q-mr-md">
                <img :src="activeChat.participant.photo ? getImageSrc(activeChat.participant.photo) : avatarSrc" />
              </q-avatar>
              <div class="text-h6">{{ activeChat.participant?.name }}</div>
            </div>

            <!-- Messages -->
            <q-scroll-area ref="chatScrollArea" class="col q-mb-md" v-if="activeChat.messages?.length">
              <div v-for="message in activeChat.messages" :key="message.id" class="q-mb-md q-px-md">
                <div style="max-width: 100%;"
                  :class="['flex', message.sender_id !== activeChat.user.zulipUserId ? 'justify-end' : 'justify-start']">
                  <q-chat-message data-cy="chat-message" :name="message.sender_full_name" :text="[message.content]"
                    text-html :sent="message.sender_id !== activeChat.user.zulipUserId"
                    :stamp="new Date(message.timestamp * 1000).toLocaleString()" />
                </div>
              </div>
            </q-scroll-area>
            <NoContentComponent v-else class="col" icon="sym_r_chat" label="No messages yet" />

            <!-- Message input -->
            <q-input data-cy="chat-message-input" :loading="useChatStore().isSendingMessage" v-model="newMessage" filled
              type="textarea" label="Type a message" @keyup.enter="sendMessage">
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
  height: calc(100vh - 165px);
  /* Adjust based on your layout */
}
</style>
