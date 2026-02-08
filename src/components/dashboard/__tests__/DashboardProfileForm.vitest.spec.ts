import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar, LoadingBar } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../../stores/auth-store'
import DashboardProfileForm from '../DashboardProfileForm.vue'
import { AuthProvidersEnum } from '../../../types'
import type { AtprotoIdentityDto } from '../../../types/atproto'

// Mock analyticsService
const mockAnalyticsService = vi.hoisted(() => ({
  optOut: vi.fn(),
  optIn: vi.fn(),
  hasOptedOut: vi.fn().mockReturnValue(false),
  syncWithPreference: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  trackEvent: vi.fn()
}))

vi.mock('../../../services/analyticsService', () => ({
  default: mockAnalyticsService
}))

// Mock API modules
vi.mock('../../../api/auth', () => ({
  authApi: {
    getMe: vi.fn().mockResolvedValue({
      data: {
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        preferences: {
          bluesky: {
            connected: false,
            handle: null,
            did: null
          }
        }
      }
    }),
    updateMe: vi.fn().mockResolvedValue({ data: {} }),
    deleteMe: vi.fn().mockResolvedValue({ data: {} })
  }
}))

vi.mock('../../../api/subcategories', () => ({
  subcategoriesApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] })
  }
}))

vi.mock('../../../api/atproto', () => ({
  atprotoApi: {
    createIdentity: vi.fn().mockResolvedValue({ data: {} }),
    getRecoveryStatus: vi.fn().mockResolvedValue({ data: { hasExistingAccount: false } }),
    resetPdsPassword: vi.fn().mockResolvedValue({}),
    completeTakeOwnership: vi.fn().mockResolvedValue({}),
    getIdentity: vi.fn().mockResolvedValue({ data: {} }),
    linkIdentity: vi.fn().mockResolvedValue({ data: { authUrl: 'https://pds.example.com/oauth' } })
  }
}))

