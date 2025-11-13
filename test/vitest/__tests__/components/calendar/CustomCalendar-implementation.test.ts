import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Quasar } from 'quasar'
import CustomCalendar from '../../../../../src/components/calendar/CustomCalendar.vue'
import { useAuthStore } from '../../../../../src/stores/auth-store'
import { EventStatus } from '../../../../../src/types/event'
import type { UserEntity } from '../../../../../src/types/user'

// Type for accessing internal component data in tests
interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  startDateTime?: string
  endDateTime?: string
  timeZone?: string
  type: string
  bgColor: string
}

interface CalendarComponentInstance {
  events: CalendarEvent[]
  calendarGrid: Array<Array<{ date: string; events: CalendarEvent[] }>>
}

// Mock the calendar API to prevent network calls
vi.mock('../../../../../src/api/calendar', () => ({
  getExternalEvents: vi.fn().mockResolvedValue({
    data: {
      events: [],
      totalCount: 0,
      dateRange: { startTime: '', endTime: '' }
    }
  })
}))

/**
 * IMPLEMENTATION TEST: CustomCalendar Timezone Bug (Issue #281)
 *
 * This test verifies that the ACTUAL CustomCalendar component correctly
 * displays events on the right day and with the right time when timezone
 * information is provided.
 *
 * Bug scenario from screenshot:
 * - Event: Wednesday 6pm PST (stored as 2025-11-13T02:00:00.000Z)
 * - WRONG: Calendar showed Thursday
 * - RIGHT: Calendar should show Wednesday
 */

