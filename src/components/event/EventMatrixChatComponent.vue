<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import { matrixClientService } from '../../services/matrixClientService'
import MatrixChatInterface from '../chat/MatrixChatInterface.vue'
import getEnv from '../../utils/env'
import { generateEventRoomAlias } from '../../utils/matrixUtils'

// Add type declaration for global window property
declare global {
  interface Window {
    chatRoomInitializations?: Record<string, 'in-progress' | 'completed' | null>;
    lastEventDiscussionCheck?: number;
    lastChatPermissionStatus?: Record<string, string | undefined>;
    lastChatInitAttempt?: Record<string, number>; // Add timestamp tracking for throttling
    eventBeingLoaded?: string | null; // Track which event is currently being loaded
  }
}

// Removed unused globalWindow variable - simplified in Phase 2

// Removed unused useQuasar
const event = computed(() => useEventStore().event)
const eventStore = useEventStore()
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

// Loading states
const isLoading = ref(false)
const isInitializing = ref(false)

// Reactive state for Matrix service status
const isMatrixClientReady = ref(matrixClientService.isReady())

// Check if chat should be shown
const shouldShowChat = computed(() => {
  // Only show chat for confirmed/cancelled attendees with read permissions
  if (!event.value ||
      (event.value.attendee?.status !== 'confirmed' && event.value.attendee?.status !== 'cancelled') ||
      !discussionPermissions.value.canRead) {
    console.log('🚫 Not showing chat - ineligible user')
    return false
  }

  // Show if Matrix client is ready and we have a room ID
  const hasRoomId = !!matrixRoomId.value
  return isMatrixClientReady.value && hasRoomId
})

// Initialize Matrix connection and room when user has chosen to connect
const initializeMatrixRoom = async () => {
  if (!event.value?.slug) {
    console.error('❌ Cannot initialize Matrix room: no event slug')
    return false
  }

  try {
    isInitializing.value = true
    console.log('🏗️ Initializing Matrix room for event:', event.value.slug)

    // Initialize Matrix client (this will redirect to consent if needed)
    const client = await matrixClientService.initializeClient(true)
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Check if room is already available
    const room = matrixClientService.getRoom(matrixRoomId.value)
    if (room) {
      console.log('✅ Matrix room already available:', room.roomId)
      return true
    }

    // Join/create room via event store
    console.log('🏠 Joining Matrix room via event store')
    await eventStore.actionJoinEventChatRoom()
    console.log('✅ Successfully joined Matrix room')

    return true
  } catch (error) {
    console.error('❌ Matrix room initialization failed:', error)
    throw error
  } finally {
    isInitializing.value = false
  }
}

// Define interface for the custom event detail
interface AttendeeStatusChangeDetail {
  eventSlug: string;
  status: string;
  timestamp: number;
}

// Define interface for our custom event
interface AttendeeStatusChangeEvent extends Event {
  detail: AttendeeStatusChangeDetail;
}

// Simplified attendance status change handler using Matrix SDK
const handleAttendeeStatusChanged = (e: Event) => {
  if (!e || !('detail' in e)) return

  const customEvent = e as AttendeeStatusChangeEvent
  const { eventSlug, status } = customEvent.detail
  console.log(`🔄 Attendance status changed: ${eventSlug}, status=${status}`)

  // Only react if this is for our current event
  if (useEventStore().event?.slug === eventSlug) {
    console.log('🏗️ Phase 2: Handling status change with simplified Matrix SDK approach')

    isLoading.value = true

    setTimeout(async () => {
      try {
        // For confirmed/cancelled status, trigger full retry including backend invitation
        if (status === 'confirmed' || status === 'cancelled') {
          console.log('🎯 User confirmed/cancelled - triggering backend invitation retry')
          await retryRoomInitialization()
        }
      } catch (error) {
        console.error('❌ Error handling attendance status change:', error)
      } finally {
        isLoading.value = false
      }
    }, 300)
  }
}

