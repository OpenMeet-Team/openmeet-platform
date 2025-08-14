<template>
  <div class="chat-encryption-progress">
    <q-page class="flex flex-center q-pa-md">
      <div class="progress-content" style="max-width: 500px; width: 100%;">

        <!-- Header -->
        <div class="text-center q-mb-xl">
          <q-icon
            :name="currentIcon"
            :size="iconSize"
            :color="iconColor"
            class="q-mb-md progress-icon"
          />
          <div class="text-h4 text-weight-medium q-mb-sm">{{ currentTitle }}</div>
          <div class="text-subtitle1 text-grey-7">
            {{ currentSubtitle }}
          </div>
        </div>

        <!-- Progress Steps -->
        <div v-if="!hasError && !isComplete" class="progress-steps q-mb-xl">
          <!-- Step 1: Creating Keys -->
          <div class="step-item row items-center q-mb-lg" :class="{ 'step-active': currentStep >= 1, 'step-complete': currentStep > 1 }">
            <q-spinner-dots
              v-if="currentStep === 1"
              color="primary"
              size="24px"
              class="q-mr-md"
            />
            <q-icon
              v-else
              :name="currentStep > 1 ? 'fas fa-check-circle' : 'far fa-circle'"
              :color="currentStep > 1 ? 'green' : 'grey-5'"
              size="24px"
              class="q-mr-md"
            />
            <div class="col">
              <div class="text-subtitle2">Creating encryption keys</div>
              <div class="text-caption text-grey-6">Generating secure cryptographic keys</div>
            </div>
          </div>

          <!-- Step 2: Setting up Backup -->
          <div class="step-item row items-center q-mb-lg" :class="{ 'step-active': currentStep >= 2, 'step-complete': currentStep > 2 }">
            <q-spinner-dots
              v-if="currentStep === 2"
              color="primary"
              size="24px"
              class="q-mr-md"
            />
            <q-icon
              v-else
              :name="currentStep > 2 ? 'fas fa-check-circle' : 'far fa-circle'"
              :color="currentStep > 2 ? 'green' : 'grey-5'"
              size="24px"
              class="q-mr-md"
            />
            <div class="col">
              <div class="text-subtitle2">Setting up secure backup</div>
              <div class="text-caption text-grey-6">Configuring encrypted message history</div>
            </div>
          </div>

          <!-- Step 3: Finalizing -->
          <div class="step-item row items-center" :class="{ 'step-active': currentStep >= 3, 'step-complete': currentStep > 3 }">
            <q-spinner-dots
              v-if="currentStep === 3"
              color="primary"
              size="24px"
              class="q-mr-md"
            />
            <q-icon
              v-else
              :name="currentStep > 3 ? 'fas fa-check-circle' : 'far fa-circle'"
              :color="currentStep > 3 ? 'green' : 'grey-5'"
              size="24px"
              class="q-mr-md"
            />
            <div class="col">
              <div class="text-subtitle2">Finalizing setup</div>
              <div class="text-caption text-grey-6">Completing encryption configuration</div>
            </div>
          </div>
        </div>

        <!-- Success State -->
        <div v-if="isComplete && !hasError" class="success-section q-mb-xl">
          <q-card flat bordered class="success-card">
            <q-card-section class="q-pa-lg text-center">
              <q-icon name="fas fa-check-circle" color="green" size="48px" class="q-mb-md" />
              <div class="text-h6 text-green q-mb-sm">Setup Complete!</div>
              <div class="text-body2 text-grey-7">
                Your secure chat is now ready. Messages will be encrypted end-to-end
                and your conversation history is safely backed up.
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Error State -->
        <div v-if="hasError" class="error-section q-mb-xl">
          <q-card flat bordered class="error-card">
            <q-card-section class="q-pa-md">
              <div class="row items-start">
                <q-icon name="fas fa-exclamation-circle" color="red" size="24px" class="q-mr-sm q-mt-xs" />
                <div class="col">
                  <div class="text-subtitle2 text-red q-mb-xs">Setup Failed</div>
                  <div class="text-body2 text-grey-7 q-mb-md">
                    {{ errorMessage }}
                  </div>
                  <div v-if="isTimeout" class="text-caption text-grey-6 q-mb-sm">
                    The setup process took longer than expected. This can happen with slower connections.
                  </div>
                  <div class="text-caption text-grey-6">
                    You can retry the setup or continue with basic chat functionality.
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Overall Progress Bar -->
        <div v-if="!isComplete && !hasError" class="overall-progress q-mb-xl">
          <div class="progress-info row items-center q-mb-sm">
            <div class="col text-body2 text-grey-7">Setting up encryption...</div>
            <div class="col-auto text-caption text-grey-6">{{ Math.round(overallProgress * 100) }}%</div>
          </div>
          <q-linear-progress
            :value="overallProgress"
            color="primary"
            size="8px"
            rounded
            :indeterminate="currentStep === 0"
          />
        </div>

        <!-- Time Estimate -->
        <div v-if="!isComplete && !hasError" class="time-estimate text-center q-mb-xl">
          <div class="text-caption text-grey-6">
            <q-icon name="fas fa-clock" class="q-mr-xs" />
            This may take a moment...
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <!-- Continue Button (when complete) -->
          <q-btn
            v-if="isComplete && !hasError"
            unelevated
            color="green"
            size="lg"
            class="full-width q-mb-md"
            @click="handleComplete"
            :loading="loading"
          >
            <q-icon name="fas fa-comments" class="q-mr-sm" />
            Start Chatting
          </q-btn>

          <!-- Retry Button (on error) -->
          <q-btn
            v-if="hasError"
            unelevated
            color="primary"
            size="lg"
            class="full-width q-mb-md"
            @click="handleRetry"
            :loading="loading"
          >
            <q-icon name="fas fa-redo-alt" class="q-mr-sm" />
            Try Setup Again
          </q-btn>

          <!-- Clear Matrix Data Button (on MAC errors) -->
          <q-btn
            v-if="hasError && (errorMessage.includes('MAC') || errorMessage.includes('decrypt'))"
            outline
            color="orange"
            size="md"
            class="full-width q-mb-md"
            @click="handleClearMatrixData"
            :loading="clearingData"
          >
            <q-icon name="fas fa-broom" class="q-mr-sm" />
            Clear Matrix Data & Retry
          </q-btn>

          <!-- Skip Button (on error) -->
          <q-btn
            v-if="hasError"
            flat
            color="grey-7"
            size="md"
            class="full-width q-mb-md"
            @click="handleSkip"
            :disable="loading"
          >
            Continue with Basic Chat
          </q-btn>

          <!-- Cancel Button (during setup) -->
          <q-btn
            v-if="!isComplete && !hasError"
            flat
            color="grey-7"
            size="md"
            class="full-width"
            @click="handleCancel"
            :disable="loading"
          >
            Cancel Setup
          </q-btn>
        </div>

        <!-- Technical Details -->
        <div v-if="hasError" class="technical-details q-mt-lg">
          <q-expansion-item
            icon="fas fa-code"
            label="Technical details"
            class="text-grey-7"
            header-style="padding: 8px 0;"
          >
            <div class="text-caption text-grey-7 q-pa-sm" style="font-family: monospace;">
              Error: {{ errorDetails || 'Unknown error occurred' }}<br>
              Step: {{ failedStep || 'Unknown step' }}<br>
              Time: {{ new Date().toISOString() }}
            </div>
          </q-expansion-item>
        </div>
      </div>
    </q-page>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { matrixClientService } from '../../../services/matrixClientService'

