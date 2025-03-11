<script setup lang="ts">
import { computed } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import DiscussionComponent from '../discussion/DiscussionComponent.vue'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'

const event = computed(() => useEventStore().event)

// Permissions for the discussion
const discussionPermissions = computed(() => ({
  canRead: Boolean(
    useEventStore().getterIsPublicEvent ||
    (useEventStore().getterIsAuthenticatedEvent && useAuthStore().isAuthenticated) ||
    useEventStore().getterUserHasPermission(EventAttendeePermission.ViewDiscussion)
  ),
  canWrite: !!useEventStore().getterUserHasPermission(EventAttendeePermission.CreateDiscussion),
  canManage: !!useEventStore().getterUserHasPermission(EventAttendeePermission.ManageDiscussions)
}))

</script>

<template>
  <div class="c-event-topics-component" v-if="event">
    <SubtitleComponent label="Comments" class="q-mt-lg q-px-md c-event-topics-component" hide-link />

    <DiscussionComponent
      :context-type="'event'"
      :context-id="event?.slug ?? ''"
      :permissions="discussionPermissions"
    />
  </div>
</template>
