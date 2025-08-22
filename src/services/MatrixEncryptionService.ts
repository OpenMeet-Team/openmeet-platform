/**
 * Matrix Encryption Service
 *
 * Unified encryption service following Element Web's proven patterns.
 * Handles secret storage AND cross-signing atomically to prevent key conflicts.
 *
 * Replaces:
 * - MatrixCrossSigningAuthService.ts
 * - MatrixSecretStorageService.ts
 * - matrixEncryptionBootstrapService.ts
 */

import type { MatrixClient, AuthDict } from 'matrix-js-sdk'
import { encodeRecoveryKey, decodeRecoveryKey, deriveRecoveryKeyFromPassphrase } from 'matrix-js-sdk/lib/crypto-api'
import { logger } from '../utils/logger'
import {
  setSecretStorageBeingAccessed,
  cacheSecretStorageKeyForBootstrap,
  clearSecretStorageCache
} from './MatrixClientManager'

export interface EncryptionResult {
  success: boolean
  error?: string
  recoveryKey?: string
}

export interface EncryptionStatus {
  isReady: boolean
  needsSetup: boolean
  hasSecretStorage: boolean
  hasCrossSigningKeys: boolean
  deviceVerified: boolean
  canDecryptHistory: boolean
}

/**
 * Unified Matrix encryption service following Element Web's architecture
 */
export class MatrixEncryptionService {
  private matrixClient: MatrixClient
  private operationInProgress = false

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient

