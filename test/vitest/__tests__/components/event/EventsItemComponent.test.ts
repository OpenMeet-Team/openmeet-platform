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

  describe('AT Protocol Published Badge', () => {
    it('displays AT Protocol badge when atprotoUri is present', () => {
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

      // Find the AT Protocol badge by data-cy attribute
      const atprotoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atprotoBadge.exists()).toBe(true)
    })

    it('does not display AT Protocol badge when atprotoUri is null', () => {
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

      const atprotoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atprotoBadge.exists()).toBe(false)
    })

    it('does not display AT Protocol badge when atprotoUri is empty string', () => {
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

      const atprotoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atprotoBadge.exists()).toBe(false)
    })

    it('displays both sourceType bluesky badge and atprotoUri badge when both are present', () => {
      // An event could be imported FROM bluesky (sourceType) AND published TO AT Protocol (atprotoUri)
      // These are different concepts that can coexist
      const event = createMockEvent({
        sourceType: 'bluesky',
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

      // Both badges should be present
      const atprotoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      const sourceTypeBadge = wrapper.find('[data-cy="event-source-badge"]')

      expect(atprotoBadge.exists()).toBe(true)
      expect(sourceTypeBadge.exists()).toBe(true)
    })

    it('displays AT Protocol badge with @ icon', () => {
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

      const atprotoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atprotoBadge.exists()).toBe(true)

      // Check for the @ icon within the badge (fa-at for AT Protocol)
      const icon = atprotoBadge.find('[data-icon="fa-solid fa-at"]')
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
