import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventsItemComponent from '../../../../../src/components/event/EventsItemComponent.vue'
import { EventEntity, EventType } from '../../../../../src/types'
import { installPinia } from '../../../install-pinia'

installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useRoute: () => ({
    params: {}
  })
}))

// Mock image utils
vi.mock('../../../../../src/utils/imageUtils', () => ({
  getImageSrc: vi.fn().mockReturnValue('/default-image.jpg')
}))

// Mock date utils
vi.mock('../../../../../src/utils/dateUtils', () => ({
  formatDate: vi.fn().mockReturnValue('January 1, 2025')
}))

// Mock event utils
vi.mock('../../../../../src/utils/eventUtils', () => ({
  getSourceColor: vi.fn().mockReturnValue('blue')
}))

describe('EventsItemComponent.vue', () => {
  const createMockEvent = (overrides: Partial<EventEntity> = {}): EventEntity => ({
    id: 1,
    ulid: 'test-ulid',
    slug: 'test-event',
    name: 'Test Event',
    startDate: '2025-01-01T10:00:00Z',
    type: EventType.InPerson,
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AT Protocol Link', () => {
    it('displays AT Protocol link when atprotoUri is present', () => {
      const event = createMockEvent({
        atprotoUri: 'at://did:plc:abc123/community.openmeet.event/xyz789'
      })

      const wrapper = shallowMount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            },
            'q-img': true,
            'q-badge': {
              template: '<span class="q-badge" :color="$attrs.color"><slot /></span>',
              inheritAttrs: true
            },
            'q-icon': true
          }
        }
      })

      // Find the AT Protocol link by data-cy attribute
      const atprotoLink = wrapper.find('[data-cy="event-atproto-link"]')
      expect(atprotoLink.exists()).toBe(true)
      expect(atprotoLink.attributes('href')).toBe('https://pds.ls/at://did:plc:abc123/community.openmeet.event/xyz789')
    })

    it('does not display AT Protocol link when atprotoUri is null', () => {
      const event = createMockEvent({
        atprotoUri: undefined
      })

      const wrapper = shallowMount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            },
            'q-img': true,
            'q-badge': {
              template: '<span class="q-badge" :color="$attrs.color"><slot /></span>',
              inheritAttrs: true
            },
            'q-icon': true
          }
        }
      })

      const atprotoLink = wrapper.find('[data-cy="event-atproto-link"]')
      expect(atprotoLink.exists()).toBe(false)
    })

    it('does not display AT Protocol link when atprotoUri is empty string', () => {
      const event = createMockEvent({
        atprotoUri: ''
      })

      const wrapper = shallowMount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            },
            'q-img': true,
            'q-badge': {
              template: '<span class="q-badge" :color="$attrs.color"><slot /></span>',
              inheritAttrs: true
            },
            'q-icon': true
          }
        }
      })

      const atprotoLink = wrapper.find('[data-cy="event-atproto-link"]')
      expect(atprotoLink.exists()).toBe(false)
    })

    it('displays AT Protocol link for events with atprotoUri', () => {
      const event = createMockEvent({
        atprotoUri: 'at://did:plc:abc123/community.openmeet.event/xyz789'
      })

      const wrapper = shallowMount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            },
            'q-img': true,
            'q-badge': {
              template: '<span class="q-badge" :color="$attrs.color"><slot /></span>',
              inheritAttrs: true
            },
            'q-icon': true
          }
        }
      })

      const atprotoLink = wrapper.find('[data-cy="event-atproto-link"]')
      expect(atprotoLink.exists()).toBe(true)
      expect(atprotoLink.attributes('href')).toBe('https://pds.ls/at://did:plc:abc123/community.openmeet.event/xyz789')
    })

    it('displays AT Protocol link for imported bluesky events using sourceId', () => {
      const event = createMockEvent({
        sourceType: 'bluesky',
        sourceId: 'at://did:plc:imported123/app.bsky.feed.post/abc789'
      })

      const wrapper = shallowMount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            },
            'q-img': true,
            'q-badge': {
              template: '<span class="q-badge" :color="$attrs.color"><slot /></span>',
              inheritAttrs: true
            },
            'q-icon': true
          }
        }
      })

      const atprotoLink = wrapper.find('[data-cy="event-atproto-link"]')
      expect(atprotoLink.exists()).toBe(true)
      expect(atprotoLink.attributes('href')).toBe('https://pds.ls/at://did:plc:imported123/app.bsky.feed.post/abc789')
    })

    it('displays AT Protocol link with @ icon', () => {
      const event = createMockEvent({
        atprotoUri: 'at://did:plc:abc123/community.openmeet.event/xyz789'
      })

      const wrapper = shallowMount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            },
            'q-img': true,
            'q-badge': {
              template: '<span class="q-badge" :data-cy="$attrs[\'data-cy\']"><slot /></span>'
            },
            'q-icon': {
              template: '<i :class="name" :data-icon="name"></i>',
              props: ['name']
            }
          }
        }
      })

      const atprotoLink = wrapper.find('[data-cy="event-atproto-link"]')
      expect(atprotoLink.exists()).toBe(true)

      // Check for the @ icon within the link (fa-at for AT Protocol)
      const icon = atprotoLink.find('[data-icon="fa-solid fa-at"]')
      expect(icon.exists()).toBe(true)
    })
  })

  describe('Event Badges Container', () => {
    it('renders the badges container with proper structure', () => {
      const event = createMockEvent({
        status: 'cancelled',
        seriesSlug: 'my-series',
        attendeesCount: 10
      })

      const wrapper = shallowMount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            },
            'q-img': true,
            'q-badge': {
              template: '<span class="q-badge"><slot /></span>'
            },
            'q-icon': true
          }
        }
      })

      const badgesContainer = wrapper.find('.badges-container')
      expect(badgesContainer.exists()).toBe(true)
    })
  })
})
