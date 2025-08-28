/**
 * Matrix Encryption Service
 *
 * Unified encryption service following Element Web's proven patterns.
 * Now uses Element Web's simple bootstrap approach instead of complex MAS handling.
 *
 * Key Changes:
 * - Replaced SimpleDeviceVerification with Element Web's createCrossSigning pattern
 * - Uses Element Web's accessSecretStorage pattern for key management
 * - Simplified MAS integration through standard UIA callbacks
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { encodeRecoveryKey, decodeRecoveryKey, CryptoEvent, type GeneratedSecretStorageKey } from 'matrix-js-sdk/lib/crypto-api'
import { ClientEvent } from 'matrix-js-sdk'
import { logger } from '../utils/logger'
import { checkMASAuthReturn } from './createCrossSigning'
import {
  setSecretStorageBeingAccessed,
  cacheSecretStorageKeyForBootstrap,
  clearSecretStorageCache
} from './MatrixClientManager'

export interface EncryptionResult {
  success: boolean
  error?: string
  recoveryKey?: string
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

/**
 * Unified Matrix encryption service following Element Web's architecture
 */
export class MatrixEncryptionService {
  private matrixClient: MatrixClient
  private operationInProgress = false

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
  }

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
   * Check current encryption status
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
          // Continue with setup after MAS approval
        }

        const crypto = this.matrixClient.getCrypto()
        if (!crypto) {
          return { success: false, error: 'Crypto not available' }
        }

        // Check if we need to unlock existing storage
        const hasExistingKey = await this.matrixClient.secretStorage.hasKey()
        if (hasExistingKey && recoveryKey) {
          logger.debug('🔓 Unlocking existing secret storage with recovery key')
          return await this.unlockExistingStorage(recoveryKey)
        }

        // Check if we need to reset existing keys first
        if (hasExistingKey && !recoveryKey) {
          logger.debug('🔄 User wants new keys but existing secret storage found - doing complete reset')
          // Use Matrix SDK's proper reset method to clear all encryption state
          await crypto.resetEncryption(async () => {
            logger.debug('🔄 Complete encryption reset callback executed')
          })
          logger.debug('✅ Complete encryption reset completed')
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
        this.matrixClient.off(ClientEvent.Sync, onSync)
        logger.debug('✅ Matrix sync completed - server should be ready')
        resolve()
      }

      logger.debug('⏳ Waiting for Matrix sync to complete...')
      this.matrixClient.on(ClientEvent.Sync, onSync)

      // Fallback timeout in case sync doesn't happen
      setTimeout(() => {
        this.matrixClient.off(ClientEvent.Sync, onSync)
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
    const crypto = this.matrixClient.getCrypto()!

    logger.debug('🔐 Setting up fresh encryption (Element Web InitialCryptoSetupStore pattern)')

    // Step 0: Ensure device keys are uploaded to the server FIRST
    // This is critical - cross-signing operations will fail if the device is unknown to the server
    const userId = this.matrixClient.getUserId()
    const deviceId = this.matrixClient.getDeviceId()
    logger.debug(`🔐 Verifying device registration for ${userId}/${deviceId}`)

    try {
      // Wait for initial Matrix sync to complete - Element Web pattern
      // Device keys are uploaded during initial sync, not before
      logger.debug('🔐 Waiting for initial Matrix sync to complete (Element Web pattern)')
      while (!this.matrixClient.isInitialSyncComplete()) {
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
        return uiAuthCallback(this.matrixClient, makeRequest)
      },
      setupNewCrossSigning: true // Force new keys since we just did a reset
    })

    logger.debug('✅ Cross-signing keys created successfully')

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
          const currentDeviceId = this.matrixClient.getDeviceId()
          const currentUserId = this.matrixClient.getUserId()

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

        // Matrix SDK automatically signs the device during bootstrapCrossSigning
        // Manual crossSignDevice() call is redundant and can trigger UIA loops
        logger.debug('✅ Device verification handled automatically by Matrix SDK during bootstrap')
      } catch (error) {
        logger.warn('⚠️ Could not check/set device verification after fresh setup:', error)
      }
    }

    logger.debug('✅ Fresh encryption setup completed successfully (Element Web pattern)')

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
      const crypto = this.matrixClient.getCrypto()!

      // Get the default key info
      const defaultKeyId = await this.matrixClient.secretStorage.getDefaultKeyId()
      if (!defaultKeyId) {
        throw new Error('No default secret storage key found')
      }

      const keyInfo = await this.matrixClient.secretStorage.getKey(defaultKeyId)
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

      // Check device verification status after unlocking - Element Web pattern
      logger.debug('🔐 Checking device verification status after unlocking storage')
      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      if (userId && deviceId) {
        try {
          // Check if device verification is needed after unlocking storage
          const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
          logger.debug('🔍 Device verification status after unlock:', {
            isVerified: deviceStatus?.isVerified(),
            crossSigningVerified: deviceStatus?.crossSigningVerified,
            signedByOwner: deviceStatus?.signedByOwner
          })

          // If device is not cross-signing verified after unlock, manually sign it
          // This is needed because SDK bootstrap doesn't always auto-sign the current device
          if (!deviceStatus?.crossSigningVerified) {
            logger.debug('🔐 Device not cross-signing verified after unlock - signing with cross-signing keys')
            try {
              await crypto.crossSignDevice(deviceId)
              logger.debug('✅ Device signed with cross-signing keys after recovery key unlock')

              // Verify the signing worked
              const updatedStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
              logger.debug('🔍 Final device verification status after manual signing:', {
                isVerified: updatedStatus?.isVerified(),
                crossSigningVerified: updatedStatus?.crossSigningVerified,
                signedByOwner: updatedStatus?.signedByOwner
              })
            } catch (signingError) {
              logger.warn('⚠️ Failed to sign device after recovery key unlock:', signingError)
            }
          } else {
            logger.debug('✅ Device already cross-signing verified after unlock')
          }
        } catch (error) {
          logger.warn('⚠️ Could not check device verification status after unlock:', error)
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
   * Get secret storage key info from account data
   */
  private async getSecretStorageKeyInfo (keyId: string): Promise<unknown> {
    try {
      const event = await this.matrixClient.getAccountData(`m.secret_storage.key.${keyId}`)
      return event?.getContent() || null
    } catch (error) {
      logger.debug('Could not get secret storage key info:', error)
      return null
    }
  }

  /**
   * Reset encryption completely - Element Web pattern
   */
  async resetEncryption (): Promise<EncryptionResult> {
    try {
      logger.debug('🔄 Resetting encryption completely')
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { success: false, error: 'Crypto not available' }
      }

      // Reset everything - Element Web's resetEncryption pattern
      await crypto.resetEncryption(async () => {
        logger.debug('🔄 Encryption reset callback executed')
      })

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
   * Wait for device verification to complete using Matrix events
   */
  private async waitForDeviceVerification (userId: string, deviceId: string, timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Device verification timeout'))
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeout)
        this.matrixClient.off(CryptoEvent.UserTrustStatusChanged, onTrustChanged)
        this.matrixClient.off(CryptoEvent.DevicesUpdated, onDevicesUpdated)
      }

      const checkStatus = async () => {
        try {
          const crypto = this.matrixClient.getCrypto()
          if (!crypto) return false

          const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
          logger.debug('🔍 Checking device verification status:', {
            isVerified: deviceStatus?.isVerified(),
            crossSigningVerified: deviceStatus?.crossSigningVerified,
            signedByOwner: deviceStatus?.signedByOwner
          })

          if (deviceStatus?.crossSigningVerified) {
            logger.debug('✅ Device verification completed via event')
            cleanup()
            resolve()
            return true
          }
          return false
        } catch (error) {
          logger.error('Error checking device verification status:', error)
          return false
        }
      }

      const onTrustChanged = async (changedUserId: string) => {
        if (changedUserId === userId) {
          logger.debug('🔍 User trust status changed, checking device verification')
          await checkStatus()
        }
      }

      const onDevicesUpdated = async (users: string[]) => {
        if (users.includes(userId)) {
          logger.debug('🔍 Devices updated, checking device verification')
          await checkStatus()
        }
      }

      // Set up event listeners
      this.matrixClient.on(CryptoEvent.UserTrustStatusChanged, onTrustChanged)
      this.matrixClient.on(CryptoEvent.DevicesUpdated, onDevicesUpdated)

      // Check status immediately in case it's already verified
      checkStatus().then(verified => {
        if (!verified) {
          logger.debug('🔍 Device not yet verified, waiting for Matrix events...')
        }
      })
    })
  }

  /**
   * Handle cross-signing key loss - stub for compatibility
   */
  async handleCrossSigningKeyLoss (): Promise<boolean> {
    logger.debug('🔧 Cross-signing key loss detected - using createCrossSigning approach')
    try {
      // Use our Element Web-style createCrossSigning approach
      const { createCrossSigning } = await import('./createCrossSigning')
      await createCrossSigning(this.matrixClient)
      return true
    } catch (error) {
      logger.error('❌ Failed to handle cross-signing key loss:', error)
      return false
    }
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
        cryptoReady: !!this.matrixClient.getCrypto()
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }
}

/**
 * Service instance - created lazily when matrix client is available
 */
let _matrixEncryptionServiceInstance: MatrixEncryptionService | null = null

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

    if (!_matrixEncryptionServiceInstance) {
      _matrixEncryptionServiceInstance = new MatrixEncryptionService(client)
    }

    // Background initialization - check status and log
    try {
      const status = await _matrixEncryptionServiceInstance.getStatus()
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

    if (!_matrixEncryptionServiceInstance) {
      _matrixEncryptionServiceInstance = new MatrixEncryptionService(client)
    }

    return await _matrixEncryptionServiceInstance.getStatus()
  },

  /**
   * Get service instance for advanced usage
   */
  getInstance (): MatrixEncryptionService | null {
    return _matrixEncryptionServiceInstance
  }
}
