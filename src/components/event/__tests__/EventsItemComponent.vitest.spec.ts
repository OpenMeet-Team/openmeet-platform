import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'
import EventsItemComponent from '../EventsItemComponent.vue'
import { EventEntity, EventType } from '../../../types'
import { eventsApi } from '../../../api/events'

// Mock the auth store
vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: vi.fn()
}))

// Mock the events API
vi.mock('../../../api/events', () => ({
  eventsApi: {
    syncAtproto: vi.fn()
  }
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  RouterLink: {
    name: 'RouterLink',
    template: '<a><slot /></a>',
    props: ['to']
  }
}))

import { useAuthStore } from '../../../stores/auth-store'

describe('EventsItemComponent', () => {
  const createMockEvent = (overrides: Partial<EventEntity> = {}): EventEntity => ({
    id: 1,
    ulid: 'test-ulid',
    slug: 'test-event',
    name: 'Test Event',
    startDate: '2025-02-15T10:00:00Z',
    type: EventType.InPerson,
    location: 'Test Location',
    ...overrides
  })

  const mountComponent = (props = {}, authStoreOverrides = {}) => {
    const mockAuthStore = {
      user: {
        id: 1,
        slug: 'test-user',
        atprotoIdentity: null
      },
      ...authStoreOverrides
    }

    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore as ReturnType<typeof useAuthStore>)

    return mount(EventsItemComponent, {
      global: {
        plugins: [Quasar],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
            props: ['to']
          }
        }
      },
      props: {
        event: createMockEvent(),
        layout: 'grid',
        ...props
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('Publish chip visibility', () => {
    it('should show "Publish" chip when event can be published (no atprotoUri, no sourceType, user has active session)', () => {
      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: undefined,
            sourceType: undefined
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: {
              did: 'did:plc:test123',
              handle: 'test.opnmt.me',
              hasActiveSession: true,
              isCustodial: true,
              isOurPds: true,
              pdsUrl: 'https://pds.openmeet.net',
              validHandleDomains: ['.opnmt.me'],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      expect(publishChip.exists()).toBe(true)
      expect(publishChip.text()).toContain('Not published')
    })

    it('should not show publish chip when event already has atprotoUri', () => {
      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: 'at://did:plc:test/app.bsky.feed.post/123',
            sourceType: undefined
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: {
              did: 'did:plc:test123',
              handle: 'test.opnmt.me',
              hasActiveSession: true,
              isCustodial: true,
              isOurPds: true,
              pdsUrl: 'https://pds.openmeet.net',
              validHandleDomains: ['.opnmt.me'],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      expect(publishChip.exists()).toBe(false)
    })

    it('should not show publish chip when event has sourceType (imported event)', () => {
      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: undefined,
            sourceType: 'bluesky'
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: {
              did: 'did:plc:test123',
              handle: 'test.opnmt.me',
              hasActiveSession: true,
              isCustodial: true,
              isOurPds: true,
              pdsUrl: 'https://pds.openmeet.net',
              validHandleDomains: ['.opnmt.me'],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      expect(publishChip.exists()).toBe(false)
    })

    it('should not show publish chip when user has no active ATProto session', () => {
      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: undefined,
            sourceType: undefined
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: {
              did: 'did:plc:test123',
              handle: 'test.opnmt.me',
              hasActiveSession: false, // No active session
              isCustodial: true,
              isOurPds: true,
              pdsUrl: 'https://pds.openmeet.net',
              validHandleDomains: ['.opnmt.me'],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      expect(publishChip.exists()).toBe(false)
    })

    it('should not show publish chip when user has no ATProto identity', () => {
      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: undefined,
            sourceType: undefined
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: null
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      expect(publishChip.exists()).toBe(false)
    })
  })

  describe('Publish chip interaction', () => {
    it('should show loading state while publishing', async () => {
      // Make the API call hang
      vi.mocked(eventsApi.syncAtproto).mockImplementation(() => new Promise(() => {}))

      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: undefined,
            sourceType: undefined
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: {
              did: 'did:plc:test123',
              handle: 'test.opnmt.me',
              hasActiveSession: true,
              isCustodial: true,
              isOurPds: true,
              pdsUrl: 'https://pds.openmeet.net',
              validHandleDomains: ['.opnmt.me'],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      await publishChip.trigger('click')

      // Wait for vue to update
      await wrapper.vm.$nextTick()

      // Should show loading state
      expect(wrapper.find('[data-cy="publish-atproto-chip"]').text()).toContain('Publishing')
    })

    it('should emit "synced" event on successful publish', async () => {
      const updatedEvent = createMockEvent({
        atprotoUri: 'at://did:plc:test/app.bsky.feed.post/123'
      })

      vi.mocked(eventsApi.syncAtproto).mockResolvedValue({
        data: updatedEvent,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never
      })

      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: undefined,
            sourceType: undefined
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: {
              did: 'did:plc:test123',
              handle: 'test.opnmt.me',
              hasActiveSession: true,
              isCustodial: true,
              isOurPds: true,
              pdsUrl: 'https://pds.openmeet.net',
              validHandleDomains: ['.opnmt.me'],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      await publishChip.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('synced')).toBeTruthy()
      expect(wrapper.emitted('synced')![0]).toEqual([updatedEvent])
    })

    it('should show error state briefly on publish failure', async () => {
      vi.mocked(eventsApi.syncAtproto).mockRejectedValue(new Error('Publish failed'))

      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: undefined,
            sourceType: undefined
          })
        },
        {
          user: {
            id: 1,
            slug: 'test-user',
            atprotoIdentity: {
              did: 'did:plc:test123',
              handle: 'test.opnmt.me',
              hasActiveSession: true,
              isCustodial: true,
              isOurPds: true,
              pdsUrl: 'https://pds.openmeet.net',
              validHandleDomains: ['.opnmt.me'],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        }
      )

      const publishChip = wrapper.find('[data-cy="publish-atproto-chip"]')
      await publishChip.trigger('click')
      await flushPromises()

      // Should show error state
      const chipAfterError = wrapper.find('[data-cy="publish-atproto-chip"]')
      expect(chipAfterError.text()).toContain('failed')
    })
  })
})
