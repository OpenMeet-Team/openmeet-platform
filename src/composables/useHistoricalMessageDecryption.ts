/**
 * Composable for handling historical message decryption
 *
 * Integrates secret storage access and key backup restoration
 * to enable decryption of historical encrypted messages
 */

import { ref, computed } from 'vue'
// import { MatrixEncryptionService } from '../services/MatrixEncryptionService'
import { MatrixKeyBackupService } from '../services/MatrixKeyBackupService'
import { matrixClientService } from '../services/matrixClientService'
import { logger } from '../utils/logger'

export interface DecryptionStatus {
  isUnlocked: boolean
  hasBackup: boolean
  isRestoring: boolean
  error: string | null
  restoredKeys: number
  lastUnlockAttempt: Date | null
}

export interface UnlockOptions {
  showDialog?: boolean
  autoRestore?: boolean
}

/**
 * Composable for historical message decryption functionality
 */
export function useHistoricalMessageDecryption () {
  // Reactive state
  const status = ref<DecryptionStatus>({
    isUnlocked: false,
    hasBackup: false,
    isRestoring: false,
    error: null,
    restoredKeys: 0,
    lastUnlockAttempt: null
  })

  const showUnlockDialog = ref(false)

  // Services
  let secretStorageService: unknown = null
  let keyBackupService: MatrixKeyBackupService | null = null

  // Computed
  const canAttemptUnlock = computed(() => {
    return !status.value.isRestoring && !status.value.isUnlocked
  })

  const needsUnlock = computed(() => {
    // Show unlock UI if:
    // 1. We can't already decrypt (not unlocked), AND
    // 2. There's a backup available that could potentially be unlocked
    return !status.value.isUnlocked && status.value.hasBackup
  })

  const unlockRecommendation = computed(() => {
    if (status.value.isUnlocked) {
      return 'Historical messages are accessible'
    }

    if (status.value.hasBackup) {
      return 'Enter your passphrase to decrypt historical messages'
    }

    if (status.value.error) {
      return 'Unable to access encrypted messages'
    }

    return 'Checking encryption status...'
  })

  /**
   * Initialize services and check current status
   */
  const initialize = async (): Promise<void> => {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('Matrix client not available for historical decryption')
        return
      }

      // TODO: Replace with MatrixEncryptionService
      secretStorageService = null
      keyBackupService = new MatrixKeyBackupService(client)

      await checkDecryptionStatus()
    } catch (error) {
      logger.error('Failed to initialize historical message decryption:', error)
      status.value.error = 'Failed to initialize encryption services'
    }
  }

  /**
   * Check current decryption status
   */
  const checkDecryptionStatus = async (): Promise<void> => {
    if (!secretStorageService || !keyBackupService) {
      logger.debug('🔍 Historical decryption check skipped - services not initialized')
      return
    }

    try {
      logger.debug('🔍 Checking historical message decryption status...')

      // Check if secret storage is available
      const hasSecretStorage = await (secretStorageService as { isSecretStorageAvailable?: () => Promise<boolean> })?.isSecretStorageAvailable?.() ?? false
      logger.debug(`Secret storage available: ${hasSecretStorage}`)

      // Check if key backup is available
      const hasBackup = await keyBackupService.isKeyBackupAvailable()
      logger.debug(`Key backup available: ${hasBackup}`)

      // Check if we can already decrypt from backup
      const canDecrypt = await keyBackupService.canDecryptFromBackup()
      logger.debug(`Can decrypt from backup: ${canDecrypt}`)

      // Only trust the canDecryptFromBackup result - don't override it
      // Getting defaultKeyId just means secret storage exists, not that it's unlocked
      status.value.hasBackup = hasBackup
      status.value.isUnlocked = canDecrypt
      status.value.error = null

      // Debug the needsUnlock computation
      const needsUnlockValue = !canDecrypt && hasBackup
      logger.debug(`🔐 needsUnlock computed as: ${needsUnlockValue} (isUnlocked: ${canDecrypt}, hasBackup: ${hasBackup})`)

      if (hasBackup && !canDecrypt) {
        logger.debug('📝 Key backup available but not unlocked - user needs to provide recovery key')
      } else if (!hasBackup) {
        logger.debug('📝 No key backup available - historical messages cannot be decrypted')
      } else if (canDecrypt) {
        logger.debug('✅ Historical messages should be decryptable')
      }
    } catch (error) {
      logger.error('Failed to check decryption status:', error)
      status.value.error = 'Failed to check encryption status'
    }
  }

  /**
   * Show the unlock dialog to user
   */
  const promptForPassphrase = (options: UnlockOptions = {}): void => {
    if (!canAttemptUnlock.value) {
      return
    }

    const { showDialog = true } = options

    if (showDialog) {
      showUnlockDialog.value = true
    }
  }

  /**
   * Attempt to unlock with passphrase/recovery key
   */
  const unlockWithPassphrase = async (input: string, options: UnlockOptions = {}): Promise<boolean> => {
    if (!secretStorageService || !keyBackupService) {
      logger.error('Services not initialized')
      return false
    }

    try {
      status.value.isRestoring = true
      status.value.error = null
      status.value.lastUnlockAttempt = new Date()

      logger.debug('🔓 Attempting to unlock historical messages...')

      // Unlock secret storage
      const unlockResult = await (secretStorageService as { unlockSecretStorage?: (input: string) => Promise<{ success: boolean; error?: string }> })?.unlockSecretStorage?.(input) ?? { success: false, error: 'Service not available' }

      if (!unlockResult.success) {
        status.value.error = unlockResult.error || 'Failed to unlock'
        return false
      }

      logger.debug('✅ Secret storage unlocked')

      // Auto-restore key backup if requested
      const { autoRestore = true } = options
      if (autoRestore) {
        await restoreKeyBackup()
      }

      status.value.isUnlocked = true
      showUnlockDialog.value = false

      logger.debug('🎉 Historical message decryption unlocked successfully')
      return true
    } catch (error) {
      logger.error('Failed to unlock historical messages:', error)
      status.value.error = error.message || 'Unlock failed'
      return false
    } finally {
      status.value.isRestoring = false
    }
  }

  /**
   * Restore key backup (internal method)
   */
  const restoreKeyBackup = async (): Promise<void> => {
    if (!keyBackupService) {
      return
    }

    try {
      logger.debug('🔄 Restoring key backup...')

      // We need the recovery key that was used to unlock secret storage
      // This is a bit tricky because we need to get it from the secret storage service
      // For now, we'll let the Matrix SDK handle this automatically

      const backupStatus = await keyBackupService.getBackupStatus()
      if (backupStatus.hasBackup && !backupStatus.isVerified) {
        logger.debug('⚠️ Backup exists but is not verified - may need manual verification')
      }

      // The actual restoration happens automatically when secret storage is unlocked
      // This is handled by the Matrix SDK's cross-signing bootstrap process

      const keyCount = backupStatus.keyCount || 0
      status.value.restoredKeys = keyCount

      logger.debug(`✅ Key backup restoration completed (${keyCount} keys available)`)
    } catch (error) {
      logger.warn('Key backup restoration had issues (non-fatal):', error)
      // Don't fail the whole unlock process for backup issues
    }
  }

  /**
   * Close the unlock dialog
   */
  const closeUnlockDialog = (): void => {
    showUnlockDialog.value = false
    status.value.error = null
  }

  /**
   * Refresh encryption status
   */
  const refresh = async (): Promise<void> => {
    if (keyBackupService) {
      await keyBackupService.refreshBackupStatus()
    }
    await checkDecryptionStatus()
  }

  /**
   * Reset decryption state
   */
  const reset = (): void => {
    status.value.isUnlocked = false
    status.value.hasBackup = false
    status.value.isRestoring = false
    status.value.error = null
    status.value.restoredKeys = 0
    status.value.lastUnlockAttempt = null
    showUnlockDialog.value = false

    if (secretStorageService) {
      (secretStorageService as { clearSecretStorageCache?: () => void })?.clearSecretStorageCache?.()
    }
  }

  /**
   * Get detailed backup information
   */
  const getBackupInfo = async () => {
    if (!keyBackupService) {
      return null
    }

    return await keyBackupService.getKeyBackupInfo()
  }

  /**
   * Handle successful unlock
   */
  const handleUnlockSuccess = (keyId: string): void => {
    logger.debug(`✅ Unlock successful with key: ${keyId}`)
    status.value.isUnlocked = true
    status.value.error = null
    showUnlockDialog.value = false
  }

  /**
   * Handle unlock error
   */
  const handleUnlockError = (error: string): void => {
    logger.error('❌ Unlock failed:', error)
    status.value.error = error
    status.value.isUnlocked = false
  }

  return {
    // State
    status,
    showUnlockDialog,

    // Computed
    canAttemptUnlock,
    needsUnlock,
    unlockRecommendation,

    // Methods
    initialize,
    checkDecryptionStatus,
    promptForPassphrase,
    unlockWithPassphrase,
    closeUnlockDialog,
    refresh,
    reset,
    getBackupInfo,
    handleUnlockSuccess,
    handleUnlockError
  }
}
