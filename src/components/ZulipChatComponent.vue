<template>
  <q-page class="q-pa-md">
    <div class="messages" ref="messagesContainer">
      <div v-for="message in messages" :key="message.id" class="message q-mb-sm">
        <strong>{{ message.sender_full_name }}:</strong> <span v-html="message.content"></span>
      </div>
    </div>
    <q-input v-model="newMessage" @keyup.enter="sendMessage" placeholder="Type a message..." class="q-mt-md">
      <template v-slot:after>
        <q-btn round dense flat icon="sym_r_send" @click="sendMessage" />
      </template>
    </q-input>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

interface Message {
  id: number
  sender_full_name: string
  content: string
}

interface Props {
  apiKey: string
  email: string
  streamName: string
  topic: string
  zulipApiUrl: string
}

// Props are automatically injected in `script setup`
const props = defineProps<Props>()

// Define reactive variables
const messages = ref<Message[]>([])
const newMessage = ref<string>('')
const messagesContainer = ref<HTMLDivElement | null>(null)

// Function to fetch messages
const fetchMessages = async (): Promise<void> => {
  try {
    const response = await axios.get(`${props.zulipApiUrl}/messages`, {
      params: {
        anchor: 'newest',
        num_before: 100,
        num_after: 0,
        narrow: JSON.stringify([
          { operator: 'stream', operand: props.streamName },
          { operator: 'topic', operand: props.topic }
        ])
      },
      auth: {
        username: props.email,
        password: props.apiKey
      }
    })
    messages.value = response.data.messages
    scrollToBottom()
  } catch (error) {
    console.error('Error fetching messages:', error)
  }
}

// Function to send a new message
const sendMessage = async (): Promise<void> => {
  if (!newMessage.value.trim()) return

  alert('Cors protected route, need to move api call to backend')
  try {
    await axios.post(`${props.zulipApiUrl}/messages`, {
      type: 'stream',
      to: props.streamName,
      subject: props.topic,
      content: newMessage.value
    }, {
      auth: {
        username: props.email,
        password: props.apiKey
      }
    })
    newMessage.value = ''
    fetchMessages()
  } catch (error) {
    console.error('Error sending message:', error)
  }
}

// Function to scroll to the bottom of the chat container
const scrollToBottom = (): void => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Lifecycle hook to fetch messages on mount and set up polling
onMounted(() => {
  fetchMessages()
  setInterval(fetchMessages, 5000)
})
</script>

<style scoped>
.messages {
  height: 400px;
  overflow-y: auto;
  border: 1px solid #ddd;
  padding: 10px;
}
</style>
