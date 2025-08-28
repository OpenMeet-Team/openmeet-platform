/**
 * Matrix-Native Encryption State Service
 *
 * Simplified approach that trusts Matrix SDK's built-in state management
 * instead of maintaining parallel state systems.
 *
 * This eliminates the brittleness of custom state tracking by using
 * Matrix SDK as the single source of truth.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'

// Encryption states following Element Web DeviceListener pattern
export type MatrixEncryptionState =
  | 'needs_login' // No Matrix client available
  | 'ready_unencrypted' // Can chat, no encryption needed (default state)
  | 'ready_encrypted_with_warning' // Can encrypt but needs backup setup
  | 'ready_encrypted' // Full encryption working
  | 'needs_device_verification' // Device needs verification
  | 'needs_recovery_key' // Missing cached secrets, need recovery key
  | 'needs_key_backup' // Key backup is off

export interface MatrixEncryptionStatus {
  state: MatrixEncryptionState
  details: {
    hasClient: boolean
    hasCrypto: boolean
    isInEncryptedRoom?: boolean
    canChat: boolean // Key addition: can we chat right now?
    // Encryption details following Element Web DeviceListener pattern
    crossSigningReady?: boolean
    hasKeyBackup?: boolean
    hasDeviceKeys?: boolean
    isCurrentDeviceTrusted?: boolean
    allCrossSigningSecretsCached?: boolean
    secretStorageReady?: boolean
    hasDefaultKeyId?: boolean
    keyBackupUploadActive?: boolean
    recoveryDisabled?: boolean
  }
  requiresUserAction: boolean
  warningMessage?: string // Banner message to show user
}

/**
 * Simplified Matrix Encryption State Service
 * Default to unencrypted chat, only setup encryption when entering encrypted rooms
 */
export class MatrixEncryptionStateService {
  // Simplified flags
  private encryptionSkipped = false
  private knownEncryptedRooms = new Set<string>() // Cache of confirmed encrypted rooms

  constructor () {
    logger.debug('🔍 Simplified MatrixEncryptionStateService initialized - unencrypted-first approach')
  }

  /**
   * Mark encryption as intentionally skipped by user
   */
  markEncryptionSkipped (): void {
    this.encryptionSkipped = true
    logger.debug('🚫 Encryption marked as intentionally skipped by user')
  }

  /**
   * Clear the encryption skipped flag (for new sessions)
   */
  clearEncryptionSkipped (): void {
    this.encryptionSkipped = false
    logger.debug('🔄 Encryption skipped flag cleared')
  }

  /**
   * Clear the encrypted rooms cache (for encryption resets)
   */
  clearEncryptedRoomsCache (): void {
    this.knownEncryptedRooms.clear()
    logger.debug('🔄 Encrypted rooms cache cleared')
  }

