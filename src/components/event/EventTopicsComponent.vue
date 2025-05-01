<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from '../../stores/event-store'
import { EventAttendeePermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import { useMessageStore } from '../../stores/unified-message-store'
import MessagesComponent from '../messages/MessagesComponent.vue'
import getEnv from '../../utils/env'
import { api } from '../../boot/axios'

// Add type declaration for global window property
declare global {
  interface Window {
    chatRoomInitializations?: Record<string, 'in-progress' | 'completed' | null>;
    lastEventDiscussionCheck?: number;
    lastChatPermissionStatus?: Record<string, string | undefined>;
  }
}

// Check if in development mode
const isDev = ref(false)
try {
  // In production, this might not be available
  isDev.value = process.env.NODE_ENV === 'development' || import.meta.env?.DEV === true
} catch (e) {
  isDev.value = false
}

// Removed unused useQuasar
const event = computed(() => useEventStore().event)
const messageStore = useMessageStore()

// Debug state variables
const showMatrixConfigDetails = ref(false)
const matrixSocketConnected = ref(false)
const isTestingBroadcast = ref(false)

// Get the Matrix room ID from the event - try different properties
const matrixRoomId = computed(() => {
  if (!event.value) return null

  // Check if we have a proper roomId on the event object
  if (event.value.roomId) {
    return event.value.roomId
  }

  // Check if we can find a roomId in event messages
  if (event.value.messages && event.value.messages.length > 0) {
    // Loop through messages to find the first with a room_id field
    for (const message of event.value.messages) {
      if (message.room_id) {
        return message.room_id
      }
    }
  }

  // At this point, we don't have a valid room ID, so return null
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

  // Special case: if user is confirmed attendee and authenticated, always grant write permission
  const isConfirmedAttendee = authStore.isAuthenticated && attendeeStatus === 'confirmed'

  return {
    canRead: Boolean(
      eventStore.getterIsPublicEvent ||
      (eventStore.getterIsAuthenticatedEvent && authStore.isAuthenticated) ||
      eventStore.getterUserHasPermission(EventAttendeePermission.ViewDiscussion) ||
      isConfirmedAttendee
    ),
    // Grant writing permission if user has explicit permission OR is a confirmed attendee
    canWrite: Boolean(
      eventStore.getterUserHasPermission(EventAttendeePermission.CreateDiscussion) ||
      isConfirmedAttendee
    ),
    canManage: !!eventStore.getterUserHasPermission(EventAttendeePermission.ManageDiscussions)
  }
})

// Loading states
const isLoading = ref(false)
const isInitializing = ref(false)

// Matrix debug functions
const resetMatrixConnection = async () => {
  console.log('Resetting Matrix connection...')
  messageStore.matrixConnectionAttempted = false

  // Ensure tenant ID is set in localStorage
  const tenantId = getEnv('APP_TENANT_ID') as string | undefined
  if (tenantId) {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('tenantId')) {
      localStorage.setItem('tenantId', tenantId)
      console.log('Set tenant ID in localStorage:', tenantId)
    }
  }

  try {
    const result = await messageStore.initializeMatrix()
    console.log('Matrix connection reset result:', result)
    return result
  } catch (err) {
    console.error('Error resetting Matrix connection:', err)
    return false
  }
}

const injectTestMessage = () => {
  if (!matrixRoomId.value) {
    console.error('No room ID available for test message')
    return
  }

  console.log('Injecting test message into room:', matrixRoomId.value)

  const testEvent = {
    type: 'm.room.message',
    room_id: matrixRoomId.value,
    event_id: 'debug-test-' + Date.now(),
    sender: '@test:openmeet.net',
    sender_name: 'Debug Test User',
    origin_server_ts: Date.now(),
    content: {
      msgtype: 'm.text',
      body: '🔧 This is a test message injected at ' + new Date().toISOString()
    }
  }

  // First try dispatching an event
  window.dispatchEvent(new CustomEvent('matrix-event', { detail: testEvent }))

  // Then try adding directly to the store
  setTimeout(() => {
    try {
      console.log('Calling store.addNewMessage directly as a secondary test...')
      messageStore.addNewMessage(testEvent)
    } catch (e) {
      console.error('Error calling addNewMessage directly:', e)
    }
  }, 1000)
}

