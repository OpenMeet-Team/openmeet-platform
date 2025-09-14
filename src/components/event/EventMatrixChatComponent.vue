<script setup lang="ts">
import { computed, onMounted } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import MatrixNativeChatOrchestrator from '../chat/MatrixNativeChatOrchestrator.vue'
import getEnv from '../../utils/env'
import { generateEventRoomAlias } from '../../utils/matrixUtils'
import { logger } from '../../utils/logger'

const event = computed(() => useEventStore().event)

// Get the Matrix room ID from the event - try different properties
const matrixRoomId = computed(() => {
  if (!event.value?.slug) {
    logger.debug('🔍 No event slug available')
    return null
  }

  // First check if we have a cached room ID (efficient)
  if (event.value.roomId) {
    logger.debug('✅ Using cached room ID:', event.value.roomId)
    return event.value.roomId
  }

  // Fallback: generate room alias dynamically (fresh)
  const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
  if (!tenantId) {
    console.error('❌ No tenant ID available for room alias generation')
    return null
  }

  try {
    const roomAlias = generateEventRoomAlias(event.value.slug, tenantId)

    logger.debug('🏠 Generated fresh room alias (no cached room ID):', roomAlias)
    return roomAlias
  } catch (error) {
    console.error('❌ Failed to generate room alias:', error)
    return null
  }
})

// Permissions for the discussion
const discussionPermissions = computed(() => {
  // Get a fresh reference to the store each time for reactivity
  const eventStore = useEventStore()
  const authStore = useAuthStore()

  // Get the current attendee status
  const attendeeStatus = eventStore.event?.attendee?.status

  // Log permissions state for debugging
  logger.debug('Computing discussion permissions:', {
    attendeeStatus,
    isAuthenticated: authStore.isAuthenticated,
    isPublicEvent: eventStore.getterIsPublicEvent,
    viewPermission: eventStore.getterUserHasPermission(EventAttendeePermission.ViewDiscussion),
    createPermission: eventStore.getterUserHasPermission(EventAttendeePermission.CreateDiscussion),
    managePermission: eventStore.getterUserHasPermission(EventAttendeePermission.ManageDiscussions)
  })

  // Special case: if user is confirmed or cancelled attendee and authenticated, always grant write permission
  const isConfirmedOrCancelledAttendee = authStore.isAuthenticated && (attendeeStatus === 'confirmed' || attendeeStatus === 'cancelled')

  return {
    canRead: Boolean(
      eventStore.getterIsPublicEvent ||
      (eventStore.getterIsAuthenticatedEvent && authStore.isAuthenticated) ||
      eventStore.getterUserHasPermission(EventAttendeePermission.ViewDiscussion) ||
      isConfirmedOrCancelledAttendee
    ),
    // Grant writing permission if user has explicit permission OR is a confirmed/cancelled attendee
    canWrite: Boolean(
      eventStore.getterUserHasPermission(EventAttendeePermission.CreateDiscussion) ||
      isConfirmedOrCancelledAttendee
    ),
    canManage: !!eventStore.getterUserHasPermission(EventAttendeePermission.ManageDiscussions)
  }
})

// Simplified - MatrixChatInterface handles all connection logic internally

// Matrix connection is now handled internally by MatrixChatInterface

// Component mounting - simplified since MatrixChatInterface handles initialization
onMounted(() => {
  logger.debug('🏗️ EventMatrixChatComponent mounted for event:', event.value?.slug)
  logger.debug('🔍 Event attendance status:', event.value?.attendee?.status)
  logger.debug('🔍 Discussion permissions:', discussionPermissions.value)
  logger.debug('🔍 Matrix room ID:', matrixRoomId.value)
  logger.debug('🔍 Should show MatrixNativeChatOrchestrator?', {
    hasEvent: !!event.value,
    canWrite: discussionPermissions.value.canWrite,
    isConfirmedOrCancelled: event.value?.attendee?.status === 'confirmed' || event.value?.attendee?.status === 'cancelled'
  })
})

// Retry functionality now handled internally by MatrixChatInterface

const handleExpandChat = () => {}

</script>

<template>
  <div class="c-event-matrix-chat-component" v-if="event && discussionPermissions.canWrite && (event.attendee?.status === 'confirmed' || event.attendee?.status === 'cancelled')">
    <SubtitleComponent label="Chatroom" class="q-mt-lg q-px-md c-event-matrix-chat-component" hide-link />

    <!-- Setup orchestrator with single-room mode for focused event chat -->
    <MatrixNativeChatOrchestrator
      v-if="event && discussionPermissions.canWrite && (event.attendee?.status === 'confirmed' || event.attendee?.status === 'cancelled')"
      context-type="event"
      :context-id="event?.slug ?? ''"
      mode="single-room"
      :inline-room-id="matrixRoomId"
      @expand="handleExpandChat"
    />

    <!-- Permission/eligibility messages only -->
    <div v-else class="q-pa-md">
      <q-banner class="bg-grey-7 text-white">
        <div>
          <p v-if="!useAuthStore().isAuthenticated">Please <q-btn flat dense no-caps color="white" label="sign in" to="/auth/login" /> to enable chat.</p>
          <p v-else-if="!discussionPermissions.canWrite">You don't have permission to participate in discussions for this event.</p>
          <p v-else-if="!event?.attendee">You need to be an attendee of this event to participate in discussions.</p>
          <p v-else-if="event?.attendee?.status !== 'confirmed' && event?.attendee?.status !== 'cancelled'">Your attendance request is still pending. Once approved, you'll be able to join the discussion.</p>
          <p v-else>Chat is not available.</p>
        </div>
      </q-banner>
    </div>
  </div>
  <!-- Message about chat being unavailable for non-confirmed attendees -->
  <div class="c-event-matrix-chat-component" v-else-if="event">
    <SubtitleComponent label="Chatroom" class="q-mt-lg q-px-md c-event-matrix-chat-component" hide-link />
    <q-banner class="bg-info text-white q-mt-md">
      <p>Chat is only available to confirmed attendees. Please RSVP and get confirmed to participate in the discussion.</p>
    </q-banner>
  </div>
</template>
