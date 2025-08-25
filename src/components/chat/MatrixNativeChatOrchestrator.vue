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

    <!-- Simple Encryption Setup Required -->
    <template v-else-if="needsEncryptionSetup">
      <div class="encryption-setup-banner">
        <!-- Step 1: Create Recovery Key Button -->
        <template v-if="needsRecoveryKeyCreation && !showRecoveryKeyDisplay && !needsDeviceVerificationOnly">
          <div class="banner-content">
            <div class="banner-icon">
              <q-icon name="fas fa-lock" color="warning" size="24px" />
            </div>
            <div class="banner-text">
              <div class="banner-title">Encryption setup needed</div>
              <div class="banner-subtitle">First create a recovery key to secure your messages</div>
            </div>
            <div class="banner-actions">
              <q-btn
                color="primary"
                size="sm"
                unelevated
                @click="createRecoveryKeyInline"
                :loading="creatingKey"
                icon="fas fa-key"
                label="Create Recovery Key"
              />
            </div>
          </div>
        </template>

        <!-- Step 2: Recovery Key Display (after creation) -->
        <template v-else-if="showRecoveryKeyDisplay">
          <div class="banner-content">
            <div class="banner-icon">
              <q-icon name="fas fa-key" color="positive" size="24px" />
            </div>
            <div class="banner-text">
              <div class="banner-title">Save Your Recovery Key</div>
              <div class="banner-subtitle">Store this key safely - you'll need it to recover encrypted messages</div>
            </div>
          </div>
          <div class="recovery-key-display-section">
            <div class="recovery-key-card">
              <div class="recovery-key-text">{{ createdRecoveryKey }}</div>
              <div class="recovery-key-actions">
                <q-btn
                  flat
                  color="primary"
                  icon="fas fa-copy"
                  label="Copy Key"
                  @click="copyRecoveryKey"
                />
                <q-btn
                  flat
                  color="primary"
                  icon="fas fa-download"
                  label="Save to File"
                  @click="downloadRecoveryKey"
                />
              </div>
            </div>
            <div class="next-step-actions">
              <q-btn
                color="primary"
                unelevated
                @click="proceedToKeyEntry"
                label="Next: Enter Key to Complete Setup"
                icon-right="fas fa-arrow-right"
              />
            </div>
          </div>
        </template>

        <!-- Step 3: Recovery Key Input (final step or device verification) -->
        <template v-else>
          <div class="banner-content">
            <div class="banner-icon">
              <q-icon name="fas fa-lock" color="warning" size="24px" />
            </div>
            <div class="banner-text">
              <div class="banner-title">{{ needsDeviceVerificationOnly ? 'Verify your device' : 'Complete encryption setup' }}</div>
              <div class="banner-subtitle">{{ needsDeviceVerificationOnly ? 'Enter your recovery key to verify this device' : 'Enter your recovery key to complete setup' }}</div>
            </div>
          </div>
          <div class="recovery-key-input-section">
            <q-input
              v-model="recoveryKeyInput"
              placeholder="Enter your recovery key..."
              outlined
              dense
              class="recovery-key-input"
              :disable="setupInProgress"
              @keyup.enter="handleInlineSetupEncryption"
            >
              <template v-slot:append>
                <q-btn
                  flat
                  round
                  icon="fas fa-arrow-right"
                  color="primary"
                  :loading="setupInProgress"
                  @click="handleInlineSetupEncryption"
                  :disable="!recoveryKeyInput?.trim()"
                />
              </template>
            </q-input>
          </div>
        </template>
      </div>
    </template>

    <!-- Loading State -->
    <div v-else-if="isLoading" class="loading-state">
      <q-spinner size="2rem" />
      <p>Checking Matrix encryption status...</p>
    </div>

    <!-- Chat Interface (Ready for unencrypted or encrypted chat) -->
    <template v-else-if="canChat">

      <!-- Device Verification Notification Banner -->
      <VerificationNotificationBanner
        ref="verificationBannerRef"
        @open-verification-dialog="showVerificationDialog = true"
      />

      <!-- Element Web Style Encryption Warning Banner -->
      <EncryptionWarningBanner
        v-if="needsBanner && warningMessage"
        :warning-message="warningMessage"
        :encryption-state="encryptionStatus?.state || ''"
        @primary-action="handleEncryptionAction"
        @dismiss="dismissEncryptionBanner"
      />

      <!-- Recovery Key Display (after successful setup) -->
      <div v-if="showRecoveryKeyDisplay && createdRecoveryKey && !needsEncryptionSetup" class="recovery-key-success-banner q-pa-md q-mb-md" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px;">
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

      <!-- Encrypted Chat Success Info (show for any encrypted state) -->
      <div v-else-if="isReadyEncrypted" class="encryption-info q-pa-md q-mb-md" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px;">
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
        :is-ready-encrypted="isReadyEncrypted"
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMatrixEncryption } from '../../composables/useMatrixEncryption'
import { matrixClientService } from '../../services/matrixClientService'
import { matrixEncryptionState } from '../../services/matrixEncryptionState'
import { MatrixEncryptionService } from '../../services/MatrixEncryptionService'
import { logger } from '../../utils/logger'
import { useQuasar } from 'quasar'
import UnifiedChatComponent from './UnifiedChatComponent.vue'
import MatrixChatInterface from './MatrixChatInterface.vue'
import EncryptionWarningBanner from './encryption/EncryptionWarningBanner.vue'
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

