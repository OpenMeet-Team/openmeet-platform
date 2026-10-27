import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import { ref } from 'vue'

/**
 * The orchestrator must not decide a stored Matrix session is unusable while app
 * startup is still restoring it. On a cold page load the event page can mount chat
 * before the background restore has created the client; treating that moment as
 * "tokens but no client" showed "Connect to Matrix" and reset the restore mid-flight.
 */

function deferred () {
  let resolve!: () => void
  const promise = new Promise<void>((_resolve) => { resolve = _resolve })
  return { promise, resolve }
}

const mockClient = { isLoggedIn: () => true }
let startupRestore = deferred()

const mockMatrixClientManager = {
  getClient: vi.fn((): typeof mockClient | null => null),
  waitForStartupRestore: vi.fn(() => startupRestore.promise),
  clearClientAndCredentials: vi.fn(async () => {}),
  isRoomEncrypted: vi.fn(() => false)
}

vi.mock('../../../services/MatrixClientManager', () => ({
  matrixClientManager: mockMatrixClientManager
}))

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: () => ({
    isInitialized: true,
    user: { slug: 'test-user-slug' }
  })
}))

vi.mock('../../../utils/matrixTokenUtils', () => ({
  hasStoredMatrixTokens: vi.fn(() => true)
}))

vi.mock('../../../services/MatrixEncryptionManager', () => ({
  matrixEncryptionState: { clearEncryptionSkipped: vi.fn() },
  MatrixEncryptionService: vi.fn()
}))

vi.mock('../../../composables/useMatrixEncryption', () => ({
  useMatrixEncryption: () => ({
    encryptionStatus: ref(null),
    isLoading: ref(false),
    canChat: ref(false),
    needsEncryptionSetup: ref(false),
    needsBanner: ref(false),
    warningMessage: ref(''),
    isReadyUnencrypted: ref(false),
    isReadyEncrypted: ref(false),
    requiresUserAction: ref(false),
    checkEncryptionState: vi.fn(async () => {}),
    initializeEncryption: vi.fn(async () => false),
    refreshState: vi.fn(async () => {})
  })
}))

const stub = (name: string) => ({ default: { name, render: () => null } })
vi.mock('../UnifiedChatComponent.vue', () => stub('UnifiedChatComponent'))
vi.mock('../MatrixChatInterface.vue', () => stub('MatrixChatInterface'))
vi.mock('../MatrixConnectionStatus.vue', () => stub('MatrixConnectionStatus'))
vi.mock('../encryption/UnifiedEncryptionBanner.vue', () => stub('UnifiedEncryptionBanner'))
vi.mock('../verification/VerificationNotificationBanner.vue', () => stub('VerificationNotificationBanner'))
vi.mock('../verification/DeviceVerificationDialog.vue', () => stub('DeviceVerificationDialog'))

const { default: MatrixNativeChatOrchestrator } = await import('../MatrixNativeChatOrchestrator.vue')

const mountOrchestrator = () => mount(MatrixNativeChatOrchestrator, {
  props: { contextType: 'event', contextId: 'weekly-discussion', mode: 'single-room' },
  global: { plugins: [Quasar] }
})

describe('MatrixNativeChatOrchestrator - stored session check on mount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    startupRestore = deferred()
    mockMatrixClientManager.getClient.mockReturnValue(null)
  })

  it('does not offer "Connect to Matrix" while the startup restore is still running', async () => {
    const wrapper = mountOrchestrator()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Connect to Matrix')
    expect(mockMatrixClientManager.clearClientAndCredentials).not.toHaveBeenCalled()
  })

  it('keeps the chat once the startup restore brings the client up', async () => {
    const wrapper = mountOrchestrator()
    await flushPromises()

    mockMatrixClientManager.getClient.mockReturnValue(mockClient)
    startupRestore.resolve()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Connect to Matrix')
    expect(mockMatrixClientManager.clearClientAndCredentials).not.toHaveBeenCalled()
  })

  it('offers "Connect to Matrix" when the restore settles without a working client', async () => {
    const wrapper = mountOrchestrator()
    await flushPromises()

    startupRestore.resolve()
    await flushPromises()

    expect(wrapper.text()).toContain('Connect to Matrix')
    expect(mockMatrixClientManager.clearClientAndCredentials).toHaveBeenCalledTimes(1)
  })
})
