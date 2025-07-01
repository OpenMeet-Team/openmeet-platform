<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import { matrixClientService } from '../../services/matrixClientService'
import MatrixChatInterface from '../chat/MatrixChatInterface.vue'

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

// Variable for safe window access
const globalWindow = window as Window & typeof globalThis

// Removed unused useQuasar
const event = computed(() => useEventStore().event)
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
    messagesCount: event.value.messages?.length || 0
  })

  // Check if we have a proper roomId on the event object
  if (event.value.roomId) {
    console.log('✅ Found roomId on event object:', event.value.roomId)
    return event.value.roomId
  }

  // Only roomId property exists on EventEntity - no separate matrixRoomId property

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

// Function to automatically initialize the chat room without sending a welcome message
const ensureChatRoomExists = async () => {
  if (!event.value || !event.value.slug) return false

  // Early return if user is not a confirmed or cancelled attendee
  if ((event.value.attendee?.status !== 'confirmed' && event.value.attendee?.status !== 'cancelled') || !discussionPermissions.value.canWrite) {
    console.log('Not initializing chat room - user is not a confirmed or cancelled attendee or lacks permissions', {
      attendeeStatus: event.value.attendee?.status,
      canWrite: discussionPermissions.value.canWrite
    })
    return false
  }

  // Global initialization tracking
  if (!globalWindow.chatRoomInitializations) {
    globalWindow.chatRoomInitializations = {}
  }

  const eventSlug = event.value.slug

  // Check if we need to force a refresh based on attendance status changes
  const currentStatus = useEventStore().event?.attendee?.status
  const previousStatus = globalWindow.lastChatPermissionStatus?.[eventSlug]

  // Force refresh in either of these cases:
  // 1. User just became confirmed or cancelled (status changed to confirmed/cancelled)
  // 2. Room ID exists but MessagesComponent isn't showing (needs re-render)
  // 3. No roomId is found but user is a confirmed or cancelled attendee (need to request room creation)
  const statusChanged = currentStatus !== previousStatus
  const roomIdExistsButNoComponent = matrixRoomId.value && !document.querySelector('.messages-component')
  const confirmedButNoRoomId = (currentStatus === 'confirmed' || currentStatus === 'cancelled') && !matrixRoomId.value

  // Add throttling check - only force refresh if it's been at least 5 seconds since the last attempt
  const lastAttemptTime = window.lastChatInitAttempt?.[eventSlug] || 0
  const currentTime = Date.now()
  const timeSinceLastAttempt = currentTime - lastAttemptTime
  const throttleMs = 5000 // 5 seconds throttle
  const isThrottled = timeSinceLastAttempt < throttleMs

  // Only force refresh if we're not throttled
  const forceRefresh = !isThrottled && (((currentStatus === 'confirmed' || currentStatus === 'cancelled') && statusChanged) ||
                      roomIdExistsButNoComponent ||
                      confirmedButNoRoomId)

  console.log('Checking if we need to force refresh room initialization:', {
    currentStatus,
    previousStatus,
    statusChanged,
    roomIdExists: !!matrixRoomId.value,
    componentExists: !!document.querySelector('.messages-component'),
    confirmedButNoRoomId,
    timeSinceLastAttempt: `${timeSinceLastAttempt}ms`,
    throttleLimit: `${throttleMs}ms`,
    isThrottled,
    forceRefresh
  })

  // Always force refresh if user is confirmed but no room ID is found, unless we're throttled
  if ((window.chatRoomInitializations[eventSlug] === 'completed' && !forceRefresh) || isThrottled) {
    if (isThrottled) {
      console.log(`Throttling initialization for ${eventSlug}: too soon since last attempt (${timeSinceLastAttempt}ms < ${throttleMs}ms)`)
    } else {
      console.log(`Room ${eventSlug} was already fully initialized in this session, skipping`)
    }
    return true
  }

  // Track the current permission status to detect changes
  if (!window.lastChatPermissionStatus) {
    window.lastChatPermissionStatus = {}
  }
  window.lastChatPermissionStatus[eventSlug] = useEventStore().event?.attendee?.status

  // Check if initialization is already in progress
  if (window.chatRoomInitializations[eventSlug] === 'in-progress') {
    console.log(`Room ${eventSlug} initialization already in progress, skipping duplicate request`)
    return false
  }

  isInitializing.value = true
  // Set global flag to prevent concurrent initialization across components
  window.chatRoomInitializations[eventSlug] = 'in-progress'

  // Initialize and update the timestamp tracking
  if (!window.lastChatInitAttempt) {
    window.lastChatInitAttempt = {}
  }
  window.lastChatInitAttempt[eventSlug] = Date.now()

  console.log(`Starting initialization for ${eventSlug}, setting global flag and timestamp`)

  // Automatically clean up stale locks after 10 seconds
  setTimeout(() => {
    if (window.chatRoomInitializations[eventSlug] === 'in-progress') {
      console.log(`Clearing stale initialization lock for ${eventSlug} after timeout`)
      window.chatRoomInitializations[eventSlug] = null
    }
  }, 10000)

  try {
    console.log('Starting chat room initialization for:', event.value.slug)

    // Check if we already have a roomId in the event object or computed property
    if (event.value.roomId || matrixRoomId.value) {
      console.log('Room ID already exists:', event.value.roomId || matrixRoomId.value)
      // Mark as completed in the global registry since we already have a room ID
      window.chatRoomInitializations[eventSlug] = 'completed'
      return true
    }

    // IMPORTANT: Only check for room ID if there hasn't been a recent check
    // This is to avoid infinite loops with multiple components refreshing the event data
    const lastEventCheck = window.lastEventDiscussionCheck || 0
    const now = Date.now()
    const timeSinceLastCheck = now - lastEventCheck

    // If it's been less than 3 seconds since we last checked, skip the check
    if (timeSinceLastCheck < 3000) {
      console.log(`Skipping discussion check as one was performed ${timeSinceLastCheck}ms ago`)
    } else {
      // Load messages first to check if a roomId already exists
      // Only make this call once - it's where the infinite loop was happening
      console.log('Checking for existing room ID by loading messages once')
      window.lastEventDiscussionCheck = now
      await useEventStore().actionGetEventDiscussionMessages()
    }

    // If we now have a roomId after that first call, we're done
    if (event.value.roomId || matrixRoomId.value) {
      console.log('Room ID found after loading messages:', event.value.roomId || matrixRoomId.value)
      // Mark as completed in the global registry
      window.chatRoomInitializations[eventSlug] = 'completed'
      return true
    }

    // Only proceed with initialization if user has permission and is authenticated
    if (discussionPermissions.value.canWrite && useAuthStore().isAuthenticated && useAuthStore().user?.id) {
      try {
        console.log('No room ID found - attempting to initialize chat room by joining...')
        console.log('Current permissions state:', {
          canWrite: discussionPermissions.value.canWrite,
          canRead: discussionPermissions.value.canRead,
          attendeeStatus: useEventStore().event?.attendee?.status
        })

        // Clear any cached permissions to force a fresh evaluation
        if (window.lastChatPermissionStatus) {
          console.log('Clearing cached permission status to force fresh evaluation')
          window.lastChatPermissionStatus[eventSlug] = undefined
        }

        // Join the event chat room (this handles Matrix credential provisioning)
        await useEventStore().actionJoinEventChatRoom()

        // Add a small delay to let the server process
        await new Promise(resolve => setTimeout(resolve, 500))

        // Only force a refresh if we don't already have a room ID
        if (!event.value.roomId) {
          console.log('Forcing event refresh to get latest permissions')
          await useEventStore().actionGetEventBySlug(eventSlug)
        } else {
          console.log('Room ID already exists after join, skipping redundant event refresh:', event.value.roomId)
        }

        // Reload messages ONLY ONCE to get the room ID
        console.log('User added to discussion, checking for room ID')
        window.lastEventDiscussionCheck = Date.now()
        await useEventStore().actionGetEventDiscussionMessages()

        if (event.value.roomId) {
          console.log('Successfully initialized chat room:', event.value.roomId)
          // Mark as completed in the global registry
          window.chatRoomInitializations[eventSlug] = 'completed'
          return true
        } else {
          console.log('User was added but still no room ID available, attempting one more refresh')

          // Try one more time with a clean approach: fetch fresh event data and then message data
          console.log('Attempting final refresh of event data to get room ID')

          // First refresh the event data
          await useEventStore().actionGetEventBySlug(eventSlug)

          // Then fetch the messages to try to get the room ID
          const messageResult = await useEventStore().actionGetEventDiscussionMessages()

          // Check if we got a room ID
          if (event.value.roomId) {
            console.log('Successfully initialized chat room on second attempt:', event.value.roomId)
            window.chatRoomInitializations[eventSlug] = 'completed'
            return true
          } else if (messageResult && messageResult.roomId) {
            // If the room ID was in the message response but not set on the event
            console.log('Found room ID in message response but not set on event:', messageResult.roomId)
            event.value.roomId = messageResult.roomId
            window.chatRoomInitializations[eventSlug] = 'completed'
            return true
          } else {
            console.log('Still no room ID available after second attempt')
          }
        }
      } catch (joinError) {
        console.error('Error initializing chat room by joining:', joinError)
      }
    } else {
      console.log('User lacks required permissions or authentication to initialize chat room', {
        canWrite: discussionPermissions.value.canWrite,
        isAuthenticated: useAuthStore().isAuthenticated,
        hasUserId: !!useAuthStore().user?.id,
        attendeeStatus: useEventStore().event?.attendee?.status
      })
    }

    // Skip the special initialization for hosts/moderators to avoid potential loops
    // We'll only try the initial basic approach for now

    const success = !!event.value.roomId

    // If we found a room ID, mark this initialization as completed in the global registry
    if (success) {
      window.chatRoomInitializations[eventSlug] = 'completed'
      console.log(`Room ${eventSlug} initialization completed successfully, marking as 'completed'`)
    } else {
      // Mark as failed but allow future attempts
      window.chatRoomInitializations[eventSlug] = null
      console.log(`Room ${eventSlug} initialization did not succeed, clearing flag to allow retry`)
    }

    return success
  } catch (err) {
    console.error('Error ensuring chat room exists:', err)
    // Clear global initialization flag on error
    window.chatRoomInitializations[eventSlug] = null
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

// Handle attendance status changes from other components
const handleAttendeeStatusChanged = (e: Event) => {
  // Custom events have a detail property
  if (!e || !('detail' in e)) return

  // Use the properly typed event
  const customEvent = e as AttendeeStatusChangeEvent
  const { eventSlug, status, timestamp } = customEvent.detail
  console.log(`Attendance status changed event received: ${eventSlug}, status=${status} at ${new Date(timestamp).toISOString()}`)

  // Reset our permission status tracking when attendance changes
  if (window.lastChatPermissionStatus) {
    if (!window.lastChatPermissionStatus[eventSlug]) {
      window.lastChatPermissionStatus[eventSlug] = undefined
    }

    console.log(`Resetting chat permission status for ${eventSlug} from ${window.lastChatPermissionStatus[eventSlug]} to ${status}`)
    window.lastChatPermissionStatus[eventSlug] = status
  }

  // ALWAYS reset the initialization state to force a fresh initialization attempt
  if (window.chatRoomInitializations) {
    console.log(`Resetting chat room initialization state for ${eventSlug} due to attendance change`)
    window.chatRoomInitializations[eventSlug] = null
  }

  // Only react if this is for our current event
  if (useEventStore().event?.slug === eventSlug) {
    console.log('This event matches the status change notification, refreshing discussion state')

    // Longer delay when re-attending to ensure backend is fully updated
    const delay = status === 'confirmed' ? 800 : 300

    // Set loading state immediately to provide user feedback
    isLoading.value = true

    setTimeout(async () => {
      try {
        // For ALL status changes (both cancelling and rejoining), follow the same complete refresh path
        console.log(`User attendance status changed to ${status}, updating discussion permissions`)

        // Always force a complete refresh of the event data to get current permissions
        await useEventStore().actionGetEventBySlug(eventSlug)

        console.log('Event data refreshed after status change:', {
          attendeeStatus: useEventStore().event?.attendee?.status,
          hasPermission: useEventStore().getterUserHasPermission(EventAttendeePermission.CreateDiscussion),
          roomId: useEventStore().event?.roomId || 'none'
        })

        // Special handling for confirmed or cancelled status - ensure chat components are properly initialized
        if (status === 'confirmed' || status === 'cancelled') {
          console.log('Confirmed or cancelled status detected, ensuring chat components are properly reset')

          // Force reset room initialization state to ensure components are recreated
          if (window.chatRoomInitializations) {
            window.chatRoomInitializations[eventSlug] = null
          }

          // Try to ensure chat room exists - this will reinitialize the chat components
          const success = await ensureChatRoomExists()

          console.log('Chat room initialization result:', {
            success,
            hasRoomId: !!event.value?.roomId,
            roomId: event.value?.roomId
          })

          // If we still don't have a successful result but attendee status is confirmed or cancelled,
          // try calling the join API directly as a fallback
          if (!success && (event.value?.attendee?.status === 'confirmed' || event.value?.attendee?.status === 'cancelled') && useAuthStore().isAuthenticated) {
            console.log('Attempting fallback direct room join API call')
            try {
              const joinResponse = await useEventStore().actionAddMemberToEventDiscussion(useAuthStore().user.slug)
              console.log('Fallback join response:', joinResponse)

              // Force reload data after successful join
              if (joinResponse) {
                console.log('Forcing final event refresh after fallback join')
                await useEventStore().actionGetEventBySlug(eventSlug)

                // Load messages and force immediate refresh to get the room ID
                const messagesResult = await useEventStore().actionGetEventDiscussionMessages()
                console.log('Messages result after fallback join:', messagesResult)

                // Check if we received a roomId in the response
                if (messagesResult.roomId) {
                  console.log('Received roomId from messages API:', messagesResult.roomId)
                  // Instead of directly modifying the event object (which causes TypeScript errors),
                  // we'll refresh the event data so it comes with the roomId from the API
                  // Only refresh if we don't already have the roomId synchronized
                  if (event.value?.roomId !== messagesResult.roomId) {
                    console.log('Forcing another event refresh to update roomId')
                    await useEventStore().actionGetEventBySlug(eventSlug)
                  } else {
                    console.log('Room ID already synchronized, skipping redundant event refresh')
                  }
                }
              }
            } catch (error) {
              console.error('Fallback join attempt failed:', error)
            }
          }
        } else {
          // For other statuses, just check if chat room exists
          await ensureChatRoomExists()
        }
      } catch (error) {
        console.error('Error handling attendance status change:', error)
      } finally {
        isLoading.value = false
      }
    }, delay)
  }
}

// Load discussion messages and ensure chat room exists
onMounted(async () => {
  if (event.value && event.value.slug) {
    console.log('EventMatrixChatComponent mounted for event:', event.value.slug)
    try {
      isLoading.value = true

      // Check if the parent EventPage is already loading this event data
      // This helps avoid redundant API calls when components mount
      const eventSlug = event.value.slug
      if (window.eventBeingLoaded === eventSlug) {
        console.log('Parent EventPage is already loading event data, will wait for it to complete')
        // We don't need to make additional API calls here, just rely on the EventPage component
        // to load the base data, and then we'll handle Matrix-specific operations
      }

      // Only initialize the chat room if the user is a confirmed or cancelled attendee
      if ((event.value.attendee?.status === 'confirmed' || event.value.attendee?.status === 'cancelled') && discussionPermissions.value.canWrite) {
        if (event.value.roomId || matrixRoomId.value) {
          console.log('Already have room ID at mount:', event.value.roomId || matrixRoomId.value)
        } else {
          // Only attempt to initialize if we don't already have a room ID
          console.log('No room ID at mount, trying initialization once')
          await ensureChatRoomExists()
        }

        // Listen for attendance status changes from other components
        window.addEventListener('attendee-status-changed', handleAttendeeStatusChanged)
      } else {
        console.log('Not initializing chat - user is not a confirmed attendee or lacks permissions:', {
          attendeeStatus: event.value.attendee?.status,
          canWrite: discussionPermissions.value.canWrite
        })
      }
    } catch (err) {
      console.error('Error loading event discussion:', err)
    } finally {
      isLoading.value = false
    }
  } else {
    console.log('EventMatrixChatComponent mounted without valid event data')
  }
})

// Remove event listener when component is unmounted
onBeforeUnmount(() => {
  window.removeEventListener('attendee-status-changed', handleAttendeeStatusChanged)
  console.log('Removed attendee-status-changed event listener')
})

// Method to handle the retry button in the UI
const retryRoomInitialization = async () => {
  if (!event.value || !event.value.slug) return
  const eventSlug = event.value.slug

  // Check throttling - prevent too frequent retries
  if (!window.lastChatInitAttempt) {
    window.lastChatInitAttempt = {}
  }

  const lastAttemptTime = window.lastChatInitAttempt[eventSlug] || 0
  const timeSinceLastAttempt = Date.now() - lastAttemptTime
  const throttleMs = 5000 // 5 seconds for manual retries

  if (timeSinceLastAttempt < throttleMs) {
    console.log(`Throttling manual retry for ${eventSlug}: too soon since last attempt (${timeSinceLastAttempt}ms < ${throttleMs}ms)`)
    return
  }

  // Reset state and record this attempt timestamp
  window.lastChatInitAttempt[eventSlug] = Date.now()
  isInitializing.value = true

  try {
    // First make sure Matrix connection is initialized
    await matrixClientService.connectToMatrix()

    // Force a fresh fetch of the event data to ensure we have current permissions
    console.log(`Performing fresh fetch of event data for ${eventSlug}`)
    await useEventStore().actionGetEventBySlug(eventSlug)

    // Try a single, simple call to join the discussion
    console.log('Attempting to join event discussion')
    await useEventStore().actionAddMemberToEventDiscussion(useAuthStore().user.slug)

    // Then fetch messages to see if we got a room ID
    console.log('Fetching messages to check for room ID')
    await useEventStore().actionGetEventDiscussionMessages()

    // Success message if we got a room ID
    if (event.value.roomId || matrixRoomId.value) {
      console.log('Successfully joined discussion, room ID:', event.value.roomId || matrixRoomId.value)
    } else {
      console.log('Still no room ID available after join attempt')
    }
  } catch (error) {
    console.error('Error retrying room initialization:', error)
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
