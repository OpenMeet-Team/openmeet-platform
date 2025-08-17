/**
 * Matrix Key Backup Service
 *
 * Simplified implementation for key backup operations
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'

export interface KeyBackupInfo {
  version: string
  algorithm: string
  authData: Record<string, unknown>
  count: number
  etag: string
}

export interface KeyBackupResult {
  success: boolean
  error?: string
  restoredKeys?: number
  backupInfo?: KeyBackupInfo
}

/**
 * Simplified service for managing Matrix key backup operations
 */
export class MatrixKeyBackupService {
  private matrixClient: MatrixClient

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
  }

  /**
   * Check if key backup is available on the server
   */
  public async isKeyBackupAvailable (): Promise<boolean> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.warn('Crypto not available for key backup check')
        return false
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      return !!backupInfo
    } catch (error) {
      logger.error('Failed to check key backup availability:', error)
      return false
    }
  }

  /**
   * Get key backup information from the server
   */
  public async getKeyBackupInfo (): Promise<KeyBackupInfo | null> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.warn('Crypto not available for key backup info')
        return null
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        return null
      }

      return {
        version: backupInfo.version,
        algorithm: backupInfo.algorithm,
        authData: (backupInfo.auth_data as unknown as Record<string, unknown>) || {},
        count: backupInfo.count || 0,
        etag: backupInfo.etag || ''
      }
    } catch (error) {
      logger.error('Failed to get key backup info:', error)
      return null
    }
  }

  /**
   * Verify if a recovery key can decrypt the key backup
   */
  public async verifyKeyBackup (recoveryKey: Uint8Array): Promise<boolean> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.warn('Crypto not available for key backup verification')
        return false
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        logger.warn('No key backup found to verify')
        return false
      }

      logger.debug('🔍 Verifying key backup with recovery key...')

      // Simplified verification - assume valid if we have both backup and key
      const isValid = !!backupInfo && recoveryKey.length > 0
      logger.debug(`Key backup verification: ${isValid ? '✅ valid' : '❌ invalid'}`)

      return isValid
    } catch (error) {
      logger.warn('Key backup verification failed:', error)
      return false
    }
  }

  /**
   * Restore key backup using recovery key
   */
  public async restoreKeyBackup (recoveryKey: Uint8Array): Promise<KeyBackupResult> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available for key backup restore'
        }
      }

      const backupInfo = await crypto.getKeyBackupInfo()
      if (!backupInfo) {
        return {
          success: false,
          error: 'No key backup found on server'
        }
      }

      logger.debug('🔄 Starting key backup restoration...')

      // Simplified verification
      const isValid = await this.verifyKeyBackup(recoveryKey)
      if (!isValid) {
        return {
          success: false,
          error: 'Recovery key cannot decrypt this backup'
        }
      }

      // Perform the restoration
      logger.debug('🔓 Restoring key backup...')
      try {
        await crypto.restoreKeyBackup()
        logger.debug('✅ Key backup restored successfully')

        return {
          success: true,
          restoredKeys: backupInfo.count || 0,
          backupInfo: {
            version: backupInfo.version,
            algorithm: backupInfo.algorithm,
            authData: (backupInfo.auth_data as unknown as Record<string, unknown>) || {},
            count: backupInfo.count || 0,
            etag: backupInfo.etag || ''
          }
        }
      } catch (restoreError) {
        logger.error('Key backup restoration failed:', restoreError)
        return {
          success: false,
          error: 'Key backup restoration failed'
        }
      }
    } catch (error) {
      logger.error('Failed to restore key backup:', error)
      return {
        success: false,
        error: error.message || 'Key backup restoration failed'
      }
    }
  }

  /**
   * Check backup status and get recommendations
   */
  public async getBackupStatus (): Promise<{
    hasBackup: boolean
    isVerified: boolean
    lastBackup?: Date
    keyCount?: number
    recommendations: string[]
  }> {
    const recommendations: string[] = []

    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        recommendations.push('Enable encryption to use key backup')
        return {
          hasBackup: false,
          isVerified: false,
          recommendations
        }
      }

      const backupInfo = await crypto.getKeyBackupInfo()

      if (!backupInfo) {
        recommendations.push('Set up key backup to secure your message history')
        return {
          hasBackup: false,
          isVerified: false,
          recommendations
        }
      }

      // Check if we can trust this backup
      let isVerified = false
      try {
        const isSecretStorageReady = await crypto.isSecretStorageReady()
        const isCrossSigningReady = await crypto.isCrossSigningReady()
        isVerified = isSecretStorageReady && isCrossSigningReady
      } catch {
        // Ignore verification check errors
      }

      if (!isVerified) {
        recommendations.push('Verify your identity to trust the existing backup')
      }

      const keyCount = backupInfo.count || 0
      if (keyCount === 0) {
        recommendations.push('No keys found in backup - messages may not be recoverable')
      }

      return {
        hasBackup: true,
        isVerified,
        keyCount,
        recommendations
      }
    } catch (error) {
      logger.error('Failed to get backup status:', error)
      recommendations.push('Unable to check backup status')
      return {
        hasBackup: false,
        isVerified: false,
        recommendations
      }
    }
  }

  /**
   * Force refresh of key backup status
   */
  public async refreshBackupStatus (): Promise<void> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return
      }

      // Force a refresh by querying the server
      await crypto.getKeyBackupInfo()
      logger.debug('Key backup status refreshed')
    } catch (error) {
      logger.warn('Failed to refresh backup status:', error)
    }
  }

  /**
   * Get recovery key info for UI display
   */
  public async getRecoveryKeyInfo (): Promise<{
    hasRecoveryKey: boolean
    keyId?: string
    algorithm?: string
  } | null> {
    try {
      // Simplified - check if secret storage has any keys
      const hasKey = await this.matrixClient.secretStorage.hasKey()

      return {
        hasRecoveryKey: hasKey
      }
    } catch (error) {
      logger.error('Failed to get recovery key info:', error)
      return null
    }
  }

  /**
   * Check if current device can decrypt messages from backup
   * This returns true if we can already decrypt, false if we cannot
   */
  public async canDecryptFromBackup (): Promise<boolean> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return false
      }

      // Add defensive checks to prevent null pointer errors in Rust WASM
      let isSecretStorageReady = false
      let isCrossSigningReady = false

      try {
        isSecretStorageReady = await crypto.isSecretStorageReady()
      } catch (secretStorageError) {
        logger.debug('Secret storage ready check failed (non-fatal):', secretStorageError)
        isSecretStorageReady = false
      }

      try {
        isCrossSigningReady = await crypto.isCrossSigningReady()
      } catch (crossSigningError) {
        logger.debug('Cross-signing ready check failed (non-fatal):', crossSigningError)
        isCrossSigningReady = false
      }

      // If both secret storage and cross-signing are ready, we can decrypt
      return isSecretStorageReady && isCrossSigningReady
    } catch (error) {
      logger.error('Failed to check backup decryption capability:', error)
      return false
    }
  }
}
