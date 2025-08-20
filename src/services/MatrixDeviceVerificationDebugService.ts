/**
 * Matrix Device Verification Debug Service
 * 
 * Provides debugging and manual verification tools for Matrix device verification
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'

export class MatrixDeviceVerificationDebugService {
  private matrixClient: MatrixClient

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
  }

  /**
   * Get comprehensive device verification status
   */
  async getDeviceVerificationStatus (): Promise<{
    currentDevice: {
      userId: string | null
      deviceId: string | null
      isVerified: boolean
      crossSigningReady: boolean
      secretStorageReady: boolean
    }
    allDevices: Array<{
      deviceId: string
      displayName: string
      verified: boolean
      crossSigned: boolean
    }>
    crossSigningStatus: {
      ready: boolean
      keys: {
        master?: boolean
        selfSigning?: boolean
        userSigning?: boolean
      }
    }
  }> {
    const crypto = this.matrixClient.getCrypto()
    const userId = this.matrixClient.getUserId()
    const deviceId = this.matrixClient.getDeviceId()

    const result = {
      currentDevice: {
        userId,
        deviceId,
        isVerified: false,
        crossSigningReady: false,
        secretStorageReady: false
      },
      allDevices: [] as Array<{
        deviceId: string
        displayName: string
        verified: boolean
        crossSigned: boolean
      }>,
      crossSigningStatus: {
        ready: false,
        keys: {}
      }
    }

    if (!crypto || !userId || !deviceId) {
      logger.warn('⚠️ Missing crypto API, user ID, or device ID')
      return result
    }

    try {
      // Check cross-signing and secret storage status
      result.currentDevice.crossSigningReady = await crypto.isCrossSigningReady()
      result.currentDevice.secretStorageReady = await crypto.isSecretStorageReady()
      result.crossSigningStatus.ready = result.currentDevice.crossSigningReady

      // Get current device verification status
      const currentDeviceInfo = await crypto.getDeviceVerificationStatus(userId, deviceId)
      result.currentDevice.isVerified = currentDeviceInfo?.isVerified() || false

      // Get all devices for the user
      const devices = await crypto.getUserDeviceInfo([userId])
      const userDevices = devices.get(userId)

      if (userDevices) {
        for (const [devId, deviceInfo] of userDevices) {
          result.allDevices.push({
            deviceId: devId,
            displayName: deviceInfo.displayName || 'Unknown Device',
            verified: deviceInfo.verified || false,
            crossSigned: false // Will be filled if available
          })
        }
      }

      // Check cross-signing keys
      try {
        const crossSigningInfo = await crypto.getCrossSigningKeyId()
        if (crossSigningInfo) {
          result.crossSigningStatus.keys.master = true
        }
      } catch (error) {
        logger.debug('No cross-signing master key found:', error)
      }

    } catch (error) {
      logger.error('Failed to get device verification status:', error)
    }

    return result
  }

  /**
   * Attempt to manually verify the current device
   */
  async manuallyVerifyCurrentDevice (): Promise<{ success: boolean; message: string }> {
    const crypto = this.matrixClient.getCrypto()
    const userId = this.matrixClient.getUserId()
    const deviceId = this.matrixClient.getDeviceId()

    if (!crypto || !userId || !deviceId) {
      return {
        success: false,
        message: 'Missing crypto API, user ID, or device ID'
      }
    }

    try {
      logger.debug('🔐 Attempting manual device verification...')

      // Method 1: Try setDeviceVerified
      try {
        await crypto.setDeviceVerified(userId, deviceId, true)
        logger.debug('✅ Device marked as verified using setDeviceVerified')
      } catch (error) {
        logger.warn('⚠️ setDeviceVerified failed:', error)
      }

      // Method 2: Try cross-signing the device
      try {
        // Check if we can sign our own device
        const crossSigningReady = await crypto.isCrossSigningReady()
        if (crossSigningReady) {
          // This would typically require the cross-signing private key
          logger.debug('🔑 Cross-signing is ready, attempting to self-sign device')
          
          // For first device, we should already have cross-signing set up
          // The device should be automatically trusted through the bootstrap process
          const deviceInfo = await crypto.getDeviceVerificationStatus(userId, deviceId)
          if (deviceInfo?.isCrossSigningTrusted()) {
            logger.debug('✅ Device is cross-signing trusted')
          } else {
            logger.debug('⚠️ Device is not cross-signing trusted')
          }
        }
      } catch (error) {
        logger.warn('⚠️ Cross-signing verification failed:', error)
      }

      // Method 3: Bootstrap verification if needed
      try {
        const secretStorageReady = await crypto.isSecretStorageReady()
        if (!secretStorageReady) {
          logger.debug('🔄 Secret storage not ready, may need re-bootstrap')
          return {
            success: false,
            message: 'Secret storage not ready - may need to re-run encryption setup'
          }
        }
      } catch (error) {
        logger.warn('⚠️ Secret storage check failed:', error)
      }

      // Check final status
      const finalStatus = await this.getDeviceVerificationStatus()
      if (finalStatus.currentDevice.isVerified) {
        return {
          success: true,
          message: 'Device successfully verified'
        }
      } else {
        return {
          success: false,
          message: `Device still not verified. Cross-signing ready: ${finalStatus.currentDevice.crossSigningReady}, Secret storage ready: ${finalStatus.currentDevice.secretStorageReady}`
        }
      }

    } catch (error) {
      logger.error('❌ Manual verification failed:', error)
      return {
        success: false,
        message: `Manual verification failed: ${error.message}`
      }
    }
  }

  /**
   * Reset and re-bootstrap encryption (use with caution)
   */
  async resetAndRebootstrapEncryption (): Promise<{ success: boolean; message: string }> {
    const crypto = this.matrixClient.getCrypto()
    
    if (!crypto) {
      return {
        success: false,
        message: 'Crypto API not available'
      }
    }

    try {
      logger.debug('🔄 Resetting and re-bootstrapping encryption...')

      // Reset existing crypto state
      await crypto.resetKeyBackup()
      logger.debug('✅ Key backup reset')

      // Re-bootstrap with a fresh key
      await crypto.bootstrapSecretStorage({
        createSecretStorageKey: () => {
          return crypto.createRecoveryKeyFromPassphrase('')
        },
        setupNewSecretStorage: true
      })
      logger.debug('✅ Secret storage re-bootstrapped')

      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest: (auth: unknown) => Promise<void>) => {
          await makeRequest(null)
        }
      })
      logger.debug('✅ Cross-signing re-bootstrapped')

      // Try to verify this device again
      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()
      
      if (userId && deviceId) {
        await crypto.setDeviceVerified(userId, deviceId, true)
        logger.debug('✅ Device verified after re-bootstrap')
      }

      return {
        success: true,
        message: 'Encryption re-bootstrapped successfully'
      }

    } catch (error) {
      logger.error('❌ Re-bootstrap failed:', error)
      return {
        success: false,
        message: `Re-bootstrap failed: ${error.message}`
      }
    }
  }
}