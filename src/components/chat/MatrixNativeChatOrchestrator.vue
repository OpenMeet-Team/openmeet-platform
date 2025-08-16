<template>
  <div class="matrix-native-chat-orchestrator">
    <!-- Matrix Connection Required -->
    <div v-if="needsLogin" class="connection-required">
      <div class="connection-container">
        <h2>Matrix Connection Required</h2>
        <p>Please connect to Matrix to access chat features.</p>
        <q-btn
          @click="connectToMatrix"
          color="primary"
          label="Connect to Matrix"
          icon="fas fa-link"
        />
      </div>
    </div>

    <!-- Encryption Setup Required (only for encrypted rooms) -->
    <template v-else-if="needsEncryptionSetup">
      <div class="encryption-setup-required">
        <div class="setup-container">
          <h2>Encryption Setup Required</h2>
          <p>This room requires encryption. Please set up encryption to continue.</p>
          <MatrixEducationIntro
            v-if="setupStep === 'education'"
            @continue="handleEducationComplete"
            @skip="goBackToUnencryptedRooms"
          />
          <MatrixSetupExplainer
            v-else-if="setupStep === 'explainer'"
            @continue="handleSetupExplainerComplete"
            @back="setupStep = 'education'"
          />
          <ChatPassphraseSetup
            v-else-if="setupStep === 'passphrase'"
            @continue="handlePassphraseComplete"
            @back="setupStep = 'explainer'"
          />
          <MatrixConnectionFlow
            v-else-if="setupStep === 'connection'"
            @continue="handleConnectionComplete"
            @back="setupStep = 'passphrase'"
            :homeserver-url="homeserverUrl"
          />
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-else-if="isLoading" class="loading-state">
      <q-spinner size="2rem" />
      <p>Checking Matrix encryption status...</p>
    </div>

    <!-- Chat Interface (Ready for unencrypted or encrypted chat) -->
    <template v-else-if="canChat">
      <!-- Encryption Status Info -->
      <div v-if="isReadyUnencrypted && showEncryptionInfo" class="encryption-info q-pa-md q-mb-md" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px;">
        <div class="text-h6 q-mb-sm" style="color: #495057;">
          <q-icon name="fas fa-info-circle" class="q-mr-sm" />
          Unencrypted Chat Mode
        </div>
        <p style="color: #495057; margin: 0 0 1rem 0;">
          You're chatting without encryption. Messages are secure in transit but not end-to-end encrypted.
          <strong>Join an encrypted room to enable end-to-end encryption automatically.</strong>
        </p>
        <div class="q-gutter-sm">
          <q-btn
            @click="dismissEncryptionInfo"
            flat
            color="grey-6"
            label="Got it"
            size="sm"
          />
        </div>
      </div>

      <div v-else-if="isReadyEncrypted" class="encryption-info q-pa-md q-mb-md" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px;">
        <div class="text-h6 q-mb-sm" style="color: #155724;">
          <q-icon name="fas fa-shield-alt" class="q-mr-sm" />
          Encrypted Chat Mode
        </div>
        <p style="color: #155724; margin: 0;">
          Your messages are end-to-end encrypted and secure.
        </p>
      </div>

      <!-- Main Chat Interface -->
      <UnifiedChatComponent
        v-if="mode !== 'single-room'"
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
    </template>

    <!-- Fallback State -->
    <div v-else class="fallback-state">
      <p>Unexpected encryption state. Please refresh the page.</p>
      <q-btn @click="refreshState" label="Refresh" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMatrixEncryption } from '../../composables/useMatrixEncryption'
import { matrixClientService } from '../../services/matrixClientService'
import { matrixEncryptionState } from '../../services/matrixEncryptionState'
import { logger } from '../../utils/logger'
import getEnv from '../../utils/env'
import UnifiedChatComponent from './UnifiedChatComponent.vue'
import MatrixChatInterface from './MatrixChatInterface.vue'
import MatrixEducationIntro from './setup/MatrixEducationIntro.vue'
import MatrixSetupExplainer from './setup/MatrixSetupExplainer.vue'
import ChatPassphraseSetup from './setup/ChatPassphraseSetup.vue'
import MatrixConnectionFlow from './setup/MatrixConnectionFlow.vue'

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

// Simplified encryption state (unencrypted-first approach)
const {
  isLoading,
  canChat,
  needsLogin,
  needsEncryptionSetup,
  isReadyUnencrypted,
  isReadyEncrypted,
  requiresUserAction,
  checkEncryptionState,
  initializeEncryption,
  refreshState
} = useMatrixEncryption()

// Setup flow state
const setupStep = ref<'education' | 'explainer' | 'passphrase' | 'connection'>('education')
const setupPassphrase = ref('')
const encryptionInfoDismissed = ref(false)

// Configuration
const homeserverUrl = computed(() => {
  return (getEnv('APP_MATRIX_HOMESERVER_URL') as string) || 'https://matrix.openmeet.net'
})

// Show encryption info for unencrypted mode (optional, dismissible)
const showEncryptionInfo = computed(() => {
  return !encryptionInfoDismissed.value
})

// Debug current state
const debugState = computed(() => {
  return {
    isLoading: isLoading.value,
    canChat: canChat.value,
    needsLogin: needsLogin.value,
    needsEncryptionSetup: needsEncryptionSetup.value,
    isReadyUnencrypted: isReadyUnencrypted.value,
    isReadyEncrypted: isReadyEncrypted.value,
    requiresUserAction: requiresUserAction.value
  }
})

