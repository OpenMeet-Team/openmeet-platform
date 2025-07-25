<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useGroupStore } from '../../stores/group-store'
import { useAuthStore } from '../../stores/auth-store'
import { GroupPermission } from '../../types'
import MatrixChatInterface from '../../components/chat/MatrixChatInterface.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import { matrixClientService } from '../../services/matrixClientService'

const groupStore = useGroupStore()
const authStore = useAuthStore()

const group = computed(() => groupStore.group)
const groupRoomId = ref<string>('')
const isLoadingRoom = ref<boolean>(false)
const errorMessage = ref<string>('')
const needsAuthentication = ref<boolean>(false)

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

// Initialize the group chat room
const initializeGroupChat = async () => {
  if (!group.value || !hasPermission.value || !isGroupMember.value) {
    console.log('GroupChatroomPage: Cannot initialize - missing group, permission, or membership', {
      hasGroup: !!group.value,
      hasPermission: hasPermission.value,
      isGroupMember: isGroupMember.value,
      groupSlug: group.value?.slug
    })
    return
  }

  console.log('GroupChatroomPage: Initializing group chat for:', group.value.slug)
  isLoadingRoom.value = true
  errorMessage.value = ''
  needsAuthentication.value = false

  try {
    // First, make sure Matrix client is initialized
    if (!matrixClientService.getClient()) {
      console.log('GroupChatroomPage: Initializing Matrix client first')
      await matrixClientService.initializeClient()
    }
    // Use Matrix client service to join group chat room
    const result = await matrixClientService.joinGroupChatRoom(group.value.slug)
    console.log('GroupChatroomPage: Join result:', result)

    if (result && result.room?.roomId) {
      groupRoomId.value = result.room.roomId
      console.log('GroupChatroomPage: Successfully got room ID:', result.room.roomId)
    } else {
      console.warn('GroupChatroomPage: No room ID in result:', result)
      errorMessage.value = 'No room ID returned from Matrix service'
    }
  } catch (error) {
    console.error('GroupChatroomPage: Failed to initialize group chat:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'

    // Check if this is an authentication error
    if (errorMsg.includes('Matrix client not authenticated') || errorMsg.includes('Manual authentication required')) {
      needsAuthentication.value = true
      errorMessage.value = ''
    } else {
      errorMessage.value = errorMsg
    }
  } finally {
    isLoadingRoom.value = false
  }
}

// Connect to Matrix (handles authentication)
const connectToMatrix = async () => {
  if (!group.value) return

  console.log('GroupChatroomPage: Attempting Matrix connection...')
  isLoadingRoom.value = true

  try {
    // Use the proper connectToMatrix method that handles user consent
    await matrixClientService.connectToMatrix()
    // Try to initialize the group chat again
    await initializeGroupChat()
  } catch (error) {
    console.error('GroupChatroomPage: Matrix connection failed:', error)
    const errorMsg = error instanceof Error ? error.message : 'Connection failed'
    errorMessage.value = errorMsg
    needsAuthentication.value = true
  } finally {
    isLoadingRoom.value = false
  }
}

// Watch for group changes (including initial load)
watch(
  () => [group.value, hasPermission.value, isGroupMember.value],
  ([newGroup, newPermission, newIsGroupMember]) => {
    console.log('GroupChatroomPage: Group, permission, or membership changed', {
      hasGroup: !!newGroup,
      hasPermission: newPermission,
      isGroupMember: newIsGroupMember,
      groupSlug: typeof newGroup === 'object' && newGroup ? newGroup.slug : undefined
    })

    if (newGroup && newPermission && newIsGroupMember && !groupRoomId.value) {
      initializeGroupChat()
    }
  },
  { immediate: true }
)

onMounted(() => {
  console.log('GroupChatroomPage: Component mounted', {
    hasGroup: !!group.value,
    hasPermission: hasPermission.value,
    isGroupMember: isGroupMember.value,
    groupSlug: group.value?.slug
  })
})
</script>

<template>
  <div data-cy="group-chatroom-page" class="group-chatroom-page q-pb-xl">
    <!-- Loading State -->
    <SpinnerComponent v-if="isLoadingRoom" />

    <!-- Group Chat using MatrixChatInterface with specific room ID -->
    <MatrixChatInterface
      v-else-if="group && hasPermission && isGroupMember && groupRoomId"
      :room-id="groupRoomId"
      context-type="group"
      :context-id="group.slug"
      mode="inline"
      height="calc(100vh - 200px)"
    />

    <!-- Matrix Authentication Needed -->
    <div
      v-else-if="group && hasPermission && isGroupMember && !groupRoomId && !isLoadingRoom && needsAuthentication"
      class="q-pa-lg text-center"
    >
      <q-icon name="sym_r_chat" size="4rem" color="grey-6" class="q-mb-md" />
      <div class="text-h6 q-mb-sm">Connect to Matrix Chat</div>
      <div class="text-body2 text-grey-7 q-mb-lg">
        You need to authenticate with Matrix to access the group chatroom.
      </div>
      <q-btn
        label="Connect to Matrix"
        color="primary"
        outline
        size="md"
        @click="connectToMatrix"
        :loading="isLoadingRoom"
        data-cy="matrix-connect-button"
        class="q-mb-sm"
      />
    </div>

    <!-- Error State -->
    <NoContentComponent
      v-else-if="group && hasPermission && isGroupMember && !groupRoomId && !isLoadingRoom && errorMessage"
      :label="`Unable to load group chatroom: ${errorMessage}`"
      icon="sym_r_chat"
    />

    <!-- No Room ID Available -->
    <NoContentComponent
      v-else-if="group && hasPermission && isGroupMember && !groupRoomId && !isLoadingRoom && !errorMessage && !needsAuthentication"
      label="Unable to load group chatroom"
      icon="sym_r_chat"
    />

    <!-- Not a Group Member -->
    <NoContentComponent
      v-else-if="group && hasPermission && !isGroupMember"
      label="You need to be a member of this group to access the chatroom"
      icon="sym_r_group"
    />

    <!-- No Permission Content -->
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