    // Check for pending MAS redirect flows on initialization
    this.checkPendingMASRedirect()
  }

  /**
   * Element Web's withSecretStorageKeyCache pattern - now using global cache
   */
  private async withSecretStorageKeyCache<T> (operation: () => Promise<T>): Promise<T> {
    logger.debug('🔧 Starting operation with global secret storage cache')
    this.operationInProgress = true
    setSecretStorageBeingAccessed(true)
    try {
      return await operation()
    } finally {
      logger.debug('🔧 Clearing global secret storage cache')
      this.operationInProgress = false
      setSecretStorageBeingAccessed(false)
      clearSecretStorageCache()
    }
  }

  /**
   * Check current encryption status
   */
  async getStatus (): Promise<EncryptionStatus> {
    try {
      // Guard against getCrypto not being available (client not fully initialized)
      if (!this.matrixClient || typeof this.matrixClient.getCrypto !== 'function') {
        return {
          isReady: false,
          needsSetup: true,
          hasSecretStorage: false,
          hasCrossSigningKeys: false,
          hasKeyBackup: false,
          errors: ['Matrix client crypto not available']
        }
      }

      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          isReady: false,
          needsSetup: true,
          hasSecretStorage: false,
          hasCrossSigningKeys: false,
          deviceVerified: false,
          canDecryptHistory: false
        }
      }

      const [hasSecretStorage, hasCrossSigningKeys] = await Promise.all([
        crypto.isSecretStorageReady().catch(() => false),
        crypto.isCrossSigningReady().catch(() => false)
      ])

      let deviceVerified = false
      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      if (userId && deviceId) {
        try {
          const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
          deviceVerified = deviceStatus?.isVerified() || false
        } catch (error) {
          logger.debug('Could not get device verification status:', error)
        }
      }

      const isReady = hasSecretStorage && hasCrossSigningKeys && deviceVerified
      const canDecryptHistory = isReady

      return {
        isReady,
        needsSetup: !isReady,
        hasSecretStorage,
        hasCrossSigningKeys,
        deviceVerified,
        canDecryptHistory
      }
    } catch (error) {
      logger.error('Failed to get encryption status:', error)
      return {
        isReady: false,
        needsSetup: true,
        hasSecretStorage: false,
        hasCrossSigningKeys: false,
        deviceVerified: false,
        canDecryptHistory: false
      }
    }
  }

  /**
   * Setup encryption with passphrase - Element Web's accessSecretStorage pattern
   */
  async setupEncryption (passphrase?: string): Promise<EncryptionResult> {
    return this.withSecretStorageKeyCache(async () => {
      try {
        logger.debug('🔧 Starting encryption setup')
        const crypto = this.matrixClient.getCrypto()
        if (!crypto) {
          return { success: false, error: 'Crypto not available' }
        }

        // Check what we need to do
        const status = await this.getStatus()

        if (status.isReady) {
          logger.debug('✅ Encryption already ready')
          return { success: true }
        }

        // Check if secret storage exists but we need to unlock it
        const hasKey = await this.matrixClient.secretStorage.hasKey()
        if (hasKey && !status.hasSecretStorage && passphrase) {
          logger.debug('🔓 Secret storage exists, attempting unlock')
          return this.unlockExistingStorage(passphrase)
        }

        // Bootstrap fresh setup - Element Web style with auto-generated recovery key
        logger.debug('🔧 Bootstrapping fresh encryption setup')
        return this.bootstrapFreshSetup()
      } catch (error) {
        logger.error('❌ Encryption setup failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
  }

  /**
   * Bootstrap fresh encryption setup - Element Web's approach
   */
  private async bootstrapFreshSetup (): Promise<EncryptionResult> {
    const crypto = this.matrixClient.getCrypto()!

    // Generate recovery key automatically (Element Web approach - no passphrase needed)
    logger.debug('🔑 Creating fresh recovery key')
    const recoveryKeyInfo = await crypto.createRecoveryKeyFromPassphrase()

    if (!recoveryKeyInfo) {
      throw new Error('Failed to create recovery key')
    }

    logger.debug('🔑 Recovery key created successfully')

    // Cache the recovery key in global cache for the bootstrap process (Element Web pattern)
    // Use temporary key ID for fresh setup - actual key ID will be assigned during bootstrap
    const tempKeyId = 'temp_bootstrap_key'
    const cachedKeyData = this.extractRecoveryKey(recoveryKeyInfo)
    cacheSecretStorageKeyForBootstrap(tempKeyId, { algorithm: 'm.secret_storage.v1.aes-hmac-sha2' }, cachedKeyData)

    // Element Web's sequential approach with secret storage key cache
    logger.debug('🔧 Using Element Web bootstrap pattern with secret storage cache')

    // Cache the recovery key for the bootstrap process
    const cachedRecoveryKey = recoveryKeyInfo

    // Use Element Web's withSecretStorageKeyCache pattern
    const { withSecretStorageKeyCache } = await import('./MatrixClientManager')

    await withSecretStorageKeyCache(async () => {
      logger.debug('🔑 Starting Element Web bootstrap sequence...')

      // Step 1: Bootstrap cross-signing first (Element Web pattern)
      logger.debug('🔧 Step 1: Bootstrapping cross-signing...')
      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: this.createAuthCallback(),
        setupNewCrossSigning: true
      })
      logger.debug('✅ Cross-signing bootstrap completed')

      // Step 2: Bootstrap secret storage second (Element Web pattern)
      logger.debug('🔧 Step 2: Bootstrapping secret storage...')
      await crypto.bootstrapSecretStorage({
        createSecretStorageKey: async () => {
          logger.debug('🔑 createSecretStorageKey callback - returning recovery key object')
          return cachedRecoveryKey
        },
        setupNewSecretStorage: true,
        setupNewKeyBackup: true
      })
      logger.debug('✅ Secret storage bootstrap completed')

      // Step 3: Device verification within secret storage cache
      try {
        logger.debug('🔐 Step 3: Device self-verification with secret storage access...')
        const { testAndFixDeviceVerification } = await import('../utils/deviceVerificationHelper')
        const verificationResult = await testAndFixDeviceVerification()

        if (verificationResult.success && verificationResult.isVerified) {
          logger.debug('✅ Device self-verification completed successfully')
        } else {
          logger.warn('⚠️ Device self-verification incomplete:', verificationResult.error)
        }
      } catch (verificationError) {
        logger.warn('⚠️ Device self-verification failed (non-fatal):', verificationError)
      }
    })

    logger.debug('✅ Element Web encryption pattern completed successfully')

    // Extract and encode the recovery key for display to user
    const recoveryKeyData = this.extractRecoveryKey(recoveryKeyInfo)
    const encodedRecoveryKey = encodeRecoveryKey(recoveryKeyData)
    logger.debug('✅ Encryption setup completed')

    return {
      success: true,
      recoveryKey: encodedRecoveryKey
    }
  }

  /**
   * Unlock existing secret storage - Element Web pattern
   */
  private async unlockExistingStorage (passphrase: string): Promise<EncryptionResult> {
    try {
      logger.debug('🔓 Unlocking existing secret storage')
      const crypto = this.matrixClient.getCrypto()!

      // Get the default key info
      const defaultKeyId = await this.matrixClient.secretStorage.getDefaultKeyId()
      if (!defaultKeyId) {
        throw new Error('No default secret storage key found')
      }

      const keyInfo = await this.getSecretStorageKeyInfo(defaultKeyId)
      if (!keyInfo) {
        throw new Error('Could not get secret storage key info')
      }

      // Derive key from passphrase or try as recovery key
      let recoveryKey: Uint8Array
      try {
        // Try as passphrase first
        const keyInfoTyped = keyInfo as { passphrase?: { salt: Uint8Array, iterations: number } }
        const salt = keyInfoTyped.passphrase?.salt
        const saltString = salt instanceof Uint8Array ? Buffer.from(salt).toString('base64') : (salt || Buffer.from(new Uint8Array(32)).toString('base64'))

        recoveryKey = await deriveRecoveryKeyFromPassphrase(
          passphrase,
          saltString,
          keyInfoTyped.passphrase?.iterations || 500000
        )
      } catch (error) {
        // Try as recovery key instead of passphrase
        try {
          recoveryKey = decodeRecoveryKey(passphrase)
        } catch (decodeError) {
          throw new Error('Invalid passphrase or recovery key')
        }
      }

      // Test the key works - casting is needed as we get keyInfo from SDK
      // @ts-expect-error - SDK typing mismatch for dynamic key info
      const isValid = await this.matrixClient.secretStorage.checkKey(recoveryKey, keyInfo)
      if (!isValid) {
        throw new Error('Invalid passphrase or recovery key')
      }

      // Cache the key for operations using global cache
      cacheSecretStorageKeyForBootstrap(defaultKeyId, keyInfo, recoveryKey)

      // Bootstrap cross-signing if needed
      const crossSigningReady = await crypto.isCrossSigningReady()
      if (!crossSigningReady) {
        logger.debug('🔧 Cross-signing not ready, bootstrapping')
        await crypto.bootstrapCrossSigning({
          authUploadDeviceSigningKeys: this.createAuthCallback()
        })
      }

      // Verify device if needed
      const userId = this.matrixClient.getUserId()!
      const deviceId = this.matrixClient.getDeviceId()!
      const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)

      if (!deviceStatus?.isVerified()) {
        await this.verifyFirstDevice()
      }

      logger.debug('✅ Existing storage unlocked successfully')
      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to unlock existing storage:', error)

      if (error.message.includes('Invalid passphrase')) {
        return {
          success: false,
          error: 'Invalid passphrase or recovery key'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlock encryption'
      }
    }
  }

  /**
   * Reset encryption completely - Element Web pattern
   */
  async resetEncryption (): Promise<EncryptionResult> {
    try {
      logger.debug('🔄 Resetting encryption completely')
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { success: false, error: 'Crypto not available' }
      }

      // Reset everything - Element Web's resetEncryption pattern
      await crypto.resetEncryption(async () => {
        logger.debug('🔄 Encryption reset callback executed')
      })

      logger.debug('✅ Encryption reset completed')
      return { success: true }
    } catch (error) {
      logger.error('❌ Encryption reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reset failed'
      }
    }
  }

  /**
   * Extract recovery key from Matrix SDK response
   */
  private extractRecoveryKey (recoveryKeyInfo: unknown): Uint8Array {
    if (recoveryKeyInfo instanceof Uint8Array) {
      return recoveryKeyInfo
    }

    if (recoveryKeyInfo && typeof recoveryKeyInfo === 'object') {
      const keyObj = recoveryKeyInfo as { key?: Uint8Array, privateKey?: Uint8Array }
      if (keyObj.key instanceof Uint8Array) {
        return keyObj.key
      }
      if (keyObj.privateKey instanceof Uint8Array) {
        return keyObj.privateKey
      }
    }

    throw new Error('Could not extract recovery key from Matrix SDK response')
  }

  /**
   * Get secret storage key info from account data
   */
  private async getSecretStorageKeyInfo (keyId: string): Promise<unknown> {
    try {
      const event = await this.matrixClient.getAccountData(`m.secret_storage.key.${keyId}`)
      return event?.getContent() || null
    } catch (error) {
      logger.debug('Could not get secret storage key info:', error)
      return null
    }
  }

  /**
   * Create auth callback for cross-signing device key upload
   */
  private createAuthCallback () {
    return async (makeRequest: (auth: AuthDict | null) => Promise<void>) => {
      try {
        // Try with no auth first
        await makeRequest(null)
      } catch (error: unknown) {
        logger.debug('🔧 Initial auth failed, checking UIA flows:', error)

        // Check if this is a UIA error with available flows
        const matrixError = error as { data?: { flows?: unknown[], session?: string } }
        if (matrixError?.data?.flows && Array.isArray(matrixError.data.flows)) {
          const flows = matrixError.data.flows
          const session = matrixError.data.session
          logger.debug('🔧 Available UIA flows:', flows)
          logger.debug('🔧 UIA flows detailed structure:', JSON.stringify(flows, null, 2))
          logger.debug('🔧 UIA session:', session)
          logger.debug('🔧 Full UIA error data:', JSON.stringify(matrixError.data, null, 2))

          // Try each available flow type
          for (const flow of flows) {
            const uiaFlow = flow as { stages?: string[], params?: Record<string, Record<string, unknown>> }
            logger.debug('🔧 Flow structure:', JSON.stringify(uiaFlow, null, 2))
            if (uiaFlow.stages && Array.isArray(uiaFlow.stages)) {
              for (const stage of uiaFlow.stages) {
                logger.debug(`🔧 Attempting UIA stage: ${stage}`)

                // Check for stage-specific parameters (especially for org.matrix.cross_signing_reset)
                const stageParams = uiaFlow.params?.[stage]
                if (stageParams) {
                  logger.debug(`🔧 Stage parameters for ${stage}:`, JSON.stringify(stageParams, null, 2))
                }

                try {
                  let authData: AuthDict

                  // Handle different auth stage types
                  switch (stage) {
                    case 'm.login.password':
                      // Skip password auth for device signing - not applicable
                      continue

                    case 'm.login.dummy':
                      // Dummy auth - just provide session
                      authData = {
                        type: 'm.login.dummy',
                        session
                      }
                      break

                    case 'm.login.token': {
                      // Access token auth with fallback to refresh
                      let accessToken = this.matrixClient.getAccessToken()
                      logger.debug('🔧 Using access token for UIA auth')

                      if (!accessToken) {
                        logger.debug('🔧 No access token, attempting token refresh...')
                        try {
                          // Force token refresh if no access token
                          const refreshToken = this.matrixClient.getRefreshToken()
                          if (refreshToken) {
                            await this.matrixClient.refreshToken(refreshToken)
                          }
                          accessToken = this.matrixClient.getAccessToken()
                          logger.debug('🔧 Token refreshed successfully')
                        } catch (refreshError) {
                          logger.warn('⚠️ Token refresh failed:', refreshError)
                          continue
                        }
                      }

                      if (!accessToken) {
                        logger.debug('🔧 Still no access token after refresh, skipping m.login.token')
                        continue
                      }

                      authData = {
                        type: 'm.login.token',
                        token: accessToken,
                        session
                      }
                      break
                    }

                    case 'org.matrix.cross_signing_reset':
                      // Cross-signing reset auth requires user interaction with MAS interface
                      // Implement Element Web's popup pattern for MAS approval
                      logger.debug('🔧 Handling cross-signing reset auth stage')
                      logger.debug('🔧 Session for cross-signing reset:', session)

                      if (stageParams?.url && typeof stageParams.url === 'string') {
                        logger.debug('🔧 Cross-signing reset requires MAS approval at:', stageParams.url)

                        // Use Element Web's popup pattern for MAS approval
                        await this.handleMASCrossSigningReset(stageParams.url)

                        // Small delay to allow MAS backend to process approval
                        await new Promise(resolve => setTimeout(resolve, 1000))

                        // After user approval, continue with auth
                        logger.debug('🔧 MAS approval completed, proceeding with cross-signing reset auth')
                      } else {
                        logger.warn('⚠️ No URL provided for cross-signing reset by MAS')
                        logger.debug('🔧 Attempting to construct MAS approval URL manually')

                        // Fallback: construct MAS approval URL manually
                        const masBaseUrl = this.matrixClient.getHomeserverUrl().replace('matrix', 'mas')
                        const fallbackUrl = `${masBaseUrl}/account?action=org.matrix.cross_signing_reset`

                        logger.debug('🔧 Using fallback MAS approval URL:', fallbackUrl)
                        await this.handleMASCrossSigningReset(fallbackUrl)

                        // Longer delay for manual approval flow
                        await new Promise(resolve => setTimeout(resolve, 2000))

                        logger.debug('🔧 Fallback MAS approval flow completed')
                      }

                      // Check if we have a dummy session and need to retry for real session
                      if (session === 'dummy') {
                        logger.warn('⚠️ Received dummy UIA session - this may indicate MAS configuration issue')
                        logger.debug('🔧 Attempting to proceed with dummy session anyway')
                      }

                      authData = { type: stage, session }
                      logger.debug('🔧 Auth data being submitted:', JSON.stringify(authData, null, 2))
                      break

                    default:
                      // Unknown auth type, skip
                      logger.debug(`🔧 Unknown auth stage type: ${stage}`)
                      continue
                  }

                  // Attempt auth with this stage
                  await makeRequest(authData)
                  logger.debug(`✅ UIA successful with stage: ${stage}`)
                  return
                } catch (stageError: unknown) {
                  logger.debug(`❌ UIA stage ${stage} failed:`, stageError)
                  // Continue to next stage
                }
              }
            }
          }

          // If we get here, all UIA flows failed
          logger.error('❌ All UIA flows failed for device signing key upload')
          throw new Error('Device signing key upload requires authentication - all flows failed')
        } else {
          // Not a UIA error, re-throw
          throw error
        }
      }
    }
  }

  /**
   * Check for pending MAS redirect flows when page loads
   */
  private checkPendingMASRedirect (): void {
    try {
      const storedState = sessionStorage.getItem('mas_redirect_state')
      if (!storedState) return

      const state = JSON.parse(storedState)
      const timeSinceRedirect = Date.now() - state.timestamp

      // Check if this is a recent redirect (within 10 minutes)
      if (timeSinceRedirect < 600000 && state.flow === 'cross-signing-reset') {
        logger.debug('🔧 Detected return from MAS redirect - user may have completed approval')

        // Clear the stored state
        sessionStorage.removeItem('mas_redirect_state')

        // Check URL parameters for success/error indicators
        const urlParams = new URLSearchParams(window.location.search)
        const error = urlParams.get('error')

        if (error) {
          logger.warn('⚠️ MAS redirect returned with error:', error)
        } else {
          logger.debug('✅ MAS redirect completed - user likely approved cross-signing reset')

          // Optionally trigger encryption setup automatically
          // This could be done with a small delay to allow page to settle
          setTimeout(() => {
            logger.debug('🔧 Auto-triggering encryption setup after MAS redirect')
            // Could call setupEncryption here if desired
          }, 2000)
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error checking pending MAS redirect:', error)
    }
  }

  /**
   * Handle MAS cross-signing reset with mobile-friendly approach
   */
  private async handleMASCrossSigningReset (approvalUrl: string): Promise<void> {
    logger.debug('🔧 Starting MAS approval for cross-signing reset')

    // Check if we're on mobile or if user prefers full-page redirect
    const isMobile = this.isMobileDevice()
    const preferFullPage = this.shouldUseFullPageRedirect()

    if (isMobile || preferFullPage) {
      // Mobile-friendly: Use full-page redirect (Element Web SSO pattern)
      return this.handleMASRedirectFullPage(approvalUrl)
    } else {
      // Desktop: Try popup first, fallback to full-page if blocked
      return this.handleMASRedirectWithFallback(approvalUrl)
    }
  }

  /**
   * Check if we're on a mobile device
   */
  private isMobileDevice (): boolean {
    // Check screen size and user agent
    const isMobileScreen = window.innerWidth <= 768 || window.innerHeight <= 600
    const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    return isMobileScreen || isMobileUA || isTouchDevice
  }

  /**
   * Check if we should use full-page redirect
   */
  private shouldUseFullPageRedirect (): boolean {
    // Check localStorage preference or other factors
    const userPreference = localStorage.getItem('mas_redirect_preference')
    return userPreference === 'fullpage'
  }

  /**
   * Handle MAS approval using full-page redirect (mobile-friendly)
   */
  private async handleMASRedirectFullPage (approvalUrl: string): Promise<void> {
    return new Promise(() => {
      logger.debug('🔧 Using full-page redirect for MAS approval (mobile-friendly)')

      // Store current state for restoration after redirect
      const currentState = {
        flow: 'cross-signing-reset',
        timestamp: Date.now(),
        returnUrl: window.location.href
      }
      sessionStorage.setItem('mas_redirect_state', JSON.stringify(currentState))

      // Add return URL parameter to MAS approval URL
      const masUrl = new URL(approvalUrl)
      masUrl.searchParams.set('return_url', window.location.href)

      logger.debug('🔧 Redirecting to MAS for approval:', masUrl.toString())

      // Full-page redirect (Element Web pattern)
      window.location.href = masUrl.toString()

      // Note: This promise won't resolve in the current page context
      // The flow continues when user returns from MAS
    })
  }

  /**
   * Handle MAS approval with popup and fallback (desktop)
   */
  private async handleMASRedirectWithFallback (approvalUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug('🔧 Attempting popup for MAS approval (desktop)')

      // Try to open popup with mobile-friendly dimensions
      const popup = window.open(
        approvalUrl,
        'mas_approval',
        'width=400,height=600,scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no,location=no'
      )

      if (!popup) {
        logger.warn('⚠️ Popup blocked - falling back to full-page redirect')
        // Fallback to full-page redirect
        return this.handleMASRedirectFullPage(approvalUrl).then(resolve).catch(reject)
      }

      // Mobile-friendly popup handling
      let hasResolved = false

      // Listen for popup completion
      const checkClosed = setInterval(() => {
        if (popup.closed && !hasResolved) {
          clearInterval(checkClosed)
          hasResolved = true
          logger.debug('✅ MAS approval popup closed - assuming user completed approval')
          resolve()
        }
      }, 1000)

      // Listen for message from popup
      const messageHandler = (event: MessageEvent) => {
        if (event.source === popup && event.data === 'authDone' && !hasResolved) {
          clearInterval(checkClosed)
          window.removeEventListener('message', messageHandler)
          popup.close()
          hasResolved = true
          logger.debug('✅ Received authDone message from MAS approval popup')
          resolve()
        }
      }

      window.addEventListener('message', messageHandler)

      // Shorter timeout for better UX
      setTimeout(() => {
        if (!hasResolved) {
          clearInterval(checkClosed)
          window.removeEventListener('message', messageHandler)
          if (!popup.closed) {
            popup.close()
          }
          hasResolved = true
          logger.warn('⚠️ MAS approval popup timeout - proceeding anyway')
          resolve() // Don't reject on timeout
        }
      }, 180000) // 3 minutes (shorter than before)
    })
  }

  /**
   * Verify first device and ensure cross-signing verification
   */
  private async verifyFirstDevice (): Promise<void> {
    try {
      const crypto = this.matrixClient.getCrypto()!
      const userId = this.matrixClient.getUserId()!
      const deviceId = this.matrixClient.getDeviceId()!

      logger.debug('🔐 Verifying first device as trust anchor')

      // Mark device as locally verified first
      await crypto.setDeviceVerified(userId, deviceId, true)

      // Check if cross-signing is ready for device signing
      const crossSigningReady = await crypto.isCrossSigningReady()
      if (crossSigningReady) {
        logger.debug('🔐 Cross-signing ready, attempting to cross-sign device')

        try {
          // Cross-sign the device with our self-signing key
          await crypto.setDeviceVerified(userId, deviceId, true)
          logger.debug('🔐 Device cross-signed successfully')
        } catch (crossSignError) {
          logger.warn('⚠️ Cross-signing device failed:', crossSignError)
        }
      } else {
        logger.warn('⚠️ Cross-signing not ready, device will be locally verified only')
      }

      // Wait for verification status to update
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check final verification status
      const status = await crypto.getDeviceVerificationStatus(userId, deviceId)
      logger.debug('🔍 Final device verification status:', {
        isVerified: status?.isVerified(),
        localVerified: status?.localVerified,
        crossSigningVerified: status?.crossSigningVerified,
        signedByOwner: status?.signedByOwner
      })

      // If cross-signing verification is still false, log a warning
      if (status && !status.crossSigningVerified) {
        logger.warn('⚠️ Device is locally verified but not cross-signing verified')
        logger.warn('⚠️ This may be due to device signing key upload failure')
      }
    } catch (error) {
      logger.error('❌ Device verification failed:', error)
      // Don't throw - verification failure shouldn't break setup
    }
  }

  /**
   * Initialize encryption in background (for component compatibility)
   */
  async initializeEncryptionBackground (): Promise<boolean> {
    try {
      const status = await this.getStatus()
      return status.isReady
    } catch (error) {
      logger.error('Background encryption initialization failed:', error)
      return false
    }
  }

  /**
   * Get encryption status (for component compatibility)
   */
  getEncryptionStatus () {
    return this.getStatus()
  }

  /**
   * Get detailed debug information about encryption status
   */
  async getDebugInfo (): Promise<Record<string, unknown>> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { error: 'Crypto not available' }
      }

      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()
      const status = await this.getStatus()

      let deviceStatus = null
      let crossSigningKeys = null

      if (userId && deviceId) {
        try {
          deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
          crossSigningKeys = await crypto.getCrossSigningKeyId()
        } catch (error) {
          logger.debug('Could not get detailed status:', error)
        }
      }

      return {
        userId,
        deviceId,
        status,
        deviceStatus: deviceStatus ? {
          isVerified: deviceStatus.isVerified(),
          localVerified: deviceStatus.localVerified,
          crossSigningVerified: deviceStatus.crossSigningVerified,
          signedByOwner: deviceStatus.signedByOwner
        } : null,
        crossSigningKeys,
        hasSecretStorageKey: await this.matrixClient.secretStorage.hasKey(),
        operationInProgress: this.operationInProgress
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationInProgress: this.operationInProgress
      }
    }
  }

  /**
   * Restore cross-signing keys from secret storage
   * This fixes the key clearing issue during sync
   */
  async restoreCrossSigningKeysFromStorage (): Promise<boolean> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        logger.warn('No crypto module available for key restoration')
        return false
      }

      logger.debug('🔄 Attempting to restore cross-signing keys from secret storage...')

      // Check current cross-signing status
      const status = await crypto.getCrossSigningStatus()
      const hasAllKeys = status.privateKeysCachedLocally.masterKey &&
                        status.privateKeysCachedLocally.selfSigningKey &&
                        status.privateKeysCachedLocally.userSigningKey

      if (hasAllKeys) {
        logger.debug('✅ Cross-signing keys already available')
        return true
      }

      logger.debug('🔧 Cross-signing keys missing - attempting restoration...')
      logger.debug('🔧 Current status:', {
        masterKey: status.privateKeysCachedLocally.masterKey,
        selfSigningKey: status.privateKeysCachedLocally.selfSigningKey,
        userSigningKey: status.privateKeysCachedLocally.userSigningKey
      })

      // Try to restore keys from secret storage
      // Note: This uses the existing secret storage cache system
      await crypto.bootstrapCrossSigning({
        setupNewCrossSigning: false, // Don't create new keys, restore existing
        authUploadDeviceSigningKeys: async (): Promise<void> => {
          logger.debug('🔧 Cross-signing key restoration - no auth needed for existing keys')
          // Empty auth for restoration
        }
      })

      // Verify restoration worked
      const newStatus = await crypto.getCrossSigningStatus()
      const restored = newStatus.privateKeysCachedLocally.masterKey &&
                      newStatus.privateKeysCachedLocally.selfSigningKey &&
                      newStatus.privateKeysCachedLocally.userSigningKey

      if (restored) {
        logger.debug('✅ Cross-signing keys successfully restored from secret storage')

        // After successful key restoration, verify the current device
        try {
          logger.debug('🔐 Starting device self-verification after key restoration...')
          const { testAndFixDeviceVerification } = await import('../utils/deviceVerificationHelper')
          const verificationResult = await testAndFixDeviceVerification()

          if (verificationResult.success && verificationResult.isVerified) {
            logger.debug('✅ Device self-verification completed after key restoration')
          } else {
            logger.warn('⚠️ Device self-verification incomplete after key restoration:', verificationResult.error)
          }
        } catch (verificationError) {
          logger.warn('⚠️ Device self-verification failed after key restoration (non-fatal):', verificationError)
        }
      } else {
        logger.warn('⚠️ Cross-signing key restoration did not complete all keys')
      }

      return restored
    } catch (error) {
      logger.warn('Failed to restore cross-signing keys from secret storage:', error)
      return false
    }
  }

  /**
   * Handle cross-signing key loss during sync
   * This is called when the Rust SDK clears keys due to DiffResult inconsistencies
   */
  async handleCrossSigningKeyLoss (): Promise<boolean> {
    try {
      logger.warn('🚨 Detected cross-signing key loss - attempting recovery')

      // First, try to restore from secret storage
      const restored = await this.restoreCrossSigningKeysFromStorage()
      if (restored) {
        logger.debug('✅ Cross-signing keys recovered from secret storage')
        return true
      }

      // If restoration fails, check if we have secret storage setup
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) return false

      const hasSecretStorage = await this.matrixClient.secretStorage.hasKey()
      if (!hasSecretStorage) {
        logger.warn('❌ No secret storage available - full encryption re-setup required')
        return false // Require user to re-setup encryption
      }

      logger.warn('⚠️ Cross-signing key recovery failed - may need user interaction')
      return false
    } catch (error) {
      logger.error('Failed to handle cross-signing key loss:', error)
      return false
    }
  }
}

// Export both class and singleton for flexibility
export const matrixEncryptionService = new MatrixEncryptionService(
  // Will be injected when created by components
  {} as MatrixClient
)
