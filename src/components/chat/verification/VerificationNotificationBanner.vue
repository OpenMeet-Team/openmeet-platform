<template>
  <q-banner
    v-if="pendingCount > 0 && !dismissed"
    class="verification-notification-banner bg-blue-1 text-blue-9"
    rounded
  >
    <template v-slot:avatar>
      <q-avatar color="blue" text-color="white" icon="fas fa-shield-alt" />
    </template>

    <div class="banner-content">
      <div class="text-subtitle1">
        <strong>{{ pendingCount }} device{{ pendingCount > 1 ? 's' : '' }} requesting verification</strong>
      </div>
      <div class="text-body2">
        {{ pendingCount === 1
          ? 'A device is requesting verification to access encrypted messages.'
          : `${pendingCount} devices are requesting verification to access encrypted messages.`
        }}
      </div>
    </div>

    <template v-slot:action>
      <q-btn
        @click="openVerificationDialog"
        color="blue"
        label="Review"
        class="q-mr-sm"
        size="sm"
      />
      <q-btn
        @click="dismiss"
        flat
        color="blue"
        icon="fas fa-times"
        size="sm"
        round
      />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { MatrixDeviceManager, type VerificationRequestInfo } from '../../../services/MatrixDeviceManager'
import { matrixClientService } from '../../../services/matrixClientService'
import { logger } from '../../../utils/logger'

interface Emits {
  (e: 'open-verification-dialog'): void
}

const emit = defineEmits<Emits>()

// State
const pendingCount = ref(0)
const dismissed = ref(false)

// Service instance
let verificationService: MatrixDeviceManager | null = null

onMounted(() => {
  initializeVerificationService()
})

onUnmounted(() => {
  if (verificationService) {
    verificationService.destroy()
  }
})

const initializeVerificationService = () => {
  const client = matrixClientService.getClient()
  if (!client) {
    logger.warn('No Matrix client available for verification notifications')
    return
  }

  verificationService = new MatrixDeviceManager(client)

  // Listen for new verification requests
  verificationService.onVerificationRequest((request: VerificationRequestInfo) => {
    logger.debug('📱 Verification request for notification:', request)
    updatePendingCount()
    dismissed.value = false // Show banner for new requests
  })

  // Listen for verification completion
  verificationService.onVerificationComplete((requestId: string, success: boolean) => {
    logger.debug('✅ Verification completed for notification:', { requestId, success })
    updatePendingCount()
  })

  // Initial count
  updatePendingCount()
}

const updatePendingCount = () => {
  if (verificationService) {
    pendingCount.value = verificationService.getPendingRequests().length
  }
}

const openVerificationDialog = () => {
  emit('open-verification-dialog')
}

const dismiss = () => {
  dismissed.value = true
}

// Reset dismissed state when new requests come in
const resetDismissed = () => {
  dismissed.value = false
}

// Expose for parent component to reset dismissal
defineExpose({
  resetDismissed
})
</script>

<style scoped>
.verification-notification-banner {
  margin: 8px 0;
  border: 1px solid #bbdefb;
}

.banner-content {
  flex: 1;
}

/* Animation for new notifications */
.verification-notification-banner {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Dark mode support */
.body--dark .verification-notification-banner {
  background: rgba(33, 150, 243, 0.1) !important;
  color: #90caf9 !important;
  border-color: rgba(33, 150, 243, 0.3);
}
</style>
