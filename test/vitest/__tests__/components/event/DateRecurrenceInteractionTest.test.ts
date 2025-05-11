import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'

// Import the key components involved in the bug
import DatetimeComponent from '../../../../../src/components/common/DatetimeComponent.vue'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import EventFormBasicComponent from '../../../../../src/components/event/EventFormBasicComponent.vue'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Mock necessary dependencies
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

vi.mock('../../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    getBlueskyDid: null,
    getBlueskyHandle: null,
    $state: {}
  }))
}))

// Fix issues with date comparisons in tests by providing a stable date
const FIXED_DATE = new Date('2025-05-14T12:00:00.000Z') // May 14, 2025
vi.useFakeTimers()
vi.setSystemTime(FIXED_DATE)

describe('Date and Recurrence Interaction Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // New test case specifically targeting the end time scenario
  it('should maintain correct day of week when setting both start and end times', async () => {
    // Mount the parent component that integrates both DatetimeComponent and RecurrenceComponent
    const wrapper = mount(EventFormBasicComponent, {
      global: {
        stubs: {
          'q-markdown': true, // Stub complex components
          'vue-router': true
        }
      }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Set initial date - May 14, 2025 (a Wednesday) with timezone in Asia/Tokyo
    const testStartDate = '2025-05-14T14:00:00.000Z'
    wrapper.vm.eventData.startDate = testStartDate
    wrapper.vm.eventData.timeZone = 'Asia/Tokyo' // UTC+9

    // Set an end date and time (3 hours later)
    const testEndDate = '2025-05-14T17:00:00.000Z'
    wrapper.vm.eventData.endDate = testEndDate

    await wrapper.vm.$nextTick()

    // Enable recurrence
    wrapper.vm.isRecurring = true
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Get references to the DatetimeComponents
    const startDateComponent = wrapper.findAllComponents(DatetimeComponent)[0]
    const endDateComponent = wrapper.findAllComponents(DatetimeComponent)[1]
    expect(startDateComponent.exists()).toBeTruthy()
    expect(endDateComponent.exists()).toBeTruthy()

    // Simulate user interactions:
    // 1. First, update the end date through its date picker
    // This sometimes triggers timezone conversion issues
    endDateComponent.vm.onDateUpdate('2025-05-14')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // 2. Then update the start date through its date picker
    // This is where the day shift bug might appear
    startDateComponent.vm.onDateUpdate('2025-05-14')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Get a reference to the RecurrenceComponent and check its state
    const recurrenceComponent = wrapper.findComponent(RecurrenceComponent)
    expect(recurrenceComponent.exists()).toBeTruthy()

    // Print detailed debug info about the dates and timezone conversions
    console.log('EventFormBasicComponent eventData after date selection:', {
      startDate: wrapper.vm.eventData.startDate,
      endDate: wrapper.vm.eventData.endDate,
      timeZone: wrapper.vm.eventData.timeZone
    })

    // Extract date components for human readability
    const startDateObj = new Date(wrapper.vm.eventData.startDate)
    console.log('Start date components:', {
      iso: startDateObj.toISOString(),
      date: startDateObj.getUTCDate(),
      dayOfWeek: startDateObj.getUTCDay(), // 0-6, where 0 is Sunday
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDateObj.getUTCDay()]
    })

    // Check RecurrenceComponent's selected day - this is where the bug would appear
    if (recurrenceComponent.vm.selectedDays) {
      console.log('RecurrenceComponent selectedDays after date selection:', recurrenceComponent.vm.selectedDays)

      // BUG TEST: Should still be Wednesday (WE) but might be Tuesday (TU) if bug is present
      expect(recurrenceComponent.vm.selectedDays[0]).toBe('WE')
    }

    if (recurrenceComponent.vm.monthlyWeekday) {
      console.log('RecurrenceComponent monthlyWeekday after date selection:', recurrenceComponent.vm.monthlyWeekday)

      // BUG TEST: Should still be Wednesday (WE) but might be wrong if bug is present
      expect(recurrenceComponent.vm.monthlyWeekday).toBe('WE')
    }
  })

  // Test the DatetimeComponent's behavior with day selection
  it('should preserve the exact day when selected in DatetimeComponent', async () => {
    // Mount the DatetimeComponent with a specific date
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2025-05-14T14:00:00.000Z', // May 14, 2025 at 2:00 PM
        timeZone: 'America/New_York', // EDT (-4:00)
        label: 'Test Date'
      }
    })

    // Verify the initial day is May 14
    const dateObj = new Date(wrapper.props('modelValue'))
    expect(dateObj.getUTCDate()).toBe(14)

    // Simulate selecting the same date in the date picker
    wrapper.vm.onDateUpdate('2025-05-14')
    await wrapper.vm.$nextTick()

    // Get the emitted value
    const emitted = wrapper.emitted('update:model-value')
    expect(emitted).toBeTruthy()
    expect(emitted!.length).toBeGreaterThan(0)

    // Get the latest emitted value
    const newDateValue = emitted![emitted!.length - 1][0]
    const newDateObj = new Date(newDateValue)

    // Log for debugging
    console.log('Original date:', dateObj.toISOString())
    console.log('Emitted date:', newDateObj.toISOString())
    console.log('Original day:', dateObj.getUTCDate())
    console.log('Emitted day:', newDateObj.getUTCDate())

    // TEST: The day should not shift due to timezone conversion
    expect(newDateObj.getUTCDate()).toBe(14)
  })

  // Test the RecurrenceComponent's day of week calculation
  it('should use the correct day of week based on the ISO date', async () => {
    // May 14, 2025 is a Wednesday, so it should use WE as the week day
    const date = '2025-05-14T14:00:00.000Z'
    const dateObj = new Date(date)

    // Verify our test date is actually a Wednesday (3)
    expect(dateObj.getDay()).toBe(3)

    // Mount the RecurrenceComponent with the test date
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: date,
        timeZone: 'America/New_York',
        hideToggle: true
      }
    })

    await wrapper.vm.$nextTick()

    // Give the component time to process
    await vi.runAllTimersAsync()

    // The RecurrenceComponent should have selected Wednesday (WE)
    // Check the internal state - this is testing implementation details,
    // but it's necessary to diagnose the specific bug
    expect(wrapper.vm.selectedDays).toContain('WE')

    // Log the component's internal state for debugging
    console.log('RecurrenceComponent selected days:', wrapper.vm.selectedDays)
    console.log('RecurrenceComponent weekday:', wrapper.vm.monthlyWeekday)
    console.log('RecurrenceComponent position:', wrapper.vm.monthlyPosition)
  })

  // Test the specific bug reported where the day shifts and the pattern shows the wrong day of week
  it('should show the correct day of week in pattern when a date is selected', async () => {
    // Mount the parent component that integrates both DatetimeComponent and RecurrenceComponent
    const wrapper = mount(EventFormBasicComponent, {
      global: {
        stubs: {
          'q-markdown': true, // Stub complex components
          'vue-router': true
        }
      }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Get a reference to the DatetimeComponent
    const datetimeComponent = wrapper.findComponent(DatetimeComponent)
    expect(datetimeComponent.exists()).toBeTruthy()

    // Set initial date - May 14, 2025 (a Wednesday)
    const testDate = '2025-05-14T14:00:00.000Z'
    wrapper.vm.eventData.startDate = testDate
    await wrapper.vm.$nextTick()

    // Enable recurrence
    wrapper.vm.isRecurring = true
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Get a reference to the RecurrenceComponent
    const recurrenceComponent = wrapper.findComponent(RecurrenceComponent)
    expect(recurrenceComponent.exists()).toBeTruthy()

    // Verify the RecurrenceComponent's selected day of week
    // This is the critical test - the selected day should be Wednesday (WE)
    // since May 14, 2025 is a Wednesday
    console.log('EventFormBasicComponent startDate:', wrapper.vm.eventData.startDate)

    // If we can access the RecurrenceComponent's internal state
    if (recurrenceComponent.vm.selectedDays) {
      console.log('RecurrenceComponent selectedDays:', recurrenceComponent.vm.selectedDays)

      // BUG REPRODUCTION TEST:
      // In the buggy version, this might show 'TU' (Tuesday) instead of 'WE' (Wednesday)
      // due to timezone conversion issues between the components
      expect(recurrenceComponent.vm.selectedDays[0]).toBe('WE')
    }

    // Verify the RecurrenceComponent is showing the correct monthly pattern for a Wednesday
    if (recurrenceComponent.vm.monthlyWeekday) {
      expect(recurrenceComponent.vm.monthlyWeekday).toBe('WE')
    }
  })

  // Test a more extreme timezone case that might trigger the day shift bug
  it('should maintain the correct day of week when using different timezones', async () => {
    // Mount just the DatetimeComponent with a specific timezone
    const datetimeWrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2025-05-14T22:00:00.000Z', // May 14, 2025 at 10:00 PM UTC
        timeZone: 'Pacific/Honolulu', // UTC-10:00, this is 12:00 PM in Hawaii
        label: 'Test Date'
      }
    })

    await datetimeWrapper.vm.$nextTick()

    // Now simulate the date selection that might trigger the bug
    datetimeWrapper.vm.onDateUpdate('2025-05-14')
    await datetimeWrapper.vm.$nextTick()

    // Get the emitted date value
    const emitted = datetimeWrapper.emitted('update:model-value')
    expect(emitted).toBeTruthy()
    const emittedDate = emitted![emitted!.length - 1][0]

    // Now create a RecurrenceComponent with the emitted date
    const recurrenceWrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: emittedDate,
        timeZone: 'Pacific/Honolulu', // Same timezone
        hideToggle: true
      }
    })

    await recurrenceWrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Log the dates and the day of week for debugging
    const emittedObj = new Date(emittedDate)
    console.log('Emitted date UTC:', emittedDate)
    console.log('Emitted date local:', emittedObj.toString())
    console.log('Emitted day of week:', emittedObj.getDay()) // Should be 3 for Wednesday
    console.log('Recurrence selected days:', recurrenceWrapper.vm.selectedDays)
    console.log('Recurrence monthlyWeekday:', recurrenceWrapper.vm.monthlyWeekday)

    // CRITICAL TEST: Verify the day is still a Wednesday (WE)
    // This is where the bug would manifest - if the RecurrenceComponent
    // misinterprets the date due to timezone issues
    expect(recurrenceWrapper.vm.selectedDays).toContain('WE')
    expect(recurrenceWrapper.vm.monthlyWeekday).toBe('WE')
  })

  // Test the specific bug where selecting a date in the picker
  // might return a different date with an offset
  it('should not change the selected date when using the date picker', async () => {
    // Create a controlled test setup with an initial date
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2025-05-14T12:00:00.000Z', // May 14, 2025 at noon UTC
        timeZone: 'Asia/Tokyo', // UTC+9, where the date might be May 15
        label: 'Test Date'
      }
    })

    await wrapper.vm.$nextTick()

    // Verify the initial properties
    const dateObj = new Date(wrapper.props('modelValue'))
    const initialDay = dateObj.getUTCDate()
    expect(initialDay).toBe(14)

    // Simulate selecting May 14, 2025 in the date picker
    wrapper.vm.onDateUpdate('2025-05-14')
    await wrapper.vm.$nextTick()

    // Check if the emitted date has the same day as the selected date
    const emitted = wrapper.emitted('update:model-value')
    expect(emitted).toBeTruthy()

    const newDateValue = emitted![emitted!.length - 1][0]
    const newDateObj = new Date(newDateValue)

    // Debug output to see what's happening
    console.log('Initial date:', wrapper.props('modelValue'))
    console.log('Selected date in picker:', '2025-05-14')
    console.log('Emitted date:', newDateValue)
    console.log('Initial day:', initialDay)
    console.log('Emitted day:', newDateObj.getUTCDate())

    // BUG TEST: The emitted date should still be May 14, not shifted to another day
    // In the buggy version, this might be 15 instead of 14
    expect(newDateObj.getUTCDate()).toBe(14)
  })

  // This test specifically tries to reproduce the day shift bug with extreme timezone case
  it('should reproduce the day shift bug with extreme timezone differences', async () => {
    // First, create a test with the timezone at the date line (UTC+12)
    // This is where we're most likely to see date shifts
    const wrapper = mount(DatetimeComponent, {
      props: {
        // Start with May 14, 2025 close to midnight UTC
        modelValue: '2025-05-14T23:30:00.000Z',
        // Use Pacific/Auckland (UTC+12) - this will be May 15 locally
        timeZone: 'Pacific/Auckland',
        label: 'Test Date'
      }
    })

    await wrapper.vm.$nextTick()

    // Verify initial date object
    const initialDateObj = new Date(wrapper.props('modelValue'))
    console.log('Initial UTC date:', wrapper.props('modelValue'))
    console.log('Initial local date in Auckland:', new Date(initialDateObj.getTime()).toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }))

    // First, get the tempDate value to see what's displayed in the picker
    console.log('Date picker value (tempDate):', wrapper.vm.tempDate)

    // Now explicitly set the date in the picker to May 14
    // This is the critical test - we select May 14 in the picker, but the date might shift
    wrapper.vm.onDateUpdate('2025-05-14')
    await wrapper.vm.$nextTick()

    // Check what was emitted
    const emitted = wrapper.emitted('update:model-value')
    expect(emitted).toBeTruthy()
    const emittedValue = emitted![emitted!.length - 1][0]
    const emittedDateObj = new Date(emittedValue)

    // Debug output - the most critical part for identifying the bug
    console.log('Selected date in picker:', '2025-05-14')
    console.log('Emitted date after selection:', emittedValue)
    console.log('Emitted date day of month (UTC):', emittedDateObj.getUTCDate())
    console.log('Emitted day of week (UTC):', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][emittedDateObj.getUTCDay()])

    // Expected behavior: The emitted date should be May 14, regardless of timezone
    // In the buggy case, it might be May 13 or 15 depending on how the conversion works

    // This assertion might fail if the bug is present - that's what we want to see
    // If it passes, we haven't reproduced the specific bug condition
    expect(emittedDateObj.getUTCDate()).toBe(14)

    // Now create a RecurrenceComponent with this date to see how it interprets the day of week
    const recurrenceWrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: emittedValue,
        timeZone: 'Pacific/Auckland',
        hideToggle: true
      }
    })

    await recurrenceWrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Check what day of week the RecurrenceComponent selected
    console.log('RecurrenceComponent selected days:', recurrenceWrapper.vm.selectedDays)
    console.log('RecurrenceComponent monthlyWeekday:', recurrenceWrapper.vm.monthlyWeekday)

    // May 14, 2025 is a Wednesday, so it should be 'WE'
    // If we see 'TU' or 'TH' instead, then we've reproduced the bug!
    expect(recurrenceWrapper.vm.selectedDays).toContain('WE')
  })

  // This test verifies that the start date doesn't change when changing the recurrence day
  it('should not change the start date when changing the recurrence day', async () => {
    // Mount the RecurrenceComponent directly
    const startDate = '2025-05-14T14:00:00.000Z' // May 14, 2025 (Wednesday)

    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate,
        timeZone: 'America/New_York',
        hideToggle: true
      }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Store the initial props for comparison
    const initialProps = { ...wrapper.props() }
    console.log('Initial props:', initialProps)

    // Verify the initial selected day is Wednesday (WE)
    expect(wrapper.vm.selectedDays).toContain('WE')

    // Spy on the emit method to capture emitted events
    const emitSpy = vi.spyOn(wrapper.vm, '$emit')

    // Note: Direct method call because it's difficult to trigger through UI in a unit test
    // turn on thursday, and off wednesday
    wrapper.vm.toggleDay('TH')
    wrapper.vm.toggleDay('WE')

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    expect(wrapper.vm.selectedDays).toContain('TH')
    expect(wrapper.vm.selectedDays).not.toContain('WE')

    console.log('Selected days after toggle:', wrapper.vm.selectedDays)

    // CURRENT BEHAVIOR TEST
    // In the current implementation, this would emit a start-date update
    // Check if an 'update:start-date' event was emitted - this is what we want to change
    const startDateEvents = emitSpy.mock.calls
      .filter(call => call[0] === 'update:start-date')
      .map(call => call[1])

    console.log('Start date emit events:', startDateEvents)

    // In our desired new behavior, it SHOULD NOT emit a start date update
    // Currently this assertion would fail
    expect(startDateEvents.length).toBe(0)

    // The original start date should remain unchanged
    expect(wrapper.props('startDate')).toBe(startDate)
  })
})
