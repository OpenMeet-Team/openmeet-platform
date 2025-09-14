<template>
  <div class="matrix-native-chat-orchestrator">
    <!-- Matrix Connection Required -->
    <div v-if="needsLogin" class="connection-required">
      <div class="connection-container">
        <h2>Matrix Connection Required</h2>
        <p>Please connect to Matrix to access chat features.</p>
        <q-btn
          @click="connectToMatrix"
          color="primary"
          label="Connect to Matrix"
          icon="fas fa-link"
        />
      </div>
    </div>

    <!-- Chat Interface (Always render when logged in, regardless of encryption loading) -->
    <template v-else-if="!needsLogin">

      <!-- Loading State (within chat interface to prevent recreation) -->
      <div v-if="isLoading" class="loading-overlay q-pa-md q-mb-md text-center">
        <q-spinner size="2rem" />
        <p>Checking Matrix encryption status...</p>
      </div>

      <!-- Unified Encryption Banner -->
      <UnifiedEncryptionBanner
        :encryption-state="typedEncryptionStatus?.state || 'unknown'"
        :encryption-details="typedEncryptionStatus?.details"
        :warning-message="warningMessage"
        :recovery-key="createdRecoveryKey"
        :room-id="inlineRoomId"
        :setup-progress="setupProgress"
        :setup-in-progress="setupInProgress || creatingKey"
        :error-message="setupError"
        :error-details="setupErrorDetails"
        @setup-encryption="handleSetupEncryption"
        @verify-device="handleVerifyDevice"
        @forgot-recovery-key="handleForgotRecoveryKey"
        @key-confirmed="handleKeyConfirmed"
        @warning-action="handleEncryptionAction"
        @dismiss="dismissEncryptionBanner"
        @reset-device-keys="handleResetDeviceKeys"
      />

      <!-- Old banner logic removed - now handled by UnifiedEncryptionBanner above -->

      <!-- Device Verification Notification Banner -->
      <VerificationNotificationBanner
        ref="verificationBannerRef"
        @open-verification-dialog="showVerificationDialog = true"
      />

      <!-- Redundant banners removed - now handled by UnifiedEncryptionBanner -->

      <!-- Recovery Key Display removed - now handled by UnifiedEncryptionBanner with better styling -->
      <div v-if="false" class="recovery-key-success-banner q-pa-md q-mb-md" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px;">
        <div class="text-h6 q-mb-sm" style="color: #155724;">
          <q-icon name="fas fa-key" class="q-mr-sm" />
          Save Your Recovery Key
        </div>
        <p style="color: #155724; margin: 0 0 16px 0;">
          Your device encryption setup is complete! Please save this recovery key securely - you'll need it to recover encrypted messages if you lose access to your devices.
        </p>
        <div class="recovery-key-card">
          <div class="recovery-key-text">{{ createdRecoveryKey }}</div>
          <div class="recovery-key-actions q-mt-md">
            <q-btn
              flat
              color="primary"
              icon="fas fa-copy"
              label="Copy Key"
              @click="copyRecoveryKey"
              class="q-mr-sm"
            />
            <q-btn
              flat
              color="primary"
              icon="fas fa-download"
              label="Save to File"
              @click="downloadRecoveryKey"
              class="q-mr-sm"
            />
            <q-btn
              color="green"
              unelevated
              icon="fas fa-check"
              label="I've Saved My Key"
              @click="dismissRecoveryKeyDisplay"
            />
          </div>
        </div>
      </div>

      <!-- Encrypted Chat Success Info (show only when room is actually encrypted) -->
      <div v-else-if="isReadyEncrypted && inlineRoomId && matrixClientManager.isRoomEncrypted(inlineRoomId)" class="encryption-info q-pa-md q-mb-md" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px;">
        <div class="text-h6 q-mb-sm" style="color: #155724;">
          <q-icon name="fas fa-shield-alt" class="q-mr-sm" />
          Encrypted Chat Mode
        </div>
        <p style="color: #155724; margin: 0;">
          Your messages are end-to-end encrypted and secure.
        </p>
      </div>

      <!-- Main Chat Interface -->
      <UnifiedChatComponent
        v-if="mode !== 'single-room'"
        :context-type="contextType"
        :context-id="contextId"
        :mode="mode"
        :inline-room-id="inlineRoomId"
        :can-open-fullscreen="canOpenFullscreen"
        :show-info-sidebar="showInfoSidebar"
      />

      <!-- Single Room Chat Interface -->
      <MatrixChatInterface
        v-else
        :room-id="inlineRoomId"
        :context-type="contextType === 'all' ? 'direct' : contextType"
        :context-id="contextId"
        :mode="mode === 'single-room' ? 'inline' : mode"
        height="500px"
      />
    </template>

    <!-- Fallback State -->
    <div v-else class="fallback-state">
      <p>Unexpected encryption state. Please refresh the page.</p>
      <q-btn @click="refreshState" label="Refresh" />
    </div>

    <!-- Recovery Key Dialog -->
    <q-dialog
      v-model="showRecoveryKeyDialog"
      persistent
      maximized
      transition-show="slide-up"
      transition-hide="slide-down"
    >
      <q-card class="recovery-key-dialog">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            <q-icon name="fas fa-key" color="orange" class="q-mr-sm" />
            Save Your Recovery Key
          </div>
        </q-card-section>

        <q-card-section>
          <div class="recovery-key-content">
            <div class="text-body1 q-mb-md">
              <strong>Your encryption is now set up!</strong>
              Here's your recovery key - you'll need this to unlock your encrypted messages if you forget your passphrase.
            </div>

            <q-banner class="bg-orange-1 text-orange-8 q-mb-md">
              <template v-slot:avatar>
                <q-icon name="fas fa-exclamation-triangle" color="orange" />
              </template>
              <strong>Important:</strong> Store this key safely in your password manager.
              You won't see it again and you'll need it to recover your messages!
            </q-banner>

            <q-card flat class="recovery-key-card q-mb-md">
              <q-card-section>
                <div class="recovery-key-text">{{ recoveryKey }}</div>
                <div class="recovery-key-actions q-mt-md">
                  <q-btn
                    flat
                    color="primary"
                    icon="fas fa-copy"
                    label="Copy Key"
                    @click="copyRecoveryKey"
                    class="q-mr-sm"
                  />
                  <q-btn
                    flat
                    color="grey-7"
                    icon="fas fa-download"
                    label="Download"
                    @click="downloadRecoveryKey"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-checkbox
              v-model="recoveryKeySaved"
              color="green"
              label="I have saved my recovery key safely"
              class="q-mb-md"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            unelevated
            color="green"
            label="Continue to Chat"
            @click="closeRecoveryKeyDialog"
            :disable="!recoveryKeySaved"
            icon="fas fa-comments"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Device Verification Dialog -->
    <DeviceVerificationDialog v-model="showVerificationDialog" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useMatrixEncryption } from '../../composables/useMatrixEncryption'