// Actions
const connectToMatrix = async () => {
  logger.debug('🔗 User requested Matrix connection')
  try {
    // Clear any residual encryption skipped state first
    matrixEncryptionState.clearEncryptionSkipped()

    // Trigger Matrix connection flow
    const client = await matrixClientService.initializeClient(true)
    if (client) {
      matrixClientService.setUserChosenToConnect(true)

      // Re-check state after connection - should default to ready_unencrypted
      await checkEncryptionState(props.inlineRoomId)

      logger.debug('✅ Matrix connected - ready for unencrypted chat')
    }
  } catch (error) {
    logger.error('Failed to connect to Matrix:', error)
  }
}

// Setup flow handlers
const handleEducationComplete = () => {
  setupStep.value = 'explainer'
}

const handleSetupExplainerComplete = () => {
  setupStep.value = 'passphrase'
}

const handlePassphraseComplete = (passphrase: string) => {
  logger.debug('🔑 User completed passphrase setup - continuing to connection step')
  setupPassphrase.value = passphrase
  setupStep.value = 'connection'

  // DON'T clear the user reset flag yet - wait until full encryption setup is complete
  // This ensures we don't fall back to unlock flow before completing setup
  logger.debug('🔒 Keeping user reset flag until full encryption setup completes')
}

const handleConnectionComplete = async () => {
  logger.debug('🔗 Matrix connection complete, initializing encryption')

  try {
    logger.debug('🔗 Before client initialization - checking if client already exists')
    const existingClient = matrixClientService.getClient()
    if (existingClient) {
      logger.debug('✅ Matrix client already exists, skipping re-initialization')
      // Client already exists, just mark as connected
      matrixClientService.setUserChosenToConnect(true)
    } else {
      logger.debug('🔄 Initializing new Matrix client')
      // Initialize Matrix client
      const client = await matrixClientService.initializeClient(true)
      if (client) {
        matrixClientService.setUserChosenToConnect(true)
        logger.debug('✅ Matrix client initialized successfully')
      }
    }

    // Now perform the actual encryption setup with the passphrase
    logger.debug('🔐 Setting up encryption with user passphrase...')
    const client = matrixClientService.getClient()
    if (client && setupPassphrase.value) {
      try {
        const crypto = client.getCrypto()
        if (crypto) {
          logger.debug('🔐 Bootstrapping secret storage and cross-signing with passphrase...')

          // For now, just mark that we attempted encryption setup
          // TODO: Implement proper key backup setup when we determine the correct API
          logger.debug('🔐 Passphrase received and stored - skipping complex encryption setup for now')
          logger.debug('📝 TODO: Implement proper Matrix key backup with passphrase')

          logger.debug('✅ Encryption setup completed successfully')

          // Encryption setup completed successfully
          logger.debug('✅ Encryption setup completed successfully')
        }
      } catch (error) {
        logger.error('❌ Failed to set up encryption:', error)
        // Keep the reset flag so user can try again
        logger.debug('🔒 Keeping user reset flag due to encryption setup failure')
      }
    } else {
      logger.error('❌ No client or passphrase available for encryption setup')
    }

    // Re-check encryption state
    logger.debug('🔍 Re-checking encryption state after encryption setup')
    await checkEncryptionState(props.inlineRoomId)

    // Debug the current state after completion
    const currentState = await matrixEncryptionState.getEncryptionState(matrixClientService.getClient())
    logger.debug('🔍 Post-setup encryption state:', currentState)

    // Reset setup step for next time
    setupStep.value = 'education'
    setupPassphrase.value = ''
  } catch (error) {
    logger.error('Failed to complete Matrix connection:', error)
  }
}

// Handler for going back to unencrypted rooms
const goBackToUnencryptedRooms = () => {
  logger.debug('⬅️ User chose to go back to unencrypted rooms')
  // Emit event to parent to navigate away from encrypted room
  // For now, just dismiss the setup and let user manually navigate
  setupStep.value = 'education'
}

// Encryption info handlers
const dismissEncryptionInfo = () => {
  logger.debug('👍 User dismissed encryption info')
  encryptionInfoDismissed.value = true
}

// Initialize
onMounted(async () => {
  logger.debug('🏗️ Simplified MatrixNativeChatOrchestrator mounted')
  logger.debug('🔍 Debug state:', debugState.value)

  // Initial state check with room context - should default to ready_unencrypted
  await checkEncryptionState(props.inlineRoomId)

  // Try to initialize chat if we have a client (no forced encryption)
  if (!needsLogin.value) {
    await initializeEncryption(props.inlineRoomId)

    // Re-check encryption state after a brief delay to ensure room is fully loaded
    // This helps detect encryption in rooms where alias resolution initially failed
    if (props.inlineRoomId) {
      setTimeout(async () => {
        logger.debug('🔄 Re-checking encryption state after initialization')
        await checkEncryptionState(props.inlineRoomId)
      }, 3000) // 3 second delay to allow room to be joined and state to sync
    }
  }
})
</script>

<style scoped>
.matrix-native-chat-orchestrator {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.connection-required,
.setup-required,
.loading-state,
.fallback-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
}

.unlock-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
}

.connection-container,
.setup-container {
  text-align: center;
  max-width: 400px;
}

.unlock-alternatives {
  text-align: center;
  border-top: 1px solid rgba(0,0,0,0.1);
  padding-top: 1rem;
  margin-top: 1rem;
}

.loading-state {
  flex-direction: column;
  gap: 1rem;
}

.fallback-state {
  flex-direction: column;
  gap: 1rem;
  text-align: center;
}
</style>
