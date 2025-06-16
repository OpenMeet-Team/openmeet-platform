<script setup lang="ts">

import { GroupEntity, GroupPermission } from '../../types'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useGroupStore } from '../../stores/group-store'
import MessagesComponent from '../messages/MessagesComponent.vue'
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
      <MessagesComponent v-if="group"
        :room-id="group.roomId || group.slug || ''"
        context-type="group"
        :context-id="group?.slug || ''"
        :context-entity="group"
        :can-read="!!canRead"
        :can-write="!!useGroupStore().getterUserHasPermission(GroupPermission.MessageDiscussion)"
        :can-manage="!!useGroupStore().getterUserHasPermission(GroupPermission.ManageDiscussions)"
      />
  </q-card>

</template>

<style scoped lang="scss">

</style>
