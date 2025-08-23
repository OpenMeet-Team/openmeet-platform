/**
 * Event-Driven Matrix Encryption State Manager
 *
 * Replaces polling-based encryption state with reactive event-driven state management.
 * Uses Matrix SDK events as the source of truth instead of repeated polling.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { EventEmitter } from 'events'
import { logger } from '../utils/logger'

export interface MatrixEncryptionStatus {
  state: 'needs_login' | 'ready_unencrypted' | 'ready_encrypted_with_warning' | 'ready_encrypted' | 'needs_device_verification'
  details: {
    hasClient: boolean
    hasCrypto: boolean
    canChat: boolean
    hasBackup?: boolean
    isCurrentDeviceTrusted?: boolean
    allCrossSigningSecretsCached?: boolean
  }
  requiresUserAction: boolean
  warningMessage?: string
}

class MatrixEncryptionStateManager extends EventEmitter {
  private currentState: MatrixEncryptionStatus | null = null
  private client: MatrixClient | null = null
  private eventListenersAttached = false

  /**
   * Initialize with Matrix client and set up event listeners
   */
  initialize (client: MatrixClient | null): void {
    if (this.client === client) return // Already initialized with this client

    // Clean up previous listeners
    this.cleanup()

    this.client = client

    if (!client) {
      this.updateState({
        state: 'needs_login',
        details: { hasClient: false, hasCrypto: false, canChat: false },
        requiresUserAction: true
      })
      return
    }

    // Set up Matrix SDK event listeners for reactive updates
    this.setupMatrixEventListeners()

    // Calculate initial state
    this.calculateState()
  }

  /**
   * Get current encryption state (cached, no recalculation)
   */
  getCurrentState (): MatrixEncryptionStatus | null {
    return this.currentState
  }

  /**
   * Set up Matrix SDK event listeners for reactive state updates
   */
  private setupMatrixEventListeners (): void {
    if (!this.client || this.eventListenersAttached) return

    const client = this.client

    // Key backup status changes
    client.on('crypto.keyBackupStatus' as any, (enabled: boolean) => {
      logger.debug('🔐 Key backup status changed:', enabled)
      this.calculateState()
    })

    // Cross-signing key changes
    client.on('crypto.crossSigning.keysChanged' as any, () => {
      logger.debug('🔐 Cross-signing keys changed')
      this.calculateState()
    })

    // Device verification changes
    client.on('crypto.devicesUpdated' as any, (users: string[]) => {
      logger.debug('🔐 Device verification updated for users:', users)
      this.calculateState()
    })

    // Trust status changes
    client.on('crypto.userTrustStatusChanged' as any, (userId: string) => {
      logger.debug('🔐 Trust status changed for user:', userId)
      this.calculateState()
    })

    // Client sync state changes (but much less frequently)
    client.on('sync' as any, (state: string) => {
      if (state === 'PREPARED') { // Only when sync is fully prepared
        logger.debug('🔐 Matrix sync prepared, checking encryption state')
        this.calculateState()
      }
    })

    this.eventListenersAttached = true
    logger.debug('🔐 Matrix encryption event listeners attached')
  }

  /**
   * Calculate current encryption state based on Matrix SDK state
   */
  private async calculateState (): Promise<void> {
    if (!this.client) return

    try {
      const crypto = this.client.getCrypto()
      if (!crypto) {
        this.updateState({
          state: 'ready_unencrypted',
          details: { hasClient: true, hasCrypto: false, canChat: true },
          requiresUserAction: false
        })
        return
      }

      // Get encryption capabilities (similar to Element Web)
      const [
        hasKeyBackup,
        isCurrentDeviceTrusted,
        allCrossSigningSecretsCached
      ] = await Promise.all([
        this.checkKeyBackup(),
        this.checkCurrentDeviceTrust(),
        this.checkCrossSigningSecrets()
      ])

      // Determine state based on capabilities
      let state: MatrixEncryptionStatus['state']
      let warningMessage: string | undefined

      if (hasKeyBackup && isCurrentDeviceTrusted && allCrossSigningSecretsCached) {
        state = 'ready_encrypted'
      } else if (isCurrentDeviceTrusted && allCrossSigningSecretsCached) {
        state = 'ready_encrypted_with_warning'
        warningMessage = 'Consider setting up key backup for message recovery'
      } else if (!isCurrentDeviceTrusted) {
        state = 'needs_device_verification'
      } else {
        state = 'ready_encrypted_with_warning'
        warningMessage = 'Some encryption keys may need to be restored from backup'
      }

      this.updateState({
        state,
        details: {
          hasClient: true,
          hasCrypto: true,
          canChat: true,
          hasBackup: hasKeyBackup,
          isCurrentDeviceTrusted,
          allCrossSigningSecretsCached
        },
        requiresUserAction: state === 'needs_device_verification',
        warningMessage
      })
    } catch (error) {
      logger.error('Failed to calculate encryption state:', error)
    }
  }

  private async checkKeyBackup (): Promise<boolean> {
    try {
      const crypto = this.client!.getCrypto()!
      const keyBackupInfo = await crypto.getActiveSessionBackupVersion()
      return !!keyBackupInfo
    } catch {
      return false
    }
  }

  private async checkCurrentDeviceTrust (): Promise<boolean> {
    try {
      const crypto = this.client!.getCrypto()!
      const deviceId = this.client!.getDeviceId()
      if (!deviceId) return false

      const device = await crypto.getDeviceVerificationStatus(this.client!.getUserId()!, deviceId)
      return device?.isVerified() ?? false
    } catch {
      return false
    }
  }

  private async checkCrossSigningSecrets (): Promise<boolean> {
    try {
      const crypto = this.client!.getCrypto()!
      const secretStorage = (crypto as any).getSecretsManager?.()
      
      if (!secretStorage) {
        // Fallback: assume we have secret storage if crypto is available
        return true
      }

      // Check if we have the essential cross-signing secrets
      const masterKey = await secretStorage.isSecretStored('m.cross_signing.master')
      const selfSigningKey = await secretStorage.isSecretStored('m.cross_signing.self_signing')
      const userSigningKey = await secretStorage.isSecretStored('m.cross_signing.user_signing')

      return masterKey && selfSigningKey && userSigningKey
    } catch {
      return false
    }
  }

  /**
   * Update state and emit change event
   */
  private updateState (newState: MatrixEncryptionStatus): void {
    const stateChanged = !this.currentState ||
      this.currentState.state !== newState.state ||
      JSON.stringify(this.currentState.details) !== JSON.stringify(newState.details)

    if (stateChanged) {
      const oldState = this.currentState
      this.currentState = newState

      logger.debug('🔐 Encryption state updated:', {
        from: oldState?.state || 'null',
        to: newState.state,
        details: newState.details
      })

      // Emit change event for reactive updates
      this.emit('stateChanged', newState, oldState)
    }
  }

  /**
   * Clean up event listeners
   */
  private cleanup (): void {
    if (this.client && this.eventListenersAttached) {
      this.client.removeAllListeners('crypto.keyBackupStatus' as any)
      this.client.removeAllListeners('crypto.crossSigning.keysChanged' as any)
      this.client.removeAllListeners('crypto.devicesUpdated' as any)
      this.client.removeAllListeners('crypto.userTrustStatusChanged' as any)
      this.client.removeAllListeners('sync' as any)

      this.eventListenersAttached = false
      logger.debug('🔐 Matrix encryption event listeners cleaned up')
    }
  }

  /**
   * Force a state recalculation (use sparingly)
   */
  async forceRefresh (): Promise<void> {
    await this.calculateState()
  }
}

// Singleton instance
export const matrixEncryptionStateManager = new MatrixEncryptionStateManager()
