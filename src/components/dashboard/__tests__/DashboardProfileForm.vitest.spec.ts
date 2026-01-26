import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar, LoadingBar } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../../stores/auth-store'
import DashboardProfileForm from '../DashboardProfileForm.vue'
import { AuthProvidersEnum } from '../../../types'
import type { AtprotoIdentityDto } from '../../../types/atproto'

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
    createIdentity: vi.fn().mockResolvedValue({ data: {} })
  }
}))

vi.mock('../../../composables/useBlueskyConnection', () => ({
  useBlueskyConnection: () => ({
    toggleConnection: vi.fn().mockResolvedValue(true)
  })
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

  describe('Bluesky settings section', () => {
    it('should show Bluesky settings for Bluesky users', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.bluesky,
        atprotoIdentity: createMockAtprotoIdentity()
      })

      const blueskySection = wrapper.find('[data-cy="profile-bluesky"]')
      expect(blueskySection.exists()).toBe(true)
    })

    it('should NOT show Bluesky settings for email users', async () => {
      const wrapper = await mountComponent({
        provider: AuthProvidersEnum.email,
        atprotoIdentity: null
      })

      const blueskySection = wrapper.find('[data-cy="profile-bluesky"]')
      expect(blueskySection.exists()).toBe(false)
    })
  })
})
