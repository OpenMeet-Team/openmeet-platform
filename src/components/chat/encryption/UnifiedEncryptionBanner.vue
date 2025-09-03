<template>
  <div v-if="shouldShowBanner" class="unified-encryption-banner" :class="bannerClass">
    <!-- Fully Protected State - Minimal Display -->
    <template v-if="bannerState === 'protected'">
      <div class="banner-content minimal">
        <q-icon name="fas fa-lock" color="positive" size="18px" />
        <span class="banner-message">Chat is protected</span>
      </div>
    </template>

    <!-- Setup Needed State - Action Button -->
    <template v-else-if="bannerState === 'setup-needed'">
      <div class="banner-content">
        <div class="banner-icon">
          <q-icon name="fas fa-shield-alt" size="24px" />
        </div>
        <div class="banner-text">
          <div class="banner-title">Encryption setup needed</div>
          <div class="banner-subtitle">Set up end-to-end encryption to secure your messages. Not setting this up will result in chat history loss.</div>
        </div>
        <div class="banner-actions">
          <q-btn
            color="white"
            text-color="primary"
            size="sm"
            unelevated
            @click="handleSetupEncryption"
            :loading="setupInProgress"
            icon="fas fa-key"
            label="Set Up Encryption"
          />
        </div>
      </div>
    </template>

    <!-- Device Verification State - Recovery Key Input -->
    <template v-else-if="bannerState === 'device-verification'">
      <div class="banner-content">
        <div class="banner-icon">
          <q-icon name="fas fa-lock" color="warning" size="24px" />
        </div>
        <div class="banner-text">
          <div class="banner-title">Verify your device</div>
          <div v-if="setupInProgress" class="banner-progress">
            <div class="progress-steps">
              <div
                v-for="(step, index) in setupProgress.steps"
                :key="step.id"
                class="progress-step"
                :class="{
                  'step-current': index === setupProgress.currentStep,
                  'step-completed': step.status === 'completed',
                  'step-pending': step.status === 'pending'
                }"
              >
                <div class="step-indicator">
                  <q-icon
                    v-if="step.status === 'completed'"
                    name="fas fa-check"
                    size="12px"
                    color="positive"
                  />
                  <q-spinner
                    v-else-if="step.status === 'active'"
                    size="12px"
                    color="primary"
                  />
                  <div v-else class="step-dot"></div>
                </div>
                <div class="step-label">{{ step.label }}</div>
              </div>
            </div>
          </div>
          <div v-else class="banner-subtitle">Enter your recovery key to verify this device</div>
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
          @keyup.enter="handleVerifyDevice"
        >
          <template v-slot:append>
            <q-btn
              flat
              round
              icon="fas fa-arrow-right"
              color="primary"
              :loading="setupInProgress"
              @click="handleVerifyDevice"
              :disable="!recoveryKeyInput?.trim()"
            />
          </template>
        </q-input>

        <!-- Forgot Recovery Key Button -->
        <div class="q-mt-sm text-center">
          <q-btn
            flat
            size="sm"
            color="grey-7"
            icon="fas fa-question-circle"
            label="Forgot recovery key?"
            @click="handleForgotRecoveryKey"
            :disable="setupInProgress"
            class="forgot-key-btn"
          />
        </div>

        <!-- Error Display -->
        <div v-if="errorMessage" class="error-section q-mt-sm">
          <q-banner class="text-white bg-negative">
            <template v-slot:avatar>
              <q-icon name="fas fa-exclamation-triangle" color="white" />
            </template>
            <div class="text-body2">
              <strong>{{ errorMessage }}</strong>
              <div v-if="errorDetails" class="text-caption q-mt-xs">{{ errorDetails }}</div>
            </div>
          </q-banner>
        </div>
      </div>
    </template>

    <!-- Recovery Key Display State - Show Generated Key (styled like bottom banner) -->
    <template v-else-if="bannerState === 'key-display'">
      <div class="text-h6 q-mb-sm" style="color: #155724;">
        <q-icon name="fas fa-key" class="q-mr-sm" />
        Save Your Recovery Key
      </div>
      <p style="color: #155724; margin: 0 0 16px 0;">
        Your device encryption setup is complete! Please save this recovery key securely - you'll need it to recover encrypted messages if you lose access to your devices.
      </p>
      <div class="recovery-key-card">
        <div class="recovery-key-text">{{ displayedRecoveryKey }}</div>
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
            @click="handleKeyConfirmed"
          />
        </div>
      </div>
    </template>

    <!-- Device Reset State - Key Mismatch -->
    <template v-else-if="bannerState === 'device-reset'">
      <div class="banner-content">
        <div class="banner-icon">
          <q-icon name="fas fa-exclamation-triangle" color="negative" size="24px" />
        </div>
        <div class="banner-text">
          <div class="banner-title">Device key mismatch detected</div>
          <div class="banner-subtitle">Your encryption keys are out of sync. Reset device keys to fix chat access.</div>
        </div>
        <div class="banner-actions">
          <q-btn
            color="negative"
            unelevated
            size="sm"
            @click="handleResetDeviceKeys"
            :loading="setupInProgress"
            icon="fas fa-sync"
            label="Reset Device Keys"
          />
        </div>
      </div>
    </template>

    <!-- Warning State - Configurable Warning -->
    <template v-else-if="bannerState === 'warning'">
      <div class="banner-content">
        <q-icon
          :name="warningIcon"
          :color="warningColor"
          size="20px"
        />
        <span class="banner-message">{{ warningMessage }}</span>
        <div class="banner-actions">
          <q-btn
            flat
            dense
            :label="warningAction"
            @click="handleWarningAction"
            class="primary-action"
          />
          <q-btn
            flat
            dense
            label="Dismiss"
            @click="handleDismiss"
            class="secondary-action"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { logger } from '../../../utils/logger'

