<script setup lang="ts">
import { computed } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import DiscussionComponent from '../discussion/DiscussionComponent.vue'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import { MatrixMessage } from '../../types/matrix'

const event = computed(() => useEventStore().event)

// Convert messages to MatrixMessage format if needed
const getMatrixMessages = computed(() => {
  if (!event.value?.messages) return [] as MatrixMessage[]

  // Check if messages are already in Matrix format
  if (event.value.messages.length > 0 && 'event_id' in event.value.messages[0]) {
    return event.value.messages as unknown as MatrixMessage[]
  }

  // Convert from Zulip format to Matrix format
  return event.value.messages.map(msg => {
    if ('id' in msg && !('event_id' in msg)) {
      // This is a Zulip message, convert to Matrix format
      return {
        event_id: String(msg.id),
        room_id: event.value?.slug || '',
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
  <div class="c-event-topics-component" v-if="event">
    <SubtitleComponent :count="event.topics?.length" label="Comments" class="q-mt-lg q-px-md c-event-topics-component" hide-link />

    <DiscussionComponent v-if="event.messages && event.topics" :messages="getMatrixMessages" :topics="event?.topics ?? []" :context-type="'event'"
      :context-id="event?.slug ?? ''" :permissions="{
      canRead: Boolean(useEventStore().getterIsPublicEvent || (useEventStore().getterIsAuthenticatedEvent && useAuthStore().isAuthenticated) || useEventStore().getterUserHasPermission(EventAttendeePermission.ViewDiscussion)),
      canWrite: !!useEventStore().getterUserHasPermission(EventAttendeePermission.CreateDiscussion),
      canManage: !!useEventStore().getterUserHasPermission(EventAttendeePermission.ManageDiscussions)
    }" />

    <NoContentComponent v-else icon="sym_r_error" label="No comments yet" />
  </div>
</template>
