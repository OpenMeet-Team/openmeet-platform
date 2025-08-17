<template>
  <div class="passphrase-unlock-overlay" @click.self="handleCancel">
    <div class="passphrase-unlock-dialog">
      <div class="dialog-header">
        <h3 class="dialog-title">
          <LockIcon class="title-icon" />
          Unlock Encryption
        </h3>
        <button
          class="close-button"
          @click="handleCancel"
          aria-label="Close"
        >
          <XIcon class="close-icon" />
        </button>
      </div>

      <div class="dialog-content">
        <p class="dialog-description">
          Enter your security key or passphrase to decrypt historical messages.
        </p>

        <form @submit.prevent="handleSubmit" class="unlock-form">
          <div class="input-group">
            <label for="passphrase-input" class="input-label">
              Security Key or Passphrase
            </label>
            <textarea
              id="passphrase-input"
              ref="passphraseInputRef"
              v-model="passphraseInput"
              :disabled="isValidating"
              class="passphrase-textarea"
              :class="{
                'input-valid': validationState === 'valid',
                'input-invalid': validationState === 'invalid'
              }"
              placeholder="Enter your security key or passphrase..."
              rows="2"
              autocomplete="off"
              spellcheck="false"
              @input="handleInputChange"
            />

            <div class="validation-feedback">
              <span v-if="validationState === null" class="feedback-hint">
                You can use either your security key or passphrase
              </span>
              <span v-else-if="validationState === 'valid'" class="feedback-valid">
                ✓ Key verified
              </span>
              <span v-else-if="validationState === 'invalid'" class="feedback-error">
                ✗ Invalid security key or passphrase
              </span>
              <span v-else-if="validationState === 'validating'" class="feedback-validating">
                Validating...
              </span>
            </div>
          </div>

          <div class="dialog-actions">
            <button
              type="button"
              class="action-button secondary"
              @click="handleCancel"
              :disabled="isValidating"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="action-button primary"
              :disabled="!passphraseInput || isValidating || validationState !== 'valid'"
            >
              <span v-if="isValidating">Unlocking...</span>
              <span v-else>Unlock</span>
            </button>
          </div>
        </form>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <!-- Forgot Passphrase Option -->
        <div class="forgot-passphrase-section">
          <button
            type="button"
            class="forgot-passphrase-button"
            @click="handleForgotPassphrase"
            :disabled="isValidating"
          >
            Forgot your passphrase?
          </button>
          <p class="forgot-passphrase-description">
            If you've forgotten your passphrase, you can reset your encryption and set up a new one.
            This will clear your current encryption keys but allow you to start fresh.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { MatrixSecretStorageService } from '../../../services/MatrixSecretStorageService'
