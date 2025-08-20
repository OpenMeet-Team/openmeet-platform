<template>
  <q-dialog
    v-model="showDialog"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="verification-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="fas fa-shield-alt" color="blue" class="q-mr-sm" />
          Device Verification
        </div>
        <q-space />
        <q-btn
          icon="fas fa-times"
          flat
          round
          dense
          v-close-popup
          @click="handleClose"
        />
      </q-card-section>

      <q-card-section>
        <!-- Pending Requests List -->
        <div v-if="step === 'list' && pendingRequests.length > 0" class="verification-list">
          <div class="text-body1 q-mb-md">
            The following devices are requesting verification:
          </div>

          <q-list bordered separator>
            <q-item
              v-for="request in pendingRequests"
              :key="request.requestId"
              class="verification-request-item"
            >
              <q-item-section avatar>
                <q-avatar color="blue" text-color="white" icon="fas fa-mobile-alt" />
              </q-item-section>

              <q-item-section>
                <q-item-label>Device Verification Request</q-item-label>
                <q-item-label caption>
                  From: {{ request.otherDeviceId }}
                  <br>
                  Methods: {{ request.methods.join(', ') }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <div class="row q-gutter-sm">
                  <q-btn
                    @click="acceptRequest(request.requestId)"
                    color="green"
                    label="Verify"
                    size="sm"
                    :loading="accepting === request.requestId"
                  />
                  <q-btn
                    @click="rejectRequest(request.requestId)"
                    color="red"
                    label="Reject"
                    size="sm"
                    outline
                    :loading="rejecting === request.requestId"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- No Pending Requests -->
        <div v-else-if="step === 'list'" class="no-requests text-center q-pa-xl">
          <q-icon name="fas fa-shield-alt" size="4rem" color="grey-5" class="q-mb-md" />
          <div class="text-h6 text-grey-7 q-mb-sm">No Verification Requests</div>
          <div class="text-body2 text-grey-6 q-mb-md">
            When other devices request verification, they'll appear here.
          </div>

          <!-- Device Cleanup Button -->
          <div v-if="availableDevices.length > 10" class="cleanup-section q-mb-md">
            <q-btn
              color="orange"
              icon="fas fa-broom"
              label="Clean Up Stale Devices"
              @click="cleanupStaleDevices"
              class="q-mb-sm"
              size="sm"
            />
            <div class="text-caption text-grey-6">
              You have {{ availableDevices.length }} devices registered. Clean up old ones to improve verification reliability.
            </div>
          </div>

          <!-- Show Available Devices -->
          <div v-if="availableDevices.length > 0" class="available-devices q-mb-md">
            <div class="text-subtitle1 q-mb-sm"><strong>Available Devices ({{ availableDevices.length }})</strong></div>
            <q-list bordered separator>
              <q-item
                v-for="device in availableDevices"
                :key="device.deviceId"
                class="device-item"
              >
                <q-item-section avatar>
                  <q-avatar :color="device.isCurrentDevice ? 'green' : 'blue'" text-color="white">
                    <q-icon :name="device.isCurrentDevice ? 'fas fa-check' : 'fas fa-mobile-alt'" />
                  </q-avatar>
                </q-item-section>

                <q-item-section>
                  <q-item-label>
                    {{ device.displayName }}
                    <q-chip
                      v-if="device.verified"
                      size="sm"
                      color="green"
                      text-color="white"
                      icon="fas fa-shield-check"
                      class="q-ml-sm"
                    >
                      Verified
                    </q-chip>
                    <q-chip
                      v-else
                      size="sm"
                      color="orange"
                      text-color="white"
                      icon="fas fa-shield-exclamation"
                      class="q-ml-sm"
                    >
                      Unverified
                    </q-chip>
                  </q-item-label>
                  <q-item-label caption>
                    Device ID: {{ device.deviceId }}
                    <span v-if="device.isCurrentDevice">(Current Device)</span>
                  </q-item-label>
                </q-item-section>

                <q-item-section side v-if="!device.isCurrentDevice">
                  <q-btn
                    @click="initiateVerification(device.deviceId)"
                    color="blue"
                    label="Verify"
                    size="sm"
                    :loading="initiatingVerification === device.deviceId"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Load Devices Button -->
          <q-btn
            @click="loadDevices"
            color="blue"
            label="Load My Devices"
            icon="fas fa-mobile-alt"
            :loading="loadingDevices"
            class="q-mb-md"
          />

          <!-- Debug Info -->
          <div class="debug-info q-pa-md" style="background: #f5f5f5; border-radius: 8px; font-size: 12px; text-align: left;">
            <strong>Debug Info:</strong><br>
            Service initialized: {{ !!verificationService }}<br>
            Pending requests: {{ pendingRequests.length }}<br>
            Available devices: {{ availableDevices.length }}<br>
          </div>
        </div>

        <!-- Emoji Verification -->
        <div v-else-if="step === 'emoji'" class="emoji-verification">
          <div class="text-h6 q-mb-md text-center">Compare Emojis</div>
          <div class="text-body1 q-mb-lg text-center">
            Check that the following emojis match on both devices:
          </div>

          <div v-if="emojiData" class="emoji-grid q-mb-lg">
            <div
              v-for="(item, index) in emojiData.emojis"
              :key="index"
              class="emoji-item text-center q-pa-md"
            >
              <div class="emoji-char">{{ item.emoji }}</div>
              <div class="emoji-name">{{ item.name }}</div>
            </div>
          </div>

          <div class="verification-actions text-center">
            <div class="text-body2 q-mb-md">
              Do the emojis match on both devices?
            </div>
            <div class="row justify-center q-gutter-md">
              <q-btn
                @click="confirmEmojis"
                color="green"
                label="They Match"
                icon="fas fa-check"
                :loading="confirming"
                size="lg"
              />
              <q-btn
                @click="cancelVerification"
                color="red"
                label="They Don't Match"
                icon="fas fa-times"
                outline
                :loading="cancelling"
                size="lg"
              />
            </div>
          </div>
        </div>

        <!-- Verification Complete -->
        <div v-else-if="step === 'complete'" class="verification-complete text-center q-pa-xl">
          <q-icon
            :name="verificationSuccess ? 'fas fa-check-circle' : 'fas fa-times-circle'"
            :color="verificationSuccess ? 'green' : 'red'"
            size="4rem"
            class="q-mb-md"
          />
          <div class="text-h6 q-mb-sm">
            {{ verificationSuccess ? 'Verification Successful!' : 'Verification Failed' }}
          </div>
          <div class="text-body2 text-grey-6 q-mb-lg">
            {{ verificationSuccess
              ? 'The device has been verified and can now access encrypted messages.'
              : 'The verification was cancelled or failed. You can try again later.'
            }}
          </div>
          <q-btn
            @click="handleClose"
            color="primary"
            label="Close"
            size="lg"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { MatrixDeviceVerificationService, type VerificationRequestInfo, type EmojiVerificationData } from '../../../services/MatrixDeviceVerificationService'
import { matrixClientService } from '../../../services/matrixClientService'
import { logger } from '../../../utils/logger'

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Dialog state
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Verification state
const step = ref<'list' | 'emoji' | 'complete'>('list')
const pendingRequests = ref<VerificationRequestInfo[]>([])
const currentRequestId = ref<string | null>(null)
const emojiData = ref<EmojiVerificationData | null>(null)
const verificationSuccess = ref(false)

// Loading states
const accepting = ref<string | null>(null)
const rejecting = ref<string | null>(null)
const confirming = ref(false)
const cancelling = ref(false)
const loadingDevices = ref(false)
const initiatingVerification = ref<string | null>(null)

// Device management
const availableDevices = ref<Array<{deviceId: string, displayName?: string, isCurrentDevice: boolean}>>([])

// Service instance
let verificationService: MatrixDeviceVerificationService | null = null

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
    logger.warn('No Matrix client available for device verification')
    return
  }

  verificationService = new MatrixDeviceVerificationService(client)

  // Listen for new verification requests
  verificationService.onVerificationRequest((request) => {
    logger.debug('📱 New verification request:', request)
    pendingRequests.value = verificationService!.getPendingRequests()

    // Auto-open dialog when new request comes in
    if (!showDialog.value) {
      showDialog.value = true
    }
  })

  // Listen for verification completion
  verificationService.onVerificationComplete((requestId, success) => {
    logger.debug('✅ Verification completed:', { requestId, success })
    verificationSuccess.value = success
    step.value = 'complete'
    currentRequestId.value = null

    // Refresh pending requests
    pendingRequests.value = verificationService!.getPendingRequests()
  })

  // Load existing pending requests
  pendingRequests.value = verificationService.getPendingRequests()
}

