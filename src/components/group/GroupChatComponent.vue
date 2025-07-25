<template>
  <div class="group-chat-component">
    <UnifiedChatComponent
      context-type="group"
      :context-id="groupSlug"
      mode="inline"
      :inline-room-id="groupRoomId"
      :height="height"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UnifiedChatComponent from '../chat/UnifiedChatComponent.vue'
import { matrixClientService } from '../../services/matrixClientService'

interface Props {
  groupSlug: string
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: '400px'
})

const groupRoomId = ref<string>('')

// Get or create the Matrix room for this group
const initializeGroupChat = async () => {
  try {
    // Use Matrix client service to join group chat room
    const result = await matrixClientService.joinGroupChatRoom(props.groupSlug)
    if (result && result.room?.roomId) {
      groupRoomId.value = result.room.roomId
    }
  } catch (error) {
    console.error('Failed to initialize group chat:', error)
  }
}

onMounted(() => {
  initializeGroupChat()
})
</script>

<style scoped>
.group-chat-component {
  width: 100%;
}
</style>
