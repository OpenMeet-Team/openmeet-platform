import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventAttendanceButton from '../../../../../src/components/event/EventAttendanceButton.vue'
import { EventAttendeeStatus, GroupPermission, EventAttendeePermission } from '../../../../../src/types'
import { installPinia } from '../../../install-pinia'

installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })

// Mock the stores
const mockEventStore = {
  getterGroupMemberHasPermission: vi.fn(),
  getterUserHasPermission: vi.fn(),
  actionGetEventBySlug: vi.fn(),
  actionAttendEvent: vi.fn(),
  actionCancelAttending: vi.fn(),
  actionMaterializeOccurrence: vi.fn()
}

const mockAuthStore = {
  isFullyAuthenticated: true,
  getUserId: 'user123'
}

vi.mock('../../../../../src/stores/event-store', () => ({
  useEventStore: () => mockEventStore
}))

vi.mock('../../../../../src/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

vi.mock('../../../../../src/composables/useAuth', () => ({
  useAuth: () => ({
    goToLogin: vi.fn()
  })
}))

vi.mock('../../../../../src/boot/auth-session', () => ({
  useAuthSession: () => ({
    checkAuthStatus: vi.fn().mockResolvedValue(true)
  })
}))

describe('EventAttendanceButton.vue', () => {
  let wrapper

  const mockEvent = {
    id: '1',
    slug: 'test-event',
    name: 'Test Event',
    requireApproval: false,
    series: {
      user: {
        id: 'series-owner-id'
      }
    },
    seriesSlug: 'test-series'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventStore.getterGroupMemberHasPermission.mockReturnValue(false)
    mockEventStore.getterUserHasPermission.mockReturnValue(false)
    mockAuthStore.isFullyAuthenticated = true
    mockAuthStore.getUserId = 'user123'
  })

  describe('Template View Permission Logic', () => {
    it('shows schedule button for series owner', () => {
      mockAuthStore.getUserId = 'series-owner-id'

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          isTemplateView: true,
          templateDate: '2024-01-01T00:00:00Z'
        }
      })

      const scheduleButton = wrapper.find('[data-cy="event-template-materialize-button"]')
      expect(scheduleButton.exists()).toBe(true)

      const unauthorizedButton = wrapper.find('[data-cy="event-template-unauthorized-button"]')
      expect(unauthorizedButton.exists()).toBe(false)
    })

    it('shows schedule button for user with group manage permissions', () => {
      mockEventStore.getterGroupMemberHasPermission.mockImplementation(
        (permission) => permission === GroupPermission.ManageEvents
      )

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          isTemplateView: true,
          templateDate: '2024-01-01T00:00:00Z'
        }
      })

      const scheduleButton = wrapper.find('[data-cy="event-template-materialize-button"]')
      expect(scheduleButton.exists()).toBe(true)

      const unauthorizedButton = wrapper.find('[data-cy="event-template-unauthorized-button"]')
      expect(unauthorizedButton.exists()).toBe(false)
    })

    it('shows schedule button for user with event manage permissions', () => {
      mockEventStore.getterUserHasPermission.mockImplementation(
        (permission) => permission === EventAttendeePermission.ManageEvent
      )

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          isTemplateView: true,
          templateDate: '2024-01-01T00:00:00Z'
        }
      })

      const scheduleButton = wrapper.find('[data-cy="event-template-materialize-button"]')
      expect(scheduleButton.exists()).toBe(true)

      const unauthorizedButton = wrapper.find('[data-cy="event-template-unauthorized-button"]')
      expect(unauthorizedButton.exists()).toBe(false)
    })

    it('shows unauthorized message for regular users', () => {
      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          isTemplateView: true,
          templateDate: '2024-01-01T00:00:00Z'
        }
      })

      const unauthorizedButton = wrapper.find('[data-cy="event-template-unauthorized-button"]')
      expect(unauthorizedButton.exists()).toBe(true)
      expect(unauthorizedButton.attributes('disable')).toBeDefined()
      expect(unauthorizedButton.attributes('color')).toBe('grey-6')

      const scheduleButton = wrapper.find('[data-cy="event-template-materialize-button"]')
      expect(scheduleButton.exists()).toBe(false)
    })

    it('shows unauthorized message for unauthenticated users', () => {
      mockAuthStore.isFullyAuthenticated = false

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          isTemplateView: true,
          templateDate: '2024-01-01T00:00:00Z'
        }
      })

      const unauthorizedButton = wrapper.find('[data-cy="event-template-unauthorized-button"]')
      expect(unauthorizedButton.exists()).toBe(true)
      expect(unauthorizedButton.attributes('disable')).toBeDefined()

      const scheduleButton = wrapper.find('[data-cy="event-template-materialize-button"]')
      expect(scheduleButton.exists()).toBe(false)
    })
  })

  describe('Regular Attendance Button States', () => {
    it('shows attend button for non-attending users', () => {
      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee: null,
          isTemplateView: false
        }
      })

      const attendButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(attendButton.exists()).toBe(true)
      expect(attendButton.attributes('color')).toBe('primary')
      expect(attendButton.attributes('outline')).toBeDefined()
    })

    it('shows request attendance button for events requiring approval', () => {
      const eventWithApproval = { ...mockEvent, requireApproval: true }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: eventWithApproval,
          attendee: null,
          isTemplateView: false
        }
      })

      const attendButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(attendButton.exists()).toBe(true)
      expect(attendButton.attributes('color')).toBe('primary')
      expect(attendButton.attributes('outline')).toBeDefined()
    })

    it('shows leave button for confirmed attendees', () => {
      const attendee = { status: EventAttendeeStatus.Confirmed }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      const leaveButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(leaveButton.exists()).toBe(true)
      expect(leaveButton.attributes('color')).toBe('negative')
      expect(leaveButton.attributes('outline')).toBeDefined()
    })

    it('shows disabled pending button for pending attendees', () => {
      const attendee = { status: EventAttendeeStatus.Pending }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      const pendingButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(pendingButton.exists()).toBe(true)
      expect(pendingButton.attributes('color')).toBe('warning')
      expect(pendingButton.attributes('disable')).toBeDefined()
      expect(pendingButton.attributes('outline')).toBeDefined()
    })

    it('shows leave waitlist button for waitlisted attendees', () => {
      const attendee = { status: EventAttendeeStatus.Waitlist }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      const waitlistButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(waitlistButton.exists()).toBe(true)
      expect(waitlistButton.attributes('color')).toBe('orange')
      expect(waitlistButton.attributes('outline')).toBeDefined()
    })
  })

  describe('Button Styling Consistency', () => {
    it('applies outline style to all active buttons', () => {
      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee: null,
          isTemplateView: false
        }
      })

      const attendButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(attendButton.attributes('outline')).toBeDefined()
    })

    it('applies primary color to attend buttons', () => {
      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee: null,
          isTemplateView: false
        }
      })

      const attendButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(attendButton.attributes('color')).toBe('primary')
    })

    it('applies negative color to leave buttons', () => {
      const attendee = { status: EventAttendeeStatus.Confirmed }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      const leaveButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(leaveButton.attributes('color')).toBe('negative')
    })
  })
})
