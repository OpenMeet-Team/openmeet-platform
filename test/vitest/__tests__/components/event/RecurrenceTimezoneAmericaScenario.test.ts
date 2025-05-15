import { describe, it, expect, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'

describe('RecurrenceComponent - PDT/EDT Timezone Tests', () => {
  // Declare wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapper: VueWrapper<any>

  // Cleanup after each test
  afterEach(() => {
    wrapper?.unmount()
  })

  /**
   * Test for scenario where user creates an event for Wed May 14, 2025 5pm PDT
   * but sees pattern for Tuesday
   */
  it('should show correct pattern for Wednesday 5pm in America/Los_Angeles', async () => {
    // Create component with Los Angeles timezone (PDT in May) on Wednesday
    // Important: In May 2025, Los Angeles is UTC-7 (PDT)
    // So 5:00 PM PDT on Wednesday May 14, 2025 is equivalent to midnight UTC on May 15, 2025
    wrapper = mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        // Use UTC timestamp format (like the NY test):
        // America/Los_Angeles in May is UTC-7, so 5:00 PM PDT = 00:00 UTC (midnight the next day)
        startDate: '2025-05-15T00:00:00.000Z', // Wed 5pm PDT in UTC format
        timeZone: 'America/Los_Angeles',
        hideToggle: false
      },
      global: {
        plugins: [Quasar],
        stubs: {
          'q-select': true,
          'q-radio': true,
          'q-checkbox': true,
          'q-input': true,
          'q-btn': true,
          'q-list': true,
          'q-item': true,
          'q-item-section': true,
          'q-item-label': true,
          'q-separator': true,
          'q-skeleton': true,
          'q-icon': true,
          'q-popup-proxy': true,
          'q-date': true
        }
      },
      attachTo: document.createElement('div')
    })

    // First verify the start date day and time in Los Angeles
    // Use the exact same string we passed to the component for consistency
    const startDate = new Date('2025-05-15T00:00:00.000Z')
    const dayInLA = formatInTimeZone(startDate, 'America/Los_Angeles', 'EEEE')
    const timeInLA = formatInTimeZone(startDate, 'America/Los_Angeles', 'h:mm a')

    // Debug the timezone conversion in detail
    console.log('TIMEZONE DEBUG - Start date conversion:', {
      utcDate: startDate.toISOString(),
      inLosAngeles: formatInTimeZone(startDate, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm:ss (EEEE)'),
      expectedTimeInLA: timeInLA,
      expectedDayInLA: dayInLA
    })

    console.log('Start date info:', {
      utcDate: startDate.toISOString(),
      utcDay: startDate.getUTCDay(),
      utcDayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDate.getUTCDay()],
      dayInLA,
      timeInLA
    })

    // Confirm it's Wednesday at 5pm in Los Angeles
    expect(dayInLA).toBe('Wednesday')
    expect(timeInLA).toBe('5:00 PM')

    // Set weekly recurrence
    await nextTick()

    // Verify Wednesday is automatically selected based on the start date
    console.log('Selected days:', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('WE')

    // Wait for pattern and occurrences to be calculated
    // Need additional time as the component debounces updates
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the pattern description
    const pattern = wrapper.vm.humanReadablePattern
    console.log('Recurrence pattern:', pattern)

    // Verify pattern shows weekly on Wednesday
    expect(pattern.toLowerCase()).toContain('week')
    expect(pattern.toLowerCase()).toContain('wednesday')

    // Get the occurrence dates
    const occurrences = wrapper.vm.occurrences

    // Log the occurrences as displayed to user with detailed timezone info
    console.log('Occurrences from component:')

    occurrences.forEach((date, index) => {
      // Analyze each occurrence in detail
      console.log(`Occurrence #${index + 1}:`, {
        utcDate: date.toISOString(),
        inComponentFormat: wrapper.vm.formatDate(date),
        inLosAngeles: formatInTimeZone(date, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm:ss (EEEE)'),
        dayInLA: formatInTimeZone(date, 'America/Los_Angeles', 'EEEE'),
        timeInLA: formatInTimeZone(date, 'America/Los_Angeles', 'h:mm a')
      })
    })

    console.log('Map format:', occurrences.map(date => ({
      date: date.toISOString(),
      formatted: wrapper.vm.formatDate(date),
      dayInLA: formatInTimeZone(date, 'America/Los_Angeles', 'EEEE'),
      timeInLA: formatInTimeZone(date, 'America/Los_Angeles', 'h:mm a')
    })))

    // Verify all occurrences are on Wednesday in LA
    const allWednesdays = occurrences.every(date =>
      formatInTimeZone(date, 'America/Los_Angeles', 'EEEE') === 'Wednesday'
    )

    expect(allWednesdays).toBe(true)

    // Verify the time of each occurrence matches the original start time (5:00 PM) in LA
    // Our component formats the date with timezone so this should preserve the time
    const allAtCorrectTime = occurrences.every(date => {
      // Get the actual time in LA for this occurrence
      const actualTimeInLA = formatInTimeZone(date, 'America/Los_Angeles', 'h:mm a')
      console.log(`Time check for ${date.toISOString()}: ${actualTimeInLA} vs expected ${timeInLA}`)
      return actualTimeInLA === timeInLA
    })

    expect(allAtCorrectTime).toBe(true)
  })

  /**
   * Similar test for East Coast time
   */
  it('should show correct pattern for Wednesday 5pm in America/New_York', async () => {
    // Create component with New York timezone (EDT in May) on Wednesday
    // Note: May 14, 2025 at 5pm EDT is May 14, 2025 at 21:00:00 UTC
    wrapper = mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        startDate: '2025-05-14T21:00:00.000Z', // Wed 5pm EDT / Wed 9pm UTC
        endDate: '2025-05-14T22:00:00.000Z', // Wed 6pm EDT / Wed 10pm UTC
        timeZone: 'America/New_York',
        hideToggle: false
      },
      global: {
        plugins: [Quasar],
        stubs: {
          'q-select': true,
          'q-radio': true,
          'q-checkbox': true,
          'q-input': true,
          'q-btn': true,
          'q-list': true,
          'q-item': true,
          'q-item-section': true,
          'q-item-label': true,
          'q-separator': true,
          'q-skeleton': true,
          'q-icon': true,
          'q-popup-proxy': true,
          'q-date': true
        }
      },
      attachTo: document.createElement('div')
    })

    // Verify the start date day in New York
    const startDate = new Date('2025-05-14T21:00:00.000Z')
    const dayInNY = formatInTimeZone(startDate, 'America/New_York', 'EEEE')
    const timeInNY = formatInTimeZone(startDate, 'America/New_York', 'h:mm a')

    // Debug the timezone conversion in detail
    console.log('TIMEZONE DEBUG - Start date conversion (NY):', {
      utcDate: startDate.toISOString(),
      inNewYork: formatInTimeZone(startDate, 'America/New_York', 'yyyy-MM-dd HH:mm:ss (EEEE)'),
      expectedTimeInNY: timeInNY,
      expectedDayInNY: dayInNY
    })

    console.log('Start date info (NY):', {
      utcDate: startDate.toISOString(),
      utcDay: startDate.getUTCDay(),
      utcDayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDate.getUTCDay()],
      dayInNY,
      timeInNY
    })

    // Confirm it's Wednesday at 5pm in New York
    expect(dayInNY).toBe('Wednesday')
    expect(timeInNY).toBe('5:00 PM')

    // Set weekly recurrence
    await nextTick()

    // Verify Wednesday is automatically selected
    console.log('Selected days (NY):', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('WE')

    // Wait for pattern and occurrences to be calculated
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the pattern description
    const pattern = wrapper.vm.humanReadablePattern
    console.log('Recurrence pattern (NY):', pattern)

    // Verify pattern shows weekly on Wednesday
    expect(pattern.toLowerCase()).toContain('week')
    expect(pattern.toLowerCase()).toContain('wednesday')

    // Get the occurrence dates
    const occurrences = wrapper.vm.occurrences

    // Log the occurrences
    console.log('Occurrences from component (NY):', occurrences.map(date => ({
      date: date.toISOString(),
      formatted: wrapper.vm.formatDate(date),
      dayInNY: formatInTimeZone(date, 'America/New_York', 'EEEE'),
      timeInNY: formatInTimeZone(date, 'America/New_York', 'h:mm a')
    })))

    // Verify all occurrences are on Wednesday in NY
    const allWednesdays = occurrences.every(date =>
      formatInTimeZone(date, 'America/New_York', 'EEEE') === 'Wednesday'
    )

    expect(allWednesdays).toBe(true)

    // Verify the time of each occurrence matches the original start time (5:00 PM) in NY
    // Our component formats the date with timezone so this should preserve the time
    const allAtCorrectTime = occurrences.every(date => {
      // Get the actual time in NY for this occurrence
      const actualTimeInNY = formatInTimeZone(date, 'America/New_York', 'h:mm a')
      console.log(`Time check for ${date.toISOString()}: ${actualTimeInNY} vs expected ${timeInNY}`)
      return actualTimeInNY === timeInNY
    })

    expect(allAtCorrectTime).toBe(true)
  })
})
