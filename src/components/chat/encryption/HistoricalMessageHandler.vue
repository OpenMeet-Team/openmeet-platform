<template>
  <div class="historical-message-handler">

    <!-- Setup Encryption Banner (when no backup exists) -->
    <div
      v-if="!status.hasBackup && !status.isUnlocked && props.showStatus"
      class="setup-prompt-banner"
    >
      <div class="banner-content">
        <div class="banner-icon">
          <q-icon name="fas fa-shield-alt" class="icon" />
        </div>
        <div class="banner-text">
          <h4 class="banner-title">Encryption Setup Required</h4>
          <p class="banner-description">
            Set up encryption to secure your message history and decrypt historical messages.
          </p>
        </div>
        <div class="banner-actions">
          <button
            class="setup-button"
            @click="() => triggerEncryptionSetup()"
          >
            <q-icon name="fas fa-key" class="button-icon" />
            Set Up Encryption
          </button>
        </div>
      </div>
    </div>

    <!-- Debug: Force show banner button (temporary) -->
    <div v-if="!shouldShowBanner && needsUnlock" style="background: yellow; padding: 8px; margin: 8px; border-radius: 4px;">
      <strong>🐛 DEBUG: Banner hidden but needsUnlock=true</strong>
      <button @click="() => promptForPassphrase()" style="margin-left: 8px;">Force Show Unlock Dialog</button>
      <div style="font-size: 12px; margin-top: 4px;">
        needsUnlock: {{ needsUnlock }},
        isCurrentRoomEncrypted: {{ isCurrentRoomEncrypted }},
        showStatus: {{ props.showStatus }},
        roomId: {{ props.roomId }}
      </div>
    </div>

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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useHistoricalMessageDecryption } from '../../../composables/useHistoricalMessageDecryption'
import PassphraseUnlockDialog from './PassphraseUnlockDialog.vue'
import { matrixClientService } from '../../../services/matrixClientService'
import { matrixEncryptionState } from '../../../services/matrixEncryptionState'
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

// Local state
const bannerDismissed = ref(false)
const errorDismissed = ref(false)
const isCurrentRoomEncrypted = ref(false)

// Check if current room is encrypted
const checkRoomEncryption = async () => {
  if (!props.roomId) {
    isCurrentRoomEncrypted.value = false
    return
  }

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      isCurrentRoomEncrypted.value = false
      return
    }

    const encryptionStatus = await matrixEncryptionState.getEncryptionState(client, props.roomId)
    isCurrentRoomEncrypted.value = encryptionStatus.details.isInEncryptedRoom ?? false

    logger.debug('🔍 Room encryption check for historical messages:', {
      roomId: props.roomId,
      isEncrypted: isCurrentRoomEncrypted.value
    })
  } catch (error) {
    logger.debug('Failed to check room encryption for historical messages:', error)
    isCurrentRoomEncrypted.value = false
  }
}

// Debug computed for banner visibility
const shouldShowBanner = computed(() => {
  // Don't show banner if:
  // 1. User doesn't need unlock (needsUnlock includes isUnlocked check), OR
  // 2. Unlock dialog is already showing, OR
  // 3. User dismissed the banner, OR
  // 4. showStatus is disabled, OR
  // 5. Room is not encrypted (banner not useful)
  const result = needsUnlock.value &&
                 !showUnlockDialog.value &&
                 !bannerDismissed.value &&
                 props.showStatus &&
                 isCurrentRoomEncrypted.value // Only show in encrypted rooms

  logger.debug('🔐 Banner visibility computed:', {
    needsUnlock: needsUnlock.value,
    showUnlockDialog: showUnlockDialog.value,
    bannerDismissed: bannerDismissed.value,
    showStatus: props.showStatus,
    isCurrentRoomEncrypted: isCurrentRoomEncrypted.value,
    isUnlocked: status.value.isUnlocked,
    hasBackup: status.value.hasBackup,
    roomId: props.roomId,
    result
  })

  // Log when banner should show but doesn't
  if (!result && needsUnlock.value) {
    logger.warn('🚨 Banner should show but is hidden due to:', {
      showUnlockDialog: showUnlockDialog.value ? 'BLOCKING: unlock dialog showing' : 'OK',
      bannerDismissed: bannerDismissed.value ? 'BLOCKING: banner dismissed' : 'OK',
      showStatus: props.showStatus ? 'OK' : 'BLOCKING: showStatus disabled',
      isCurrentRoomEncrypted: isCurrentRoomEncrypted.value ? 'OK' : 'BLOCKING: room not encrypted',
      roomId: props.roomId || 'MISSING'
    })
  }
  return result
})

// Event listeners
let encryptionReadyListener: (() => void) | null = null
let encryptionFailedListener: ((event: CustomEvent) => void) | null = null

onMounted(async () => {
  logger.debug('🔐 HistoricalMessageHandler mounted, initializing...')

  // Initialize the decryption system
  await initialize()

  // Check if current room is encrypted
  await checkRoomEncryption()

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

const triggerEncryptionSetup = () => {
  logger.debug('🔧 User requested encryption setup from HistoricalMessageHandler')

  // Emit an event to trigger the setup flow
  window.dispatchEvent(new CustomEvent('matrix-encryption-setup-requested', {
    detail: { reason: 'no_backup_exists' }
  }))
}

const handleReset = async () => {
  try {
    logger.debug('🔥 Starting encryption reset flow...')

    // Get Matrix client
    const client = matrixClientService.getClient()
    if (!client) {
      logger.error('No Matrix client available for reset')
      return
    }

    // Get crypto API
    const crypto = client.getCrypto()
    if (!crypto) {
      logger.error('No crypto API available for reset')
      return
    }

    // Close the unlock dialog
    closeUnlockDialog()

    // Clear the encryption setup completion flag from account data
    // This is needed to trigger the setup flow restart
    const ENCRYPTION_SETUP_COMPLETE_KEY = 'm.org.matrix.custom.openmeet.encryption_setup_complete'
    try {
      await (client as unknown as { setAccountData: (key: string, data: Record<string, unknown>) => Promise<void> }).setAccountData(ENCRYPTION_SETUP_COMPLETE_KEY, {
        completed: false,
        timestamp: Date.now(),
        reset: true
      })
      logger.debug('🔥 Cleared encryption setup completion flag')
    } catch (error) {
      logger.warn('⚠️ Failed to clear encryption setup flag (continuing anyway):', error)
    }

    // Perform the reset (similar to Element Web)
    logger.debug('🔥 Resetting encryption...')
    await crypto.resetEncryption(() => Promise.resolve())

    logger.debug('✅ Encryption reset completed')

    // Clear any cached encryption state
    await refresh()

    // Emit a custom event to notify the setup orchestrator of the reset
    // This triggers the native Matrix setup flow without page reload
    logger.debug('🔄 Triggering matrix setup reset event...')
    window.dispatchEvent(new CustomEvent('matrix-encryption-reset', {
      detail: { reason: 'forgotten_passphrase' }
    }))
  } catch (error) {
    logger.error('❌ Failed to reset encryption:', error)
    // Show error and allow retry
    errorDismissed.value = false
  }
}

</script>

<style scoped>
.historical-message-handler {
  position: relative;
}

.unlock-prompt-banner,
.setup-prompt-banner,
.error-banner {
  margin-bottom: 16px;
  border-radius: 8px;
  border: 1px solid;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.unlock-prompt-banner,
.setup-prompt-banner {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
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

.banner-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.unlock-button,
.setup-button,
.retry-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.unlock-button:hover:not(:disabled),
.setup-button:hover,
.retry-button:hover {
  background: #2563eb;
}

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
