/**
 * Matrix Secret Storage Service
 *
 * Simplified implementation for historical message decryption.
 * Works with OpenMeet's Matrix SDK setup.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { decodeRecoveryKey, CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import type { SecretStorageKeyDescription } from 'matrix-js-sdk/lib/secret-storage'
import { logger } from '../utils/logger'

export interface SecretStorageKeyParams {
  recoveryKey: string
}

export interface SecretStorageResult {
  success: boolean
  error?: string
  keyId?: string
  recoveryKey?: string // Base58-encoded recovery key for user to save
}

/**
 * Simplified secret storage access for OpenMeet
 */
export class MatrixSecretStorageService {
  private matrixClient: MatrixClient
  private secretStorageBeingAccessed = false

  // Static property to store key during setup for global callback access
  private static currentSetupKey: Uint8Array | null = null

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
    // Initialize the secret storage callback
    this.initializeSecretStorageCallback()
  }

  /**
   * Get the current setup key (for global callback use)
   */
  public static getCurrentSetupKey (): Uint8Array | null {
    return MatrixSecretStorageService.currentSetupKey
  }

  /**
   * Clear the current setup key
   */
  public static clearCurrentSetupKey (): void {
    MatrixSecretStorageService.currentSetupKey = null
  }

  /**
   * Check if secret storage access is in progress
   */
  public isSecretStorageBeingAccessed (): boolean {
    return this.secretStorageBeingAccessed
  }

  /**
   * Check if secret storage is set up and available
   */
  public async isSecretStorageAvailable (): Promise<boolean> {
    try {
      return await this.matrixClient.secretStorage.hasKey()
    } catch (error) {
      logger.error('Failed to check secret storage availability:', error)
      return false
    }
  }

  /**
   * Validate if the provided key params can unlock secret storage
   */
  public async validateSecretStorageKey (keyParams: SecretStorageKeyParams): Promise<boolean> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return false
      }

      // Check if secret storage exists
      const hasSecretStorage = await this.matrixClient.secretStorage.hasKey()
      if (!hasSecretStorage) {
        return false
      }

      // Get the stored secret storage key info
      const defaultKeyId = await this.matrixClient.secretStorage.getDefaultKeyId()
      if (!defaultKeyId) {
        return false
      }

      const keyInfoEvent = await this.matrixClient.getAccountData(`m.secret_storage.key.${defaultKeyId}`)
      if (!keyInfoEvent) {
        return false
      }

      const keyInfo = keyInfoEvent.getContent() as SecretStorageKeyDescription
      if (!keyInfo) {
        return false
      }

      // Basic recovery key format check
      const cleaned = keyParams.recoveryKey.replace(/\s/g, '')
      if (cleaned.length < 48) {
        return false
      }

      let keyData: Uint8Array
      try {
        // Decode the recovery key
        keyData = await decodeRecoveryKey(keyParams.recoveryKey)
      } catch (error) {
        return false
      }

      // Validate the derived/decoded key against the stored key
      const isValidKey = await this.matrixClient.secretStorage.checkKey(keyData, keyInfo)
      return isValidKey
    } catch (error) {
      return false
    }
  }

  /**
   * Validate recovery key format
   */
  public isValidRecoveryKeyFormat (input: string): boolean {
    // Recovery keys are base58 encoded and follow a specific format
    const recoveryKeyPattern = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz\s]+$/
    const cleaned = input.replace(/\s/g, '')
    return cleaned.length >= 48 && recoveryKeyPattern.test(cleaned)
  }

  /**
   * Set up new secret storage with a generated recovery key (for initial setup)
   * @param isReset - Whether this is a reset scenario (forgotten recovery key), which clears existing cross-signing
   */
  public async setupSecretStorage (isReset: boolean = false): Promise<SecretStorageResult> {
    try {
      logger.debug(`Setting up secret storage${isReset ? ' after reset' : ''}`)

      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available'
        }
      }

      // Generate a new random recovery key (32 bytes)
      const keyData = new Uint8Array(32)
      globalThis.crypto.getRandomValues(keyData)

      // Generate the base58-encoded recovery key for user to save
      const { encodeRecoveryKey } = await import('matrix-js-sdk/lib/crypto-api')
      const encodedRecoveryKey = encodeRecoveryKey(keyData)

      if (!encodedRecoveryKey) {
        throw new Error('Failed to encode recovery key')
      }

      // Store the key for global callback access during setup
      MatrixSecretStorageService.currentSetupKey = keyData

      // If this is a reset scenario, check for and clear existing crypto state
      if (isReset) {
        try {
          const existingSecrets = await crypto.isSecretStorageReady()
          const crossSigningStatus = await crypto.isCrossSigningReady()

          // If secrets exist but we have a different key, we need to reset
          if (existingSecrets || crossSigningStatus) {
            logger.warn('Resetting existing crypto state for new passphrase')
            await crypto.resetKeyBackup()
          }
        } catch (error) {
          // Expected for fresh setups
        }
      }

      // Bootstrap secret storage with the new key
      await crypto.bootstrapSecretStorage({
        setupNewSecretStorage: true,
        createSecretStorageKey: async () => {
          return {
            privateKey: keyData,
            encodedPrivateKey: Array.from(keyData).map(b => b.toString(16).padStart(2, '0')).join('')
          }
        }
      })

      // Bootstrap cross-signing
      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
          await makeRequest(null)
        }
      })

      // Set up key backup
      await this.setupKeyBackup()

      // Auto-verify this device since user just completed encryption setup with generated recovery key
      try {
        const userId = this.matrixClient.getUserId()
        const deviceId = this.matrixClient.getDeviceId()

        if (userId && deviceId) {
          logger.debug('🔐 Auto-verifying device after initial encryption setup')
          await crypto.setDeviceVerified(userId, deviceId, true)
          logger.debug('✅ Device automatically verified after encryption setup')
        }
      } catch (verificationError) {
        logger.warn('Device auto-verification failed (setup still successful):', verificationError)
      }

      logger.debug('Secret storage setup completed successfully')
      return {
        success: true,
        keyId: 'passphrase-derived',
        recoveryKey: encodedRecoveryKey
      }
    } catch (error) {
      logger.error('Failed to set up secret storage:', error)
      return {
        success: false,
        error: error.message || 'Failed to set up secret storage'
      }
    } finally {
      // Always clear the stored key after setup attempt
      MatrixSecretStorageService.clearCurrentSetupKey()
    }
  }

  /**
   * Try to unlock secret storage with either passphrase or recovery key
   */
  public async unlockSecretStorage (input: string): Promise<SecretStorageResult> {
    try {
      logger.debug('Unlocking secret storage...')

      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available'
        }
      }

      // Check if secret storage exists
      const hasSecretStorage = await this.matrixClient.secretStorage.hasKey()
      if (!hasSecretStorage) {
        return {
          success: false,
          error: 'No secret storage found. Please set up encryption first.'
        }
      }

      // Get the stored secret storage key info
      const defaultKeyId = await this.matrixClient.secretStorage.getDefaultKeyId()
      if (!defaultKeyId) {
        return {
          success: false,
          error: 'No default secret storage key found'
        }
      }

      const keyInfoEvent = await this.matrixClient.getAccountData(`m.secret_storage.key.${defaultKeyId}`)
      if (!keyInfoEvent) {
        return {
          success: false,
          error: 'Secret storage key info not found'
        }
      }

      const keyInfo = keyInfoEvent.getContent() as SecretStorageKeyDescription
      if (!keyInfo) {
        return {
          success: false,
          error: 'Secret storage key info content not found'
        }
      }

      logger.debug('Found stored secret storage key')

      // Validate recovery key format
      if (!this.isValidRecoveryKeyFormat(input.trim())) {
        return {
          success: false,
          error: 'Invalid recovery key format. Please check your recovery key and try again.'
        }
      }

      logger.debug('Decoding recovery key...')
      let keyData: Uint8Array
      try {
        // Decode the recovery key directly
        keyData = await decodeRecoveryKey(input.trim())
      } catch (error) {
        return {
          success: false,
          error: 'Invalid recovery key format'
        }
      }

      // Validate the derived/decoded key against the stored key
      const isValidKey = await this.matrixClient.secretStorage.checkKey(keyData, keyInfo)

      if (!isValidKey) {
        logger.error('Key validation failed')
        return {
          success: false,
          error: 'Incorrect recovery key. Please check your recovery key and try again.'
        }
      }

      logger.debug('Key validated successfully')

      // Store the key for global callback access during unlock
      MatrixSecretStorageService.currentSetupKey = keyData

      try {
        // Set up event-driven restoration
        const restorePromise = this.setupEventDrivenRestore()

        // Element Web pattern: Load backup private key and restore session keys
        // This is the critical step for historical message decryption
        try {
          await crypto.loadSessionBackupPrivateKeyFromSecretStorage()

          const restoreResult = await crypto.restoreKeyBackup({
            progressCallback: (progress) => {
              // Handle different progress types based on the Matrix SDK structure
              if ('total' in progress && 'imported' in progress) {
                const progressWithCounts = progress as { total: number; imported: number }
                const percent = Math.round((progressWithCounts.imported / progressWithCounts.total) * 100)
                if (percent % 20 === 0) { // Log every 20% to reduce noise
                  logger.debug(`Key restore progress: ${percent}%`)
                }
              }
            }
          })

          logger.debug(`Key backup restored: ${restoreResult.imported}/${restoreResult.total} keys`)

          // Enable automatic key backup for new keys
          const backupCheck = await crypto.checkKeyBackupAndEnable()
          if (!backupCheck) {
            logger.warn('No key backup found to enable')
          }
        } catch (backupError) {
          logger.warn('Key backup restore failed (unlock still successful):', backupError)
        }

        // Try cross-signing setup (non-blocking if it fails)
        try {
          await crypto.bootstrapCrossSigning({
            authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
              await makeRequest(null)
            }
          })
        } catch (crossSigningError) {
          logger.warn('Cross-signing setup failed (unlock still successful):', crossSigningError)
        }

        // Recovery-key-based device verification: If user successfully unlocked with recovery key,
        // automatically verify this device since they've proven they have the recovery credentials
        try {
          const userId = this.matrixClient.getUserId()
          const deviceId = this.matrixClient.getDeviceId()

          if (userId && deviceId) {
            logger.debug('🔐 Auto-verifying device after successful recovery key unlock')
            await crypto.setDeviceVerified(userId, deviceId, true)
            logger.debug('✅ Device automatically verified via recovery key authentication')
          }
        } catch (verificationError) {
          logger.warn('Device auto-verification failed (unlock still successful):', verificationError)
        }

        // Wait for the event-driven restore to complete (or timeout)
        await restorePromise

        logger.debug('Secret storage unlocked successfully')

        return {
          success: true,
          keyId: defaultKeyId
        }
      } catch (setupError) {
        logger.error('Failed during post-unlock setup:', setupError)
        // Even if setup fails, the unlock was successful if we got here
        return {
          success: true,
          keyId: defaultKeyId,
          error: 'Unlocked but some features may not work properly: ' + setupError.message
        }
      }
    } catch (error) {
      logger.error('Failed to unlock secret storage:', error)
      return {
        success: false,
        error: error.message || 'Failed to unlock secret storage'
      }
    } finally {
      // Always clear the stored key after unlock attempt
      MatrixSecretStorageService.clearCurrentSetupKey()
    }
  }

  /**
   * Clear cached keys
   */
  public clearSecretStorageCache (): void {
    logger.debug('Clearing secret storage key cache')
    // No cache to clear in simplified implementation
  }

  /**
   * Restore key backup if available
   */
  /**
   * Set up key backup - restore existing or create new
   */
  private async setupKeyBackup (): Promise<void> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.warn('Crypto not available for key backup setup')
        return
      }

      const keyBackupInfo = await crypto.getKeyBackupInfo()

      if (keyBackupInfo) {
        logger.debug('Key backup exists, attempting to restore...')
        await this.restoreKeyBackupIfAvailable()
      } else {
        logger.debug('No key backup found, creating new backup...')
        await this.createKeyBackup()
      }
    } catch (error) {
      logger.error('Failed to setup key backup:', error)
    }
  }

  /**
   * Create a new key backup on the server
   */
  private async createKeyBackup (): Promise<void> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.warn('Crypto not available for key backup creation')
        return
      }

      logger.debug('Creating new key backup...')

      // Check if secret storage is ready (required for backup)
      const isSecretStorageReady = await crypto.isSecretStorageReady()
      if (!isSecretStorageReady) {
        logger.warn('Secret storage not ready, cannot create key backup')
        return
      }

      // Enable key backup (this creates the backup on server)
      await crypto.resetKeyBackup()
      const backupInfo = await crypto.checkKeyBackupAndEnable()

      if (!backupInfo) {
        logger.warn('Key backup creation completed but no backup info returned')
      }
    } catch (error) {
      logger.error('Failed to create key backup:', error)
    }
  }

  private async restoreKeyBackupIfAvailable (): Promise<void> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.warn('Crypto not available for key backup restore')
        return
      }

      const keyBackupInfo = await crypto.getKeyBackupInfo()
      if (!keyBackupInfo) {
        logger.debug('No key backup found on server')
        return
      }

      logger.debug('Key backup found, attempting to restore...')

      // Try to restore the backup
      try {
        await crypto.restoreKeyBackup()
        logger.debug('Key backup restored')
      } catch (restoreError) {
        logger.warn('Failed to restore key backup:', restoreError)
      }
    } catch (error) {
      logger.warn('Failed to restore key backup (non-fatal):', error)
    }
  }

  /**
   * Execute an operation with secret storage access
   */
  public async withSecretStorageAccess<T> (func: () => Promise<T>): Promise<T> {
    logger.debug('Enabling secret storage access')
    this.secretStorageBeingAccessed = true

    try {
      return await func()
    } finally {
      logger.debug('Disabling secret storage access')
      this.secretStorageBeingAccessed = false
    }
  }

  /**
   * Bootstrap secret storage access for historical messages
   */
  public async accessSecretStorage (): Promise<SecretStorageResult> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'End-to-end encryption is disabled'
        }
      }

      const hasKey = await this.matrixClient.secretStorage.hasKey()
      if (!hasKey) {
        return {
          success: false,
          error: 'Secret storage has not been set up yet'
        }
      }

      // Bootstrap cross-signing if needed
      logger.debug('Bootstrapping cross-signing...')
      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest) => {
          // Auto-approve for background access
          await makeRequest(null)
        }
      })

      // Bootstrap secret storage
      logger.debug('Bootstrapping secret storage...')
      await crypto.bootstrapSecretStorage({
        createSecretStorageKey: async () => {
          // Generate a new random key for secret storage
          const randomKey = new Uint8Array(32)
          globalThis.crypto.getRandomValues(randomKey)
          return {
            privateKey: randomKey,
            encodedPrivateKey: Array.from(randomKey).map(b => b.toString(16).padStart(2, '0')).join('')
          }
        }
      })

      return {
        success: true
      }
    } catch (error) {
      logger.error('Failed to access secret storage:', error)
      return {
        success: false,
        error: error.message || 'Failed to access secret storage'
      }
    }
  }

  /**
   * Initialize secret storage callback for the Matrix client
   * This enables automatic key provision during crypto operations
   */
  public initializeSecretStorageCallback (): void {
    // The static currentSetupKey is used by the crypto operations
    // when they need access to the secret storage key
    // Note: The Matrix client manages secret storage callbacks internally
  }

  /**
   * Set up event-driven restoration that waits for encryption events
   * Returns a promise that resolves when key backup is ready or times out
   */
  private setupEventDrivenRestore (): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup()
        resolve() // Resolve rather than reject - timeout is not necessarily an error
      }, 10000)

      let keyBackupReady = false
      let crossSigningReady = false

      const checkComplete = () => {
        if (keyBackupReady && crossSigningReady) {
          cleanup()
          resolve()
        }
      }

      const onKeyBackupStatus = (enabled: boolean) => {
        keyBackupReady = enabled
        checkComplete()
      }

      const onKeysChanged = () => {
        // Check if cross-signing is now ready
        this.matrixClient.getCrypto()?.isCrossSigningReady().then(ready => {
          crossSigningReady = ready
          checkComplete()
        })
      }

      const onKeyBackupDecryptionKeyCached = () => {
        keyBackupReady = true
        checkComplete()
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this.matrixClient.off(CryptoEvent.KeyBackupStatus, onKeyBackupStatus)
        this.matrixClient.off(CryptoEvent.KeysChanged, onKeysChanged)
        this.matrixClient.off(CryptoEvent.KeyBackupDecryptionKeyCached, onKeyBackupDecryptionKeyCached)
      }

      // Set up event listeners
      this.matrixClient.on(CryptoEvent.KeyBackupStatus, onKeyBackupStatus)
      this.matrixClient.on(CryptoEvent.KeysChanged, onKeysChanged)
      this.matrixClient.on(CryptoEvent.KeyBackupDecryptionKeyCached, onKeyBackupDecryptionKeyCached)

      // Check current status immediately in case we're already ready
      Promise.all([
        this.matrixClient.getCrypto()?.isCrossSigningReady() || Promise.resolve(false),
        this.matrixClient.getCrypto()?.getKeyBackupInfo().then(info => !!info) || Promise.resolve(false)
      ]).then(([crossSigning, keyBackup]) => {
        crossSigningReady = crossSigning
        keyBackupReady = keyBackup
        checkComplete()
      }).catch(() => {
        // Continue anyway - events will handle state changes
      })
    })
  }

  /**
   * Get the default secret storage key ID if available
   * This is a simple check to see if secret storage is accessible
   */
  public async getDefaultKeyId (): Promise<string | null> {
    try {
      return await this.matrixClient.secretStorage.getDefaultKeyId()
    } catch (error) {
      logger.debug('Could not get default secret storage key ID:', error)
      return null
    }
  }
}
