import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventsItemComponent from '../../../../../src/components/event/EventsItemComponent.vue'
import { EventType } from '../../../../../src/types'

installQuasarPlugin()

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useRoute: () => ({
    params: {}
  })
}))

// Mock imageUtils
vi.mock('../../../../../src/utils/imageUtils', () => ({
  getImageSrc: vi.fn((img) => img || '/default-image.jpg')
}))

// Mock dateUtils
vi.mock('../../../../../src/utils/dateUtils', () => ({
  formatDate: vi.fn((date) => date)
}))

// Mock eventUtils
vi.mock('../../../../../src/utils/eventUtils', () => ({
  getSourceColor: vi.fn((sourceType) => sourceType === 'bluesky' ? 'blue' : 'grey')
}))

describe('EventsItemComponent.vue', () => {
  const createMockEvent = (overrides = {}) => ({
    id: 1,
    ulid: 'test-ulid',
    slug: 'test-event',
    name: 'Test Event',
    startDate: '2025-01-29T10:00:00Z',
    type: EventType.InPerson,
    location: 'Test Location',
    ...overrides
  })

  describe('AT Protocol Publication Badge', () => {
    it('should show AT Protocol badge when event has atprotoUri', () => {
      const event = createMockEvent({
        atprotoUri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789'
      })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const atProtoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atProtoBadge.exists()).toBe(true)
    })

    it('should NOT show AT Protocol badge when event has no atprotoUri', () => {
      const event = createMockEvent({
        atprotoUri: undefined
      })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const atProtoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atProtoBadge.exists()).toBe(false)
    })

    it('should NOT show AT Protocol badge when atprotoUri is null', () => {
      const event = createMockEvent({
        atprotoUri: null
      })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const atProtoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atProtoBadge.exists()).toBe(false)
    })

    it('should NOT show AT Protocol badge when atprotoUri is empty string', () => {
      const event = createMockEvent({
        atprotoUri: ''
      })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const atProtoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atProtoBadge.exists()).toBe(false)
    })

    it('should show both sourceType badge and AT Protocol badge when both are present', () => {
      const event = createMockEvent({
        sourceType: 'bluesky',
        atprotoUri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789'
      })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      // Both badges should be visible
      const sourceTypeBadge = wrapper.find('.badges-container').text()
      expect(sourceTypeBadge).toContain('bluesky')

      const atProtoBadge = wrapper.find('[data-cy="event-atproto-badge"]')
      expect(atProtoBadge.exists()).toBe(true)
    })
  })

  describe('Other Badges', () => {
    it('should show event type badge', () => {
      const event = createMockEvent({ type: EventType.Online })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const badges = wrapper.find('.badges-container')
      expect(badges.text()).toContain('online')
    })

    it('should show cancelled badge when event is cancelled', () => {
      const event = createMockEvent({ status: 'cancelled' })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const badges = wrapper.find('.badges-container')
      expect(badges.text()).toContain('Cancelled')
    })

    it('should show series badge when event has seriesSlug', () => {
      const event = createMockEvent({
        seriesSlug: 'weekly-meetup',
        series: { name: 'Weekly Meetup' }
      })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const badges = wrapper.find('.badges-container')
      expect(badges.text()).toContain('Weekly Meetup')
    })

    it('should show attendees count badge when attendeesCount is present', () => {
      const event = createMockEvent({ attendeesCount: 15 })

      const wrapper = mount(EventsItemComponent, {
        props: { event },
        global: {
          stubs: {
            'router-link': {
              template: '<a><slot /></a>'
            }
          }
        }
      })

      const badges = wrapper.find('.badges-container')
      expect(badges.text()).toContain('15 attending')
    })
  })
})
