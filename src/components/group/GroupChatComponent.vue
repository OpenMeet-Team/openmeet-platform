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
import { groupsApi } from '../../api/groups'

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
    // Call API to get or create group chat room
    const response = await groupsApi.joinGroupChat(props.groupSlug)
    groupRoomId.value = response.data.matrixRoomId
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