import { matrixClientManager } from '../../services/MatrixClientManager'
import { matrixEncryptionState, MatrixEncryptionService, type MatrixEncryptionStatus } from '../../services/MatrixEncryptionManager'
import { logger } from '../../utils/logger'
import { useQuasar } from 'quasar'
import UnifiedChatComponent from './UnifiedChatComponent.vue'
import MatrixChatInterface from './MatrixChatInterface.vue'
import UnifiedEncryptionBanner from './encryption/UnifiedEncryptionBanner.vue'
import VerificationNotificationBanner from './verification/VerificationNotificationBanner.vue'
import DeviceVerificationDialog from './verification/DeviceVerificationDialog.vue'

interface Props {
  // Context for filtering chats
  contextType?: 'all' | 'direct' | 'group' | 'event'
  contextId?: string

  // Display mode
  mode?: 'dashboard' | 'inline' | 'fullscreen' | 'single-room'

  // For inline mode
  inlineRoomId?: string

  // Configuration
  canOpenFullscreen?: boolean
  showInfoSidebar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  contextType: 'all',
  mode: 'dashboard',
  canOpenFullscreen: true,
  showInfoSidebar: false
})

// Quasar for notifications
const $q = useQuasar()

// Use only the old system but make it faster by immediate initialization
const {
  encryptionStatus,
  isLoading,
  canChat,
  needsLogin,
  needsEncryptionSetup,
  needsBanner,
  warningMessage,
  isReadyUnencrypted,
  isReadyEncrypted,
  requiresUserAction,
  checkEncryptionState,
  initializeEncryption,
  refreshState
} = useMatrixEncryption()

// Type assertion for encryptionStatus to help TypeScript
const typedEncryptionStatus = encryptionStatus as Ref<MatrixEncryptionStatus | null>

// Simple setup state
const setupInProgress = ref(false)
const recoveryKeyInput = ref('')
const setupError = ref('')
const setupErrorDetails = ref('')
const creatingKey = ref(false)
const justCreatedKey = ref(false)
const showRecoveryKeyDisplay = ref(false)
const createdRecoveryKey = ref('')

// Setup progress tracking
const setupProgress = ref<{
  currentStep: number
  steps: Array<{
    id: string
    label: string
    status: 'pending' | 'active' | 'completed'
  }>
}>({
  currentStep: 0,
  steps: [
    { id: 'reset', label: 'Reset encryption', status: 'pending' },
    { id: 'setup', label: 'Setup fresh encryption', status: 'pending' },
    { id: 'verify', label: 'Verify device', status: 'pending' }
  ]
})

// Recovery key display state
const recoveryKey = ref('')
const showRecoveryKeyDialog = ref(false)
const recoveryKeySaved = ref(false)

// Encryption service state
const encryptionService = ref<MatrixEncryptionService | null>(null)

// Initialize encryption service when Matrix client is ready
const initializeEncryptionService = () => {
  const client = matrixClientManager.getClient()
  if (client && !encryptionService.value) {
    encryptionService.value = new MatrixEncryptionService(client)
    logger.debug('✅ Encryption service initialized')
  }
}

// Device verification state
const showVerificationDialog = ref(false)
const verificationBannerRef = ref()

// Flag to force encryption setup after reset
const forceSetupAfterReset = ref(false)

// Event listener references for cleanup
let encryptionResetListener: ((event: CustomEvent) => Promise<void>) | null = null
let encryptionSetupListener: ((event: CustomEvent) => Promise<void>) | null = null
let masRecoveryKeyListener: ((event: CustomEvent) => Promise<void>) | null = null
let masResetCompletedListener: ((event: CustomEvent) => Promise<void>) | null = null

// Element Web's simple decision tree - show setup when encryption is needed but not complete
const shouldShowEncryptionSetup = computed(() => {
  const state = typedEncryptionStatus.value?.state

  // Element Web pattern: Show banner for these specific states
  const needsSetup = state === 'needs_recovery_key' ||
                    state === 'needs_key_backup' ||
                    state === 'needs_device_verification' ||
                    state === 'ready_encrypted_with_warning'

  // Force show after reset (like Element Web after identity reset)
  const forceShow = forceSetupAfterReset.value

  // Don't show if encryption is fully working
  const encryptionReady = state === 'ready_encrypted'

  const shouldShow = (needsSetup || forceShow) && !encryptionReady

  logger.debug('🔍 Element Web banner logic:', {
    state,
    needsSetup,
    forceShow,
    encryptionReady,
    shouldShow
  })

  return shouldShow
})

// Element Web pattern logic moved to UnifiedEncryptionBanner

// Element Web pattern - does user only need device verification?
const needsDeviceVerificationOnly = computed(() => {
  const state = typedEncryptionStatus.value?.state
  const details = typedEncryptionStatus.value?.details

  // Element Web pattern: User has recovery key but device isn't verified
  const hasRecoveryKey = details?.secretStorageReady || details?.hasDefaultKeyId
  const deviceNotTrusted = details?.isCurrentDeviceTrusted === false
  const needsDeviceVerification = state === 'needs_device_verification'

  // If user has recovery key but device isn't trusted, they need to enter the key to verify
  const onlyNeedsDevice = hasRecoveryKey && (deviceNotTrusted || needsDeviceVerification)

  logger.debug('🔍 Device verification only (Element Web pattern):', {
    state,
    hasRecoveryKey,
    deviceNotTrusted,
    needsDeviceVerification,
    onlyNeedsDevice
  })

  return onlyNeedsDevice
})

// Debug current state
const debugState = computed(() => {
  return {
    isLoading: isLoading.value,
    canChat: canChat.value,
    needsLogin: needsLogin.value,
    needsEncryptionSetup: needsEncryptionSetup.value,
    isReadyUnencrypted: isReadyUnencrypted.value,
    isReadyEncrypted: isReadyEncrypted.value,
    needsBanner: needsBanner.value,
    warningMessage: warningMessage.value,
    encryptionState: typedEncryptionStatus.value?.state,
    requiresUserAction: requiresUserAction.value
  }
})

// Log debug state when it changes
watch(debugState, (newState) => {
  logger.debug('🔍 Encryption state debug:', newState)
}, { deep: true })

// Watch for room ID changes and update encryption state accordingly
watch(() => props.inlineRoomId, async (newRoomId, oldRoomId) => {
  logger.debug('🔄 Room ID watcher triggered:', {
    oldRoomId,
    newRoomId,
    hasRoomId: !!newRoomId,
    roomIdType: typeof newRoomId,
    isDifferent: newRoomId !== oldRoomId
  })

  if (newRoomId && newRoomId !== oldRoomId) {
    // Room ID is now available or has changed - check encryption state for this room
    logger.debug('✅ Room ID available - checking encryption state for room:', newRoomId)
    await checkEncryptionState(newRoomId)
  } else if (!newRoomId) {
    logger.debug('🔍 Room ID is still null/undefined - waiting')
  } else {
    logger.debug('🔍 Room ID unchanged or invalid:', newRoomId)
  }
}, { immediate: false }) // Don't run immediately since onMounted handles the initial check

