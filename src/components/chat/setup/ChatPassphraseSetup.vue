<template>
  <div class="chat-passphrase-setup">
    <q-page class="flex flex-center q-pa-md">
      <div class="setup-content" style="max-width: 500px; width: 100%;">

        <!-- Header -->
        <div class="text-center q-mb-xl">
          <q-icon name="fas fa-key" size="64px" color="primary" class="q-mb-md" />
          <div class="text-h4 text-weight-medium q-mb-sm">Create Your Encryption Key</div>
          <div class="text-subtitle1 text-grey-7">
            Choose a passphrase to secure your messages across devices
          </div>
        </div>

        <!-- Passphrase Input -->
        <div class="passphrase-section q-mb-lg">
          <q-input
            v-model="passphrase"
            :type="showPassphrase ? 'text' : 'password'"
            filled
            label="Encryption passphrase"
            placeholder="Enter a strong passphrase..."
            class="q-mb-md"
            :error="!!validationResult.feedback && passphrase.length > 0"
            :error-message="validationResult.feedback"
            @update:model-value="handlePassphraseInput"
          >
            <template v-slot:append>
              <q-btn
                :icon="showPassphrase ? 'fas fa-eye-slash' : 'fas fa-eye'"
                flat
                round
                dense
                @click="showPassphrase = !showPassphrase"
                tabindex="-1"
              />
            </template>
          </q-input>

          <!-- Strength Indicator -->
          <div v-if="passphrase.length > 0" class="strength-indicator q-mb-md">
            <div class="row items-center">
              <div class="col-auto q-mr-sm">
                <q-icon
                  :name="getStrengthIcon"
                  :color="getStrengthColor"
                  size="16px"
                />
              </div>
              <div class="col-auto">
                <span :class="`text-${getStrengthColor}`" class="text-caption text-weight-medium">
                  {{ getStrengthText }}
                </span>
              </div>
              <div class="col">
                <q-linear-progress
                  :value="getStrengthValue"
                  :color="getStrengthColor"
                  class="q-ml-sm"
                  size="4px"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Confirm Passphrase -->
        <div class="confirm-section q-mb-xl">
          <q-input
            v-model="passphraseConfirm"
            :type="showConfirmPassphrase ? 'text' : 'password'"
            filled
            label="Confirm passphrase"
            placeholder="Enter the same passphrase again..."
            :error="!!confirmError && passphraseConfirm.length > 0"
            :error-message="confirmError"
            @input="handleConfirmInput"
          >
            <template v-slot:append>
              <q-btn
                :icon="showConfirmPassphrase ? 'fas fa-eye-slash' : 'fas fa-eye'"
                flat
                round
                dense
                @click="showConfirmPassphrase = !showConfirmPassphrase"
                tabindex="-1"
              />
            </template>
          </q-input>
        </div>

        <!-- Requirements Info -->
        <q-card flat bordered class="requirements-card q-mb-xl">
          <q-card-section class="q-pa-md">
            <div class="text-subtitle2 q-mb-sm">Passphrase requirements:</div>
            <div class="requirements-list">
              <div class="requirement-item row items-center q-mb-xs">
                <q-icon
                  :name="passphrase.length >= 12 ? 'fas fa-check-circle' : 'far fa-circle'"
                  :color="passphrase.length >= 12 ? 'green' : 'grey-5'"
                  size="16px"
                  class="q-mr-sm"
                />
                <span class="text-body2">At least 12 characters</span>
              </div>
              <div class="requirement-item row items-center q-mb-xs">
                <q-icon
                  :name="hasUppercase ? 'fas fa-check-circle' : 'far fa-circle'"
                  :color="hasUppercase ? 'green' : 'grey-5'"
                  size="16px"
                  class="q-mr-sm"
                />
                <span class="text-body2">Contains uppercase letters</span>
              </div>
              <div class="requirement-item row items-center q-mb-xs">
                <q-icon
                  :name="hasLowercase ? 'fas fa-check-circle' : 'far fa-circle'"
                  :color="hasLowercase ? 'green' : 'grey-5'"
                  size="16px"
                  class="q-mr-sm"
                />
                <span class="text-body2">Contains lowercase letters</span>
              </div>
              <div class="requirement-item row items-center">
                <q-icon
                  :name="hasNumbers || hasSpecial ? 'fas fa-check-circle' : 'far fa-circle'"
                  :color="hasNumbers || hasSpecial ? 'green' : 'grey-5'"
                  size="16px"
                  class="q-mr-sm"
                />
                <span class="text-body2">Contains numbers or special characters</span>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <q-btn
            unelevated
            color="primary"
            size="lg"
            class="full-width q-mb-md"
            @click="handleContinue"
            :loading="loading"
            :disable="!canContinue"
          >
            Continue to Connection
            <q-icon name="fas fa-arrow-right" class="q-ml-sm" />
          </q-btn>

          <q-btn
            flat
            color="grey-7"
            size="md"
            class="full-width"
            @click="handleBack"
            :disable="loading"
          >
            <q-icon name="fas fa-arrow-left" class="q-mr-sm" />
            Back
          </q-btn>
        </div>

        <!-- Security Note -->
        <div class="security-note q-mt-lg">
          <q-card flat class="bg-blue-1 q-pa-sm">
            <div class="row items-start">
              <q-icon name="fas fa-shield-alt" color="blue" size="16px" class="q-mr-xs q-mt-xs" />
              <div class="col text-caption text-blue-8">
                <strong>Important:</strong> This passphrase encrypts your message history.
                Store it securely - we cannot recover it if lost.
              </div>
            </div>
          </q-card>
        </div>
      </div>
    </q-page>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePassphraseValidation } from '../../../composables/usePassphraseValidation'

