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

    <!-- Encryption Setup Required (only for recovery key needs) -->
    <template v-else-if="shouldShowEncryptionSetup">
      <div class="encryption-setup-required">
        <div class="setup-container">
          <h2>Encryption Setup Required</h2>
          <p>This room requires encryption. Please set up encryption to continue.</p>
          <MatrixEducationIntro
            v-if="setupStep === 'education'"
            @continue="handleEducationComplete"
            @skip="goBackToUnencryptedRooms"
          />
          <MatrixConnectionFlow
            v-else-if="setupStep === 'connection'"
            @continue="handleConnectionComplete"
            @back="setupStep = 'education'"
            :homeserver-url="homeserverUrl"
          />
        </div>
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
import getEnv from '../../utils/env'
import UnifiedChatComponent from './UnifiedChatComponent.vue'
import MatrixChatInterface from './MatrixChatInterface.vue'
import MatrixEducationIntro from './setup/MatrixEducationIntro.vue'
import MatrixConnectionFlow from './setup/MatrixConnectionFlow.vue'
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

// Setup flow state
const setupStep = ref<'education' | 'connection'>('education')

// Recovery key display state
const recoveryKey = ref('')
const showRecoveryKeyDialog = ref(false)
const recoveryKeySaved = ref(false)

// Encryption service state
const encryptionService = ref<MatrixEncryptionService | null>(null)
const setupInProgress = ref(false)

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

// Configuration
const homeserverUrl = computed(() => {
  return (getEnv('APP_MATRIX_HOMESERVER_URL') as string) || 'https://matrix.openmeet.net'
})

// Only show full encryption setup screen when encryption is truly broken
// Note: ready_encrypted_with_warning means encryption is working, just show banner instead
const shouldShowEncryptionSetup = computed(() => {
  const state = encryptionStatus.value?.state
  const needsRecoveryKeySetup = state === 'needs_recovery_key'
  // Don't show setup screen if encryption is working (even with warnings)
  const encryptionIsWorking = state === 'ready_encrypted_with_warning' || state === 'ready_encrypted'

  return (needsRecoveryKeySetup || forceSetupAfterReset.value) && !encryptionIsWorking
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

// Setup flow handlers
const handleEducationComplete = () => {
  setupStep.value = 'connection'
}

const handleConnectionComplete = async () => {
  // Clear the force setup flag when user completes the setup flow
  forceSetupAfterReset.value = false
  logger.debug('🔗 Matrix connection complete, initializing encryption')
  setupInProgress.value = true

  try {
    // Initialize Matrix client if needed
    logger.debug('🔗 Ensuring Matrix client is ready')
    let client = matrixClientService.getClient()

    if (!client) {
      logger.debug('🔄 Initializing new Matrix client')
      client = await matrixClientService.initializeClient(true)
      if (!client) {
        throw new Error('Failed to initialize Matrix client')
      }
    }

    matrixClientService.setUserChosenToConnect(true)
    logger.debug('✅ Matrix client ready')

    // Initialize encryption service
    initializeEncryptionService()
    if (!encryptionService.value) {
      throw new Error('Failed to initialize encryption service')
    }

    // Show passphrase input dialog
    await showPassphraseDialog()
  } catch (error) {
    logger.error('❌ Failed to complete Matrix connection:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to set up encryption',
      caption: error.message || 'Please try again'
    })
  } finally {
    setupInProgress.value = false
  }
  setupStep.value = 'education'
}

// Handler for going back to unencrypted rooms
const goBackToUnencryptedRooms = () => {
  logger.debug('⬅️ User chose to go back to unencrypted rooms')
  // Emit event to parent to navigate away from encrypted room
  // For now, just dismiss the setup and let user manually navigate
  setupStep.value = 'education'
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

// Recovery key dialog methods
const closeRecoveryKeyDialog = () => {
  if (recoveryKeySaved.value) {
    showRecoveryKeyDialog.value = false
    recoveryKey.value = ''
    recoveryKeySaved.value = false
  }
}

const copyRecoveryKey = async () => {
  try {
    await navigator.clipboard.writeText(recoveryKey.value)
    logger.debug('✅ Recovery key copied to clipboard')
  } catch (error) {
    logger.error('❌ Failed to copy recovery key:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = recoveryKey.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

const downloadRecoveryKey = () => {
  const element = document.createElement('a')
  const file = new Blob([
    'OpenMeet Recovery Key\n',
    `Generated: ${new Date().toISOString()}\n`,
    '\n',
    `Recovery Key:\n${recoveryKey.value}\n`,
    '\n',
    'IMPORTANT: Store this key safely. You need it to unlock your encrypted messages if you forget your passphrase.\n'
  ], { type: 'text/plain' })
  element.href = URL.createObjectURL(file)
  element.download = `openmeet-recovery-key-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  URL.revokeObjectURL(element.href)
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
    setupStep.value = 'education'

    // Force the encryption setup UI to show after reset
    forceSetupAfterReset.value = true

    // Refresh encryption state
    await refreshState()

    logger.debug('🔄 Restarted setup flow from education step after reset')
    logger.debug('🔍 Post-reset state:', {
      needsEncryptionSetup: needsEncryptionSetup.value,
      shouldShowEncryptionSetup: shouldShowEncryptionSetup.value,
      forceSetupAfterReset: forceSetupAfterReset.value,
      setupStep: setupStep.value,
      debugState: debugState.value
    })
  }

  window.addEventListener('matrix-encryption-reset', encryptionResetListener as (event: Event) => void)

  // Listen for encryption setup requests
  encryptionSetupListener = async (event: CustomEvent) => {
    logger.debug('🔧 Received encryption setup request:', event.detail)

    // Force the setup flow to show
    forceSetupAfterReset.value = true
    setupStep.value = 'education'

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
</style>