// Component mounting - initialize Matrix if user has already chosen to connect
onMounted(async () => {
  if (!event.value?.slug) {
    console.log('🚫 No event available for Matrix chat component')
    return
  }

  console.log('🏗️ EventMatrixChatComponent mounted for event:', event.value.slug)

  // Add event listener for attendee status changes
  window.addEventListener('attendee-status-changed', handleAttendeeStatusChanged)

  // Auto-connect eligible users only if they have previously connected to Matrix
  if (event.value &&
      (event.value.attendee?.status === 'confirmed' || event.value.attendee?.status === 'cancelled') &&
      discussionPermissions.value.canRead &&
      matrixClientService.hasStoredSession()) {
    console.log('✅ Auto-connecting returning user to Matrix chat')
    try {
      isLoading.value = true
      await initializeMatrixRoom()
    } catch (error) {
      console.error('❌ Error auto-connecting to Matrix room:', error)
    } finally {
      isLoading.value = false
    }
  } else {
    console.log('💭 User not eligible for auto-connect to Matrix (first-time user or not eligible)')
  }
})

// Remove event listener when component is unmounted
onBeforeUnmount(() => {
  window.removeEventListener('attendee-status-changed', handleAttendeeStatusChanged)
  console.log('Removed attendee-status-changed event listener')
})

// Simplified retry using pure Matrix SDK pattern with backend invitation retry
const retryRoomInitialization = async () => {
  if (!event.value) {
    console.warn('⚠️ Cannot retry - no event data available')
    return
  }

  try {
    isInitializing.value = true
    console.log('🔄 Retrying Matrix room initialization')

    // Step 1: Ensure Matrix client is connected
    await matrixClientService.connectToMatrix()
    console.log('✅ Matrix client connected')

    // Step 2: Refresh event data to get latest room ID
    console.log('🔄 Refreshing event data to get updated Matrix room ID')
    await eventStore.actionGetEventBySlug(event.value.slug)

    // Give a moment for the reactive data to update
    await new Promise(resolve => setTimeout(resolve, 500))

    // Step 3: If we now have a room ID, try to initialize (this will handle backend invitation internally)
    if (matrixRoomId.value) {
      console.log('✅ Found Matrix room ID after refresh, initializing chat')
      await initializeMatrixRoom()
    } else {
      console.warn('⚠️ Matrix room ID still not available after event refresh')
    }
  } catch (error) {
    console.error('❌ Error retrying room initialization:', error)
    // Show user-friendly error message could be added here
  } finally {
    isInitializing.value = false
  }
}

</script>

<template>
  <div class="c-event-matrix-chat-component" v-if="event && discussionPermissions.canWrite && (event.attendee?.status === 'confirmed' || event.attendee?.status === 'cancelled')">
    <SubtitleComponent label="Comments" class="q-mt-lg q-px-md c-event-matrix-chat-component" hide-link />

    <!-- Loading indicator -->
    <div class="q-pa-md text-center" v-if="isLoading">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <MatrixChatInterface
      v-else-if="shouldShowChat"
      :room-id="matrixRoomId"
      context-type="event"
      :context-id="event?.slug ?? ''"
      mode="inline"
      height="500px"
    />

    <!-- Fallback when no roomId is available -->
    <div v-else class="q-pa-md">
      <q-banner class="bg-warning text-white">
        <div>
          <p>Chat functionality is currently unavailable for this event.</p>
          <p v-if="!useAuthStore().isAuthenticated">Please <q-btn flat dense no-caps color="white" label="sign in" to="/auth/login" /> to enable chat.</p>
          <p v-else-if="!discussionPermissions.canWrite">You don't have permission to participate in discussions for this event.</p>
          <p v-else-if="!event?.attendee">You need to be an attendee of this event to participate in discussions.</p>
          <p v-else-if="event?.attendee?.status !== 'confirmed' && event?.attendee?.status !== 'cancelled'">Your attendance request is still pending. Once approved, you'll be able to join the discussion.</p>
          <p v-else>
            <span>The chat room could not be initialized. The discussion service may be temporarily unavailable.</span>
            <span v-if="isInitializing"> Attempting to connect...</span>
          </p>

        </div>
        <template v-slot:action v-if="discussionPermissions.canWrite && (event?.attendee?.status === 'confirmed' || event?.attendee?.status === 'cancelled')">
          <q-btn
            flat
            color="white"
            label="Retry"
            :loading="isInitializing"
            @click="retryRoomInitialization"
          />
        </template>
      </q-banner>
    </div>
  </div>
  <!-- Message about chat being unavailable for non-confirmed attendees -->
  <div class="c-event-matrix-chat-component" v-else-if="event">
    <SubtitleComponent label="Comments" class="q-mt-lg q-px-md c-event-matrix-chat-component" hide-link />
    <q-banner class="bg-info text-white q-mt-md">
      <p>Chat is only available to confirmed attendees. Please RSVP and get confirmed to participate in the discussion.</p>
    </q-banner>
  </div>
</template>
