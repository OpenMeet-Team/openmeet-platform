<template>
  <div class="chat-setup-orchestrator">
    <!-- Setup Flow -->
    <template v-if="!isSetupComplete">
      <MatrixEducationIntro
        v-if="currentStep === 'matrix-education'"
        @continue="handleEducationComplete"
        @skip="handleSetupSkip"
      />

      <MatrixSetupExplainer
        v-else-if="currentStep === 'setup-explainer'"
        @continue="handleSetupExplainerComplete"
        @back="currentStep = 'matrix-education'"
      />

      <ChatPassphraseSetup
        v-else-if="currentStep === 'passphrase-setup'"
        @continue="handlePassphraseComplete"
        @back="currentStep = 'setup-explainer'"
      />

      <MatrixConnectionFlow
        v-else-if="currentStep === 'matrix-connection'"
        @continue="handleMatrixConnectionComplete"
        @back="currentStep = 'passphrase-setup'"
        :homeserver-url="homeserverUrl"
      />

      <ChatEncryptionProgress
        v-else-if="currentStep === 'encryption-progress'"
        @complete="handleEncryptionComplete"
        @error="handleEncryptionError"
        :passphrase="setupState.passphrase"
      />
    </template>

    <!-- Main Chat Interface -->
    <UnifiedChatComponent
      v-else-if="mode !== 'single-room'"
      :context-type="contextType"
      :context-id="contextId"
      :mode="mode"
      :inline-room-id="inlineRoomId"
      :can-open-fullscreen="canOpenFullscreen"
      :show-info-sidebar="showInfoSidebar"
    />

    <!-- Single Room Chat Interface -->
    <MatrixChatInterface
      v-else
      :room-id="inlineRoomId"
      :context-type="contextType === 'all' ? 'direct' : contextType"
      :context-id="contextId"
      :mode="mode === 'single-room' ? 'inline' : mode"
      height="500px"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { matrixClientService } from '../../services/matrixClientService'
import { useChatEncryptionSetup } from '../../composables/useChatEncryptionSetup'
import getEnv from '../../utils/env'
import { logger } from '../../utils/logger'
import UnifiedChatComponent from './UnifiedChatComponent.vue'
import MatrixChatInterface from './MatrixChatInterface.vue'
import MatrixEducationIntro from './setup/MatrixEducationIntro.vue'
import MatrixSetupExplainer from './setup/MatrixSetupExplainer.vue'
import ChatPassphraseSetup from './setup/ChatPassphraseSetup.vue'
import MatrixConnectionFlow from './setup/MatrixConnectionFlow.vue'
import ChatEncryptionProgress from './setup/ChatEncryptionProgress.vue'

interface Props {
  // Context for filtering chats
  contextType?: 'all' | 'direct' | 'group' | 'event'
  contextId?: string

  // Display mode
  mode?: 'dashboard' | 'inline' | 'fullscreen' | 'single-room'

  // For inline mode
  inlineRoomId?: string

  // Configuration
  canOpenFullscreen?: boolean
  showInfoSidebar?: boolean
}

withDefaults(defineProps<Props>(), {
  contextType: 'all',
  mode: 'dashboard',
  canOpenFullscreen: true,
  showInfoSidebar: false
})

// Router for navigation
const route = useRoute()

// Setup state management
const { setupState, currentStep, saveSetupState, clearSetupState } = useChatEncryptionSetup()

// Configuration
const homeserverUrl = computed(() => {
  return (getEnv('APP_MATRIX_HOMESERVER_URL') as string) || 'https://matrix.openmeet.net'
})