interface Props {
  /** Current encryption state */
  encryptionState: string
  /** Encryption status details */
  encryptionDetails?: Record<string, unknown>
  /** Warning message (for warning state) */
  warningMessage?: string
  /** Recovery key to display (for key-display state) */
  recoveryKey?: string
  /** Current room ID to check if encryption is needed */
  roomId?: string
  /** Setup progress for device verification */
  setupProgress?: {
    currentStep: number
    steps: Array<{
      id: string
      label: string
      status: 'pending' | 'active' | 'completed'
    }>
  }
  /** Whether setup is in progress */
  setupInProgress?: boolean
  /** Error message to display */
  errorMessage?: string
  /** Error details to display */
  errorDetails?: string
}

interface Emits {
  /** Emitted when user clicks setup encryption */
  (e: 'setup-encryption'): void
  /** Emitted when user enters recovery key */
  (e: 'verify-device', recoveryKey: string): void
  /** Emitted when user clicks forgot recovery key */
  (e: 'forgot-recovery-key'): void
  /** Emitted when user confirms they saved the recovery key */
  (e: 'key-confirmed'): void
  /** Emitted when user clicks primary action in warning state */
  (e: 'warning-action', state: string): void
  /** Emitted when user dismisses the banner */
  (e: 'dismiss'): void
  /** Emitted when user clicks reset device keys */
  (e: 'reset-device-keys'): void
}

const props = withDefaults(defineProps<Props>(), {
  setupInProgress: false
})
const emit = defineEmits<Emits>()
const $q = useQuasar()

// Local state
const recoveryKeyInput = ref('')

// Determine which banner state to show
const bannerState = computed(() => {
  const state = props.encryptionState

  if (props.recoveryKey && !props.setupInProgress) {
    return 'key-display'
  }

  switch (state) {
    case 'ready_encrypted':
      return 'protected'
    case 'needs_key_backup':
    case 'needs_cross_signing':
      return 'setup-needed'
    case 'needs_device_verification':
      return 'device-verification'
    case 'needs_recovery_key':
      return 'setup-needed'
    case 'needs_device_reset':
      return 'device-reset'
    case 'ready_encrypted_with_warning':
      return 'warning'
    default:
      return 'setup-needed'
  }
})

// Whether to show the banner at all
const shouldShowBanner = computed(() => {
  const state = props.encryptionState

  // Never show banner for unencrypted rooms - they don't need encryption setup
  if (state === 'ready_unencrypted') {
    return false
  }

  // Trust the MatrixEncryptionManager's state - if we have a non-unencrypted state,
  // it means we're in an encrypted room or need encryption setup

  // Hide for fully encrypted states without warnings
  if (state === 'ready_encrypted' && bannerState.value === 'protected' && !props.warningMessage) {
    return false
  }

  // Show banner for all other encryption states
  return true
})