// Element Web style encryption state
const {
  isLoading,
  canChat,
  needsLogin,
  needsEncryptionSetup,
  needsBanner,
  warningMessage,
  isReadyUnencrypted,
  isReadyEncrypted,
  requiresUserAction,
  encryptionStatus,
  checkEncryptionState,
  initializeEncryption,
  refreshState
} = useMatrixEncryption()

// Simple setup state
const setupInProgress = ref(false)
const recoveryKeyInput = ref('')
const creatingKey = ref(false)
const justCreatedKey = ref(false)
const showRecoveryKeyDisplay = ref(false)
const createdRecoveryKey = ref('')

// Recovery key display state
const recoveryKey = ref('')
const showRecoveryKeyDialog = ref(false)
const recoveryKeySaved = ref(false)

// Encryption service state
const encryptionService = ref<MatrixEncryptionService | null>(null)

// Initialize encryption service when Matrix client is ready
const initializeEncryptionService = () => {
  const client = matrixClientService.getClient()
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

// Proactively show encryption setup when user lacks keys for encrypted room
const shouldShowEncryptionSetup = computed(() => {
  const state = encryptionStatus.value?.state
  const details = encryptionStatus.value?.details

  // Core scenarios requiring setup
  const needsKeys = state === 'needs_recovery_key' ||
                   state === 'needs_key_backup' ||
                   state === 'needs_device_verification' ||
                   state === 'ready_encrypted_with_warning'

  // Check if we have warning messages about backups or key issues
  const hasKeyIssues = needsBanner.value && (
    warningMessage.value?.includes('backup') ||
    warningMessage.value?.includes('key') ||
    warningMessage.value?.includes('trusted')
  )

  // Additional check for users who need encryption setup but aren't in the core states
  // This catches cases like Steve's where device is unverified but state is 'ready_unencrypted'
  const needsEncryptionSetupBasedOnDetails = details && (
    details.isCurrentDeviceTrusted === false ||
    details.hasKeyBackup === false ||
    details.crossSigningReady === false ||
    details.secretStorageReady === false ||
    details.allCrossSigningSecretsCached === false
  )

  // Don't show if encryption is fully working
  const encryptionWorking = state === 'ready_encrypted'

  // Force show in certain cases or when explicitly requested
  const forceShow = forceSetupAfterReset.value

  // Debug logging to understand what's happening
  const shouldShow = (needsKeys || hasKeyIssues || needsEncryptionSetupBasedOnDetails || forceShow) && !encryptionWorking

  // Debug force show removed - real logic is working now
  const debugForceShow = false

  console.log('🔍 Banner trigger debug:', {
    state,
    needsKeys,
    hasKeyIssues,
    needsEncryptionSetupBasedOnDetails,
    encryptionWorking,
    forceShow,
    shouldShow,
    debugForceShow,
    details: details ? {
      hasClient: details.hasClient,
      hasCrypto: details.hasCrypto,
      canChat: details.canChat,
      isCurrentDeviceTrusted: details.isCurrentDeviceTrusted,
      hasKeyBackup: details.hasKeyBackup,
      crossSigningReady: details.crossSigningReady,
      secretStorageReady: details.secretStorageReady,
      allCrossSigningSecretsCached: details.allCrossSigningSecretsCached,
      isInEncryptedRoom: details.isInEncryptedRoom
    } : 'no details'
  })

  return shouldShow || debugForceShow
})

// Detect if user needs to create recovery key first
const needsRecoveryKeyCreation = computed(() => {
  const details = encryptionStatus.value?.details
  const state = encryptionStatus.value?.state

  if (!details) return true

  // IMPORTANT: The encryption state service only provides detailed info for encrypted rooms
  // For unencrypted rooms, it returns 'ready_unencrypted' with minimal details
  // We need to check if we have encryption capability at all, regardless of room type

  const hasClient = details.hasClient
  const hasCrypto = details.hasCrypto

  // If we're in ready_unencrypted state, we need to check if encryption is actually set up
  // by looking at the available details (which may be minimal for unencrypted rooms)
  if (state === 'ready_unencrypted' && hasClient && hasCrypto) {
    // Don't show create button if user just completed the flow or is in progress
    if (justCreatedKey.value || showRecoveryKeyDisplay.value) {
      console.log('🔍 Recovery key creation check (flow in progress):', {
        state,
        justCreatedKey: justCreatedKey.value,
        showRecoveryKeyDisplay: showRecoveryKeyDisplay.value,
        needsCreation: false,
        reason: 'User is in recovery key creation flow'
      })
      return false
    }

    // For unencrypted rooms, we need to actually check if cross-signing and backup exist
    // Only show create button if BOTH cross-signing keys AND backup don't exist
    const missingCrossSigning = details.crossSigningReady === false
    const missingBackup = details.hasKeyBackup === false

    const needsCreation = missingCrossSigning && missingBackup

    console.log('🔍 Recovery key creation check (unencrypted room logic):', {
      state,
      hasClient,
      hasCrypto,
      crossSigningReady: details.crossSigningReady,
      hasKeyBackup: details.hasKeyBackup,
      missingCrossSigning,
      missingBackup,
      needsCreation,
      reason: needsCreation ? 'Missing both cross-signing and backup' : 'Has encryption setup'
    })

    return needsCreation
  }

  // Original logic for encrypted rooms or when we have detailed info
  const hasNoSecretStorage = details.secretStorageReady === false
  const hasNoKeyBackup = details.hasKeyBackup === false
  const hasNoDefaultKeyId = details.hasDefaultKeyId === false
  const crossSigningNotReady = details.crossSigningReady === false
  const deviceNotTrusted = details.isCurrentDeviceTrusted === false
  const secretsNotCached = details.allCrossSigningSecretsCached === false

  const missingComponents = [
    hasNoSecretStorage,
    hasNoKeyBackup,
    hasNoDefaultKeyId,
    crossSigningNotReady,
    deviceNotTrusted,
    secretsNotCached
  ].filter(Boolean).length

  const needsCreation = missingComponents >= 3 && !justCreatedKey.value

  console.log('🔍 Recovery key creation check (detailed logic):', {
    state,
    hasNoSecretStorage,
    hasNoKeyBackup,
    hasNoDefaultKeyId,
    crossSigningNotReady,
    deviceNotTrusted,
    secretsNotCached,
    missingComponents,
    needsCreation,
    justCreatedKey: justCreatedKey.value
  })

  return needsCreation
})

// Detect if we only need device verification (not full key creation)
// This handles cases like after MAS reset where cross-signing and backup exist but device needs verification
const needsDeviceVerificationOnly = computed(() => {
  const details = encryptionStatus.value?.details
  const state = encryptionStatus.value?.state

  if (!details) return false

  // Check if encryption infrastructure is ready but device is not trusted
  const hasEncryptionInfrastructure =
    details.crossSigningReady === true &&
    details.hasKeyBackup === true &&
    details.secretStorageReady === true

  const deviceNotTrusted = details.isCurrentDeviceTrusted === false

  // If we have the infrastructure but device isn't trusted, we just need device verification
  const onlyNeedsDeviceVerification = hasEncryptionInfrastructure && deviceNotTrusted

  console.log('🔍 Device verification only check:', {
    state,
    hasEncryptionInfrastructure,
    crossSigningReady: details.crossSigningReady,
    hasKeyBackup: details.hasKeyBackup,
    secretStorageReady: details.secretStorageReady,
    deviceNotTrusted,
    onlyNeedsDeviceVerification
  })

  return onlyNeedsDeviceVerification
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
    encryptionState: encryptionStatus.value?.state,
    requiresUserAction: requiresUserAction.value
  }
})

