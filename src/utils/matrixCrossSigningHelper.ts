/**
 * Matrix Cross-Signing Helper
 *
 * Simple utility functions for cross-signing setup in OpenMeet
 * This provides easy-to-use functions that can be called from components or services
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { MatrixDeviceManager } from '../services/MatrixDeviceManager'
import { logger } from './logger'

/**
 * Set up cross-signing for the main OpenMeet device
 * Call this once per user account, typically after login
 */
export async function setupMainOpenMeetDevice (matrixClient: MatrixClient): Promise<{
  success: boolean
  error?: string
  recoveryKey?: string
  instructions?: string
}> {
  try {
    const deviceManager = new MatrixDeviceManager(matrixClient)
    const result = await deviceManager.setupMainDevice()

    if (result.success) {
      logger.info('✅ Main OpenMeet device set up successfully')
      return {
        success: true,
        recoveryKey: result.recoveryKey,
        instructions: 'Save your recovery key in a secure location. You will need it if you lose access to this device.'
      }
    } else {
      logger.error('❌ Failed to setup main device:', result.error)
      return {
        success: false,
        error: result.error
      }
    }
  } catch (error) {
    logger.error('❌ Main device setup error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Check if the current device is ready for cross-signing
 * Use this to determine UI state and next steps
 */
export async function checkDeviceReadiness (matrixClient: MatrixClient): Promise<{
  isReady: boolean
  status: string
  needsSetup: boolean
  needsVerification: boolean
  instructions: string
  deviceCount: number
}> {
  try {
    const deviceManager = new MatrixDeviceManager(matrixClient)
    const status = await deviceManager.getDeviceStatus()
    const instructions = await deviceManager.getSetupInstructions()

    return {
      isReady: status.isVerified && status.crossSigningReady,
      status: instructions.currentStep,
      needsSetup: !status.secretStorageReady || !status.crossSigningReady,
      needsVerification: !status.isVerified,
      instructions: instructions.instructions,
      deviceCount: status.deviceCount
    }
  } catch (error) {
    logger.error('❌ Device readiness check error:', error)
    return {
      isReady: false,
      status: 'error',
      needsSetup: true,
      needsVerification: true,
      instructions: 'Unable to check device status. Please try setting up encryption.',
      deviceCount: 0
    }
  }
}

/**
 * Handle device verification for additional devices (second device, mobile app, etc.)
 * Call this when a verification request is received
 */
export async function handleAdditionalDeviceVerification (matrixClient: MatrixClient): Promise<{
  success: boolean
  error?: string
  instructions?: string
}> {
  try {
    const deviceManager = new MatrixDeviceManager(matrixClient)

    // First make sure main device is ready
    const prepResult = await deviceManager.prepareForAdditionalDevices()
    if (!prepResult.success) {
      return {
        success: false,
        error: prepResult.error,
        instructions: 'Main device needs to be set up first before verifying additional devices.'
      }
    }

    // Handle the verification workflow
    const verifyResult = await deviceManager.handleSecondDeviceVerification()
    if (!verifyResult.success) {
      return {
        success: false,
        error: verifyResult.error
      }
    }

    return {
      success: true,
      instructions: 'Verification started. Complete the emoji comparison on both devices.'
    }
  } catch (error) {
    logger.error('❌ Additional device verification error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Clean up old/stale devices
 * Use this periodically to maintain a clean device list
 */
export async function cleanupStaleDevices (matrixClient: MatrixClient, keepCount: number = 5): Promise<{
  success: boolean
  deletedCount: number
  error?: string
}> {
  try {
    const deviceManager = new MatrixDeviceManager(matrixClient)
    const result = await deviceManager.cleanupOldDevices(keepCount)

    return {
      success: result.success,
      deletedCount: 0, // This would be provided by the cleanup result
      error: result.error
    }
  } catch (error) {
    logger.error('❌ Device cleanup error:', error)
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Reset everything when cross-signing is broken
 * This is the "nuclear option" - use when authentication keeps failing
 */
export async function resetCrossSigningCompletely (matrixClient: MatrixClient): Promise<{
  success: boolean
  error?: string
  recoveryKey?: string
  instructions?: string
}> {
  try {
    const deviceManager = new MatrixDeviceManager(matrixClient)
    const result = await deviceManager.resetAndSetupFresh()

    if (result.success) {
      return {
        success: true,
        recoveryKey: result.recoveryKey,
        instructions: 'Complete reset successful. Save your new recovery key securely. All other devices will need to be re-verified.'
      }
    } else {
      return {
        success: false,
        error: result.error
      }
    }
  } catch (error) {
    logger.error('❌ Complete reset error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Simple status check for debugging
 * Returns human-readable status information
 */
export async function getDebugStatus (matrixClient: MatrixClient): Promise<{
  userId?: string
  deviceId?: string
  serverUrl: string
  isVerified: boolean
  crossSigningReady: boolean
  secretStorageReady: boolean
  hasKeyBackup: boolean
  deviceCount: number
  serverType: 'mas' | 'synapse' | 'unknown'
}> {
  try {
    const deviceManager = new MatrixDeviceManager(matrixClient)
    const status = await deviceManager.getDeviceStatus()

    // Try to determine server type
    let serverType: 'mas' | 'synapse' | 'unknown' = 'unknown'
    const serverUrl = matrixClient.baseUrl
    if (serverUrl.includes('mas')) {
      serverType = 'mas'
    } else if (serverUrl.includes('synapse')) {
      serverType = 'synapse'
    }

    return {
      userId: status.userId,
      deviceId: status.deviceId,
      serverUrl,
      isVerified: status.isVerified,
      crossSigningReady: status.crossSigningReady,
      secretStorageReady: status.secretStorageReady,
      hasKeyBackup: status.hasKeyBackup,
      deviceCount: status.deviceCount,
      serverType
    }
  } catch (error) {
    logger.error('❌ Debug status error:', error)
    return {
      serverUrl: matrixClient.baseUrl,
      isVerified: false,
      crossSigningReady: false,
      secretStorageReady: false,
      hasKeyBackup: false,
      deviceCount: 0,
      serverType: 'unknown'
    }
  }
}
