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

      <ChatPassphraseUnlock
        v-else-if="currentStep === 'passphrase-unlock'"
        @continue="handleExistingPassphraseComplete"
        @back="handlePassphraseUnlockBack"
        @reset="handlePassphraseReset"
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
        :mode="encryptionSetupMode"
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
import { computed, onMounted, ref } from 'vue'
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
import ChatPassphraseUnlock from './setup/ChatPassphraseUnlock.vue'
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

const props = withDefaults(defineProps<Props>(), {
  contextType: 'all',
  mode: 'dashboard',
  canOpenFullscreen: true,
  showInfoSidebar: false
})

// Router for navigation
const route = useRoute()

// Setup state management
const { setupState, currentStep, saveSetupState, clearSetupState } = useChatEncryptionSetup()

// Track encryption setup mode
const encryptionSetupMode = ref<'new-setup' | 'unlock-existing'>('new-setup')

// Force reactivity trigger for setup state changes
const forceUpdate = ref(0)

// Configuration
const homeserverUrl = computed(() => {
  return (getEnv('APP_MATRIX_HOMESERVER_URL') as string) || 'https://matrix.openmeet.net'
})

// Setup state types
type SetupState = 'needs-connection' | 'needs-encryption' | 'complete'

// Pure function to determine current setup state
const getSetupState = (): SetupState => {
  // Access forceUpdate to trigger reactivity
  void forceUpdate.value

  // NEW APPROACH: Check basic connection first, then encryption separately

  // Check if basic Matrix connection is ready (without crypto requirement)
  if (!matrixClientService.isReady()) {
    return 'needs-connection'
  }

  // Basic connection is ready - encryption is handled in background
  // We no longer require encryption setup to be complete before showing chat
  // This aligns with the new approach of skipping encryption detection

  // Both connection and encryption considerations are complete
  return 'complete'
}

// Computed state - pure, no side effects
const currentSetupState = computed(() => getSetupState())
const isSetupComplete = computed(() => currentSetupState.value === 'complete')

// Event handlers
const handleEducationComplete = () => {
  currentStep.value = 'setup-explainer'
  saveSetupState()
}

const handleSetupSkip = () => {
  // User chose to skip the entire setup process
  clearSetupState()
  sessionStorage.removeItem('was_setting_up_matrix')
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

  // Set flag to indicate user is starting Matrix connection process
  // This helps detect if they return but lose their OpenMeet session
  sessionStorage.setItem('was_setting_up_matrix', 'true')

  saveSetupState()
}

const handleExistingPassphraseComplete = (passphrase: string) => {
  // Store the existing passphrase and proceed directly to encryption verification
  setupState.value.passphrase = passphrase
  encryptionSetupMode.value = 'unlock-existing'
  currentStep.value = 'encryption-progress'

  // Set flag to indicate user is in Matrix setup process
  sessionStorage.setItem('was_setting_up_matrix', 'true')

  saveSetupState()
  logger.debug('🔓 Existing passphrase provided, attempting to unlock encryption')
}

const handlePassphraseUnlockBack = () => {
  // Go back to connection flow if they want to use a different account
  currentStep.value = 'matrix-connection'
  saveSetupState()
}

const handlePassphraseReset = () => {
  // User chose to reset encryption (forgot passphrase)
  logger.debug('🔥 User requested encryption reset due to forgotten passphrase')
  setupState.value.passphrase = '' // Clear any stored passphrase
  currentStep.value = 'setup-explainer' // Restart with full new setup
  saveSetupState()
}

const handleMatrixConnectionComplete = async () => {
  logger.debug('🔄 Matrix connection complete button clicked')

  // Clear any existing setup flag and continue
  const setupInProgressKey = 'matrix_setup_in_progress'
  sessionStorage.removeItem(setupInProgressKey)

  // Mark setup as in progress
  sessionStorage.setItem(setupInProgressKey, 'true')

  // NEW APPROACH: Basic Matrix connection is already ready, now handle encryption separately
  try {
    logger.debug('🔄 Connection complete, basic Matrix client ready')
    matrixClientService.setUserChosenToConnect(true)

    // Check Matrix client readiness (should already be ready since we got to this point)
    if (!matrixClientService.isReady()) {
      logger.warn('⚠️ Matrix client not ready after connection complete')
      // Try to initialize basic client (without crypto)
      await matrixClientService.initializeClient(true)
    }

    // SKIP encryption detection entirely - proceed directly to chat
    // Encryption will be handled in background by the chat interface
    logger.debug('🚀 Skipping encryption detection - proceeding directly to chat interface')
    logger.debug('💡 Matrix client is ready, encryption will load in background')

    // Clear setup state and proceed to chat
    clearSetupState()
    sessionStorage.removeItem('was_setting_up_matrix')

    // Force reactive update to recognize setup completion
    forceUpdate.value++

    // Navigate to return URL or stay on chat interface
    const returnUrl = route.query.return as string
    if (returnUrl) {
      logger.debug('🔄 Setup complete, returning to:', returnUrl)
      window.location.href = returnUrl
    } else {
      logger.debug('✅ Setup complete, showing chat interface')
      logger.debug('🔍 Debug state after completion:', {
        isSetupComplete: isSetupComplete.value,
        currentSetupState: currentSetupState.value,
        mode: props.mode
      })
      // The template will now show the chat interface since isSetupComplete is true
    }
    saveSetupState()
  } catch (error) {
    setupState.value.errorDetails = `Failed to initialize Matrix client: ${error.message}`
    saveSetupState()
    // Stay on matrix-connection step to show error
  } finally {
    // Clear setup in progress flag
    sessionStorage.removeItem(setupInProgressKey)
  }
}

