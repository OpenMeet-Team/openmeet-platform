import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { EventEntity } from '../../../../../src/types'
import { createPinia, setActivePinia } from 'pinia'
import EventFormBasicComponent from '../../../../../src/components/event/EventFormBasicComponent.vue'

// Define an interface for the component's VM
interface EventFormBasicComponentVM {
  eventData: EventEntity;
  publishToBluesky: boolean;
  $nextTick: () => Promise<void>;
  [key: string]: unknown;
}

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Create a predictable "now" date for testing
const fixedDate = new Date('2025-02-15T12:00:00.000Z')
vi.useFakeTimers()
vi.setSystemTime(fixedDate)

// Mock the API modules
vi.mock('../../../../../src/api/events', () => ({
  eventsApi: {
    create: vi.fn().mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' },
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    }),
    update: vi.fn(),
    edit: vi.fn(),
    getBySlug: vi.fn()
  }
}))

vi.mock('../../../../../src/api/categories', () => ({
  categoriesApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' }
      ]
    })
  }
}))

vi.mock('../../../../../src/api/groups', () => ({
  groupsApi: {
    getAllMe: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Group 1' },
        { id: 2, name: 'Group 2' }
      ]
    })
  }
}))

vi.mock('../../../../../src/api/event-series', () => ({
  eventSeriesApi: {
    createSeriesFromEvent: vi.fn().mockResolvedValue({
      data: { slug: 'test-series', name: 'Test Series' }
    })
  }
}))

vi.mock('../../../../../src/services/analyticsService', () => ({
  default: {
    trackEvent: vi.fn()
  }
}))