  /**
   * Get encryption state using simplified unencrypted-first approach
   * Following element-web pattern: only require encryption when in encrypted rooms
   */
  async getEncryptionState (client: MatrixClient | null, roomId?: string): Promise<MatrixEncryptionStatus> {
    logger.debug('🔍 Getting simplified encryption state - unencrypted first approach', { roomId })

    // Step 1: Basic client availability
    if (!client) {
      return {
        state: 'needs_login',
        details: {
          hasClient: false,
          hasCrypto: false,
          canChat: false
        },
        requiresUserAction: true
      }
    }

    // Step 2: We have a client! Default to ready for unencrypted chat
    const crypto = client.getCrypto()
    const hasCrypto = !!crypto

    logger.debug('🔍 Basic Matrix state:', { hasClient: true, hasCrypto })

    // Step 3: Check if we're trying to access an encrypted room
    let isInEncryptedRoom = false
    if (roomId && crypto) {
      try {
        isInEncryptedRoom = await this.isRoomEncrypted(client, roomId)
        logger.debug('🔍 Room encryption check:', { roomId, isInEncryptedRoom })
      } catch (error) {
        logger.debug('Could not check room encryption:', error)
        isInEncryptedRoom = false
      }
    }

    // Step 4: Determine state based on simplified logic
    if (!isInEncryptedRoom) {
      // For unencrypted rooms, we don't need any encryption setup - just ready for chat!
      logger.debug('🔍 Not in encrypted room - defaulting to ready_unencrypted state')
      return {
        state: 'ready_unencrypted',
        details: {
          hasClient: true,
          hasCrypto: true,
          isInEncryptedRoom: false,
          canChat: true
        },
        requiresUserAction: false
      }
    }

    // We're in an encrypted room - check if encryption is ready
    if (!crypto) {
      logger.debug('🔐 In encrypted room but no crypto - need device verification')
      return {
        state: 'needs_device_verification',
        details: {
          hasClient: true,
          hasCrypto: false,
          isInEncryptedRoom: true,
          canChat: false
        },
        requiresUserAction: true,
        warningMessage: 'Encryption not available - please verify your device'
      }
    }

    // Check encryption capabilities following Element Web DeviceListener pattern
    try {
      const [
        ,
        keyBackupInfo,
        deviceKeys,
        crossSigningStatus,
        secretStorageReady,
        defaultKeyId,
        deviceVerificationStatus
      ] = await Promise.all([
        crypto.isCrossSigningReady().catch((err) => {
          logger.debug('Cross-signing ready check failed (non-fatal):', err?.message || 'Unknown error')
          return false
        }),
        crypto.getKeyBackupInfo().catch((err) => {
          logger.debug('Key backup info check failed (non-fatal):', err?.message || 'Unknown error')
          return null
        }),
        crypto.getOwnDeviceKeys().catch((err) => {
          logger.debug('Device keys check failed (non-fatal):', err?.message || 'Unknown error')
          return null
        }),
        crypto.getCrossSigningStatus().catch(() => ({
          privateKeysCachedLocally: { masterKey: false, selfSigningKey: false, userSigningKey: false }
        })),
        crypto.isSecretStorageReady().catch(() => false),
        client.secretStorage.getDefaultKeyId().catch(() => null),
        crypto.getDeviceVerificationStatus(client.getUserId()!, client.getDeviceId()!).catch(() => null)
      ])

      // FIXED: Use more reliable crossSigningStatus instead of isCrossSigningReady()
      // which can return false even when cross-signing is working
      const crossSigningReady = crossSigningStatus?.privateKeysCachedLocally?.masterKey &&
                               crossSigningStatus?.privateKeysCachedLocally?.selfSigningKey &&
                               crossSigningStatus?.privateKeysCachedLocally?.userSigningKey

      const hasKeyBackup = !!(keyBackupInfo && keyBackupInfo.version)
      const hasDeviceKeys = !!deviceKeys
      // Element Web pattern: only check crossSigningVerified, not signedByOwner
      // This is more robust in multi-device scenarios
      const isCurrentDeviceTrusted = Boolean(deviceVerificationStatus?.crossSigningVerified)

      // Debug logging for multi-device scenarios
      if (deviceVerificationStatus) {
        logger.debug('🔍 Device verification details:', {
          deviceId: client.getDeviceId(),
          userId: client.getUserId(),
          crossSigningVerified: deviceVerificationStatus.crossSigningVerified,
          signedByOwner: deviceVerificationStatus.signedByOwner,
          isVerified: deviceVerificationStatus.isVerified?.(),
          isCurrentDeviceTrusted
        })
      }
      const allCrossSigningSecretsCached = !!(
        crossSigningStatus.privateKeysCachedLocally.masterKey &&
        crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
        crossSigningStatus.privateKeysCachedLocally.userSigningKey
      )
      const hasDefaultKeyId = !!defaultKeyId
      const keyBackupUploadActive = hasKeyBackup && await crypto.getActiveSessionBackupVersion().catch(() => null) !== null

      logger.debug('🔍 Encryption capabilities (Element Web style):', {
        crossSigningReady,
        hasKeyBackup,
        hasDeviceKeys,
        isCurrentDeviceTrusted,
        allCrossSigningSecretsCached,
        secretStorageReady,
        hasDefaultKeyId,
        keyBackupUploadActive
      })

      // Follow Element Web DeviceListener logic exactly
      if (!isCurrentDeviceTrusted) {
        logger.debug('🔐 Current device not verified: needs device verification')
        return {
          state: 'needs_device_verification',
          details: {
            hasClient: true,
            hasCrypto: true,
            isInEncryptedRoom: true,
            canChat: true, // Element Web allows chat while showing verification toast
            crossSigningReady,
            hasKeyBackup,
            hasDeviceKeys,
            isCurrentDeviceTrusted,
            allCrossSigningSecretsCached,
            secretStorageReady,
            hasDefaultKeyId,
            keyBackupUploadActive
          },
          requiresUserAction: true,
          warningMessage: 'Verify this session to access encrypted messages'
        }
      } else if (!allCrossSigningSecretsCached) {
        logger.debug('🔐 Some secrets not cached, but chat is working - show as ready with warning')
        // If we can decrypt messages, don't force encryption setup - just show warning banner
        return {
          state: 'ready_encrypted_with_warning',
          details: {
            hasClient: true,
            hasCrypto: true,
            isInEncryptedRoom: true,
            canChat: true, // Chat is working even if some keys aren't cached
            crossSigningReady,
            hasKeyBackup,
            hasDeviceKeys,
            isCurrentDeviceTrusted,
            allCrossSigningSecretsCached,
            secretStorageReady,
            hasDefaultKeyId,
            keyBackupUploadActive
          },
          requiresUserAction: false, // Don't block chat for missing cached keys
          warningMessage: 'Some encryption keys may need to be restored from backup'
        }
      } else if (!keyBackupUploadActive) {
        logger.debug('🔐 Key backup upload is off: needs key backup')
        return {
          state: 'needs_key_backup',
          details: {
            hasClient: true,
            hasCrypto: true,
            isInEncryptedRoom: true,
            canChat: true,
            crossSigningReady,
            hasKeyBackup,
            hasDeviceKeys,
            isCurrentDeviceTrusted,
            allCrossSigningSecretsCached,
            secretStorageReady,
            hasDefaultKeyId,
            keyBackupUploadActive
          },
          requiresUserAction: true,
          warningMessage: 'Turn on key backup to secure your encrypted messages'
        }
      } else if (!hasDefaultKeyId && keyBackupUploadActive) {
        logger.debug('🔐 No recovery setup: can encrypt but should set up recovery')
        return {
          state: 'ready_encrypted_with_warning',
          details: {
            hasClient: true,
            hasCrypto: true,
            isInEncryptedRoom: true,
            canChat: true,
            crossSigningReady,
            hasKeyBackup,
            hasDeviceKeys,
            isCurrentDeviceTrusted,
            allCrossSigningSecretsCached,
            secretStorageReady,
            hasDefaultKeyId,
            keyBackupUploadActive
          },
          requiresUserAction: false, // Can chat, just a warning
          warningMessage: 'Generate a recovery key to restore encrypted messages if you lose access to your devices'
        }
      } else {
        logger.debug('✅ Ready for encrypted chat with full backup')
        return {
          state: 'ready_encrypted',
          details: {
            hasClient: true,
            hasCrypto: true,
            isInEncryptedRoom: true,
            canChat: true,
            crossSigningReady,
            hasKeyBackup,
            hasDeviceKeys,
            isCurrentDeviceTrusted,
            allCrossSigningSecretsCached,
            secretStorageReady,
            hasDefaultKeyId,
            keyBackupUploadActive
          },
          requiresUserAction: false
        }
      }
    } catch (error) {
      logger.warn('Error checking encryption capabilities:', error)
      return {
        state: 'ready_encrypted_with_warning',
        details: {
          hasClient: true,
          hasCrypto: true,
          isInEncryptedRoom: true,
          canChat: true // Allow chat on error, show warning
        },
        requiresUserAction: false,
        warningMessage: 'Unable to verify encryption status - messages may not be fully secure'
      }
    }
  }