interface Props {
  passphrase: string
  mode?: 'new-setup' | 'unlock-existing'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  complete: []
  error: [error: string]
}>()

// State
const currentStep = ref(0)
const loading = ref(false)
const hasError = ref(false)
const isComplete = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')
const failedStep = ref('')
const isTimeout = ref(false)
const clearingData = ref(false)

// Computed UI State
const currentIcon = computed(() => {
  if (hasError.value) return 'fas fa-exclamation-circle'
  if (isComplete.value) return 'fas fa-check-circle'
  return 'fas fa-cog'
})

const iconSize = computed(() => {
  return hasError.value || isComplete.value ? '64px' : '48px'
})

const iconColor = computed(() => {
  if (hasError.value) return 'red'
  if (isComplete.value) return 'green'
  return 'primary'
})

const currentTitle = computed(() => {
  if (hasError.value) return 'Setup Failed'
  if (isComplete.value) return 'Encryption Ready!'
  return props.mode === 'unlock-existing' ? 'Unlocking Encryption...' : 'Setting Up Encryption...'
})

const currentSubtitle = computed(() => {
  if (hasError.value) return 'Something went wrong during setup'
  if (isComplete.value) return 'Your secure chat is ready to use'
  return props.mode === 'unlock-existing'
    ? 'Please wait while we unlock your existing encryption'
    : 'Please wait while we configure your encryption'
})

