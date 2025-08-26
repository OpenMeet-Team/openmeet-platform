/**
 * Simple Device Verification Service
 * Based on Element Web's proven patterns
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { logger } from '../utils/logger'

export interface SimpleVerificationResult {
  success: boolean
  isVerified: boolean
  error?: string
}

export class SimpleDeviceVerification {
  private matrixClient: MatrixClient

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
  }

  /**
   * Check if device needs verification
   * Element Web pattern: crossSigningReady && !crossSigningVerified
   */
  async needsVerification (): Promise<boolean> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) return false

      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()
      if (!userId || !deviceId) return false

      const crossSigningReady = await crypto.isCrossSigningReady()
      const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)

      // Element Web pattern: needs verification if cross-signing is ready but device isn't verified
      return crossSigningReady && !deviceStatus?.crossSigningVerified
    } catch (error) {
      logger.warn('Error checking verification status:', error)
      return false
    }
  }

  /**
   * Verify device using Element Web's simple approach
   */
  async verifyDevice (): Promise<SimpleVerificationResult> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { success: false, isVerified: false, error: 'Crypto not available' }
      }

      const deviceId = this.matrixClient.getDeviceId()
      const userId = this.matrixClient.getUserId()
      if (!deviceId || !userId) {
        return { success: false, isVerified: false, error: 'Device ID or User ID not available' }
      }

      // Check if we're returning from MAS approval
      const masApprovalInProgress = localStorage.getItem('masApprovalInProgress')
      
      if (masApprovalInProgress === 'true') {
        logger.debug('🔄 Detected return from MAS cross-signing reset')
        logger.debug('🔑 MAS has reset cross-signing identity - old recovery key is now invalid')
        
        // Clear the stored flags
        localStorage.removeItem('masApprovalInProgress')
        localStorage.removeItem('masUiaSession')
        
        // After MAS reset, we need to create NEW recovery key and bootstrap from scratch
        logger.debug('🆕 Creating new recovery key after MAS identity reset...')
        
        return {
          success: false,
          isVerified: false,
          error: 'MAS_RESET_COMPLETE_NEW_KEY_NEEDED'
        }
        
        // This signals to the calling code that MAS reset completed successfully
        // and now we need to generate a NEW recovery key (not ask for the old one)
      }

      logger.debug('🔑 Verifying device using Element Web pattern...')

      // First check if we're already verified before doing anything
      const initialVerificationStatus = await this.isVerified()
      if (initialVerificationStatus) {
        logger.debug('✅ Device is already verified!')
        return { success: true, isVerified: true }
      }

      // Element Web pattern: Wait for device info to be available first
      // This is a critical workaround from Element Web - ensures device keys are uploaded
      try {
        logger.debug('🔐 Loading device info (Element Web workaround for device key upload)...')
        await crypto.getUserDeviceInfo([userId])
        logger.debug('✅ Device info loaded successfully')
      } catch (error) {
        logger.debug('⚠️ Could not load device info:', error)
      }

      // Additional Element Web pattern: Ensure own device is in the device list
      try {
        const deviceMap = await crypto.getUserDeviceInfo([userId])
        const ownDevice = deviceMap.get(userId)?.get(deviceId)
        if (ownDevice) {
          logger.debug('✅ Own device found in device map:', {
            deviceId,
            verified: ownDevice.verified,
            crossSigningVerified: (ownDevice as any).crossSigningVerified
          })
        } else {
          logger.debug('⚠️ Own device not found in device map')
        }
      } catch (error) {
        logger.debug('⚠️ Could not check own device in device map:', error)
      }

      // Element Web Method 1: Force crossSignDevice (even if SDK thinks keys exist)
      try {
        logger.debug('🔐 Attempting to cross-sign device:', deviceId)

        // First, let's check the cross-signing key status
        try {
          const crossSigningStatus = await crypto.isCrossSigningReady()
          const masterKeyId = await (crypto as any).getCrossSigningKeyId('master')
          const selfSigningKeyId = await (crypto as any).getCrossSigningKeyId('self_signing')
          logger.debug('🔍 Cross-signing key status:', {
            ready: crossSigningStatus,
            masterKeyId: masterKeyId ? 'present' : 'missing',
            selfSigningKeyId: selfSigningKeyId ? 'present' : 'missing'
          })
        } catch (keyCheckError) {
          logger.debug('⚠️ Could not check cross-signing keys:', keyCheckError)
        }

        // Add timeout to prevent hanging
        const crossSignPromise = crypto.crossSignDevice(deviceId)
        const timeoutPromise = new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Cross-signing timeout after 5 seconds')), 5000)
        })

        await Promise.race([crossSignPromise, timeoutPromise])
        logger.debug('✅ Initial crossSignDevice call completed without error')

        // Give it more time to process the cross-signing
        await new Promise(resolve => setTimeout(resolve, 2000))

        if (await this.isVerified()) {
          logger.debug('✅ Device cross-signing successful!')
          return { success: true, isVerified: true }
        } else {
          logger.debug('⚠️ Initial crossSignDevice completed but device still not verified')
        }
      } catch (error) {
        logger.debug('❌ Initial crossSignDevice failed:', error)
      }

      // Element Web Method 2: Force device signing key upload by resetting cross-signing
      try {
        logger.debug('🔐 Attempting forced device signing key upload...')

        // The issue is that bootstrapCrossSigning skips device signing when keys exist
        // We need to force the device signing key upload to happen
        // Element Web approach: force a cross-signing reset to trigger device signing

        try {
          logger.debug('🔐 Forcing cross-signing bootstrap with setupNewCrossSigning: true...')
          const bootstrapResult = await crypto.bootstrapCrossSigning({
            setupNewCrossSigning: true, // Force recreation to trigger device signing
            authUploadDeviceSigningKeys: async (makeRequest) => {
              logger.debug('🔐 Auth callback invoked for forced device signing key upload')

              // Element Web pattern: provide UIA authentication for device signing
              try {
                logger.debug('🔐 Providing UIA authentication for device signing key upload...')

                // The device signing key upload requires MAS cross-signing reset approval
                // Based on our earlier analysis, we need to handle the UIA flow properly
                logger.debug('🔐 Attempting UIA makeRequest for device signing key upload...')

                // First try: use dummy auth to see what UIA flows are available
                await makeRequest({
                  type: 'm.login.dummy'
                })
                logger.debug('✅ UIA makeRequest completed successfully with dummy auth')
              } catch (authError: any) {
                logger.debug('🔐 Auth callback error (expected for MAS flow):', authError)

                // Check if this is a UIA flow error with MAS cross-signing reset requirement
                if (authError?.data?.flows) {
                  logger.debug('🔐 UIA flows detected:', authError.data.flows)

                  // Look for org.matrix.cross_signing_reset flow
                  const hasResetFlow = authError.data.flows.some((flow: any) =>
                    flow.stages?.includes('org.matrix.cross_signing_reset')
                  )

                  if (hasResetFlow && authError.data.params?.['org.matrix.cross_signing_reset']) {
                    logger.debug('⚠️ MAS cross-signing reset required - redirecting for approval')
                    logger.debug('🔐 UIA session:', authError.data.session)

                    const resetParams = authError.data.params['org.matrix.cross_signing_reset']
                    logger.debug('🔐 Reset params:', resetParams)

                    if (resetParams.url) {
                      logger.debug('🔗 MAS reset URL:', resetParams.url)

                      // Store the UIA session for resumption after MAS approval
                      const uiaSession = authError.data.session
                      logger.debug('💾 Storing UIA session for resumption:', uiaSession)

                      // Redirect main window to MAS for proper return flow
                      logger.debug('🚀 Redirecting main window to MAS for cross-signing reset approval')

                      // Store the UIA session for resumption after MAS approval
                      localStorage.setItem('masUiaSession', uiaSession)
                      localStorage.setItem('masApprovalInProgress', 'true')
                      logger.debug('💾 Stored UIA session in localStorage for resumption:', uiaSession)

                      // Add return URL parameter to ensure proper redirect back
                      const returnUrl = window.location.href
                      const masUrlWithReturn = resetParams.url + (resetParams.url.includes('?') ? '&' : '?') + 
                        `return_url=${encodeURIComponent(returnUrl)}`

                      logger.debug('🔗 Redirecting to MAS URL with return:', masUrlWithReturn)

                      // Redirect the main window - this will trigger proper return detection
                      window.location.href = masUrlWithReturn

                      // This code won't be reached due to redirect, but return for type safety
                      return {
                        success: false,
                        isVerified: false,
                        error: 'Redirecting to MAS for approval...'
                      }
                    } else {
                      logger.debug('❌ No reset URL provided in UIA response')
                    }
                  }
                } else {
                  logger.debug('🔐 Non-UIA auth error - proceeding with secret storage')
                }

                // The auth callback being present is what triggers the upload process
                // Even if auth fails, the Matrix SDK should proceed with secret storage
                logger.debug('🔐 Proceeding with secret storage after auth callback')
              }
            }
          })

          logger.debug('📋 Forced bootstrap result:', bootstrapResult)
        } catch (forceError) {
          logger.debug('❌ Forced bootstrap failed, trying standard approach:', forceError)

          // Fallback: try the standard Element Web approach
          logger.debug('🔐 Fallback: standard bootstrap with auth callback...')
          const bootstrapResult = await crypto.bootstrapCrossSigning({
            setupNewCrossSigning: false, // Use existing keys
            authUploadDeviceSigningKeys: async (makeRequest) => {
              logger.debug('🔐 Fallback auth callback invoked')
              try {
                await makeRequest({ type: 'm.login.dummy' })
                logger.debug('✅ Fallback UIA makeRequest completed')
              } catch (fallbackAuthError) {
                logger.debug('🔐 Fallback auth error (expected):', fallbackAuthError)
              }
            }
          })

          logger.debug('📋 Fallback bootstrap result:', bootstrapResult)
        }

        await new Promise(resolve => setTimeout(resolve, 1500))

        if (await this.isVerified()) {
          logger.debug('✅ Bootstrap verification successful!')
          return { success: true, isVerified: true }
        } else {
          logger.debug('⚠️ Bootstrap completed but device still not verified, trying manual cross-signing')

          // Force cross-sign the device after bootstrap
          try {
            logger.debug('🔐 Manual cross-signing after bootstrap...')

            // Add timeout to prevent hanging
            const crossSignPromise = crypto.crossSignDevice(deviceId)
            const timeoutPromise = new Promise((_resolve, reject) => {
              setTimeout(() => reject(new Error('Cross-signing timeout after 5 seconds')), 5000)
            })

            await Promise.race([crossSignPromise, timeoutPromise])
            logger.debug('✅ crossSignDevice call completed without error')

            // Give more time for the operation to complete
            await new Promise(resolve => setTimeout(resolve, 2000))

            if (await this.isVerified()) {
              logger.debug('✅ Manual cross-signing after bootstrap successful!')
              return { success: true, isVerified: true }
            } else {
              logger.debug('⚠️ Manual cross-signing completed but device still not verified')

              // Element Web Method 3: Try multiple signing approaches
              // Check if we have cross-signing ready but device not signed
              const crossSigningReady = await crypto.isCrossSigningReady()
              if (crossSigningReady) {
                logger.debug('🔐 Cross-signing is ready but device not verified - trying direct approaches...')

                // Approach 3a: Force verification through device trust
                try {
                  logger.debug('🔐 Attempting to trust own device explicitly...')
                  const deviceInfo = await crypto.getUserDeviceInfo([userId])
                  const ownDevice = deviceInfo.get(userId)?.get(deviceId)
                  if (ownDevice) {
                    logger.debug('🔐 Found own device, attempting to verify it...')

                    // Try to use internal verification methods if available
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if ('setDeviceVerified' in crypto) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      await (crypto as any).setDeviceVerified(userId, deviceId, true)
                      logger.debug('✅ Called setDeviceVerified')
                    }

                    // Also try marking it as locally verified
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if ('setLocalTrust' in ownDevice) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (ownDevice as any).setLocalTrust(true)
                      logger.debug('✅ Set local trust on device')
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000))

                    if (await this.isVerified()) {
                      logger.debug('✅ Direct device trust successful!')
                      return { success: true, isVerified: true }
                    }
                  }
                } catch (trustError) {
                  logger.debug('❌ Direct device trust failed:', trustError)
                }

                // Approach 3b: Force cross-signing with explicit device ID
                try {
                  logger.debug('🔐 Final attempt: explicit cross-sign with fresh device info...')

                  // Refresh device info first
                  await crypto.getUserDeviceInfo([userId], true) // force refresh

                  // Try cross-signing again with explicit parameters
                  await crypto.crossSignDevice(deviceId)
                  logger.debug('✅ Final cross-sign attempt completed')

                  await new Promise(resolve => setTimeout(resolve, 2000))

                  if (await this.isVerified()) {
                    logger.debug('✅ Final cross-signing attempt successful!')
                    return { success: true, isVerified: true }
                  }
                } catch (finalError) {
                  logger.debug('❌ Final cross-signing attempt failed:', finalError)
                }
              }
            }
          } catch (crossSignError) {
            logger.debug('❌ Manual cross-signing after bootstrap failed:', crossSignError)
          }
        }
      } catch (error) {
        logger.debug('Bootstrap failed:', error)
      }

      // Check if we're at least partially verified
      const isPartiallyVerified = await this.isVerified()
      if (isPartiallyVerified) {
        logger.debug('✅ Device appears to be verified now!')
        return { success: true, isVerified: true }
      }

      return {
        success: false,
        isVerified: false,
        error: 'Device verification methods failed'
      }
    } catch (error) {
      logger.error('Device verification error:', error)
      return {
        success: false,
        isVerified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check if device is verified (Element Web pattern)
   */
  private async isVerified (): Promise<boolean> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.debug('❌ No crypto available for verification check')
        return false
      }

      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()
      if (!userId || !deviceId) {
        logger.debug('❌ Missing userId or deviceId for verification check')
        return false
      }

      // Get comprehensive device verification status
      const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
      logger.debug('🔍 Device verification status:', {
        crossSigningVerified: deviceStatus?.crossSigningVerified,
        localVerified: deviceStatus?.localVerified,
        signedByOwner: deviceStatus?.signedByOwner
      })

      // Check cross-signing readiness
      const crossSigningReady = await crypto.isCrossSigningReady()
      logger.debug('🔍 Cross-signing ready:', crossSigningReady)

      // Element Web considers a device verified if it's cross-signing verified
      // OR if cross-signing is ready and the device is signed by owner
      const isVerified = deviceStatus?.crossSigningVerified ||
                        (crossSigningReady && deviceStatus?.signedByOwner)

      logger.debug('🔍 Final verification result:', {
        isVerified,
        crossSigningReady,
        deviceStatus: deviceStatus ? {
          crossSigningVerified: deviceStatus.crossSigningVerified,
          localVerified: deviceStatus.localVerified,
          signedByOwner: deviceStatus.signedByOwner
        } : null
      })

      return isVerified || false
    } catch (error) {
      logger.warn('Error checking verification status:', error)
      return false
    }
  }
}
