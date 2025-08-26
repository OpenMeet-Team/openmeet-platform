/**
 * Device Verification Helper
 *
 * Simple utility to test and fix device self-verification issues
 */

import { matrixClientService } from '../services/matrixClientService'
import { SimpleDeviceVerification } from '../services/SimpleDeviceVerification'
import { logger } from './logger'

/**
 * Test and fix device verification using Element Web patterns
 */
export async function testAndFixDeviceVerification (): Promise<{
  success: boolean
  error?: string
  isVerified?: boolean
}> {
  try {
    console.log('🔍 Testing device verification using Element Web patterns...')

    const client = matrixClientService.getClient()
    if (!client) {
      console.error('❌ No Matrix client available')
      return { success: false, error: 'No Matrix client available' }
    }

    const deviceVerification = new SimpleDeviceVerification(client)

    // Check if verification is needed
    const needsVerification = await deviceVerification.needsVerification()
    console.log('📊 Needs verification:', needsVerification)

    if (!needsVerification) {
      console.log('✅ Device is already verified or verification not needed')
      return { success: true, isVerified: true }
    }

    // Attempt verification
    console.log('🔧 Attempting device verification...')
    const result = await deviceVerification.verifyDevice()

    console.log('📋 Verification result:', result)
    return result
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

    const deviceVerification = new SimpleDeviceVerification(client)
    const needsVerification = await deviceVerification.needsVerification()

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
