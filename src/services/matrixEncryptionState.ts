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

// Simplified encryption states following element-web pattern
export type MatrixEncryptionState =
  | 'needs_login' // No Matrix client available
  | 'ready_unencrypted' // Can chat, no encryption needed (default state)
  | 'needs_encryption_for_room' // In encrypted room, needs setup
  | 'ready_encrypted' // Full encryption working

export interface MatrixEncryptionStatus {
  state: MatrixEncryptionState
  details: {
    hasClient: boolean
    hasCrypto: boolean
    isInEncryptedRoom?: boolean
    canChat: boolean // Key addition: can we chat right now?
    // Encryption details (only relevant for encrypted rooms)
    crossSigningReady?: boolean
    hasKeyBackup?: boolean
    hasDeviceKeys?: boolean
  }
  requiresUserAction: boolean
}

/**
 * Simplified Matrix Encryption State Service
 * Default to unencrypted chat, only setup encryption when entering encrypted rooms
 */
export class MatrixEncryptionStateService {
  // Simplified flags
  private encryptionSkipped = false

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
   * Get encryption state using simplified unencrypted-first approach
   * Following element-web pattern: only require encryption when in encrypted rooms
   */
  async getEncryptionState (client: MatrixClient | null, roomId?: string): Promise<MatrixEncryptionStatus> {
    logger.debug('🔍 Getting simplified encryption state - unencrypted first approach')

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
      // Default state: ready for unencrypted chat
      logger.debug('✅ Ready for unencrypted chat')
      return {
        state: 'ready_unencrypted',
        details: {
          hasClient: true,
          hasCrypto,
          isInEncryptedRoom: false,
          canChat: true
        },
        requiresUserAction: false
      }
    }

    // We're in an encrypted room - check if encryption is ready
    if (!crypto) {
      logger.debug('🔐 In encrypted room but no crypto - need encryption setup')
      return {
        state: 'needs_encryption_for_room',
        details: {
          hasClient: true,
          hasCrypto: false,
          isInEncryptedRoom: true,
          canChat: false
        },
        requiresUserAction: true
      }
    }

    // Check encryption capabilities for this room
    try {
      const [crossSigningReady, keyBackupInfo, deviceKeys] = await Promise.all([
        crypto.isCrossSigningReady().catch(() => false),
        crypto.getKeyBackupInfo().catch(() => null),
        crypto.getOwnDeviceKeys().catch(() => null)
      ])

      const hasKeyBackup = !!(keyBackupInfo && keyBackupInfo.version)
      const hasDeviceKeys = !!deviceKeys

      logger.debug('🔍 Encryption capabilities:', {
        crossSigningReady,
        hasKeyBackup,
        hasDeviceKeys
      })

      // For encrypted rooms, we need at least device keys to participate
      if (hasDeviceKeys) {
        logger.debug('✅ Ready for encrypted chat')
        return {
          state: 'ready_encrypted',
          details: {
            hasClient: true,
            hasCrypto: true,
            isInEncryptedRoom: true,
            canChat: true,
            crossSigningReady,
            hasKeyBackup,
            hasDeviceKeys
          },
          requiresUserAction: false
        }
      } else {
        logger.debug('🔐 In encrypted room but no device keys - need encryption setup')
        return {
          state: 'needs_encryption_for_room',
          details: {
            hasClient: true,
            hasCrypto: true,
            isInEncryptedRoom: true,
            canChat: false,
            crossSigningReady,
            hasKeyBackup,
            hasDeviceKeys
          },
          requiresUserAction: true
        }
      }
    } catch (error) {
      logger.warn('Error checking encryption capabilities:', error)
      return {
        state: 'needs_encryption_for_room',
        details: {
          hasClient: true,
          hasCrypto: true,
          isInEncryptedRoom: true,
          canChat: false
        },
        requiresUserAction: true
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

      // Now check encryption status with the actual room ID
      const isEncrypted = await crypto.isEncryptionEnabledInRoom(actualRoomId)
      logger.debug('🔍 Room encryption check result:', { roomId: actualRoomId, isEncrypted })
      return isEncrypted
    } catch (error) {
      logger.debug('Could not check room encryption capability:', error)
      // Default to unencrypted rather than blocking the UI
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

      if (status.state === 'needs_encryption_for_room') {
        // This state requires user action, no point waiting
        return false
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    logger.warn('Timeout waiting for Matrix chat to be ready')
    return false
  }

  /**
   * Simple helper to determine what UI to show (simplified)
   */
  getRequiredUI (state: MatrixEncryptionState): 'none' | 'login' | 'encryption_setup' {
    switch (state) {
      case 'ready_unencrypted':
      case 'ready_encrypted':
        return 'none'
      case 'needs_login':
        return 'login'
      case 'needs_encryption_for_room':
        return 'encryption_setup'
      default:
        return 'login'
    }
  }
}

// Export singleton instance
export const matrixEncryptionState = new MatrixEncryptionStateService()