// Actions
const connectToMatrix = async () => {
  logger.debug('🔗 User requested Matrix connection')
  try {
    // Clear any residual encryption skipped state first
    matrixEncryptionState.clearEncryptionSkipped()

    // Try to restore from stored session first (Element Web pattern)
    let client = await matrixClientManager.initializeClient()
    if (!client) {
      // No stored session - start authentication flow
      logger.debug('🔗 No stored session found, starting authentication flow')
      client = await matrixClientManager.startAuthenticationFlow()
    } else {
      logger.debug('✅ Restored Matrix session from storage')
    }
    if (client) {
      // Re-check state after connection - only if we have a room ID
      if (props.inlineRoomId) {
        await checkEncryptionState(props.inlineRoomId)
      }

      logger.debug('✅ Matrix connected - ready for unencrypted chat')

      // Force reactivity update by checking needsLogin state
      logger.debug('🔍 Post-connection state:', {
        needsLogin: needsLogin.value,
        hasClient: !!matrixClientManager.getClient(),
        isLoggedIn: matrixClientManager.getClient()?.isLoggedIn(),
        isReady: matrixClientManager.isReady(),
        encryptionState: typedEncryptionStatus.value?.state
      })
    }
  } catch (error) {
    logger.error('Failed to connect to Matrix:', error)
  }
}

// Create recovery key inline
const createRecoveryKeyInline = async () => {
  logger.debug('🔧 Creating recovery key inline')
  creatingKey.value = true

  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Check if client is in valid state before attempting encryption setup
    if (!client.getAccessToken()) {
      throw new Error('Matrix client is not in valid state - please re-login')
    }

    // Use MatrixEncryptionService to create fresh encryption setup
    const { MatrixEncryptionService } = await import('../../services/MatrixEncryptionManager')
    const encryptionService = new MatrixEncryptionService(client)

    // Create fresh encryption setup (this will generate a new recovery key)
    const result = await encryptionService.setupEncryption()

    if (!result.success) {
      throw new Error(result.error || 'Failed to create recovery key')
    }

    // Element Web pattern: Device is automatically trusted after successful bootstrap
    // No need to verify with the recovery key we just created
    if (result.recoveryKey) {
      logger.debug('✅ Fresh encryption setup completed - device automatically trusted')
    }

    // Show the recovery key display instead of auto-filling input
    if (result.recoveryKey) {
      createdRecoveryKey.value = result.recoveryKey
      showRecoveryKeyDisplay.value = true
      justCreatedKey.value = true

      // Clear force setup flag after successful recovery key creation
      forceSetupAfterReset.value = false

      logger.debug('✅ Recovery key created, showing display')
      $q.notify({
        type: 'positive',
        message: 'Recovery key created successfully!',
        caption: 'Please save your key before proceeding'
      })
    }

    // Refresh state to update banner visibility
    await refreshState()
  } catch (error) {
    logger.error('Failed to create recovery key:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to create recovery key',
      caption: error.message || 'Please try again'
    })
  } finally {
    creatingKey.value = false
  }
}

// Proceed to key entry step
// proceedToKeyEntry function moved to UnifiedEncryptionBanner logic

