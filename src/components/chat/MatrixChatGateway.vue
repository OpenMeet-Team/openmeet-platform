<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ClientEvent } from 'matrix-js-sdk'
import { matrixClientManager } from '../../services/MatrixClientManager'
import { logger } from '../../utils/logger'
import MatrixNativeChatOrchestrator from './MatrixNativeChatOrchestrator.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'

interface Props {
  contextType: 'event' | 'group' | 'direct'
  contextId: string
  subtitle?: string
  hideSubtitle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: 'Chatroom',
  hideSubtitle: false
})

const matrixRoomId = ref<string | null>(null)
const retryTimer = ref<number | null>(null)
const connectionError = ref<string | null>(null)
// Reactive trigger for Matrix client state changes
const clientReadiness = ref(0)
// Store interval reference with proper typing
const periodicCheckInterval = ref<number | null>(null)

// Matrix connection check for room resolution - needs logged in client that's ready for operations
const hasMatrixConnection = computed(() => {
  // Reference clientReadiness to make this reactive to Matrix client state changes
  // eslint-disable-next-line no-unused-expressions
  clientReadiness.value

  const client = matrixClientManager.getClient()
  const isLoggedIn = client?.isLoggedIn() ?? false
  const syncState = client?.getSyncState()

  // For room resolution, we need at least a logged-in client that has started syncing
  // null syncState means client hasn't started syncing yet (not ready)
  const canResolveRooms = isLoggedIn && (syncState === 'PREPARED' || syncState === 'SYNCING')

  logger.debug('Matrix connection check:', {
    hasClient: !!client,
    isLoggedIn,
    syncState: syncState ?? 'null',
    canResolveRooms
  })

  return canResolveRooms
})

// This component now assumes the parent has already checked permissions
// and will only render this component if the user should see the chat

// Function to attempt room resolution
const attemptRoomResolution = async (contextId: string) => {
  if (!contextId) {
    matrixRoomId.value = null
    connectionError.value = null
    return
  }

  // Check if Matrix client is connected and ready
  if (!hasMatrixConnection.value) {
    logger.debug('Matrix client not connected, skipping room resolution')
    matrixRoomId.value = null
    connectionError.value = null

    // Retry in 2 seconds to allow for Matrix client initialization
    if (retryTimer.value) {
      clearTimeout(retryTimer.value)
    }
    retryTimer.value = setTimeout(() => {
      attemptRoomResolution(contextId)
    }, 2000) as unknown as number
    return
  }

  try {
    connectionError.value = null
    // Use the unified room resolution method - convert 'direct' to 'dm' for the service
    const roomType = props.contextType === 'direct' ? 'dm' : props.contextType
    matrixRoomId.value = await matrixClientManager.getOrCreateRoom(roomType as 'event' | 'group' | 'dm', contextId)
    logger.debug('Successfully resolved room ID:', matrixRoomId.value)
  } catch (error) {
    logger.error('Failed to get canonical room ID:', error)
    matrixRoomId.value = null
    connectionError.value = error instanceof Error ? error.message : 'Failed to connect to chat room'
  }
}

// Load room ID when context changes
watch(
  () => props.contextId,
  (contextId) => {
    // Clear any existing retry timer
    if (retryTimer.value) {
      clearTimeout(retryTimer.value)
      retryTimer.value = null
    }

    // Reset error state
    connectionError.value = null

    // Attempt room resolution
    if (contextId) {
      attemptRoomResolution(contextId)
    } else {
      matrixRoomId.value = null
    }
  },
  { immediate: true }
)

// Also watch for Matrix connection changes to retry room resolution
watch(
  () => hasMatrixConnection.value,
  (isConnected) => {
    if (isConnected && props.contextId && !matrixRoomId.value) {
      logger.debug('Matrix connection restored, retrying room resolution')
      attemptRoomResolution(props.contextId)
    }
  }
)

// Matrix client event handlers to trigger reactivity
const handleMatrixReady = () => {
  logger.debug('Matrix client ready, triggering reactivity')
  clientReadiness.value++
}

const handleMatrixSync = () => {
  logger.debug('Matrix sync state changed, triggering reactivity')
  clientReadiness.value++
}

const handleMatrixConnection = () => {
  logger.debug('Matrix connection event, triggering reactivity')
  clientReadiness.value++
}

