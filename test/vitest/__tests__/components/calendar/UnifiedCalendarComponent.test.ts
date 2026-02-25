import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import UnifiedCalendarComponent from '../../../../../src/components/calendar/UnifiedCalendarComponent.vue'
import { EventStatus, EventAttendeeStatus } from '../../../../../src/types/event'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Mock FullCalendar Vue3 component
vi.mock('@fullcalendar/vue3', () => ({
  default: {
    name: 'FullCalendar',
    props: ['options'],
    template: '<div class="fc-mock" data-testid="fullcalendar"><slot name="eventContent" :event="{}"></slot></div>',
    methods: {
      getApi () {
        return {
          changeView: vi.fn(),
          gotoDate: vi.fn(),
          today: vi.fn(),
          prev: vi.fn(),
          next: vi.fn()
        }
      }
    }
  }
}))

// Mock FullCalendar plugins
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/list', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))
vi.mock('@fullcalendar/luxon3', () => ({ default: {} }))

// Mock the API modules
vi.mock('../../../../../src/api/calendar', () => ({
  getExternalEvents: vi.fn(() => Promise.resolve({ data: { events: [] } }))
}))

// Mock the stores
const mockAuthStore = {
  user: {
    id: 'test-user',
    email: 'test@example.com'
  }
}

const mockHomeStore = {
  userUpcomingEvents: [] as unknown[],
  loading: false,
  actionGetUserHomeState: vi.fn(() => Promise.resolve())
}

const mockDashboardStore = {
  events: null as unknown[] | null,
  loading: false,
  actionGetDashboardEvents: vi.fn(() => Promise.resolve())
}

