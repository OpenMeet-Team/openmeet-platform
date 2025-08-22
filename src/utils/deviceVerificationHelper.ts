/**
 * Device Verification Helper
 *
 * Simple utility to test and fix device self-verification issues
 */

import { matrixClientService } from '../services/matrixClientService'
import { MatrixDeviceSelfVerification } from '../services/MatrixDeviceSelfVerification'
import { logger } from './logger'

/**
 * Test and fix device verification
 */
export async function testAndFixDeviceVerification (): Promise<{
  success: boolean
  error?: string
  isVerified?: boolean
  debugInfo?: Record<string, unknown>
}> {
  try {
    console.log('🔍 Testing device verification...')

    const client = matrixClientService.getClient()
    if (!client) {
      console.error('❌ No Matrix client available')
      return { success: false, error: 'No Matrix client available' }
    }

    const selfVerification = new MatrixDeviceSelfVerification(client)

    // Get debug info
    const debugInfo = await selfVerification.getDebugInfo()
    console.log('🔍 Debug info:', debugInfo)

    // Check current status
    const status = await selfVerification.checkVerificationStatus()
    console.log('📊 Verification status:', status)

    if (status.isCrossSigningVerified) {
      console.log('✅ Device is already verified')
      return { success: true, isVerified: true, debugInfo }
    }

    if (!status.canSelfVerify) {
      console.log('❌ Cannot self-verify:', {
        hasSigningKeys: status.hasSigningKeys,
        canSelfVerify: status.canSelfVerify
      })
      return {
        success: false,
        error: 'Cannot self-verify - missing cross-signing keys or setup',
        debugInfo
      }
    }

    // Attempt comprehensive verification
    console.log('🔧 Attempting device verification...')
    const result = await selfVerification.comprehensiveVerification()

    console.log('📋 Verification result:', result)

    return {
      success: result.success,
      error: result.error,
      isVerified: result.isVerified,
      debugInfo
    }
  } catch (error) {
    console.error('❌ Device verification test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Quick verification status check
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

    const selfVerification = new MatrixDeviceSelfVerification(client)
    const status = await selfVerification.checkVerificationStatus()

    return {
      isVerified: status.isCrossSigningVerified,
      status: status.isCrossSigningVerified ? 'Verified'
        : status.canSelfVerify ? 'Can be verified' : 'Cannot verify',
      canFix: status.canSelfVerify && !status.isCrossSigningVerified
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
