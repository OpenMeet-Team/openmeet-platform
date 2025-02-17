<script setup lang="ts">

import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from '../../stores/group-store'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import { GroupPermission } from '../../types'
import DiscussionComponent from '../../components/discussion/DiscussionComponent.vue'
import { useAuthStore } from '../../stores/auth-store'

const group = computed(() => useGroupStore().group)
const hasPermission = computed(() => {
  return group.value && (useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeDiscussions))
})

const isLoading = ref(false)

onMounted(async () => {
  if (group.value && hasPermission.value) {
    isLoading.value = true
    await useGroupStore().actionGetGroupDiscussions(group.value.slug).finally(() => (isLoading.value = false))
  }
})

</script>

<template>
  <SpinnerComponent v-if="isLoading" />
  <div data-cy="group-discussions-page" v-if="!isLoading && group && hasPermission">
    <SubtitleComponent class="q-mt-lg q-px-md" label="Discussions" :count="group?.topics?.length" hide-link />

    <!-- Discussions Section -->
    <DiscussionComponent v-if="group.topics && group.messages" :messages="group?.messages || []" :topics="group?.topics || []" :context-type="'group'" :context-id="group?.slug || ''" :permissions="{
      canRead: Boolean(useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeDiscussions)),
      canWrite: Boolean(useGroupStore().getterUserHasPermission(GroupPermission.MessageDiscussion)),
      canManage: Boolean(useGroupStore().getterUserHasPermission(GroupPermission.ManageDiscussions))
    }" />
  </div>
  <NoContentComponent data-cy="no-permission-group-discussions-page" v-if="!isLoading && group && !hasPermission" label="You don't have permission to see this page" icon="sym_r_group"/>
</template>

<style scoped lang="scss">

</style>