// Computed state
const isSetupComplete = computed(() => {
  const hasUserChosen = matrixClientService.hasUserChosenToConnect()
  const isMatrixReady = matrixClientService.isReady()

  // If Matrix client is ready but user choice isn't recorded, auto-record it
  // This handles cases where the connection completed but the choice wasn't persisted
  if (isMatrixReady && !hasUserChosen) {
    logger.debug('🔧 Matrix ready but choice not recorded, auto-fixing...')
    matrixClientService.setUserChosenToConnect(true)
  }

  const needsMatrix = !hasUserChosen && !isMatrixReady
  // Only check encryption setup if Matrix is already connected and crypto is available
  const needsEncryption = isMatrixReady ? (matrixClientService.needsEncryptionSetup?.() ?? false) : false

  // Debug logging
  logger.debug('🔍 Setup completion check:', {
    hasUserChosen,
    isMatrixReady,
    needsMatrix,
    needsEncryption,
    isComplete: !needsMatrix && isMatrixReady && !needsEncryption
  })

  return !needsMatrix && isMatrixReady && !needsEncryption
})

// Event handlers
const handleEducationComplete = () => {
  currentStep.value = 'setup-explainer'
  saveSetupState()
}

const handleSetupSkip = () => {
  // User chose to skip the entire setup process
  clearSetupState()
  const returnUrl = route.query.return as string
  if (returnUrl) {
    logger.debug('🔄 Setup skipped, returning to:', returnUrl)
    window.location.href = returnUrl
  }
}

const handleSetupExplainerComplete = () => {
  currentStep.value = 'passphrase-setup'
  saveSetupState()
}

const handlePassphraseComplete = (passphrase: string) => {
  setupState.value.passphrase = passphrase
  currentStep.value = 'matrix-connection'
  saveSetupState()
}

const handleMatrixConnectionComplete = async () => {
  // Matrix connection is complete, now initialize client for encryption setup
  try {
    matrixClientService.setUserChosenToConnect(true)
    await matrixClientService.initializeClient(true)
    currentStep.value = 'encryption-progress'
    saveSetupState()
  } catch (error) {
    setupState.value.errorDetails = `Failed to initialize Matrix client: ${error.message}`
    saveSetupState()
    // Stay on matrix-connection step to show error
  }
}

const handleEncryptionComplete = () => {
  // Clear setup state - we're done!
  clearSetupState()

  // Check if there's a return URL to navigate back to
  const returnUrl = route.query.return as string
  if (returnUrl) {
    logger.debug('🔄 Setup complete, returning to:', returnUrl)
    // Use window.location.href to ensure full page navigation
    window.location.href = returnUrl
  }
}

const handleEncryptionError = (error: string) => {
  // If user cancelled or skipped, navigate back to original page
  if (error.includes('cancelled') || error.includes('skip')) {
    clearSetupState()
    const returnUrl = route.query.return as string
    if (returnUrl) {
      logger.debug('🔄 Setup cancelled, returning to:', returnUrl)
      window.location.href = returnUrl
      return
    }
  }

  // Otherwise, stay on encryption-progress step to show error and retry options
  setupState.value.errorDetails = error
  saveSetupState()
}

// Initialize setup state
onMounted(async () => {
  logger.debug('🏗️ ChatSetupOrchestrator mounted, checking setup state...')

  // Check if we need any setup
  logger.debug('🔍 Setup complete check on mount:', isSetupComplete.value)
  if (isSetupComplete.value) {
    logger.debug('✅ Setup already complete, not showing setup flow')
    return
  }

  logger.debug('🔄 Setup needed, current setup state:', setupState.value)

  // Determine starting step based on current state
  if (!setupState.value.currentStep) {
    logger.debug('🆕 No current step, starting from matrix-education')
    currentStep.value = 'matrix-education'
    saveSetupState()
  } else {
    logger.debug('📋 Existing step found:', setupState.value.currentStep)
    // Handle expired sessions: if user chose to connect but Matrix client isn't ready,
    // restart from matrix-connection step
    const hasChosen = matrixClientService.hasUserChosenToConnect()
    const isMatrixReady = matrixClientService.isReady()

    logger.debug('🔍 Session state check:', { hasChosen, isMatrixReady })

    if (hasChosen && !isMatrixReady) {
      logger.debug('🔄 Detected expired Matrix session, restarting from connection step')
      currentStep.value = 'matrix-connection'
      saveSetupState()
    }
  }
})
</script>

<style scoped>
.chat-setup-orchestrator {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
