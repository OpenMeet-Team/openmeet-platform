/**
 * Matrix Secret Storage Service
 *
 * Simplified implementation for historical message decryption.
 * Works with OpenMeet's Matrix SDK setup.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { deriveRecoveryKeyFromPassphrase, decodeRecoveryKey, CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import type { SecretStorageKeyDescription } from 'matrix-js-sdk/lib/secret-storage'
import { logger } from '../utils/logger'

export interface SecretStorageKeyParams {
  passphrase?: string
  recoveryKey?: string
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
        logger.debug('No secret storage found for validation')
        return false
      }

      // Get the stored secret storage key info
      const defaultKeyId = await this.matrixClient.secretStorage.getDefaultKeyId()
      if (!defaultKeyId) {
        logger.debug('No default secret storage key found for validation')
        return false
      }

      const keyInfoEvent = await this.matrixClient.getAccountData(`m.secret_storage.key.${defaultKeyId}`)
      if (!keyInfoEvent) {
        logger.debug('Secret storage key info not found for validation')
        return false
      }

      const keyInfo = keyInfoEvent.getContent() as SecretStorageKeyDescription
      if (!keyInfo) {
        logger.debug('Secret storage key info content not found for validation')
        return false
      }

      let keyData: Uint8Array

      if (keyParams.passphrase) {
        // Check if this key supports passphrase derivation
        if (!keyInfo.passphrase?.salt || !keyInfo.passphrase?.iterations) {
          logger.debug('Key does not support passphrase derivation')
          return false
        }

        // Basic length check first
        if (keyParams.passphrase.length < 12) {
          return false
        }

        try {
          // Derive key using stored parameters
          keyData = await deriveRecoveryKeyFromPassphrase(
            keyParams.passphrase,
            keyInfo.passphrase.salt,
            keyInfo.passphrase.iterations
          )
        } catch (error) {
          logger.debug('Failed to derive key from passphrase:', error)
          return false
        }
      } else if (keyParams.recoveryKey) {
        // Basic recovery key format check
        const cleaned = keyParams.recoveryKey.replace(/\s/g, '')
        if (cleaned.length < 48) {
          return false
        }

        try {
          // Decode the recovery key
          keyData = await decodeRecoveryKey(keyParams.recoveryKey)
        } catch (error) {
          logger.debug('Failed to decode recovery key:', error)
          return false
        }
      } else {
        return false
      }

      // Validate the derived/decoded key against the stored key
      const isValidKey = await this.matrixClient.secretStorage.checkKey(keyData, keyInfo)
      logger.debug('Key validation result:', { isValid: isValidKey })

      return isValidKey
    } catch (error) {
      logger.debug('Key validation failed:', error)
      return false
    }
  }

  /**
   * Detect the type of input (passphrase vs recovery key)
   */
  public detectInputType (input: string): 'passphrase' | 'recoveryKey' | 'unknown' {
    // Recovery keys are base58 encoded and follow a specific format
    const recoveryKeyPattern = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz\s]+$/

    if (input.length >= 48 && recoveryKeyPattern.test(input.replace(/\s/g, ''))) {
      return 'recoveryKey'
    }

    if (input.length >= 12) {
      return 'passphrase'
    }

    return 'unknown'
  }

  /**
   * Set up new secret storage with a passphrase (for initial setup)
   * @param passphrase - The passphrase to derive the secret storage key
   * @param isReset - Whether this is a reset scenario (forgotten passphrase), which clears existing cross-signing
   */
  public async setupSecretStorage (passphrase: string, isReset: boolean = false): Promise<SecretStorageResult> {
    try {
      if (isReset) {
        logger.debug('🔄 Setting up secret storage after encryption reset (forgotten passphrase)...')
      } else {
        logger.debug('🔐 Setting up new secret storage with passphrase...')
      }

      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available'
        }
      }

      // Create recovery key from passphrase
      const recoveryKey = await crypto.createRecoveryKeyFromPassphrase(passphrase)

      // Extract key data and encoded recovery key
      let keyData: Uint8Array
      let encodedRecoveryKey: string | undefined

      if (recoveryKey instanceof Uint8Array) {
        keyData = recoveryKey
      } else if (recoveryKey && typeof recoveryKey === 'object' && 'key' in recoveryKey) {
        keyData = (recoveryKey as { key: Uint8Array }).key
        // Extract the base58-encoded recovery key for user to save
        encodedRecoveryKey = (recoveryKey as { encodedPrivateKey?: string }).encodedPrivateKey
      } else if (recoveryKey && typeof recoveryKey === 'object' && 'privateKey' in recoveryKey) {
        keyData = (recoveryKey as { privateKey: Uint8Array }).privateKey
        encodedRecoveryKey = (recoveryKey as { encodedPrivateKey?: string }).encodedPrivateKey
      } else {
        throw new Error('Unable to extract recovery key from passphrase')
      }

      if (!(keyData instanceof Uint8Array) || keyData.length === 0) {
        throw new Error('Invalid key data from passphrase')
      }

      // Store the key for global callback access during setup
      MatrixSecretStorageService.currentSetupKey = keyData

      // If this is a reset scenario, check for and clear existing crypto state
      if (isReset) {
        logger.debug('🔄 Checking for existing crypto state due to forgotten passphrase...')
        try {
          const existingSecrets = await crypto.isSecretStorageReady()
          logger.debug('🔍 Secret storage readiness check:', { isReady: existingSecrets })

          const crossSigningStatus = await crypto.isCrossSigningReady()
          logger.debug('🔍 Cross-signing readiness check:', { isReady: crossSigningStatus })

          // If secrets exist but we have a different key, we need to reset
          if (existingSecrets || crossSigningStatus) {
            logger.warn('⚠️ Existing crypto secrets detected - will cause MAC errors with new passphrase')
            logger.debug('🔄 Resetting crypto for fresh bootstrap...')
            await crypto.resetKeyBackup()
            logger.debug('✅ Key backup reset completed')
          }
        } catch (error) {
          logger.debug('🔍 Could not check existing secrets (this is normal for fresh setups):', error)
        }
      }

      // Bootstrap secret storage with the new key (following Element Web pattern)
      logger.debug('🔐 Bootstrapping secret storage...')
      await crypto.bootstrapSecretStorage({
        setupNewSecretStorage: true, // Critical: This creates the default key ID
        createSecretStorageKey: async () => {
          return {
            privateKey: keyData,
            encodedPrivateKey: Array.from(keyData).map(b => b.toString(16).padStart(2, '0')).join('')
          }
        }
      })

      // Bootstrap cross-signing
      logger.debug('🔐 Bootstrapping cross-signing...')
      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
          await makeRequest(null)
        }
      })

      // Set up key backup
      logger.debug('🔐 Setting up key backup...')
      await this.setupKeyBackup()

      logger.debug('✅ Secret storage setup completed successfully')
      return {
        success: true,
        keyId: 'passphrase-derived',
        recoveryKey: encodedRecoveryKey
      }
    } catch (error) {
      logger.error('❌ Failed to set up secret storage:', error)
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
      logger.debug('🔓 Attempting to unlock secret storage...')

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

      logger.debug('🔍 Found stored secret storage key:', { keyId: defaultKeyId, algorithm: keyInfo.algorithm })

      const inputType = this.detectInputType(input.trim())
      let keyData: Uint8Array

      if (inputType === 'passphrase') {
        // Check if this key supports passphrase derivation
        if (!keyInfo.passphrase?.salt || !keyInfo.passphrase?.iterations) {
          return {
            success: false,
            error: 'This secret storage key was not set up with a passphrase. Please use your recovery key instead.'
          }
        }

        logger.debug('🔑 Deriving key from passphrase using stored parameters:', {
          salt: keyInfo.passphrase.salt?.substring(0, 10) + '...',
          iterations: keyInfo.passphrase.iterations
        })

        // Use the stored salt and iterations to derive the same key
        keyData = await deriveRecoveryKeyFromPassphrase(
          input.trim(),
          keyInfo.passphrase.salt,
          keyInfo.passphrase.iterations
        )
      } else if (inputType === 'recoveryKey') {
        logger.debug('🔑 Decoding recovery key...')
        try {
          // Decode the recovery key directly
          keyData = await decodeRecoveryKey(input.trim())
        } catch (error) {
          return {
            success: false,
            error: 'Invalid recovery key format'
          }
        }
      } else {
        return {
          success: false,
          error: 'Input must be a passphrase (12+ characters) or recovery key'
        }
      }

      // Validate the derived/decoded key against the stored key
      logger.debug('🔍 Validating key against stored MAC...')
      const isValidKey = await this.matrixClient.secretStorage.checkKey(keyData, keyInfo)

      if (!isValidKey) {
        logger.error('❌ Key validation failed - MAC mismatch')
        return {
          success: false,
          error: inputType === 'passphrase'
            ? 'Incorrect passphrase. Please check your passphrase and try again.'
            : 'Incorrect recovery key. Please check your recovery key and try again.'
        }
      }

      logger.debug('✅ Key validated successfully!')

      // Store the key for global callback access during unlock
      MatrixSecretStorageService.currentSetupKey = keyData
      logger.debug('🔑 Stored validated key for global callback access')

      try {
        // Set up event-driven restoration
        const restorePromise = this.setupEventDrivenRestore()

        // Element Web pattern: Load backup private key and restore session keys
        // This is the critical step for historical message decryption
        // Note: This only restores keys that were previously backed up.
        // Missing keys may need to be requested from other devices or will be backed up over time.
        try {
          logger.debug('🔑 Loading backup private key from secret storage (Element Web pattern)...')
          await crypto.loadSessionBackupPrivateKeyFromSecretStorage()

          logger.debug('📥 Restoring session keys from backup (Element Web pattern)...')
          const restoreResult = await crypto.restoreKeyBackup({
            progressCallback: (progress) => {
              // Handle different progress types based on the Matrix SDK structure
              if ('total' in progress && 'imported' in progress) {
                const progressWithCounts = progress as { total: number; imported: number }
                const percent = Math.round((progressWithCounts.imported / progressWithCounts.total) * 100)
                logger.debug(`📥 Key backup restore progress: ${progressWithCounts.imported}/${progressWithCounts.total} (${percent}%)`)
              } else if ('stage' in progress) {
                logger.debug(`📥 Key backup restore stage: ${progress.stage}`)
              } else {
                logger.debug('📥 Key backup restore progress:', progress)
              }
            }
          })

          logger.debug('✅ Key backup restored from secret storage:', {
            total: restoreResult.total,
            imported: restoreResult.imported
          })

          // Enable automatic key backup for new keys (Element Web pattern)
          logger.debug('🔐 Enabling automatic key backup for new keys...')
          const backupCheck = await crypto.checkKeyBackupAndEnable()
          if (backupCheck) {
            logger.debug('✅ Automatic key backup enabled:', backupCheck)
          } else {
            logger.warn('⚠️ No key backup found to enable')
          }
        } catch (backupError) {
          logger.warn('⚠️ Key backup restore failed (unlock still successful):', backupError)
          // Don't fail the whole unlock if backup restore fails
        }

        // Try cross-signing setup (non-blocking if it fails)
        try {
          logger.debug('🔐 Bootstrapping cross-signing...')
          await crypto.bootstrapCrossSigning({
            authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
              await makeRequest(null)
            }
          })
          logger.debug('✅ Cross-signing setup completed')
        } catch (crossSigningError) {
          logger.warn('⚠️ Cross-signing setup failed (unlock still successful):', crossSigningError)
          // Don't fail unlock if cross-signing has issues
        }

        // Wait for the event-driven restore to complete (or timeout)
        logger.debug('🔍 Waiting for encryption events to settle...')
        await restorePromise

        logger.debug('✅ Secret storage unlocked successfully')

        return {
          success: true,
          keyId: defaultKeyId
        }
      } catch (setupError) {
        logger.error('❌ Failed during post-unlock setup:', setupError)
        // Even if setup fails, the unlock was successful if we got here
        return {
          success: true,
          keyId: defaultKeyId,
          error: 'Unlocked but some features may not work properly: ' + setupError.message
        }
      }
    } catch (error) {
      logger.error('❌ Failed to unlock secret storage:', error)
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

      logger.debug('🔑 Creating new key backup...')

      // Check if secret storage is ready (required for backup)
      const isSecretStorageReady = await crypto.isSecretStorageReady()
      if (!isSecretStorageReady) {
        logger.warn('Secret storage not ready, cannot create key backup')
        return
      }

      // Enable key backup (this creates the backup on server)
      await crypto.resetKeyBackup()
      const backupInfo = await crypto.checkKeyBackupAndEnable()

      if (backupInfo) {
        logger.debug('✅ Key backup created successfully:', backupInfo)
      } else {
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

      logger.debug('🔍 Key backup found, attempting to restore...')

      // Try to restore the backup
      try {
        await crypto.restoreKeyBackup()
        logger.debug('✅ Key backup restored - historical messages should be decryptable')
      } catch (restoreError) {
        logger.warn('⚠️ Failed to restore key backup:', restoreError)
      }
    } catch (error) {
      logger.warn('⚠️ Failed to restore key backup (non-fatal):', error)
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
    logger.debug('🔐 Secret storage service initialized - using cached key approach')
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
        logger.debug('⚠️ Event-driven restore timed out after 10 seconds')
        cleanup()
        resolve() // Resolve rather than reject - timeout is not necessarily an error
      }, 10000)

      let keyBackupReady = false
      let crossSigningReady = false

      const checkComplete = () => {
        if (keyBackupReady && crossSigningReady) {
          logger.debug('✅ Event-driven restore completed - both key backup and cross-signing ready')
          cleanup()
          resolve()
        }
      }

      const onKeyBackupStatus = (enabled: boolean) => {
        logger.debug(`🔑 Key backup status changed: ${enabled}`)
        keyBackupReady = enabled
        checkComplete()
      }

      const onKeysChanged = () => {
        logger.debug('🔑 Cross-signing keys changed - checking readiness...')
        // Check if cross-signing is now ready
        this.matrixClient.getCrypto()?.isCrossSigningReady().then(ready => {
          logger.debug(`🔍 Cross-signing ready status: ${ready}`)
          crossSigningReady = ready
          checkComplete()
        })
      }

      const onKeyBackupDecryptionKeyCached = (version: string) => {
        logger.debug(`🔑 Key backup decryption key cached for version: ${version}`)
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
        logger.debug(`🔍 Initial status check: crossSigning=${crossSigning}, keyBackup=${keyBackup}`)
        crossSigningReady = crossSigning
        keyBackupReady = keyBackup
        checkComplete()
      }).catch(error => {
        logger.debug('Error checking initial status:', error)
        // Continue anyway - events will handle state changes
      })
    })
  }
}
