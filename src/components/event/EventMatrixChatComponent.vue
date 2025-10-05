<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import MatrixChatGateway from '../chat/MatrixChatGateway.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'

const route = useRoute()
const eventStore = useEventStore()
const authStore = useAuthStore()
const event = computed(() => eventStore.event)

// Debug logging to track route vs store slug
const eventSlug = computed(() => {
  const routeSlug = route.params.slug as string
  const storeSlug = event.value?.slug
  console.log('🎯 EventMatrixChatComponent: Event slug resolution:', {
    routeSlug,
    storeEventSlug: storeSlug,
    usingSlug: storeSlug || routeSlug,
    match: routeSlug === storeSlug,
    timestamp: new Date().toISOString()
  })
  // Using store event slug (original behavior before fix)
  return storeSlug
})

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
      :context-id="eventSlug"
      subtitle="Chatroom"
    />

    <!-- Read-only access message -->
    <div v-else-if="discussionPermissions.canRead" class="q-mt-lg">
      <SubtitleComponent label="Chatroom" class="q-px-md" hide-link />
      <q-banner class="bg-info text-white q-mt-md" rounded>
        <template v-slot:avatar>
          <q-icon name="sym_r_lock" size="md" />
        </template>
        <div class="text-body1">
          <div class="text-weight-bold q-mb-xs">Chat Locked</div>
          <div>RSVP above <q-icon name="sym_r_arrow_upward" /> to unlock chat and join the conversation!</div>
        </div>
      </q-banner>
    </div>

    <!-- No access message -->
    <div v-else-if="!useAuthStore().isAuthenticated" class="q-mt-lg">
      <SubtitleComponent label="Chatroom" class="q-px-md" hide-link />
      <q-banner class="bg-grey-7 text-white q-mt-md" rounded>
        <template v-slot:avatar>
          <q-icon name="sym_r_login" size="md" />
        </template>
        <div class="text-body1">
          <div class="text-weight-bold q-mb-xs">Sign In Required</div>
          <div>
            Please <q-btn flat dense no-caps color="white" label="sign in" to="/auth/login" class="text-underline" /> to RSVP and access chat.
          </div>
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
