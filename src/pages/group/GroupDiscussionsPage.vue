<script setup lang="ts">

import { ref, computed } from 'vue'
import { useGroupStore } from 'stores/group-store.ts'

const group = computed(() => useGroupStore().group)
interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

const chatMessages = ref<ChatMessage[]>([])
const newMessage = ref('')

// Mock chat messages
chatMessages.value = [
  { id: 1, sender: 'John Doe', text: 'Welcome everyone to our group chat!' },
  { id: 2, sender: 'Jane Smith', text: 'Excited for the upcoming AI workshop!' },
  { id: 3, sender: 'Bob Johnson', text: 'Does anyone have resources on getting started with cybersecurity?' }
]
const sendMessage = () => {
  if (newMessage.value.trim()) {
    chatMessages.value.push({
      id: Date.now(),
      sender: 'You', // In a real app, this would be the current user's name
      text: newMessage.value.trim()
    })
    newMessage.value = ''
    // In a real app, you'd send this message to a backend service
  }
}
</script>

<template>
  <!-- Chat Section -->
  <q-card v-if="group" class="shadow-0 q-mt-md">
    <q-card-section>
      <div class="text-h5">Discussions <span v-if="group.discussions">{{ group.discussions.length }}</span></div>
    </q-card-section>
    <q-card-section class="chat-messages scroll" style="max-height: 300px">
      <div v-for="message in chatMessages" :key="message.id" class="q-mb-sm">
        <strong>{{ message.sender }}:</strong> {{ message.text }}
      </div>
    </q-card-section>

    <q-card-section v-if="useGroupStore().getterHasUserGroupRole()">
      <q-input
        v-model="newMessage"
        label="Type a message"
        dense
        @keyup.enter="sendMessage"
      >
        <template v-slot:after>
          <q-btn round dense flat icon="sym_r_send" @click="sendMessage"/>
        </template>
      </q-input>
    </q-card-section>
  </q-card>
</template>

<style scoped lang="scss">
.chat-messages {
  display: flex;
  flex-direction: column;
}

.chat-messages > div {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  background-color: #f0f0f0;
  align-self: flex-start;
  margin-bottom: 8px;
}

.chat-messages > div:nth-child(even) {
  background-color: #e0e0e0;
  align-self: flex-end;
}
</style>
