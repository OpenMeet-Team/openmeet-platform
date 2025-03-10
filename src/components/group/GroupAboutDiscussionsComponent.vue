<script setup lang="ts">

import { GroupEntity, GroupPermission } from '../../types'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useGroupStore } from '../../stores/group-store'
import DiscussionComponent from '../discussion/DiscussionComponent.vue'
import { useAuthStore } from '../../stores/auth-store'
import { computed } from 'vue'
import { MatrixMessage } from '../../types/matrix'

interface Props {
  group?: GroupEntity
}

const canRead = computed(() => {
  return useGroupStore().getterIsPublicGroup || ((useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated) || useGroupStore().getterUserHasPermission(GroupPermission.SeeDiscussions))
})

const props = defineProps<Props>()

// Convert messages to MatrixMessage format if needed
const getMatrixMessages = computed(() => {
  if (!props.group?.messages) return [] as MatrixMessage[]

  // Check if messages are already in Matrix format
  if (props.group.messages.length > 0 && 'event_id' in props.group.messages[0]) {
    return props.group.messages as unknown as MatrixMessage[]
  }

  // Convert from Zulip format to Matrix format
  return props.group.messages.map(msg => {
    if ('id' in msg && !('event_id' in msg)) {
      // This is a Zulip message, convert to Matrix format
      return {
        event_id: String(msg.id),
        room_id: props.group?.slug || '',
        sender: String(msg.sender_id),
        content: {
          msgtype: 'm.text',
          body: msg.content,
          topic: msg.subject
        },
        origin_server_ts: msg.timestamp,
        type: 'm.room.message'
      } as MatrixMessage
    }
    return msg as unknown as MatrixMessage
  })
})
</script>

<template>
  <SubtitleComponent class="q-px-md q-mt-lg" label="Discussions" :to="{ name: 'GroupDiscussionsPage' }" />

  <q-card class="q-mt-md q-pb-sm" flat>
      <DiscussionComponent v-if="group && group.topics && group.messages" :messages="getMatrixMessages" :topics="group?.topics || []" :context-type="'group'" :context-id="group?.slug || ''" :permissions="{
        canRead: !!canRead,
        canWrite: !!useGroupStore().getterUserHasPermission(GroupPermission.MessageDiscussion),
        canManage: !!useGroupStore().getterUserHasPermission(GroupPermission.ManageDiscussions)
      }" />
  </q-card>

</template>

<style scoped lang="scss">

</style>