const testWebSocketBroadcast = async () => {
  if (!matrixRoomId.value) {
    console.error('No room ID available for test broadcast')
    return
  }

  isTestingBroadcast.value = true
  try {
    console.log('Testing WebSocket broadcast to room:', matrixRoomId.value)

    // Call the test-broadcast endpoint
    const response = await api.post('/api/matrix/test-broadcast', {
      roomId: matrixRoomId.value,
      message: '🔄 Test WebSocket broadcast message at ' + new Date().toISOString()
    })

    console.log('Test broadcast API response:', response.data)

    if (response.data.success) {
      console.log('Test broadcast sent successfully, waiting for WebSocket reception...')
      // The message should arrive via WebSocket and be handled by the message store
    } else {
      console.error('Test broadcast failed:', response.data.message || 'Unknown error')
    }
  } catch (error) {
    console.error('Error sending test broadcast:', error)
  } finally {
    isTestingBroadcast.value = false
  }
}

const showMatrixConfig = () => {
  showMatrixConfigDetails.value = !showMatrixConfigDetails.value

  // Check socket connection
  try {
    // Access the connection state directly from the store
    matrixSocketConnected.value = messageStore.matrixConnected
    console.log('Socket connection status:', matrixSocketConnected.value)
  } catch (e) {
    console.error('Error checking socket connection:', e)
    matrixSocketConnected.value = false
  }
}