  /**
   * Check if a room is encrypted (following element-web pattern)
   */
  private async isRoomEncrypted (client: MatrixClient, roomId: string): Promise<boolean> {
    const crypto = client.getCrypto()
    if (!crypto) return false

    try {
      let actualRoomId = roomId

      // Handle room alias vs room ID
      if (roomId.startsWith('#')) {
        // Room alias - try multiple approaches to resolve it
        logger.debug('🔍 Checking encryption for room alias:', roomId)

        // First, check if the room is already known locally
        const rooms = client.getRooms()
        const matchingRoom = rooms.find(room => {
          const canonicalAlias = room.getCanonicalAlias()
          const altAliases = room.getAltAliases()
          return canonicalAlias === roomId || (altAliases && altAliases.includes(roomId))
        })

        if (matchingRoom) {
          actualRoomId = matchingRoom.roomId
          logger.debug('✅ Found room locally via alias:', { alias: roomId, roomId: actualRoomId })
        } else {
          // Try to resolve via Matrix API
          try {
            const roomIdResult = await client.getRoomIdForAlias(roomId)
            actualRoomId = roomIdResult.room_id
            logger.debug('✅ Resolved room alias via API:', { alias: roomId, roomId: actualRoomId })
          } catch (aliasError) {
            logger.debug('⚠️ Could not resolve room alias for encryption check:', aliasError)
            // Don't return false here - maybe the room doesn't exist yet or we're not invited
            // Default to assuming unencrypted for now (better UX than blocking)
            return false
          }
        }
      } else if (roomId.startsWith('!')) {
        // Already a proper room ID
        actualRoomId = roomId
      } else {
        logger.debug('Invalid room identifier format for encryption check:', roomId)
        return false
      }

      // Check cache first - if we know this room is encrypted, stick with that
      if (this.knownEncryptedRooms.has(actualRoomId)) {
        logger.debug('✅ Room encryption from cache:', { roomId: actualRoomId, isEncrypted: true })
        return true
      }

      // Priority 1: Direct room state check (immediate when available)
      const room = client.getRoom(actualRoomId)
      if (room) {
        // Method 1: Check timeline for encrypted messages (fastest)
        const timeline = room.getLiveTimeline()
        if (timeline) {
          const events = timeline.getEvents()
          const hasEncryptedMessages = events.some(event =>
            event.getType() === 'm.room.encrypted' || event.isEncrypted()
          )
          if (hasEncryptedMessages) {
            logger.debug('🔍 Timeline-based encryption detection - found encrypted messages:', {
              roomId: actualRoomId,
              totalEvents: events.length
            })
            this.knownEncryptedRooms.add(actualRoomId)
            return true
          }
        }

        // Method 2: Use hasEncryptionStateEvent if available
        if (room.hasEncryptionStateEvent) {
          const hasEncryptionState = room.hasEncryptionStateEvent()
          logger.debug('🔍 Room state encryption check (hasEncryptionStateEvent):', {
            roomId: actualRoomId,
            hasEncryptionState
          })

          if (hasEncryptionState) {
            this.knownEncryptedRooms.add(actualRoomId)
            return true
          }
        }

        // Method 3: Fallback to manual state event check
        const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '')
        const isEncrypted = !!encryptionEvent
        logger.debug('🔍 Manual state event encryption check:', {
          roomId: actualRoomId,
          hasEncryptionEvent: isEncrypted,
          encryptionEventContent: encryptionEvent?.getContent()
        })

        if (isEncrypted) {
          this.knownEncryptedRooms.add(actualRoomId)
        }

        return isEncrypted
      } else {
        logger.debug('🔍 Room not found locally, assuming unencrypted:', actualRoomId)
        return false
      }
    } catch (encryptionCheckError) {
      logger.debug('⚠️ Encryption check failed for room (treating as unencrypted):', {
        originalRoomId: roomId,
        error: encryptionCheckError?.message || 'Unknown error'
      })
      return false
    }
  }

  /**
   * Check if encryption is working for a specific room
   */
  async canEncryptInRoom (client: MatrixClient | null, roomId: string): Promise<boolean> {
    if (!client) return false
    return await this.isRoomEncrypted(client, roomId)
  }

  /**
   * Re-check encryption state after joining a room
   * This is useful because encryption status might not be available until after joining
   */
  async recheckEncryptionAfterJoin (client: MatrixClient | null, roomId: string): Promise<MatrixEncryptionStatus> {
    if (!client) {
      return {
        state: 'needs_login',
        details: { hasClient: false, hasCrypto: false, canChat: false },
        requiresUserAction: true
      }
    }

    // Wait a moment for room state to propagate
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the encryption state with the room ID
    return await this.getEncryptionState(client, roomId)
  }

  /**
   * Wait for Matrix SDK to be ready for chat operations
   */
  async waitForChatReady (client: MatrixClient, timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const status = await this.getEncryptionState(client)

      if (status.details.canChat) {
        return true
      }

      if (status.state === 'needs_device_verification' || status.state === 'needs_recovery_key') {
        // These states require user action, no point waiting
        return false
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    logger.warn('Timeout waiting for Matrix chat to be ready')
    return false
  }

  /**
   * Simple helper to determine what UI to show (Element Web style)
   */
  getRequiredUI (state: MatrixEncryptionState): 'none' | 'login' | 'banner' | 'encryption_setup' {
    switch (state) {
      case 'ready_unencrypted':
      case 'ready_encrypted':
        return 'none'
      case 'needs_login':
        return 'login'
      case 'ready_encrypted_with_warning':
      case 'needs_key_backup':
        return 'banner' // Show warning banner but allow chat
      case 'needs_device_verification':
        return 'none' // Allow chat without verification for now
      case 'needs_recovery_key':
        return 'encryption_setup' // Show setup dialog
      default:
        return 'login'
    }
  }
}

// Export singleton instance
export const matrixEncryptionState = new MatrixEncryptionStateService()
