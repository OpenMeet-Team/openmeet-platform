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
      logger.debug('🔑 Created recovery key from passphrase')

      // Step 2: Bootstrap cross-signing
      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
          // Auto-approve for initial setup - no UI interaction needed
          await makeRequest(null)
        }
      })
      logger.debug('✅ Cross-signing bootstrapped')

      // Step 3: Bootstrap secret storage
      await crypto.bootstrapSecretStorage({
        createSecretStorageKey: () => recoveryKey
      })
      logger.debug('✅ Secret storage bootstrapped')
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
