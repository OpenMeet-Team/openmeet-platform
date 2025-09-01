<template>
  <div class="historical-message-handler">

    <!-- Setup Encryption Banner removed - now handled by UnifiedEncryptionBanner -->

    <!-- Unlock Prompt Banner -->
    <div
      v-if="shouldShowBanner"
      class="unlock-prompt-banner"
    >
      <div class="banner-content">
        <div class="banner-icon">
          <q-icon name="fas fa-unlock" class="icon" />
        </div>
        <div class="banner-text">
          <h4 class="banner-title">Historical Messages Available</h4>
          <p class="banner-description">
            {{ unlockRecommendation }}
          </p>
        </div>
        <div class="banner-actions">
          <button
            class="unlock-button"
            @click="() => promptForPassphrase()"
            :disabled="!canAttemptUnlock"
          >
            <q-icon name="fas fa-key" class="button-icon" />
            Unlock Messages
          </button>
          <button
            class="dismiss-button"
            @click="dismissBanner"
            title="Dismiss"
          >
            <q-icon name="fas fa-times" class="button-icon" />
          </button>
        </div>
      </div>
    </div>

    <!-- Status Indicator (when unlocked) -->
    <div
      v-if="status.isUnlocked"
      class="status-indicator unlocked"
    >
      <q-icon name="fas fa-check-circle" class="status-icon" />
      <span class="status-text">Historical messages unlocked</span>
      <button
        class="reset-anyway-button"
        @click="showResetOptions"
        title="Reset encryption anyway"
      >
        <q-icon name="fas fa-cog" class="button-icon" />
      </button>
    </div>

    <!-- Error Banner -->
    <div
      v-if="status.error && !showUnlockDialog && !errorDismissed && props.showStatus"
      class="error-banner"
    >
      <div class="banner-content">
        <div class="banner-icon error">
          <q-icon name="fas fa-exclamation-triangle" class="icon" />
        </div>
        <div class="banner-text">
          <h4 class="banner-title">Encryption Error</h4>
          <p class="banner-description">{{ status.error }}</p>
        </div>
        <div class="banner-actions">
          <button
            class="retry-button"
            @click="handleRetry"
          >
            <q-icon name="fas fa-redo" class="button-icon" />
            Retry
          </button>
          <button
            class="dismiss-button"
            @click="dismissError"
          >
            <q-icon name="fas fa-times" class="button-icon" />
          </button>
        </div>
      </div>
    </div>

    <!-- Passphrase Unlock Dialog -->
    <PassphraseUnlockDialog
      v-if="showUnlockDialog"
      :is-visible="showUnlockDialog"
      @close="closeUnlockDialog"
      @success="handleUnlockSuccess"
      @error="handleUnlockError"
      @reset="handleReset"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useHistoricalMessageDecryption } from '../../../composables/useHistoricalMessageDecryption'
import { useReactiveMatrixEncryption } from '../../../composables/useReactiveMatrixEncryption'
import PassphraseUnlockDialog from './PassphraseUnlockDialog.vue'
import { matrixClientService } from '../../../services/matrixClientService'
import { logger } from '../../../utils/logger'

interface Props {
  autoPrompt?: boolean
  showStatus?: boolean
  roomId?: string // Add room ID to check if room is encrypted
}

const props = withDefaults(defineProps<Props>(), {
  autoPrompt: true,
  showStatus: true
})

// Historical message decryption composable
const {
  status,
  showUnlockDialog,
  canAttemptUnlock,
  needsUnlock,
  unlockRecommendation,
  initialize,
  promptForPassphrase,
  closeUnlockDialog,
  refresh,
  handleUnlockSuccess,
  handleUnlockError
} = useHistoricalMessageDecryption()

// Reactive Matrix encryption state composable (event-driven, no polling)
const { isReadyEncrypted, encryptionStatus, isInitialized } = useReactiveMatrixEncryption()

// Add debug logging when reactive encryption state changes
watch(encryptionStatus, (newState) => {
  logger.debug('🚀 REACTIVE encryption state changed:', {
    newState: newState?.state,
    isReadyEncrypted: isReadyEncrypted.value,
    roomId: props.roomId
  })
}, { deep: true })

