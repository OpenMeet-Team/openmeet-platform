<template>
  <div class="event-chat-component">
    <UnifiedChatComponent
      context-type="event"
      :context-id="eventSlug"
      mode="inline"
      :inline-room-id="eventRoomId"
      :height="height"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UnifiedChatComponent from '../chat/UnifiedChatComponent.vue'
import { eventsApi } from '../../api/events'

interface Props {
  eventSlug: string
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: '400px'
})

const eventRoomId = ref<string>('')

// Get or create the Matrix room for this event
const initializeEventChat = async () => {
  try {
    // Call API to get or create event chat room
    const response = await eventsApi.joinEventChat(props.eventSlug)
    eventRoomId.value = response.data.matrixRoomId
  } catch (error) {
    console.error('Failed to initialize event chat:', error)
  }
}

onMounted(() => {
  initializeEventChat()
})
</script>

<style scoped>
.event-chat-component {
  width: 100%;
}
</style>