// Banner styling
const bannerClass = computed(() => {
  const state = bannerState.value
  return {
    'banner-protected': state === 'protected',
    'banner-setup': state === 'setup-needed',
    'banner-verification': state === 'device-verification',
    'banner-key-display': state === 'key-display',
    'banner-warning': state === 'warning',
    'banner-device-reset': state === 'device-reset'
  }
})

// Warning state computed properties
const warningIcon = computed(() => {
  switch (props.encryptionState) {
    case 'ready_encrypted_with_warning':
      return 'fas fa-shield-alt'
    case 'needs_key_backup':
      return 'fas fa-exclamation-triangle'
    default:
      return 'fas fa-info-circle'
  }
})

const warningColor = computed(() => {
  switch (props.encryptionState) {
    case 'ready_encrypted_with_warning':
      return 'orange-6'
    case 'needs_key_backup':
      return 'orange-6'
    default:
      return 'blue-6'
  }
})

const warningAction = computed(() => {
  switch (props.encryptionState) {
    case 'ready_encrypted_with_warning':
      return 'Set up backup'
    case 'needs_key_backup':
      return 'Turn on backup'
    default:
      return 'Continue'
  }
})

const displayedRecoveryKey = computed(() => props.recoveryKey || '')

// Event handlers
const handleSetupEncryption = () => {
  logger.debug('🔐 User clicked setup encryption')
  emit('setup-encryption')
}

const handleVerifyDevice = () => {
  if (!recoveryKeyInput.value?.trim()) return

  logger.debug('🔐 User submitted recovery key for device verification')
  emit('verify-device', recoveryKeyInput.value.trim())
}

const handleForgotRecoveryKey = () => {
  logger.debug('🔐 User clicked forgot recovery key')
  emit('forgot-recovery-key')
}

const handleKeyConfirmed = () => {
  logger.debug('🔐 User confirmed they saved the recovery key')
  emit('key-confirmed')
}

const handleWarningAction = () => {
  logger.debug('🔐 User clicked warning action for state:', props.encryptionState)
  emit('warning-action', props.encryptionState)
}

const handleDismiss = () => {
  logger.debug('🔐 User dismissed encryption banner')
  emit('dismiss')
}

const handleResetDeviceKeys = () => {
  logger.debug('🔐 User clicked reset device keys')
  emit('reset-device-keys')
}

const copyRecoveryKey = async () => {
  try {
    await navigator.clipboard.writeText(displayedRecoveryKey.value)
    $q.notify({
      type: 'positive',
      message: 'Recovery key copied to clipboard',
      timeout: 3000
    })
  } catch (err) {
    logger.error('Failed to copy recovery key:', err)
    $q.notify({
      type: 'negative',
      message: 'Failed to copy recovery key',
      timeout: 3000
    })
  }
}

const downloadRecoveryKey = () => {
  const element = document.createElement('a')
  const file = new Blob([displayedRecoveryKey.value], { type: 'text/plain' })
  element.href = URL.createObjectURL(file)
  element.download = 'matrix-recovery-key.txt'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)

  $q.notify({
    type: 'positive',
    message: 'Recovery key saved to file',
    timeout: 3000
  })
}
</script>

<style scoped>
.unified-encryption-banner {
  border-radius: 8px;
  margin: 8px 0;
  transition: all 0.3s ease;
}

/* Protected state - minimal green */
.banner-protected {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border: 1px solid #c3e6cb;
  padding: 8px 16px;
}