// Local state
const bannerDismissed = ref(false)
const errorDismissed = ref(false)
const showResetDialog = ref(false)

// Banner visibility logic - much simpler with event-driven state (no stability logic needed)
const shouldShowBanner = computed(() => {
  const result = needsUnlock.value &&
                 !showUnlockDialog.value &&
                 !bannerDismissed.value &&
                 props.showStatus &&
                 isReadyEncrypted.value // Direct use of reactive state, no flashing

  logger.debug('🔐 Banner visibility computed (REACTIVE):', {
    needsUnlock: needsUnlock.value,
    showUnlockDialog: showUnlockDialog.value,
    bannerDismissed: bannerDismissed.value,
    showStatus: props.showStatus,
    isReadyEncrypted: isReadyEncrypted.value,
    isUnlocked: status.value.isUnlocked,
    hasBackup: status.value.hasBackup,
    roomId: props.roomId,
    result,
    // Show reactive encryption status
    reactiveEncryptionState: encryptionStatus.value?.state,
    isInitialized: isInitialized.value,
    bannerCondition: {
      hasBackup: status.value.hasBackup,
      isUnlocked: status.value.isUnlocked,
      showStatus: props.showStatus,
      isReadyEncrypted: isReadyEncrypted.value,
      shouldShowBanner: !status.value.hasBackup && !status.value.isUnlocked && props.showStatus && !isReadyEncrypted.value
    }
  })

  // Log when banner should show but doesn't
  if (!result && needsUnlock.value) {
    logger.warn('🚨 Banner should show but is hidden due to:', {
      showUnlockDialog: showUnlockDialog.value ? 'BLOCKING: unlock dialog showing' : 'OK',
      bannerDismissed: bannerDismissed.value ? 'BLOCKING: banner dismissed' : 'OK',
      showStatus: props.showStatus ? 'OK' : 'BLOCKING: showStatus disabled',
      isReadyEncrypted: isReadyEncrypted.value ? 'OK' : 'BLOCKING: room not encrypted',
      roomId: props.roomId || 'MISSING'
    })
  }
  return result
})

// Event listeners
let encryptionReadyListener: (() => void) | null = null
let encryptionFailedListener: ((event: CustomEvent) => void) | null = null

onMounted(async () => {
  logger.debug('🔐 HistoricalMessageHandler mounted, initializing with REACTIVE encryption state...')

  // Initialize the decryption system
  await initialize()

  // The reactive encryption state is automatically initialized by the composable
  // No manual state checking needed - it's event-driven!
  logger.debug('🔍 Reactive encryption state initialized for room:', props.roomId, 'state:', encryptionStatus.value?.state)

  // Set up event listeners for encryption events
  setupEventListeners()

  // Debug current state after initialization
  logger.debug('🔐 HistoricalMessageHandler initialized:', {
    needsUnlock: needsUnlock.value,
    hasBackup: status.value.hasBackup,
    isUnlocked: status.value.isUnlocked,
    canAttemptUnlock: canAttemptUnlock.value,
    autoPrompt: props.autoPrompt,
    bannerDismissed: bannerDismissed.value
  })

  // Auto-prompt logic - just ensure banner is visible if needed
  if (props.autoPrompt && needsUnlock.value && !bannerDismissed.value) {
    logger.debug('🔐 Auto-prompt conditions met - banner should be visible')
    logger.debug('🔐 Banner visibility check:', {
      needsUnlock: needsUnlock.value,
      showUnlockDialog: showUnlockDialog.value,
      bannerDismissed: bannerDismissed.value,
      showStatus: props.showStatus,
      shouldShowBanner: needsUnlock.value && !showUnlockDialog.value && !bannerDismissed.value && props.showStatus
    })
  } else {
    logger.debug('🔐 Auto-prompt skipped:', {
      autoPrompt: props.autoPrompt,
      needsUnlock: needsUnlock.value,
      bannerDismissed: bannerDismissed.value
    })
  }
})