const overallProgress = computed(() => {
  if (hasError.value) return 0
  if (isComplete.value) return 1
  return (currentStep.value - 0.5) / 3 // Adjust for smoother progress
})

// Setup timeout
let setupTimeout: ReturnType<typeof setTimeout> | null = null

// Methods
const performEncryptionSetup = async () => {
  try {
    // Get Matrix client and encryption service
    const client = await matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const encryptionService = matrixClientService.getEncryptionService()
    if (!encryptionService) {
      throw new Error('Encryption service not available')
    }

    const isUnlockMode = props.mode === 'unlock-existing'

    if (isUnlockMode) {
      // Existing passphrase unlock flow - faster since we're just validating
      currentStep.value = 1
      const result = await encryptionService.unlockWithExistingPassphrase(props.passphrase)

      if (!result.success) {
        throw new Error(result.error || 'Failed to unlock with existing passphrase')
      }

      // Complete quickly for unlock
      currentStep.value = 4
      await new Promise(resolve => setTimeout(resolve, 500))
      isComplete.value = true
    } else {
      // New setup flow - full bootstrap process
      // Step 1: Creating encryption keys
      currentStep.value = 1
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate time

      // Step 2: Setting up secure backup
      currentStep.value = 2
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Step 3: Bootstrap encryption with passphrase
      currentStep.value = 3
      const result = await encryptionService.bootstrapEncryption(props.passphrase)

      if (!result.success) {
        throw new Error(result.error || 'Encryption bootstrap failed')
      }

      // Complete
      currentStep.value = 4
      await new Promise(resolve => setTimeout(resolve, 1000))
      isComplete.value = true
    }
  } catch (error) {
    console.error('Encryption setup failed:', error)
    hasError.value = true

    if (error.message.includes('timeout')) {
      isTimeout.value = true
      errorMessage.value = 'Setup timed out after 30 seconds'
    } else {
      errorMessage.value = error.message || 'Failed to set up encryption'
    }

    errorDetails.value = error.toString()
    failedStep.value = `Step ${currentStep.value}: ${getStepName(currentStep.value)}`
  }
}

const getStepName = (step: number): string => {
  switch (step) {
    case 1: return 'Creating encryption keys'
    case 2: return 'Setting up secure backup'
    case 3: return 'Finalizing setup'
    default: return 'Unknown step'
  }
}

const handleComplete = async () => {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    emit('complete')
  } finally {
    loading.value = false
  }
}

const handleRetry = () => {
  // Reset state and try again
  hasError.value = false
  isComplete.value = false
  errorMessage.value = ''
  errorDetails.value = ''
  failedStep.value = ''
  isTimeout.value = false
  currentStep.value = 0

  // Start setup again
  startSetup()
}

const handleSkip = () => {
  // Emit error to let parent handle basic chat mode
  emit('error', 'User chose to skip encryption setup')
}

