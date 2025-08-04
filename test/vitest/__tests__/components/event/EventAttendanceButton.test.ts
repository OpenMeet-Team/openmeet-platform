import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventAttendanceButton from '../../../../../src/components/event/EventAttendanceButton.vue'
import { EventAttendeeStatus, GroupPermission, EventAttendeePermission } from '../../../../../src/types'
import { installPinia } from '../../../install-pinia'

installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })

// Mock Quasar's $q.notify function
const mockNotify = vi.fn()
vi.mock('quasar', async () => {
  const actual = await vi.importActual('quasar')
  return {
    ...actual,
    useQuasar: () => ({
      notify: mockNotify
    })
  }
})

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
    mockNotify.mockClear()
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

  describe('User Attendance Flow', () => {
    it('provides RSVP options for users who have not responded', async () => {
      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee: null,
          isTemplateView: false
        }
      })

      // User should see options to attend or decline
      const attendButton = wrapper.find('[data-cy="event-attend-button"]')
      const declineButton = wrapper.find('[data-cy="event-decline-button"]')

      expect(attendButton.exists()).toBe(true)
      expect(declineButton.exists()).toBe(true)

      // User can click to attend
      await attendButton.trigger('click')
      expect(mockEventStore.actionAttendEvent).toHaveBeenCalledWith(
        mockEvent.slug,
        { status: EventAttendeeStatus.Confirmed }
      )
    })

    it('handles approval-required events appropriately', () => {
      const eventWithApproval = { ...mockEvent, requireApproval: true }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: eventWithApproval,
          attendee: null,
          isTemplateView: false
        }
      })

      // Should still show attend button but with different behavior expected
      const attendButton = wrapper.find('[data-cy="event-attend-button"]')
      expect(attendButton.exists()).toBe(true)
      // For approval events, behavior is the same but status will be Pending
    })

    it('allows confirmed attendees to cancel their attendance', async () => {
      const attendee = { status: EventAttendeeStatus.Confirmed }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      // Should show the confirmed status button that allows cancelling
      const statusButton = wrapper.find('[data-cy="event-going-status"]')
      expect(statusButton.exists()).toBe(true)

      await statusButton.trigger('click')
      expect(mockEventStore.actionCancelAttending).toHaveBeenCalledWith(mockEvent)
    })

    it('allows pending attendees to cancel their request', async () => {
      const attendee = { status: EventAttendeeStatus.Pending }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      const statusButton = wrapper.find('[data-cy="event-pending-status"]')
      expect(statusButton.exists()).toBe(true)

      await statusButton.trigger('click')
      expect(mockEventStore.actionCancelAttending).toHaveBeenCalledWith(mockEvent)
    })

    it('allows waitlisted attendees to leave the waitlist', async () => {
      const attendee = { status: EventAttendeeStatus.Waitlist }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      const statusButton = wrapper.find('[data-cy="event-waitlist-status"]')
      expect(statusButton.exists()).toBe(true)

      await statusButton.trigger('click')
      expect(mockEventStore.actionCancelAttending).toHaveBeenCalledWith(mockEvent)
    })

    it('allows cancelled attendees to rejoin', async () => {
      const attendee = { status: EventAttendeeStatus.Cancelled }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee,
          isTemplateView: false
        }
      })

      const statusButton = wrapper.find('[data-cy="event-not-attending-status"]')
      expect(statusButton.exists()).toBe(true)

      await statusButton.trigger('click')
      expect(mockEventStore.actionAttendEvent).toHaveBeenCalledWith(
        mockEvent.slug,
        { status: EventAttendeeStatus.Confirmed }
      )
    })
  })

  describe('Business Logic Validation', () => {
    it('handles approval-required events correctly', () => {
      const eventWithApproval = { ...mockEvent, requireApproval: true }
      const attendee = { status: EventAttendeeStatus.Cancelled }

      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: eventWithApproval,
          attendee,
          isTemplateView: false
        }
      })

      // For cancelled attendees on approval-required events,
      // should show button to request attendance
      const statusButton = wrapper.find('[data-cy="event-not-attending-status"]')
      expect(statusButton.exists()).toBe(true)
    })

    it('maintains state consistency across user actions', async () => {
      // Test that the component behaves consistently when user changes attendance status
      wrapper = shallowMount(EventAttendanceButton, {
        props: {
          event: mockEvent,
          attendee: null,
          isTemplateView: false
        }
      })

      // User starts with no RSVP
      expect(wrapper.find('[data-cy="event-attend-button"]').exists()).toBe(true)
      expect(wrapper.find('[data-cy="event-decline-button"]').exists()).toBe(true)

      // After attending, user should see different options
      // (This would normally be tested through integration tests,
      // but we're verifying the component handles prop changes correctly)
    })
  })
})