vi.mock('../../../composables/useNotification', () => ({
  useNotification: () => ({
    error: vi.fn(),
    success: vi.fn()
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

// Stub child components
const AtprotoIdentityCardStub = {
  name: 'AtprotoIdentityCard',
  template: '<div data-cy="profile-atproto-identity">AtprotoIdentityCard stub</div>',
  props: ['identity', 'loading', 'recoveryStatus', 'recovering']
}

const CalendarConnectionsComponentStub = {
  name: 'CalendarConnectionsComponent',
  template: '<div>CalendarConnections stub</div>'
}

const UploadComponentStub = {
  name: 'UploadComponent',
  template: '<div>Upload stub</div>',
  props: ['label', 'cropOptions']
}

describe('DashboardProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    // Mock LoadingBar
    LoadingBar.start = vi.fn()
    LoadingBar.stop = vi.fn()
  })

  const createMockAtprotoIdentity = (overrides: Partial<AtprotoIdentityDto> = {}): AtprotoIdentityDto => ({
    did: 'did:plc:z72i7hdynmk6r22z27h6tvur',
    handle: 'alice.bsky.social',
    pdsUrl: 'https://bsky.social',
    isCustodial: false,
    isOurPds: false,
    hasActiveSession: false,
    validHandleDomains: ['.bsky.social'],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides
  })

  const mountComponent = async (options: {
    provider?: AuthProvidersEnum
    atprotoIdentity?: AtprotoIdentityDto | null
  } = {}) => {
    const { provider = AuthProvidersEnum.email, atprotoIdentity = null } = options

    // Set up auth store with provider
    const authStore = useAuthStore()
    authStore.user = {
      id: 1,
      slug: 'test-user',
      ulid: 'test-ulid',
      email: 'test@example.com',
      provider
    }

    // Mock the getMe response to include atprotoIdentity
    const { authApi } = await import('../../../api/auth')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: {
        id: 1,
        ulid: 'test-ulid',
        slug: 'test-user',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        preferences: {
          bluesky: {
            connected: provider === AuthProvidersEnum.bluesky,
            handle: provider === AuthProvidersEnum.bluesky ? 'alice.bsky.social' : null,
            did: provider === AuthProvidersEnum.bluesky ? 'did:plc:z72i7hdynmk6r22z27h6tvur' : null
          }
        },
        atprotoIdentity
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const wrapper = mount(DashboardProfileForm, {
      global: {
        plugins: [Quasar],
        stubs: {
          AtprotoIdentityCard: AtprotoIdentityCardStub,
          CalendarConnectionsComponent: CalendarConnectionsComponentStub,
          UploadComponent: UploadComponentStub,
          QMarkdown: { template: '<div><slot /></div>' }
        }
      }
    })

    // Wait for onMounted to complete
    await flushPromises()

    return wrapper
  }

  describe('AtprotoIdentityCard visibility', () => {
    it('should show AtprotoIdentityCard for email users without identity', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: null
      })

      const identityCard = wrapper.find('[data-cy="profile-atproto-identity"]')
      expect(identityCard.exists()).toBe(true)
    })

    it('should show AtprotoIdentityCard for email users with identity', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: createMockAtprotoIdentity({ isCustodial: true, isOurPds: true })
      })

      const identityCard = wrapper.find('[data-cy="profile-atproto-identity"]')
      expect(identityCard.exists()).toBe(true)
    })

    it('should show AtprotoIdentityCard for Bluesky users with identity', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.bluesky,
        atprotoIdentity: createMockAtprotoIdentity({
          isCustodial: false,
          isOurPds: false,
          pdsUrl: 'https://bsky.social'
        })
      })

      const identityCard = wrapper.find('[data-cy="profile-atproto-identity"]')
      expect(identityCard.exists()).toBe(true)
    })

    it('should NOT show AtprotoIdentityCard for Bluesky users without identity', async () => {
      // Bluesky users without an atprotoIdentity in the response should not see the card
      // (This case is unlikely in practice but tests the conditional correctly)
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.bluesky,
        atprotoIdentity: null
      })

      const identityCard = wrapper.find('[data-cy="profile-atproto-identity"]')
      expect(identityCard.exists()).toBe(false)
    })
  })

  describe('Take ownership flow auto-redirect', () => {
    it('should auto-redirect to OAuth after password reset completes', async () => {
      // This test verifies that onResetPdsPassword calls onLinkIdentity after success
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: createMockAtprotoIdentity({
          isCustodial: true,
          isOurPds: true,
          handle: 'alice.opnmt.me'
        })
      })

      // Access the component's internal methods
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Mock the atproto API methods
      const { atprotoApi } = await import('../../../api/atproto')
      vi.mocked(atprotoApi).resetPdsPassword = vi.fn().mockResolvedValue({})
      vi.mocked(atprotoApi).completeTakeOwnership = vi.fn().mockResolvedValue({})
      vi.mocked(atprotoApi).getIdentity = vi.fn().mockResolvedValue({
        data: createMockAtprotoIdentity({
          isCustodial: false,
          isOurPds: true,
          handle: 'alice.opnmt.me',
          hasActiveSession: false
        })
      })
      vi.mocked(atprotoApi).linkIdentity = vi.fn().mockResolvedValue({
        data: { authUrl: 'https://pds.example.com/oauth/authorize' }
      })

      // Set up takeOwnershipPending state
      vm.takeOwnershipPending = true
      vm.atprotoIdentity = createMockAtprotoIdentity({
        isCustodial: true,
        isOurPds: true,
        handle: 'alice.opnmt.me'
      })

      // Call the password reset handler
      await vm.onResetPdsPassword({ token: 'ABC123', password: 'newpassword123' })

      // Verify linkIdentity was called to initiate OAuth
      expect(vi.mocked(atprotoApi).linkIdentity).toHaveBeenCalledWith('alice.opnmt.me', 'web')
    })
  })

  describe('Handle input dialog for account linking', () => {
    it('should show the link dialog when onLinkIdentity is called without a handle', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: null
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Call onLinkIdentity without a handle - should show dialog
      vm.onLinkIdentity()
      await wrapper.vm.$nextTick()

      expect(vm.showLinkDialog).toBe(true)
    })

    it('should NOT show the link dialog when onLinkIdentity is called with a handle', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: createMockAtprotoIdentity({
          isCustodial: true,
          isOurPds: true,
          handle: 'alice.opnmt.me'
        })
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const { atprotoApi } = await import('../../../api/atproto')
      vi.mocked(atprotoApi).linkIdentity = vi.fn().mockResolvedValue({
        data: { authUrl: 'https://pds.example.com/oauth/authorize' }
      })

      // Call onLinkIdentity with a handle - should skip dialog and link directly
      await vm.onLinkIdentity('alice.opnmt.me')

      expect(vm.showLinkDialog).toBe(false)
      expect(vi.mocked(atprotoApi).linkIdentity).toHaveBeenCalledWith('alice.opnmt.me', 'web')
    })

    it('should call linkIdentity API with entered handle when dialog connect button calls submitLinkHandle', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: null
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const { atprotoApi } = await import('../../../api/atproto')
      vi.mocked(atprotoApi).linkIdentity = vi.fn().mockResolvedValue({
        data: { authUrl: 'https://pds.example.com/oauth/authorize' }
      })

      // Open the dialog
      vm.onLinkIdentity()
      await wrapper.vm.$nextTick()

      // Set the handle
      vm.linkHandle = 'bob.bsky.social'

      // Submit
      await vm.submitLinkHandle()

      expect(vi.mocked(atprotoApi).linkIdentity).toHaveBeenCalledWith('bob.bsky.social', 'web')
    })

    it('should close dialog when cancelLinkDialog is called', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: null
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Open the dialog
      vm.onLinkIdentity()
      await wrapper.vm.$nextTick()
      expect(vm.showLinkDialog).toBe(true)

      // Cancel
      vm.cancelLinkDialog()
      await wrapper.vm.$nextTick()

      expect(vm.showLinkDialog).toBe(false)
      expect(vm.linkHandle).toBe('')
      expect(vm.linkError).toBe('')
    })

    it('should show error state when API call fails in dialog', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: null
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const { atprotoApi } = await import('../../../api/atproto')
      vi.mocked(atprotoApi).linkIdentity = vi.fn().mockRejectedValue({
        response: { data: { message: 'Handle not found' } }
      })

      // Open the dialog
      vm.onLinkIdentity()
      await wrapper.vm.$nextTick()

      // Set the handle and submit
      vm.linkHandle = 'nonexistent.handle'
      await vm.submitLinkHandle()
      await flushPromises()

      expect(vm.linkError).toBe('Handle not found')
      expect(vm.showLinkDialog).toBe(true)
    })

    it('should have link dialog state variables initialized correctly', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: null
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Initially dialog should be closed
      expect(vm.showLinkDialog).toBe(false)
      expect(vm.linkHandle).toBe('')
      expect(vm.linkError).toBe('')

      // Open the dialog
      vm.onLinkIdentity()
      await wrapper.vm.$nextTick()

      // Dialog state should be open
      expect(vm.showLinkDialog).toBe(true)
    })
  })

  describe('Take ownership auto-link uses handle directly', () => {
    it('should pass identity handle to onLinkIdentity from onResetPdsPassword', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: createMockAtprotoIdentity({
          isCustodial: true,
          isOurPds: true,
          handle: 'alice.opnmt.me'
        })
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const { atprotoApi } = await import('../../../api/atproto')
      vi.mocked(atprotoApi).resetPdsPassword = vi.fn().mockResolvedValue({})
      vi.mocked(atprotoApi).completeTakeOwnership = vi.fn().mockResolvedValue({})
      vi.mocked(atprotoApi).getIdentity = vi.fn().mockResolvedValue({
        data: createMockAtprotoIdentity({
          isCustodial: false,
          isOurPds: true,
          handle: 'alice.opnmt.me',
          hasActiveSession: false
        })
      })
      vi.mocked(atprotoApi).linkIdentity = vi.fn().mockResolvedValue({
        data: { authUrl: 'https://pds.example.com/oauth/authorize' }
      })

      vm.takeOwnershipPending = true
      vm.atprotoIdentity = createMockAtprotoIdentity({
        isCustodial: true,
        isOurPds: true,
        handle: 'alice.opnmt.me'
      })

      await vm.onResetPdsPassword({ token: 'ABC123', password: 'newpassword123' })

      // Should have called linkIdentity directly with the handle (no dialog)
      expect(vi.mocked(atprotoApi).linkIdentity).toHaveBeenCalledWith('alice.opnmt.me', 'web')
      expect(vm.showLinkDialog).toBe(false)
    })
  })

  describe('Privacy & Analytics section', () => {
    it('should show Privacy & Analytics section', async () => {
      const wrapper = await mountComponent()
      const section = wrapper.find('[data-cy="profile-privacy-analytics"]')
      expect(section.exists()).toBe(true)
    })

    it('should show analytics opt-out toggle', async () => {
      const wrapper = await mountComponent()
      const toggle = wrapper.find('[data-cy="analytics-optout-toggle"]')
      expect(toggle.exists()).toBe(true)
    })

    it('should reflect current opt-out state from analyticsService', async () => {
      mockAnalyticsService.hasOptedOut.mockReturnValue(true)
      const wrapper = await mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any
      expect(vm.analyticsOptOut).toBe(true)
    })

    it('should call analyticsService.optOut when toggle is turned on', async () => {
      mockAnalyticsService.hasOptedOut.mockReturnValue(false)
      const wrapper = await mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any
      await vm.onAnalyticsOptOutChange(true)
      await flushPromises()
      expect(mockAnalyticsService.optOut).toHaveBeenCalled()
    })

    it('should call analyticsService.optIn when toggle is turned off', async () => {
      mockAnalyticsService.hasOptedOut.mockReturnValue(true)
      const wrapper = await mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any
      await vm.onAnalyticsOptOutChange(false)
      await flushPromises()
      expect(mockAnalyticsService.optIn).toHaveBeenCalled()
    })

    it('should call authApi.updateMe with analytics preference when toggled', async () => {
      const wrapper = await mountComponent()
      const { authApi } = await import('../../../api/auth')
      vi.mocked(authApi.updateMe).mockResolvedValue({ data: {} } as never)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any
      await vm.onAnalyticsOptOutChange(true)
      await flushPromises()

      expect(vi.mocked(authApi.updateMe)).toHaveBeenCalledWith({
        preferences: { analytics: { optOut: true } }
      })
    })
  })
})
