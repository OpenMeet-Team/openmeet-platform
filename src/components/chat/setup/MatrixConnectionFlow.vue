<template>
  <div class="matrix-connection-flow">
    <q-page class="flex flex-center q-pa-md">
      <div class="connection-content" style="max-width: 500px; width: 100%;">

        <!-- Header -->
        <div class="text-center q-mb-xl">
          <q-icon
            :name="currentIcon"
            :size="iconSize"
            :color="iconColor"
            class="q-mb-md connection-icon"
          />
          <div class="text-h4 text-weight-medium q-mb-sm">{{ currentTitle }}</div>
          <div class="text-subtitle1 text-grey-7">
            {{ currentSubtitle }}
          </div>
        </div>

        <!-- Connection Steps -->
        <div v-if="!hasError" class="connection-steps q-mb-xl">
          <!-- Step 1: Prepare -->
          <div class="step-item row items-center q-mb-lg" :class="{ 'step-active': step >= 1, 'step-complete': step > 1 }">
            <q-icon
              :name="step > 1 ? 'fas fa-check-circle' : (step === 1 ? 'fas fa-dot-circle' : 'far fa-circle')"
              :color="step > 1 ? 'green' : (step === 1 ? 'primary' : 'grey-5')"
              size="24px"
              class="q-mr-md"
            />
            <div class="col">
              <div class="text-subtitle2">Preparing connection</div>
              <div class="text-caption text-grey-6">Setting up secure connection to {{ homeserverUrl }}</div>
            </div>
          </div>

          <!-- Step 2: Authorize -->
          <div class="step-item row items-center q-mb-lg" :class="{ 'step-active': step >= 2, 'step-complete': step > 2 }">
            <q-icon
              :name="step > 2 ? 'fas fa-check-circle' : (step === 2 ? 'fas fa-dot-circle' : 'far fa-circle')"
              :color="step > 2 ? 'green' : (step === 2 ? 'primary' : 'grey-5')"
              size="24px"
              class="q-mr-md"
            />
            <div class="col">
              <div class="text-subtitle2">Waiting for authorization</div>
              <div class="text-caption text-grey-6">Complete the consent process in the new window</div>
            </div>
          </div>

          <!-- Step 3: Complete -->
          <div class="step-item row items-center" :class="{ 'step-active': step >= 3, 'step-complete': step > 3 }">
            <q-icon
              :name="step > 3 ? 'fas fa-check-circle' : (step === 3 ? 'fas fa-dot-circle' : 'far fa-circle')"
              :color="step > 3 ? 'green' : (step === 3 ? 'primary' : 'grey-5')"
              size="24px"
              class="q-mr-md"
            />
            <div class="col">
              <div class="text-subtitle2">Finalizing connection</div>
              <div class="text-caption text-grey-6">Establishing secure session</div>
            </div>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="hasError" class="error-section q-mb-xl">
          <q-card flat bordered class="error-card">
            <q-card-section class="q-pa-md">
              <div class="row items-start">
                <q-icon name="error" color="red" size="24px" class="q-mr-sm q-mt-xs" />
                <div class="col">
                  <div class="text-subtitle2 text-red q-mb-xs">Connection Failed</div>
                  <div class="text-body2 text-grey-7 q-mb-md">
                    {{ errorMessage }}
                  </div>
                  <div class="text-caption text-grey-6">
                    This can happen if the consent window was closed or if there was a network issue.
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Progress Indicator -->
        <div v-if="!hasError && step < 4" class="progress-section q-mb-xl">
          <q-linear-progress
            :value="progressValue"
            color="primary"
            size="8px"
            rounded
            class="q-mb-sm"
          />
          <div class="text-center">
            <div class="text-caption text-grey-6">
              Step {{ step }} of 3
            </div>
          </div>
        </div>

        <!-- Info Card -->
        <q-card flat bordered class="info-card q-mb-xl">
          <q-card-section class="q-pa-md">
            <div class="row items-start">
              <q-icon name="fas fa-info-circle" color="blue" size="20px" class="q-mr-sm q-mt-xs" />
              <div class="col">
                <div class="text-subtitle2 q-mb-xs">About the consent screen</div>
                <div class="text-body2 text-grey-7">
                  The authorization page allows {{ appName }} to securely connect to your
                  Matrix account. You can also access Matrix directly at
                  <strong>{{ homeserverUrl }}</strong> using the same credentials.
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <!-- Connect Button -->
          <q-btn
            v-if="!isConnecting && !isConnected && !hasError"
            unelevated
            color="primary"
            size="lg"
            class="full-width q-mb-md"
            @click="handleConnect"
            :loading="loading"
          >
            <q-icon name="fas fa-link" class="q-mr-sm" />
            Connect to Matrix
          </q-btn>

          <!-- Retry Button -->
          <q-btn
            v-if="hasError"
            unelevated
            color="primary"
            size="lg"
            class="full-width q-mb-md"
            @click="handleRetry"
            :loading="loading"
          >
            <q-icon name="refresh" class="q-mr-sm" />
            Try Again
          </q-btn>

          <!-- Continue Button (when connected) -->
          <q-btn
            v-if="isConnected && !hasError"
            unelevated
            color="green"
            size="lg"
            class="full-width q-mb-md"
            @click="handleContinue"
            :loading="loading"
          >
            <q-icon name="fas fa-check" class="q-mr-sm" />the
            Connection Complete
          </q-btn>

          <!-- Back Button -->
          <q-btn
            flat
            color="grey-7"
            size="md"
            class="full-width"
            @click="handleBack"
            :disable="loading || isConnecting"
          >
            <q-icon name="fas fa-arrow-left" class="q-mr-sm" />
            Back
          </q-btn>
        </div>

        <!-- Help Section -->
        <div class="help-section q-mt-lg">
          <q-expansion-item
            icon="fas fa-question-circle"
            label="Having trouble connecting?"
            class="text-grey-7"
            header-style="padding: 8px 0;"
          >
            <div class="text-body2 text-grey-7 q-pa-sm">
              <div class="q-mb-sm">If you're having issues:</div>
              <ul class="q-pl-md">
                <li>Make sure pop-ups are allowed for this site</li>
                <li>Complete the consent process without closing the window</li>
                <li>Check your internet connection</li>
                <li>Try refreshing this page if the connection stalls</li>
              </ul>
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
import getEnv from '../../../utils/env'

