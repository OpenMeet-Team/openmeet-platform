<script setup lang="ts">

import { GroupEntity, GroupPermission } from '../../types'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useGroupStore } from '../../stores/group-store'
import DiscussionComponent from '../discussion/DiscussionComponent.vue'
import { useAuthStore } from '../../stores/auth-store'
import { computed } from 'vue'
interface Props {
  group?: GroupEntity
}

const canRead = computed(() => {
  return useGroupStore().getterIsPublicGroup || ((useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeDiscussions))
})

defineProps<Props>()
</script>

<template>
  <SubtitleComponent class="q-px-md q-mt-lg" label="Discussions" :to="{ name: 'GroupDiscussionsPage' }" />

  <q-card class="q-mt-md q-pb-sm" flat>
      <DiscussionComponent v-if="group && group.topics && group.messages" :messages="group?.messages || []" :topics="group?.topics || []" :context-type="'group'" :context-id="group?.slug || ''" :permissions="{
        canRead: !!canRead,
        canWrite: !!useGroupStore().getterUserHasPermission(GroupPermission.MessageDiscussion),
        canManage: !!useGroupStore().getterUserHasPermission(GroupPermission.ManageDiscussions)
      }" />
  </q-card>

</template>

<style scoped lang="scss">

</style>
