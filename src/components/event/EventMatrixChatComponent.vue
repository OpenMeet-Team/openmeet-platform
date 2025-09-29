<script setup lang="ts">
import { computed } from 'vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import MatrixChatGateway from '../chat/MatrixChatGateway.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'

const eventStore = useEventStore()
const authStore = useAuthStore()
const event = computed(() => eventStore.event)

// Permissions for the discussion
const discussionPermissions = computed(() => {
  // Get the current attendee status
  const attendeeStatus = eventStore.event?.attendee?.status

  // Special case: if user is confirmed or cancelled attendee and authenticated, always grant write permission
  const isConfirmedOrCancelledAttendee = authStore.isAuthenticated && (attendeeStatus === 'confirmed' || attendeeStatus === 'cancelled')

  return {
    canRead: Boolean(
      eventStore.getterIsPublicEvent ||
      (eventStore.getterIsAuthenticatedEvent && authStore.isAuthenticated) ||
      eventStore.getterUserHasPermission(EventAttendeePermission.ViewDiscussion) ||
      isConfirmedOrCancelledAttendee
    ),
    canWrite: Boolean(
      eventStore.getterUserHasPermission(EventAttendeePermission.CreateDiscussion) ||
      isConfirmedOrCancelledAttendee
    ),
    canManage: !!eventStore.getterUserHasPermission(EventAttendeePermission.ManageDiscussions)
  }
})

// Access check function for the gateway
const checkEventAccess = () => {
  const attendeeStatus = event.value?.attendee?.status
  return attendeeStatus === 'confirmed' || attendeeStatus === 'cancelled'
}
</script>

<template>
  <div class="c-event-matrix-chat-component" v-if="event">
    <!-- Full chat access for confirmed/cancelled attendees -->
    <MatrixChatGateway
      v-if="discussionPermissions.canWrite && checkEventAccess()"
      context-type="event"
      :context-id="event.slug"
      subtitle="Chatroom"
    />

    <!-- Read-only access message -->
    <div v-else-if="discussionPermissions.canRead" class="q-mt-lg">
      <SubtitleComponent label="Chatroom" class="q-px-md" hide-link />
      <q-banner class="bg-info text-white q-mt-md">
        <p>Chat is only available to confirmed attendees. Please RSVP and get confirmed to participate in the discussion.</p>
      </q-banner>
    </div>

    <!-- No access message -->
    <div v-else-if="!useAuthStore().isAuthenticated" class="q-mt-lg">
      <SubtitleComponent label="Chatroom" class="q-px-md" hide-link />
      <q-banner class="bg-grey-7 text-white q-mt-md">
        <div>
          <p>Please <q-btn flat dense no-caps color="white" label="sign in" to="/auth/login" /> to enable chat.</p>
        </div>
      </q-banner>
    </div>

    <!-- Permission denied -->
    <div v-else class="q-mt-lg">
      <SubtitleComponent label="Chatroom" class="q-px-md" hide-link />
      <q-banner class="bg-grey-7 text-white q-mt-md">
        <div>
          <p>You don't have permission to participate in discussions for this event.</p>
        </div>
      </q-banner>
    </div>
  </div>
</template>