vi.mock('../../../../../src/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

vi.mock('../../../../../src/stores/home-store', () => ({
  useHomeStore: () => mockHomeStore
}))

vi.mock('../../../../../src/stores/dashboard-store', () => ({
  useDashboardStore: () => mockDashboardStore
}))

describe('UnifiedCalendarComponent', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'))
    // Reset store mocks
    mockAuthStore.user = { id: 'test-user', email: 'test@example.com' }
    mockHomeStore.userUpcomingEvents = []
    mockHomeStore.actionGetUserHomeState.mockClear()
    mockDashboardStore.events = null
    mockDashboardStore.actionGetDashboardEvents.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Component Mounting', () => {
    it('renders successfully with default props', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="fullcalendar"]').exists()).toBe(true)
    })

    it('renders with custom props', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'week',
          height: '500px',
          showControls: false,
          compact: true
        },
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Props Interface Compatibility', () => {
    it('accepts all expected props from parent pages', () => {
      // HomeUserPage usage
      const homeWrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'month',
          compact: true,
          height: '350px'
        },
        global: { plugins: [pinia] }
      })
      expect(homeWrapper.exists()).toBe(true)

      // GroupEventsPage usage
      const groupWrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'month',
          height: '500px',
          showControls: true,
          groupEvents: [
            {
              ulid: 'evt-001',
              slug: 'team-meeting',
              name: 'Team Meeting',
              startDate: '2025-06-15T14:00:00Z'
            }
          ],
          externalEvents: [],
          legendType: 'group'
        },
        global: { plugins: [pinia] }
      })
      expect(groupWrapper.exists()).toBe(true)
    })
  })

  describe('Event Emission', () => {
    it('defines all expected emits', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      // The component should accept these event handlers
      const emits = wrapper.vm.$options.emits
      // Check that the component has emits defined (either array or object)
      expect(emits).toBeDefined()
    })
  })

  describe('Group Events Mapping', () => {
    it('maps group events to FullCalendar format', () => {
      const groupEvents = [
        {
          ulid: 'evt-001',
          slug: 'team-meeting',
          name: 'Team Meeting',
          startDate: '2025-06-15T14:00:00Z',
          endDate: '2025-06-15T16:00:00Z',
          isAllDay: false,
          status: 'published',
          timeZone: 'UTC'
        },
        {
          ulid: 'evt-002',
          slug: 'cancelled-event',
          name: 'Cancelled Event',
          startDate: '2025-06-16T10:00:00Z',
          endDate: '2025-06-16T12:00:00Z',
          status: 'cancelled',
          timeZone: 'UTC'
        }
      ]

      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          groupEvents,
          legendType: 'group'
        },
        global: { plugins: [pinia] }
      })

      // The FullCalendar mock receives options via props
      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      expect(fcMock.exists()).toBe(true)

      const options = fcMock.props('options')
      expect(options.events).toBeDefined()
      expect(options.events).toHaveLength(2)

      // First event should be blue (attending)
      expect(options.events[0].backgroundColor).toBe('#1976d2')
      expect(options.events[0].title).toBe('Team Meeting')

      // Second event should be red (cancelled)
      expect(options.events[1].backgroundColor).toBe('#f44336')
      expect(options.events[1].extendedProps.type).toBe('cancelled')
    })
  })

  describe('Personal Events Loading', () => {
    it('loads personal events when no groupEvents provided', async () => {
      mockHomeStore.userUpcomingEvents = [
        {
          ulid: 'att-001',
          slug: 'yoga-class',
          name: 'Morning Yoga',
          startDate: '2025-06-15T07:00:00Z',
          endDate: '2025-06-15T08:00:00Z',
          isAllDay: false,
          status: 'published',
          timeZone: 'UTC'
        }
      ]
      mockDashboardStore.events = [
        {
          ulid: 'host-001',
          slug: 'team-standup',
          name: 'Team Standup',
          startDate: '2025-06-15T09:00:00Z',
          endDate: '2025-06-15T09:30:00Z',
          isAllDay: false,
          status: 'published',
          timeZone: 'UTC'
        }
      ]

      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'month',
          compact: true
        },
        global: { plugins: [pinia] }
      })

      // Wait for async operations
      await wrapper.vm.$nextTick()
      await vi.runAllTimersAsync()
      await wrapper.vm.$nextTick()

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      // Should have both attending and hosting events
      expect(options.events.length).toBeGreaterThanOrEqual(2)

      // Attending event should be blue
      const attendingEvent = options.events.find((e: { id: string }) => e.id?.includes('attending'))
      expect(attendingEvent).toBeDefined()
      expect(attendingEvent.backgroundColor).toBe('#1976d2')

      // Hosting event should be green
      const hostingEvent = options.events.find((e: { id: string }) => e.id?.includes('hosting'))
      expect(hostingEvent).toBeDefined()
      expect(hostingEvent.backgroundColor).toBe('#2e7d32')
    })

    it('does NOT load personal events when groupEvents are provided', async () => {
      const groupEvents = [
        {
          ulid: 'evt-001',
          slug: 'group-event',
          name: 'Group Event',
          startDate: '2025-06-15T14:00:00Z'
        }
      ]

      mount(UnifiedCalendarComponent, {
        props: {
          groupEvents,
          legendType: 'group'
        },
        global: { plugins: [pinia] }
      })

      await vi.runAllTimersAsync()

      // Should NOT call store actions for personal events
      expect(mockHomeStore.actionGetUserHomeState).not.toHaveBeenCalled()
      expect(mockDashboardStore.actionGetDashboardEvents).not.toHaveBeenCalled()
    })

    it('filters out cancelled RSVP events from personal calendar', async () => {
      mockHomeStore.userUpcomingEvents = [
        {
          ulid: 'att-001',
          slug: 'confirmed-event',
          name: 'Confirmed Event',
          startDate: '2025-06-15T07:00:00Z',
          endDate: '2025-06-15T08:00:00Z',
          status: 'published',
          timeZone: 'UTC',
          attendee: { status: EventAttendeeStatus.Confirmed }
        },
        {
          ulid: 'att-002',
          slug: 'cancelled-rsvp',
          name: 'Cancelled RSVP Event',
          startDate: '2025-06-15T10:00:00Z',
          endDate: '2025-06-15T11:00:00Z',
          status: 'published',
          timeZone: 'UTC',
          attendee: { status: EventAttendeeStatus.Cancelled }
        }
      ]
      mockDashboardStore.events = []

      const wrapper = mount(UnifiedCalendarComponent, {
        props: { mode: 'month' },
        global: { plugins: [pinia] }
      })

      await wrapper.vm.$nextTick()
      await vi.runAllTimersAsync()
      await wrapper.vm.$nextTick()

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      // Should only have the confirmed event, not the cancelled RSVP
      const attendingEvents = options.events.filter(
        (e: { id: string }) => e.id?.startsWith('attending')
      )
      expect(attendingEvents).toHaveLength(1)
      expect(attendingEvents[0].title).toBe('Confirmed Event')
    })
  })

  describe('Cancelled Event Handling', () => {
    it('correctly identifies cancelled status from EventStatus enum', () => {
      expect(EventStatus.Cancelled).toBe('cancelled')
      expect(EventStatus.Published).toBe('published')
    })

    it('maps cancelled group events to red color', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          groupEvents: [
            {
              ulid: 'evt-001',
              slug: 'cancelled',
              name: 'Cancelled Event',
              startDate: '2025-06-15T14:00:00Z',
              status: 'cancelled'
            }
          ],
          legendType: 'group'
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      expect(options.events[0].backgroundColor).toBe('#f44336')
      expect(options.events[0].extendedProps.type).toBe('cancelled')
    })
  })

  describe('RSVP Status Filtering', () => {
    it('should filter out events where user RSVP status is cancelled', () => {
      const upcomingEvents = [
        {
          ulid: 'event1',
          slug: 'attending-event',
          name: 'Event I Will Attend',
          startDate: '2025-06-15T14:00:00Z',
          endDate: '2025-06-15T16:00:00Z',
          attendee: { status: EventAttendeeStatus.Confirmed }
        },
        {
          ulid: 'event2',
          slug: 'cancelled-event',
          name: 'Event I Cancelled',
          startDate: '2025-06-15T18:00:00Z',
          endDate: '2025-06-15T20:00:00Z',
          attendee: { status: EventAttendeeStatus.Cancelled }
        },
        {
          ulid: 'event3',
          slug: 'pending-event',
          name: 'Event Pending Approval',
          startDate: '2025-06-16T10:00:00Z',
          endDate: '2025-06-16T12:00:00Z',
          attendee: { status: EventAttendeeStatus.Pending }
        }
      ]

      const filteredEvents = upcomingEvents.filter((event) => {
        return !event.attendee || event.attendee.status !== EventAttendeeStatus.Cancelled
      })

      expect(filteredEvents).toHaveLength(2)
      expect(filteredEvents.map((e) => e.name)).toEqual([
        'Event I Will Attend',
        'Event Pending Approval'
      ])
    })

    it('should show events where user has not RSVPd yet', () => {
      const upcomingEvents = [
        {
          ulid: 'event1',
          slug: 'no-rsvp-event',
          name: 'Event Without RSVP',
          startDate: '2025-06-15T14:00:00Z',
          endDate: '2025-06-15T16:00:00Z'
        }
      ]

      const filteredEvents = upcomingEvents.filter((event) => {
        return !(event as { attendee?: { status: string } }).attendee ||
          (event as { attendee?: { status: string } }).attendee?.status !== EventAttendeeStatus.Cancelled
      })

      expect(filteredEvents).toHaveLength(1)
      expect(filteredEvents[0].name).toBe('Event Without RSVP')
    })
  })

  describe('External Events', () => {
    it('maps external events provided as props', () => {
      const externalEvents = [
        {
          id: 'ext-001',
          externalId: 'google-abc',
          summary: 'Doctor Appointment',
          startTime: '2025-06-15T09:00:00Z',
          endTime: '2025-06-15T10:00:00Z',
          isAllDay: false,
          status: 'confirmed',
          calendarSourceId: 1
        }
      ]

      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          groupEvents: [
            {
              ulid: 'evt-001',
              slug: 'group-event',
              name: 'Group Event',
              startDate: '2025-06-15T14:00:00Z'
            }
          ],
          externalEvents,
          legendType: 'group'
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      const extEvent = options.events.find((e: { id: string }) => e.id?.startsWith('external'))
      expect(extEvent).toBeDefined()
      expect(extEvent.title).toBe('Doctor Appointment')
      expect(extEvent.backgroundColor).toBe('#4caf50')
    })
  })

  describe('Error Handling', () => {
    it('handles missing user gracefully', () => {
      mockAuthStore.user = null as unknown as { id: string; email: string }

      const wrapper = mount(UnifiedCalendarComponent, {
        props: { mode: 'month' },
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="fullcalendar"]').exists()).toBe(true)
    })
  })

  describe('URL Deep Linking Props', () => {
    it('passes initialDate to FullCalendar options', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          initialDate: '2025-08-20',
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-08-20T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialDate).toBe('2025-08-20')
    })

    it('does not set initialDate when prop is not provided', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialDate).toBeUndefined()
    })

    it('maps initialView "month" to dayGridMonth', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          initialView: 'month',
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('dayGridMonth')
    })

    it('maps initialView "week" to timeGridWeek', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          initialView: 'week',
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('timeGridWeek')
    })

    it('maps initialView "day" to timeGridDay', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          initialView: 'day',
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('timeGridDay')
    })

    it('uses mode prop as fallback when initialView is not provided', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'week',
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('timeGridWeek')
    })

    it('includes datesSet callback in calendar options', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.datesSet).toBeDefined()
      expect(typeof options.datesSet).toBe('function')
    })

    it('emits datesSet when the datesSet callback is invoked', async () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      // Simulate FullCalendar calling the datesSet callback
      options.datesSet({
        startStr: '2025-07-01',
        endStr: '2025-07-31',
        view: {
          type: 'dayGridMonth',
          currentStart: new Date('2025-07-01')
        }
      })

      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('datesSet')
      expect(emitted).toBeDefined()
      expect(emitted).toHaveLength(1)
      expect(emitted![0][0]).toEqual(expect.objectContaining({
        startStr: '2025-07-01',
        endStr: '2025-07-31',
        view: expect.objectContaining({ type: 'dayGridMonth' })
      }))
    })

    it('emits viewChange when the view type changes in datesSet callback', async () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      // Simulate user switching to week view
      options.datesSet({
        startStr: '2025-06-15',
        endStr: '2025-06-21',
        view: {
          type: 'timeGridWeek',
          currentStart: new Date('2025-06-15')
        }
      })

      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('viewChange')
      expect(emitted).toBeDefined()
      expect(emitted).toHaveLength(1)
      expect(emitted![0][0]).toBe('week')
    })

    it('calls scrollToTime on mount when scrollToHour is provided and view is time grid', async () => {
      const mockScrollToTime = vi.fn()
      // Override the mock to track scrollToTime
      const fcModule = vi.mocked(await import('@fullcalendar/vue3'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(fcModule.default.methods as any).getApi = function () {
        return {
          changeView: vi.fn(),
          gotoDate: vi.fn(),
          today: vi.fn(),
          prev: vi.fn(),
          next: vi.fn(),
          scrollToTime: mockScrollToTime,
          view: { type: 'timeGridWeek' }
        }
      }

      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          initialView: 'week',
          scrollToHour: 14,
          groupEvents: [
            { ulid: 'evt-001', slug: 'test', name: 'Test', startDate: '2025-06-15T14:00:00Z' }
          ]
        },
        global: { plugins: [pinia] }
      })

      await wrapper.vm.$nextTick()
      await vi.runAllTimersAsync()
      await wrapper.vm.$nextTick()

      expect(mockScrollToTime).toHaveBeenCalledWith('14:00:00')
    })

    it('works without deep linking props (backward compatible)', () => {
      // This mirrors HomeUserPage usage - no initialDate, initialView, or scrollToHour
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'month',
          compact: true,
          height: '350px'
        },
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialDate).toBeUndefined()
    })
  })
})
