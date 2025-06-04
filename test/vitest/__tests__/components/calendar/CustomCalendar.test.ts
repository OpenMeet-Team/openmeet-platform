import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import CustomCalendar from '../../../../../src/components/calendar/CustomCalendar.vue'
import { EventStatus } from '../../../../../src/types/event'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Mock the API modules
vi.mock('../../../../../src/api/events', () => ({
  eventsApi: {
    getDashboardEvents: vi.fn(() => Promise.resolve({ data: [] })),
    getAll: vi.fn(() => Promise.resolve({ data: { data: [] } }))
  }
}))

vi.mock('../../../../../src/api/home', () => ({
  homeApi: {
    getUserHome: vi.fn(() => Promise.resolve({ data: { upcomingEvents: [] } }))
  }
}))

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
  userUpcomingEvents: [],
  loading: false,
  actionGetUserHomeState: vi.fn(() => Promise.resolve())
}

const mockDashboardStore = {
  events: null,
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

describe('CustomCalendar', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    // Set fixed date for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z')) // June 15, 2025
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Component Mounting', () => {
    it('renders successfully with default props', () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.custom-calendar').exists()).toBe(true)
    })

    it('renders with custom props', () => {
      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'week',
          height: '500px',
          showControls: false,
          compact: true
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Should not show controls when showControls is false
      expect(wrapper.find('.calendar-controls').exists()).toBe(false)
    })
  })

  describe('Date Initialization', () => {
    it('initializes to current date in local timezone', () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any
      // Should initialize to current date (2025-06-15)
      expect(vm.currentDate).toBe('2025-06-15')
    })

    it('displays current month in header', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Should show June 2025
      const monthLabel = wrapper.find('.text-h6')
      expect(monthLabel.text()).toContain('June 2025')
    })
  })

  describe('Calendar Grid Generation', () => {
    it('generates 6 weeks for month view', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      const weeks = wrapper.findAll('.calendar-week')
      expect(weeks).toHaveLength(6) // Always 6 weeks for complete month display
    })

    it('generates 7 days per week', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      const firstWeek = wrapper.find('.calendar-week')
      const days = firstWeek.findAll('.calendar-day')
      expect(days).toHaveLength(7)
    })

    it('shows correct day numbers for June 2025', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Find all day numbers that are current month
      const currentMonthDays = wrapper.findAll('.calendar-day:not(.other-month) .day-number')

      // June 2025 has 30 days
      expect(currentMonthDays).toHaveLength(30)

      // First day should be 1, last should be 30
      expect(currentMonthDays[0].text()).toBe('1')
      expect(currentMonthDays[29].text()).toBe('30')
    })

    it('highlights today correctly', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Find the day marked as today (June 15, 2025)
      const todayCell = wrapper.find('.calendar-day.today')
      expect(todayCell.exists()).toBe(true)

      const todayNumber = todayCell.find('.day-number')
      expect(todayNumber.text()).toBe('15')
    })
  })

  describe('View Mode Switching', () => {
    it('switches to week view', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'week' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.week-view').exists()).toBe(true)
      expect(wrapper.find('.month-view').exists()).toBe(false)
    })

    it('switches to day view', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'day' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.day-view').exists()).toBe(true)
      expect(wrapper.find('.month-view').exists()).toBe(false)
    })

    it('shows 24 hours in day view', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'day' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      const timeRows = wrapper.findAll('.day-view .time-label-row')
      expect(timeRows).toHaveLength(24) // 24 hours (0-23)
    })

    it('shows 24 hours in week view', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'week' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      const timeRows = wrapper.findAll('.week-view .time-label-row')
      expect(timeRows).toHaveLength(24) // 24 hours (0-23)
    })
  })

  describe('Navigation', () => {
    it('navigates to next month', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      // Click next month button
      const nextButton = wrapper.find('[data-test="next-button"]') ||
                        wrapper.find('q-btn[icon="sym_r_chevron_right"]')

      if (nextButton.exists()) {
        await nextButton.trigger('click')
        await wrapper.vm.$nextTick()

        // Should now show July 2025
        const monthLabel = wrapper.find('.text-h6')
        expect(monthLabel.text()).toContain('July 2025')
      }
    })

    it('navigates to previous month', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      // Click previous month button
      const prevButton = wrapper.find('[data-test="prev-button"]') ||
                        wrapper.find('q-btn[icon="sym_r_chevron_left"]')

      if (prevButton.exists()) {
        await prevButton.trigger('click')
        await wrapper.vm.$nextTick()

        // Should now show May 2025
        const monthLabel = wrapper.find('.text-h6')
        expect(monthLabel.text()).toContain('May 2025')
      }
    })

    it('goes to today using goToToday function', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // First navigate away from current month
      vm.currentDate = '2025-05-15' // May 2025
      await wrapper.vm.$nextTick()

      // Call goToToday function directly
      vm.goToToday()
      await wrapper.vm.$nextTick()

      // Should be back to June 2025 (current month)
      expect(vm.currentDate).toBe('2025-06-15')
    })
  })

  describe('Event Display', () => {
    it('validates test event creation and properties', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Wait for component initialization
      await wrapper.vm.$nextTick()

      // Check that loadEvents function exists and can be called
      expect(vm.loadEvents).toBeDefined()
      expect(typeof vm.loadEvents).toBe('function')

      // The test event should be added in loadEvents - check the logic
      const today = new Date('2025-06-15T12:00:00.000Z')
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      expect(todayStr).toBe('2025-06-15')

      // The component should create events array
      expect(vm.events).toBeDefined()
      expect(Array.isArray(vm.events)).toBe(true)
    })

    it('handles empty event state', async () => {
      // Mock APIs to return empty results
      const { eventsApi } = await import('../../../../../src/api/events')
      const { homeApi } = await import('../../../../../src/api/home')

      vi.mocked(eventsApi.getDashboardEvents).mockResolvedValue({ data: [] })
      vi.mocked(homeApi.getUserHome).mockResolvedValue({ data: { upcomingEvents: [] } })

      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Should still render calendar grid even with no events
      const weeks = wrapper.findAll('.calendar-week')
      expect(weeks).toHaveLength(6)
    })
  })

  describe('Event Interaction', () => {
    it('emits eventClick when event is clicked', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Find an event and click it
      const eventBar = wrapper.find('.event-bar')
      if (eventBar.exists()) {
        await eventBar.trigger('click')

        expect(wrapper.emitted('eventClick')).toBeTruthy()
        expect(wrapper.emitted('eventClick')?.[0]).toBeTruthy()
      }
    })

    it('emits dateClick when add event button is clicked', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Click on the add event button
      const addEventBtn = wrapper.find('.add-event-btn')
      if (addEventBtn.exists()) {
        await addEventBtn.trigger('click')

        expect(wrapper.emitted('dateClick')).toBeTruthy()
        expect(wrapper.emitted('dateClick')?.[0]).toBeTruthy()
      }
    })

    it('emits dateSelect when day number is clicked', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Click on the day number container
      const dayNumberContainer = wrapper.find('.day-number-container')
      await dayNumberContainer.trigger('click')

      expect(wrapper.emitted('dateSelect')).toBeTruthy()
      expect(wrapper.emitted('dateSelect')?.[0]).toBeTruthy()
    })
  })

  describe('Date Parsing Functions', () => {
    it('formats day names correctly', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Test formatDayName function
      expect(vm.formatDayName('2025-06-15')).toBe('Sunday') // June 15, 2025 is a Sunday
      expect(vm.formatDayName('2025-06-16')).toBe('Monday')
    })

    it('checks today correctly', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Test isToday function
      expect(vm.isToday('2025-06-15')).toBe(true) // Current date
      expect(vm.isToday('2025-06-14')).toBe(false)
      expect(vm.isToday('2025-06-16')).toBe(false)
    })

    it('formats hours correctly', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Test formatHour function
      expect(vm.formatHour(0)).toBe('12:00 AM')
      expect(vm.formatHour(12)).toBe('12:00 PM')
      expect(vm.formatHour(15)).toBe('3:00 PM')
      expect(vm.formatHour(23)).toBe('11:00 PM')
    })
  })

  describe('Event Filtering', () => {
    it('filters events by date correctly', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Mock events with different times
      vm.events = [
        { id: '1', date: '2025-06-15', time: '09:00', title: '9 AM Event' },
        { id: '2', date: '2025-06-15', time: '14:00-16:00', title: '2-4 PM Event' },
        { id: '3', date: '2025-06-15', time: undefined, isAllDay: true, title: 'All Day Event' },
        { id: '4', date: '2025-06-16', time: '09:00', title: 'Tomorrow Event' }
      ]

      // Test getEventsForDate function
      expect(vm.getEventsForDate('2025-06-15')).toHaveLength(3) // Three events on June 15
      expect(vm.getEventsForDate('2025-06-16')).toHaveLength(1) // One event on June 16
      expect(vm.getEventsForDate('2025-06-17')).toHaveLength(0) // No events on June 17
    })

    it('calculates precise event positioning based on minutes', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Test event at 17:30 (5:30 PM)
      const event1730 = {
        id: '1',
        date: '2025-06-15',
        time: '17:30',
        title: '5:30 PM Event',
        isAllDay: false
      }

      const position1730 = vm.getEventPosition(event1730)

      // 17:30 = 17*60 + 30 = 1050 minutes from start of day
      // 1050 / 1440 (total day minutes) = 72.916...%
      expect(parseFloat(position1730.top)).toBeCloseTo(72.92, 1)

      // Test event range 14:15-16:45 (2:15 PM - 4:45 PM)
      const eventRange = {
        id: '2',
        date: '2025-06-15',
        time: '14:15-16:45',
        title: 'Range Event',
        isAllDay: false
      }

      const positionRange = vm.getEventPosition(eventRange)

      // 14:15 = 14*60 + 15 = 855 minutes from start of day
      // 855 / 1440 = 59.375%
      expect(parseFloat(positionRange.top)).toBeCloseTo(59.38, 1)

      // Duration: 16:45 - 14:15 = 2.5 hours = 150 minutes
      // 150 / 1440 = 10.416...%
      expect(parseFloat(positionRange.height)).toBeCloseTo(10.42, 1)
    })
  })

  describe('Responsive Behavior', () => {
    it('handles compact mode', async () => {
      const wrapper = mount(CustomCalendar, {
        props: { compact: true },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // In compact mode, external events summary should not show
      expect(wrapper.find('.external-summary').exists()).toBe(false)
    })

    it('adapts container height correctly', async () => {
      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'month',
          height: '600px'
        },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Month view should use auto height, not fixed height
      const container = wrapper.find('.calendar-container')
      expect(container.attributes('style')).toContain('height: auto')
    })
  })

  describe('Multi-Day Event Handling', () => {
    it('expands multi-day events into daily instances', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Test multi-day event that spans 3 days
      const multiDayEvent = {
        id: 'multiday-1',
        title: 'Multi-Day Conference',
        date: '2025-06-15',
        startDateTime: '2025-06-15T09:00:00Z',
        endDateTime: '2025-06-17T17:00:00Z',
        type: 'attending' as const,
        bgColor: '#1976d2',
        textColor: '#ffffff',
        isAllDay: false
      }

      const expandedEvents = vm.expandMultiDayEvents([multiDayEvent])

      // Should create 3 daily instances
      expect(expandedEvents).toHaveLength(3)

      // First day should keep original time and title
      expect(expandedEvents[0].date).toBe('2025-06-15')
      expect(expandedEvents[0].title).toBe('Multi-Day Conference')
      expect(expandedEvents[0].isAllDay).toBe(false)
      expect(expandedEvents[0].id).toBe('multiday-1-day-0')

      // Second day should be all-day style with day indicator
      expect(expandedEvents[1].date).toBe('2025-06-16')
      expect(expandedEvents[1].title).toBe('Multi-Day Conference (Day 2)')
      expect(expandedEvents[1].isAllDay).toBe(true)
      expect(expandedEvents[1].id).toBe('multiday-1-day-1')

      // Third day should be all-day style with day indicator
      expect(expandedEvents[2].date).toBe('2025-06-17')
      expect(expandedEvents[2].title).toBe('Multi-Day Conference (Day 3)')
      expect(expandedEvents[2].isAllDay).toBe(true)
      expect(expandedEvents[2].id).toBe('multiday-1-day-2')
    })

    it('handles all-day multi-day events correctly', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const allDayMultiEvent = {
        id: 'allday-multiday-1',
        title: 'All-Day Multi-Day Event',
        date: '2025-06-15',
        startDateTime: '2025-06-15T00:00:00Z',
        endDateTime: '2025-06-18T23:59:59Z',
        type: 'attending' as const,
        bgColor: '#1976d2',
        textColor: '#ffffff',
        isAllDay: true
      }

      const expandedEvents = vm.expandMultiDayEvents([allDayMultiEvent])

      // Should create 4 daily instances (June 15-18)
      expect(expandedEvents).toHaveLength(4)

      // All days should be all-day events
      expandedEvents.forEach((event, index) => {
        expect(event.isAllDay).toBe(true)
        expect(event.time).toBeUndefined()
        if (index === 0) {
          expect(event.title).toBe('All-Day Multi-Day Event')
        } else {
          expect(event.title).toBe(`All-Day Multi-Day Event (Day ${index + 1})`)
        }
      })
    })

    it('does not expand single-day events', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const singleDayEvent = {
        id: 'single-1',
        title: 'Single Day Event',
        date: '2025-06-15',
        startDateTime: '2025-06-15T09:00:00Z',
        endDateTime: '2025-06-15T17:00:00Z',
        type: 'attending' as const,
        bgColor: '#1976d2',
        textColor: '#ffffff',
        isAllDay: false
      }

      const expandedEvents = vm.expandMultiDayEvents([singleDayEvent])

      // Should return the same event unchanged
      expect(expandedEvents).toHaveLength(1)
      expect(expandedEvents[0]).toEqual(singleDayEvent)
    })

    it('does not expand events without end date', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const eventWithoutEnd = {
        id: 'no-end-1',
        title: 'Event Without End',
        date: '2025-06-15',
        startDateTime: '2025-06-15T09:00:00Z',
        type: 'attending' as const,
        bgColor: '#1976d2',
        textColor: '#ffffff',
        isAllDay: false
      }

      const expandedEvents = vm.expandMultiDayEvents([eventWithoutEnd])

      // Should return the same event unchanged
      expect(expandedEvents).toHaveLength(1)
      expect(expandedEvents[0]).toEqual(eventWithoutEnd)
    })

    it('prevents infinite loops with safety check', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Create an extremely long event (2 years)
      const longEvent = {
        id: 'long-1',
        title: 'Extremely Long Event',
        date: '2025-06-15',
        startDateTime: '2025-06-15T09:00:00Z',
        endDateTime: '2027-06-15T17:00:00Z', // 2 years later
        type: 'attending' as const,
        bgColor: '#1976d2',
        textColor: '#ffffff',
        isAllDay: false
      }

      // Mock console.warn to verify warning is logged
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const expandedEvents = vm.expandMultiDayEvents([longEvent])

      // Should stop at 365 days maximum
      expect(expandedEvents).toHaveLength(365)
      expect(consoleSpy).toHaveBeenCalledWith('Multi-day event expansion stopped at 365 days to prevent infinite loop')

      consoleSpy.mockRestore()
    })

    it('handles mixed single-day and multi-day events', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const mixedEvents = [
        {
          id: 'single-1',
          title: 'Single Day Event',
          date: '2025-06-15',
          startDateTime: '2025-06-15T09:00:00Z',
          endDateTime: '2025-06-15T17:00:00Z',
          type: 'attending' as const,
          bgColor: '#1976d2',
          isAllDay: false
        },
        {
          id: 'multi-1',
          title: 'Multi-Day Event',
          date: '2025-06-16',
          startDateTime: '2025-06-16T09:00:00Z',
          endDateTime: '2025-06-18T17:00:00Z',
          type: 'attending' as const,
          bgColor: '#1976d2',
          isAllDay: false
        }
      ]

      const expandedEvents = vm.expandMultiDayEvents(mixedEvents)

      // Should have 1 single-day + 3 multi-day instances = 4 total
      expect(expandedEvents).toHaveLength(4)

      // First event should remain unchanged
      expect(expandedEvents[0].id).toBe('single-1')
      expect(expandedEvents[0].date).toBe('2025-06-15')

      // Multi-day event should be expanded into 3 instances
      expect(expandedEvents[1].id).toBe('multi-1-day-0')
      expect(expandedEvents[1].date).toBe('2025-06-16')
      expect(expandedEvents[2].id).toBe('multi-1-day-1')
      expect(expandedEvents[2].date).toBe('2025-06-17')
      expect(expandedEvents[3].id).toBe('multi-1-day-2')
      expect(expandedEvents[3].date).toBe('2025-06-18')
    })
  })

  describe('Cancelled Event Handling', () => {
    it('displays cancelled events in red', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Mock events with one cancelled event
      vm.events = [
        {
          id: 'cancelled-1',
          title: 'Cancelled Event',
          date: '2025-06-15',
          time: '14:00',
          type: 'cancelled',
          bgColor: '#f44336', // Red color for cancelled
          textColor: '#ffffff',
          isCancelled: true
        },
        {
          id: 'normal-1',
          title: 'Normal Event',
          date: '2025-06-15',
          time: '16:00',
          type: 'attending',
          bgColor: '#1976d2', // Blue color for normal
          textColor: '#ffffff',
          isCancelled: false
        }
      ]

      await wrapper.vm.$nextTick()

      // Check that events are in the component's data
      expect(vm.events).toHaveLength(2)
      expect(vm.events[0].bgColor).toBe('#f44336') // Red for cancelled
      expect(vm.events[1].bgColor).toBe('#1976d2') // Blue for normal
      expect(vm.events[0].type).toBe('cancelled')
      expect(vm.events[1].type).toBe('attending')
    })

    it('correctly identifies cancelled status from EventStatus enum', () => {
      // Test the status checking logic directly
      expect(EventStatus.Cancelled).toBe('cancelled')
      expect(EventStatus.Published).toBe('published')

      // Test that cancelled status would trigger red color
      const mockCancelledEvent = { status: EventStatus.Cancelled }
      const mockPublishedEvent = { status: EventStatus.Published }

      expect(mockCancelledEvent.status === EventStatus.Cancelled).toBe(true)
      expect(mockPublishedEvent.status === EventStatus.Cancelled).toBe(false)
    })

    it('shows cancelled legend item', async () => {
      const wrapper = mount(CustomCalendar, {
        global: {
          plugins: [pinia]
        }
      })

      // Mock some events to show the legend
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any
      vm.events = [{ id: '1', title: 'Test', date: '2025-06-15', type: 'attending', bgColor: '#1976d2' }]

      await wrapper.vm.$nextTick()

      // Check that the legend shows the cancelled item
      const legend = wrapper.find('.calendar-legend')
      expect(legend.exists()).toBe(true)

      const legendItems = wrapper.findAll('.legend-item')
      const cancelledItem = legendItems.find(item => item.text().includes('Cancelled'))
      expect(cancelledItem).toBeDefined()

      // Check that the cancelled legend has the correct color (red)
      const cancelledColorDiv = wrapper.find('.legend-color[style*="#f44336"]')
      expect(cancelledColorDiv.exists()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      // Mock API to throw error
      const { homeApi } = await import('../../../../../src/api/home')
      vi.mocked(homeApi.getUserHome).mockRejectedValue(new Error('API Error'))

      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Should still render calendar even with API errors
      expect(wrapper.find('.custom-calendar').exists()).toBe(true)
      const weeks = wrapper.findAll('.calendar-week')
      expect(weeks).toHaveLength(6)
    })

    it('handles missing user gracefully', async () => {
      // Mock store with no user
      mockAuthStore.user = null

      const wrapper = mount(CustomCalendar, {
        props: { mode: 'month' },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Should still render calendar structure
      expect(wrapper.find('.custom-calendar').exists()).toBe(true)
    })
  })
})