const acceptRequest = async (requestId: string) => {
  if (!verificationService) return

  accepting.value = requestId
  try {
    logger.debug('🔐 Accepting verification request:', requestId)
    const result = await verificationService.acceptVerificationRequest(requestId, 'm.sas.v1')

    if (result.success) {
      currentRequestId.value = requestId

      // Wait a moment for the emoji data to be available
      setTimeout(() => {
        const emojis = verificationService!.getEmojiVerification(requestId)
        if (emojis) {
          emojiData.value = emojis
          step.value = 'emoji'
        } else {
          logger.warn('No emoji data available for verification')
        }
      }, 1000)
    } else {
      logger.error('Failed to accept verification:', result.error)
    }
  } catch (error) {
    logger.error('Error accepting verification:', error)
  } finally {
    accepting.value = null
  }
}

const rejectRequest = async (requestId: string) => {
  if (!verificationService) return

  rejecting.value = requestId
  try {
    await verificationService.rejectVerificationRequest(requestId)
    pendingRequests.value = verificationService.getPendingRequests()
  } catch (error) {
    logger.error('Error rejecting verification:', error)
  } finally {
    rejecting.value = null
  }
}

const confirmEmojis = async () => {
  if (!verificationService || !currentRequestId.value) return

  confirming.value = true
  try {
    const result = await verificationService.confirmEmojiVerification(currentRequestId.value)
    if (result.success) {
      // Verification successful - the completion will be handled by the event listener
    } else {
      logger.error('Failed to confirm verification:', result.error)
      verificationSuccess.value = false
      step.value = 'complete'
    }
  } catch (error) {
    logger.error('Error confirming verification:', error)
    verificationSuccess.value = false
    step.value = 'complete'
  } finally {
    confirming.value = false
  }
}