/* Setup needed - blue (using HistoricalMessageHandler styling) */
.banner-setup {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
  border: 1px solid #2563eb !important;
  border-radius: 8px;
  padding: 12px 16px;
  color: white !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Device verification - orange/warning */
.banner-verification {
  background: linear-gradient(135deg, #e67e22 0%, #d35400 100%) !important;
  border: 1px solid #d35400 !important;
  padding: 16px;
  color: white !important;
}

/* Key display - green success */
.banner-key-display {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  border: 1px solid #c3e6cb;
  padding: 16px;
}

/* Warning - yellow */
.banner-warning {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border: 1px solid #ffeaa7;
  padding: 12px 16px;
}

/* Device reset - red/error */
.banner-device-reset {
  background: linear-gradient(135deg, #f5c6cb 0%, #f1b0b7 100%) !important;
  border: 1px solid #e74c3c !important;
  padding: 16px;
  color: #721c24 !important;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
}

.banner-content.minimal {
  gap: 8px;
  padding: 4px 0;
}

.banner-icon {
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-weight: 600;
  font-size: 14px;
  color: #2c3e50;
  margin-bottom: 2px;
}

.banner-subtitle {
  font-size: 12px;
  color: #6c757d;
  line-height: 1.3;
}

.banner-message {
  flex: 1;
  font-weight: 500;
  font-size: 14px;
  line-height: 1.4;
  color: #2c3e50;
}

/* White text for blue banner - with important to override */
.banner-setup .banner-title {
  color: white !important;
}

.banner-setup .banner-subtitle {
  color: rgba(255, 255, 255, 0.9) !important;
}

.banner-setup .banner-message {
  color: white !important;
}

.banner-setup .banner-icon {
  color: white !important;
}

/* White text for orange verification banner */
.banner-verification .banner-title {
  color: white !important;
}

.banner-verification .banner-subtitle {
  color: rgba(255, 255, 255, 0.9) !important;
}

.banner-verification .banner-message {
  color: white !important;
}

.banner-verification .banner-icon {
  color: white !important;
}

/* Dark text for device reset banner */
.banner-device-reset .banner-title {
  color: #721c24 !important;
  font-weight: 600;
}

.banner-device-reset .banner-subtitle {
  color: #856404 !important;
}

.banner-device-reset .banner-message {
  color: #721c24 !important;
}

.banner-device-reset .banner-icon {
  color: #e74c3c !important;
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.primary-action {
  background: rgba(0, 123, 255, 0.1);
  color: #007bff;
  font-weight: 600;
}

.primary-action:hover {
  background: rgba(0, 123, 255, 0.2);
}

.secondary-action {
  color: #6c757d;
}

.secondary-action:hover {
  background: rgba(108, 117, 125, 0.1);
}

/* Recovery key sections */
.recovery-key-input-section,
.recovery-key-display-section {
  margin-top: 12px;
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

.recovery-key-card {
  background: white;
  border: 2px dashed #28a745;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.recovery-key-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  font-weight: bold;
  color: #2c3e50;
  word-break: break-all;
  margin-bottom: 12px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.recovery-key-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.recovery-actions {
  text-align: center;
}

/* Progress steps */
.banner-progress {
  margin-top: 8px;
}

.progress-steps {
  display: flex;
  gap: 16px;
  align-items: center;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.step-indicator {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.3);
}

.step-current .step-dot {
  background-color: var(--q-primary);
}

.step-label {
  color: #6c757d;
  font-weight: 500;
}

.step-current .step-label {
  color: var(--q-primary);
  font-weight: 600;
}

.step-completed .step-label {
  color: var(--q-positive);
}

.error-section {
  border-radius: 4px;
  overflow: hidden;
}

/* Dark mode */
.body--dark .unified-encryption-banner {
  background: #2d2d2d;
  border-color: #4a4a4a;
  color: #e5e7eb;
}

.body--dark .banner-title {
  color: #e5e7eb;
}

.body--dark .banner-message {
  color: #e5e7eb;
}

.body--dark .recovery-key-input .q-field__control {
  background: #2d2d2d;
}

.body--dark .recovery-key-card {
  background: #1a1a1a;
  border-color: #4a4a4a;
}

.body--dark .recovery-key-text {
  background: #2d2d2d;
  color: #e5e7eb;
}

.body--dark .step-dot {
  background-color: rgba(255, 255, 255, 0.3);
}

/* Responsive design */
@media (max-width: 600px) {
  .banner-content {
    gap: 8px;
  }

  .banner-actions {
    flex-direction: column;
  }

  .progress-steps {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .recovery-key-actions {
    flex-direction: column;
  }
}
</style>