// Log debug state when it changes
watch(debugState, (newState) => {
  console.log('🔍 Encryption state debug:', newState)
}, { deep: true })

// Actions
const connectToMatrix = async () => {
  logger.debug('🔗 User requested Matrix connection')
  try {
    // Clear any residual encryption skipped state first
    matrixEncryptionState.clearEncryptionSkipped()

    // Trigger Matrix connection flow
    const client = await matrixClientService.initializeClient(true)
    if (client) {
      matrixClientService.setUserChosenToConnect(true)

      // Re-check state after connection - should default to ready_unencrypted
      await checkEncryptionState(props.inlineRoomId)

      logger.debug('✅ Matrix connected - ready for unencrypted chat')
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
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Use MatrixEncryptionService to create fresh encryption setup
    const { MatrixEncryptionService } = await import('../../services/MatrixEncryptionService')
    const encryptionService = new MatrixEncryptionService(client)

    // Create fresh encryption setup (this will generate a new recovery key)
    const result = await encryptionService.setupEncryption()

    if (!result.success) {
      throw new Error(result.error || 'Failed to create recovery key')
    }

    // Show the recovery key display instead of auto-filling input
    if (result.recoveryKey) {
      createdRecoveryKey.value = result.recoveryKey
      showRecoveryKeyDisplay.value = true
      justCreatedKey.value = true

      logger.debug('✅ Recovery key created, showing display')
      $q.notify({
        type: 'positive',
        message: 'Recovery key created successfully!',
        caption: 'Please save your key before proceeding'
      })
    }

    // Don't refresh state yet - wait for user to save and proceed
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
const proceedToKeyEntry = () => {
  showRecoveryKeyDisplay.value = false
  // Auto-fill the input with the created key
  recoveryKeyInput.value = createdRecoveryKey.value

  $q.notify({
    type: 'info',
    message: 'Ready to complete setup',
    caption: 'Recovery key has been filled in - click the arrow to finish'
  })
}

// Inline recovery key setup handler
const handleInlineSetupEncryption = async () => {
  const recoveryKeyValue = recoveryKeyInput.value?.trim()
  if (!recoveryKeyValue) {
    $q.notify({
      type: 'negative',
      message: 'Please enter your recovery key'
    })
    return
  }

  logger.debug('🔧 Starting inline encryption setup with recovery key')
  setupInProgress.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Use MatrixEncryptionService to properly handle recovery key unlock
    const { MatrixEncryptionService } = await import('../../services/MatrixEncryptionService')
    const encryptionService = new MatrixEncryptionService(client)

    // For device verification, use the integrated unlock process that handles key restoration
    logger.debug(needsDeviceVerificationOnly.value ? '🔐 Device verification needed' : '🔧 Full encryption setup needed')

    const result = await encryptionService.setupEncryption(recoveryKeyValue)

    if (!result.success) {
      throw new Error(result.error || 'Encryption setup failed')
    }

    // The setupEncryption method should have handled key restoration as part of unlockExistingStorage
    // Now just verify the device completed properly
    if (needsDeviceVerificationOnly.value) {
      logger.debug('🔐 Device verification - checking if restoration completed during setup')
      try {
        // Give the restoration a moment to complete
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Check if device verification completed
        const { testAndFixDeviceVerification } = await import('../../utils/deviceVerificationHelper')
        const verificationResult = await testAndFixDeviceVerification()

        if (verificationResult.success && verificationResult.isVerified) {
          logger.debug('✅ Device verification completed after setup')
        } else {
          logger.debug('🔧 Device verification incomplete, attempting manual verification:', verificationResult.error)

          // If automatic verification didn't work, the setupEncryption should have handled the key restoration
          // The device verification helper should now be able to complete the process
        }
      } catch (verificationError) {
        logger.warn('⚠️ Device verification check failed:', verificationError)
      }
    }

    // Clear the input on success
    recoveryKeyInput.value = ''

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
  } catch (error) {
    logger.error('Failed to restore encryption with recovery key:', error)
    $q.notify({
      type: 'negative',
      message: 'Invalid recovery key',
      caption: 'Please check your recovery key and try again'
    })
  } finally {
    setupInProgress.value = false
  }
}

// Element Web style banner handlers
const dismissEncryptionBanner = () => {
  logger.debug('👍 User dismissed encryption banner')
  // For now, just log. In Element Web, this would set a flag to not show again
  // We could implement persistent dismissal later
}

const handleEncryptionAction = async (state: string) => {
  logger.debug('🔐 User clicked encryption action for state:', state)

  switch (state) {
    case 'needs_device_verification':
      // Set up device verification using same flow as preferences "Forgot Recovery Key"
      logger.debug('🔐 Starting device setup and verification flow...')
      await setupDeviceEncryption()
      break
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
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Use unified encryption service to reset and setup encryption
    const encryptionService = new MatrixEncryptionService(client)

    // Step 1: Reset existing encryption
    logger.debug('🔄 Step 1: Resetting existing encryption...')
    const resetResult = await encryptionService.resetEncryption()
    if (!resetResult.success) {
      throw new Error(resetResult.error || 'Reset failed')
    }

    logger.debug('✅ Encryption reset completed, now setting up fresh encryption...')

    // Step 2: Set up fresh encryption with auto-generated recovery key
    logger.debug('🔄 Step 2: Setting up fresh encryption...')
    const setupResult = await encryptionService.setupEncryption()

    if (setupResult.success && setupResult.recoveryKey) {
      // Show the new recovery key to the user
      createdRecoveryKey.value = setupResult.recoveryKey
      showRecoveryKeyDisplay.value = true

      $q.notify({
        type: 'positive',
        message: 'Device encryption setup completed! Please save your new recovery key.',
        timeout: 5000
      })

      // Refresh encryption state
      await refreshState()
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

          // Re-check encryption state
          await checkEncryptionState(props.inlineRoomId)

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

  // Initial state check with room context - should default to ready_unencrypted
  await checkEncryptionState(props.inlineRoomId)

  // Try to initialize chat if we have a client (no forced encryption)
  if (!needsLogin.value) {
    await initializeEncryption(props.inlineRoomId)

    // Re-check encryption state after a brief delay to ensure room is fully loaded
    // This helps detect encryption in rooms where alias resolution initially failed
    if (props.inlineRoomId) {
      setTimeout(async () => {
        logger.debug('🔄 Re-checking encryption state after initialization')
        await checkEncryptionState(props.inlineRoomId)
      }, 3000) // 3 second delay to allow room to be joined and state to sync
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

/* Dark mode support */
.body--dark .banner-title {
  color: var(--q-dark);
}

.body--dark .banner-subtitle {
  color: rgba(255, 255, 255, 0.7);
}

.body--dark .recovery-key-input .q-field__control {
  background: #2d2d2d;
}
</style>
