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

// Function to automatically initialize the chat room
const ensureChatRoomExists = async () => {
  if (!event.value || !event.value.slug) return false

  isInitializing.value = true
  try {
    // Load messages first to check if a roomId already exists
    await useEventStore().actionGetEventDiscussionMessages()

    // If we already have a roomId, no need to continue
    if (event.value.roomId) {
      console.log('Room ID already exists:', event.value.roomId)
      return true
    }

    // Try sending a message to initialize the room - this seems to work better than adding members
    if (discussionPermissions.value.canWrite) {
      console.log('No room ID found - attempting to initialize chat room with message...')

      // Send the initial message
      try {
        const messageId = await useEventStore().actionSendEventDiscussionMessage('Chat room initialized. Welcome!')
        console.log('Message sent successfully, ID:', messageId)

        // Reload messages to get the room ID
        await useEventStore().actionGetEventDiscussionMessages()

        if (event.value.roomId) {
          console.log('Successfully initialized chat room:', event.value.roomId)
          return true
        } else {
          console.log('Message was sent but still no room ID available')
        }
      } catch (messageError) {
        console.error('Error sending initial message:', messageError)
      }
    }

    // As a last resort, try the addMember approach - but only for event owners or organizers
    if (!event.value.roomId &&
        discussionPermissions.value.canManage && // Only try this for users who can manage discussions
        useAuthStore().user?.id) {
      try {
        console.log('Trying to add user to discussion:', useAuthStore().user.id)
        // If user is already an attendee with a proper role, try adding them
        if (event.value.attendee &&
            ['host', 'moderator'].includes(event.value.attendee.role?.name || '')) {
          await useEventStore().actionAddMemberToEventDiscussion(useAuthStore().user.slug)

          // Reload messages to check for roomId
          await useEventStore().actionGetEventDiscussionMessages()
        } else {
          console.log('User lacks appropriate role to initialize chat room')
        }
      } catch (memberError) {
        console.log('Could not add member to discussion:', memberError.message)
      }
    }

    return !!event.value.roomId
  } catch (err) {
    console.error('Error ensuring chat room exists:', err)
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
      // Attempt to automatically initialize the chat room or load existing messages
      await ensureChatRoomExists()
    } catch (err) {
      console.error('Error loading event discussion:', err)
    } finally {
      isLoading.value = false
    }
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
