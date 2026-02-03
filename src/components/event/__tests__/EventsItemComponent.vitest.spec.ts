import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'
import EventsItemComponent from '../EventsItemComponent.vue'
import { EventEntity, EventType } from '../../../types'

// Mock the auth store
vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: vi.fn()
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

  describe('"Not published" badge visibility', () => {
    it('should show "Not published" badge when event can be published (no atprotoUri, no sourceType, user has active session)', () => {
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

      const badge = wrapper.find('[data-cy="not-published-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toContain('Not published')
    })

    it('should not show "Not published" badge when event already has atprotoUri', () => {
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

      const badge = wrapper.find('[data-cy="not-published-badge"]')
      expect(badge.exists()).toBe(false)
    })

    it('should not show "Not published" badge when event has sourceType (imported event)', () => {
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

      const badge = wrapper.find('[data-cy="not-published-badge"]')
      expect(badge.exists()).toBe(false)
    })

    it('should not show "Not published" badge when user has no active ATProto session', () => {
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

      const badge = wrapper.find('[data-cy="not-published-badge"]')
      expect(badge.exists()).toBe(false)
    })

    it('should not show "Not published" badge when user has no ATProto identity', () => {
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

      const badge = wrapper.find('[data-cy="not-published-badge"]')
      expect(badge.exists()).toBe(false)
    })

    it('should show "Not published" badge as non-clickable (status display only)', () => {
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

      const badge = wrapper.find('[data-cy="not-published-badge"]')
      expect(badge.exists()).toBe(true)
      // Badge should not have cursor-pointer class (not clickable)
      expect(badge.classes()).not.toContain('cursor-pointer')
      // Badge should render with grey styling (Quasar applies bg-grey class)
      expect(badge.classes().some(c => c.includes('grey'))).toBe(true)
    })
  })

  describe('"Published" badge visibility', () => {
    it('should show "Published" badge when event has atprotoUri', () => {
      const wrapper = mountComponent(
        {
          event: createMockEvent({
            atprotoUri: 'at://did:plc:test/community.lexicon.calendar.event/123'
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

      const badge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toContain('Published')
    })
  })
})
