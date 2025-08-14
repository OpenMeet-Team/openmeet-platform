import { ref, computed } from 'vue'
import getEnv from '../utils/env'

// Setup state interface
interface ChatSetupState {
  currentStep: string | null
  passphrase: string
  passphraseConfirm: string
  setupProgress: number
  errorDetails: string | null
  completedSteps: string[]
  startedAt: number | null
}

// Setup step type
type SetupStep =
  | 'matrix-education'
  | 'setup-explainer'
  | 'passphrase-setup'
  | 'passphrase-unlock'
  | 'matrix-connection'
  | 'encryption-progress'

// Storage key generation
const getStorageKey = (): string => {
  const tenantId = getEnv('APP_TENANT_ID') || 'default'
  // Use a simple user identifier or fallback to session-based storage
  const userId = localStorage.getItem('userId') || 'anonymous'
  return `chat_setup_state_${tenantId}_${userId}`
}

// Default state
const createDefaultState = (): ChatSetupState => ({
  currentStep: null,
  passphrase: '',
  passphraseConfirm: '',
  setupProgress: 0,
  errorDetails: null,
  completedSteps: [],
  startedAt: null
})

// Reactive state
const setupState = ref<ChatSetupState>(createDefaultState())
const currentStep = ref<SetupStep | null>(null)

// Load state from localStorage
const loadSetupState = (): void => {
  try {
    const storageKey = getStorageKey()
    const saved = localStorage.getItem(storageKey)

    if (saved) {
      const parsed = JSON.parse(saved) as ChatSetupState

      // Validate the saved state has required properties
      if (parsed && typeof parsed === 'object') {
        setupState.value = {
          ...createDefaultState(),
          ...parsed
        }

        // Set current step from saved state
        if (parsed.currentStep) {
          currentStep.value = parsed.currentStep as SetupStep
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load chat setup state:', error)
    // Reset to default state on error
    setupState.value = createDefaultState()
    currentStep.value = null
  }
}

// Save state to localStorage
const saveSetupState = (): void => {
  try {
    const storageKey = getStorageKey()
    const stateToSave: ChatSetupState = {
      ...setupState.value,
      currentStep: currentStep.value
    }

    localStorage.setItem(storageKey, JSON.stringify(stateToSave))
  } catch (error) {
    console.warn('Failed to save chat setup state:', error)
  }
}

// Clear setup state
const clearSetupState = (): void => {
  try {
    const storageKey = getStorageKey()
    localStorage.removeItem(storageKey)

    // Reset reactive state
    setupState.value = createDefaultState()
    currentStep.value = null
  } catch (error) {
    console.warn('Failed to clear chat setup state:', error)
  }
}

// Mark step as completed
const markStepCompleted = (step: SetupStep): void => {
  if (!setupState.value.completedSteps.includes(step)) {
    setupState.value.completedSteps.push(step)
    saveSetupState()
  }
}

// Check if step is completed
const isStepCompleted = (step: SetupStep): boolean => {
  return setupState.value.completedSteps.includes(step)
}

// Get setup progress as percentage
const getSetupProgress = computed(() => {
  const totalSteps = 5 // Total number of setup steps
  const completedCount = setupState.value.completedSteps.length
  return Math.round((completedCount / totalSteps) * 100)
})

// Check if setup can be resumed
const canResumeSetup = computed(() => {
  return setupState.value.startedAt && currentStep.value && !isStepCompleted('encryption-progress')
})

// Get setup duration
const getSetupDuration = computed(() => {
  if (!setupState.value.startedAt) return 0
  return Date.now() - setupState.value.startedAt
})

// Start setup tracking
const startSetup = (): void => {
  if (!setupState.value.startedAt) {
    setupState.value.startedAt = Date.now()
    saveSetupState()
  }
}

// Reset setup for retry
const resetSetup = (): void => {
  setupState.value = {
    ...createDefaultState(),
    startedAt: Date.now() // Keep timing for analytics
  }
  currentStep.value = 'matrix-education'
  saveSetupState()
}

// Navigation helpers
const goToNextStep = (fromStep: SetupStep, toStep: SetupStep): void => {
  markStepCompleted(fromStep)
  currentStep.value = toStep
  saveSetupState()
}

const goToPreviousStep = (step: SetupStep): void => {
  currentStep.value = step
  saveSetupState()
}

// Error handling
const setError = (error: string): void => {
  setupState.value.errorDetails = error
  saveSetupState()
}

const clearError = (): void => {
  setupState.value.errorDetails = null
  saveSetupState()
}

// Initialize state on first import
loadSetupState()

export function useChatEncryptionSetup () {
  return {
    // State
    setupState,
    currentStep,

    // Computed
    getSetupProgress,
    canResumeSetup,
    getSetupDuration,

    // Methods
    loadSetupState,
    saveSetupState,
    clearSetupState,
    startSetup,
    resetSetup,
    markStepCompleted,
    isStepCompleted,
    goToNextStep,
    goToPreviousStep,
    setError,
    clearError
  }
}
