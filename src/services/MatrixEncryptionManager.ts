/**
 * Unified Matrix Encryption Manager
 *
 * Consolidates all Matrix encryption functionality into a single service:
 * - Main encryption operations (setup, reset, unlock) from MatrixEncryptionService
 * - Event-driven state management from MatrixEncryptionStateManager
 * - Simplified interface patterns from matrixEncryptionState
 *
 * Follows Element Web's proven patterns while providing reactive state updates.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { ClientEvent } from 'matrix-js-sdk'
import { EventEmitter } from 'events'
import { encodeRecoveryKey, decodeRecoveryKey, type GeneratedSecretStorageKey, type CryptoApi, type DeviceVerificationStatus } from 'matrix-js-sdk/lib/crypto-api'
import { logger } from '../utils/logger'
import { checkMASAuthReturn } from './createCrossSigning'
import {
  setSecretStorageBeingAccessed,
  cacheSecretStorageKeyForBootstrap,
  clearSecretStorageCache
} from './MatrixClientManager'

// Combined interfaces from all three services
export interface EncryptionResult {
  success: boolean
  error?: string
  recoveryKey?: string
  needsSetup?: boolean
  message?: string
}

export interface EncryptionStatus {
  isReady: boolean
  needsSetup: boolean
  hasSecretStorage: boolean
  hasCrossSigningKeys: boolean
  hasKeyBackup: boolean
  deviceVerified: boolean
  canDecryptHistory: boolean
  errors?: string[]
}

// Enhanced encryption states combining all approaches
export type MatrixEncryptionState =
  | 'needs_login' // No Matrix client available
  | 'ready_unencrypted' // Can chat, no encryption needed (default state)
  | 'ready_encrypted_with_warning' // Can encrypt but needs backup setup
  | 'ready_encrypted' // Full encryption working
  | 'needs_device_verification' // Device needs verification
  | 'needs_recovery_key' // Fresh setup - need to create new keys with MAS
  | 'needs_key_recovery' // Recovery - keys exist but need to be recovered
  | 'needs_key_backup' // Key backup is off
  | 'needs_device_reset' // Device key mismatch - needs reset

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
 * Unified Matrix Encryption Manager
 *
 * Combines encryption operations, event-driven state management, and simplified interfaces
 */
export class MatrixEncryptionManager extends EventEmitter {
  private matrixClient: MatrixClient | null = null
  private operationInProgress = false
  private currentState: MatrixEncryptionStatus | null = null
  private eventListenersAttached = false

  // Simplified flags from matrixEncryptionState
  private encryptionSkipped = false
  private knownEncryptedRooms = new Set<string>() // Cache of confirmed encrypted rooms

  // Circuit breaker to prevent loops during client restart/reset
  private clientRestartInProgress = false
  private lastKeyChangeTime = 0
  private lastCalculateStateTime = 0
  private calculateStateTimeout: ReturnType<typeof setTimeout> | null = null

  constructor (matrixClient?: MatrixClient) {
    super()
    if (matrixClient && this.isClientUsable(matrixClient)) {
      this.initialize(matrixClient)
    }
    logger.debug('🔐 MatrixEncryptionManager initialized')
  }

  /**
   * Check if Matrix client is in a usable state
   */
  private isClientUsable (client: MatrixClient): boolean {
    try {
      // Check if client is invalid
      if (!client) {
        logger.debug('❌ Matrix client is invalid')
        return false
      }

      // Check if client has valid access token
      const accessToken = client.getAccessToken()
      if (!accessToken) {
        logger.debug('❌ Matrix client has no access token')
        return false
      }

      // Check if client has basic required state
      if (!client.getUserId() || !client.getDeviceId()) {
        logger.debug('❌ Matrix client missing user ID or device ID')
        return false
      }

      // Check if crypto is available and not corrupted
      const crypto = client.getCrypto()
      if (!crypto) {
        logger.debug('❌ Matrix client has no crypto')
        return false
      }

      return true
    } catch (error) {
      logger.debug('❌ Matrix client validation failed:', error)
      return false
    }
  }

  /**
   * Safely get device verification status to prevent "null pointer passed to rust" errors
   */
  private async safeGetDeviceVerificationStatus (crypto: CryptoApi, client: MatrixClient): Promise<DeviceVerificationStatus | null> {
    try {
      const userId = client.getUserId()
      const deviceId = client.getDeviceId()

      if (!userId || !deviceId) {
        logger.debug('❌ Missing userId or deviceId for device verification check')
        return null
      }

      // Double-check client is still valid before making crypto call
      if (!this.isClientUsable(client)) {
        logger.debug('❌ Client became invalid before device verification check')
        return null
      }

      return await crypto.getDeviceVerificationStatus(userId, deviceId)
    } catch (error) {
      logger.debug('⚠️ Safe device verification status check failed:', error?.message || 'Unknown error')
      return null
    }
  }

