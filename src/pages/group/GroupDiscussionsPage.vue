<script setup lang="ts">

import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from 'stores/group-store.ts'
import SubtitleComponent from 'src/components/common/SubtitleComponent.vue'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import { GroupPermission } from 'src/types'

const group = computed(() => useGroupStore().group)
interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

const chatMessages = ref<ChatMessage[]>([])
const newMessage = ref('')
const isLoading = ref(false)

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

onMounted(async () => {
  if (group.value && useGroupStore().getterUserGroupPermission(GroupPermission.SeeDiscussions)) {
    isLoading.value = true
    await useGroupStore().actionGetGroupDiscussions(String(group.value?.id)).finally(() => (isLoading.value = false))
  }
})
</script>

<template>
  <SpinnerComponent v-if="isLoading" />
  <template v-if="!isLoading && group && useGroupStore().getterUserGroupPermission(GroupPermission.SeeDiscussions)">
    <SubtitleComponent class="q-mt-lg q-px-md" label="Discussions" :count="group?.discussions?.length" hide-link />
    <!-- Chat Section -->
    <q-card v-if="group" class="shadow-0 q-mt-md">
      <q-card-section class="chat-messages scroll" style="max-height: 300px">
        <div v-for="message in chatMessages" :key="message.id" class="q-mb-sm">
          <strong>{{ message.sender }}:</strong> {{ message.text }}
        </div>
      </q-card-section>

      <q-card-section v-if="useGroupStore().getterGroupHasGroupMember()">
        <q-input v-model="newMessage" label="Type a message" dense @keyup.enter="sendMessage">
          <template v-slot:after>
            <q-btn round dense flat icon="sym_r_send" @click="sendMessage" />
          </template>
        </q-input>
      </q-card-section>
    </q-card>
  </template>
  <NoContentComponent v-else label="You don't have permission to see this page" icon="sym_r_group"/>
</template>

<style scoped lang="scss">
.chat-messages {
  display: flex;
  flex-direction: column;
}

.chat-messages>div {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  background-color: #f0f0f0;
  align-self: flex-start;
  margin-bottom: 8px;
}

.chat-messages>div:nth-child(even) {
  background-color: #e0e0e0;
  align-self: flex-end;
}
</style>
