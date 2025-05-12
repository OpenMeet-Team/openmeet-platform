import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import EventFormBasicComponent from '../../../../../src/components/event/EventFormBasicComponent.vue'
import { formatInTimeZone } from 'date-fns-tz'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'

// Define the component type
interface EventData {
  startDate: string;
  timeZone: string;
  [key: string]: unknown;
}

interface RecurrenceViewModel {
  frequency: string;
  monthlyRepeatType: string;
  monthlyPosition: string;
  monthlyWeekday: string;
  humanReadablePattern: string;
  [key: string]: unknown;
}

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Mock the necessary dependencies
vi.mock('../../../../../src/api/events', () => ({
  eventsApi: {
    create: vi.fn().mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' }
    }),
    update: vi.fn().mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' }
    }),
    edit: vi.fn().mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' }
    }),
    getBySlug: vi.fn().mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' }
    })
  }
}))

vi.mock('../../../../../src/api/categories', () => ({
  categoriesApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' }
      ]
    })
  }
}))

vi.mock('../../../../../src/api/groups', () => ({
  groupsApi: {
    getAllMe: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Group 1' },
        { id: 2, name: 'Group 2' }
      ]
    })
  }
}))

vi.mock('../../../../../src/api/event-series', () => ({
  eventSeriesApi: {
    createSeriesFromEvent: vi.fn().mockResolvedValue({
      data: { slug: 'test-series', name: 'Test Series' }
    })
  }
}))

vi.mock('../../../../../src/services/analyticsService', () => ({
  default: {
    trackEvent: vi.fn()
  }
}))

// Mock the auth store
vi.mock('../../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    getBlueskyDid: null,
    getBlueskyHandle: null,
    $state: {}
  }))
}))