  /**
   * Initialize with Matrix client and set up event listeners
   */
  initialize (client: MatrixClient | null): void {
    if (this.matrixClient === client) return // Already initialized with this client

    // Clean up previous listeners
    this.cleanup()

    this.matrixClient = client

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
    if (!this.matrixClient || this.eventListenersAttached) return

    // Key backup status changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = this.matrixClient as any
    client.on('crypto.keyBackupStatus', (enabled: boolean) => {
      logger.debug('🔐 Key backup status changed:', enabled)

      // Circuit breaker: prevent loops during client restart
      if (this.clientRestartInProgress) {
        logger.debug('🚫 Key backup status change ignored - client restart in progress')
        return
      }

      this.calculateState()
    })

    // Cross-signing key changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('crypto.crossSigning.keysChanged', () => {
      logger.debug('🔐 Cross-signing keys changed')

      // Circuit breaker: prevent rapid-fire state calculations during client restart
      const now = Date.now()
      if (this.clientRestartInProgress) {
        logger.debug('🚫 Cross-signing key change ignored - client restart in progress')
        return
      }

      // Debounce rapid key changes (within 1 second)
      if (now - this.lastKeyChangeTime < 1000) {
        logger.debug('🚫 Cross-signing key change debounced - too recent')
        return
      }

      this.lastKeyChangeTime = now
      this.calculateState()
    })

    // Device verification changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('crypto.devicesUpdated', (users: string[]) => {
      logger.debug('🔐 Device verification updated for users:', users)

      // Circuit breaker: prevent loops during client restart
      if (this.clientRestartInProgress) {
        logger.debug('🚫 Device verification update ignored - client restart in progress')
        return
      }

      this.calculateState()
    })

    // Trust status changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on('crypto.userTrustStatusChanged', (userId: string) => {
      logger.debug('🔐 Trust status changed for user:', userId)

      // Circuit breaker: prevent loops during client restart
      if (this.clientRestartInProgress) {
        logger.debug('🚫 Trust status change ignored - client restart in progress')
        return
      }

      this.calculateState()
    })

    // Client sync state changes (but much less frequently)
    this.matrixClient.on(ClientEvent.Sync, (state: string) => {
      if (state === 'PREPARED') { // Only when sync is fully prepared
        logger.debug('🔐 Matrix sync prepared, checking encryption state')
        this.calculateState()
      }
    })

    this.eventListenersAttached = true
    logger.debug('🔐 Matrix encryption event listeners attached')
  }

  /**
   * Calculate current encryption state based on Matrix SDK state with debouncing
   */
  private async calculateState (): Promise<void> {
    if (!this.matrixClient) return

    // Circuit breaker: prevent rapid-fire state calculations during client restart
    if (this.clientRestartInProgress) {
      logger.debug('🚫 Calculate state ignored - client restart in progress')
      return
    }

    // Debounce rapid calculateState calls (within 500ms)
    const now = Date.now()
    if (now - this.lastCalculateStateTime < 500) {
      logger.debug('🚫 Calculate state debounced - too recent')

      // Clear existing timeout and set new one
      if (this.calculateStateTimeout) {
        clearTimeout(this.calculateStateTimeout)
      }

      this.calculateStateTimeout = setTimeout(() => {
        this.calculateStateTimeout = null
        this.performCalculateState()
      }, 500)

      return
    }

    this.lastCalculateStateTime = now
    await this.performCalculateState()
  }

  /**
   * Perform the actual state calculation (internal method)
   */
  private async performCalculateState (): Promise<void> {
    if (!this.matrixClient) return

    try {
      logger.debug('🔐 Calculating encryption state...')
      const crypto = this.matrixClient.getCrypto()
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
        allCrossSigningSecretsCached,
        hasDeviceKeyMismatch
      ] = await Promise.all([
        this.checkKeyBackup(),
        this.checkCurrentDeviceTrust(),
        this.checkCrossSigningSecrets(),
        this.checkDeviceKeyMismatch()
      ])

      // Determine state based on capabilities
      let state: MatrixEncryptionStatus['state']
      let warningMessage: string | undefined

      // Check device key mismatch first - this is a critical issue
      if (hasDeviceKeyMismatch) {
        state = 'needs_device_reset'
        warningMessage = 'Device encryption keys are out of sync and need to be reset'
      } else {
        // Also check for the specific pattern from your logs: device verified but not cross-signing verified
        // This often indicates a device key mismatch where Matrix SDK has conflicting device information
        // Check for device mismatch pattern using shared method
        const deviceId = this.matrixClient!.getDeviceId()
        const userId = this.matrixClient!.getUserId()
        if (deviceId && userId) {
          try {
            const device = await crypto.getDeviceVerificationStatus(userId, deviceId)
            if (await this.checkDeviceMismatchFromStatus(device)) {
              state = 'needs_device_reset'
              warningMessage = 'Device key verification mismatch detected - reset required'
            }
          } catch (error) {
            logger.warn('Failed to check device verification pattern:', error)
          }
        }
      }

      if (!state) {
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
      }

      this.updateState({
        state,
        details: {
          hasClient: true,
          hasCrypto: true,
          canChat: true,
          hasKeyBackup,
          isCurrentDeviceTrusted,
          allCrossSigningSecretsCached
        },
        requiresUserAction: state === 'needs_device_verification' || state === 'needs_device_reset',
        warningMessage
      })
    } catch (error) {
      logger.error('Failed to calculate encryption state:', error)
    }
  }

  private async checkKeyBackup (): Promise<boolean> {
    try {
      const crypto = this.matrixClient!.getCrypto()!
      const keyBackupInfo = await crypto.getActiveSessionBackupVersion()
      return !!keyBackupInfo
    } catch {
      return false
    }
  }

  private async checkCurrentDeviceTrust (): Promise<boolean> {
    try {
      const crypto = this.matrixClient!.getCrypto()!
      const deviceId = this.matrixClient!.getDeviceId()
      const userId = this.matrixClient!.getUserId()
      if (!deviceId || !userId) return false

      const device = await crypto.getDeviceVerificationStatus(userId, deviceId)

      // Element Web approach: Accept either crossSigningVerified OR signedByOwner
      // crossSigningVerified can be unreliable immediately after bootstrap
      const crossSigningVerified = device?.crossSigningVerified ?? false
      const signedByOwner = device?.signedByOwner ?? false
      const isBasicallyVerified = device?.isVerified?.() ?? false

      // Device is trusted if it's signed by owner OR cross-signing verified
      // This handles the case where crossSigningVerified is slow to update after bootstrap
      const isTrusted = (signedByOwner && isBasicallyVerified) || crossSigningVerified

      logger.debug('🔍 Device trust check:', {
        deviceId,
        userId,
        isVerified: isBasicallyVerified,
        crossSigningVerified,
        signedByOwner,
        isTrusted
      })

      return isTrusted
    } catch (error) {
      logger.error('Failed to check device trust:', error)
      return false
    }
  }

  /**
   * Check for device key mismatch pattern from device verification status
   * This detects the pattern: isVerified=true but crossSigningVerified=false
   * BUT only when cross-signing keys exist on the server (indicating actual mismatch)
   * If no cross-signing keys exist, this pattern indicates "needs setup" not "mismatch"
   */
  private async checkDeviceMismatchFromStatus (deviceVerificationStatus: unknown): Promise<boolean> {
    if (!deviceVerificationStatus) {
      return false
    }

    // Skip device mismatch check during operations to avoid false positives during reset
    if (this.operationInProgress) {
      logger.debug('🔄 Skipping device mismatch check - operation in progress')
      return false
    }

    // Type guard to check if object has the expected verification methods
    const hasVerificationMethods = (obj: unknown): obj is {
      isVerified(): boolean
      crossSigningVerified: boolean
      signedByOwner: boolean
    } => {
      return typeof obj === 'object' && obj !== null &&
        'isVerified' in obj && typeof (obj as { isVerified: unknown }).isVerified === 'function' &&
        'crossSigningVerified' in obj &&
        'signedByOwner' in obj
    }

    if (!hasVerificationMethods(deviceVerificationStatus)) {
      return false
    }

    const isVerifiedButNotCrossSigned = deviceVerificationStatus.isVerified() && !deviceVerificationStatus.crossSigningVerified

    if (isVerifiedButNotCrossSigned) {
      try {
        // Check if cross-signing infrastructure exists on server
        const crypto = this.matrixClient?.getCrypto()
        const hasCrossSigningKeys = await crypto?.isCrossSigningReady().catch(() => false)

        if (!hasCrossSigningKeys) {
          // No cross-signing keys on server = needs initial setup, not mismatch
          const deviceId = this.matrixClient?.getDeviceId()
          logger.debug('✅ Device needs initial encryption setup (not mismatch)', {
            deviceId,
            isVerified: deviceVerificationStatus.isVerified(),
            crossSigningVerified: deviceVerificationStatus.crossSigningVerified,
            signedByOwner: deviceVerificationStatus.signedByOwner,
            hasCrossSigningKeys
          })
          return false
        }

        // Check if secret storage is ready - if not, this is incomplete setup, not mismatch
        const secretStorageReady = await crypto?.isSecretStorageReady().catch(() => false)
        if (!secretStorageReady) {
          // Cross-signing exists but no recovery key = incomplete setup after reset
          const deviceId = this.matrixClient?.getDeviceId()
          logger.debug('✅ Device needs recovery key generation (not mismatch)', {
            deviceId,
            isVerified: deviceVerificationStatus.isVerified(),
            crossSigningVerified: deviceVerificationStatus.crossSigningVerified,
            signedByOwner: deviceVerificationStatus.signedByOwner,
            hasCrossSigningKeys,
            secretStorageReady
          })
          return false
        }

        // Before treating this as a mismatch, check if this might be normal post-setup state
        // If we just completed encryption setup, this should be device verification, not reset
        const recentSetup = localStorage.getItem('lastEncryptionSetup')
        const isRecentSetup = recentSetup && (Date.now() - parseInt(recentSetup)) < 300000 // 5 minutes

        if (isRecentSetup) {
          const deviceId = this.matrixClient?.getDeviceId()
          logger.debug('✅ Device needs verification after recent encryption setup (not mismatch)', {
            deviceId,
            isVerified: deviceVerificationStatus.isVerified(),
            crossSigningVerified: deviceVerificationStatus.crossSigningVerified,
            signedByOwner: deviceVerificationStatus.signedByOwner,
            hasCrossSigningKeys,
            secretStorageReady,
            timeSinceSetup: Date.now() - parseInt(recentSetup)
          })
          return false
        }

        // If it's not recent setup, then this might be an actual device mismatch
        const deviceId = this.matrixClient?.getDeviceId()
        logger.warn('🔍 Device mismatch pattern detected: verified but not cross-signing verified', {
          deviceId,
          isVerified: deviceVerificationStatus.isVerified(),
          crossSigningVerified: deviceVerificationStatus.crossSigningVerified,
          signedByOwner: deviceVerificationStatus.signedByOwner,
          hasCrossSigningKeys
        })
        return true
      } catch (error) {
        logger.warn('Failed to check cross-signing status for mismatch detection:', error)
        // Conservative approach: don't treat as mismatch if we can't determine
        return false
      }
    }

    return false
  }

  /**
   * Check for device key mismatch that indicates "our own device might have been deleted"
   * This is the server-based check (less reliable than status-based check)
   */
  private async checkDeviceKeyMismatch (): Promise<boolean> {
    try {
      const crypto = this.matrixClient!.getCrypto()!
      const deviceId = this.matrixClient!.getDeviceId()
      const userId = this.matrixClient!.getUserId()
      if (!deviceId || !userId) return false

      logger.debug('🔍 Checking for device key mismatch:', { deviceId, userId })

      // Get device info from server to check for mismatch
      const userDeviceInfo = await crypto.getUserDeviceInfo([userId], true) // downloadUncached = true
      const serverDevices = userDeviceInfo.get(userId)

      if (!serverDevices) {
        logger.warn('⚠️ No device info returned from server - possible mismatch')
        return true // Assume mismatch if no server devices found
      }

      // Check if our current device ID exists on server
      const currentDeviceExists = serverDevices.has(deviceId)
      const serverDeviceIds = Array.from(serverDevices.keys())

      logger.debug('🔍 Device existence check:', {
        currentDeviceId: deviceId,
        serverDeviceIds,
        currentDeviceExists
      })

      if (!currentDeviceExists) {
        logger.warn('❌ Device key mismatch detected! Current device ID not found on server', {
          currentDeviceId: deviceId,
          serverDeviceIds,
          userId
        })
        return true
      }

      // Additional check: if we have very different device IDs, it might indicate a mismatch
      // Look for the pattern from your error logs where device keys have mismatched IDs
      const suspiciousMismatch = serverDeviceIds.some(serverId =>
        serverId !== deviceId && serverId.length === deviceId.length
      )

      if (suspiciousMismatch && serverDeviceIds.length > 0) {
        // Note: This condition detects potential device ID patterns but is not reliable
        // enough to trigger a reset. The real device verification check happens via
        // checkDeviceMismatchFromStatus() which looks at verification states.
        // Removed the noisy warning to prevent infinite encryption state recalculation loops.
      }

      logger.debug('✅ Device ID verified - no mismatch detected')
      return false
    } catch (error) {
      logger.warn('⚠️ Failed to check device key mismatch:', error)
      // Conservative approach: assume no mismatch if check fails
      return false
    }
  }

  private async checkCrossSigningSecrets (): Promise<boolean> {
    try {
      const crypto = this.matrixClient!.getCrypto()!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const secretStorage = (crypto as any).getSecretsManager?.()

      if (!secretStorage) {
        // Fallback: assume we have secret storage if crypto is available
        return true
      }

      // Check if we have the essential cross-signing secrets
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const masterKey = await (secretStorage as any).isSecretStored('m.cross_signing.master')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selfSigningKey = await (secretStorage as any).isSecretStored('m.cross_signing.self_signing')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userSigningKey = await (secretStorage as any).isSecretStored('m.cross_signing.user_signing')

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
    if (this.matrixClient && this.eventListenersAttached) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = this.matrixClient as any
      client.removeAllListeners('crypto.keyBackupStatus')
      client.removeAllListeners('crypto.crossSigning.keysChanged')
      client.removeAllListeners('crypto.devicesUpdated')
      client.removeAllListeners('crypto.userTrustStatusChanged')
      this.matrixClient.removeAllListeners(ClientEvent.Sync)

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

  // ============================================================================
  // ENCRYPTION OPERATIONS (from MatrixEncryptionService)
  // ============================================================================

  /**
   * Element Web's withSecretStorageKeyCache pattern - now using global cache
   */
  private async withSecretStorageKeyCache<T> (operation: () => Promise<T>): Promise<T> {
    logger.debug('🔧 Starting operation with global secret storage cache')
    this.operationInProgress = true
    setSecretStorageBeingAccessed(true)
    try {
      return await operation()
    } finally {
      logger.debug('🔧 Clearing global secret storage cache')
      this.operationInProgress = false
      setSecretStorageBeingAccessed(false)
      clearSecretStorageCache()
    }
  }

  /**
   * Check current encryption status (legacy compatibility)
   */
  async getStatus (): Promise<EncryptionStatus> {
    try {
      // Guard against getCrypto not being available (client not fully initialized)
      if (!this.matrixClient || typeof this.matrixClient.getCrypto !== 'function') {
        return {
          isReady: false,
          needsSetup: true,
          hasSecretStorage: false,
          hasCrossSigningKeys: false,
          hasKeyBackup: false,
          deviceVerified: false,
          canDecryptHistory: false,
          errors: ['Matrix client crypto not available']
        }
      }

      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          isReady: false,
          needsSetup: true,
          hasSecretStorage: false,
          hasCrossSigningKeys: false,
          hasKeyBackup: false,
          deviceVerified: false,
          canDecryptHistory: false
        }
      }

      const [hasSecretStorage, hasCrossSigningKeys] = await Promise.all([
        crypto.isSecretStorageReady().catch(() => false),
        crypto.isCrossSigningReady().catch(() => false)
      ])

      let deviceVerified = false
      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      if (userId && deviceId) {
        try {
          const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
          deviceVerified = deviceStatus?.isVerified() || false
        } catch (error) {
          logger.debug('Could not get device verification status:', error)
        }
      }

      const isReady = hasSecretStorage && hasCrossSigningKeys && deviceVerified
      const canDecryptHistory = isReady

      return {
        isReady,
        needsSetup: !isReady,
        hasSecretStorage,
        hasCrossSigningKeys,
        hasKeyBackup: false, // TODO: Implement key backup detection
        deviceVerified,
        canDecryptHistory
      }
    } catch (error) {
      logger.error('Failed to get encryption status:', error)
      return {
        isReady: false,
        needsSetup: true,
        hasSecretStorage: false,
        hasCrossSigningKeys: false,
        hasKeyBackup: false,
        deviceVerified: false,
        canDecryptHistory: false
      }
    }
  }

  /**
   * Setup encryption - Element Web's simple bootstrap pattern
   *
   * This method now follows Element Web's proven approach:
   * 1. Create cross-signing keys first (via createCrossSigning)
   * 2. Bootstrap secret storage with recovery key
   * 3. Setup key backup automatically
   *
   * @param recoveryKey Optional recovery key for unlocking existing storage
   */
  async setupEncryption (recoveryKey?: string): Promise<EncryptionResult> {
    return this.withSecretStorageKeyCache(async () => {
      try {
        logger.debug('🔧 Starting encryption setup (Element Web pattern)')

        // Check for MAS auth return first
        const masReturn = checkMASAuthReturn()
        if (masReturn.isReturn) {
          logger.debug('🔄 Detected return from MAS auth:', masReturn.flowType)

          // Handle verification workflow resumption
          if (masReturn.verificationState) {
            const verState = masReturn.verificationState as { step: string; deviceId: string; userId: string }
            logger.debug('🔄 Resuming verification workflow after MAS return:', verState)

            // Update verification state to indicate MAS approval completed
            const resumeState = {
              ...verState,
              step: 'mas_approved',
              resumeTime: Date.now()
            }
            localStorage.setItem('verificationWorkflowState', JSON.stringify(resumeState))
          }

          // Continue with setup after MAS approval
        }

        const crypto = this.matrixClient!.getCrypto()
        if (!crypto) {
          return { success: false, error: 'Crypto not available' }
        }

        // Check if we need to unlock existing storage
        const hasExistingKey = await this.matrixClient!.secretStorage.hasKey()
        if (hasExistingKey && recoveryKey) {
          logger.debug('🔓 Unlocking existing secret storage with recovery key')
          return await this.unlockExistingStorage(recoveryKey)
        }

        // Always reset encryption when doing fresh setup to prevent key conflicts
        // This prevents "One time key already exists" errors from previous failed attempts
        if (!recoveryKey) {
          logger.debug('🔄 Resetting encryption to prevent key conflicts before fresh setup')

          // Import and use the proper UIA callback
          const { uiAuthCallback } = await import('./createCrossSigning')

          // Use Matrix SDK's proper reset method with UIA callback
          await crypto.resetEncryption((makeRequest) => uiAuthCallback(this.matrixClient!, makeRequest, 'first_time_setup'))
          logger.debug('✅ Encryption reset completed, ready for fresh bootstrap')
        }

        // Fresh setup - Element Web's approach
        logger.debug('🆕 Setting up fresh encryption')
        logger.debug(`🔍 hasExistingKey: ${hasExistingKey}, recoveryKey provided: ${!!recoveryKey}`)
        return await this.setupFreshEncryption()
      } catch (error) {
        logger.error('❌ Encryption setup failed:', error)

        // Check for MAS reset completion error
        if (error instanceof Error && error.message === 'MAS_RESET_COMPLETE_NEW_KEY_NEEDED') {
          logger.debug('🔄 MAS cross-signing reset completed - signaling need for new key generation')
          throw error // Re-throw to be caught by calling code
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
  }

  /**
   * Wait for next Matrix sync to ensure server has processed changes
   */
  private async waitForMatrixSync (): Promise<void> {
    return new Promise(resolve => {
      const onSync = () => {
        this.matrixClient!.off(ClientEvent.Sync, onSync)
        logger.debug('✅ Matrix sync completed - server should be ready')
        resolve()
      }

      logger.debug('⏳ Waiting for Matrix sync to complete...')
      this.matrixClient!.on(ClientEvent.Sync, onSync)

      // Fallback timeout in case sync doesn't happen
      setTimeout(() => {
        this.matrixClient!.off(ClientEvent.Sync, onSync)
        logger.debug('⏰ Sync timeout - proceeding anyway')
        resolve()
      }, 5000)
    })
  }

  /**
   * Setup fresh encryption - Element Web's simple pattern
   *
   * This follows Element Web's InitialCryptoSetupStore approach:
   * 1. Bootstrap both cross-signing AND secret storage together to avoid prompts
   * 2. Let SDK handle key backup automatically
   * 3. Then manually verify the current device
   */
  private async setupFreshEncryption (): Promise<EncryptionResult> {
    const crypto = this.matrixClient!.getCrypto()!

    logger.debug('🔐 Setting up fresh encryption (Element Web InitialCryptoSetupStore pattern)')

    // Step 0: Ensure device keys are uploaded to the server FIRST
    // This is critical - cross-signing operations will fail if the device is unknown to the server
    const userId = this.matrixClient!.getUserId()
    const deviceId = this.matrixClient!.getDeviceId()
    logger.debug(`🔐 Verifying device registration for ${userId}/${deviceId}`)

    try {
      // Wait for initial Matrix sync to complete - Element Web pattern
      // Device keys are uploaded during initial sync, not before
      logger.debug('🔐 Waiting for initial Matrix sync to complete (Element Web pattern)')
      while (!this.matrixClient!.isInitialSyncComplete()) {
        logger.debug('⏳ Initial sync not yet complete, waiting...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      logger.debug('✅ Initial Matrix sync completed - device keys should be uploaded')
    } catch (error) {
      logger.warn('⚠️ Device registration verification failed:', error)
    }

    // Step 1: Use Matrix SDK's combined bootstrap approach
    // Bootstrap secret storage AND cross-signing together to avoid export issues
    logger.debug('🔑 Bootstrapping secret storage and cross-signing together')
    let recoveryKeyInfo: unknown

    // Bootstrap everything together - this is the cleanest approach
    await crypto.bootstrapCrossSigning({
      authUploadDeviceSigningKeys: async (makeRequest) => {
        // Import the uiAuthCallback function
        const { uiAuthCallback } = await import('./createCrossSigning')
        return uiAuthCallback(this.matrixClient!, makeRequest, 'first_time_setup')
      },
      setupNewCrossSigning: true // Force new keys since we just did a reset
    })

    logger.debug('✅ Cross-signing keys created successfully')

    // Wait a moment for bootstrap to complete internal operations
    logger.debug('⏳ Waiting for bootstrap cross-signing to complete internal device verification')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Now bootstrap secret storage - cross-signing keys will be exported automatically
    await crypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => {
        logger.debug('🔑 Generating secret storage key')
        const keyInfo = await crypto.createRecoveryKeyFromPassphrase()
        recoveryKeyInfo = keyInfo
        return keyInfo as GeneratedSecretStorageKey // Type assertion to match Matrix SDK expected return type
      }
    })

    logger.debug('✅ Secret storage created and cross-signing keys exported')

    // Record that we just completed a cross-signing reset to avoid redundant resets
    localStorage.setItem('lastCrossSigningReset', Date.now().toString())

    // Clear any pending MAS auth flags since we just completed setup
    sessionStorage.removeItem('masAuthInProgress')

    // Step 3: Check for existing backup and enable if none exists (Element Web pattern)
    logger.debug('🔐 Checking and enabling key backup...')
    const currentKeyBackup = await crypto.checkKeyBackupAndEnable()
    if (currentKeyBackup === null) {
      await crypto.resetKeyBackup()
      logger.debug('✅ Key backup reset and enabled')
    } else {
      logger.debug('✅ Key backup already enabled')
    }

    // Step 4: Use the recovery key generated during bootstrap
    logger.debug('🔑 Using recovery key generated during secret storage bootstrap')

    if (!recoveryKeyInfo) {
      throw new Error('Failed to create recovery key')
    }

    // Extract and encode the recovery key for display
    const recoveryKeyData = this.extractRecoveryKey(recoveryKeyInfo)
    const encodedRecoveryKey = encodeRecoveryKey(recoveryKeyData)

    // Step 5: Check device verification status after fresh setup
    logger.debug('🔐 Checking device verification status after fresh setup')

    if (userId && deviceId) {
      try {
        // Fix device key mismatch by refreshing device state after cross-signing setup
        logger.debug('🔑 Refreshing device state after cross-signing setup')

        // Wait for cross-signing to settle
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Refresh device key state to resolve potential mismatches
        try {
          const currentDeviceId = this.matrixClient!.getDeviceId()
          const currentUserId = this.matrixClient!.getUserId()

          logger.debug('🔍 Current device info:', {
            deviceId: currentDeviceId,
            userId: currentUserId
          })

          // Force a /keys/query to refresh device key state from server
          // This helps resolve device key mismatches after cross-signing setup
          if (currentUserId) {
            await crypto.getUserDeviceInfo([currentUserId], true) // downloadUncached = true
            logger.debug('✅ Device info refreshed from server')
          }
        } catch (refreshError) {
          logger.warn('⚠️ Device state refresh failed (continuing anyway):', refreshError)
        }

        // Check device verification status after bootstrap
        const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
        logger.debug('🔍 Device verification status after bootstrap:', {
          isVerified: deviceStatus?.isVerified(),
          crossSigningVerified: deviceStatus?.crossSigningVerified,
          signedByOwner: deviceStatus?.signedByOwner
        })

        // The device should be automatically cross-signed during bootstrapCrossSigning
        // If it's not, there might be a timing issue - let's wait and check again
        if (!deviceStatus?.crossSigningVerified) {
          logger.debug('🔐 Device not cross-signing verified after bootstrap, checking if this resolves automatically')

          try {
            // Wait a bit longer for the SDK to complete cross-signing
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Check again after waiting
            const finalStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
            logger.debug('🔍 Final device verification status after additional wait:', {
              isVerified: finalStatus?.isVerified(),
              crossSigningVerified: finalStatus?.crossSigningVerified,
              signedByOwner: finalStatus?.signedByOwner
            })

            if (!finalStatus?.crossSigningVerified) {
              logger.warn('⚠️ Device still not cross-signing verified after bootstrap completion')

              // The Matrix SDK should automatically handle device verification during bootstrap
              // If it doesn't, this indicates the device needs manual verification through the UI
              logger.debug('💡 Device verification may need to be completed through recovery key UI')

              logger.debug('💡 If device verification banners still appear, this indicates a Matrix SDK integration issue')
            } else {
              logger.debug('✅ Device cross-signing verification completed successfully after wait')
            }
          } catch (statusError) {
            logger.warn('⚠️ Error checking final device verification status:', statusError)
          }
        } else {
          logger.debug('✅ Device verification handled automatically by Matrix SDK during bootstrap')
        }
      } catch (error) {
        logger.warn('⚠️ Could not check/set device verification after fresh setup:', error)
      }
    }

    logger.debug('✅ Fresh encryption setup completed successfully (Element Web pattern)')

    // Mark that we just completed encryption setup (used to distinguish setup from mismatch)
    localStorage.setItem('lastEncryptionSetup', Date.now().toString())

    return {
      success: true,
      recoveryKey: encodedRecoveryKey
    }
  }

  /**
   * Unlock existing secret storage - Element Web's accessSecretStorage pattern
   */
  private async unlockExistingStorage (recoveryKey: string): Promise<EncryptionResult> {
    try {
      logger.debug('🔓 Unlocking existing secret storage with recovery key')
      const crypto = this.matrixClient!.getCrypto()!

      // Get the default key info
      const defaultKeyId = await this.matrixClient!.secretStorage.getDefaultKeyId()
      if (!defaultKeyId) {
        throw new Error('No default secret storage key found')
      }

      const keyInfo = await this.matrixClient!.secretStorage.getKey(defaultKeyId)
      if (!keyInfo) {
        throw new Error('Secret storage key info not found')
      }

      // Decode recovery key
      let recoveryKeyBytes: Uint8Array
      try {
        recoveryKeyBytes = decodeRecoveryKey(recoveryKey)
      } catch (error) {
        throw new Error('Invalid recovery key format')
      }

      // Cache the recovery key for the bootstrap process
      cacheSecretStorageKeyForBootstrap(defaultKeyId, keyInfo, recoveryKeyBytes)

      logger.debug('🔑 Recovery key cached, bootstrapping cross-signing and secret storage...')

      // Element Web pattern: bootstrap both cross-signing and secret storage with cached key
      await crypto.bootstrapCrossSigning({})
      await crypto.bootstrapSecretStorage({})

      // Check for existing backup and enable if needed
      const currentKeyBackup = await crypto.checkKeyBackupAndEnable()
      if (currentKeyBackup === null) {
        await crypto.resetKeyBackup()
        logger.debug('✅ Key backup reset and enabled')
      }

      // Element Web approach with fallback: Trust Matrix SDK, but verify it worked
      logger.debug('🔄 Waiting for Matrix SDK to update device verification state after unlock...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check if device was properly signed during bootstrap
      const userId = this.matrixClient!.getUserId()
      const deviceId = this.matrixClient!.getDeviceId()
      if (userId && deviceId) {
        try {
          const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
          logger.debug('🔍 Post-bootstrap device status check:', {
            isVerified: deviceStatus?.isVerified(),
            crossSigningVerified: deviceStatus?.crossSigningVerified,
            signedByOwner: deviceStatus?.signedByOwner
          })

          // If device wasn't properly signed by bootstrap (like when MAS is skipped), sign it manually
          if (!deviceStatus?.signedByOwner && !deviceStatus?.crossSigningVerified) {
            logger.debug('🔐 Bootstrap did not sign device - manually signing with cross-signing keys')
            try {
              await crypto.crossSignDevice(deviceId)
              logger.debug('✅ Device manually signed after bootstrap')

              // Element Web approach: Trust the Matrix SDK and UserTrustStatusChanged event
              // Don't immediately check status - let the reactive system handle UI updates
              logger.debug('🔔 Trusting Matrix SDK UserTrustStatusChanged event for UI updates')
            } catch (signingError) {
              logger.warn('⚠️ Manual device signing failed:', signingError)
            }
          } else {
            logger.debug('✅ Device properly signed during bootstrap')
          }
        } catch (error) {
          logger.warn('⚠️ Could not verify device signing after bootstrap:', error)
        }
      }

      logger.debug('✅ Existing storage unlocked successfully')

      return {
        success: true
      }
    } catch (error) {
      logger.error('❌ Failed to unlock existing storage:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Extract recovery key from Matrix SDK response
   */
  private extractRecoveryKey (recoveryKeyInfo: unknown): Uint8Array {
    if (recoveryKeyInfo instanceof Uint8Array) {
      return recoveryKeyInfo
    }

    if (recoveryKeyInfo && typeof recoveryKeyInfo === 'object') {
      const keyObj = recoveryKeyInfo as { key?: Uint8Array, privateKey?: Uint8Array }
      if (keyObj.key instanceof Uint8Array) {
        return keyObj.key
      }
      if (keyObj.privateKey instanceof Uint8Array) {
        return keyObj.privateKey
      }
    }

    throw new Error('Could not extract recovery key from Matrix SDK response')
  }

  /**
   * Reset encryption completely - Element Web pattern with UIA support
   */
  async resetEncryption (): Promise<EncryptionResult> {
    try {
      logger.debug('🔄 Resetting encryption completely with UIA support')
      const crypto = this.matrixClient!.getCrypto()
      if (!crypto) {
        return { success: false, error: 'Crypto not available' }
      }

      // Import and use the proper UIA callback
      const { uiAuthCallback } = await import('./createCrossSigning')

      // Reset everything using UIA callback (Element Web's resetEncryption pattern)
      await crypto.resetEncryption((makeRequest) => uiAuthCallback(this.matrixClient!, makeRequest, 'device_reset'))
      logger.debug('✅ Encryption reset completed')
      return { success: true }
    } catch (error) {
      logger.error('❌ Encryption reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reset failed'
      }
    }
  }

  /**
   * Clear Matrix crypto storage from browser for device reset
   */
  private async clearMatrixCryptoStorage (userId: string, deviceId: string): Promise<void> {
    try {
      logger.debug('🧹 Clearing Matrix crypto storage from browser...', { userId, deviceId })

      // 1. Clear IndexedDB crypto databases - only for specific user/device combination
      const databases = await indexedDB.databases()
      const exactCryptoDbPattern = new RegExp(`matrix-js-sdk:crypto:${userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:${deviceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`)

      for (const db of databases) {
        if (db.name && exactCryptoDbPattern.test(db.name)) {
          logger.debug('🗑️ Deleting crypto database:', db.name)
          const deleteRequest = indexedDB.deleteDatabase(db.name)
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => resolve(undefined)
            deleteRequest.onerror = () => reject(deleteRequest.error)
            deleteRequest.onblocked = () => {
              logger.warn(`⚠️ Database deletion blocked for ${db.name}, continuing...`)
              resolve(undefined) // Don't fail the entire operation
            }
          })
        }
      }

      // 2. Clear localStorage crypto keys - only for current user (preserve access tokens and device IDs)
      const userPrefix = userId.replace('@', '').replace(':', '_')
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
          // Clear encryption setup flags for current user only
          key.includes(`encryption_setup_needed_${userPrefix}`) ||
          // Clear general crypto keys
          key.startsWith('mx_crypto_') ||
          key.startsWith('matrix_crypto_') ||
          // Clear lastCrossSigningReset but only for current user
          (key === 'lastCrossSigningReset' && localStorage.getItem(key)?.includes(userId))
        )) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        logger.debug('🗑️ Cleared crypto localStorage key:', key)
      })

      // 3. Clear sessionStorage crypto keys - only for current user
      const sessionKeysToRemove = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && (
          key.includes(`matrix_session_${userPrefix}`) ||
          key.startsWith('mx_crypto_') ||
          key.startsWith('matrix_crypto_')
        )) {
          sessionKeysToRemove.push(key)
        }
      }

      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key)
        logger.debug('🗑️ Cleared crypto sessionStorage key:', key)
      })

      logger.debug('✅ Matrix crypto storage cleared successfully')
    } catch (error) {
      logger.error('❌ Failed to clear Matrix crypto storage:', error)
      throw error
    }
  }

  /**
   * Reset device encryption keys to fix device key mismatches
   * Uses Element Web's proven resetEncryption + clearStores approach to reset both server and client sides
   */
  async resetDeviceKeys (): Promise<EncryptionResult> {
    try {
      logger.debug('🔄 Starting complete encryption reset using Element Web approach')

      const crypto = this.matrixClient!.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto API not available'
        }
      }

      // Use Element Web's resetEncryption method with UIA callback
      const { uiAuthCallback } = await import('./createCrossSigning')
      await crypto.resetEncryption((makeRequest) => uiAuthCallback(this.matrixClient!, makeRequest, 'device_reset'))

      logger.debug('✅ Element Web style resetEncryption completed successfully')

      // Force clear all secret storage caches to ensure state consistency
      logger.debug('🧹 Clearing all secret storage caches after reset')
      try {
        // Clear our app-level secret storage cache
        clearSecretStorageCache()
        logger.debug('✅ App-level secret storage cache cleared')

        // Matrix SDK doesn't expose cache clearing methods directly
        // The resetEncryption() call should handle internal cache clearing
        logger.debug('✅ Relying on resetEncryption() for internal cache management')
      } catch (cacheError) {
        logger.warn('⚠️ Failed to clear caches (continuing anyway):', cacheError)
      }

      // Wait for Matrix SDK internal state to settle after reset
      logger.debug('⏳ Waiting for Matrix SDK state to settle after reset')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update encryption state after reset
      logger.debug('🔄 Recalculating encryption state after reset')
      await this.calculateState()

      return {
        success: true,
        message: 'Complete encryption reset successful. Your device encryption has been fully reset.',
        needsSetup: true
      }
    } catch (error) {
      logger.error('❌ Complete encryption reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Complete reset failed'
      }
    }
  }

  /**
   * Check for and handle MAS authentication returns
   * Should be called when the app initializes to complete interrupted reset flows
   */
  async handleMASReturn (): Promise<{ handled: boolean; success?: boolean; error?: string }> {
    const masReturn = checkMASAuthReturn()

    if (!masReturn.isReturn) {
      return { handled: false }
    }

    logger.debug('🔄 Handling MAS return:', masReturn)

    try {
      // If we have reset context, we need to complete a reset operation
      const resetOperation = (masReturn.resetContext as { operation?: string })?.operation
      if (masReturn.resetContext && (resetOperation === 'reset_device_keys' || resetOperation === 'complete' || resetOperation === 'forgot_recovery_key')) {
        logger.debug('🔄 Completing interrupted reset operation after MAS return')

        // Complete the reset operation that was interrupted by MAS redirect
        const result = await this.completeResetAfterMAS()

        if (result.success) {
          logger.debug('✅ Successfully completed reset operation after MAS return')

          // Emit event to notify UI components
          window.dispatchEvent(new CustomEvent('mas-reset-completed', {
            detail: {
              operation: (masReturn.resetContext as { operation?: string }).operation,
              timestamp: Date.now(),
              recoveryKey: result.recoveryKey,
              message: result.message
            }
          }))

          return { handled: true, success: true }
        } else {
          logger.error('❌ Failed to complete reset operation after MAS return:', result.error)
          return { handled: true, success: false, error: result.error }
        }
      }

      // For other flow types, just log that we handled the return
      logger.debug('✅ Handled MAS return for flow type:', masReturn.flowType)
      return { handled: true, success: true }
    } catch (error) {
      logger.error('❌ Error handling MAS return:', error)
      return { handled: true, success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Complete reset operation after returning from MAS authorization
   */
  private async completeResetAfterMAS (): Promise<EncryptionResult> {
    try {
      logger.debug('🔄 Completing reset operation after MAS authorization')

      // At this point, the user has completed MAS authorization
      // We need to verify that the reset was successful and update our state
      await this.calculateState()

      // Check if encryption needs setup after reset
      const crypto = this.matrixClient!.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto API not available after MAS return'
        }
      }

      const isReady = await crypto.isCrossSigningReady().catch(() => false)

      if (!isReady) {
        logger.debug('🔄 Cross-signing not ready after MAS return, completing local setup')

        // The server-side reset was successful via MAS, now complete the local client setup
        // This should not require another MAS authorization since the server reset is done
        try {
          const setupResult = await this.setupEncryption('default-passphrase')

          if (setupResult.success) {
            logger.debug('✅ Local encryption setup completed after MAS reset')
            return {
              success: true,
              message: 'Reset and encryption setup completed successfully.',
              recoveryKey: setupResult.recoveryKey
            }
          } else {
            logger.warn('⚠️ Local encryption setup failed after MAS reset:', setupResult.error)
            // Fall back to indicating setup is needed
            return {
              success: true,
              message: 'Reset completed successfully. Please complete encryption setup manually.',
              needsSetup: true
            }
          }
        } catch (error) {
          logger.error('❌ Error during local encryption setup after MAS reset:', error)
          return {
            success: true,
            message: 'Reset completed successfully. Please complete encryption setup manually.',
            needsSetup: true
          }
        }
      } else {
        logger.debug('✅ Cross-signing ready after MAS return')
        return {
          success: true,
          message: 'Reset completed successfully.'
        }
      }
    } catch (error) {
      logger.error('❌ Failed to complete reset after MAS return:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete reset after MAS return'
      }
    } finally {
      // Clean up URL parameters after handling MAS return
      try {
        const url = new URL(window.location.href)
        const hasOAuthParams = url.searchParams.has('code') || url.searchParams.has('state')

        if (hasOAuthParams) {
          // Remove OAuth parameters from URL to clean up browser history
          url.searchParams.delete('code')
          url.searchParams.delete('state')
          url.searchParams.delete('session_state') // Sometimes present with OIDC

          // Update URL without reloading the page
          window.history.replaceState({}, document.title, url.toString())
          logger.debug('🧹 Cleaned up OAuth parameters from URL')
        }
      } catch (error) {
        logger.warn('⚠️ Failed to clean up URL parameters:', error)
      }
    }
  }

  /**
   * Handle cross-signing key loss - stub for compatibility
   */
  async handleCrossSigningKeyLoss (): Promise<boolean> {
    logger.debug('🔧 Cross-signing key loss detected - deferring to user-initiated recovery')

    // Don't attempt automatic recovery that requires UIA during page load
    // This would show unexpected dialogs and potentially redirect the user to MAS
    // Instead, let the UI components handle this with appropriate user prompts
    logger.debug('ℹ️ Automatic cross-signing recovery skipped - requires user interaction')

    // Emit an event to let UI components know that user intervention is needed
    window.dispatchEvent(new CustomEvent('matrix:crossSigningRecoveryNeeded', {
      detail: {
        reason: 'key_loss_detected',
        requiresUserAction: true
      }
    }))

    return false // Indicate that automatic recovery was not performed
  }

  /**
   * Get debug info - stub for compatibility
   */
  async getDebugInfo (): Promise<Record<string, unknown>> {
    try {
      const status = await this.getStatus()
      return {
        status,
        timestamp: new Date().toISOString(),
        clientReady: !!this.matrixClient,
        cryptoReady: !!this.matrixClient?.getCrypto()
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  // ============================================================================
  // SIMPLIFIED INTERFACE PATTERNS (from matrixEncryptionState)
  // ============================================================================

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
  async getEncryptionState (client: MatrixClient | null = null, roomId?: string): Promise<MatrixEncryptionStatus> {
    const targetClient = client || this.matrixClient
    logger.debug('🔍 Getting simplified encryption state - unencrypted first approach', { roomId })

    // Step 1: Basic client availability and validation
    if (!targetClient || !this.isClientUsable(targetClient)) {
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
    const crypto = targetClient.getCrypto()
    const hasCrypto = !!crypto

    logger.debug('🔍 Basic Matrix state:', { hasClient: true, hasCrypto })

    // Step 3: Check if we're trying to access an encrypted room
    let isInEncryptedRoom = false
    if (roomId && crypto) {
      try {
        isInEncryptedRoom = await this.isRoomEncrypted(targetClient, roomId)
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
    // Add extra safety checks to prevent "null pointer passed to rust" errors
    try {
      // Validate client state again before making crypto calls
      if (!this.isClientUsable(targetClient)) {
        logger.debug('❌ Client became invalid during encryption state check')
        return {
          state: 'needs_login',
          details: {
            hasClient: false,
            hasCrypto: false,
            isInEncryptedRoom: true,
            canChat: false
          },
          requiresUserAction: true
        }
      }

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
        targetClient.secretStorage.getDefaultKeyId().catch(() => null),
        // Add extra safety for device verification - this is where the "null pointer" error comes from
        this.safeGetDeviceVerificationStatus(crypto, targetClient).catch(() => null)
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
          deviceId: targetClient.getDeviceId(),
          userId: targetClient.getUserId(),
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

      // Check for device key mismatch pattern using shared method
      if (await this.checkDeviceMismatchFromStatus(deviceVerificationStatus)) {
        return {
          state: 'needs_device_reset',
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
          warningMessage: 'Device key verification mismatch detected - reset required'
        }
      }

      // Follow Element Web DeviceListener logic with smart recovery detection
      if (!isCurrentDeviceTrusted) {
        // Smart detection: distinguish between recovery vs fresh setup
        const canRecoverKeys = secretStorageReady && hasKeyBackup && hasDefaultKeyId
        const needsFreshSetup = !secretStorageReady || !hasKeyBackup

        if (canRecoverKeys && !crossSigningReady && !allCrossSigningSecretsCached) {
          // Case 1: Recovery scenario - infrastructure exists but keys inaccessible
          logger.debug('🔑 Cross-signing key recovery needed - keys exist but inaccessible', {
            secretStorageReady,
            hasKeyBackup,
            hasDefaultKeyId,
            crossSigningReady,
            allCrossSigningSecretsCached
          })
          return {
            state: 'needs_key_recovery',
            details: {
              hasClient: true,
              hasCrypto: true,
              isInEncryptedRoom: true,
              canChat: false, // Block chat until keys are recovered
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
            warningMessage: 'Recover your encryption keys to access encrypted messages'
          }
        } else if (needsFreshSetup) {
          // Case 2: Fresh setup needed - no infrastructure exists
          logger.debug('🔐 Fresh encryption setup needed - no infrastructure exists', {
            secretStorageReady,
            hasKeyBackup,
            hasDefaultKeyId
          })
          return {
            state: 'needs_recovery_key',
            details: {
              hasClient: true,
              hasCrypto: true,
              isInEncryptedRoom: true,
              canChat: false, // Block chat until encryption is set up
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
            warningMessage: 'Set up encryption to access encrypted messages'
          }
        } else {
          logger.debug('🔐 Cross-signing exists but current device not verified: needs device verification')
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
    const targetClient = client || this.matrixClient
    if (!targetClient) return false
    return await this.isRoomEncrypted(targetClient, roomId)
  }

  /**
   * Re-check encryption state after joining a room
   * This is useful because encryption status might not be available until after joining
   */
  async recheckEncryptionAfterJoin (client: MatrixClient | null, roomId: string): Promise<MatrixEncryptionStatus> {
    const targetClient = client || this.matrixClient
    if (!targetClient) {
      return {
        state: 'needs_login',
        details: { hasClient: false, hasCrypto: false, canChat: false },
        requiresUserAction: true
      }
    }

    // Wait a moment for room state to propagate
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the encryption state with the room ID
    return await this.getEncryptionState(targetClient, roomId)
  }

  /**
   * Wait for Matrix SDK to be ready for chat operations
   */
  async waitForChatReady (client: MatrixClient | null, timeout: number = 10000): Promise<boolean> {
    const targetClient = client || this.matrixClient
    if (!targetClient) return false

    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const status = await this.getEncryptionState(targetClient)

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
  getRequiredUI (state: MatrixEncryptionState): 'none' | 'login' | 'banner' | 'encryption_setup' | 'key_recovery' {
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
      case 'needs_device_reset':
        return 'banner' // Show device reset banner
      case 'needs_recovery_key':
        return 'encryption_setup' // Show fresh setup dialog with MAS
      case 'needs_key_recovery':
        return 'key_recovery' // Show key recovery dialog (no MAS needed)
      default:
        return 'login'
    }
  }

  /**
   * Recover existing cross-signing keys from secret storage
   * This is the intelligent recovery path that doesn't require MAS reset
   */
  async recoverCrossSigningKeys (recoveryKey?: string): Promise<EncryptionResult> {
    return this.withSecretStorageKeyCache(async () => {
      try {
        logger.debug('🔑 Starting cross-signing key recovery (no reset needed)')

        const crypto = this.matrixClient!.getCrypto()
        if (!crypto) {
          return { success: false, error: 'Crypto not available' }
        }

        // Step 1: Check if we can access secret storage
        const hasExistingKey = await this.matrixClient!.secretStorage.hasKey()
        if (!hasExistingKey) {
          return { success: false, error: 'No secret storage key found - fresh setup required' }
        }

        // Step 2: Try to bootstrap cross-signing from existing keys
        logger.debug('🔍 Attempting to bootstrap cross-signing from existing secret storage')

        try {
          // Use Element Web's bootstrap approach without forcing new keys
          const { createCrossSigning } = await import('./createCrossSigning')
          await createCrossSigning(this.matrixClient!, false) // forceNew = false for recovery

          logger.debug('✅ Cross-signing bootstrap successful')
        } catch (bootstrapError) {
          logger.warn('⚠️ Cross-signing bootstrap failed, trying secret storage unlock:', bootstrapError)

          // If bootstrap fails, try unlocking secret storage first
          if (recoveryKey) {
            const unlockResult = await this.unlockExistingStorage(recoveryKey)
            if (!unlockResult.success) {
              return unlockResult
            }

            // Retry bootstrap after unlock
            const { createCrossSigning } = await import('./createCrossSigning')
            await createCrossSigning(this.matrixClient!, false)
          } else {
            return {
              success: false,
              error: 'Cross-signing keys inaccessible - recovery key may be needed',
              needsSetup: false // Don't trigger fresh setup
            }
          }
        }

        // Step 3: Verify cross-signing is now working
        const crossSigningReady = await crypto.isCrossSigningReady()
        if (!crossSigningReady) {
          return { success: false, error: 'Cross-signing recovery incomplete' }
        }

        // Step 4: Complete device verification using recovered keys
        logger.debug('🔐 Completing device verification with recovered keys')

        // Element Web approach with fallback: Trust Matrix SDK, but verify it worked
        logger.debug('🔄 Waiting for Matrix SDK to update device verification state...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Check if device was properly signed during bootstrap
        const userId = this.matrixClient!.getUserId()
        const deviceId = this.matrixClient!.getDeviceId()
        if (userId && deviceId) {
          try {
            const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
            logger.debug('🔍 Post-recovery device status check:', {
              isVerified: deviceStatus?.isVerified(),
              crossSigningVerified: deviceStatus?.crossSigningVerified,
              signedByOwner: deviceStatus?.signedByOwner
            })

            // If device wasn't properly signed by bootstrap (like when MAS is skipped), sign it manually
            if (!deviceStatus?.signedByOwner && !deviceStatus?.crossSigningVerified) {
              logger.debug('🔐 Bootstrap did not sign device - manually signing with cross-signing keys')
              try {
                await crypto.crossSignDevice(deviceId)
                logger.debug('✅ Device manually signed after key recovery')

                // Element Web approach: Trust the Matrix SDK and UserTrustStatusChanged event
                // Don't immediately check status - let the reactive system handle UI updates
                logger.debug('🔔 Trusting Matrix SDK UserTrustStatusChanged event for UI updates')
              } catch (signingError) {
                logger.warn('⚠️ Manual device signing failed after recovery:', signingError)
              }
            } else {
              logger.debug('✅ Device properly signed during bootstrap')
            }
          } catch (error) {
            logger.warn('⚠️ Could not verify device signing after recovery:', error)
          }
        }

        // Step 5: Ensure key backup is working
        let keyBackupReady = false
        try {
          const keyBackupInfo = await crypto.getKeyBackupInfo()
          keyBackupReady = !!(keyBackupInfo && keyBackupInfo.version)

          if (!keyBackupReady) {
            logger.debug('🔧 Setting up key backup with recovered keys')
            await crypto.checkKeyBackupAndEnable()
            keyBackupReady = true
          }
        } catch (backupError) {
          logger.warn('⚠️ Key backup setup failed after recovery:', backupError)
        }

        logger.debug('✅ Cross-signing key recovery completed successfully')

        // Emit state change to trigger UI updates
        this.emit('stateChanged')

        return {
          success: true,
          message: 'Encryption keys recovered successfully'
        }
      } catch (error) {
        logger.error('❌ Cross-signing key recovery failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Key recovery failed'
        }
      }
    })
  }

  /**
   * Set client restart flag to prevent event loops during reset
   */
  public setClientRestartInProgress (inProgress: boolean): void {
    this.clientRestartInProgress = inProgress
    if (inProgress) {
      logger.debug('🚫 Client restart circuit breaker activated')
    } else {
      logger.debug('✅ Client restart circuit breaker deactivated')
    }
  }

  /**
   * Check if client restart is in progress to prevent event loops
   */
  public isClientRestartInProgress (): boolean {
    return this.clientRestartInProgress
  }
}

// ============================================================================
// SERVICE INSTANCES AND COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Singleton instance - created lazily when matrix client is available
 */
let _matrixEncryptionManagerInstance: MatrixEncryptionManager | null = null

/**
 * Get or create the singleton MatrixEncryptionManager instance
 */
export function getMatrixEncryptionManager (client?: MatrixClient): MatrixEncryptionManager {
  if (!_matrixEncryptionManagerInstance) {
    _matrixEncryptionManagerInstance = new MatrixEncryptionManager(client)
  } else if (client) {
    _matrixEncryptionManagerInstance.initialize(client)
  }
  return _matrixEncryptionManagerInstance
}

// ============================================================================
// COMPATIBILITY EXPORTS FOR EXISTING CODE
// ============================================================================

// Export for MatrixEncryptionService compatibility
export { MatrixEncryptionManager as MatrixEncryptionService }

// Export singleton service with same interface as MatrixEncryptionService
export const matrixEncryptionService = {
  /**
   * Initialize encryption background - compatible with existing usage
   */
  async initializeEncryptionBackground (): Promise<void> {
    const { matrixClientService } = await import('./matrixClientService')
    const client = matrixClientService.getClient()
    if (!client) {
      console.warn('Matrix client not available for encryption initialization')
      return
    }

    const manager = getMatrixEncryptionManager(client)

    // Background initialization - check status and log
    try {
      const status = await manager.getStatus()
      logger.debug('🔐 Encryption status on background init:', status)
    } catch (error) {
      logger.error('❌ Failed to get encryption status on background init:', error)
    }
  },

  /**
   * Get encryption status - compatible with existing usage
   */
  async getEncryptionStatus () {
    const { matrixClientService } = await import('./matrixClientService')
    const client = matrixClientService.getClient()
    if (!client) {
      return {
        isReady: false,
        needsSetup: true,
        hasSecretStorage: false,
        hasCrossSigningKeys: false,
        hasKeyBackup: false,
        deviceVerified: false,
        canDecryptHistory: false,
        errors: ['No Matrix client available']
      }
    }

    const manager = getMatrixEncryptionManager(client)
    return await manager.getStatus()
  },

  /**
   * Get service instance for advanced usage
   */
  getInstance (): MatrixEncryptionManager | null {
    return _matrixEncryptionManagerInstance
  },

  /**
   * Check if client restart is in progress
   */
  isClientRestartInProgress (): boolean {
    return _matrixEncryptionManagerInstance?.isClientRestartInProgress() || false
  }
}

// Export for MatrixEncryptionStateManager compatibility
export const matrixEncryptionStateManager = {
  initialize (client: MatrixClient | null): void {
    const manager = getMatrixEncryptionManager()
    manager.initialize(client)
  },

  getCurrentState (): MatrixEncryptionStatus | null {
    return _matrixEncryptionManagerInstance?.getCurrentState() || null
  },

  async forceRefresh (): Promise<void> {
    if (_matrixEncryptionManagerInstance) {
      await _matrixEncryptionManagerInstance.forceRefresh()
    }
  },

  on (event: string, listener: (...args: unknown[]) => void): void {
    if (_matrixEncryptionManagerInstance) {
      _matrixEncryptionManagerInstance.on(event, listener)
    }
  },

  off (event: string, listener: (...args: unknown[]) => void): void {
    if (_matrixEncryptionManagerInstance) {
      _matrixEncryptionManagerInstance.off(event, listener)
    }
  }
}

// Export for matrixEncryptionState compatibility
export const matrixEncryptionState = {
  markEncryptionSkipped (): void {
    const manager = getMatrixEncryptionManager()
    manager.markEncryptionSkipped()
  },

  clearEncryptionSkipped (): void {
    const manager = getMatrixEncryptionManager()
    manager.clearEncryptionSkipped()
  },

  clearEncryptedRoomsCache (): void {
    const manager = getMatrixEncryptionManager()
    manager.clearEncryptedRoomsCache()
  },

  async getEncryptionState (client: MatrixClient | null, roomId?: string): Promise<MatrixEncryptionStatus> {
    const manager = getMatrixEncryptionManager()
    return await manager.getEncryptionState(client, roomId)
  },

  async canEncryptInRoom (client: MatrixClient | null, roomId: string): Promise<boolean> {
    const manager = getMatrixEncryptionManager()
    return await manager.canEncryptInRoom(client, roomId)
  },

  async recheckEncryptionAfterJoin (client: MatrixClient | null, roomId: string): Promise<MatrixEncryptionStatus> {
    const manager = getMatrixEncryptionManager()
    return await manager.recheckEncryptionAfterJoin(client, roomId)
  },

  async waitForChatReady (client: MatrixClient, timeout?: number): Promise<boolean> {
    const manager = getMatrixEncryptionManager()
    return await manager.waitForChatReady(client, timeout)
  },

  getRequiredUI (state: MatrixEncryptionState): 'none' | 'login' | 'banner' | 'encryption_setup' | 'key_recovery' {
    const manager = getMatrixEncryptionManager()
    return manager.getRequiredUI(state)
  },

  async recoverCrossSigningKeys (recoveryKey?: string): Promise<EncryptionResult> {
    const manager = getMatrixEncryptionManager()
    return await manager.recoverCrossSigningKeys(recoveryKey)
  }
}

// Export the unified class as default
export default MatrixEncryptionManager
