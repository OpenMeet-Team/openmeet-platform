/**
 * Matrix Reset Service
 *
 * Unified service for handling Matrix encryption resets consistently across the application.
 * This ensures that "Forgot Recovery Key" and chat unlock resets work the same way.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'
import { MatrixEncryptionService } from './MatrixEncryptionService'

export interface ResetResult {
  success: boolean
  error?: string
  recoveryKey?: string
  requiresReconnection?: boolean
  step?: string
}

export interface ResetOptions {
  /**
   * Type of reset to perform
   * - 'forgot_recovery_key': User forgot their recovery key (full reset)
   * - 'unlock_failed': Unable to unlock with passphrase (reset encryption)
   * - 'key_mismatch': Cross-signing keys don't match (reset keys only)
   * - 'complete': Nuclear option - reset everything
   */
  resetType: 'forgot_recovery_key' | 'unlock_failed' | 'key_mismatch' | 'complete'

  /**
   * Clear local storage data
   */
  clearLocalData?: boolean

  /**
   * Force reconnection to Matrix
   */
  forceReconnection?: boolean
}

/**
 * Unified Matrix reset service
 */
export class MatrixResetService {
  private matrixClient: MatrixClient

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
  }

  /**
   * Perform a unified reset based on the reset type
   */
  public async performReset (options: ResetOptions): Promise<ResetResult> {
    try {
      logger.info(`🔄 Starting Matrix reset: ${options.resetType}`)

      // Only clear setup flags for resets that require full setup restart
      if (options.resetType === 'complete' || options.resetType === 'forgot_recovery_key') {
        await this.clearEncryptionSetupFlags()
      }

      switch (options.resetType) {
        case 'forgot_recovery_key':
          return await this.handleForgotRecoveryKey()
        case 'unlock_failed':
          return await this.handleUnlockFailed()
        case 'key_mismatch':
          return await this.handleKeyMismatch()
        case 'complete':
          return await this.handleCompleteReset(options)
        default:
          throw new Error(`Unknown reset type: ${options.resetType}`)
      }
    } catch (error) {
      logger.error(`❌ Reset failed for ${options.resetType}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'reset-execution'
      }
    }
  }

  /**
   * Handle forgot recovery key scenario
   * This is the most common case - user has lost their recovery key
   */
  private async handleForgotRecoveryKey (): Promise<ResetResult> {
    logger.debug('🔑 Handling forgot recovery key reset...')

    try {
      // Step 1: Reset encryption completely
      const encryptionResetResult = await this.resetEncryptionData()
      if (!encryptionResetResult.success) {
        return encryptionResetResult
      }

      // Step 2: Set up new encryption with cross-signing
      const setupResult = await this.setupFreshEncryption()
      if (!setupResult.success) {
        return {
          success: false,
          error: setupResult.error,
          step: 'fresh-setup'
        }
      }

      // Step 3: Emit reset event to trigger UI updates
      this.emitResetEvent('forgot_recovery_key')

      return {
        success: true,
        recoveryKey: setupResult.recoveryKey,
        step: 'completed'
      }
    } catch (error) {
      logger.error('❌ Forgot recovery key reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'forgot-recovery-key'
      }
    }
  }

  /**
   * Handle unlock failed scenario
   * This happens when user can't unlock historical messages
   */
  private async handleUnlockFailed (): Promise<ResetResult> {
    logger.debug('🔓 Handling unlock failed reset...')

    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available',
          step: 'crypto-check'
        }
      }

      // For unlock failures, we do a lighter reset that preserves connection
      logger.debug('🔄 Resetting encryption for unlock failure...')
      await crypto.resetEncryption(() => Promise.resolve())

      // Set up cross-signing after reset
      const encryptionService = new MatrixEncryptionService(this.matrixClient)
      const crossSigningResult = await encryptionService.setupEncryption('default-passphrase')

      if (crossSigningResult.success) {
        // Emit reset event to trigger UI updates
        this.emitResetEvent('unlock_failed')

        return {
          success: true,
          recoveryKey: crossSigningResult.recoveryKey,
          step: 'completed'
        }
      } else {
        return {
          success: false,
          error: crossSigningResult.error,
          step: 'cross-signing-setup'
        }
      }
    } catch (error) {
      logger.error('❌ Unlock failed reset error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'unlock-failed'
      }
    }
  }

  /**
   * Handle key mismatch scenario
   * This happens when cross-signing keys don't match between client and server
   */
  private async handleKeyMismatch (): Promise<ResetResult> {
    logger.debug('🔐 Handling key mismatch reset...')

    try {
      const encryptionService = new MatrixEncryptionService(this.matrixClient)
      await encryptionService.resetEncryption()
      const result = await encryptionService.setupEncryption('default-passphrase')

      if (result.success) {
        // Emit reset event to trigger UI updates
        this.emitResetEvent('key_mismatch')

        return {
          success: true,
          recoveryKey: result.recoveryKey,
          step: 'completed'
        }
      } else {
        return {
          success: false,
          error: result.error,
          step: 'key-mismatch'
        }
      }
    } catch (error) {
      logger.error('❌ Key mismatch reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'key-mismatch'
      }
    }
  }

  /**
   * Handle complete reset scenario
   * Nuclear option - reset everything and require reconnection
   */
  private async handleCompleteReset (options: ResetOptions): Promise<ResetResult> {
    logger.debug('💥 Handling complete reset...')

    try {
      // Step 1: Clear all local data
      if (options.clearLocalData !== false) {
        await this.clearAllLocalData()
      }

      // Step 2: Reset encryption
      const encryptionResetResult = await this.resetEncryptionData()
      if (!encryptionResetResult.success) {
        return encryptionResetResult
      }

      // Step 3: Mark for reconnection if requested
      if (options.forceReconnection) {
        await this.markForReconnection()
      }

      // Step 4: Emit reset event
      this.emitResetEvent('complete')

      return {
        success: true,
        requiresReconnection: options.forceReconnection,
        step: 'completed'
      }
    } catch (error) {
      logger.error('❌ Complete reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'complete-reset'
      }
    }
  }

  /**
   * Reset encryption data (crypto, secret storage, etc.)
   */
  private async resetEncryptionData (): Promise<ResetResult> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available',
          step: 'crypto-check'
        }
      }

      logger.debug('🔄 Resetting encryption data...')

      // Reset key backup
      try {
        await crypto.resetKeyBackup()
        logger.debug('✅ Key backup reset')
      } catch (error) {
        logger.warn('⚠️ Key backup reset failed (continuing):', error)
      }

      // Note: There's no direct resetCrossSigning method in the Matrix SDK
      // Cross-signing reset is typically handled by re-bootstrapping
      logger.debug('ℹ️ Cross-signing reset will be handled by re-bootstrapping')

      // Reset main encryption
      try {
        await crypto.resetEncryption(() => Promise.resolve())
        logger.debug('✅ Encryption reset')
      } catch (error) {
        logger.warn('⚠️ Encryption reset failed (continuing):', error)
      }

      return { success: true }
    } catch (error) {
      logger.error('❌ Encryption data reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'encryption-reset'
      }
    }
  }

  /**
   * Set up fresh encryption with cross-signing
   */
  private async setupFreshEncryption (): Promise<ResetResult> {
    try {
      logger.debug('🆕 Setting up fresh encryption...')

      const encryptionService = new MatrixEncryptionService(this.matrixClient)
      const result = await encryptionService.setupEncryption('default-passphrase')

      if (result.success) {
        logger.debug('✅ Fresh encryption setup completed')
        return {
          success: true,
          recoveryKey: result.recoveryKey
        }
      } else {
        return {
          success: false,
          error: result.error,
          step: 'fresh-encryption-setup'
        }
      }
    } catch (error) {
      logger.error('❌ Fresh encryption setup failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'fresh-encryption'
      }
    }
  }

  /**
   * Clear encryption setup flags to trigger fresh setup
   * Only clear flags for resets that require full setup restart
   */
  private async clearEncryptionSetupFlags (): Promise<void> {
    try {
      // Only clear flags for complete resets, not for unlock failures or key mismatches
      const setupCompleteKey = 'm.org.matrix.custom.openmeet.encryption_setup_complete'
      await (this.matrixClient as MatrixClient & { setAccountData: (key: string, data: Record<string, unknown>) => Promise<void> }).setAccountData(setupCompleteKey, {
        completed: false,
        timestamp: Date.now(),
        reset: true
      })
      logger.debug('🧹 Cleared encryption setup flags')
    } catch (error) {
      logger.warn('⚠️ Failed to clear encryption setup flags:', error)
    }
  }

  /**
   * Clear all local Matrix data
   */
  private async clearAllLocalData (): Promise<void> {
    try {
      logger.debug('🧹 Clearing all local Matrix data...')

      // Clear localStorage items
      const matrixKeys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('matrix') || key.includes('mx_'))) {
          matrixKeys.push(key)
        }
      }

      matrixKeys.forEach(key => {
        localStorage.removeItem(key)
        logger.debug(`🗑️ Removed localStorage: ${key}`)
      })

      // Clear IndexedDB databases
      try {
        const databases = await indexedDB.databases()
        for (const db of databases) {
          if (db.name && (db.name.includes('matrix') || db.name.includes('mx_'))) {
            const deleteRequest = indexedDB.deleteDatabase(db.name)
            await new Promise<void>((resolve, reject) => {
              deleteRequest.onsuccess = () => {
                logger.debug(`🗑️ Deleted IndexedDB: ${db.name}`)
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
        logger.warn('⚠️ IndexedDB clearing failed:', error)
      }

      logger.debug('✅ Local data clearing completed')
    } catch (error) {
      logger.error('❌ Local data clearing failed:', error)
      throw error
    }
  }

  /**
   * Mark client for reconnection
   */
  private async markForReconnection (): Promise<void> {
    try {
      // Set a flag that the client should reconnect
      localStorage.setItem('openmeet_matrix_needs_reconnection', 'true')
      logger.debug('🔄 Marked client for reconnection')
    } catch (error) {
      logger.warn('⚠️ Failed to mark for reconnection:', error)
    }
  }

  /**
   * Emit reset event to notify UI components
   */
  private emitResetEvent (resetType: string): void {
    try {
      // Always emit the new unified event
      window.dispatchEvent(new CustomEvent('matrix-reset-completed', {
        detail: {
          resetType,
          timestamp: Date.now()
        }
      }))

      // Only emit the legacy reset event for resets that should trigger setup flow restart
      // Don't emit for key_mismatch since that doesn't require full setup restart
      if (resetType === 'complete' || resetType === 'forgot_recovery_key') {
        window.dispatchEvent(new CustomEvent('matrix-encryption-reset', {
          detail: { reason: resetType }
        }))
        logger.debug(`📡 Emitted setup restart event for: ${resetType}`)
      }

      logger.debug(`📡 Emitted reset completion event for: ${resetType}`)
    } catch (error) {
      logger.warn('⚠️ Failed to emit reset events:', error)
    }
  }

  /**
   * Check if a reconnection is needed
   */
  public static needsReconnection (): boolean {
    return localStorage.getItem('openmeet_matrix_needs_reconnection') === 'true'
  }

  /**
   * Clear the reconnection flag
   */
  public static clearReconnectionFlag (): void {
    localStorage.removeItem('openmeet_matrix_needs_reconnection')
  }

  /**
   * Get user-friendly reset instructions based on current state
   */
  public async getResetInstructions (): Promise<{
    canReset: boolean
    recommendedAction: ResetOptions['resetType']
    instructions: string
    warning?: string
  }> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          canReset: true,
          recommendedAction: 'complete',
          instructions: 'Complete reset recommended - crypto not available',
          warning: 'This will require reconnecting to Matrix'
        }
      }

      const [secretStorageReady, crossSigningReady] = await Promise.all([
        crypto.isSecretStorageReady().catch(() => false),
        crypto.isCrossSigningReady().catch(() => false)
      ])

      if (!secretStorageReady && !crossSigningReady) {
        return {
          canReset: true,
          recommendedAction: 'forgot_recovery_key',
          instructions: 'Recovery key reset recommended - no encryption setup detected',
          warning: 'You will get a new recovery key that you must save'
        }
      }

      if (secretStorageReady && !crossSigningReady) {
        return {
          canReset: true,
          recommendedAction: 'key_mismatch',
          instructions: 'Cross-signing reset recommended - keys may be mismatched',
          warning: 'This will fix device verification issues'
        }
      }

      return {
        canReset: true,
        recommendedAction: 'unlock_failed',
        instructions: 'Light reset recommended - unlock historical messages',
        warning: 'This preserves your connection but resets encryption'
      }
    } catch (error) {
      logger.error('❌ Failed to get reset instructions:', error)
      return {
        canReset: true,
        recommendedAction: 'complete',
        instructions: 'Complete reset recommended due to error checking state',
        warning: 'This will require reconnecting to Matrix'
      }
    }
  }
}