const emit = defineEmits<{
  continue: [passphrase: string]
  back: []
}>()

// State
const passphrase = ref('')
const passphraseConfirm = ref('')
const showPassphrase = ref(false)
const showConfirmPassphrase = ref(false)
const loading = ref(false)

// Validation composable
const { validationResult, validatePassphrase } = usePassphraseValidation()

// Computed properties for requirements checking
const hasUppercase = computed(() => /[A-Z]/.test(passphrase.value))
const hasLowercase = computed(() => /[a-z]/.test(passphrase.value))
const hasNumbers = computed(() => /[0-9]/.test(passphrase.value))
const hasSpecial = computed(() => /[^A-Za-z0-9]/.test(passphrase.value))

const confirmError = computed(() => {
  if (passphraseConfirm.value.length === 0) return null
  if (passphrase.value !== passphraseConfirm.value) {
    return 'Passphrases do not match'
  }
  return null
})

const canContinue = computed(() => {
  return validationResult.value.isValid &&
         passphrase.value === passphraseConfirm.value &&
         passphrase.value.length >= 12
})

// Methods
const handlePassphraseInput = () => {
  validatePassphrase(passphrase.value)
  // Clear confirm field if it doesn't match anymore
  if (passphraseConfirm.value && passphrase.value !== passphraseConfirm.value) {
    // Let user see the mismatch but don't clear automatically
  }
}

// Watch for passphrase changes to ensure validation is triggered
watch(passphrase, (newValue) => {
  validatePassphrase(newValue || '')
}, { immediate: true })

const handleConfirmInput = () => {
  // Validation happens in computed property
}

const getStrengthIcon = computed(() => {
  switch (validationResult.value.strength) {
    case 'weak': return 'fas fa-exclamation-triangle'
    case 'medium': return 'fas fa-info-circle'
    case 'strong': return 'fas fa-check-circle'
    default: return 'fas fa-question-circle'
  }
})

const getStrengthColor = computed(() => {
  switch (validationResult.value.strength) {
    case 'weak': return 'red'
    case 'medium': return 'orange'
    case 'strong': return 'green'
    default: return 'grey'
  }
})

const getStrengthText = computed(() => {
  switch (validationResult.value.strength) {
    case 'weak': return 'Weak passphrase'
    case 'medium': return 'Good passphrase'
    case 'strong': return 'Strong passphrase'
    default: return 'Enter passphrase'
  }
})

const getStrengthValue = computed(() => {
  switch (validationResult.value.strength) {
    case 'weak': return 0.3
    case 'medium': return 0.6
    case 'strong': return 1.0
    default: return 0
  }
})

const handleContinue = async () => {
  if (!canContinue.value) return

  loading.value = true
  try {
    // Brief delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500))
    emit('continue', passphrase.value)
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  emit('back')
}

// Validation is now handled by the watcher above
</script>

<style scoped>
.chat-passphrase-setup {
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.5rem;
}

.q-dark .chat-passphrase-setup {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.setup-content {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.q-dark .setup-content {
  background: #1e1e1e;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.strength-indicator {
  padding: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
}

.q-dark .strength-indicator {
  background: rgba(255, 255, 255, 0.05);
}

.requirements-card {
  background: #f8f9ff;
  border: 1px solid #e3e8ff;
}

.q-dark .requirements-card {
  background: #1a1a2e;
  border-color: #2a2a4e;
}

.requirement-item {
  transition: opacity 0.2s ease;
}

.action-buttons .q-btn {
  border-radius: 12px;
  font-weight: 500;
}

.security-note {
  border-radius: 8px;
  overflow: hidden;
}

.q-dark .security-note .bg-blue-1 {
  background: rgba(33, 150, 243, 0.1) !important;
}

.q-dark .security-note .text-blue-8 {
  color: #90caf9 !important;
}

@media (max-width: 599px) {
  .setup-content {
    padding: 24px 20px;
    margin: 16px;
  }

  .chat-passphrase-setup {
    height: 100%;
    padding: 0.25rem;
  }

  .setup-content {
    padding: 16px 12px !important;
    margin: 8px !important;
  }
}
</style>