onUnmounted(() => {
  cleanupEventListeners()
})

const setupEventListeners = () => {
  encryptionReadyListener = () => {
    // Refresh status when encryption becomes ready
    logger.debug('🔐 Encryption ready event received, refreshing decryption status')
    refresh()
  }

  encryptionFailedListener = (event: CustomEvent) => {
    // Handle encryption failures
    logger.warn('Encryption failed event:', event.detail)
  }

  // Listen for Matrix encryption events
  window.addEventListener('matrix-encryption-ready', encryptionReadyListener)
  window.addEventListener('matrix-encryption-failed', encryptionFailedListener as (event: Event) => void)

  // Also listen for secret storage unlock events
  window.addEventListener('matrix-secret-storage-ready', encryptionReadyListener)
}

const cleanupEventListeners = () => {
  if (encryptionReadyListener) {
    window.removeEventListener('matrix-encryption-ready', encryptionReadyListener)
    window.removeEventListener('matrix-secret-storage-ready', encryptionReadyListener)
  }
  if (encryptionFailedListener) {
    window.removeEventListener('matrix-encryption-failed', encryptionFailedListener as (event: Event) => void)
  }
}

const dismissBanner = () => {
  bannerDismissed.value = true
}

const dismissError = () => {
  errorDismissed.value = true
}

const handleRetry = async () => {
  errorDismissed.value = false
  await refresh()

  if (needsUnlock.value) {
    promptForPassphrase()
  }
}

// triggerEncryptionSetup function removed - now handled by UnifiedEncryptionBanner

const handleReset = async () => {
  try {
    logger.debug('🔄 Starting unified encryption reset...')

    // Get Matrix client
    const client = matrixClientService.getClient()
    if (!client) {
      logger.error('No Matrix client available for reset')
      return
    }

    // Close any open dialogs
    closeUnlockDialog()
    showResetDialog.value = false

    // Use the unified reset service
    const { MatrixResetService } = await import('../../../services/MatrixResetService')
    const resetService = new MatrixResetService(client)

    // Perform unlock failed reset (preserves connection, sets up new encryption)
    const resetResult = await resetService.performReset({
      resetType: 'unlock_failed',
      clearLocalData: false,
      forceReconnection: false
    })

    if (resetResult.success) {
      logger.debug('✅ Unified reset completed successfully')

      // Clear any cached encryption state
      await refresh()

      // Show success message if we got a recovery key
      if (resetResult.recoveryKey) {
        logger.info('🔑 New recovery key generated - user should save it')
        // TODO: Show recovery key to user in a proper dialog
        const { Notify } = await import('quasar')
        Notify.create({
          type: 'positive',
          message: 'Encryption reset successfully! New recovery key generated.',
          timeout: 5000,
          actions: [
            {
              label: 'View Key',
              color: 'white',
              handler: () => {
                // TODO: Show recovery key dialog
                logger.info('Recovery key:', resetResult.recoveryKey)
              }
            }
          ]
        })
      }
    } else {
      logger.error('❌ Unified reset failed:', resetResult.error)
      // Show error and allow retry
      errorDismissed.value = false
      throw new Error(resetResult.error || 'Reset failed')
    }
  } catch (error) {
    logger.error('❌ Failed to reset encryption:', error)
    // Show error and allow retry
    errorDismissed.value = false
  }
}