// Inline recovery key setup handler
const handleInlineSetupEncryption = async () => {
  const recoveryKeyValue = recoveryKeyInput.value?.trim()
  if (!recoveryKeyValue) {
    setupError.value = 'Recovery key required'
    setupErrorDetails.value = 'Please enter your recovery key to continue'
    return
  }

  logger.debug('🔧 Starting inline encryption setup with recovery key')
  setupInProgress.value = true

  // Clear previous errors
  setupError.value = ''
  setupErrorDetails.value = ''

  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // For device verification scenarios, we need to manage cache lifecycle manually
    // to keep the recovery key available for cross-signing operations
    if (needsDeviceVerificationOnly.value) {
      logger.debug('🔐 Device verification needed - using manual cache management')

      // Import cache management functions
      const { cacheSecretStorageKeyForBootstrap, clearSecretStorageCache, setSecretStorageBeingAccessed } = await import('../../services/MatrixClientManager')

      try {
        // Set up cache state for device verification
        setSecretStorageBeingAccessed(true)

        // Get the actual secret storage key info and use the correct key ID
        const defaultKeyId = await client.secretStorage.getDefaultKeyId()
        if (!defaultKeyId) {
          throw new Error('No default secret storage key ID found')
        }
        const keyInfo = await client.secretStorage.getKey(defaultKeyId)
        if (!keyInfo) {
          throw new Error(`Secret storage key info not found for key ID: ${defaultKeyId}`)
        }
        logger.debug('🔑 Using secret storage key:', { keyId: defaultKeyId, keyInfo })

        // Convert recovery key string to Uint8Array format required by cache
        const { decodeRecoveryKey } = await import('matrix-js-sdk/lib/crypto-api')
        const recoveryKeyBytes = decodeRecoveryKey(recoveryKeyValue)

        // Pre-cache the recovery key and run device verification directly
        cacheSecretStorageKeyForBootstrap(defaultKeyId, keyInfo, recoveryKeyBytes)
        logger.debug('🔑 Recovery key cached for device verification operations')

        // Use MatrixEncryptionService approach (exactly like the dashboard)
        logger.debug('🔧 Using MatrixEncryptionService approach (dashboard-style)...')
        const { MatrixEncryptionService } = await import('../../services/MatrixEncryptionManager')
        const encryptionService = new MatrixEncryptionService(client)
        const result = await encryptionService.setupEncryption(recoveryKeyValue)

        if (result.success) {
          logger.debug('✅ MatrixEncryptionService setup completed successfully')

          // Wait for Matrix SDK to process everything
          logger.debug('⏳ Waiting for Matrix SDK state to update...')
          await new Promise(resolve => setTimeout(resolve, 3000))

          // CRITICAL: Even if MatrixEncryptionService succeeds, we still need to verify the device
          // MatrixEncryptionService might return success for "Encryption already ready" but device may not be verified
          logger.debug('🔐 Running device verification after MatrixEncryptionService...')

          // CRITICAL: Re-cache the secret storage key for device verification
          // MatrixEncryptionService cleared the cache, but device verification needs it
          logger.debug('🔑 Re-caching secret storage key for device verification...')
          setSecretStorageBeingAccessed(true)
          cacheSecretStorageKeyForBootstrap(defaultKeyId, keyInfo, recoveryKeyBytes)
          try {
            const { MatrixDeviceManager } = await import('../../services/MatrixDeviceManager')
            const deviceManager = new MatrixDeviceManager(client)
            const verificationResult = await deviceManager.testAndFixDeviceVerification()

            if (verificationResult.success && verificationResult.isVerified) {
              logger.debug('✅ Device verification completed successfully after MatrixEncryptionService!')
              // Clear the error since device is now verified
              setupError.value = ''
              setupErrorDetails.value = ''
            } else if (verificationResult.success && !verificationResult.isVerified) {
              logger.debug('⚠️ MatrixEncryptionService succeeded but device still needs verification')
              // Keep showing the verification banner since device is not verified
              setupError.value = 'Device verification pending'
              setupErrorDetails.value = 'Device setup completed but verification is still required'
            } else {
              logger.debug('⚠️ Device verification failed after MatrixEncryptionService')
              // Show error for verification failures
              setupError.value = 'Device verification failed'
              setupErrorDetails.value = `Verification error: ${verificationResult.error || 'Unknown error'}`
            }
          } catch (verificationError) {
            logger.error('❌ Device verification failed after MatrixEncryptionService:', verificationError)
            setupError.value = 'Device verification failed'
            setupErrorDetails.value = `Post-encryption device verification error: ${verificationError.message}`
          }

          // Success - just like the dashboard approach
          logger.debug('✅ Encryption setup completed successfully!')
          recoveryKeyInput.value = ''

          // Clean up cache state
          setSecretStorageBeingAccessed(false)
          clearSecretStorageCache()

          // Refresh status to update UI
          await refreshState()
          return
        } else {
          logger.debug('❌ MatrixEncryptionService setup failed:', result.error)
          throw new Error(result.error || 'Encryption setup failed')
        }
      } catch (deviceVerificationError) {
        logger.error('Device verification failed:', deviceVerificationError)

        // Handle specific error types with user-friendly messages
        let errorMessage = 'Encryption setup failed'
        let errorDetails = 'An unexpected error occurred during device verification. Please try again.'
        if (deviceVerificationError.message?.includes('cross-signing keys')) {
          errorMessage = 'Cross-signing keys unavailable'
          errorDetails = 'The recovery key could not unlock cross-signing keys. This may be due to a different recovery key being used or cross-signing not being properly set up.'
        } else if (deviceVerificationError.message?.includes('Invalid passphrase')) {
          errorMessage = 'Invalid recovery key'
          errorDetails = 'The recovery key you entered is not correct for this account. Please check and try again.'
        } else if (deviceVerificationError.message?.includes('not ready')) {
          errorMessage = 'Encryption not ready'
          errorDetails = 'The Matrix encryption system is not fully initialized. Please try refreshing the page.'
        }

        // Show the error in the banner
        setupError.value = errorMessage
        setupErrorDetails.value = errorDetails
      } finally {
        // Clean up cache after device verification attempts complete
        setSecretStorageBeingAccessed(false)
        clearSecretStorageCache()
        logger.debug('🔧 Secret storage cache cleared after device verification')
      }
    } else {
      // For non-device-verification scenarios, use standard approach
      logger.debug('🔧 Full encryption setup needed')
      const { MatrixEncryptionService } = await import('../../services/MatrixEncryptionManager')
      const encryptionService = new MatrixEncryptionService(client)

      logger.debug('🔧 Setting up encryption with recovery key...')
      const result = await encryptionService.setupEncryption(recoveryKeyValue)
      logger.debug('🔧 Setup result:', result)

      if (!result.success) {
        throw new Error(result.error || 'Encryption setup failed')
      }
    }

    // Clear the input on success, but only clear errors if device is actually verified
    recoveryKeyInput.value = ''

    // Only clear errors if the device verification issue is resolved
    if (typedEncryptionStatus.value?.details?.isCurrentDeviceTrusted) {
      setupError.value = ''
      setupErrorDetails.value = ''
      logger.debug('✅ Device verification complete - clearing all errors')
    } else {
      logger.debug('⚠️ Device still not verified - keeping error visible')
    }

    // Clear force setup flag after successful setup
    forceSetupAfterReset.value = false

    // Refresh state to update UI
    await refreshState()

    // Check final state after everything
    const finalState = await matrixEncryptionState.getEncryptionState(client, props.inlineRoomId)
    logger.debug('✅ Inline encryption setup completed - final state:', {
      state: finalState.state,
      deviceTrusted: finalState.details.isCurrentDeviceTrusted,
      crossSigningReady: finalState.details.crossSigningReady,
      secretStorageReady: finalState.details.secretStorageReady
    })

    $q.notify({
      type: 'positive',
      message: needsDeviceVerificationOnly.value ? 'Device verification completed' : 'Encryption restored successfully'
    })

    // After successful setup, clear all creation flags and refresh state
    showRecoveryKeyDisplay.value = false
    justCreatedKey.value = false
    createdRecoveryKey.value = ''
    recoveryKeyInput.value = ''

    // Refresh encryption state to hide banner
    await refreshState()

    // Also ensure the force setup flag is cleared to hide the banner
    forceSetupAfterReset.value = false

    // Additional debug logging
    logger.debug('🔍 Post-recovery state check:', {
      canChat: canChat.value,
      needsEncryptionSetup: needsEncryptionSetup.value,
      shouldShowEncryptionSetup: shouldShowEncryptionSetup.value,
      encryptionState: typedEncryptionStatus.value?.state,
      isReadyEncrypted: isReadyEncrypted.value,
      forceSetupAfterReset: forceSetupAfterReset.value,
      chatInterfaceCondition: !needsLogin.value && !isLoading.value
    })
  } catch (error) {
    logger.error('Failed to restore encryption with recovery key:', error)

    // Check for MAS reset completion error
    if (error instanceof Error && error.message === 'MAS_RESET_COMPLETE_NEW_KEY_NEEDED') {
      logger.debug('🔄 MAS cross-signing reset completed - redirecting to new key generation')

      // Clear current setup state
      setupInProgress.value = false
      setupError.value = ''
      setupErrorDetails.value = ''
      recoveryKeyInput.value = ''

      // Redirect to new key generation flow
      try {
        await createRecoveryKeyInline()
        return // Exit early, don't show error UI
      } catch (keyGenError) {
        logger.error('❌ Failed to generate new recovery key after MAS reset:', keyGenError)
        setupError.value = 'New key generation failed'
        setupErrorDetails.value = 'MAS reset completed but failed to generate new recovery key. Please try refreshing the page.'
        setupInProgress.value = false
        return
      }
    }

    // Provide specific error messages based on the error type
    let errorMessage = 'Encryption setup failed'
    let errorDetails = ''

    if (error instanceof Error) {
      if (error.message.includes('Invalid passphrase') || error.message.includes('Invalid recovery key')) {
        errorMessage = 'Invalid recovery key'
        errorDetails = 'The recovery key you entered is not correct for this account. Please verify the key and try again.'
      } else if (error.message.includes('Secret storage key not available')) {
        errorMessage = 'Cross-signing access failed'
        errorDetails = 'Unable to access cross-signing keys with this recovery key. The key may be from a different device or account.'
      } else if (error.message.includes('Matrix client not available')) {
        errorMessage = 'Connection error'
        errorDetails = 'Lost connection to Matrix server. Please refresh the page and try again.'
      } else if (error.message.includes('No default secret storage key')) {
        errorMessage = 'No encryption keys found'
        errorDetails = 'This account does not appear to have encryption set up. Please contact support or try creating new encryption keys.'
      } else {
        errorMessage = 'Unexpected error'
        errorDetails = error.message || 'An unknown error occurred during encryption setup.'
      }
    } else {
      errorDetails = 'An unknown error occurred. Please try again.'
    }

    // Display error in the banner
    setupError.value = errorMessage
    setupErrorDetails.value = errorDetails

    // Also show notification for immediate feedback
    $q.notify({
      type: 'negative',
      message: errorMessage,
      caption: errorDetails,
      timeout: 5000
    })
  } finally {
    setupInProgress.value = false
  }
}

