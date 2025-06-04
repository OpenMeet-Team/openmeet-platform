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
      <router-view v-if="groupMounted && hasRightPermission" />

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

    <GroupSimilarEventsComponent />
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
import { chatApi } from '../api/chat'

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

onMounted(async () => {
  LoadingBar.start()
  try {
    // First load group data
    await useGroupStore().actionGetGroup(route.params.slug as string)

    // Then check if user is a member of the group
    const isMember = useGroupStore().getterUserHasPermission(GroupPermission.SeeGroup)
    const isAuthenticated = useAuthStore().isFullyAuthenticated
    const groupSlug = route.params.slug as string

    console.log('Group loaded, checking membership status:', {
      isMember,
      isAuthenticated,
      groupSlug
    })

    // If user is a member and authenticated, join the group chat room
    if (isMember && isAuthenticated) {
      try {
        console.log('User is a member of group, joining group chat room')
        const userSlug = useAuthStore().user?.slug

        if (userSlug) {
          console.log(`Joining chat room for group ${groupSlug} with user ${userSlug}`)
          const joinResult = await chatApi.joinGroupChatRoom(groupSlug)
          console.log('Group chat room join result:', joinResult.data)

          if (joinResult.data?.roomId) {
            console.log(`Successfully joined Matrix room for group: ${joinResult.data.roomId}`)
          }
        }
      } catch (err) {
        // Non-critical error, just log it but don't interrupt page load
        console.error('Failed to auto-join group chat room:', err)
      }
    } else {
      console.log('User is not a member or not authenticated, skipping chat room join')
    }
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

<style scoped></style>
