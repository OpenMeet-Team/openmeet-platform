<template>
  <div class="encryption-warning-banner">
    <div class="banner-content">
      <q-icon
        :name="bannerIcon"
        :class="bannerIconClass"
        size="20px"
      />
      <span class="banner-message">{{ warningMessage }}</span>
      <div class="banner-actions">
        <q-btn
          flat
          dense
          :label="primaryButtonText"
          @click="handlePrimaryAction"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { logger } from '../../../utils/logger'

interface Props {
  /** The warning message to display */
  warningMessage: string
  /** The encryption state that triggered this banner */
  encryptionState: string
}

interface Emits {
  /** Emitted when user clicks the primary action button */
  (e: 'primary-action', state: string): void
  /** Emitted when user dismisses the banner */
  (e: 'dismiss'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Determine banner appearance based on encryption state
const bannerIcon = computed(() => {
  switch (props.encryptionState) {
    case 'ready_encrypted_with_warning':
      return 'fas fa-shield-alt'
    case 'needs_key_backup':
      return 'fas fa-exclamation-triangle'
    case 'needs_device_verification':
      return 'fas fa-lock'
    case 'needs_recovery_key':
      return 'fas fa-key'
    default:
      return 'fas fa-info-circle'
  }
})

const bannerIconClass = computed(() => {
  switch (props.encryptionState) {
    case 'ready_encrypted_with_warning':
      return 'text-orange-6'
    case 'needs_key_backup':
      return 'text-orange-6'
    case 'needs_device_verification':
      return 'text-red-6'
    case 'needs_recovery_key':
      return 'text-red-6'
    default:
      return 'text-blue-6'
  }
})

const primaryButtonText = computed(() => {
  switch (props.encryptionState) {
    case 'ready_encrypted_with_warning':
      return 'Set up recovery'
    case 'needs_key_backup':
      return 'Turn on backup'
    case 'needs_device_verification':
      return 'Verify'
    case 'needs_recovery_key':
      return 'Enter recovery key'
    default:
      return 'Continue'
  }
})

const handlePrimaryAction = () => {
  logger.debug('🔐 User clicked primary action for encryption banner:', props.encryptionState)
  emit('primary-action', props.encryptionState)
}

const handleDismiss = () => {
  logger.debug('🔐 User dismissed encryption banner:', props.encryptionState)
  emit('dismiss')
}
</script>

<style scoped>
.encryption-warning-banner {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  margin: 8px 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.banner-content {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}

.banner-message {
  flex: 1;
  color: #856404;
  font-weight: 500;
  font-size: 14px;
  line-height: 1.4;
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.primary-action {
  background: rgba(255, 193, 7, 0.2);
  color: #856404;
  font-weight: 600;
}

.primary-action:hover {
  background: rgba(255, 193, 7, 0.3);
}

.secondary-action {
  color: #6c757d;
}

.secondary-action:hover {
  background: rgba(108, 117, 125, 0.1);
}

/* Different styles for different warning types */
.encryption-warning-banner.error {
  background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
  border-color: #f5c6cb;
}

.encryption-warning-banner.error .banner-message {
  color: #721c24;
}

.encryption-warning-banner.info {
  background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
  border-color: #bee5eb;
}

.encryption-warning-banner.info .banner-message {
  color: #0c5460;
}
</style>