// Handle forgot recovery key
const handleForgotRecoveryKey = async () => {
  try {
    logger.debug('🔧 User clicked forgot recovery key - starting reset flow')

    // Clear any existing errors
    setupError.value = ''
    setupErrorDetails.value = ''

    // Use MatrixResetService to handle the unified forgot recovery key flow
    const { MatrixResetService } = await import('../../services/MatrixResetService')
    const client = matrixClientManager.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const resetService = new MatrixResetService(client)

    // Show confirmation dialog
    $q.dialog({
      title: 'Reset Recovery Key',
      message: 'This will create a new recovery key and reset your encryption identity. You will need to verify other devices again. Continue?',
      cancel: true,
      persistent: true,
      color: 'warning'
    }).onOk(async () => {
      setupInProgress.value = true

      try {
        logger.debug('🔧 Starting full encryption reset and new key generation...')

        // Set flag to indicate we're in "forgot recovery key" flow
        sessionStorage.setItem('forgotRecoveryKeyFlow', 'true')

        // Use the unified MatrixResetService for forgot recovery key flow
        const result = await resetService.performReset({
          resetType: 'forgot_recovery_key'
        })

        if (result.success) {
          logger.debug('✅ Forgot recovery key reset completed successfully')

          // If the reset service generated a recovery key, display it
          if (result.recoveryKey) {
            logger.debug('✅ New recovery key received from reset service')
            createdRecoveryKey.value = result.recoveryKey
            await refreshState()
          } else {
            // Fallback: generate recovery key locally
            logger.debug('🔄 No recovery key from reset service, generating locally')
            await createRecoveryKeyInline()
          }
        } else {
          throw new Error(result.error || 'Failed to reset encryption')
        }
      } catch (error) {
        logger.error('❌ Recovery key reset failed:', error)
        setupError.value = 'Reset failed'
        setupErrorDetails.value = error.message || 'Failed to start recovery key reset process'

        $q.notify({
          type: 'negative',
          message: 'Recovery key reset failed',
          caption: error.message || 'Please try again or contact support',
          timeout: 5000
        })
      } finally {
        setupInProgress.value = false
      }
    })
  } catch (error) {
    logger.error('❌ Failed to initiate recovery key reset:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to start reset process',
      caption: 'Please try again or contact support',
      timeout: 5000
    })
  }
}

// Element Web style banner handlers
const dismissEncryptionBanner = () => {
  logger.debug('👍 User dismissed encryption banner')
  // For now, just log. In Element Web, this would set a flag to not show again
  // We could implement persistent dismissal later
}

// UnifiedEncryptionBanner event handlers
const handleSetupEncryption = async () => {
  logger.debug('🔐 User clicked setup encryption from unified banner')
  // Use existing createRecoveryKeyInline logic
  await createRecoveryKeyInline()
}

const handleVerifyDevice = async (recoveryKey: string) => {
  logger.debug('🔐 User submitted recovery key from unified banner:', recoveryKey.slice(0, 10) + '...')
  // Set the recovery key input and trigger the inline setup
  recoveryKeyInput.value = recoveryKey
  await handleInlineSetupEncryption()
}

const handleKeyConfirmed = async () => {
  logger.debug('🔐 User confirmed they saved the recovery key from unified banner')
  // Use existing dismissRecoveryKeyDisplay logic
  await dismissRecoveryKeyDisplay()
}

const handleResetDeviceKeys = async () => {
  logger.debug('🔐 User clicked reset device keys - starting device reset flow')

  try {
    setupInProgress.value = true
    setupError.value = ''
    setupErrorDetails.value = ''

    // Use MatrixResetService for comprehensive device key reset
    const { MatrixResetService } = await import('../../services/MatrixResetService')
    const client = matrixClientManager.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const resetService = new MatrixResetService(client)

    // Use complete reset for device key mismatches to ensure everything is cleaned up properly
    const result = await resetService.performReset({
      resetType: 'complete',
      clearLocalData: true,
      forceReconnection: false // Keep the user session active
    })

    if (result.success) {
      logger.debug('✅ Device keys reset successfully')

      // Store recovery key if provided (from server-side reset)
      if (result.recoveryKey) {
        logger.debug('🔑 Got new recovery key from server-side reset')
        recoveryKey.value = result.recoveryKey
        showRecoveryKeyDisplay.value = true
      }

      // Show success notification
      $q.notify({
        type: 'positive',
        message: result.message || 'Device keys reset successfully',
        caption: result.recoveryKey ? 'Save your new recovery key!' : 'Chat access should be restored',
        timeout: 5000
      })

      // Force a refresh of encryption state
      await checkEncryptionState(props.inlineRoomId)

      // If setup is needed after reset, optionally prompt user
      if (result.needsSetup) {
        logger.debug('🔧 Setup needed after device reset')
      }
    } else {
      throw new Error(result.error || 'Device reset failed')
    }
  } catch (error) {
    logger.error('❌ Device key reset failed:', error)
    setupError.value = 'Device reset failed'
    setupErrorDetails.value = error instanceof Error ? error.message : 'Unknown error during device reset'

    $q.notify({
      type: 'negative',
      message: 'Device reset failed',
      caption: error instanceof Error ? error.message : 'Unknown error occurred',
      timeout: 5000
    })
  } finally {
    setupInProgress.value = false
  }
}

