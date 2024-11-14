<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import DashboardTitle from 'src/components/dashboard/DashboardTitle.vue'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import { useChatStore } from 'src/stores/chat-store'
import { LoadingBar, QScrollArea } from 'quasar'
import { useRoute } from 'vue-router'
import { getImageSrc } from 'src/utils/imageUtils'
import { useNavigation } from 'src/composables/useNavigation'
import { nextTick } from 'process'

const route = useRoute()
const chatList = computed(() => useChatStore().chatList)
const chatScrollArea = ref<InstanceType<typeof QScrollArea> | null>(null)

const scrollToEnd = () => {
  nextTick(() => {
    if (chatScrollArea.value) {
      chatScrollArea.value.setScrollPercentage('vertical', 1, 500)
    }
  })
}

onMounted(async () => {
  LoadingBar.start()
  await useChatStore().actionGetChatList().finally(() => LoadingBar.stop())

  if (route.query.user) {
    await useChatStore().actionGetChatByUserUlid(route.query.user as string).then(() => {
      scrollToEnd()
    })
  }

  if (route.query.chat) {
    await useChatStore().actionGetChatByUlid(route.query.chat as string).then(() => {
      scrollToEnd()
    })
  }
})

watch(() => route.query, async (newVal) => {
  if (newVal.user) {
    await useChatStore().actionGetChatByUserUlid(newVal.user as string)
  } else if (newVal.chat) {
    await useChatStore().actionGetChatByUlid(newVal.chat as string)
  }
})

const searchQuery = ref('')
const newMessage = ref('')

const selectedChat = computed(() => useChatStore().chat)
const filteredChatList = computed(() => {
  return chatList.value.filter(chat =>
    chat.participant?.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const avatarSrc = getImageSrc(null)

const { navigateToChat } = useNavigation()

function sendMessage () {
  if (newMessage.value.trim() && selectedChat.value) {
    useChatStore().actionSendMessage(selectedChat.value.ulid, {
      content: newMessage.value.trim(),
      sender_id: selectedChat.value.user.zulipUserId as number,
      sender_full_name: selectedChat.value.user.name as string,
      timestamp: new Date().getTime()
    }).finally(() => {
      newMessage.value = ''
      scrollToEnd()
    })
  }
}
</script>

<template>
  <q-page padding style="max-width: 1024px;" class="q-mx-auto c-messages-page">
    <DashboardTitle defaultBack label="Messages" />

    <SpinnerComponent v-if="useChatStore().isLoading" />

    <div v-else class="messages-page row q-mt-md q-gutter-md">
      <div class="col-4">
        <q-card flat bordered class="bg-grey-2" style="min-height: 98%">
          <q-input v-model="searchQuery" @clear="searchQuery = ''" filled type="search" label="Search people" clearable
            class="q-ma-md">
            <template v-slot:append>
              <q-icon name="sym_r_search" />
            </template>
          </q-input>

          <q-list separator v-if="filteredChatList?.length">
            <q-item v-for="chat in filteredChatList" :key="chat.id" clickable v-ripple
              :active="selectedChat && selectedChat.id === chat.id" @click="navigateToChat({ chat: chat.ulid })"
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
              <!-- <q-item-section side>
                <q-item-label caption>{{ chat.lastMessageTime }}</q-item-label>
                <q-badge v-if="chat.unreadCount" color="red">{{ chat.unreadCount }}</q-badge>
              </q-item-section> -->
            </q-item>
          </q-list>
          <NoContentComponent v-else icon="sym_r_chat" label="No chats yet" />
        </q-card>
      </div>

      <!-- Chat area -->
      <div class="col q-pa-md relative-position">
        <SpinnerComponent v-if="useChatStore().isLoadingChat" />
        <template v-else>
          <div class="full-height column" data-cy="chat-messages" v-if="selectedChat">
            <!-- Chat header -->
            <div class="row items-center q-mb-md">
              <q-avatar size="48px" class="q-mr-md">
                <img :src="selectedChat.participant.photo ? getImageSrc(selectedChat.participant.photo) : avatarSrc" />
              </q-avatar>
              <div class="text-h6">{{ selectedChat.participant?.name }}</div>
            </div>

            <!-- Messages -->
            <q-scroll-area ref="chatScrollArea" class="col q-mb-md">
              <div v-for="message in selectedChat.messages" :key="message.id" class="q-mb-md">
                <div
                  :class="['flex', message.sender_id === selectedChat.participant.zulipUserId ? 'justify-end' : 'justify-start']">
                  <q-chat-message data-cy="chat-message" :name="message.sender_full_name" :text="[message.content]"
                    text-html :sent="message.sender_id === selectedChat.user.zulipUserId"
                    :stamp="new Date(message.timestamp * 1000).toLocaleString()" />
                </div>
              </div>
            </q-scroll-area>

            <!-- Message input -->
            <q-input data-cy="chat-message-input" :loading="useChatStore().isSendingMessage" v-model="newMessage"
              filled type="textarea" label="Type a message" @keyup.enter="sendMessage">
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
