<script setup lang="ts">
import { ref, computed } from 'vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'

interface User {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface Message {
  id: number;
  senderId: number;
  text: string;
  timestamp: string;
}

// Mock data for chat list
const chatList = ref<User[]>([
  { id: 1, name: 'Alice Johnson', avatar: 'https://cdn.quasar.dev/img/avatar1.jpg', lastMessage: 'See you at the meetup!', lastMessageTime: '10:30 AM', unreadCount: 2 },
  { id: 2, name: 'Bob Smith', avatar: 'https://cdn.quasar.dev/img/avatar2.jpg', lastMessage: 'Great idea!', lastMessageTime: 'Yesterday', unreadCount: 0 },
  { id: 3, name: 'Carol Williams', avatar: 'https://cdn.quasar.dev/img/avatar3.jpg', lastMessage: 'Can you share the event details?', lastMessageTime: 'Monday', unreadCount: 1 }
])

// Mock data for messages
const messages = ref<Message[]>([
  { id: 1, senderId: 1, text: 'Hi there! Are you coming to the tech meetup this weekend?', timestamp: '10:00 AM' },
  { id: 2, senderId: 0, text: 'Hello! Yes, I\'m planning to attend. What time does it start?', timestamp: '10:15 AM' },
  { id: 3, senderId: 1, text: 'Great! It starts at 2 PM. See you at the meetup!', timestamp: '10:30 AM' }
])

const searchQuery = ref('')
const selectedChat = ref<User | null>(null)
const newMessage = ref('')

const filteredChatList = computed(() => {
  return chatList.value.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

function selectChat (chat: User) {
  selectedChat.value = chat
  // In a real app, you would fetch messages for this chat here
}

function sendMessage () {
  if (newMessage.value.trim() && selectedChat.value) {
    messages.value.push({
      id: messages.value.length + 1,
      senderId: 0, // Assuming 0 is the current user's ID
      text: newMessage.value.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
    newMessage.value = ''
    // In a real app, you would send this message to your backend here
  }
}
</script>

<template>
  <q-page padding>
    <div class="row text-h4">
      <router-link class="router-link-inherit" active-class="text-bold" :to="{ name: 'MessagesPage' }">Messages</router-link>
    </div>

    <!-- Chat list sidebar -->
    <div class="messages-page row q-mt-md q-gutter-md">
      <div class="col-4">
        <q-card flat bordered class="bg-grey-2" style="min-height: 98%">
          <q-input
            v-model="searchQuery"
            filled
            type="search"
            label="Search people"
            class="q-ma-md"
          >
            <template v-slot:append>
              <q-icon name="sym_r_search" />
            </template>
          </q-input>

          <q-list separator>
            <q-item
              v-for="chat in filteredChatList"
              :key="chat.id"
              clickable
              v-ripple
              @click="selectChat(chat)"
              :active="selectedChat && selectedChat.id === chat.id"
            >
              <q-item-section avatar>
                <q-avatar>
                  <img :src="chat.avatar" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ chat.name }}</q-item-label>
                <q-item-label caption>{{ chat.lastMessage }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label caption>{{ chat.lastMessageTime }}</q-item-label>
                <q-badge v-if="chat.unreadCount" color="red">{{ chat.unreadCount }}</q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <!-- Chat area -->
      <div class="col q-pa-md">
        <div v-if="selectedChat" class="full-height column">
          <!-- Chat header -->
          <div class="row items-center q-mb-md">
            <q-avatar size="48px" class="q-mr-md">
              <img :src="selectedChat.avatar" />
            </q-avatar>
            <div class="text-h6">{{ selectedChat.name }}</div>
          </div>

          <!-- Messages -->
          <q-scroll-area class="col q-mb-md">
            <div v-for="message in messages" :key="message.id" class="q-mb-md">
              <div :class="['flex', message.senderId === 0 ? 'justify-end' : 'justify-start']">
                <q-chat-message
                  :name="message.senderId === 0 ? 'Me' : selectedChat.name"
                  :text="[message.text]"
                  :sent="message.senderId === 0"
                  :stamp="message.timestamp"
                />
              </div>
            </div>
          </q-scroll-area>

          <!-- Message input -->
          <q-input
            v-model="newMessage"
            filled
            type="textarea"
            label="Type a message"
            @keyup.enter="sendMessage"
          >
            <template v-slot:after>
              <q-btn round dense flat icon="sym_r_send" @click="sendMessage" />
            </template>
          </q-input>
        </div>
        <NoContentComponent v-else class="full-height" icon="sym_r_chat" label="Select a chat to start messaging"/>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.messages-page {
  height: calc(100vh - 120px); /* Adjust based on your layout */
}
</style>