const handleEncryptionAction = async (state: string) => {
  logger.debug('🔐 User clicked encryption action for state:', state)

  switch (state) {
    case 'needs_device_verification': {
      // For device verification, check if user has existing encryption setup
      const client = matrixClientManager.getClient()
      if (!client) {
        throw new Error('Matrix client not available')
      }

      const crypto = client.getCrypto()
      const [secretStorageReady, crossSigningReady, keyBackupInfo] = await Promise.all([
        crypto?.isSecretStorageReady().catch(() => false) || false,
        crypto?.isCrossSigningReady().catch(() => false) || false,
        crypto?.getKeyBackupInfo().catch(() => null) || null
      ])

      const hasExistingSetup = secretStorageReady && crossSigningReady && keyBackupInfo

      if (hasExistingSetup) {
        logger.debug('🔐 User has existing encryption - they should enter their recovery key')
        // Don't do anything - let them use the recovery key input field that's already showing
        $q.notify({
          type: 'info',
          message: 'Enter your recovery key below to verify this device',
          timeout: 3000
        })
      } else {
        logger.debug('🔐 No existing encryption - starting full setup flow...')
        await setupDeviceEncryption()
      }
      break
    }
    case 'ready_encrypted_with_warning':
    case 'needs_recovery_key':
      // Show passphrase dialog to unlock or reset encryption
      await showPassphraseDialog(true)
      break
    case 'needs_key_backup':
      // Setup fresh encryption
      await showPassphraseDialog(false)
      break
    default:
      logger.warn('Unknown encryption action state:', state)
  }
}

// Device encryption setup (same flow as preferences form "Forgot Recovery Key")
const setupDeviceEncryption = async () => {
  try {
    setupInProgress.value = true

    // Get Matrix client
    const client = matrixClientManager.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const encryptionService = new MatrixEncryptionService(client)
    const crypto = client.getCrypto()

    // Check current encryption status to determine the right approach
    const [secretStorageReady, crossSigningReady, keyBackupInfo] = await Promise.all([
      crypto?.isSecretStorageReady().catch(() => false) || false,
      crypto?.isCrossSigningReady().catch(() => false) || false,
      crypto?.getKeyBackupInfo().catch(() => null) || null
    ])

    const hasExistingSetup = secretStorageReady && crossSigningReady && keyBackupInfo

    if (hasExistingSetup) {
      logger.debug('🔐 Existing encryption setup detected - using device verification approach')
      // User already has encryption setup, just need to verify device
      setupProgress.value = {
        currentStep: 0,
        steps: [
          { id: 'unlock', label: 'Unlock with recovery key', status: 'active' },
          { id: 'verify', label: 'Verify device', status: 'pending' }
        ]
      }

      // Show recovery key input instead of generating new one
      // This will be handled by the existing recovery key input flow
      throw new Error('Please enter your recovery key to verify this device')
    } else {
      logger.debug('🔐 No existing encryption setup - using full setup approach')
      // Fresh setup - need to generate new recovery key
      setupProgress.value = {
        currentStep: 0,
        steps: [
          { id: 'reset', label: 'Reset encryption', status: 'active' },
          { id: 'setup', label: 'Setup fresh encryption', status: 'pending' },
          { id: 'verify', label: 'Verify device', status: 'pending' }
        ]
      }
    }

    // Use unified encryption service to reset and setup encryption

    // Step 1: Reset existing encryption
    logger.debug('🔄 Step 1: Resetting existing encryption...')
    const resetResult = await encryptionService.resetEncryption()
    if (!resetResult.success) {
      throw new Error(resetResult.error || 'Reset failed')
    }

    // Mark reset as completed, move to setup
    setupProgress.value.steps[0].status = 'completed'
    setupProgress.value.currentStep = 1
    setupProgress.value.steps[1].status = 'active'

    logger.debug('✅ Encryption reset completed, now setting up fresh encryption...')

    // Step 2: Set up fresh encryption with auto-generated recovery key
    logger.debug('🔄 Step 2: Setting up fresh encryption...')
    const setupResult = await encryptionService.setupEncryption()

    if (setupResult.success && setupResult.recoveryKey) {
      // Element Web pattern: Device is automatically trusted after successful bootstrap
      // No additional verification step needed - the device was already signed during bootstrap
      logger.debug('✅ Fresh encryption setup completed - device automatically trusted')

      // Mark setup as completed and skip verification step
      setupProgress.value.steps[1].status = 'completed'
      setupProgress.value.currentStep = 2
      setupProgress.value.steps[2].status = 'completed' // Skip verification for fresh setup

      // Brief delay for UI visibility
      await new Promise(resolve => setTimeout(resolve, 500))

      // Mark verification as completed (skipped for fresh setup)
      setupProgress.value.steps[2].status = 'completed'

      // Show the new recovery key to the user
      createdRecoveryKey.value = setupResult.recoveryKey
      showRecoveryKeyDisplay.value = true

      $q.notify({
        type: 'positive',
        message: 'Device encryption setup completed! Please save your new recovery key.',
        timeout: 5000
      })

      // Refresh encryption state multiple times to ensure Matrix state is updated
      setTimeout(async () => {
        await refreshState()
        // Second refresh after another delay to catch any delayed Matrix state changes
        setTimeout(async () => {
          await refreshState()
        }, 2000)
      }, 1000)
    } else {
      throw new Error(setupResult.error || 'Failed to generate recovery key')
    }
  } catch (error) {
    logger.error('Device encryption setup failed:', error)

    $q.notify({
      type: 'negative',
      message: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timeout: 5000
    })
  } finally {
    setupInProgress.value = false
  }
}

// Dismiss recovery key display (separate from dialog)
const dismissRecoveryKeyDisplay = () => {
  showRecoveryKeyDisplay.value = false
  createdRecoveryKey.value = ''

  // Show success message
  $q.notify({
    type: 'positive',
    message: 'Recovery key dismissed. Your device encryption is now fully set up!',
    timeout: 3000,
    icon: 'fas fa-check-circle'
  })
}

// Recovery key dialog methods
const closeRecoveryKeyDialog = () => {
  if (recoveryKeySaved.value) {
    showRecoveryKeyDialog.value = false
    recoveryKey.value = ''
    recoveryKeySaved.value = false
  }
}