interface Props {
  homeserverUrl?: string
}

withDefaults(defineProps<Props>(), {
  homeserverUrl: (getEnv('APP_MATRIX_HOMESERVER_URL') as string) || 'https://matrix.openmeet.net'
})

const emit = defineEmits<{
  continue: []
  back: []
}>()

// State
const step = ref(0)
const loading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const isConnecting = ref(false)
const isConnected = ref(false)

// Configuration
const appName = computed(() => {
  return getEnv('APP_TENANT_NAME') || 'OpenMeet'
})

// UI State
const currentIcon = computed(() => {
  if (hasError.value) return 'fas fa-exclamation-circle'
  if (isConnected.value) return 'fas fa-check-circle'
  if (isConnecting.value) return 'fas fa-sync-alt'
  return 'fas fa-link'
})

const iconSize = computed(() => {
  return hasError.value || isConnected.value ? '64px' : '48px'
})

const iconColor = computed(() => {
  if (hasError.value) return 'red'
  if (isConnected.value) return 'green'
  if (isConnecting.value) return 'primary'
  return 'primary'
})

const currentTitle = computed(() => {
  if (hasError.value) return 'Connection Failed'
  if (isConnected.value) return 'Connected to Matrix!'
  if (isConnecting.value) return 'Connecting to Matrix...'
  return 'Connect to Matrix'
})

const currentSubtitle = computed(() => {
  if (hasError.value) return 'Something went wrong during connection'
  if (isConnected.value) return 'Ready to set up encryption'
  if (isConnecting.value) return 'Please complete authorization'
  return 'Authorize secure messaging for your account'
})

const progressValue = computed(() => {
  return step.value / 3
})

// Connection polling
let connectionCheckInterval: ReturnType<typeof setInterval> | null = null

// Methods
const handleConnect = async () => {
  loading.value = true
  isConnecting.value = true
  hasError.value = false
  step.value = 1

  try {
    // Step 1: Prepare connection
    await new Promise(resolve => setTimeout(resolve, 1000))
    step.value = 2

    // Step 2: Start Matrix connection (this will open OIDC flow)
    await matrixClientService.connectToMatrix()

    // Step 3: Connection established
    step.value = 3
    await new Promise(resolve => setTimeout(resolve, 500))

    // Step 4: Complete
    step.value = 4
    isConnected.value = true
    isConnecting.value = false
  } catch (error) {
    console.error('Matrix connection failed:', error)
    hasError.value = true
    errorMessage.value = error.message || 'Failed to connect to Matrix. Please try again.'
    isConnecting.value = false
  } finally {
    loading.value = false
  }
}

const handleRetry = () => {
  hasError.value = false
  errorMessage.value = ''
  step.value = 0
  isConnected.value = false
  isConnecting.value = false
  handleConnect()
}

const handleContinue = async () => {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    emit('continue')
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  emit('back')
}

// Check connection status periodically
const startConnectionPolling = () => {
  connectionCheckInterval = setInterval(() => {
    if (isConnecting.value && !isConnected.value && !hasError.value) {
      // Check if Matrix connection was completed
      if (matrixClientService.hasUserChosenToConnect()) {
        step.value = 3
        setTimeout(() => {
          step.value = 4
          isConnected.value = true
          isConnecting.value = false
        }, 1000)

        if (connectionCheckInterval) {
          clearInterval(connectionCheckInterval)
          connectionCheckInterval = null
        }
      }
    }
  }, 2000)
}

const stopConnectionPolling = () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval)
    connectionCheckInterval = null
  }
}

onMounted(() => {
  startConnectionPolling()
})

onUnmounted(() => {
  stopConnectionPolling()
})
</script>

<style scoped>
.matrix-connection-flow {
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.5rem;
}

.q-dark .matrix-connection-flow {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.connection-content {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.q-dark .connection-content {
  background: #1e1e1e;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.connection-icon {
  transition: all 0.3s ease;
}

.step-item {
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
  opacity: 0.6;
}

.step-item.step-active {
  opacity: 1;
  background: rgba(25, 118, 210, 0.05);
}

.step-item.step-complete {
  opacity: 0.8;
}

.q-dark .step-item.step-active {
  background: rgba(25, 118, 210, 0.1);
}

.error-card {
  background: #ffeaea;
  border: 1px solid #ffcdd2;
}

.q-dark .error-card {
  background: #2e1a1a;
  border-color: #4a2a2a;
}

.info-card {
  background: #f8f9ff;
  border: 1px solid #e3e8ff;
}

.q-dark .info-card {
  background: #1a1a2e;
  border-color: #2a2a4e;
}

.action-buttons .q-btn {
  border-radius: 12px;
  font-weight: 500;
}

.help-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 16px;
}

.q-dark .help-section {
  border-top-color: #3a3a3a;
}

@media (max-width: 599px) {
  .connection-content {
    padding: 24px 20px;
    margin: 16px;
  }

  .matrix-connection-flow {
    height: 100%;
    padding: 0.25rem;
  }

  .connection-content {
    padding: 16px 12px !important;
    margin: 8px !important;
  }

  .step-item {
    margin-bottom: 16px !important;
  }
}
</style>
