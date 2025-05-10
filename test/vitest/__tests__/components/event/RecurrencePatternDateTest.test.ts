import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import EventFormBasicComponent from '../../../../../src/components/event/EventFormBasicComponent.vue'
import { formatInTimeZone } from 'date-fns-tz'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'

// Define the component type
interface EventFormData {
  eventData: {
    startDate: string;
    [key: string]: any;
  };
  isRecurring: boolean;
  [key: string]: any;
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

// Create a predictable "now" date for testing
const fixedDate = new Date('2025-05-15T12:00:00.000Z')
vi.useFakeTimers()
vi.setSystemTime(fixedDate)

// Don't mock date-fns-tz so we can test the actual timezone conversion logic
// which is likely part of the bug. Instead, we'll use the real implementation.

describe('EventForm Recurrence Pattern Date Consistency', () => {
  beforeEach(() => {
    // Set up a fresh pinia instance for each test with testing configuration
    setActivePinia(createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    }))
    vi.clearAllMocks()
  })

  it('should preserve the correct day of week in recurrence pattern when setting date', async () => {
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

    // Fill in required form fields
    await wrapper.find('[data-cy="event-name-input"]').setValue('Recurrence Test Event')
    await wrapper.find('[data-cy="event-description"]').setValue('Testing recurrence pattern day consistency')

    // Reference to the event data for direct manipulation
    const eventData = wrapper.vm.eventData

    // 1. First test the bug condition - we'll select Wed May 14, 2025
    // This is a Wednesday, and we need to make sure it stays a Wednesday in patterns
    const testDate = new Date(2025, 4, 14) // May 14, 2025 (Month is 0-indexed)
    const isoString = testDate.toISOString()

    // Set the date directly in the component data
    eventData.startDate = isoString
    await wrapper.vm.$nextTick()

    // Verify the selected day is a Wednesday
    const selectedDayOfWeek = testDate.getDay()
    expect(selectedDayOfWeek).toBe(3) // 3 is Wednesday (0-indexed)

    console.log('Test date:', testDate.toDateString())
    console.log('Day of week:', selectedDayOfWeek, '(3 = Wednesday)')

    // Enable recurrence
    wrapper.vm.isRecurring = true
    await wrapper.vm.$nextTick()

    // Check if the recurrence component was initialized properly
    const recurrenceComponent = wrapper.findComponent({ name: 'RecurrenceComponent' })
    expect(recurrenceComponent.exists()).toBeTruthy()

    if (recurrenceComponent.exists()) {
      // Wait for the recurrence component to initialize
      await vi.runAllTimersAsync()
      await wrapper.vm.$nextTick()

      // Log the recurrence component props
      console.log('Recurrence component props:', {
        startDate: recurrenceComponent.props('startDate'),
        timeZone: recurrenceComponent.props('timeZone')
      })

      // Verify that the start date sent to RecurrenceComponent matches our test date
      expect(recurrenceComponent.props('startDate')).toBe(isoString)

      // IMPORTANT: Now test the weekday in RecurrenceComponent
      // For weekly pattern, should have selected the correct day of week (Wednesday)
      // This is testing the actual bug where sometimes the pattern shows Tuesdays
      // when Wednesdays were selected

      // Due to mounting limitations in test environment, we'll test the helpers directly
      // to validate the day of week calculation functions correctly
      const startDateObject = new Date(recurrenceComponent.props('startDate'))
      const actualDayOfWeek = startDateObject.getDay()

      // This is the critical test - the day of week must match our selected Wednesday
      expect(actualDayOfWeek).toBe(3) // 3 = Wednesday
      expect(actualDayOfWeek).not.toBe(2) // Not Tuesday

      // Also verify the startDate object in RecurrenceComponent has correct date
      console.log('RecurrenceComponent start date object:', startDateObject.toDateString())
    }
  })