const handleEncryptionComplete = () => {
  // Clear setup state - we're done!
  clearSetupState()
  sessionStorage.removeItem('was_setting_up_matrix')

  // Force reactive update to recognize setup completion
  forceUpdate.value++

  // Debug the current state
  logger.debug('🔍 After clearing setup state:', {
    isSetupComplete: isSetupComplete.value,
    currentSetupState: currentSetupState.value,
    mode: props.mode,
    contextType: props.contextType,
    contextId: props.contextId,
    inlineRoomId: props.inlineRoomId
  })

  // Check if there's a return URL to navigate back to
  const returnUrl = route.query.return as string
  if (returnUrl) {
    logger.debug('🔄 Setup complete, returning to:', returnUrl)
    // Use window.location.href to ensure full page navigation
    window.location.href = returnUrl
  } else {
    // No return URL - stay on this page and show the chat interface
    logger.debug('✅ Encryption setup complete, showing chat interface')
    // The template should now show the chat interface since isSetupComplete is true
  }
}

const handleEncryptionError = (error: string) => {
  // If user cancelled or skipped, navigate back to original page
  if (error.includes('cancelled') || error.includes('skip')) {
    clearSetupState()
    sessionStorage.removeItem('was_setting_up_matrix')
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
  logger.debug('🏗️ ChatSetupOrchestrator mounted')

  // Give auto-initialization a moment to complete if it's starting
  await new Promise(resolve => setTimeout(resolve, 100))

  const state = currentSetupState.value
  logger.debug('🔍 Current setup state:', state)

  if (state === 'complete') {
    logger.debug('✅ Setup already complete, showing chat interface directly')
    return
  }

  // Check if user has stored session but auto-initialization is still in progress
  if (matrixClientService.hasStoredSession() && !matrixClientService.isReady()) {
    logger.debug('🔄 Stored session exists, checking auto-initialization status...')

    // Wait longer and check more frequently for auto-initialization to complete
    // Matrix client can take 3-5 seconds to initialize with crypto stores
    let checkCount = 0
    const maxChecks = 15 // 15 checks * 500ms = 7.5 seconds total wait time

    const checkAutoInit = () => {
      checkCount++
      const newState = currentSetupState.value
      const isReady = matrixClientService.isReady()

      logger.debug(`🔍 Auto-init check ${checkCount}/${maxChecks}: state=${newState}, isReady=${isReady}`)

      if (newState === 'complete' && isReady) {
        logger.debug('✅ Auto-initialization completed, setup now complete')
        forceUpdate.value++ // Trigger reactivity update
      } else if (checkCount >= maxChecks) {
        logger.debug('⚠️ Auto-initialization timeout after 7.5s, proceeding with manual setup')
        initializeSetupFlow()
      } else {
        // Continue checking every 500ms
        setTimeout(checkAutoInit, 500)
      }
    }

    // Start checking after a brief initial delay
    setTimeout(checkAutoInit, 500)
    return
  }

  initializeSetupFlow()
})

// Separate function to initialize the setup flow
const initializeSetupFlow = () => {
  const state = currentSetupState.value

  // Determine starting step based on setup state and existing progress
  if (!setupState.value.currentStep) {
    logger.debug('🆕 No existing progress, starting from education')
    currentStep.value = 'matrix-education'
    saveSetupState()
  } else {
    logger.debug('📋 Resuming from existing step:', setupState.value.currentStep)

    // Check if current step matches the required state
    if (state === 'needs-connection' &&
        !['matrix-education', 'setup-explainer', 'passphrase-setup', 'matrix-connection'].includes(setupState.value.currentStep)) {
      logger.debug('🔄 Need connection but past connection steps, restarting connection flow')
      currentStep.value = 'matrix-connection'
      saveSetupState()
    } else if (state === 'needs-encryption' &&
               ['matrix-education', 'setup-explainer', 'passphrase-setup', 'matrix-connection'].includes(setupState.value.currentStep)) {
      // Check if setup is already in progress to prevent multiple concurrent flows
      if (!sessionStorage.getItem('matrix_setup_in_progress')) {
        logger.debug('🔄 Need encryption but still on connection steps, waiting for crypto to be ready')
        // Don't advance directly to encryption-progress, instead trigger the proper event-driven flow
        handleMatrixConnectionComplete()
      } else {
        logger.debug('🔒 Matrix setup already in progress from another instance, waiting')
      }
    }
  }
}
</script>

<style scoped>
.chat-setup-orchestrator {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
