<template>
  <div class="matrix-connection-status" :class="statusClass">
    <q-icon
      :name="statusIcon"
      :color="statusColor"
      size="sm"
    />
    <span v-if="showText" class="status-text q-ml-xs">{{ statusText }}</span>
    <q-tooltip v-if="showTooltip" :delay="500">
      {{ statusTooltip }}
    </q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { matrixClientManager } from '../../services/MatrixClientManager'
import { ClientEvent } from 'matrix-js-sdk'
import { logger } from '../../utils/logger'

interface Props {
  showText?: boolean
  showTooltip?: boolean
}

withDefaults(defineProps<Props>(), {
  showText: false,
  showTooltip: true
})

const syncState = ref<string | null>(null)
const lastError = ref<Error | null>(null)

// Update sync state from Matrix client
const updateSyncState = () => {
  const client = matrixClientManager.getClient()
  if (client) {
    const state = client.getSyncState()
    syncState.value = state
    logger.debug('🔄 MatrixConnectionStatus: sync state updated', { state })
  } else {
    syncState.value = null
    logger.debug('🔄 MatrixConnectionStatus: no client available')
  }
}

// Sync state change handler
const handleSyncStateChange = (state: string, prevState: string | null, data: unknown) => {
  syncState.value = state

  // Capture error if state is ERROR
  if (state === 'ERROR' && data) {
    lastError.value = data as Error
  }

  logger.debug('🔄 MatrixConnectionStatus: sync state changed', {
    state,
    prevState,
    hasError: !!lastError.value
  })
}

// Computed properties for display
const statusIcon = computed(() => {
  switch (syncState.value) {
    case 'PREPARED':
    case 'SYNCING':
      return 'sym_r_check_circle'
    case 'RECONNECTING':
      return 'sym_r_sync'
    case 'ERROR':
      return 'sym_r_error'
    case 'STOPPED':
      return 'sym_r_cancel'
    case 'CATCHUP':
      return 'sym_r_sync'
    default:
      return 'sym_r_cloud_off'
  }
})

const statusColor = computed(() => {
  switch (syncState.value) {
    case 'PREPARED':
    case 'SYNCING':
      return 'positive'
    case 'RECONNECTING':
    case 'CATCHUP':
      return 'warning'
    case 'ERROR':
      return 'negative'
    case 'STOPPED':
      return 'grey'
    default:
      return 'grey-6'
  }
})

const statusText = computed(() => {
  switch (syncState.value) {
    case 'PREPARED':
      return 'Connected'
    case 'SYNCING':
      return 'Syncing'
    case 'RECONNECTING':
      return 'Reconnecting...'
    case 'ERROR':
      return 'Connection error'
    case 'STOPPED':
      return 'Disconnected'
    case 'CATCHUP':
      return 'Catching up...'
    default:
      return 'Offline'
  }
})

const statusTooltip = computed(() => {
  switch (syncState.value) {
    case 'PREPARED':
      return 'Chat is connected and synced'
    case 'SYNCING':
      return 'Actively syncing messages'
    case 'RECONNECTING':
      return 'Lost connection, attempting to reconnect...'
    case 'ERROR':
      if (lastError.value) {
        return `Connection error: ${lastError.value.message || 'Unknown error'}. The chat service may be temporarily unavailable.`
      }
      return 'Connection error. The chat service may be temporarily unavailable.'
    case 'STOPPED':
      return 'Chat sync has been stopped'
    case 'CATCHUP':
      return 'Reconnected, catching up on messages...'
    default:
      return 'Chat is currently offline'
  }
})

const statusClass = computed(() => {
  return `status-${syncState.value?.toLowerCase() || 'unknown'}`
})

// Lifecycle hooks
onMounted(() => {
  // Initial state
  updateSyncState()

  // Listen for sync state changes
  const client = matrixClientManager.getClient()
  if (client) {
    client.on(ClientEvent.Sync, handleSyncStateChange)
    logger.debug('🎧 MatrixConnectionStatus: listening to sync state changes')
  }

  // Also listen for client re-initialization
  window.addEventListener('matrix:ready', updateSyncState)
})

onUnmounted(() => {
  const client = matrixClientManager.getClient()
  if (client) {
    client.off(ClientEvent.Sync, handleSyncStateChange)
    logger.debug('🔇 MatrixConnectionStatus: stopped listening to sync state changes')
  }

  window.removeEventListener('matrix:ready', updateSyncState)
})
</script>

<style scoped lang="scss">
.matrix-connection-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: all 0.3s ease;

  &.status-reconnecting,
  &.status-catchup {
    .q-icon {
      animation: rotate 2s linear infinite;
    }
  }

  &.status-error {
    background-color: rgba(244, 67, 54, 0.1);
  }

  &.status-reconnecting {
    background-color: rgba(255, 152, 0, 0.1);
  }
}

.status-text {
  font-size: 0.75rem;
  white-space: nowrap;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