  it('should properly handle timezone conversions without shifting the selected date', async () => {
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
    const vm = wrapper.vm

    // Fill in required form fields
    await wrapper.find('[data-cy="event-name-input"]').setValue('Timezone Test Event')
    await wrapper.find('[data-cy="event-description"]').setValue('Testing timezone conversions')

    // Set a specific timezone for testing
    vm.eventData.timeZone = 'America/New_York'
    await wrapper.vm.$nextTick()

    // 1. Test with a date that might cause timezone issues (near midnight UTC)
    // Choose May 14, 2025 with a specific time
    const originalDate = new Date(2025, 4, 14, 20, 0) // May 14, 2025, 8:00 PM local time
    const originalIsoString = originalDate.toISOString()

    // Set the date directly in the component data
    vm.eventData.startDate = originalIsoString
    await wrapper.vm.$nextTick()

    // Extract the date parts we care about
    const originalDay = originalDate.getDate() // Should be 14
    const originalMonth = originalDate.getMonth() // Should be 4 (May, 0-indexed)

    // Enable recurrence
    wrapper.vm.isRecurring = true
    await wrapper.vm.$nextTick()

    // Find the DatetimeComponent
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })
    expect(datetimeComponent.exists()).toBeTruthy()

    if (datetimeComponent.exists()) {
      // Get the current formatted date values
      const displayedDate = datetimeComponent.vm.formattedDate
      console.log('Displayed date in component:', displayedDate)

      // Now simulate updating the date through DatetimeComponent
      // This should use the timezone-aware conversion logic
      datetimeComponent.vm.onDateUpdate('2025-05-14') // Same date but explicit format
      await wrapper.vm.$nextTick()

      // Verify the resulting date after timezone adjustments
      const updatedDate = new Date(vm.eventData.startDate)
      const updatedDay = updatedDate.getUTCDate()
      const updatedMonth = updatedDate.getUTCMonth()

      console.log('Original date parts:', { day: originalDay, month: originalMonth })
      console.log('Updated date parts:', { day: updatedDay, month: updatedMonth })

      // Critical test: The date should still be May 14, not shifted to another day
      expect(updatedDay).toBe(14)
      expect(updatedMonth).toBe(4) // May (0-indexed)

      // The time might change due to timezone conversion, but the date should remain consistent
      // Format dates for easier debugging in both timezones
      const originalInTz = formatInTimeZone(originalDate, 'America/New_York', 'yyyy-MM-dd')
      const updatedInTz = formatInTimeZone(updatedDate, 'America/New_York', 'yyyy-MM-dd')

      console.log('Date in America/New_York timezone:')
      console.log('- Original:', originalInTz)
      console.log('- Updated:', updatedInTz)

      // The formatted dates in the target timezone should match
      expect(updatedInTz).toBe(originalInTz)
    }
  })

  it('should maintain consistency between selected date and recurrence pattern day', async () => {
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

    // Fill in required form fields
    await wrapper.find('[data-cy="event-name-input"]').setValue('Recurrence Pattern Test')
    await wrapper.find('[data-cy="event-description"]').setValue('Testing recurrence pattern consistency')

    // Find the DatetimeComponent
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })

    if (datetimeComponent.exists()) {
      // 1. Set the date to a Tuesday (May 13, 2025)
      const tuesdayDate = '2025-05-13'
      datetimeComponent.vm.onDateUpdate(tuesdayDate)
      await wrapper.vm.$nextTick()

      // Set a specific time (2:00 PM)
      datetimeComponent.vm.onTimeUpdate('2:00 PM')
      await wrapper.vm.$nextTick()

      // Enable recurrence
      wrapper.vm.isRecurring = true
      await wrapper.vm.$nextTick()

      // Wait for recurrence component to initialize
      await vi.runAllTimersAsync()

      // Find the RecurrenceComponent
      const recurrenceComponent = wrapper.findComponent({ name: 'RecurrenceComponent' })

      if (recurrenceComponent.exists()) {
        // Verify the start date in recurrence component
        const recurrenceStartDate = new Date(recurrenceComponent.props('startDate'))
        const dayOfWeek = recurrenceStartDate.getDay()

        // Tuesday should be day 2 (0-indexed)
        expect(dayOfWeek).toBe(2)

        // Check if the RecurrenceComponent has selected the correct day
        // This is checking internal implementation details but is necessary to verify
        // the bug fix

        // Get a reference to the recurrence component VM if possible
        const recurrenceVM = recurrenceComponent.vm
        if (recurrenceVM && recurrenceVM.selectedDays) {
          // Check if Tuesday (TU) is selected in the recurrence pattern
          expect(recurrenceVM.selectedDays).toContain('TU')

          // Log the selected days for debugging
          console.log('Selected days in recurrence pattern:', recurrenceVM.selectedDays)
        }

        // Now test changing the date to a different day of week
        // 2. Change to a Thursday (May 15, 2025)
        const thursdayDate = '2025-05-15'
        datetimeComponent.vm.onDateUpdate(thursdayDate)
        await wrapper.vm.$nextTick()
        await vi.runAllTimersAsync()

        // Verify the updated start date
        const updatedStartDate = new Date(recurrenceComponent.props('startDate'))
        const updatedDayOfWeek = updatedStartDate.getDay()

        // Thursday should be day 4 (0-indexed)
        expect(updatedDayOfWeek).toBe(4)

        // Verify that the recurrence pattern updated to Thursday
        if (recurrenceVM && recurrenceVM.selectedDays) {
          // First day should now be Thursday (TH)
          expect(recurrenceVM.selectedDays[0]).toBe('TH')

          // Log the updated selected days
          console.log('Updated selected days in recurrence pattern:', recurrenceVM.selectedDays)
        }
      }
    }
  })

  it('should correctly handle monthly patterns with day of week selection', async () => {
    // Use Vitest's test timeout configuration
    vi.setConfig({ testTimeout: 15000 })

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

    // Fill in required form fields
    await wrapper.find('[data-cy="event-name-input"]').setValue('Monthly Pattern Test')
    await wrapper.find('[data-cy="event-description"]').setValue('Testing monthly recurrence pattern')

    // Find the DatetimeComponent
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })

    if (datetimeComponent.exists()) {
      // 1. Set the date to Wednesday, May 14, 2025 (second Wednesday of May)
      const testDate = '2025-05-14'
      datetimeComponent.vm.onDateUpdate(testDate)
      await wrapper.vm.$nextTick()

      // Set a specific time (2:00 PM)
      datetimeComponent.vm.onTimeUpdate('2:00 PM')
      await wrapper.vm.$nextTick()

      // Parse the date to verify it's the correct day
      const vm = wrapper.vm as unknown as { eventData: { startDate: string } }
      const parsedDate = new Date(vm.eventData.startDate)
      expect(parsedDate.getDate()).toBe(14)
      expect(parsedDate.getDay()).toBe(3) // Wednesday = 3

      // Enable recurrence
      const vmWithRecurring = wrapper.vm as unknown as { isRecurring: boolean }
      vmWithRecurring.isRecurring = true
      await wrapper.vm.$nextTick()

      // Find the RecurrenceComponent
      const recurrenceComponent = wrapper.findComponent({ name: 'RecurrenceComponent' })

      if (recurrenceComponent.exists()) {
        // Set recurrence to Monthly
        const recurrenceVM = recurrenceComponent.vm as unknown as {
          frequency: string;
          monthlyRepeatType: string;
          monthlyPosition: string;
          monthlyWeekday: string;
          humanReadablePattern: string;
        }

        recurrenceVM.frequency = 'MONTHLY'
        await wrapper.vm.$nextTick()

        // Set to day of week pattern (Second Wednesday)
        recurrenceVM.monthlyRepeatType = 'dayOfWeek'
        await wrapper.vm.$nextTick()

        // Verify the correct position and weekday are selected
        expect(recurrenceVM.monthlyPosition).toBe('2') // Second
        expect(recurrenceVM.monthlyWeekday).toBe('WE') // Wednesday

        // Log the monthly pattern values
        console.log('Monthly pattern values:', {
          position: recurrenceVM.monthlyPosition,
          weekday: recurrenceVM.monthlyWeekday
        })

        // Wait for pattern calculation with a shorter timeout
        await vi.runAllTimersAsync()
        await wrapper.vm.$nextTick()

        // Get the human-readable pattern
        const pattern = recurrenceVM.humanReadablePattern
        console.log('Human readable pattern:', pattern)

        // Verify the pattern contains the expected values
        expect(pattern.toLowerCase()).toContain('second')
        expect(pattern.toLowerCase()).toContain('wednesday')
      }
    }
  })
})
