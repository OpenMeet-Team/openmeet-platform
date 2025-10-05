import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import EventMatrixChatComponent from '../EventMatrixChatComponent.vue'
import type { EventEntity } from '../../../types'

// Mock the stores
const mockEventStore = {
  event: null as EventEntity | null,
  getterIsPublicEvent: false,
  getterIsAuthenticatedEvent: false,
  getterUserHasPermission: vi.fn().mockReturnValue(false)
}

vi.mock('../../../stores/event-store', () => ({
  useEventStore: () => mockEventStore
}))

const mockAuthStore = {
  isAuthenticated: true
}

vi.mock('../../../stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

// Mock vue-router
const mockRoute = {
  params: {
    slug: 'weekly-discussion-kjqcsi'
  }
}

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute
}))

const createWrapper = () => {
  return mount(EventMatrixChatComponent, {
    global: {
      plugins: [Quasar],
      stubs: {
        MatrixChatGateway: {
          name: 'MatrixChatGateway',
          template: '<div class="matrix-chat-gateway" :data-context-id="contextId"></div>',
          props: ['contextType', 'contextId', 'subtitle']
        },
        SubtitleComponent: {
          template: '<div class="subtitle">{{ label }}</div>',
          props: ['label', 'hideLink']
        },
        'q-banner': {
          template: '<div class="q-banner"><slot name="avatar" /><slot /></div>'
        },
        'q-icon': {
          template: '<i class="q-icon" :name="name"></i>',
          props: ['name', 'size']
        },
        'q-btn': {
          template: '<button class="q-btn" @click="$emit(\'click\')">{{ label }}<slot /></button>',
          props: ['label', 'to', 'flat', 'dense', 'nocaps', 'color']
        }
      }
    }
  })
}

describe('EventMatrixChatComponent', () => {
  beforeEach(() => {
    // Reset mocks
    mockEventStore.event = null
    mockEventStore.getterIsPublicEvent = false
    mockEventStore.getterIsAuthenticatedEvent = false
    mockEventStore.getterUserHasPermission.mockReturnValue(false)
    mockAuthStore.isAuthenticated = true
    mockRoute.params.slug = 'weekly-discussion-kjqcsi'
  })

  describe('Bug: Race condition with route slug vs store event', () => {
    it('should use route slug when store event is null (after login redirect)', () => {
      // Simulate the state after login redirect:
      // - Route has the correct event slug
      // - Store has event data with confirmed attendee (loaded after login)
      mockRoute.params.slug = 'weekly-discussion-kjqcsi'
      mockEventStore.event = {
        slug: 'weekly-discussion-kjqcsi',
        attendee: {
          status: 'confirmed'
        }
      } as EventEntity
      mockAuthStore.isAuthenticated = true
      mockEventStore.getterUserHasPermission.mockReturnValue(true)

      const wrapper = createWrapper()

      // Find the MatrixChatGateway component
      const gateway = wrapper.findComponent({ name: 'MatrixChatGateway' })

      // After the fix, it should pass the route slug to the gateway
      expect(gateway.exists()).toBe(true)
      expect(gateway.props('contextId')).toBe('weekly-discussion-kjqcsi')
    })

    it('should use route slug when store has a different (stale) event', () => {
      // Simulate navigating from one event to another:
      // - Route was updated to new event
      // - But store still has old event data (not yet loaded)
      mockRoute.params.slug = 'weekly-discussion-kjqcsi'
      mockEventStore.event = {
        slug: 'weekly-discussion-dly4hc', // OLD event - WRONG!
        attendee: {
          status: 'confirmed'
        }
      } as EventEntity
      mockAuthStore.isAuthenticated = true
      mockEventStore.getterUserHasPermission.mockReturnValue(true)

      const wrapper = createWrapper()

      // Find the MatrixChatGateway component
      const gateway = wrapper.findComponent({ name: 'MatrixChatGateway' })

      // THIS TEST WILL FAIL INITIALLY
      // The component should use the route slug, not the stale store event slug
      expect(gateway.exists()).toBe(true)
      expect(gateway.props('contextId')).toBe('weekly-discussion-kjqcsi')
      // This will fail because it currently passes 'weekly-discussion-dly4hc'
      expect(gateway.props('contextId')).not.toBe('weekly-discussion-dly4hc')
    })
  })

  describe('Permission-based rendering', () => {
    it('should show MatrixChatGateway when user is confirmed attendee', () => {
      mockEventStore.event = {
        slug: 'weekly-discussion-kjqcsi',
        attendee: {
          status: 'confirmed'
        }
      } as EventEntity
      mockEventStore.getterUserHasPermission.mockReturnValue(true)

      const wrapper = createWrapper()
      const gateway = wrapper.findComponent({ name: 'MatrixChatGateway' })

      expect(gateway.exists()).toBe(true)
      expect(gateway.props('contextType')).toBe('event')
    })

    it('should show locked banner when user can read but not write', () => {
      mockEventStore.event = {
        slug: 'weekly-discussion-kjqcsi',
        attendee: null
      } as EventEntity
      mockEventStore.getterIsPublicEvent = true
      mockEventStore.getterUserHasPermission.mockReturnValue(false)

      const wrapper = createWrapper()

      expect(wrapper.text()).toContain('Chat Locked')
      expect(wrapper.text()).toContain('RSVP above')
    })

    it('should show sign in banner when user is not authenticated', () => {
      mockEventStore.event = {
        slug: 'weekly-discussion-kjqcsi'
      } as EventEntity
      mockAuthStore.isAuthenticated = false

      const wrapper = createWrapper()

      expect(wrapper.text()).toContain('Sign In Required')
    })
  })
})
