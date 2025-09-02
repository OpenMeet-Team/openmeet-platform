/**
 * Create Cross-Signing Keys
 *
 * Based on Element Web's proven patterns for reliable cross-signing setup.
 * Replaces our complex MAS handling with Element's simple approach.
 */

import type { MatrixClient, AuthDict } from 'matrix-js-sdk'
import { MatrixError } from 'matrix-js-sdk'

// Type definitions for UIA flows and parameters
interface UIAFlow {
  stages?: string[]
}

interface UIAData {
  flows?: UIAFlow[]
  session?: string
  params?: Record<string, unknown>
}

interface MASResetParams {
  url?: string
}

interface MatrixErrorData extends UIAData {
  flows?: UIAFlow[]
  session?: string
  params?: Record<string, unknown>
}
import { logger } from '../utils/logger'
import { Dialog, Notify } from 'quasar'

/**
 * Ensures that cross signing keys are created and uploaded for the user.
 * The homeserver may require user-interactive auth to upload the keys, in
 * which case the user will be prompted to authenticate via mobile-friendly dialogs.
 *
 * This function does not set up backups of the created cross-signing keys
 * (or message keys): the cross-signing keys are stored locally and will be
 * lost requiring a crypto reset, if the user logs out or loses their session.
 *
 * Based on Element Web's CreateCrossSigning.ts
 *
 * @param cli The Matrix Client to use
 * @param forceNew If true, forces creation of new cross-signing keys even if some exist
 */
export async function createCrossSigning (cli: MatrixClient, forceNew = false): Promise<void> {
  const cryptoApi = cli.getCrypto()
  if (!cryptoApi) {
    throw new Error('No crypto API found!')
  }

  logger.debug('🔐 Starting cross-signing bootstrap (Element Web pattern)')

  const bootstrapOptions: Parameters<typeof cryptoApi.bootstrapCrossSigning>[0] = {
    authUploadDeviceSigningKeys: (makeRequest) => uiAuthCallback(cli, makeRequest)
  }

  // If we're forcing new keys (e.g., due to corrupted existing keys), use setupNewCrossSigning
  if (forceNew) {
    logger.debug('🔄 Forcing creation of new cross-signing keys')
    bootstrapOptions.setupNewCrossSigning = true
  }

  await cryptoApi.bootstrapCrossSigning(bootstrapOptions)

  logger.debug('✅ Cross-signing bootstrap completed successfully')
}

/**
 * UI Auth callback that handles user authentication for device signing key upload.
 * Uses mobile-friendly Quasar dialogs instead of Element's React components.
 *
 * Based on Element Web's uiAuthCallback but adapted for Vue/Quasar mobile-first UI.
 */
export async function uiAuthCallback (
  matrixClient: MatrixClient,
  makeRequest: (authData: AuthDict | null) => Promise<void>,
  context: 'first_time_setup' | 'device_reset' = 'device_reset'
): Promise<void> {
  logger.debug('🔐 UI Auth callback invoked for device signing key upload', { context })

  try {
    // First try with no auth - many servers don't require additional auth
    logger.debug('🔐 Attempting device signing key upload without additional auth')
    await makeRequest(null)
    logger.debug('✅ Device signing key upload successful without additional auth')
  } catch (error) {
    logger.debug('🔍 Error caught in uiAuthCallback:', {
      isMatrixError: error instanceof MatrixError,
      hasData: !!(error as unknown as { data?: unknown })?.data,
      hasFlows: !!(error as unknown as { data?: { flows?: unknown } })?.data?.flows,
      error
    })

    if (!(error instanceof MatrixError) || !error.data || !error.data.flows) {
      // Not a UIA response - re-throw original error
      logger.debug('❌ Non-UIA error during device signing key upload:', error)
      throw error
    }

    logger.debug('🔐 UIA required for device signing key upload:', error.data.flows)

    // Handle UIA flows through mobile-friendly dialogs
    const authResult = await handleUIAFlows(matrixClient, error.data as MatrixErrorData, makeRequest, context)

    if (!authResult.confirmed) {
      throw new Error('Cross-signing key upload auth canceled')
    }

    logger.debug('✅ Device signing key upload completed with UIA')
  }
}

/**
 * Handle User-Interactive Authentication flows using mobile-optimized Quasar dialogs.
 * Supports common flows including SSO, password, and MAS cross-signing reset.
 */
