/**
 * Simplified Matrix Encryption Composable
 *
 * Unencrypted-first approach: default to chat ready, only setup encryption for encrypted rooms
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { matrixClientService } from '../services/matrixClientService'
import { matrixEncryptionState, type MatrixEncryptionStatus } from '../services/matrixEncryptionState'
import { logger } from '../utils/logger'

export function useMatrixEncryption () {
  // Single source of truth: Matrix SDK state
  const encryptionStatus = ref<MatrixEncryptionStatus | null>(null)
  const isLoading = ref(false)
  const lastChecked = ref<number>(0)

  // Computed helpers based on Element Web pattern
  const canChat = computed(() => encryptionStatus.value?.details.canChat ?? false)
  const needsLogin = computed(() => encryptionStatus.value?.state === 'needs_login')
  const needsEncryptionSetup = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'needs_device_verification' || state === 'needs_recovery_key'
  })
  const needsBanner = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'ready_encrypted_with_warning' || state === 'needs_key_backup'
  })
  const warningMessage = computed(() => encryptionStatus.value?.warningMessage)
  const isReadyUnencrypted = computed(() => encryptionStatus.value?.state === 'ready_unencrypted')
  const isReadyEncrypted = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'ready_encrypted' || state === 'ready_encrypted_with_warning'
  })
  const requiresUserAction = computed(() => encryptionStatus.value?.requiresUserAction ?? false)

  // Legacy computed for backwards compatibility
  const isReady = computed(() => canChat.value)
  const needsSetup = computed(() => needsEncryptionSetup.value)
  const needsUnlock = computed(() => false) // No longer used in simplified approach

  const requiredUI = computed(() => {
    if (!encryptionStatus.value) return 'login'
    return matrixEncryptionState.getRequiredUI(encryptionStatus.value.state)
  })

  /**
   * Check encryption state using Matrix SDK
   */
  const checkEncryptionState = async (roomId?: string): Promise<void> => {
    if (isLoading.value) return // Prevent concurrent checks

    isLoading.value = true

    try {
      const client = matrixClientService.getClient()
      const status = await matrixEncryptionState.getEncryptionState(client, roomId)

      encryptionStatus.value = status
      lastChecked.value = Date.now()

      logger.debug('🔍 Matrix-native encryption state:', status)
    } catch (error) {
      logger.error('Failed to check Matrix encryption state:', error)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Initialize chat (simplified - no forced encryption setup)
   */
  const initializeEncryption = async (roomId?: string): Promise<boolean> => {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.debug('No Matrix client available for chat initialization')
        return false
      }

      // Check if already ready for chat (unencrypted or encrypted)
      const isReady = await matrixEncryptionState.waitForChatReady(client, 5000)
      if (isReady) {
        await checkEncryptionState(roomId)
        return true
      }

      // If not ready, user action might be required (e.g., for encrypted rooms)
      await checkEncryptionState(roomId)
      return encryptionStatus.value?.details.canChat ?? false
    } catch (error) {
      logger.error('Failed to initialize Matrix chat:', error)
      return false
    }
  }

  /**
   * Check if we can encrypt in a specific room
   */
  const canEncryptInRoom = async (roomId: string): Promise<boolean> => {
    const client = matrixClientService.getClient()
    return matrixEncryptionState.canEncryptInRoom(client, roomId)
  }

  /**
   * Refresh state when Matrix client changes
   */
  const refreshState = async (): Promise<void> => {
    await checkEncryptionState()
  }

  // Auto-refresh on client state changes
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  const startAutoRefresh = () => {
    // Check every 30 seconds, but only if we need user action
    refreshInterval = setInterval(async () => {
      if (!requiresUserAction.value) {
        await checkEncryptionState()
      }
    }, 30000)
  }

  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  // Matrix client event handlers
  const handleMatrixReady = () => {
    logger.debug('Matrix client ready, checking encryption state')
    checkEncryptionState()
  }

  const handleMatrixSync = () => {
    // Only refresh if we haven't checked recently
    if (Date.now() - lastChecked.value > 10000) {
      checkEncryptionState()
    }
  }

  // Lifecycle
  onMounted(() => {
    // Initial check
    checkEncryptionState()

    // Start auto-refresh
    startAutoRefresh()

    // Listen for Matrix client events
    window.addEventListener('matrix-client-ready', handleMatrixReady)
    window.addEventListener('matrix-sync-complete', handleMatrixSync)
  })

  onUnmounted(() => {
    stopAutoRefresh()
    window.removeEventListener('matrix-client-ready', handleMatrixReady)
    window.removeEventListener('matrix-sync-complete', handleMatrixSync)
  })

  return {
    // State
    encryptionStatus: readonly(encryptionStatus),
    isLoading: readonly(isLoading),

    // Element Web style computed helpers
    canChat,
    needsLogin,
    needsEncryptionSetup,
    needsBanner,
    warningMessage,
    isReadyUnencrypted,
    isReadyEncrypted,
    requiresUserAction,
    requiredUI,

    // Legacy computed for backwards compatibility
    isReady,
    needsSetup,
    needsUnlock,

    // Actions
    checkEncryptionState,
    initializeEncryption,
    canEncryptInRoom,
    refreshState
  }
}

import type { Ref } from 'vue'

// Helper to make refs readonly
function readonly<T> (ref: Ref<T>) {
  return computed(() => ref.value)
}
