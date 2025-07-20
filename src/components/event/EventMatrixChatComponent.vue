<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import { matrixClientService } from '../../services/matrixClientService'
import MatrixChatInterface from '../chat/MatrixChatInterface.vue'
import getEnv from '../../utils/env'

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
  if (!event.value) {
    console.log('🔍 No event data available')
    return null
  }

  console.log('🔍 Event data:', {
    slug: event.value.slug,
    name: event.value.name,
    roomId: event.value.roomId,
    messagesCount: event.value.messages?.length || 0,
    fullEventObject: event.value // DEBUG: Log full event to see all properties
  })

  // Check for matrixRoomId first (this is the correct field from API)
  if (event.value.matrixRoomId) {
    console.log('✅ Found matrixRoomId on event object:', event.value.matrixRoomId)
    return event.value.matrixRoomId
  }

  // Fallback: Check if we have a roomId property (legacy)
  if (event.value.roomId) {
    console.log('✅ Found roomId on event object:', event.value.roomId)
    return event.value.roomId
  }

  // Check if we have a roomId in event messages
  if (event.value.messages && event.value.messages.length > 0) {
    // Loop through messages to find the first with a room_id field
    for (const message of event.value.messages) {
      if (message.room_id) {
        console.log('✅ Found room_id in message:', message.room_id)
        return message.room_id
      }
    }
  }

  // At this point, we don't have a valid room ID, so return null
  console.log('❌ No Matrix room ID found for event:', event.value.slug)
  console.log('💡 This might mean the Matrix room was not created or is not exposed in the API response')
  console.log('💡 Event properties:', Object.keys(event.value))
  return null
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

// Simple room initialization using pure Matrix JS SDK pattern
const ensureChatRoomExists = async () => {
  console.log('🏗️ DEBUG: ensureChatRoomExists called')
  console.log('🏗️ DEBUG: event.value:', !!event.value)
  console.log('🏗️ DEBUG: event.value.slug:', event.value?.slug)
  console.log('🏗️ DEBUG: matrixRoomId.value:', matrixRoomId.value)
  console.log('🏗️ DEBUG: attendee status:', event.value?.attendee?.status)
  console.log('🏗️ DEBUG: discussionPermissions.canWrite:', discussionPermissions.value.canWrite)

  if (!event.value || !event.value.slug) {
    console.log('❌ Cannot initialize - missing event or slug')
    console.log('❌ Missing: event=', !event.value, 'slug=', !event.value?.slug)
    return false
  }

  // Matrix-native approach: Use room aliases, no need to store room IDs
  // The Matrix Application Service will create rooms on-demand when accessed
  console.log('🏠 Using Matrix-native approach with room aliases - no backend API calls needed')

  // Generate room alias for this event
  const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
  if (!tenantId) {
    console.error('❌ No tenant ID available')
    return false
  }

  // Early return if user is not a confirmed or cancelled attendee
  if ((event.value.attendee?.status !== 'confirmed' && event.value.attendee?.status !== 'cancelled') || !discussionPermissions.value.canWrite) {
    console.log('❌ Not initializing chat room - user is not a confirmed or cancelled attendee or lacks permissions')
    console.log('❌ Status check: attendee status=', event.value.attendee?.status, 'canWrite=', discussionPermissions.value.canWrite)
    return false
  }

  try {
    isInitializing.value = true
    console.log('🏗️ Phase 2: Initializing Matrix room using pure SDK pattern')

    // Ensure Matrix client is connected
    const client = await matrixClientService.initializeClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // First, check if room is already available
    const room = matrixClientService.getRoom(matrixRoomId.value)
    if (room) {
      console.log('✅ Room already available:', room.roomId)
      return true
    }

    // Matrix-native approach: Join room directly using room alias
    // The Matrix Application Service will create the room on-demand if it doesn't exist
    console.log('🏠 Room not found, joining via Matrix-native room alias')
    try {
      const { generateEventRoomAlias } = await import('../../utils/matrixUtils')
      const roomAlias = generateEventRoomAlias(event.value.slug, tenantId)

      console.log('🏠 Generated room alias:', roomAlias)

      // Join the room using the alias - this will trigger Application Service room creation
      const joinResult = await matrixClientService.joinEventChatRoom(event.value.slug)

      if (joinResult.room) {
        console.log('✅ Room joined via Matrix-native approach:', joinResult.room.roomId)
        return true
      } else {
        console.error('❌ Failed to join room via Matrix-native approach')
        return false
      }
    } catch (error) {
      console.error('❌ Error joining room via Matrix-native approach:', error)
      return false
    }
  } catch (error) {
    console.error('❌ Error initializing Matrix room:', error)
    return false
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

// Simplified component mounting with Matrix SDK pattern
onMounted(async () => {
  if (event.value && event.value.slug) {
    console.log('🏗️ Phase 2: EventMatrixChatComponent mounted for event:', event.value.slug)

    try {
      isLoading.value = true

      // Only initialize if user is confirmed/cancelled attendee with permissions
      if ((event.value.attendee?.status === 'confirmed' || event.value.attendee?.status === 'cancelled') && discussionPermissions.value.canWrite) {
        await ensureChatRoomExists()
        window.addEventListener('attendee-status-changed', handleAttendeeStatusChanged)
      } else {
        console.log('Not initializing chat - user lacks required status or permissions')
      }
    } catch (err) {
      console.error('❌ Error in Matrix chat initialization:', err)
    } finally {
      isLoading.value = false
    }
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
      await ensureChatRoomExists()
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
      v-if="!isLoading && matrixRoomId && discussionPermissions.canRead"
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