describe('EventForm Recurrence Timezone Issue', () => {
  // Create a predictable "now" date for testing
  const fixedDate = new Date('2025-05-29T12:00:00.000Z')

  beforeEach(() => {
    // Set system time for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(fixedDate)

    // Set up a fresh pinia instance for each test with testing configuration
    setActivePinia(createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    }))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should preserve the correct day of week in Asia/Novosibirsk timezone', async () => {
    // Mount the component
    const wrapper = mount(EventFormBasicComponent, {
      global: {
        stubs: {
          'q-markdown': true,
          'vue-router': true
        }
      }
    })

    // Wait for initial data loading to complete
    await vi.runAllTimersAsync()

    // Access the component instance
    const vm = wrapper.vm as { eventData: EventData; isRecurring: boolean }

    // Fill in required form fields
    await wrapper.find('[data-cy="event-name-input"]').setValue('Asia/Novosibirsk Timezone Test')
    await wrapper.find('[data-cy="event-description"]').setValue('Testing recurrence pattern in Asian timezone')

    // Set the timezone to Asia/Novosibirsk
    vm.eventData.timeZone = 'Asia/Novosibirsk'
    await wrapper.vm.$nextTick()

    // Find the DatetimeComponent
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })
    expect(datetimeComponent.exists()).toBeTruthy()

    if (datetimeComponent.exists()) {
      // Set the date to Thursday May 29, 2025 at 4:15 PM in Asia/Novosibirsk
      // First update the date
      datetimeComponent.vm.onDateUpdate('2025-05-29')
      await wrapper.vm.$nextTick()

      // Then update the time to 4:00 PM
      datetimeComponent.vm.onTimeUpdate('4:15 PM')
      await wrapper.vm.$nextTick()
      await vi.runAllTimersAsync()

      // Verify the date set is correct
      const startDate = new Date(vm.eventData.startDate)
      console.log('Start date UTC:', startDate.toISOString())
      console.log('Start date local:', startDate.toString())

      // For 4:15 PM in Novosibirsk (UTC+7), we expect UTC time to be 9:15 AM
      expect(startDate.getFullYear()).toBe(2025)
      expect(startDate.getMonth()).toBe(4) // May
      expect(startDate.getDate()).toBe(29)
      expect(startDate.getUTCHours()).toBe(9) // 09:15 UTC = 16:15 Novosibirsk... this is showing up as 06
      expect(startDate.getUTCMinutes()).toBe(15)

      // Format the date in Asia/Novosibirsk to verify it shows as 4:15 PM
      const dateInNovosibirsk = formatInTimeZone(
        startDate,
        'Asia/Novosibirsk',
        'yyyy-MM-dd HH:mm:ss'
      )
      console.log('Date in Asia/Novosibirsk:', dateInNovosibirsk)
      expect(dateInNovosibirsk).toContain('2025-05-29')
      expect(dateInNovosibirsk).toContain('16:15:00') // 4:15 PM in Novosibirsk

      // Set end time one hour later (5:15 PM in Novosibirsk)
      const endDateComponent = wrapper.findComponent({ name: 'DatetimeComponent', ref: 'endDate' })
      if (endDateComponent.exists()) {
        endDateComponent.vm.onTimeUpdate('5:15 PM')
        await wrapper.vm.$nextTick()
        await vi.runAllTimersAsync()

        // Verify end time is set correctly
        const endDate = new Date(vm.eventData.endDate)
        console.log('End date UTC:', endDate.toISOString())

        // For 5:15 PM in Novosibirsk (UTC+7), we expect UTC time to be 10:15 AM
        expect(endDate.getUTCHours()).toBe(10) // 10:15 UTC = 17:15 Novosibirsk
        expect(endDate.getUTCMinutes()).toBe(15)

        // Verify it's displayed correctly in Novosibirsk timezone
        const endDateInNovosibirsk = formatInTimeZone(
          endDate,
          'Asia/Novosibirsk',
          'yyyy-MM-dd HH:mm:ss'
        )
        console.log('End date in Asia/Novosibirsk:', endDateInNovosibirsk)
        expect(endDateInNovosibirsk).toContain('17:15:00') // 5:15 PM in Novosibirsk
      }

      // Verify the day of week is correctly determined
      // Thursday = 4 (0-indexed where Sunday = 0)
      const localDateObj = new Date(dateInNovosibirsk.replace(' ', 'T'))
      const localDayOfWeek = localDateObj.getDay()
      console.log('Day of week in timezone (0=Sun, 4=Thu):', localDayOfWeek)
      expect(localDayOfWeek).toBe(4) // Should be Thursday

      // Now make it a recurring event
      vm.isRecurring = true
      await wrapper.vm.$nextTick()
      await vi.runAllTimersAsync()

      // Find the RecurrenceComponent
      const recurrenceComponent = wrapper.findComponent({ name: 'RecurrenceComponent' })
      expect(recurrenceComponent.exists()).toBeTruthy()

      if (recurrenceComponent.exists()) {
        // Get reference to recurrence component VM
        const recurrenceVM = recurrenceComponent.vm as RecurrenceViewModel

        // Change to monthly frequency
        recurrenceVM.frequency = 'MONTHLY'
        await wrapper.vm.$nextTick()
        await vi.runAllTimersAsync()

        // Change to day of week (should default to the correct day/position)
        recurrenceVM.monthlyRepeatType = 'dayOfWeek'
        await wrapper.vm.$nextTick()
        await vi.runAllTimersAsync()

        // Check the selected weekday and position
        console.log('Monthly pattern:', {
          weekday: recurrenceVM.monthlyWeekday,
          position: recurrenceVM.monthlyPosition
        })

        // CRITICAL TEST: The day should be Thursday (TH), not Wednesday (WE)
        expect(recurrenceVM.monthlyWeekday).toBe('TH')

        // Fifth Thursday (or last, depending on implementation)
        const dayPosition = parseInt(recurrenceVM.monthlyPosition, 10)
        expect([4, 5, -1]).toContain(dayPosition)

        // Check the human readable pattern
        console.log('Human readable pattern:', recurrenceVM.humanReadablePattern)

        // The pattern should mention Thursday, not Wednesday
        expect(recurrenceVM.humanReadablePattern.toLowerCase()).toContain('thursday')
        expect(recurrenceVM.humanReadablePattern.toLowerCase()).not.toContain('wednesday')
      }
    }
  })
})
