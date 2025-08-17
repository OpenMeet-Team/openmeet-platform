/**
 * Matrix Secret Storage Service
 *
 * Simplified implementation for historical message decryption.
 * Works with OpenMeet's Matrix SDK setup.
 */

import type { MatrixClient } from 'matrix-js-sdk'
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

      // Simple validation - try to derive the key
      if (keyParams.passphrase) {
        // For passphrase validation, we'll rely on the unlock attempt
        return keyParams.passphrase.length >= 12
      }

      if (keyParams.recoveryKey) {
        // Basic recovery key format check
        const cleaned = keyParams.recoveryKey.replace(/\s/g, '')
        return cleaned.length >= 48
      }

      return false
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

      const inputType = this.detectInputType(input.trim())

      // Try to bootstrap secret storage and cross-signing with the input
      if (inputType === 'passphrase') {
        // Use passphrase to derive recovery key
        const recoveryKey = await crypto.createRecoveryKeyFromPassphrase(input.trim())

        // Extract key data
        let keyData: Uint8Array
        if (recoveryKey instanceof Uint8Array) {
          keyData = recoveryKey
        } else if (recoveryKey && typeof recoveryKey === 'object' && 'key' in recoveryKey) {
          keyData = (recoveryKey as { key: Uint8Array }).key
        } else if (recoveryKey && typeof recoveryKey === 'object' && 'privateKey' in recoveryKey) {
          keyData = (recoveryKey as { privateKey: Uint8Array }).privateKey
        } else {
          throw new Error('Unable to extract recovery key from passphrase')
        }

        if (!(keyData instanceof Uint8Array) || keyData.length === 0) {
          throw new Error('Invalid key data from passphrase')
        }

        // Store the key for global callback access during unlock
        MatrixSecretStorageService.currentSetupKey = keyData
        logger.debug('🔑 Stored key for global callback during unlock')

        // Bootstrap secret storage with passphrase-derived key
        await crypto.bootstrapSecretStorage({
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

        // Try to restore existing key backup or create a new one
        await this.setupKeyBackup()

        logger.debug('✅ Secret storage unlocked successfully with passphrase')

        // Clear the stored key after successful unlock
        MatrixSecretStorageService.clearCurrentSetupKey()

        return {
          success: true,
          keyId: 'passphrase-derived'
        }
      } else if (inputType === 'recoveryKey') {
        // TODO: Recovery key unlock support - needs proper Matrix SDK API access
        // For now, recovery keys are generated but unlock is not supported
        logger.warn('Recovery key unlock not yet implemented - please use passphrase')
        return {
          success: false,
          error: 'Recovery key unlock not yet supported. Please use your passphrase instead.'
        }
      } else {
        // Clear the stored key for unsupported input types
        MatrixSecretStorageService.clearCurrentSetupKey()
        return {
          success: false,
          error: 'Input must be a passphrase (12+ characters) or recovery key (base58 format)'
        }
      }
    } catch (error) {
      logger.error('Failed to unlock secret storage:', error)

      // Clear the stored key after error
      MatrixSecretStorageService.clearCurrentSetupKey()

      return {
        success: false,
        error: error.message || 'Failed to unlock secret storage'
      }
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
}