// Function to automatically initialize the chat room without sending a welcome message
const ensureChatRoomExists = async () => {
  if (!event.value || !event.value.slug) return false

  // Global initialization tracking
  if (!window.chatRoomInitializations) {
    window.chatRoomInitializations = {}
  }

  const eventSlug = event.value.slug

  // Check if we need to force a refresh based on attendance status changes
  const currentStatus = useEventStore().event?.attendee?.status
  const previousStatus = window.lastChatPermissionStatus?.[eventSlug]

  // Force refresh in either of these cases:
  // 1. User just became confirmed (status changed to confirmed)
  // 2. Room ID exists but MessagesComponent isn't showing (needs re-render)
  const statusChanged = currentStatus !== previousStatus
  const roomIdExistsButNoComponent = event.value.roomId && !document.querySelector('.messages-component')
  const forceRefresh = (currentStatus === 'confirmed' && statusChanged) || roomIdExistsButNoComponent

  console.log('Checking if we need to force refresh room initialization:', {
    currentStatus,
    previousStatus,
    statusChanged,
    roomIdExists: !!event.value.roomId,
    componentExists: !!document.querySelector('.messages-component'),
    forceRefresh
  })

  if (window.chatRoomInitializations[eventSlug] === 'completed' && !forceRefresh) {
    console.log(`Room ${eventSlug} was already fully initialized in this session, skipping`)
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
  console.log(`Starting initialization for ${eventSlug}, setting global flag`)

  // Automatically clean up stale locks after 10 seconds
  setTimeout(() => {
    if (window.chatRoomInitializations[eventSlug] === 'in-progress') {
      console.log(`Clearing stale initialization lock for ${eventSlug} after timeout`)
      window.chatRoomInitializations[eventSlug] = null
    }
  }, 10000)

  try {
    console.log('Starting chat room initialization for:', event.value.slug)

    // Check if we already have a roomId in the event object
    if (event.value.roomId) {
      console.log('Room ID already exists in event object:', event.value.roomId)
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
    if (event.value.roomId) {
      console.log('Room ID found after loading messages:', event.value.roomId)
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

        // Add the current user to the event discussion
        await useEventStore().actionAddMemberToEventDiscussion(useAuthStore().user.slug)

        // Add a small delay to let the server process
        await new Promise(resolve => setTimeout(resolve, 500))

        // Force a refresh of the event data to ensure we have updated permissions
        console.log('Forcing event refresh to get latest permissions')
        await useEventStore().actionGetEventBySlug(eventSlug)

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

          // Try one more time with a longer delay - sometimes the backend takes time to create the room
          await new Promise(resolve => setTimeout(resolve, 1000))
          await useEventStore().actionGetEventDiscussionMessages()

          if (event.value.roomId) {
            console.log('Successfully initialized chat room on second attempt:', event.value.roomId)
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

        // Special handling for confirmed status - ensure chat components are properly initialized
        if (status === 'confirmed') {
          console.log('Confirmed status detected, ensuring chat components are properly reset')

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

          // If we still don't have a successful result but attendee status is confirmed,
          // try calling the join API directly as a fallback
          if (!success && event.value?.attendee?.status === 'confirmed' && useAuthStore().isAuthenticated) {
            console.log('Attempting fallback direct room join API call')
            try {
              const joinResponse = await useEventStore().actionAddMemberToEventDiscussion(useAuthStore().user.slug)
              console.log('Fallback join response:', joinResponse)

              // Reload the page as a last resort if we got a successful join
              if (joinResponse) {
                console.log('Forcing final event refresh after fallback join')
                await useEventStore().actionGetEventBySlug(eventSlug)
                await useEventStore().actionGetEventDiscussionMessages()
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
    isLoading.value = true
    try {
      console.log('EventTopicsComponent mounted for event:', event.value.slug)

      // First check if we already have a room ID before trying initialization
      if (event.value.roomId) {
        console.log('Already have room ID at mount:', event.value.roomId)
      } else {
        // Only attempt to initialize if we don't already have a room ID
        console.log('No room ID at mount, trying initialization once')
        await ensureChatRoomExists()
      }

      // Listen for attendance status changes from other components
      window.addEventListener('attendee-status-changed', handleAttendeeStatusChanged)
    } catch (err) {
      console.error('Error loading event discussion:', err)
    } finally {
      isLoading.value = false
    }
  } else {
    console.log('EventTopicsComponent mounted without valid event data')
  }
})

// Remove event listener when component is unmounted
onBeforeUnmount(() => {
  window.removeEventListener('attendee-status-changed', handleAttendeeStatusChanged)
  console.log('Removed attendee-status-changed event listener')
})

</script>

<template>
  <div class="c-event-topics-component" v-if="event">
    <SubtitleComponent label="Comments" class="q-mt-lg q-px-md c-event-topics-component" hide-link />

    <!-- Loading indicator -->
    <div class="q-pa-md text-center" v-if="isLoading">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Debug info (only shown in development mode) -->
    <div class="q-pa-md q-mt-md q-mb-md bg-grey-2" v-if="!isLoading && isDev">
      <div class="text-grey-8">
        <div>Debug Info:</div>
        <div>Room ID: {{ matrixRoomId || 'Not available' }}</div>
        <div>Event Slug: {{ event.slug }}</div>
        <div>Event ID: {{ event.id }}</div>
        <div>User ID: {{ useAuthStore().user?.id }}</div>
        <div>Matrix User ID: {{ useAuthStore().user?.matrixUserId }}</div>
        <div>Permissions: Read: {{ discussionPermissions.canRead }}, Write: {{ discussionPermissions.canWrite }}, Manage: {{ discussionPermissions.canManage }}</div>
        <div>Attendee Status: {{ event.attendee?.status }}</div>

        <!-- Matrix Debugging Tools -->
        <div class="q-mt-md q-pa-md bg-blue-1 rounded-borders">
          <div class="text-subtitle2 text-weight-bold">Matrix Debugging</div>

          <div class="q-mt-sm">
            <div>Matrix Connection State:</div>
            <div class="text-caption">
              {{ messageStore?.matrixConnected ? '✅ Connected' : '❌ Disconnected' }}
              (Attempted: {{ messageStore?.matrixConnectionAttempted ? 'Yes' : 'No' }})
            </div>
          </div>

          <div class="q-mt-sm">
            <div>Message Count: {{ messageStore?.messages[matrixRoomId]?.length || 0 }}</div>
            <div v-if="matrixRoomId && messageStore?.messages[matrixRoomId]?.length">
              Last message: {{ messageStore?.messages[matrixRoomId]?.[messageStore?.messages[matrixRoomId]?.length - 1]?.content?.body || 'None' }}
            </div>
          </div>

          <div class="row q-col-gutter-sm q-mt-md">
            <div class="col-auto">
              <q-btn
                size="sm"
                color="primary"
                label="Reset Connection"
                @click="resetMatrixConnection"
              />
            </div>
            <div class="col-auto">
              <q-btn
                size="sm"
                color="secondary"
                label="Inject Test Message"
                @click="injectTestMessage"
              />
            </div>
            <div class="col-auto">
              <q-btn
                size="sm"
                color="accent"
                label="Show Matrix Config"
                @click="showMatrixConfig"
              />
            </div>
            <div class="col-auto">
              <q-btn
                size="sm"
                color="deep-purple"
                label="Test WS Broadcast"
                :loading="isTestingBroadcast"
                @click="testWebSocketBroadcast"
              />
            </div>
          </div>

          <!-- Matrix Config Details (toggled via button) -->
          <div v-if="showMatrixConfigDetails" class="q-mt-md q-pa-sm bg-grey-1 rounded-borders text-caption">
            <div><b>API URL:</b> {{ getEnv('APP_API_URL') || 'Not set' }}</div>
            <div><b>Matrix API URL:</b> {{ getEnv('APP_MATRIX_API_URL') || 'Not set' }}</div>
            <div><b>Matrix WebSocket URL:</b> {{ getEnv('APP_MATRIX_WEBSOCKET_URL') || 'Not set' }}</div>
            <div><b>Tenant ID:</b> {{ getEnv('APP_TENANT_ID') || 'Not set' }}</div>
            <div><b>Matrix Socket Connection:</b> {{ matrixSocketConnected ? 'Active' : 'Inactive' }}</div>
          </div>
        </div>
      </div>
    </div>

    <MessagesComponent
      v-if="!isLoading && matrixRoomId"
      :room-id="matrixRoomId"
      context-type="event"
      :context-id="event?.slug ?? ''"
      :can-read="discussionPermissions.canRead"
      :can-write="discussionPermissions.canWrite"
      :can-manage="discussionPermissions.canManage"
    />

    <!-- Fallback when no roomId is available -->
    <div v-else class="q-pa-md">
      <q-banner class="bg-warning text-white">
        <div>
          <p>Chat functionality is currently unavailable for this event.</p>
          <p v-if="!useAuthStore().isAuthenticated">Please <q-btn flat dense no-caps color="white" label="sign in" to="/auth/login" /> to enable chat.</p>
          <p v-else-if="!discussionPermissions.canWrite">You don't have permission to participate in discussions for this event.</p>
          <p v-else-if="!event?.attendee">You need to be an attendee of this event to participate in discussions.</p>
          <p v-else-if="event?.attendee?.status !== 'confirmed'">Your attendance request is still pending. Once approved, you'll be able to join the discussion.</p>
          <p v-else>The chat room could not be automatically created. This may be because the event organizer has not set up chat functionality yet.</p>
        </div>
        <template v-slot:action v-if="discussionPermissions.canWrite && event?.attendee?.status === 'confirmed'">
          <q-btn
            flat
            color="white"
            label="Retry"
            :loading="isInitializing"
            @click="ensureChatRoomExists"
          />
        </template>
      </q-banner>
    </div>
  </div>
</template>
