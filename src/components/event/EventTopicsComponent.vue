<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
const discussionPermissions = computed(() => ({
  canRead: Boolean(
    useEventStore().getterIsPublicEvent ||
    (useEventStore().getterIsAuthenticatedEvent && useAuthStore().isAuthenticated) ||
    useEventStore().getterUserHasPermission(EventAttendeePermission.ViewDiscussion)
  ),
  canWrite: !!useEventStore().getterUserHasPermission(EventAttendeePermission.CreateDiscussion),
  canManage: !!useEventStore().getterUserHasPermission(EventAttendeePermission.ManageDiscussions)
}))

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

  // Check if initialization has been completed before
  if (window.chatRoomInitializations[eventSlug] === 'completed') {
    console.log(`Room ${eventSlug} was already fully initialized in this session, skipping`)
    return true
  }

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

        // Add the current user to the event discussion
        await useEventStore().actionAddMemberToEventDiscussion(useAuthStore().user.slug)

        // Add a small delay to let the server process
        await new Promise(resolve => setTimeout(resolve, 500))

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
          console.log('User was added but still no room ID available')
        }
      } catch (joinError) {
        console.error('Error initializing chat room by joining:', joinError)
      }
    } else {
      console.log('User lacks required permissions or authentication to initialize chat room')
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
    } catch (err) {
      console.error('Error loading event discussion:', err)
    } finally {
      isLoading.value = false
    }
  } else {
    console.log('EventTopicsComponent mounted without valid event data')
  }
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
