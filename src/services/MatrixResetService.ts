/**
 * Matrix Reset Service
 *
 * Unified service for handling Matrix encryption resets consistently across the application.
 * This ensures that "Forgot Recovery Key" and chat unlock resets work the same way.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'

// Forward declaration to avoid circular imports
interface IMatrixEncryptionManager {
  setClientRestartInProgress(inProgress: boolean): void
}

export interface ResetResult {
  success: boolean
  error?: string
  recoveryKey?: string
  requiresReconnection?: boolean
  step?: string
  message?: string
  needsSetup?: boolean
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
  private encryptionManager?: IMatrixEncryptionManager

  constructor (matrixClient: MatrixClient, encryptionManager?: IMatrixEncryptionManager) {
    this.matrixClient = matrixClient
    this.encryptionManager = encryptionManager
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
      // Step 1: Reset device keys using Element Web approach (with UIA support)
      logger.debug('🔄 Using MatrixEncryptionManager resetDeviceKeys with Element Web UIA flow...')
      const { MatrixEncryptionManager } = await import('./MatrixEncryptionManager')
      const encryptionManager = new MatrixEncryptionManager(this.matrixClient)
      const encryptionResetResult = await encryptionManager.resetDeviceKeys()
      if (!encryptionResetResult.success) {
        return {
          success: false,
          error: encryptionResetResult.error,
          step: 'encryption-reset'
        }
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
      logger.debug('🔄 Resetting encryption for unlock failure with UIA support...')

      // UIA callback to handle MAS cross-signing reset authorization (Element Web pattern)
      const uiaCallback = async (makeRequest: (auth?: Record<string, unknown>) => Promise<void>) => {
        try {
          return await makeRequest({})
        } catch (error: unknown) {
          // Check if this is a UIA challenge with org.matrix.cross_signing_reset stage
          const errorData = error as { data?: { flows?: { stages?: string[] }[] } }
          const flows = errorData.data?.flows || []
          const crossSigningResetFlow = flows.find((flow: { stages?: string[] }) =>
            flow.stages?.includes('org.matrix.cross_signing_reset')
          )

          if (crossSigningResetFlow) {
            logger.debug('🔐 UIA flow requires MAS cross-signing reset authorization')

            // Get the MAS URL for authorization (should be provided in stageParams)
            const errorData = error as { data?: { params?: { ['org.matrix.cross_signing_reset']?: { url?: string } } } }
            const stageParams = errorData.data?.params?.['org.matrix.cross_signing_reset']
            const masUrl = stageParams?.url

            if (masUrl) {
              // Show user a confirmation dialog and open MAS URL
              const shouldProceed = confirm(
                'To reset your encryption keys, you need to authorize this action in your account settings.\n\n' +
                'Click OK to open your account page, complete the authorization, then try the reset again.'
              )

              if (shouldProceed) {
                // Open MAS URL in new tab/popup (Element Web uses popup)
                window.open(masUrl, '_blank', 'width=600,height=600,scrollbars=yes,resizable=yes')

                // For now, we'll throw a user-friendly error asking them to retry
                // In a full implementation, we would show a dialog with a "Retry" button
                throw new Error('Please complete the authorization in the opened tab, then click "Reset Device Keys" again.')
              } else {
                throw new Error('Encryption reset cancelled by user.')
              }
            } else {
              logger.warn('⚠️ MAS cross-signing reset flow detected but no URL provided')
              throw new Error('Server requires authorization but did not provide authorization URL.')
            }
          }

          // For other UIA errors, rethrow as-is
          throw error
        }
      }

      await crypto.resetEncryption(uiaCallback)

      // Set up cross-signing after reset
      const { MatrixEncryptionService } = await import('./MatrixEncryptionManager')
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
      const { MatrixEncryptionService } = await import('./MatrixEncryptionManager')
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
      // Step 1: Reset encryption first (Element Web approach handles both server and client cleanup)
      // Note: Don't clear local data first - let resetEncryption() handle the proper sequencing
      logger.debug('🔄 Using MatrixEncryptionManager resetDeviceKeys with Element Web UIA flow...')
      const { MatrixEncryptionManager } = await import('./MatrixEncryptionManager')
      const encryptionManager = new MatrixEncryptionManager(this.matrixClient)
      const encryptionResetResult = await encryptionManager.resetDeviceKeys()
      if (!encryptionResetResult.success) {
        return {
          success: false,
          error: encryptionResetResult.error,
          step: 'encryption-reset'
        }
      }

      // Step 2: Clear remaining local data after successful encryption reset
      if (options.clearLocalData !== false) {
        logger.debug('🧹 Clearing remaining local data after encryption reset...')
        await this.clearAllLocalData()
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
   * Includes MAS authorization to prevent one-time key conflicts
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

      // Step 1: Complete client shutdown and clear stores approach (like Element Web logout)
      logger.debug('🔐 Using complete client shutdown and store clearing approach...')

      // Activate circuit breaker to prevent event loops during reset
      if (this.encryptionManager) {
        this.encryptionManager.setClientRestartInProgress(true)
      }

      // Step 3: Stop client before clearing stores (Element Web pattern)
      logger.debug('🛑 Stopping Matrix client before store clearing...')
      await this.matrixClient.stopClient()

      // Step 4: Clear stores to remove all crypto data (Element Web pattern)
      try {
        logger.debug('🗑️ Clearing Matrix stores to remove all crypto data...')
        await this.matrixClient.clearStores()
        logger.debug('✅ Matrix stores cleared successfully')
      } catch (error) {
        logger.warn('⚠️ Store clearing failed:', error)
      }

      // Step 5: Wait for clearing to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 6: Start client again to reinitialize crypto from scratch
      logger.debug('🔄 Starting Matrix client to reinitialize crypto from scratch...')
      await this.matrixClient.startClient({
        initialSyncLimit: 0
      })

      // Step 7: Wait for client to be ready
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Step 8: Verify crypto is available and try to bootstrap
      try {
        const newCrypto = this.matrixClient.getCrypto()
        if (newCrypto) {
          logger.debug('✅ Crypto available after restart, ready for fresh setup')
        } else {
          logger.warn('⚠️ Crypto not available after restart')
        }
      } catch (error) {
        logger.warn('⚠️ Crypto verification failed:', error)
      }

      // Step 9: Deactivate circuit breaker
      if (this.encryptionManager) {
        this.encryptionManager.setClientRestartInProgress(false)
      }

      return {
        success: true,
        requiresReconnection: false
      }
    } catch (error) {
      logger.error('❌ Encryption data reset failed:', error)

      // Ensure circuit breaker is deactivated on error
      if (this.encryptionManager) {
        this.encryptionManager.setClientRestartInProgress(false)
      }

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

      // Wait for crypto to be available after client restart
      let crypto = this.matrixClient.getCrypto()
      let retries = 0
      const maxRetries = 10

      while (!crypto && retries < maxRetries) {
        logger.debug(`⏳ Waiting for crypto to be available... (${retries + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        crypto = this.matrixClient.getCrypto()
        retries++
      }

      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available after client restart',
          step: 'fresh-encryption-setup'
        }
      }

      logger.debug('✅ Crypto is ready, proceeding with fresh setup')
      const { MatrixEncryptionService } = await import('./MatrixEncryptionManager')
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
   * Clear local Matrix data for current user only
   */
  private async clearAllLocalData (): Promise<void> {
    try {
      const userId = this.matrixClient.getUserId()
      if (!userId) {
        logger.warn('⚠️ No user ID available, skipping local data clearing')
        return
      }

      logger.debug('🧹 Clearing local Matrix data for user:', userId)

      // Clear user-specific localStorage items
      const matrixKeys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && this.isUserSpecificKey(key, userId)) {
          matrixKeys.push(key)
        }
      }

      matrixKeys.forEach(key => {
        localStorage.removeItem(key)
        logger.debug(`🗑️ Removed localStorage: ${key}`)
      })

      // Clear user-specific IndexedDB databases
      try {
        const databases = await indexedDB.databases()
        for (const db of databases) {
          if (db.name && this.isUserSpecificDatabase(db.name, userId)) {
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

      logger.debug('✅ User-specific local data clearing completed')
    } catch (error) {
      logger.error('❌ Local data clearing failed:', error)
      throw error
    }
  }

  /**
   * Check if a localStorage key belongs to the current user
   */
  private isUserSpecificKey (key: string, userId: string): boolean {
    // Match patterns like: matrix_device_id_@user:domain.com
    if (key.includes(`matrix_device_id_${userId}`)) return true

    // Match patterns like: matrix-js-sdk:@user:domain.com:device
    if (key.includes(`matrix-js-sdk:${userId}:`)) return true

    // Match encryption setup flags
    if (key.includes('encryption_setup') && key.includes(userId)) return true

    // Match recovery key storage patterns
    if (key.includes('recovery_key') && key.includes(userId)) return true

    return false
  }

  /**
   * Check if an IndexedDB database belongs to the current user
   */
  private isUserSpecificDatabase (dbName: string, userId: string): boolean {
    // Match patterns like: matrix-js-sdk:@user:domain.com
    if (dbName.includes(`matrix-js-sdk:${userId}`)) return true

    // Match crypto store patterns like: matrix-js-sdk:crypto:@user:domain.com:device
    if (dbName.includes(`matrix-js-sdk:crypto:${userId}:`)) return true

    return false
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
