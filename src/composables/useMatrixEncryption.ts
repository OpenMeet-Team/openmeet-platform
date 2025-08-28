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
  const currentRoomId = ref<string | null>(null)

  // Computed helpers based on Element Web pattern
  const canChat = computed(() => encryptionStatus.value?.details.canChat ?? false)
  const needsLogin = computed(() => encryptionStatus.value?.state === 'needs_login')
  const needsEncryptionSetup = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'needs_recovery_key'
  })
  const needsBanner = computed(() => {
    const state = encryptionStatus.value?.state
    return state === 'ready_encrypted_with_warning' ||
           state === 'needs_key_backup' ||
           state === 'needs_device_verification'
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
   * Check encryption state using Matrix SDK
   */
  const checkEncryptionState = async (roomId?: string): Promise<void> => {
    logger.debug('🔍 checkEncryptionState called with:', { roomId, roomIdType: typeof roomId, hasRoomId: !!roomId })

    // Update current room ID if provided
    if (roomId) {
      currentRoomId.value = roomId
    }

    if (isLoading.value) return // Prevent concurrent checks

    // Prevent rapid successive checks (debounce 5 seconds)
    const now = Date.now()
    if (now - lastChecked.value < 5000) {
      logger.debug('🔍 Skipping encryption state check - too recent (debounced)')
      return
    }

    isLoading.value = true

    try {
      const client = matrixClientService.getClient()
      // Use the provided roomId, or fall back to current room ID if available
      const targetRoomId = roomId || currentRoomId.value || undefined
      logger.debug('🔍 About to call getEncryptionState with roomId:', targetRoomId)
      const status = await matrixEncryptionState.getEncryptionState(client, targetRoomId)

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
    // Use current room ID for refresh if available
    await checkEncryptionState(currentRoomId.value || undefined)
  }

  // Auto-refresh on client state changes
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  const startAutoRefresh = () => {
    // Check every 30 seconds, but only if we need user action
    refreshInterval = setInterval(async () => {
      if (!requiresUserAction.value) {
        // Use current room ID for auto-refresh if available
        await checkEncryptionState(currentRoomId.value || undefined)
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
    // Use current room ID if available
    checkEncryptionState(currentRoomId.value || undefined)
  }

  const handleMatrixSync = () => {
    // Only refresh if we haven't checked recently (30 seconds for sync events)
    if (Date.now() - lastChecked.value > 30000) {
      logger.debug('Matrix sync complete, checking encryption state')
      // Use current room ID if available
      checkEncryptionState(currentRoomId.value || undefined)
    } else {
      logger.debug('Matrix sync complete, but encryption state recently checked - skipping')
    }
  }

  // Lifecycle
  onMounted(async () => {
    // Immediate device verification check - don't wait for room state
    try {
      const client = matrixClientService.getClient()
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
              logger.debug('🔍 Element Web style device verification check:', {
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
            // Immediately set needs verification state
            encryptionStatus.value = {
              state: 'needs_device_verification',
              details: { hasClient: true, hasCrypto: true, isInEncryptedRoom: true, canChat: true },
              requiresUserAction: true,
              warningMessage: 'Verify this session to access encrypted messages'
            }
            logger.debug('🚨 Immediate device verification needed detected')
          }
        }
      }
    } catch (error) {
      logger.debug('⚠️ Immediate device verification check failed:', error)
    }

    // Initial check with room context
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