describe('CustomCalendar Component - Timezone Implementation Test', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)

    // Mock authenticated user
    const authStore = useAuthStore()
    authStore.user = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User'
    } as UserEntity
  })

  describe('Group Events Display with Timezones', () => {
    it('should display Wednesday evening event on Wednesday (not Thursday)', async () => {
      // This is the EXACT scenario from the screenshot
      // Event: Wednesday Nov 12, 2025 at 6pm PST
      // Stored in DB as: Thursday Nov 13, 2025 at 2am UTC
      const groupEvents = [
        {
          ulid: 'crmc-meeting-nov',
          slug: 'crmc-monthly-meeting-november',
          name: 'CRMC Monthly Meeting',
          startDate: '2025-11-13T02:00:00.000Z', // 6pm PST Nov 12 = 2am UTC Nov 13
          endDate: '2025-11-13T05:00:00.000Z', // 9pm PST Nov 12 = 5am UTC Nov 13
          timeZone: 'America/Vancouver',
          isAllDay: false,
          status: EventStatus.Published
        }
      ]

      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'month',
          groupEvents,
          startDate: '2025-11-01',
          endDate: '2025-11-30'
        },
        global: {
          plugins: [Quasar],
          stubs: {
            'q-inner-loading': true,
            'q-spinner-dots': true,
            'q-btn': true,
            'q-icon': true,
            'q-banner': true
          }
        }
      })

      // Wait for component to process events
      await flushPromises()
      await wrapper.vm.$nextTick()

      console.log('\n=== IMPLEMENTATION TEST: Wednesday Event Display ===')

      // Check that the component's events array has the correct date
      const events = (wrapper.vm as CalendarComponentInstance).events
      expect(events).toBeDefined()
      expect(events.length).toBeGreaterThan(0)

      const event = events[0]
      console.log('Event processed by component:')
      console.log('  Title:', event.title)
      console.log('  Date:', event.date, '(should be 2025-11-12, Wednesday)')
      console.log('  Time:', event.time, '(should be 18:00-21:00 or 6pm-9pm)')
      console.log('  StartDateTime:', event.startDateTime)
      console.log('  Timezone: America/Vancouver (PST)')

      // VERIFY: Event should appear on Wednesday Nov 12, NOT Thursday Nov 13
      expect(event.date).toBe('2025-11-12')

      // VERIFY: Time should be 18:00-21:00 (6pm-9pm PST), not anything else
      expect(event.time).toBe('18:00-21:00')

      console.log('✓ Event correctly shows Wednesday Nov 12')
      console.log('✓ Event correctly shows 6pm-9pm (18:00-21:00)')
      console.log('================================================\n')

      wrapper.unmount()
    })

    it('should display October evening event on correct day during PDT', async () => {
      // Event during PDT (UTC-7)
      const groupEvents = [
        {
          ulid: 'oct-meeting',
          slug: 'october-meeting',
          name: 'October Meeting',
          startDate: '2025-10-09T02:00:00.000Z', // 7pm PDT Oct 8 = 2am UTC Oct 9
          endDate: '2025-10-09T04:00:00.000Z', // 9pm PDT Oct 8 = 4am UTC Oct 9
          timeZone: 'America/Vancouver',
          isAllDay: false,
          status: EventStatus.Published
        }
      ]

      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'month',
          groupEvents,
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        },
        global: {
          plugins: [Quasar],
          stubs: {
            'q-inner-loading': true,
            'q-spinner-dots': true,
            'q-btn': true,
            'q-icon': true,
            'q-banner': true
          }
        }
      })

      await flushPromises()
      await wrapper.vm.$nextTick()

      const events = (wrapper.vm as CalendarComponentInstance).events
      const event = events[0]

      console.log('\n=== PDT Event Test ===')
      console.log('Event date:', event.date, '(should be 2025-10-08, Wednesday)')
      console.log('Event time:', event.time, '(should be 19:00-21:00)')
      console.log('===================\n')

      // Should show Oct 8 (Wednesday), not Oct 9 (Thursday)
      expect(event.date).toBe('2025-10-08')
      expect(event.time).toBe('19:00-21:00')

      wrapper.unmount()
    })

    it('should handle all-day events correctly', async () => {
      const groupEvents = [
        {
          ulid: 'allday-event',
          slug: 'all-day-event',
          name: 'All Day Event',
          startDate: '2025-11-12T00:00:00.000Z',
          endDate: '2025-11-12T23:59:59.000Z',
          timeZone: 'America/Vancouver',
          isAllDay: true,
          status: EventStatus.Published
        }
      ]

      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'month',
          groupEvents,
          startDate: '2025-11-01',
          endDate: '2025-11-30'
        },
        global: {
          plugins: [Quasar],
          stubs: {
            'q-inner-loading': true,
            'q-spinner-dots': true,
            'q-btn': true,
            'q-icon': true,
            'q-banner': true
          }
        }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const events = (wrapper.vm as CalendarComponentInstance).events
      const event = events[0]

      console.log('\n=== All-Day Event Test ===')
      console.log('Event date:', event.date)
      console.log('Event time:', event.time, '(should be undefined for all-day)')
      console.log('Is all day:', event.isAllDay)
      console.log('========================\n')

      expect(event.isAllDay).toBe(true)
      expect(event.time).toBeUndefined()

      wrapper.unmount()
    })

    it('should handle events without timezone (fallback to UTC)', async () => {
      const groupEvents = [
        {
          ulid: 'utc-event',
          slug: 'utc-event',
          name: 'UTC Event',
          startDate: '2025-11-12T14:00:00.000Z', // 2pm UTC
          endDate: '2025-11-12T16:00:00.000Z', // 4pm UTC
          // No timeZone field - should fallback to UTC
          isAllDay: false,
          status: EventStatus.Published
        }
      ]

      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'month',
          groupEvents,
          startDate: '2025-11-01',
          endDate: '2025-11-30'
        },
        global: {
          plugins: [Quasar],
          stubs: {
            'q-inner-loading': true,
            'q-spinner-dots': true,
            'q-btn': true,
            'q-icon': true,
            'q-banner': true
          }
        }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const events = (wrapper.vm as CalendarComponentInstance).events
      const event = events[0]

      console.log('\n=== UTC Fallback Test ===')
      console.log('Event date:', event.date)
      console.log('Event time:', event.time)
      console.log('======================\n')

      // Without timezone, should use UTC directly
      expect(event.date).toBe('2025-11-12')
      expect(event.time).toBe('14:00-16:00')

      wrapper.unmount()
    })
  })

  describe('Calendar Grid Rendering', () => {
    it('should render event in the correct week/day cell', async () => {
      // Wednesday Nov 12, 2025 event
      const groupEvents = [
        {
          ulid: 'test-event',
          slug: 'test-event',
          name: 'Test Event',
          startDate: '2025-11-13T02:00:00.000Z', // 6pm PST Nov 12 = 2am UTC Nov 13
          endDate: '2025-11-13T05:00:00.000Z',
          timeZone: 'America/Vancouver',
          isAllDay: false,
          status: EventStatus.Published
        }
      ]

      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'month',
          groupEvents,
          startDate: '2025-11-01',
          endDate: '2025-11-30'
        },
        global: {
          plugins: [Quasar],
          stubs: {
            'q-inner-loading': true,
            'q-spinner-dots': true,
            'q-btn': true,
            'q-icon': true,
            'q-banner': true
          }
        }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      // Get the calendar grid
      const calendarGrid = (wrapper.vm as CalendarComponentInstance).calendarGrid

      console.log('\n=== Calendar Grid Test ===')
      console.log('Looking for event on Nov 12...')

      // Find the day cell for Nov 12
      let foundOnCorrectDay = false
      let foundOnWrongDay = false

      for (const week of calendarGrid) {
        for (const day of week) {
          if (day.date === '2025-11-12') {
            console.log('Nov 12 (Wednesday) cell has', day.events.length, 'events')
            if (day.events.length > 0) {
              foundOnCorrectDay = true
              console.log('✓ Event found on Wednesday Nov 12 (CORRECT)')
            }
          }
          if (day.date === '2025-11-13') {
            console.log('Nov 13 (Thursday) cell has', day.events.length, 'events')
            if (day.events.length > 0) {
              foundOnWrongDay = true
              console.log('✗ Event found on Thursday Nov 13 (WRONG - BUG NOT FIXED)')
            }
          }
        }
      }

      console.log('=======================\n')

      // VERIFY: Event should be on Nov 12, NOT Nov 13
      expect(foundOnCorrectDay).toBe(true)
      expect(foundOnWrongDay).toBe(false)

      wrapper.unmount()
    })
  })

  describe('Bug Reproduction Test', () => {
    it('should NOT reproduce the bug from the screenshot', async () => {
      // Exact scenario from the screenshot
      const groupEvents = [
        {
          ulid: 'crmc-monthly-meeting',
          slug: 'crmc-monthly-meeting-november',
          name: 'CRMC Monthly Meeting',
          startDate: '2025-11-13T02:00:00.000Z', // 6pm PST Wednesday Nov 12
          endDate: '2025-11-13T05:00:00.000Z', // 9pm PST Wednesday Nov 12
          timeZone: 'America/Vancouver',
          isAllDay: false,
          status: EventStatus.Published
        }
      ]

      const wrapper = mount(CustomCalendar, {
        props: {
          mode: 'month',
          groupEvents,
          startDate: '2025-11-01',
          endDate: '2025-11-30'
        },
        global: {
          plugins: [Quasar],
          stubs: {
            'q-inner-loading': true,
            'q-spinner-dots': true,
            'q-btn': true,
            'q-icon': true,
            'q-banner': true
          }
        }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const events = (wrapper.vm as CalendarComponentInstance).events
      const event = events[0]

      console.log('\n=== BUG REPRODUCTION TEST ===')
      console.log('Screenshot reported:')
      console.log('  - Event appeared on Thursday (WRONG)')
      console.log('  - Time showed 7pm-10pm (WRONG)')
      console.log('')
      console.log('After fix:')
      console.log('  - Event date:', event.date)
      console.log('  - Event time:', event.time)
      console.log('')

      if (event.date === '2025-11-13') {
        console.log('✗ BUG STILL EXISTS - Event on Thursday')
      } else if (event.date === '2025-11-12') {
        console.log('✓ BUG FIXED - Event on Wednesday')
      }

      if (event.time === '19:00-22:00' || event.time === '19:00-02:00') {
        console.log('✗ TIME BUG STILL EXISTS')
      } else if (event.time === '18:00-21:00') {
        console.log('✓ TIME BUG FIXED')
      }

      console.log('===========================\n')

      // Verify the bug is fixed
      expect(event.date).toBe('2025-11-12') // Wednesday, not Thursday
      expect(event.time).toBe('18:00-21:00') // 6pm-9pm, not 7pm-10pm

      wrapper.unmount()
    })
  })
})