// AT Protocol Orphan State Warning Banner
describe('EventFormBasicComponent - AT Protocol Orphan State Warning', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should show orphan state warning when publishToBluesky is ON and user is in orphan state', async () => {
    // Mock the auth store to return a user in orphan state
    const { useAuthStore } = await import('../../../../../src/stores/auth-store')
    const authStore = useAuthStore()

    // Set up user with AT Protocol identity in orphan state
    authStore.blueskyDid = 'did:plc:test123'
    authStore.blueskyHandle = 'test.opnmt.me'
    authStore.user = {
      ...authStore.user,
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      atprotoIdentity: {
        did: 'did:plc:test123',
        handle: 'test.opnmt.me',
        pdsUrl: 'https://pds.openmeet.net',
        isCustodial: false,
        isOurPds: true,
        hasActiveSession: false, // This is the orphan state - no active session
        validHandleDomains: ['.opnmt.me'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true, 'router-link': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Enable publish to Bluesky toggle
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    vm.publishToBluesky = true
    await vm.$nextTick()

    // The orphan state warning banner should be visible
    const orphanWarning = wrapper.find('[data-cy="atproto-orphan-warning"]')
    expect(orphanWarning.exists()).toBe(true)
    expect(orphanWarning.text()).toContain('session has expired')
  })

  it('should NOT show orphan state warning when publishToBluesky is OFF', async () => {
    const { useAuthStore } = await import('../../../../../src/stores/auth-store')
    const authStore = useAuthStore()

    // Set up user in orphan state
    authStore.blueskyDid = 'did:plc:test123'
    authStore.blueskyHandle = 'test.opnmt.me'
    authStore.user = {
      ...authStore.user,
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      atprotoIdentity: {
        did: 'did:plc:test123',
        handle: 'test.opnmt.me',
        pdsUrl: 'https://pds.openmeet.net',
        isCustodial: false,
        isOurPds: true,
        hasActiveSession: false,
        validHandleDomains: ['.opnmt.me'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true, 'router-link': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // publishToBluesky is OFF by default - warning should NOT show
    const orphanWarning = wrapper.find('[data-cy="atproto-orphan-warning"]')
    expect(orphanWarning.exists()).toBe(false)
  })

  it('should NOT show orphan state warning when user has active session', async () => {
    const { useAuthStore } = await import('../../../../../src/stores/auth-store')
    const authStore = useAuthStore()

    // Set up user with active session (NOT orphan state)
    authStore.blueskyDid = 'did:plc:test123'
    authStore.blueskyHandle = 'test.opnmt.me'
    authStore.user = {
      ...authStore.user,
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      atprotoIdentity: {
        did: 'did:plc:test123',
        handle: 'test.opnmt.me',
        pdsUrl: 'https://pds.openmeet.net',
        isCustodial: false,
        isOurPds: true,
        hasActiveSession: true, // Has active session - NOT orphan
        validHandleDomains: ['.opnmt.me'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true, 'router-link': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Enable publish to Bluesky
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    vm.publishToBluesky = true
    await vm.$nextTick()

    // Warning should NOT show - user has active session
    const orphanWarning = wrapper.find('[data-cy="atproto-orphan-warning"]')
    expect(orphanWarning.exists()).toBe(false)
  })

  it('should NOT show orphan state warning when user has custodial identity', async () => {
    const { useAuthStore } = await import('../../../../../src/stores/auth-store')
    const authStore = useAuthStore()

    // Set up user with custodial identity (OpenMeet manages credentials)
    authStore.blueskyDid = 'did:plc:test123'
    authStore.blueskyHandle = 'test.opnmt.me'
    authStore.user = {
      ...authStore.user,
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      atprotoIdentity: {
        did: 'did:plc:test123',
        handle: 'test.opnmt.me',
        pdsUrl: 'https://pds.openmeet.net',
        isCustodial: true, // Custodial - OpenMeet manages it
        isOurPds: true,
        hasActiveSession: false, // No session but custodial means it's OK
        validHandleDomains: ['.opnmt.me'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true, 'router-link': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Enable publish to Bluesky
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    vm.publishToBluesky = true
    await vm.$nextTick()

    // Warning should NOT show - custodial identity is managed by OpenMeet
    const orphanWarning = wrapper.find('[data-cy="atproto-orphan-warning"]')
    expect(orphanWarning.exists()).toBe(false)
  })

  it('should NOT show orphan state warning when user has no AT Protocol identity', async () => {
    const { useAuthStore } = await import('../../../../../src/stores/auth-store')
    const authStore = useAuthStore()

    // User has bluesky DID/handle but no atprotoIdentity object
    authStore.blueskyDid = 'did:plc:test123'
    authStore.blueskyHandle = 'test.opnmt.me'
    authStore.user = {
      ...authStore.user,
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      atprotoIdentity: null
    }

    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true, 'router-link': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Enable publish to Bluesky
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    vm.publishToBluesky = true
    await vm.$nextTick()

    // Warning should NOT show - no AT Protocol identity
    const orphanWarning = wrapper.find('[data-cy="atproto-orphan-warning"]')
    expect(orphanWarning.exists()).toBe(false)
  })

  it('should contain a link to the profile page for reconnecting', async () => {
    const { useAuthStore } = await import('../../../../../src/stores/auth-store')
    const authStore = useAuthStore()

    // Set up user in orphan state
    authStore.blueskyDid = 'did:plc:test123'
    authStore.blueskyHandle = 'test.opnmt.me'
    authStore.user = {
      ...authStore.user,
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      atprotoIdentity: {
        did: 'did:plc:test123',
        handle: 'test.opnmt.me',
        pdsUrl: 'https://pds.openmeet.net',
        isCustodial: false,
        isOurPds: true,
        hasActiveSession: false,
        validHandleDomains: ['.opnmt.me'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true, 'router-link': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Enable publish to Bluesky
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    vm.publishToBluesky = true
    await vm.$nextTick()

    // The warning should contain information about reconnecting
    const orphanWarning = wrapper.find('[data-cy="atproto-orphan-warning"]')
    expect(orphanWarning.exists()).toBe(true)
    // The banner text mentions the session issue and that reconnection is needed
    expect(orphanWarning.text()).toContain('AT Protocol session has expired')
    // Check that the HTML contains a link to the profile page
    expect(orphanWarning.html()).toContain('/dashboard/profile')
  })
})
