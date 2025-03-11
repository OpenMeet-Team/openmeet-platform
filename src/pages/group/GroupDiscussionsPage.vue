<script setup lang="ts">

import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from '../../stores/group-store'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import { GroupPermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import MessagesComponent from '../../components/messages/MessagesComponent.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'

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

    <!-- Discussions Section using new unified MessagesComponent -->
    <MessagesComponent
      v-if="group"
      :room-id="group.roomId"
      context-type="group"
      :context-id="group?.slug || ''"
      :can-read="Boolean(useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeDiscussions))"
      :can-write="Boolean(useGroupStore().getterUserHasPermission(GroupPermission.MessageDiscussion))"
      :can-manage="Boolean(useGroupStore().getterUserHasPermission(GroupPermission.ManageDiscussions))"
    />
  </div>
  <NoContentComponent data-cy="no-permission-group-discussions-page" v-if="!isLoading && group && !hasPermission" label="You don't have permission to see this page" icon="sym_r_group"/>
</template>

<style scoped lang="scss">

</style>
