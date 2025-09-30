<template>
  <q-page class="q-pa-md q-pb-xl q-mx-auto" style="max-width: 1201px">
    <!-- Loading -->
    <SpinnerComponent v-if="useGroupStore().isLoading" />

    <template v-else>
      <!-- Lead block -->
      <GroupLeadComponent v-if="group" />

      <!-- Nav sticky block -->
      <GroupStickyComponent v-if="group" />

      <!-- Secondary blocks -->
      <div class="router-view-container">
        <router-view v-if="groupMounted && hasRightPermission" />
      </div>

      <!-- Auth group content -->
      <NoContentComponent v-if="group && useGroupStore().getterIsAuthenticatedGroup && !useAuthStore().isFullyAuthenticated"
        icon="sym_r_lock" data-cy="auth-group-content" label="You need to be logged in to see the content"
        :to="{ name: 'AuthLoginPage', query: { redirect: $route.fullPath } }" buttonLabel="Log in" />

      <!-- Guest waiting for approval -->
      <NoContentComponent
        v-if="group && useGroupStore().getterIsPrivateGroup && useGroupStore().getterUserHasRole(GroupRole.Guest)"
        icon="sym_r_schedule" data-cy="guest-approval-content" label="Your request to join is pending approval from group admins" />

      <!-- Private group content -->
      <NoContentComponent
        v-if="group && useGroupStore().getterIsPrivateGroup && !useGroupStore().getterUserIsGroupMember() && !useGroupStore().getterUserHasPermission(GroupPermission.SeeGroup)"
        icon="sym_r_error" data-cy="private-group-content" label="It's a private group, join to see the content" />

      <!-- Permission error content -->
      <NoContentComponent v-if="!group && useGroupStore().getterIsPermissionError" data-cy="permission-error-content"
        icon="sym_r_lock" :label="useGroupStore().errorMessage"
        :to="{ name: 'AuthLoginPage', query: { redirect: $route.fullPath } }" buttonLabel="Log in" />

      <!-- No group content (only if it's not a permission error) -->
      <NoContentComponent v-if="!group && !useGroupStore().getterIsPermissionError" data-cy="no-group-content"
        icon="sym_r_error" label="Group not found"
        :to="{ name: 'GroupsPage' }" buttonLabel="Go to groups" />

    </template>

    <!-- Spacer to ensure separation between content and similar events -->
    <div class="spacer-block" style="height: 120px; width: 100%; display: block;"></div>

    <!-- Force similar events to appear at bottom with clear separation -->
    <div class="similar-events-container">
      <GroupSimilarEventsComponent />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute } from 'vue-router'
import { useGroupStore } from '../stores/group-store'
import GroupStickyComponent from '../components/group/GroupStickyComponent.vue'
import GroupLeadComponent from '../components/group/GroupLeadComponent.vue'
import GroupSimilarEventsComponent from '../components/group/GroupSimilarEventsComponent.vue'
import { getImageSrc } from '../utils/imageUtils'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import { GroupPermission, GroupRole } from '../types'
import { useAuthStore } from '../stores/auth-store'
import { storeToRefs } from 'pinia'

const route = useRoute()

const { group } = storeToRefs(useGroupStore())
const groupMounted = ref<boolean>(false)

onBeforeUnmount(() => {
  useGroupStore().$reset()
})

const hasRightPermission = computed(() => {
  return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isFullyAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeGroup))
})

useMeta({
  title: group.value?.name,
  meta: {
    description: { content: group.value?.description },
    'og:image': { content: getImageSrc(group.value?.image) }
  }
})

/**
 * GroupPage - Main group view
 *
 * Responsibilities:
 * - Load group data and metadata
 * - Display group information and navigation
 * - Check permissions for group access
 *
 * Matrix room joining is delegated to MatrixChatGateway component,
 * which is rendered in GroupChatroomPage when the user navigates
 * to the chatroom tab. This ensures consistent room joining logic
 * across all chat contexts (events, groups, DMs).
 */
onMounted(async () => {
  LoadingBar.start()
  try {
    // Load group data - chat room joining is handled by MatrixChatGateway component
    await useGroupStore().actionGetGroup(route.params.slug as string)
  } catch (error) {
    console.error('Error loading group data:', error)
  } finally {
    LoadingBar.stop()
    groupMounted.value = true
  }
})

// const hasPermission = computed(() => {
//   return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeGroup))
// })

onBeforeUnmount(() => {
  useGroupStore().$reset()
})
</script>

<style scoped>
/* Ensure proper layout flow and prevent overlapping */
.router-view-container {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-bottom: 2rem;
  /* Ensure content flows below sticky navigation */
  margin-top: 80px; /* Account for sticky nav height */
}

.similar-events-container {
  position: relative;
  z-index: 1;
  width: 100%;
  clear: both;
  margin-top: 2rem;
  /* Force to bottom and prevent overlay */
  display: block;
  float: none;
}

/* Ensure proper spacing on mobile to prevent overlap with similar events */
@media (max-width: 768px) {
  .router-view-container {
    margin-bottom: 5rem; /* Increase gap before similar events */
  }

  .similar-events-container {
    margin-top: 5rem; /* Increase gap from router content */
  }

  :deep(.c-group-members-page),
  :deep(.c-group-events-page),
  :deep(.c-group-discussions-page) {
    padding-bottom: 300px !important; /* Large padding for member lists */
    min-height: auto; /* Let content determine height naturally */
    margin-bottom: 8rem !important; /* Large bottom margin */
  }
}
</style>