// Watch for Matrix client manager state changes (more direct approach)
const checkForClientChanges = () => {
  const client = matrixClientManager.getClient()
  const isReady = matrixClientManager.isReady()
  const syncState = client?.getSyncState()
  const isLoggedIn = client?.isLoggedIn() ?? false

  if (client && isReady && isLoggedIn && (syncState === 'PREPARED' || syncState === 'SYNCING')) {
    logger.debug('Matrix client detected as ready, triggering reactivity')
    clientReadiness.value++

    // Stop the periodic check once we're connected - events will handle updates now
    if (periodicCheckInterval.value) {
      clearInterval(periodicCheckInterval.value)
      periodicCheckInterval.value = null
      logger.debug('🔇 Stopped periodic Matrix client check - connection established')
    }
  }
}

// Component mounting
onMounted(() => {
  logger.debug('🏗️ MatrixChatGateway mounted:', {
    contextType: props.contextType,
    contextId: props.contextId
  })

  // Set up Matrix client event listeners for reactivity
  const client = matrixClientManager.getClient()
  if (client) {
    // Use proper Matrix SDK event types
    client.on(ClientEvent.Sync, handleMatrixSync)
    logger.debug('🔗 Matrix client event listeners attached for reactivity')
  }

  // Also listen for client changes from the manager
  window.addEventListener('matrix:client:ready', handleMatrixReady)
  window.addEventListener('matrix:client:sync', handleMatrixSync)
  window.addEventListener('matrix:connection:established', handleMatrixConnection)

  // Set up periodic check for client state changes (fallback)
  periodicCheckInterval.value = setInterval(() => {
    checkForClientChanges()
  }, 2000) as unknown as number // Check every 2 seconds

  // Trigger initial reactivity update in case client is already ready
  clientReadiness.value++
})

onUnmounted(() => {
  // Clean up retry timer
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }

  // Clean up Matrix client event listeners
  const client = matrixClientManager.getClient()
  if (client) {
    client.off(ClientEvent.Sync, handleMatrixSync)
    logger.debug('🔗 Matrix client event listeners removed')
  }

  // Clean up window event listeners
  window.removeEventListener('matrix:client:ready', handleMatrixReady)
  window.removeEventListener('matrix:client:sync', handleMatrixSync)
  window.removeEventListener('matrix:connection:established', handleMatrixConnection)

  // Clean up periodic check interval
  if (periodicCheckInterval.value) {
    clearInterval(periodicCheckInterval.value)
    periodicCheckInterval.value = null
  }
})

const handleExpandChat = () => {
  // Placeholder for expand functionality
}
</script>

<template>
  <div class="matrix-chat-gateway">
    <!-- Show subtitle if not hidden -->
    <SubtitleComponent
      v-if="!hideSubtitle"
      :label="subtitle"
      class="q-mt-lg q-px-md"
      hide-link
    />

    <!-- Loading state while resolving room ID (only show if Matrix is connected) -->
    <div v-if="!matrixRoomId && hasMatrixConnection && !connectionError" class="q-pa-md text-center">
      <q-spinner size="2rem" />
      <p class="text-body2 q-mt-sm">Loading chat room...</p>
    </div>

    <!-- Connection error -->
    <div v-else-if="connectionError" class="q-pa-md">
      <q-banner class="bg-negative text-white">
        <div>
          <p>Failed to connect to chat room: {{ connectionError }}</p>
          <q-btn
            flat
            dense
            no-caps
            color="white"
            label="Retry"
            @click="attemptRoomResolution(contextId)"
            class="q-mt-sm"
          />
        </div>
      </q-banner>
    </div>

    <!-- Setup orchestrator with single-room mode -->
    <MatrixNativeChatOrchestrator
      v-else-if="hasMatrixConnection && matrixRoomId"
      :context-type="contextType"
      :context-id="contextId"
      mode="single-room"
      :inline-room-id="matrixRoomId"
      @expand="handleExpandChat"
    />

    <!-- Matrix connection required -->
    <MatrixNativeChatOrchestrator
      v-else-if="!hasMatrixConnection"
      :context-type="contextType"
      :context-id="contextId"
      mode="single-room"
      :inline-room-id="null"
      @expand="handleExpandChat"
    />
  </div>
</template>

<style scoped>
.matrix-chat-gateway {
  /* Inherit styles from parent components */
}
</style>
