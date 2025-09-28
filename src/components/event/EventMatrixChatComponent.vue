<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import MatrixNativeChatOrchestrator from '../chat/MatrixNativeChatOrchestrator.vue'
import { matrixClientManager } from '../../services/MatrixClientManager'
import { hasStoredMatrixTokens } from '../../utils/matrixTokenUtils'
import { logger } from '../../utils/logger'

const event = computed(() => useEventStore().event)

const matrixRoomId = ref<string | null>(null)
const retryTimer = ref<number | null>(null)

// Check if Matrix client is connected and ready
const hasMatrixConnection = computed(() => {
  const authStore = useAuthStore()
  if (!authStore.isInitialized || !authStore.user?.slug) {
    logger.debug('Auth store not ready:', {
      isInitialized: authStore.isInitialized,
      hasUserSlug: !!authStore.user?.slug
    })
    return false
  }

  // Check both stored tokens AND active client connection
  const hasTokens = hasStoredMatrixTokens(authStore.user.slug)
  const hasActiveClient = matrixClientManager.getClient() !== null
  const isReady = matrixClientManager.isReady()

  // Get more detailed debug info about why isReady might be false
  const client = matrixClientManager.getClient()
  const readyDetails = client ? {
    isLoggedIn: client.isLoggedIn(),
    syncState: client.getSyncState()
  } : null

  logger.debug('Matrix connection check:', {
    userSlug: authStore.user.slug,
    hasTokens,
    hasActiveClient,
    isReady,
    readyDetails,
    overall: hasTokens && hasActiveClient && isReady
  })

  // For room resolution, we can be less strict than full isReady()
  // We just need client to be logged in, not necessarily fully synced
  const isLoggedIn = client?.isLoggedIn() ?? false
  const isFunctional = hasTokens && hasActiveClient && isLoggedIn

  return isFunctional
})

// Function to attempt room resolution
const attemptRoomResolution = async (slug: string) => {
  if (!slug) {
    matrixRoomId.value = null
    return
  }

  // Check if Matrix client is connected and ready
  if (!hasMatrixConnection.value) {
    logger.debug('Matrix client not connected, skipping room resolution')
    matrixRoomId.value = null

    // Retry in 2 seconds to allow for Matrix client initialization
    if (retryTimer.value) {
      clearTimeout(retryTimer.value)
    }
    retryTimer.value = setTimeout(() => {
      attemptRoomResolution(slug)
    }, 2000) as unknown as number
    return
  }

  try {
    // Use the new unified room resolution method
    matrixRoomId.value = await matrixClientManager.getOrCreateRoom('event', slug)
    logger.debug('Successfully resolved room ID:', matrixRoomId.value)
  } catch (error) {
    logger.error('Failed to get canonical room ID:', error)
    matrixRoomId.value = null
  }
}

// Load canonical room ID when event changes
watch(
  () => event.value?.slug,
  (slug) => {
    // Clear any existing retry timer
    if (retryTimer.value) {
      clearTimeout(retryTimer.value)
      retryTimer.value = null
    }

    // Attempt room resolution
    if (slug) {
      attemptRoomResolution(slug)
    } else {
      matrixRoomId.value = null
    }
  },
  { immediate: true }
)

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

onUnmounted(() => {
  // Clean up retry timer
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }
})

// Retry functionality now handled internally by MatrixChatInterface

const handleExpandChat = () => {}

</script>

<template>
  <div class="c-event-matrix-chat-component" v-if="event && discussionPermissions.canWrite && (event.attendee?.status === 'confirmed' || event.attendee?.status === 'cancelled')">
    <SubtitleComponent label="Chatroom" class="q-mt-lg q-px-md c-event-matrix-chat-component" hide-link />

    <!-- Loading state while resolving room ID (only show if Matrix is connected) -->
    <div v-if="!matrixRoomId && hasMatrixConnection" class="q-pa-md text-center">
      <q-spinner size="2rem" />
      <p class="text-body2 q-mt-sm">Loading chat room...</p>
    </div>

    <!-- Setup orchestrator with single-room mode for focused event chat -->
    <!-- If no Matrix connection, orchestrator will show connection screen -->
    <!-- If room ID is loading and Matrix is connected, show above spinner -->
    <MatrixNativeChatOrchestrator
      v-else-if="event && discussionPermissions.canWrite && (event.attendee?.status === 'confirmed' || event.attendee?.status === 'cancelled')"
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