const copyRecoveryKey = async () => {
  // Use the appropriate recovery key based on context
  const keyToCopy = createdRecoveryKey.value || recoveryKey.value

  try {
    await navigator.clipboard.writeText(keyToCopy)
    logger.debug('✅ Recovery key copied to clipboard')
    $q.notify({
      type: 'positive',
      message: 'Recovery key copied to clipboard',
      timeout: 2000
    })
  } catch (error) {
    logger.error('❌ Failed to copy recovery key:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = keyToCopy
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    $q.notify({
      type: 'negative',
      message: 'Failed to copy to clipboard',
      caption: 'Please copy manually'
    })
  }
}

const downloadRecoveryKey = () => {
  // Use the appropriate recovery key based on context
  const keyToDownload = createdRecoveryKey.value || recoveryKey.value

  const element = document.createElement('a')
  const file = new Blob([
    'OpenMeet Recovery Key\n',
    `Generated: ${new Date().toISOString()}\n`,
    '\n',
    `Recovery Key:\n${keyToDownload}\n`,
    '\n',
    'IMPORTANT: Store this key safely. You need it to unlock your encrypted messages if you forget your passphrase.\n'
  ], { type: 'text/plain' })
  element.href = URL.createObjectURL(file)
  element.download = `openmeet-recovery-key-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  URL.revokeObjectURL(element.href)
  $q.notify({
    type: 'positive',
    message: 'Recovery key saved to file',
    timeout: 2000
  })
}

// Passphrase dialog for encryption setup/unlock
const showPassphraseDialog = async (isUnlock = false) => {
  return new Promise((resolve, reject) => {
    $q.dialog({
      title: isUnlock ? 'Unlock Encryption' : 'Set up Encryption',
      message: isUnlock
        ? 'Enter your passphrase or recovery key to unlock your encrypted messages:'
        : 'Choose a strong passphrase to secure your encrypted messages:',
      prompt: {
        model: '',
        type: 'password',
        hint: isUnlock ? 'Passphrase or recovery key' : 'At least 12 characters'
      },
      cancel: true,
      persistent: true,
      ok: {
        label: isUnlock ? 'Unlock' : 'Set up Encryption',
        color: 'primary'
      }
    }).onOk(async (passphrase: string) => {
      if (!passphrase?.trim()) {
        $q.notify({ type: 'negative', message: 'Passphrase cannot be empty' })
        reject(new Error('Empty passphrase'))
        return
      }

      if (!isUnlock && passphrase.length < 12) {
        $q.notify({ type: 'negative', message: 'Passphrase must be at least 12 characters' })
        reject(new Error('Passphrase too short'))
        return
      }

      try {
        if (!encryptionService.value) {
          throw new Error('Encryption service not available')
        }

        $q.loading.show({ message: isUnlock ? 'Unlocking encryption...' : 'Setting up encryption...' })

        const result = await encryptionService.value.setupEncryption(passphrase)

        if (result.success) {
          logger.debug('✅ Encryption setup/unlock successful')

          if (result.recoveryKey && !isUnlock) {
            // Show recovery key for new setups
            recoveryKey.value = result.recoveryKey
            showRecoveryKeyDialog.value = true
          }

          // Clear force setup flag
          forceSetupAfterReset.value = false

          // Re-check encryption state - only if we have a room ID
          if (props.inlineRoomId) {
            await checkEncryptionState(props.inlineRoomId)
          }

          $q.notify({
            type: 'positive',
            message: isUnlock ? 'Encryption unlocked successfully' : 'Encryption set up successfully',
            icon: 'fas fa-shield-alt'
          })

          resolve(result)
        } else {
          throw new Error(result.error || 'Unknown error')
        }
      } catch (error) {
        logger.error('❌ Encryption setup/unlock failed:', error)
        $q.notify({
          type: 'negative',
          message: isUnlock ? 'Failed to unlock encryption' : 'Failed to set up encryption',
          caption: error.message || 'Please check your passphrase and try again'
        })
        reject(error)
      } finally {
        $q.loading.hide()
      }
    }).onCancel(() => {
      reject(new Error('Cancelled'))
    })
  })
}

// Initialize
onMounted(async () => {
  logger.debug('🏗️ Simplified MatrixNativeChatOrchestrator mounted')
  logger.debug('🔍 Props on mount:', { inlineRoomId: props.inlineRoomId, contextType: props.contextType, mode: props.mode })
  logger.debug('🔍 Debug state:', debugState.value)

  // Initialize encryption service if Matrix client is ready
  initializeEncryptionService()

  // Listen for encryption reset events
  encryptionResetListener = async (event: CustomEvent) => {
    logger.debug('🔥 Received encryption reset event:', event.detail)

    // Reset to the education step to restart the setup flow

    // Force the encryption setup UI to show after reset
    forceSetupAfterReset.value = true

    // Refresh encryption state
    await refreshState()

    logger.debug('🔄 Restarted setup flow from education step after reset')
    logger.debug('🔍 Post-reset state:', {
      needsEncryptionSetup: needsEncryptionSetup.value,
      shouldShowEncryptionSetup: shouldShowEncryptionSetup.value,
      forceSetupAfterReset: forceSetupAfterReset.value,
      debugState: debugState.value
    })
  }

  window.addEventListener('matrix-encryption-reset', encryptionResetListener as (event: Event) => void)

  // Listen for encryption setup requests
  encryptionSetupListener = async (event: CustomEvent) => {
    logger.debug('🔧 Received encryption setup request:', event.detail)

    // Force the setup flow to show
    forceSetupAfterReset.value = true

    // Refresh encryption state to show setup UI
    await refreshState()

    logger.debug('🔄 Started setup flow from setup request')
  }

  window.addEventListener('matrix-encryption-setup-requested', encryptionSetupListener as (event: Event) => void)

  // Listen for MAS-generated recovery keys
  masRecoveryKeyListener = async (event: CustomEvent) => {
    logger.debug('🔑 Received MAS-generated recovery key:', event.detail)

    try {
      const { recoveryKey } = event.detail

      if (recoveryKey) {
        // Auto-populate the recovery key input if the UI is showing
        if (shouldShowEncryptionSetup.value) {
          recoveryKeyInput.value = recoveryKey
          logger.debug('✅ Auto-populated recovery key from MAS flow')

          // Show a notification to let user know the key is ready
          $q.notify({
            type: 'positive',
            message: 'Recovery key generated and ready to use',
            position: 'top',
            timeout: 5000,
            icon: 'vpn_key'
          })

          // Also clear any existing errors since we now have a valid key
          setupError.value = ''
          setupErrorDetails.value = ''
        } else {
          // If UI isn't showing, show a notification with the key
          $q.notify({
            type: 'info',
            message: 'New recovery key generated. Click to copy.',
            position: 'top',
            timeout: 10000,
            icon: 'vpn_key',
            actions: [
              {
                label: 'Copy Key',
                color: 'white',
                handler: () => {
                  navigator.clipboard.writeText(recoveryKey).then(() => {
                    $q.notify({
                      type: 'positive',
                      message: 'Recovery key copied to clipboard',
                      timeout: 3000
                    })
                  })
                }
              }
            ]
          })
        }
      }
    } catch (error) {
      logger.error('❌ Error handling MAS recovery key:', error)
    }
  }

  window.addEventListener('mas-recovery-key-generated', masRecoveryKeyListener as (event: Event) => void)

  // Listen for MAS reset completion
  masResetCompletedListener = async (event: CustomEvent) => {
    logger.debug('🔄 MAS reset completed:', event.detail)

    try {
      // Reset was completed after MAS authorization, update UI state
      setupInProgress.value = false
      setupError.value = ''
      setupErrorDetails.value = ''

      // Show success notification
      $q.notify({
        type: 'positive',
        message: 'Encryption reset completed successfully',
        caption: 'Your device encryption has been reset after MAS authorization',
        timeout: 4000,
        position: 'top',
        icon: 'fas fa-check-circle'
      })

      // If a recovery key was generated, display it
      if (event.detail.recoveryKey) {
        logger.debug('🔑 Recovery key generated during MAS reset, displaying to user')
        createdRecoveryKey.value = event.detail.recoveryKey
        await refreshState()
      } else {
        // Force refresh the encryption state to reflect the reset
        await refreshState()
      }

      logger.debug('✅ UI updated after MAS reset completion')
    } catch (error) {
      logger.error('❌ Failed to handle MAS reset completion:', error)
      setupError.value = 'Failed to update after reset'
      setupErrorDetails.value = error.message || 'Failed to refresh encryption state after MAS reset'
    }
  }

  window.addEventListener('mas-reset-completed', masResetCompletedListener as (event: Event) => void)

  // Also check for any previously generated recovery key from MAS flow
  const existingKey = sessionStorage.getItem('mas_generated_recovery_key')
  if (existingKey) {
    logger.debug('🔑 Found existing MAS recovery key from session storage')
    sessionStorage.removeItem('mas_generated_recovery_key') // Clear it once used

    // Trigger the same handling as if we just received the event
    if (masRecoveryKeyListener) {
      masRecoveryKeyListener(new CustomEvent('mas-recovery-key-generated', {
        detail: { recoveryKey: existingKey }
      }))
    }
  }

  // Initial state check with room context - only if we have a room ID
  if (props.inlineRoomId) {
    logger.debug('🔍 Initial encryption state check with room ID:', props.inlineRoomId)
    await checkEncryptionState(props.inlineRoomId)
  } else {
    logger.debug('🔍 No room ID available at mount - will check encryption state when room ID becomes available via watcher')
  }

  // Try to initialize chat if we have a client (no forced encryption)
  if (!needsLogin.value) {
    // Only pass room ID if we have it - initializeEncryption can work without it for general setup
    await initializeEncryption(props.inlineRoomId || undefined)

    // Re-check encryption state after a brief delay to ensure room is fully loaded
    // This helps detect encryption in rooms where alias resolution initially failed
    if (props.inlineRoomId) {
      setTimeout(async () => {
        logger.debug('🔄 Re-checking encryption state after initialization (room ID already available)')
        await checkEncryptionState(props.inlineRoomId)
      }, 3000) // 3 second delay to allow room to be joined and state to sync
    } else {
      logger.debug('🔄 No room ID yet - watcher will handle encryption state when room ID becomes available')
    }
  }

  // Check if we're returning from MAS after "forgot recovery key" flow
  const forgotRecoveryKeyFlow = sessionStorage.getItem('forgotRecoveryKeyFlow')
  if (forgotRecoveryKeyFlow) {
    logger.debug('🔄 Detected return from MAS in forgot recovery key flow - continuing with key generation')
    sessionStorage.removeItem('forgotRecoveryKeyFlow')

    try {
      // Clear any existing errors first
      setupError.value = ''
      setupErrorDetails.value = ''

      // Continue with the recovery key generation that was interrupted by MAS redirect
      await createRecoveryKeyInline()
      logger.debug('✅ Completed forgot recovery key flow after MAS return')
    } catch (error) {
      logger.error('❌ Failed to complete forgot recovery key flow after MAS return:', error)
      setupError.value = 'Key generation failed'
      setupErrorDetails.value = 'Failed to complete key generation after identity verification. Please try again.'
    }
  }
})

onUnmounted(() => {
  // Clean up event listeners
  if (encryptionResetListener) {
    window.removeEventListener('matrix-encryption-reset', encryptionResetListener as (event: Event) => void)
  }
  if (encryptionSetupListener) {
    window.removeEventListener('matrix-encryption-setup-requested', encryptionSetupListener as (event: Event) => void)
  }
  if (masRecoveryKeyListener) {
    window.removeEventListener('mas-recovery-key-generated', masRecoveryKeyListener as (event: Event) => void)
  }
  if (masResetCompletedListener) {
    window.removeEventListener('mas-reset-completed', masResetCompletedListener as (event: Event) => void)
  }
})
</script>

<style scoped>
.matrix-native-chat-orchestrator {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.connection-required,
.setup-required,
.loading-state,
.fallback-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
}

.unlock-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
}

.connection-container,
.setup-container {
  text-align: center;
  max-width: 400px;
}

.unlock-alternatives {
  text-align: center;
  border-top: 1px solid rgba(0,0,0,0.1);
  padding-top: 1rem;
  margin-top: 1rem;
}

.loading-state {
  flex-direction: column;
  gap: 1rem;
}

.fallback-state {
  flex-direction: column;
  gap: 1rem;
  text-align: center;
}

/* Recovery Key Dialog Styles */
.recovery-key-dialog {
  max-width: 600px;
  margin: auto;
  max-height: 90vh;
}

.recovery-key-content {
  max-height: 70vh;
  overflow-y: auto;
}

.recovery-key-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.recovery-key-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 12px;
  word-break: break-all;
  line-height: 1.4;
  text-align: center;
  letter-spacing: 0.5px;
}

.recovery-key-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* Dark mode support */
.body--dark .recovery-key-card {
  background: #2d2d2d;
  border-color: #3a3a3a;
}

.body--dark .recovery-key-text {
  background: #1a1a1a;
  border-color: #4a4a4a;
  color: #e5e7eb;
}

/* Mobile-first encryption setup banner */
.encryption-setup-banner {
  padding: 16px;
  background: var(--q-warning);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  margin-bottom: 12px;
  justify-content: space-between;
}

.banner-icon {
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  min-width: 0;
  margin-right: 12px;
}

.banner-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--q-dark);
  margin-bottom: 2px;
}

.banner-subtitle {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.3;
}

.banner-progress {
  margin-top: 8px;
}

.progress-steps {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.6);
  transition: all 0.3s ease;
}

.progress-step.step-active {
  color: var(--q-primary);
  font-weight: 500;
}

.progress-step.step-completed {
  color: var(--q-positive);
  font-weight: 500;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.3);
}

.step-active .step-dot {
  background-color: var(--q-primary);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.step-label {
  font-size: 11px;
  white-space: nowrap;
}

.banner-actions {
  flex-shrink: 0;
}

.recovery-key-input-section {
  margin-top: 8px;
}

.recovery-key-input {
  width: 100%;
}

.recovery-key-input .q-field__control {
  background: white;
}
.forgot-key-btn {
  text-transform: none;
  font-size: 12px;
}
.forgot-key-btn:hover {
  text-decoration: underline;
}

/* Dark mode support */
.body--dark .banner-title {
  color: var(--q-dark);
}

.body--dark .banner-subtitle {
  color: rgba(255, 255, 255, 0.7);
}

.body--dark .progress-step {
  color: rgba(255, 255, 255, 0.6);
}

.body--dark .progress-step.step-active {
  color: var(--q-primary);
}

.body--dark .progress-step.step-completed {
  color: var(--q-positive);
}

.body--dark .step-dot {
  background-color: rgba(255, 255, 255, 0.3);
}

.body--dark .recovery-key-input .q-field__control {
  background: #2d2d2d;
}
</style>