async function handleUIAFlows (
  matrixClient: MatrixClient,
  uiaData: UIAData,
  makeRequest: (authData: AuthDict | null) => Promise<void>,
  context: 'first_time_setup' | 'device_reset' = 'device_reset'
): Promise<{ confirmed: boolean }> {
  logger.debug('🔐 Handling UIA flows for device signing:', {
    flows: uiaData.flows,
    session: uiaData.session,
    params: uiaData.params
  })

  // Check for MAS cross-signing reset flow
  const hasResetFlow = uiaData.flows?.some((flow: UIAFlow) =>
    flow.stages?.includes('org.matrix.cross_signing_reset')
  )

  // Skip MAS reset flow during first-time setup - only use it for actual device resets
  if (hasResetFlow && uiaData.params?.['org.matrix.cross_signing_reset'] && context === 'device_reset') {
    logger.debug('🔄 Using MAS cross-signing reset flow for device reset')
    return await handleMASCrossSigningReset(uiaData)
  } else if (hasResetFlow && context === 'first_time_setup') {
    logger.debug('⏭️ Skipping MAS cross-signing reset during first-time setup')
  }

  // Check for SSO flow
  const hasSSOFlow = uiaData.flows?.some((flow: UIAFlow) =>
    flow.stages?.includes('m.login.sso') || flow.stages?.includes('org.matrix.login.sso')
  )

  if (hasSSOFlow) {
    return await handleSSOAuth(matrixClient, uiaData, makeRequest)
  }

  // Check for password flow
  const hasPasswordFlow = uiaData.flows?.some((flow: UIAFlow) =>
    flow.stages?.includes('m.login.password')
  )

  if (hasPasswordFlow) {
    return await handlePasswordAuth(matrixClient, uiaData, makeRequest)
  }

  // Fallback: show generic dialog for unknown flows
  logger.warn('⚠️ Unknown UIA flow types:', uiaData.flows)
  return await handleGenericAuth(uiaData)
}

/**
 * Handle MAS cross-signing reset flow with mobile-optimized dialog
 */
async function handleMASCrossSigningReset (
  uiaData: UIAData
): Promise<{ confirmed: boolean }> {
  const resetParams = uiaData.params?.['org.matrix.cross_signing_reset'] as MASResetParams

  if (!resetParams.url) {
    logger.error('❌ No MAS reset URL provided in UIA response')
    throw new Error('MAS cross-signing reset URL not available')
  }

  logger.debug('🔐 MAS cross-signing reset required:', resetParams.url)

  return new Promise((resolve) => {
    Dialog.create({
      title: 'Cross-Signing Reset Required',
      message: 'To complete encryption setup, your cross-signing keys need to be reset in Matrix Account Service. After the reset is complete, return to this page to continue setup.',
      persistent: true,
      ok: {
        label: 'Continue',
        color: 'primary'
      },
      cancel: {
        label: 'Cancel',
        color: 'grey'
      }
    }).onOk(() => {
      logger.debug('🔗 Redirecting to MAS for cross-signing approval:', resetParams.url)

      // Store comprehensive state for return detection and reset completion
      sessionStorage.setItem('masAuthInProgress', 'device_signing')
      sessionStorage.setItem('masAuthOriginalUrl', window.location.href)

      // Store additional context about what reset operation was in progress
      const resetContext = {
        operation: 'reset_device_keys',
        timestamp: Date.now(),
        userInitiated: true
      }
      sessionStorage.setItem('masAuthResetContext', JSON.stringify(resetContext))

      // Redirect to MAS - user will need to manually return
      window.location.href = resetParams.url

      // This won't be reached due to redirect, but satisfy TypeScript
      resolve({ confirmed: true })
    }).onCancel(() => {
      logger.debug('🚫 User cancelled MAS cross-signing reset')
      resolve({ confirmed: false })
    })
  })
}

/**
 * Handle SSO authentication with mobile dialog
 */
async function handleSSOAuth (
  matrixClient: MatrixClient,
  uiaData: UIAData,
  makeRequest: (authData: AuthDict | null) => Promise<void>
): Promise<{ confirmed: boolean }> {
  logger.debug('🔐 SSO authentication required for device signing')

  return new Promise((resolve) => {
    Dialog.create({
      title: 'Single Sign-On Required',
      message: 'Please complete single sign-on authentication to continue with encryption setup.',
      persistent: true,
      ok: {
        label: 'Continue with SSO',
        color: 'primary'
      },
      cancel: 'Cancel'
    }).onOk(async () => {
      try {
        // Element Web pattern: provide SSO auth type
        await makeRequest({
          type: 'm.login.sso',
          session: uiaData.session
        })
        resolve({ confirmed: true })
      } catch (error) {
        logger.error('❌ SSO auth failed:', error)
        resolve({ confirmed: false })
      }
    }).onCancel(() => {
      resolve({ confirmed: false })
    })
  })
}

