/**
 * Reactive Matrix Encryption Composable
 *
 * Uses event-driven encryption state management instead of polling.
 * Provides reactive state that automatically updates when Matrix SDK state changes.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { matrixClientService } from '../services/matrixClientService'
import { matrixEncryptionStateManager, type MatrixEncryptionStatus } from '../services/MatrixEncryptionStateManager'
import { logger } from '../utils/logger'

export function useReactiveMatrixEncryption () {
  // Reactive state that updates automatically via events
  const encryptionStatus = ref<MatrixEncryptionStatus | null>(null)
  const isInitialized = ref(false)

  // Computed helpers based on Element Web pattern
  const canChat = computed(() => encryptionStatus.value?.details.canChat ?? false)
  const needsLogin = computed(() => encryptionStatus.value?.state === 'needs_login')
  const needsEncryptionSetup = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'needs_device_verification'
  })
  const needsBanner = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'ready_encrypted_with_warning'
  })
  const warningMessage = computed(() => encryptionStatus.value?.warningMessage)
  const isReadyUnencrypted = computed(() => encryptionStatus.value?.state === 'ready_unencrypted')
  const isReadyEncrypted = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'ready_encrypted' ||
           state === 'ready_encrypted_with_warning' ||
           state === 'needs_device_verification'
  })
  const requiresUserAction = computed(() => encryptionStatus.value?.requiresUserAction ?? false)

  // Legacy computed for backwards compatibility
  const isReady = computed(() => canChat.value)
  const needsSetup = computed(() => needsEncryptionSetup.value)

  const requiredUI = computed(() => {
    if (!encryptionStatus.value) return 'login'

    switch (encryptionStatus.value.state) {
      case 'needs_login': return 'login'
      case 'needs_device_verification': return 'verification'
      case 'ready_encrypted_with_warning': return 'backup'
      default: return 'none'
    }
  })

  /**
   * Initialize the reactive encryption state system
   */
  const initializeEncryption = async (): Promise<boolean> => {
    try {
      const client = matrixClientService.getClient()

      // Initialize the state manager with current client
      matrixEncryptionStateManager.initialize(client)

      // Get initial state
      const initialState = matrixEncryptionStateManager.getCurrentState()
      if (initialState) {
        encryptionStatus.value = initialState
      }

      isInitialized.value = true

      logger.debug('🔐 Reactive encryption state initialized:', initialState)
      return initialState?.details.canChat ?? false
    } catch (error) {
      logger.error('Failed to initialize reactive Matrix encryption:', error)
      return false
    }
  }

  /**
   * Handle encryption state changes from the event-driven manager
   */
  const handleStateChange = (newState: MatrixEncryptionStatus) => {
    encryptionStatus.value = newState
    logger.debug('🔐 Reactive encryption state updated:', newState.state)
  }

  /**
   * Check if we can encrypt in a specific room
   */
  const canEncryptInRoom = async (roomId: string): Promise<boolean> => {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      const room = client.getRoom(roomId)
      return room?.hasEncryptionStateEvent() ?? false
    } catch {
      return false
    }
  }

  /**
   * Force refresh state (use sparingly - mainly for error recovery)
   */
  const refreshState = async (): Promise<void> => {
    await matrixEncryptionStateManager.forceRefresh()
  }

  // Set up event listeners for reactive updates
  onMounted(() => {
    // Listen for state changes from the manager
    matrixEncryptionStateManager.on('stateChanged', handleStateChange)

    // Initialize with current client
    initializeEncryption()

    logger.debug('🔐 Reactive encryption composable mounted')
  })

  onUnmounted(() => {
    // Clean up event listeners
    matrixEncryptionStateManager.off('stateChanged', handleStateChange)

    logger.debug('🔐 Reactive encryption composable unmounted')
  })

  return {
    // State
    encryptionStatus: computed(() => encryptionStatus.value),
    isInitialized: computed(() => isInitialized.value),

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

    // Actions
    initializeEncryption,
    canEncryptInRoom,
    refreshState
  }
}