const cancelVerification = async () => {
  if (!verificationService || !currentRequestId.value) return

  cancelling.value = true
  try {
    await verificationService.cancelVerification(currentRequestId.value)
    verificationSuccess.value = false
    step.value = 'complete'
  } catch (error) {
    logger.error('Error cancelling verification:', error)
  } finally {
    cancelling.value = false
  }
}

const loadDevices = async () => {
  if (!verificationService) return

  loadingDevices.value = true
  try {
    const devices = await verificationService.getAllUserDevices()
    availableDevices.value = devices
    logger.debug('📱 Loaded devices:', devices)
  } catch (error) {
    logger.error('Failed to load devices:', error)
  } finally {
    loadingDevices.value = false
  }
}

const cleanupStaleDevices = async () => {
  if (!verificationService) return

  try {
    logger.warn('🧹 Starting stale device cleanup...')
    const result = await verificationService.cleanupStaleDevices(3) // Keep 3 recent devices

    if (result.success) {
      logger.warn(`✅ Cleanup complete: deleted ${result.deletedCount} stale devices`)

      // Reload device list to show updated count
      await loadDevices()

      // Show success message
      const message = result.deletedCount > 0
        ? `Cleaned up ${result.deletedCount} stale devices`
        : 'No stale devices to clean up'

      // You can add a toast notification here if you have one
      logger.warn('🎉 Device cleanup:', message)
    } else {
      logger.error('❌ Cleanup failed:', result.error)
    }
  } catch (error) {
    logger.error('❌ Cleanup error:', error)
  }
}

const initiateVerification = async (deviceId: string) => {
  if (!verificationService) return

  initiatingVerification.value = deviceId
  try {
    logger.debug('🔐 Initiating verification with device:', deviceId)
    const result = await verificationService.requestVerificationWithDevice(deviceId)

    if (result.success) {
      logger.debug('✅ Verification request sent successfully')
      // The request should now appear in the pending requests list
      pendingRequests.value = verificationService.getPendingRequests()
    } else {
      logger.error('❌ Failed to send verification request:', result.error)
    }
  } catch (error) {
    logger.error('Error initiating verification:', error)
  } finally {
    initiatingVerification.value = null
  }
}

const handleClose = () => {
  // Reset state when closing
  step.value = 'list'
  currentRequestId.value = null
  emojiData.value = null
  verificationSuccess.value = false
  availableDevices.value = []

  showDialog.value = false
}
</script>

<style scoped>
.verification-dialog {
  max-width: 600px;
  margin: auto;
  max-height: 90vh;
}

.verification-request-item {
  border-radius: 8px;
  margin-bottom: 8px;
}

.emoji-verification {
  max-width: 500px;
  margin: 0 auto;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px solid #e9ecef;
}

.emoji-item {
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  padding: 16px;
}

.emoji-char {
  font-size: 2.5rem;
  line-height: 1;
  margin-bottom: 8px;
}

.emoji-name {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
  text-transform: capitalize;
}

.verification-actions {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
}

.no-requests {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.verification-complete {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Dark mode support */
.body--dark .emoji-grid {
  background: #2d2d2d;
  border-color: #3a3a3a;
}

.body--dark .emoji-item {
  background: #1a1a1a;
  border-color: #4a4a4a;
  color: #e5e7eb;
}

.body--dark .verification-actions {
  background: #2d2d2d;
}
</style>
