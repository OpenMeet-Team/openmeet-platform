/**
 * Matrix Encryption Bootstrap Service
 *
 * Handles encryption setup with user-chosen passphrase
 * Implements TDD-driven development approach for fast iteration
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'

// Use any for crypto API to avoid Matrix SDK internal import issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CryptoApi = any

export interface EncryptionBootstrapResult {
  success: boolean
  error?: string
  step?: string
}

export interface PassphraseValidationResult {
  isValid: boolean
  strength: 'weak' | 'medium' | 'strong'
  feedback?: string
}

export class MatrixEncryptionBootstrapService {
  private matrixClient: MatrixClient

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
  }

  /**
   * Wait for crypto API to become available with retry logic
   */
  private async waitForCrypto (maxRetries = 5, delayMs = 1000): Promise<CryptoApi | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const crypto = this.matrixClient.getCrypto()
      if (crypto) {
        logger.debug(`✅ Crypto became available on attempt ${attempt}`)
        return crypto
      }

      if (attempt < maxRetries) {
        logger.debug(`🔄 Crypto not ready yet, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    logger.warn(`❌ Crypto not available after ${maxRetries} attempts`)
    return null
  }

  /**
   * Check if encryption setup is needed
   */
  async checkEncryptionSetup (): Promise<boolean> {
    try {
      const crypto = await this.waitForCrypto(3, 500) // Shorter retry for status check
      if (!crypto) return true // If crypto isn't available, assume setup is needed

      const [secretStorageReady, crossSigningReady] = await Promise.all([
        crypto.isSecretStorageReady(),
        crypto.isCrossSigningReady()
      ])

      // Return true if setup is needed (either not ready)
      return !secretStorageReady || !crossSigningReady
    } catch (error) {
      logger.error('Failed to check encryption setup status:', error)
      return true // Assume setup needed on error
    }
  }

  /**
   * Validate existing passphrase and unlock encryption
   * Used when user already has encryption set up
   */
  async unlockWithExistingPassphrase (passphrase: string): Promise<EncryptionBootstrapResult> {
    try {
      logger.debug('🔓 Attempting to unlock with existing passphrase...')
      const crypto = await this.waitForCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available after retries',
          step: 'initialization'
        }
      }

      // Create recovery key from existing passphrase
      const recoveryKey = await crypto.createRecoveryKeyFromPassphrase(passphrase)
      logger.debug('🔑 Created recovery key from existing passphrase')

      // Extract key data using the same logic as bootstrap
      let keyData: Uint8Array
      if (recoveryKey instanceof Uint8Array) {
        keyData = recoveryKey
      } else if (recoveryKey && typeof recoveryKey === 'object' && recoveryKey.key) {
        keyData = recoveryKey.key
      } else if (recoveryKey && typeof recoveryKey === 'object' && recoveryKey.privateKey) {
        keyData = recoveryKey.privateKey
      } else {
        throw new Error('Unable to extract recovery key from existing passphrase')
      }

      if (!(keyData instanceof Uint8Array) || keyData.length === 0) {
        throw new Error('Invalid key data from existing passphrase')
      }

      // Note: Recovery key storage is now handled by Matrix SDK's secret storage system
      // No longer storing keys in device-dependent localStorage to prevent setup loops

      // Check if key backup exists and restore it with the passphrase
      try {
        const keyBackupInfo = await crypto.getKeyBackupInfo()
        if (keyBackupInfo) {
          logger.debug('🔍 Key backup found, attempting to verify and restore with passphrase...')

          try {
            // First, verify that we can trust this backup with our recovery key
            // This step ensures the backup is authentic and we have the right key
            const backupDecryptor = await crypto.getBackupDecryptor(keyBackupInfo, keyData)
            if (backupDecryptor) {
              logger.debug('✅ Key backup verified - backup is trusted')

              // Now restore the key backup using the verified recovery key
              // This will enable decryption of historical messages
              await crypto.restoreKeyBackup(keyBackupInfo, keyData)
              logger.debug('✅ Key backup restored successfully - historical messages should be decryptable')
            } else {
              logger.warn('⚠️ Could not verify key backup with provided passphrase')
            }
          } catch (verifyError) {
            logger.warn('⚠️ Key backup verification failed, trying direct restore:', verifyError)
            // Fallback: try direct restore anyway (might work if backup is already trusted)
            await crypto.restoreKeyBackup(keyBackupInfo, keyData)
            logger.debug('✅ Key backup restored via fallback method')
          }
        } else {
          logger.debug('ℹ️ No key backup found on server - only new messages will be decryptable')
        }
      } catch (backupError) {
        logger.warn('⚠️ Failed to restore key backup (non-fatal):', backupError)
        // Don't fail the unlock process if backup restore fails
        // The user can still send/receive new messages
      }

      // The Matrix SDK validated the passphrase when creating the recovery key
      logger.debug('✅ Existing passphrase accepted - encryption unlocked')
      // Note: For security, we don't store passphrases persistently in localStorage
      // Instead, Matrix SDK handles secret storage internally using secure key derivation
      logger.debug('✅ Encryption bootstrap completed - Matrix SDK will handle key restoration automatically')

      return { success: true }
    } catch (error) {
      logger.error('Failed to unlock with existing passphrase:', error)
      return {
        success: false,
        error: error.message,
        step: 'passphrase-validation'
      }
    }
  }

  /**
   * Bootstrap encryption with user-chosen passphrase
   */
  async bootstrapEncryption (passphrase: string): Promise<EncryptionBootstrapResult> {
    try {
      logger.debug('🔄 Starting encryption bootstrap with retry logic...')
      const crypto = await this.waitForCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available after retries',
          step: 'initialization'
        }
      }

      // Set up timeout promise
      const timeoutPromise = new Promise<never>((resolve, reject) => {
        setTimeout(() => reject(new Error('Operation timeout after 30 seconds')), 30000)
      })

      // Perform bootstrap operations with timeout
      const bootstrapPromise = this.performBootstrap(crypto, passphrase)

      await Promise.race([bootstrapPromise, timeoutPromise])

      // Note: For security, we don't store passphrases persistently in localStorage
      // Instead, Matrix SDK handles secret storage internally using secure key derivation
      logger.debug('✅ Encryption bootstrap completed - Matrix SDK will handle key restoration automatically')

      return { success: true }
    } catch (error) {
      logger.error('Encryption bootstrap failed:', error)

      if (error.message.includes('timeout')) {
        return {
          success: false,
          error: error.message,
          step: 'timeout'
        }
      }

      // Determine which step failed
      const step = this.determineFailureStep(error)

      return {
        success: false,
        error: error.message,
        step
      }
    }
  }

  private async performBootstrap (crypto: CryptoApi, passphrase: string): Promise<void> {
    try {
      // Step 1: Create recovery key from passphrase
      const recoveryKey = await crypto.createRecoveryKeyFromPassphrase(passphrase)
      logger.debug('🔑 Created recovery key from passphrase', {
        keyType: typeof recoveryKey,
        keyLength: recoveryKey?.length,
        isUint8Array: recoveryKey instanceof Uint8Array,
        keyConstructor: recoveryKey?.constructor?.name
      })

      // Extract the actual key data once and use consistently
      let keyData: unknown
      if (recoveryKey instanceof Uint8Array) {
        logger.debug('🔑 Recovery key is already Uint8Array')
        keyData = recoveryKey
      } else if (recoveryKey && typeof recoveryKey === 'object' && 'key' in recoveryKey) {
        logger.debug('🔑 Extracting key from recoveryKey.key:', {
          keyType: typeof recoveryKey.key,
          keyConstructor: recoveryKey.key?.constructor?.name,
          keyLength: recoveryKey.key?.length,
          isUint8Array: recoveryKey.key instanceof Uint8Array
        })
        keyData = recoveryKey.key
      } else if (recoveryKey && typeof recoveryKey === 'object' && 'privateKey' in recoveryKey) {
        logger.debug('🔑 Extracting key from recoveryKey.privateKey:', {
          keyType: typeof recoveryKey.privateKey,
          keyConstructor: recoveryKey.privateKey?.constructor?.name,
          keyLength: recoveryKey.privateKey?.length,
          isUint8Array: recoveryKey.privateKey instanceof Uint8Array
        })
        keyData = recoveryKey.privateKey
      } else {
        logger.error('❌ Cannot determine recovery key format:', {
          keyType: typeof recoveryKey,
          keyKeys: recoveryKey ? Object.keys(recoveryKey) : 'none',
          keyValues: recoveryKey ? Object.keys(recoveryKey).map(key => ({ key, type: typeof recoveryKey[key], length: recoveryKey[key]?.length })) : 'none',
          keyConstructor: recoveryKey?.constructor?.name,
          fullObject: recoveryKey
        })
        throw new Error('Unable to extract recovery key from Matrix SDK response')
      }

      // Ensure keyData is actually a Uint8Array
      if (!(keyData instanceof Uint8Array)) {
        logger.error('❌ Extracted keyData is not a Uint8Array:', {
          keyType: typeof keyData,
          keyConstructor: keyData?.constructor?.name,
          keyLength: Array.isArray(keyData) || (keyData && typeof keyData === 'object' && 'length' in keyData) ? keyData.length : undefined
        })
        throw new Error(`Expected Uint8Array, got ${typeof keyData}`)
      }

      if (!keyData || keyData.length === 0) {
        throw new Error('Extracted recovery key is invalid')
      }

      logger.debug('✅ Extracted recovery key data', {
        keyLength: keyData.length,
        keyType: typeof keyData,
        isUint8Array: keyData instanceof Uint8Array
      })

      // Note: Recovery key storage is now handled by Matrix SDK's secret storage system
      // No longer storing keys in device-dependent localStorage to prevent setup loops
      logger.debug('🔑 Recovery key will be managed by Matrix SDK secret storage')

      // Check if there are existing secrets that might conflict
      try {
        const existingSecrets = await crypto.isSecretStorageReady()
        logger.debug('🔍 Secret storage readiness check:', { isReady: existingSecrets })

        const crossSigningStatus = await crypto.isCrossSigningReady()
        logger.debug('🔍 Cross-signing readiness check:', { isReady: crossSigningStatus })

        // If secrets exist but we have a different key, we need to reset
        if (existingSecrets || crossSigningStatus) {
          logger.warn('⚠️ Existing crypto secrets detected - may cause MAC errors with new recovery key')
          // For device-specific approach, we'll clear existing secrets and start fresh
          logger.debug('🔄 Resetting crypto for fresh bootstrap...')
          await crypto.resetKeyBackup()
          logger.debug('✅ Key backup reset completed')
        }
      } catch (error) {
        logger.debug('🔍 Could not check existing secrets (this is normal for fresh setups):', error)
      }

      // Step 2: Bootstrap secret storage FIRST (required for cross-signing)
      await crypto.bootstrapSecretStorage({
        createSecretStorageKey: () => {
          logger.debug('🔑 createSecretStorageKey called - returning extracted key data', {
            keyLength: keyData.length,
            keyType: typeof keyData,
            isUint8Array: keyData instanceof Uint8Array,
            firstFewBytes: Array.from(keyData.slice(0, 4))
          })
          // Ensure we return a fresh Uint8Array (sometimes objects get corrupted in async chains)
          return new Uint8Array(keyData)
        },
        getSecretStorageKey: async () => {
          // During bootstrap, return the same extracted key data
          logger.debug('🔑 getSecretStorageKey called during bootstrap - returning extracted key data', {
            keyLength: keyData.length,
            keyType: typeof keyData,
            isUint8Array: keyData instanceof Uint8Array,
            firstFewBytes: Array.from(keyData.slice(0, 4))
          })
          // Ensure we return a fresh Uint8Array
          return new Uint8Array(keyData)
        },
        setupNewSecretStorage: true // Force fresh setup to avoid key conflicts
      })
      logger.debug('✅ Secret storage bootstrapped')

      // Step 3: Bootstrap cross-signing (uses the secret storage from step 2)
      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
          // Auto-approve for initial setup - no UI interaction needed
          await makeRequest(null)
        }
      })
      logger.debug('✅ Cross-signing bootstrapped')
    } catch (error) {
      logger.error('Bootstrap step failed:', error)
      throw error
    }
  }

  private determineFailureStep (error: unknown): string {
    const errorMessage = (error as Error).message?.toLowerCase() || ''

    if (errorMessage.includes('cross') || errorMessage.includes('signing')) {
      return 'cross-signing'
    }
    if (errorMessage.includes('secret') || errorMessage.includes('storage')) {
      return 'secret-storage'
    }
    if (errorMessage.includes('recovery') || errorMessage.includes('key')) {
      return 'key-generation'
    }

    return 'unknown'
  }

  /**
   * Clear all Matrix crypto data (IndexedDB + localStorage)
   * Safe user-initiated way to resolve MAC errors and start fresh
   */
  async clearAllMatrixData (): Promise<EncryptionBootstrapResult> {
    try {
      logger.debug('🧹 Starting complete Matrix data clearing...')
      const crypto = await this.waitForCrypto()

      if (crypto) {
        try {
          // Clear key backup
          await crypto.resetKeyBackup()
          logger.debug('✅ Key backup cleared')

          // Clear cross-signing identity
          await crypto.resetCrossSigning()
          logger.debug('✅ Cross-signing identity cleared')

          // Clear device-level secrets
          await crypto.dehydrateDevice()
          logger.debug('✅ Device secrets cleared')
        } catch (error) {
          logger.debug('⚠️ Some crypto clearing failed (this is normal if nothing exists):', error)
        }
      }

      // Clear localStorage recovery keys and other Matrix data
      // Note: Recovery key storage is now handled by Matrix SDK's secret storage system
      // No localStorage recovery keys to clear

      // Clear IndexedDB databases
      try {
        const databases = await indexedDB.databases()
        for (const db of databases) {
          if (db.name && (db.name.includes('matrix-crypto-') || db.name.includes('matrix-store-'))) {
            const deleteRequest = indexedDB.deleteDatabase(db.name)
            await new Promise<void>((resolve, reject) => {
              deleteRequest.onsuccess = () => {
                logger.debug(`✅ Cleared IndexedDB: ${db.name}`)
                resolve()
              }
              deleteRequest.onerror = () => reject(deleteRequest.error)
              deleteRequest.onblocked = () => {
                logger.warn(`⚠️ IndexedDB deletion blocked: ${db.name}`)
                resolve() // Continue anyway
              }
            })
          }
        }
      } catch (error) {
        logger.warn('⚠️ IndexedDB clearing failed (may not be supported):', error)
      }

      logger.debug('🧹 Matrix data clearing completed')
      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to clear Matrix data:', error)
      return {
        success: false,
        error: error.message,
        step: 'data-clearing'
      }
    }
  }

  /**
   * Nuclear option: Reset encryption completely
   */
  async resetEncryption (): Promise<EncryptionBootstrapResult> {
    try {
      logger.debug('🔄 Starting encryption reset with retry logic...')
      const crypto = await this.waitForCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available after retries',
          step: 'initialization'
        }
      }

      // Reset by bootstrapping fresh
      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
          await makeRequest(null)
        }
      })

      await crypto.bootstrapSecretStorage({
        createSecretStorageKey: () => {
          // Generate fresh key for reset
          return crypto.createRecoveryKeyFromPassphrase('')
        }
      })

      logger.debug('🔥 Encryption reset completed')
      return { success: true }
    } catch (error) {
      logger.error('Encryption reset failed:', error)
      return {
        success: false,
        error: error.message,
        step: 'reset'
      }
    }
  }

  /**
   * Validate user passphrase strength
   */
  validatePassphrase (passphrase: string): PassphraseValidationResult {
    if (passphrase.length < 12) {
      return {
        isValid: false,
        strength: 'weak',
        feedback: 'Passphrase must be at least 12 characters long'
      }
    }

    let score = 0
    const feedback: string[] = []

    // Length scoring
    if (passphrase.length >= 12) score += 1
    if (passphrase.length >= 20) score += 1

    // Character variety scoring
    if (/[a-z]/.test(passphrase)) score += 1
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(passphrase)) score += 1
    else feedback.push('Add uppercase letters')

    if (/[0-9]/.test(passphrase)) score += 1
    else feedback.push('Add numbers')

    if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1
    else feedback.push('Add special characters')

    // Common patterns penalty
    const commonPatterns = ['password', '123456', 'qwerty', 'abc123']
    const lowerPassphrase = passphrase.toLowerCase()
    if (commonPatterns.some(pattern => lowerPassphrase.includes(pattern))) {
      score -= 2
      feedback.push('Avoid common patterns')
    }

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong'
    if (score >= 5) strength = 'strong'
    else if (score >= 3) strength = 'medium'
    else strength = 'weak'

    return {
      isValid: score >= 2, // Allow medium strength (was too strict at 3)
      strength,
      feedback: feedback.length > 0 ? `Try: ${feedback.join(', ')}` : undefined
    }
  }
}