import { matrixClientService } from '../../../services/matrixClientService'
import { logger } from '../../../utils/logger'
// Icon placeholders - replace with actual icons from your project
const LockIcon = 'div'
const XIcon = 'div'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'success', keyId: string): void
  (e: 'error', error: string): void
  (e: 'reset'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Reactive state
const passphraseInput = ref('')
const validationState = ref<'valid' | 'invalid' | 'validating' | null>(null)
const isValidating = ref(false)
const errorMessage = ref('')
const passphraseInputRef = ref<HTMLTextAreaElement>()

// Secret storage service
let secretStorageService: MatrixSecretStorageService | null = null

// Validation debounce
let validationTimeout: number | null = null
const VALIDATION_DELAY = 300

onMounted(() => {
  if (props.isVisible) {
    initializeService()
    focusInput()
  }
})

const initializeService = () => {
  const client = matrixClientService.getClient()
  if (client) {
    secretStorageService = new MatrixSecretStorageService(client)
  }
}

const focusInput = async () => {
  await nextTick()
  passphraseInputRef.value?.focus()
}

const handleInputChange = () => {
  errorMessage.value = ''

  // Clear previous validation timeout
  if (validationTimeout) {
    clearTimeout(validationTimeout)
  }

  const input = passphraseInput.value.trim()
  if (!input) {
    validationState.value = null
    return
  }

  // Debounce validation
  validationTimeout = window.setTimeout(() => {
    validateInput(input)
  }, VALIDATION_DELAY)
}

const validateInput = async (input: string) => {
  if (!secretStorageService) {
    logger.error('Secret storage service not initialized')
    return
  }

  try {
    validationState.value = 'validating'
    isValidating.value = true

    const inputType = secretStorageService.detectInputType(input)
    logger.debug(`Input detected as: ${inputType}`)

    let keyParams
    if (inputType === 'recoveryKey') {
      keyParams = { recoveryKey: input }
    } else if (inputType === 'passphrase') {
      keyParams = { passphrase: input }
    } else {
      // Try both formats
      keyParams = { recoveryKey: input }
      const isValidRecovery = await secretStorageService.validateSecretStorageKey(keyParams)
      if (!isValidRecovery) {
        keyParams = { passphrase: input }
      }
    }

    const isValid = await secretStorageService.validateSecretStorageKey(keyParams)
    validationState.value = isValid ? 'valid' : 'invalid'
  } catch (error) {
    logger.error('Validation error:', error)
    validationState.value = 'invalid'
  } finally {
    isValidating.value = false
  }
}

const handleSubmit = async () => {
  if (!secretStorageService || !passphraseInput.value.trim()) {
    return
  }

  try {
    isValidating.value = true
    errorMessage.value = ''

    logger.debug('Attempting to unlock secret storage...')
    const result = await secretStorageService.unlockSecretStorage(passphraseInput.value.trim())

    if (result.success) {
      logger.debug('✅ Secret storage unlocked successfully')
      emit('success', result.keyId || 'unknown')
    } else {
      logger.error('❌ Failed to unlock secret storage:', result.error)
      errorMessage.value = result.error || 'Failed to unlock encryption'
      emit('error', result.error || 'Failed to unlock encryption')
    }
  } catch (error) {
    logger.error('Unlock error:', error)
    const errorMsg = error.message || 'An unexpected error occurred'
    errorMessage.value = errorMsg
    emit('error', errorMsg)
  } finally {
    isValidating.value = false
  }
}

const handleForgotPassphrase = () => {
  logger.debug('🔥 User chose to reset encryption due to forgotten passphrase')

  // Clear sensitive data
  passphraseInput.value = ''
  validationState.value = null
  errorMessage.value = ''

  if (validationTimeout) {
    clearTimeout(validationTimeout)
  }

  // Emit reset event to trigger the reset flow
  emit('reset')
}

const handleCancel = () => {
  // Clear sensitive data
  passphraseInput.value = ''
  validationState.value = null
  errorMessage.value = ''

  if (validationTimeout) {
    clearTimeout(validationTimeout)
  }

  emit('close')
}

// Cleanup on unmount
onUnmounted(() => {
  if (validationTimeout) {
    clearTimeout(validationTimeout)
  }

  // Clear sensitive data
  passphraseInput.value = ''
  validationState.value = null
})
</script>

<style scoped>
.passphrase-unlock-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.passphrase-unlock-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 480px;
  width: 90vw;
  max-height: 90vh;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 24px;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.title-icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
}

.close-button {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  color: #6b7280;
  transition: all 0.2s;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-icon {
  width: 20px;
  height: 20px;
}

.dialog-content {
  padding: 0 24px 24px;
}

.dialog-description {
  margin: 0 0 24px;
  color: #6b7280;
  line-height: 1.5;
}

.unlock-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.passphrase-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.875rem;
  line-height: 1.4;
  resize: vertical;
  min-height: 60px;
  transition: all 0.2s;
}

.passphrase-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.passphrase-textarea.input-valid {
  border-color: #10b981;
}

.passphrase-textarea.input-invalid {
  border-color: #ef4444;
}

.passphrase-textarea:disabled {
  background: #f9fafb;
  cursor: not-allowed;
  opacity: 0.6;
}

.validation-feedback {
  min-height: 20px;
  font-size: 0.875rem;
}

.feedback-hint {
  color: #6b7280;
}

.feedback-valid {
  color: #10b981;
  font-weight: 500;
}

.feedback-error {
  color: #ef4444;
  font-weight: 500;
}

.feedback-validating {
  color: #3b82f6;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.action-button {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.action-button.secondary {
  background: #f3f4f6;
  color: #374151;
}

.action-button.secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.action-button.primary {
  background: #3b82f6;
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  background: #2563eb;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
}

.forgot-passphrase-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.forgot-passphrase-button {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
  margin-bottom: 8px;
}

.forgot-passphrase-button:hover:not(:disabled) {
  color: #2563eb;
}

.forgot-passphrase-button:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.forgot-passphrase-description {
  font-size: 0.8125rem;
  color: #6b7280;
  line-height: 1.4;
  margin: 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .passphrase-unlock-dialog {
    background: #1f2937;
    color: #f9fafb;
  }

  .dialog-header {
    border-bottom-color: #374151;
  }

  .dialog-title {
    color: #f9fafb;
  }

  .close-button:hover {
    background: #374151;
    color: #d1d5db;
  }

  .dialog-description {
    color: #d1d5db;
  }

  .input-label {
    color: #e5e7eb;
  }

  .passphrase-textarea {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .passphrase-textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .passphrase-textarea:disabled {
    background: #1f2937;
  }

  .feedback-hint {
    color: #9ca3af;
  }

  .action-button.secondary {
    background: #374151;
    color: #d1d5db;
  }

  .action-button.secondary:hover:not(:disabled) {
    background: #4b5563;
  }

  .error-message {
    background: #1f1d1d;
    border-color: #4c1d1d;
    color: #fca5a5;
  }
}
</style>
