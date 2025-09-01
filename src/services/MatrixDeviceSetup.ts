/**
 * Matrix Device Setup Utility
 *
 * Provides easy-to-use methods for setting up cross-signing and verifying devices
 * in OpenMeet's Matrix implementation
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'
// import { MatrixEncryptionService } from './MatrixEncryptionService'
// NOTE: This import is retained for backward compatibility during migration

export interface DeviceSetupResult {
  success: boolean
  error?: string
  step?: string
  recoveryKey?: string
  deviceId?: string
}

/**
 * Simplified device setup service for OpenMeet
 */
export class MatrixDeviceSetup {
  private matrixClient: MatrixClient
  // private crossSigningAuthService: MatrixCrossSigningService
  // NOTE: Removed deviceVerificationService - now using unified MatrixDeviceManager

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
    // this.crossSigningAuthService = new MatrixCrossSigningService(matrixClient)
    // NOTE: Removed deviceVerificationService initialization - now using unified MatrixDeviceManager
  }

  /**
   * Set up cross-signing for the main OpenMeet device
   * This should be called once per user account
   */
  public async setupMainDevice (): Promise<DeviceSetupResult> {
    try {
      logger.debug('🔐 Setting up main OpenMeet device with cross-signing...')

      // First, set up encryption with cross-signing
      const { MatrixEncryptionService } = await import('./MatrixEncryptionManager')
      const encryptionService = new MatrixEncryptionService(this.matrixClient)
      const setupResult = await encryptionService.setupEncryption('default-passphrase')

      if (!setupResult.success) {
        return {
          success: false,
          error: setupResult.error,
          step: 'encryption-setup'
        }
      }

      // Device verification is now handled automatically by MatrixEncryptionService
      logger.debug('✅ Encryption setup completed with automatic device verification')

      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      logger.debug('✅ Main OpenMeet device setup completed', { userId, deviceId })

      return {
        success: true,
        recoveryKey: setupResult.recoveryKey,
        deviceId: deviceId || undefined
      }
    } catch (error) {
      logger.error('❌ Failed to setup main device:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'main-device-setup'
      }
    }
  }

  /**
   * Prepare the main device to verify additional devices
   * This ensures cross-signing is ready for verifying other devices
   */
  public async prepareForAdditionalDevices (): Promise<DeviceSetupResult> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available',
          step: 'crypto-check'
        }
      }

      // Check if cross-signing is ready
      const crossSigningReady = await crypto.isCrossSigningReady()
      if (!crossSigningReady) {
        logger.debug('Cross-signing not ready, attempting setup...')
        const setupResult = await this.setupMainDevice()
        return setupResult
      }

      // Verify current device is trusted
      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      if (!userId || !deviceId) {
        return {
          success: false,
          error: 'User ID or device ID not available',
          step: 'user-info'
        }
      }

      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
      const isVerified = verificationStatus?.crossSigningVerified || false

      if (!isVerified) {
        logger.debug('Current device not verified, attempting verification...')
        // Use our device verification helper
        // Use the unified device manager for verification
        const deviceManager = new (await import('./MatrixDeviceManager')).MatrixDeviceManager(this.matrixClient)
        const verifyResult = await deviceManager.testAndFixDeviceVerification()
        if (!verifyResult.success) {
          return {
            success: false,
            error: verifyResult.error,
            step: 'device-verification'
          }
        }
      }

      logger.debug('✅ Device prepared for verifying additional devices')
      return {
        success: true,
        deviceId
      }
    } catch (error) {
      logger.error('❌ Failed to prepare for additional devices:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'preparation'
      }
    }
  }

  /**
   * Get the current device status including verification state
   */
  public async getDeviceStatus (): Promise<{
    deviceId?: string
    userId?: string
    isVerified: boolean
    crossSigningReady: boolean
    secretStorageReady: boolean
    hasKeyBackup: boolean
    deviceCount: number
  }> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          isVerified: false,
          crossSigningReady: false,
          secretStorageReady: false,
          hasKeyBackup: false,
          deviceCount: 0
        }
      }

      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      // Check verification status
      let isVerified = false
      if (userId && deviceId) {
        const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
        isVerified = verificationStatus?.crossSigningVerified || false
      }

      // Check system status
      const [crossSigningReady, secretStorageReady, keyBackupInfo] = await Promise.all([
        crypto.isCrossSigningReady().catch(() => false),
        crypto.isSecretStorageReady().catch(() => false),
        crypto.getKeyBackupInfo().catch(() => null)
      ])

      // Get device count using unified device manager
      const deviceManager = new (await import('./MatrixDeviceManager')).MatrixDeviceManager(this.matrixClient)
      const devices = await deviceManager.getAllUserDevices()

      return {
        deviceId: deviceId || undefined,
        userId: userId || undefined,
        isVerified,
        crossSigningReady,
        secretStorageReady,
        hasKeyBackup: !!keyBackupInfo,
        deviceCount: devices.length
      }
    } catch (error) {
      logger.error('Failed to get device status:', error)
      return {
        isVerified: false,
        crossSigningReady: false,
        secretStorageReady: false,
        hasKeyBackup: false,
        deviceCount: 0
      }
    }
  }

  /**
   * Clean up old devices to prepare for new device verification
   */
  public async cleanupOldDevices (keepCount: number = 5): Promise<DeviceSetupResult> {
    try {
      logger.debug(`🧹 Cleaning up old devices (keeping ${keepCount})...`)

      const deviceManager = new (await import('./MatrixDeviceManager')).MatrixDeviceManager(this.matrixClient)
      const cleanupResult = await deviceManager.cleanupStaleDevices(keepCount)

      if (!cleanupResult.success) {
        return {
          success: false,
          error: cleanupResult.error,
          step: 'device-cleanup'
        }
      }

      logger.debug(`✅ Device cleanup completed: ${cleanupResult.deletedCount} devices removed`)
      return {
        success: true
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup old devices:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'cleanup'
      }
    }
  }

  /**
   * Complete device verification workflow for a second device
   * This includes accepting verification requests and completing the verification
   */
  public async handleSecondDeviceVerification (): Promise<DeviceSetupResult> {
    try {
      logger.debug('🔐 Handling second device verification workflow...')

      // Check for pending verification requests using unified device manager
      const deviceManager = new (await import('./MatrixDeviceManager')).MatrixDeviceManager(this.matrixClient)
      const pendingRequests = deviceManager.getPendingRequests()

      if (pendingRequests.length === 0) {
        return {
          success: false,
          error: 'No pending verification requests found. Make sure the second device has initiated verification.',
          step: 'no-requests'
        }
      }

      // Handle the most recent request
      const latestRequest = pendingRequests[pendingRequests.length - 1]
      logger.debug('🔍 Processing verification request:', latestRequest.requestId)

      // Accept the verification request
      const acceptResult = await deviceManager.acceptVerificationRequest(
        latestRequest.requestId,
        'm.sas.v1'
      )

      if (!acceptResult.success) {
        return {
          success: false,
          error: acceptResult.error,
          step: 'accept-verification'
        }
      }

      logger.debug('✅ Verification request accepted. Complete the emoji verification on both devices.')

      return {
        success: true,
        step: 'awaiting-emoji-confirmation'
      }
    } catch (error) {
      logger.error('❌ Failed to handle second device verification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'verification-workflow'
      }
    }
  }

  /**
   * Reset everything and start fresh (use when things are broken)
   */
  public async resetAndSetupFresh (): Promise<DeviceSetupResult> {
    try {
      logger.debug('🔄 Performing complete reset and fresh setup...')

      // Force reset cross-signing keys using MatrixEncryptionService
      const { MatrixEncryptionService } = await import('./MatrixEncryptionManager')
      const encryptionService = new MatrixEncryptionService(this.matrixClient)

      // Reset and setup fresh encryption
      const resetResult = await encryptionService.setupEncryption('default-passphrase')

      if (!resetResult.success) {
        return {
          success: false,
          error: resetResult.error,
          step: 'reset'
        }
      }

      logger.debug('✅ Complete reset and fresh setup completed')
      return {
        success: true,
        recoveryKey: resetResult.recoveryKey
      }
    } catch (error) {
      logger.error('❌ Failed to reset and setup fresh:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'fresh-setup'
      }
    }
  }

  /**
   * Get easy-to-understand instructions for the user
   */
  public async getSetupInstructions (): Promise<{
    currentStep: string
    instructions: string
    nextAction?: string
    troubleshooting?: string
  }> {
    const status = await this.getDeviceStatus()

    if (!status.secretStorageReady || !status.crossSigningReady) {
      return {
        currentStep: 'initial-setup',
        instructions: 'Your encryption needs to be set up first. This will generate a recovery key that you must save securely.',
        nextAction: 'Run setupMainDevice()',
        troubleshooting: 'If setup fails, check that your Matrix server supports cross-signing and that you have the necessary permissions.'
      }
    }

    if (!status.isVerified) {
      return {
        currentStep: 'device-verification',
        instructions: 'Your device needs to be verified to enable full encryption support.',
        nextAction: 'Complete device verification process',
        troubleshooting: 'If verification fails, try the resetAndSetupFresh() method.'
      }
    }

    if (status.deviceCount > 1) {
      return {
        currentStep: 'multi-device',
        instructions: `You have ${status.deviceCount} devices. Additional devices can be verified through the verification flow.`,
        nextAction: 'Use Element or another Matrix client to verify new devices',
        troubleshooting: 'Check the device list and clean up old devices if needed.'
      }
    }

    return {
      currentStep: 'ready',
      instructions: 'Your device is properly set up and verified. You can now use encrypted messaging.',
      nextAction: 'No action needed - system ready',
      troubleshooting: 'If issues arise, check device status periodically.'
    }
  }
}
