<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGroupStore } from '../../stores/group-store'
import { useAuthStore } from '../../stores/auth-store'
import { GroupPermission } from '../../types'
import MatrixChatInterface from '../../components/chat/MatrixChatInterface.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import getEnv from '../../utils/env'
import { generateGroupRoomAlias } from '../../utils/matrixUtils'

const groupStore = useGroupStore()
const authStore = useAuthStore()

const group = computed(() => groupStore.group)

// Get the Matrix room ID from the group - similar to event logic
const matrixRoomId = computed(() => {
  if (!group.value?.slug) {
    console.log('🔍 No group slug available')
    return null
  }

  // First check if we have a cached room ID (efficient)
  if (group.value.roomId) {
    console.log('✅ Using cached group room ID:', group.value.roomId)
    return group.value.roomId
  }

  // Fallback: generate room alias dynamically (fresh)
  const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
  if (!tenantId) {
    console.error('❌ No tenant ID available for group room alias generation')
    return null
  }

  try {
    const roomAlias = generateGroupRoomAlias(group.value.slug, tenantId)
    console.log('🏠 Generated fresh group room alias (no cached room ID):', roomAlias)
    return roomAlias
  } catch (error) {
    console.error('❌ Failed to generate group room alias:', error)
    return null
  }
})

// Group chat permissions - similar to EventPage attendee check
const hasPermission = computed(() => {
  return group.value && (
    groupStore.getterIsPublicGroup ||
    (groupStore.getterIsAuthenticatedGroup && authStore.isAuthenticated) ||
    groupStore.getterUserHasPermission(GroupPermission.SeeDiscussions)
  )
})

// Check if user is actually a group member (not just has permissions)
const isGroupMember = computed(() => {
  const groupMember = groupStore.getterUserIsGroupMember()
  return groupMember && groupMember.groupRole &&
    ['owner', 'admin', 'moderator', 'member'].includes(groupMember.groupRole.name)
})

// Group chat initialization is now handled internally by MatrixChatInterface

// Simplified - MatrixChatInterface handles all initialization internally
onMounted(() => {
  console.log('🏗️ GroupChatroomPage mounted for group:', group.value?.slug)
})
</script>

<template>
  <div data-cy="group-chatroom-page" class="group-chatroom-page q-pb-xl">
    <!-- Single unified chat interface - handles all connection logic internally -->
    <MatrixChatInterface
      v-if="group && hasPermission && isGroupMember"
      :room-id="matrixRoomId"
      context-type="group"
      :context-id="group.slug"
      mode="inline"
      height="calc(100vh - 200px)"
    />

    <!-- Permission/eligibility messages only -->
    <NoContentComponent
      v-else-if="group && hasPermission && !isGroupMember"
      label="You need to be a member of this group to access the chatroom"
      icon="sym_r_group"
    />

    <NoContentComponent
      data-cy="no-permission-group-chatroom-page"
      v-else-if="group && !hasPermission"
      label="You don't have permission to access this chatroom"
      icon="sym_r_group"
    />
  </div>
</template>

<style scoped lang="scss">
.group-chatroom-page {
  width: 100%;
}
</style>
