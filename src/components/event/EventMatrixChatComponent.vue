<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import MatrixChatInterface from '../chat/MatrixChatInterface.vue'
import getEnv from '../../utils/env'
import { generateEventRoomAlias } from '../../utils/matrixUtils'

// Router for navigation
const router = useRouter()

// Removed unused useQuasar
const event = computed(() => useEventStore().event)
// Use Matrix client service directly

// Get the Matrix room ID from the event - try different properties
const matrixRoomId = computed(() => {
  if (!event.value?.slug) {
    console.log('🔍 No event slug available')
    return null
  }

  // First check if we have a cached room ID (efficient)
  if (event.value.roomId) {
    console.log('✅ Using cached room ID:', event.value.roomId)
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

    console.log('🏠 Generated fresh room alias (no cached room ID):', roomAlias)
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
  console.log('Computing discussion permissions:', {
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
  console.log('🏗️ EventMatrixChatComponent mounted for event:', event.value?.slug)
})

// Retry functionality now handled internally by MatrixChatInterface

// Handle expand event to navigate to chats page with focus on current room
const handleExpandChat = () => {
  router.push({
    name: 'DashboardChatsPage',
    query: {
      chat: matrixRoomId.value || event.value?.slug,
      return: router.currentRoute.value.fullPath
    }
  })
}

</script>

<template>
  <div class="c-event-matrix-chat-component" v-if="event && discussionPermissions.canWrite && (event.attendee?.status === 'confirmed' || event.attendee?.status === 'cancelled')">
    <SubtitleComponent label="Chatroom" class="q-mt-lg q-px-md c-event-matrix-chat-component" hide-link />

    <!-- Single unified chat interface - handles all connection logic internally -->
    <MatrixChatInterface
      v-if="event && discussionPermissions.canWrite && (event.attendee?.status === 'confirmed' || event.attendee?.status === 'cancelled')"
      :room-id="matrixRoomId"
      context-type="event"
      :context-id="event?.slug ?? ''"
      mode="inline"
      height="500px"
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
