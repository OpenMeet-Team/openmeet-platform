<script setup lang="ts">
import { computed } from 'vue'
import { useGroupStore } from '../../stores/group-store'
import { useAuthStore } from '../../stores/auth-store'
import { GroupPermission } from '../../types'
import MatrixChatGateway from '../../components/chat/MatrixChatGateway.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'

const groupStore = useGroupStore()
const authStore = useAuthStore()
const group = computed(() => groupStore.group)

// Group chat permissions
const groupPermissions = computed(() => {
  const hasReadPermission = group.value && (
    groupStore.getterIsPublicGroup ||
    (groupStore.getterIsAuthenticatedGroup && authStore.isAuthenticated) ||
    groupStore.getterUserHasPermission(GroupPermission.SeeDiscussions)
  )

  const isGroupMember = (() => {
    const groupMember = groupStore.getterUserIsGroupMember()
    return groupMember && groupMember.groupRole &&
      ['owner', 'admin', 'moderator', 'member'].includes(groupMember.groupRole.name)
  })()

  return {
    canRead: !!hasReadPermission,
    canWrite: !!isGroupMember,
    canManage: !!groupStore.getterUserHasPermission(GroupPermission.ManageDiscussions)
  }
})

// Access check function for the gateway
const checkGroupAccess = () => {
  const groupMember = groupStore.getterUserIsGroupMember()
  return groupMember && groupMember.groupRole &&
    ['owner', 'admin', 'moderator', 'member'].includes(groupMember.groupRole.name)
}
</script>

<template>
  <div data-cy="group-chatroom-page" class="group-chatroom-page q-pb-xl">
    <!-- Full chat access for group members -->
    <MatrixChatGateway
      v-if="group && groupPermissions.canWrite && checkGroupAccess()"
      context-type="group"
      :context-id="group.slug"
      hide-subtitle
    />

    <!-- Read-only access message -->
    <div v-else-if="group && groupPermissions.canRead && !checkGroupAccess()">
      <NoContentComponent
        label="You need to be a member of this group to access the chatroom"
        icon="sym_r_group"
      />
    </div>

    <!-- No permission message -->
    <div v-else-if="group && !groupPermissions.canRead">
      <NoContentComponent
        data-cy="no-permission-group-chatroom-page"
        label="You don't have permission to access this chatroom"
        icon="sym_r_group"
      />
    </div>

    <!-- Group not found -->
    <NoContentComponent
      v-else
      label="Group not found"
      icon="sym_r_group"
    />
  </div>
</template>

<style scoped lang="scss">
.group-chatroom-page {
  width: 100%;
}
</style>