const showResetOptions = async () => {
  const { Dialog } = await import('quasar')

  Dialog.create({
    title: 'Reset Encryption Options',
    message: 'Encryption is currently working. Are you sure you want to reset it?',
    options: {
      type: 'radio',
      model: 'forgot_recovery_key',
      items: [
        { label: 'I forgot my recovery key (generate new one)', value: 'forgot_recovery_key' },
        { label: 'Keys seem mismatched (fix verification)', value: 'key_mismatch' },
        { label: 'Complete reset (nuclear option)', value: 'complete' }
      ]
    },
    cancel: true,
    persistent: true
  }).onOk(async (resetType: string) => {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.error('No Matrix client available for reset')
        return
      }

      const { MatrixResetService } = await import('../../../services/MatrixResetService')
      const resetService = new MatrixResetService(client)

      const resetResult = await resetService.performReset({
        resetType: resetType as 'forgot_recovery_key' | 'unlock_failed' | 'key_mismatch' | 'complete',
        clearLocalData: resetType === 'complete',
        forceReconnection: resetType === 'complete'
      })

      if (resetResult.success) {
        await refresh()

        const { Notify } = await import('quasar')
        Notify.create({
          type: 'positive',
          message: `${resetType.replace('_', ' ')} completed successfully!`,
          timeout: 3000
        })
      } else {
        throw new Error(resetResult.error || 'Reset failed')
      }
    } catch (error) {
      logger.error('Reset options failed:', error)
      const { Notify } = await import('quasar')
      Notify.create({
        type: 'negative',
        message: `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timeout: 5000
      })
    }
  })
}

</script>

<style scoped>
.historical-message-handler {
  position: relative;
}

.unlock-prompt-banner,
.error-banner {
  margin-bottom: 16px;
  border-radius: 8px;
  border: 1px solid;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.unlock-prompt-banner {
  border-color: #2563eb;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.error-banner {
  border-color: #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
}

.banner-content {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}

.banner-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
}

.banner-icon.error {
  background: rgba(254, 226, 226, 0.8);
}

.icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
}

.banner-icon.error .icon {
  color: #ef4444;
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.banner-title {
  margin: 0 0 4px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.banner-description {
  margin: 0;
  font-size: 0.8125rem;
  color: #4b5563;
  line-height: 1.4;
}

/* White text for blue banners */
.unlock-prompt-banner .banner-title {
  color: white !important;
}

.unlock-prompt-banner .banner-description {
  color: rgba(255, 255, 255, 0.9) !important;
}

.banner-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.unlock-button,
.unlock-button:hover:not(:disabled),
.unlock-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.dismiss-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.7);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.dismiss-button:hover {
  background: rgba(255, 255, 255, 0.9);
}

.button-icon {
  width: 14px;
  height: 14px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 12px;
}

.status-indicator.unlocked {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  justify-content: space-between;
}

.reset-anyway-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(6, 95, 70, 0.1);
  border: 1px solid rgba(6, 95, 70, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: #065f46;
}

.reset-anyway-button:hover {
  background: rgba(6, 95, 70, 0.2);
  border-color: rgba(6, 95, 70, 0.3);
}

.status-icon {
  width: 16px;
  height: 16px;
}

.status-text {
  font-size: 0.8125rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .unlock-prompt-banner,
  .error-banner {
    background: #1f2937;
    border-color: #374151;
  }

  .unlock-prompt-banner {
    background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%);
  }

  .error-banner {
    background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%);
  }

  .banner-title {
    color: #f9fafb;
  }

  .banner-description {
    color: #d1d5db;
  }

  .banner-icon {
    background: rgba(31, 41, 55, 0.8);
  }

  .banner-icon.error {
    background: rgba(127, 29, 29, 0.8);
  }

  .icon {
    color: #60a5fa;
  }

  .banner-icon.error .icon {
    color: #fca5a5;
  }

  .dismiss-button {
    background: rgba(31, 41, 55, 0.7);
    color: #d1d5db;
  }

  .dismiss-button:hover {
    background: rgba(31, 41, 55, 0.9);
  }

  .status-indicator.unlocked {
    background: #064e3b;
    color: #6ee7b7;
    border-color: #047857;
  }
}

/* Responsive design */
@media (max-width: 640px) {
  .banner-content {
    padding: 12px;
    gap: 8px;
  }

  .banner-text {
    min-width: 0;
  }

  .banner-title {
    font-size: 0.8125rem;
  }

  .banner-description {
    font-size: 0.75rem;
  }

  .unlock-button,
  .retry-button {
    padding: 6px 10px;
    font-size: 0.75rem;
  }

  .banner-actions {
    gap: 6px;
  }
}
</style>