/**
 * Handle password authentication with mobile dialog
 */
async function handlePasswordAuth (
  matrixClient: MatrixClient,
  uiaData: UIAData,
  makeRequest: (authData: AuthDict | null) => Promise<void>
): Promise<{ confirmed: boolean }> {
  logger.debug('🔐 Password authentication required for device signing')

  return new Promise((resolve) => {
    Dialog.create({
      title: 'Password Required',
      message: 'Please enter your account password to continue with encryption setup:',
      prompt: {
        model: '',
        type: 'password',
        placeholder: 'Password'
      },
      persistent: true,
      ok: 'Continue',
      cancel: 'Cancel'
    }).onOk(async (password: string) => {
      try {
        await makeRequest({
          type: 'm.login.password',
          user: matrixClient.getUserId(),
          password,
          session: uiaData.session
        })
        resolve({ confirmed: true })
      } catch (error) {
        logger.error('❌ Password auth failed:', error)
        Notify.create({
          type: 'negative',
          message: 'Password authentication failed',
          caption: 'Please check your password and try again'
        })
        resolve({ confirmed: false })
      }
    }).onCancel(() => {
      resolve({ confirmed: false })
    })
  })
}

/**
 * Handle generic/unknown auth flows
 */
async function handleGenericAuth (
  uiaData: UIAData
): Promise<{ confirmed: boolean }> {
  logger.debug('🔐 Generic auth flow required:', uiaData.flows)

  return new Promise((resolve) => {
    Dialog.create({
      title: 'Authentication Required',
      message: `Additional authentication is required to set up encryption. Flow types: ${uiaData.flows?.map((f: UIAFlow) => f.stages?.join(', ')).join(' or ')}`,
      persistent: true,
      ok: 'Continue',
      cancel: 'Cancel'
    }).onOk(() => {
      // For unknown flows, we'll need the calling code to handle them
      resolve({ confirmed: true })
    }).onCancel(() => {
      resolve({ confirmed: false })
    })
  })
}

/**
 * Check if we're returning from a MAS authentication flow
 * Only considers it a return if there's a URL parameter indicating actual MAS return
 */
export function checkMASAuthReturn (): { isReturn: boolean; flowType?: string; resetContext?: unknown } {
  const masAuthInProgress = sessionStorage.getItem('masAuthInProgress')
  const resetContextStr = sessionStorage.getItem('masAuthResetContext')
  const urlParams = new URLSearchParams(window.location.search)
  const hasCodeParam = urlParams.has('code') // OAuth2 authorization code from MAS
  const hasStateParam = urlParams.has('state') // OAuth2 state parameter

  // Treat as MAS return if we have OAuth2 parameters OR session storage flag with timestamp
  // This handles both OAuth2 redirect AND back button navigation
  const parsedResetContext = resetContextStr ? JSON.parse(resetContextStr) : null
  const isRecentReturn = parsedResetContext && (Date.now() - parsedResetContext.timestamp) < 300000 // 5 minutes

  if (masAuthInProgress && (hasCodeParam || hasStateParam || isRecentReturn)) {
    logger.debug('🔄 Detected return from MAS auth flow:', {
      flowType: masAuthInProgress,
      hasCodeParam,
      hasStateParam,
      isRecentReturn,
      currentUrl: window.location.href
    })

    // Use already parsed reset context
    const resetContext = parsedResetContext
    if (resetContext) {
      logger.debug('🔄 Found reset context:', resetContext)
    }

    // Clean up session storage
    sessionStorage.removeItem('masAuthInProgress')
    sessionStorage.removeItem('masAuthResetContext')

    return { isReturn: true, flowType: masAuthInProgress, resetContext }
  }

  // If session storage exists but no URL params, this is likely a repeated click
  // Clear the stale session storage to prevent confusion
  if (masAuthInProgress && !hasCodeParam && !hasStateParam) {
    logger.debug('🧹 Clearing stale MAS auth session storage (no URL params)')
    sessionStorage.removeItem('masAuthInProgress')
  }

  return { isReturn: false }
}
