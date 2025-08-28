/**
 * Device Verification Helper
 *
 * Simple utility following Element Web's proven device verification patterns
 * Now uses createCrossSigning instead of complex MAS handling
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { matrixClientService } from '../services/matrixClientService'
import { createCrossSigning } from '../services/createCrossSigning'
import { logger } from './logger'

/**
 * Test and fix device verification using Element Web's simple patterns
 *
 * This now follows Element Web's approach:
 * 1. Check if device is already verified
 * 2. If not, use simple createCrossSigning (no force reset)
 * 3. Let SDK handle UIA through our mobile-friendly callbacks
 */
export async function testAndFixDeviceVerification (): Promise<{
  success: boolean
  error?: string
  isVerified?: boolean
}> {
  try {
    logger.debug('🔍 Testing device verification using Element Web patterns...')

    const client = matrixClientService.getClient()
    if (!client) {
      logger.error('❌ No Matrix client available')
      return { success: false, error: 'No Matrix client available' }
    }

    const crypto = client.getCrypto()
    if (!crypto) {
      logger.error('❌ No crypto API available')
      return { success: false, error: 'No crypto API available' }
    }

    // Check if verification is needed (Element Web pattern)
    const needsVerification = await checkIfVerificationNeeded(client)
    logger.debug('📊 Needs verification:', needsVerification)

    if (!needsVerification) {
      logger.debug('✅ Device is already verified')
      return { success: true, isVerified: true }
    }

    // Attempt verification using Element Web's simple approach
    logger.debug('🔧 Attempting device verification with createCrossSigning...')

    try {
      // Use Element Web's approach with complete reset to fix device registration issues
      logger.debug('🔄 Using complete cross-signing reset to fix device registration')
      await createCrossSigning(client, true) // forceNew = true for complete reset

      // Wait for Matrix SDK internal state to update after complete reset
      logger.debug('⏳ Waiting for Matrix SDK verification state to update after reset...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Verify the device is now verified
      const isNowVerified = await checkIfVerificationNeeded(client)

      if (!isNowVerified) {
        logger.debug('✅ Device verification completed successfully')
        return { success: true, isVerified: true }
      } else {
        logger.debug('⚠️ Device verification completed but device may still need verification')
        return { success: true, isVerified: false }
      }
    } catch (error) {
      logger.error('❌ Device verification failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Device verification failed'
      }
    }
  } catch (error) {
    logger.error('❌ Device verification test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Check if device verification is needed (Element Web pattern)
 *
 * Element Web pattern: crossSigningReady && !crossSigningVerified
 */
async function checkIfVerificationNeeded (client: MatrixClient): Promise<boolean> {
  try {
    const crypto = client.getCrypto()
    if (!crypto) return true // No crypto = needs verification

    const userId = client.getUserId()
    const deviceId = client.getDeviceId()
    if (!userId || !deviceId) return true

    const crossSigningReady = await crypto.isCrossSigningReady()
    const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)

    // Element Web pattern: needs verification if cross-signing is ready but device isn't verified
    return crossSigningReady && !deviceStatus?.crossSigningVerified
  } catch (error) {
    logger.warn('Error checking verification status:', error)
    return true // Error = assume needs verification
  }
}

/**
 * Quick verification status check using Element Web patterns
 */
export async function quickVerificationCheck (): Promise<{
  isVerified: boolean
  status: string
  canFix: boolean
}> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      return { isVerified: false, status: 'No Matrix client', canFix: false }
    }

    const needsVerification = await checkIfVerificationNeeded(client)

    return {
      isVerified: !needsVerification,
      status: needsVerification ? 'Needs verification' : 'Verified',
      canFix: needsVerification
    }
  } catch (error) {
    logger.error('Quick verification check failed:', error)
    return { isVerified: false, status: 'Error', canFix: false }
  }
}

// Add to window for easy access in browser console
if (typeof window !== 'undefined') {
  (window as Window & { deviceVerification?: Record<string, unknown> }).deviceVerification = {
    test: testAndFixDeviceVerification,
    check: quickVerificationCheck
  }

  console.log('🔧 Device verification tools available at window.deviceVerification')
}
