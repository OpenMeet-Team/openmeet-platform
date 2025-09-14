/**
 * Simplified Matrix Encryption Composable
 *
 * Unencrypted-first approach: default to chat ready, only setup encryption for encrypted rooms
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { matrixClientManager } from '../services/MatrixClientManager'
import { matrixEncryptionState, type MatrixEncryptionStatus } from '../services/MatrixEncryptionManager'
import { logger } from '../utils/logger'

export function useMatrixEncryption () {
  // Single source of truth: Matrix SDK state
  const encryptionStatus = ref<MatrixEncryptionStatus | null>(null)
  const isLoading = ref(false)
  const currentRoomId = ref<string | null>(null)

  // Computed helpers based on Element Web pattern
  const canChat = computed(() => encryptionStatus.value?.details.canChat ?? false)
  const needsLogin = computed(() => {
    // If we don't have encryption status yet, we need to connect/login first
    if (encryptionStatus.value === null) {
      return true
    }
    // Otherwise, check if the encryption state specifically requires login
    return encryptionStatus.value?.state === 'needs_login'
  })
  const needsEncryptionSetup = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'needs_recovery_key' // Fresh setup with MAS
  })
  const needsKeyRecovery = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'needs_key_recovery' // Recovery from existing keys
  })
  const needsBanner = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'ready_encrypted_with_warning' ||
           state === 'needs_key_backup' ||
           state === 'needs_device_verification' ||
           state === 'needs_key_recovery' // Show banner for key recovery
  })
  const warningMessage = computed(() => encryptionStatus.value?.warningMessage)
  const isReadyUnencrypted = computed(() => encryptionStatus.value?.state === 'ready_unencrypted')
  const isReadyEncrypted = computed(() => {
    const state = encryptionStatus.value?.state
    const result = state === 'ready_encrypted' || state === 'ready_encrypted_with_warning' || state === 'needs_device_verification'

    logger.debug('🔐 isReadyEncrypted computed:', {
      currentState: state,
      result,
      encryptionStatus: encryptionStatus.value
    })

    return result
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
   * Trigger key recovery for existing keys (no MAS needed)
   */
  const recoverEncryptionKeys = async (recoveryKey?: string): Promise<boolean> => {
    try {
      isLoading.value = true
      const client = matrixClientManager.getClient()
      if (!client) {
        logger.error('No Matrix client available for key recovery')
        return false
      }

      const result = await matrixEncryptionState.recoverCrossSigningKeys(recoveryKey)

      if (result.success) {
        await checkEncryptionState(currentRoomId.value || undefined)
        return true
      } else {
        logger.error('Key recovery failed:', result.error)
        return false
      }
    } catch (error) {
      logger.error('Key recovery error:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check encryption state using Matrix SDK
   */
  const checkEncryptionState = async (roomId?: string): Promise<void> => {
    logger.debug('🔍 checkEncryptionState called with:', { roomId, roomIdType: typeof roomId, hasRoomId: !!roomId })

    // Update current room ID if provided
    if (roomId) {
      currentRoomId.value = roomId
    }

    if (isLoading.value) return // Prevent concurrent checks

    isLoading.value = true

    try {
      const client = matrixClientManager.getClient()

      // Wait for Matrix client to be ready before checking encryption state
      // Allow proceeding if client exists and is logged in, even if manager thinks it's not ready
      if (!client) {
        logger.debug('🔍 No Matrix client available')
        encryptionStatus.value = null
        return
      }

      if (!client.isLoggedIn()) {
        logger.debug('🔍 Matrix client not logged in')
        encryptionStatus.value = null
        return
      }

      if (!matrixClientManager.isReady()) {
        logger.debug('🔍 Matrix client manager not ready, but client exists and is logged in - proceeding with caution...')
        // Continue with the check since the client itself might be functional
      }

      // Use the provided roomId, or fall back to current room ID if available
      const targetRoomId = roomId || currentRoomId.value || undefined
      logger.debug('🔍 About to call getEncryptionState with roomId:', targetRoomId)
      const status = await matrixEncryptionState.getEncryptionState(client, targetRoomId)

      encryptionStatus.value = status

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
      const client = matrixClientManager.getClient()
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
    const client = matrixClientManager.getClient()
    return matrixEncryptionState.canEncryptInRoom(client, roomId)
  }

  /**
   * Refresh state when Matrix client changes
   */
  const refreshState = async (): Promise<void> => {
    // Use current room ID for refresh if available
    await checkEncryptionState(currentRoomId.value || undefined)
  }

  // Auto-refresh on client state changes
  let refreshInterval: ReturnType<typeof setTimeout> | null = null

  const startAutoRefresh = () => {
    // Disable auto-refresh for now - rely on Matrix client event handlers
    // The repeated checkEncryptionState calls were causing issues
    logger.debug('🔄 Auto-refresh disabled - relying on Matrix client events')
  }

  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearTimeout(refreshInterval)
      refreshInterval = null
    }
  }

  // Matrix client event handlers
  const handleMatrixReady = () => {
    logger.debug('Matrix client ready, checking encryption state')
    // Use current room ID if available
    checkEncryptionState(currentRoomId.value || undefined)
  }

  const handleMatrixSync = () => {
    logger.debug('Matrix sync complete, checking encryption state')
    // Use current room ID if available
    checkEncryptionState(currentRoomId.value || undefined)
  }

  // Lifecycle
  onMounted(async () => {
    // Store device verification status for use when checking encrypted rooms
    // Don't immediately set global encryption status - wait for room context
    try {
      const client = matrixClientManager.getClient()
      if (client) {
        const crypto = client.getCrypto()
        if (crypto) {
          // Check device verification status using Element Web's robust approach
          const [secretStorageReady, crossSigningReady, keyBackupInfo] = await Promise.all([
            crypto.isSecretStorageReady().catch(() => false),
            crypto.isCrossSigningReady().catch(() => false),
            crypto.getKeyBackupInfo().catch(() => null)
          ])

          // Element Web pattern: check specific device verification status
          const deviceId = client.getDeviceId()
          const userId = client.getUserId() || client.getSafeUserId()
          let isCurrentDeviceTrusted = false

          if (crossSigningReady && deviceId && userId) {
            try {
              const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
              isCurrentDeviceTrusted = Boolean(deviceStatus?.crossSigningVerified)
              logger.debug('🔍 Device verification status stored for encrypted room checks:', {
                deviceId,
                userId,
                crossSigningReady,
                crossSigningVerified: deviceStatus?.crossSigningVerified,
                isCurrentDeviceTrusted
              })
            } catch (error) {
              logger.warn('⚠️ Device verification status check failed:', error)
            }
          }

          const needsDeviceSetup = !secretStorageReady || !crossSigningReady || !keyBackupInfo || !isCurrentDeviceTrusted

          if (needsDeviceSetup) {
            logger.debug('🚨 Device verification needed - will show banner when in encrypted rooms')
          } else {
            logger.debug('✅ Device verification complete - encrypted rooms ready')
          }
        }
      }
    } catch (error) {
      logger.debug('⚠️ Device verification status check failed:', error)
    }

    // Skip initial global check - let components call checkEncryptionState(roomId) with proper context

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
    needsKeyRecovery,
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
    refreshState,
    recoverEncryptionKeys
  }
}

import type { Ref } from 'vue'

// Helper to make refs readonly
function readonly<T> (ref: Ref<T>) {
  return computed(() => ref.value)
}
