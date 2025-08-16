<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGroupStore } from '../../stores/group-store'
import { useAuthStore } from '../../stores/auth-store'
import { GroupPermission } from '../../types'
import MatrixNativeChatOrchestrator from '../../components/chat/MatrixNativeChatOrchestrator.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import getEnv from '../../utils/env'
import { generateGroupRoomAlias } from '../../utils/matrixUtils'
import { useNotification } from '../../composables/useNotification'

const groupStore = useGroupStore()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const { info } = useNotification()

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

// Handle expand event to navigate to chats page with focus on current room
const handleExpandChat = async () => {
  let actualRoomId = null

  // First priority: get the actual Matrix room ID from the client
  try {
    const matrixClient = await import('../../services/matrixClientService').then(m => m.matrixClientService)
    const client = await matrixClient.getClient()

    if (client && matrixRoomId.value) {
      if (matrixRoomId.value.startsWith('#')) {
        // Resolve room alias to actual room ID
        try {
          const room = client.getRoom(matrixRoomId.value)
          if (room?.roomId) {
            actualRoomId = room.roomId
            console.log(`🔗 Resolved room alias ${matrixRoomId.value} to room ID ${actualRoomId}`)
          } else {
            // Try Matrix API resolution if local lookup fails
            const roomDirectory = await client.getRoomIdForAlias(matrixRoomId.value)
            if (roomDirectory?.room_id) {
              actualRoomId = roomDirectory.room_id
              console.log(`🔗 API resolved room alias ${matrixRoomId.value} to room ID ${actualRoomId}`)
            }
          }
        } catch (error) {
          console.log('Could not resolve room alias to room ID:', error)
        }
      } else if (matrixRoomId.value.startsWith('!')) {
        // Already have the room ID
        actualRoomId = matrixRoomId.value
        console.log(`🔗 Using existing room ID: ${actualRoomId}`)
      }
    }
  } catch (error) {
    console.log('Could not access Matrix client for room ID resolution:', error)
  }

  // Build the chat ID using the actual room ID if we have it
  let chatId = ''
  if (actualRoomId) {
    chatId = actualRoomId
  } else if (matrixRoomId.value) {
    // Fallback to using the original room identifier
    chatId = matrixRoomId.value
  } else if (group.value?.slug) {
    // Last resort: use group slug
    chatId = `group-${group.value.slug}`
  }

  console.log(`🔗 Navigating to chats with chat ID: ${chatId} (actual room ID: ${actualRoomId || 'none'})`)

  router.push({
    name: 'DashboardChatsPage',
    query: {
      chat: chatId,
      return: router.currentRoute.value.fullPath
    }
  })
}

// Check if user might need to re-authenticate after Matrix setup
const checkAuthenticationStatus = () => {
  // If user is not authenticated and accessing a chatroom, they might be returning from Matrix setup
  if (!authStore.isAuthenticated && group.value) {
    // Check for signs they might have been through Matrix auth flow
    const hasMatrixParams = route.query.loginToken || route.query.state || route.query.return
    const isReturningFromAuth = hasMatrixParams || sessionStorage.getItem('was_setting_up_matrix')

    if (isReturningFromAuth) {
      console.log('🔑 User appears to be returning from Matrix setup but is not logged into OpenMeet')

      // Clear the flag to prevent loops
      sessionStorage.removeItem('was_setting_up_matrix')

      // Show helpful message
      info('Please log in to OpenMeet to access the chatroom', 'Authentication Required')

      // Redirect to login with return URL
      setTimeout(() => {
        router.push({
          name: 'AuthLoginPage',
          query: { redirect: route.fullPath }
        })
      }, 1500) // Give user time to read the message

      return true // Indicate we handled the redirect
    }
  }
  return false // No redirect needed
}

// Simplified - MatrixChatInterface handles all initialization internally
onMounted(() => {
  console.log('🏗️ GroupChatroomPage mounted for group:', group.value?.slug)

  // Check if we need to redirect for authentication
  checkAuthenticationStatus()
})
</script>

<template>
  <div data-cy="group-chatroom-page" class="group-chatroom-page q-pb-xl">
    <!-- Setup orchestrator with single-room mode for focused group chat -->
    <MatrixNativeChatOrchestrator
      v-if="group && hasPermission && isGroupMember"
      context-type="group"
      :context-id="group.slug"
      mode="single-room"
      :inline-room-id="matrixRoomId"
      :can-open-fullscreen="true"
      @expand="handleExpandChat"
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