const handleClearMatrixData = async () => {
  if (!confirm('This will clear all Matrix encryption data and start fresh. You may lose access to previously encrypted messages. Continue?')) {
    return
  }

  try {
    clearingData.value = true
    console.log('🧹 User requested Matrix data clearing...')

    // Get the encryption bootstrap service
    const matrixClient = matrixClientService.getClient()
    if (!matrixClient) {
      throw new Error('Matrix client not available')
    }

    // Import and use the bootstrap service
    const { MatrixEncryptionBootstrapService } = await import('../../../services/matrixEncryptionBootstrapService')
    const bootstrapService = new MatrixEncryptionBootstrapService(matrixClient)

    // Clear all Matrix data
    const clearResult = await bootstrapService.clearAllMatrixData()
    if (!clearResult.success) {
      throw new Error(clearResult.error || 'Failed to clear Matrix data')
    }

    console.log('✅ Matrix data cleared successfully, retrying setup...')

    // Reset error state and retry setup
    hasError.value = false
    errorMessage.value = ''
    errorDetails.value = ''
    isComplete.value = false
    currentStep.value = 0

    // Start fresh setup
    await performEncryptionSetup()
  } catch (error) {
    console.error('❌ Failed to clear Matrix data:', error)
    errorMessage.value = `Failed to clear Matrix data: ${error.message}`
    errorDetails.value = error.stack || error.toString()
  } finally {
    clearingData.value = false
  }
}

const handleCancel = () => {
  // Stop setup and go back
  if (setupTimeout) {
    clearTimeout(setupTimeout)
    setupTimeout = null
  }

  emit('error', 'User cancelled encryption setup')
}

const startSetup = () => {
  // Set up timeout
  setupTimeout = setTimeout(() => {
    if (!isComplete.value && !hasError.value) {
      hasError.value = true
      isTimeout.value = true
      errorMessage.value = 'Setup timed out after 30 seconds'
      errorDetails.value = 'Operation exceeded maximum allowed time'
      failedStep.value = `Step ${currentStep.value}: ${getStepName(currentStep.value)}`
    }
  }, 30000)

  // Start the setup process
  performEncryptionSetup()
}

onMounted(() => {
  // Brief delay before starting to show initial UI
  setTimeout(() => {
    startSetup()
  }, 1000)
})

onUnmounted(() => {
  if (setupTimeout) {
    clearTimeout(setupTimeout)
    setupTimeout = null
  }
})
</script>

<style scoped>
.chat-encryption-progress {
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.5rem;
}

.q-dark .chat-encryption-progress {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.progress-content {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.q-dark .progress-content {
  background: #1e1e1e;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.progress-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.step-item {
  padding: 12px;
  border-radius: 8px;
  transition: all 0.3s ease;
  opacity: 0.6;
}

.step-item.step-active {
  opacity: 1;
  background: rgba(25, 118, 210, 0.05);
  transform: translateX(4px);
}

.step-item.step-complete {
  opacity: 0.8;
}

.q-dark .step-item.step-active {
  background: rgba(25, 118, 210, 0.1);
}

.success-card {
  background: #e8f5e8;
  border: 1px solid #c8e6c9;
}

.q-dark .success-card {
  background: #1a2e1a;
  border-color: #2e4a2e;
}

.error-card {
  background: #ffeaea;
  border: 1px solid #ffcdd2;
}

.q-dark .error-card {
  background: #2e1a1a;
  border-color: #4a2a2a;
}

.overall-progress {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}

.q-dark .overall-progress {
  background: rgba(255, 255, 255, 0.05);
}

.action-buttons .q-btn {
  border-radius: 12px;
  font-weight: 500;
}

.technical-details {
  border-top: 1px solid #e0e0e0;
  padding-top: 16px;
}

.q-dark .technical-details {
  border-top-color: #3a3a3a;
}

@media (max-width: 599px) {
  .progress-content {
    padding: 24px 20px;
    margin: 16px;
  }

  .chat-encryption-progress {
    height: 100%;
    padding: 0.25rem;
  }

  .progress-content {
    padding: 16px 12px !important;
    margin: 8px !important;
  }

  .step-item {
    margin-bottom: 16px !important;
  }
}
</style>
