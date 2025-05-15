import { describe, it, expect, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'

describe('RecurrenceComponent - Australia Timezone Tests', () => {
  // Declare wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapper: VueWrapper<any>

  // Cleanup after each test
  afterEach(() => {
    wrapper?.unmount()
  })

  /**
   * Test for Australia/Sydney timezone which has different DST behavior
   */
  it('should show correct pattern for Wednesday 5pm in Australia/Sydney', async () => {
    // Create component with Sydney timezone
    // In May 2025, Sydney is UTC+10 (AEST)
    // So 5:00 PM AEST on Wednesday May 14, 2025 is equivalent to 07:00 UTC on May 14, 2025
    wrapper = mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        startDate: '2025-05-14T07:00:00.000Z', // Wed 5pm AEST in UTC format
        timeZone: 'Australia/Sydney',
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

    // First verify the start date day and time in Sydney
    const startDate = new Date('2025-05-14T07:00:00.000Z')
    const dayInSydney = formatInTimeZone(startDate, 'Australia/Sydney', 'EEEE')
    const timeInSydney = formatInTimeZone(startDate, 'Australia/Sydney', 'h:mm a')

    // Debug the timezone conversion in detail
    console.log('TIMEZONE DEBUG - Start date conversion (Sydney):', {
      utcDate: startDate.toISOString(),
      inSydney: formatInTimeZone(startDate, 'Australia/Sydney', 'yyyy-MM-dd HH:mm:ss (EEEE)'),
      expectedTimeInSydney: timeInSydney,
      expectedDayInSydney: dayInSydney
    })

    console.log('Start date info (Sydney):', {
      utcDate: startDate.toISOString(),
      utcDay: startDate.getUTCDay(),
      utcDayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDate.getUTCDay()],
      dayInSydney,
      timeInSydney
    })

    // Confirm it's Wednesday at 5pm in Sydney
    expect(dayInSydney).toBe('Wednesday')
    expect(timeInSydney).toBe('5:00 PM')

    // Set weekly recurrence
    await nextTick()

    // Verify Wednesday is automatically selected based on the start date
    console.log('Selected days (Sydney):', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('WE')

    // Wait for pattern and occurrences to be calculated
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the pattern description
    const pattern = wrapper.vm.humanReadablePattern
    console.log('Recurrence pattern (Sydney):', pattern)

    // Verify pattern shows weekly on Wednesday
    expect(pattern.toLowerCase()).toContain('week')
    expect(pattern.toLowerCase()).toContain('wednesday')

    // Get the occurrence dates
    const occurrences = wrapper.vm.occurrences

    // Log the occurrences
    console.log('Occurrences from component (Sydney):', occurrences.map(date => ({
      date: date.toISOString(),
      formatted: wrapper.vm.formatDate(date),
      dayInSydney: formatInTimeZone(date, 'Australia/Sydney', 'EEEE'),
      timeInSydney: formatInTimeZone(date, 'Australia/Sydney', 'h:mm a')
    })))

    // Verify all occurrences are on Wednesday in Sydney
    const allWednesdays = occurrences.every(date =>
      formatInTimeZone(date, 'Australia/Sydney', 'EEEE') === 'Wednesday'
    )

    expect(allWednesdays).toBe(true)

    // Verify the time of each occurrence matches the original start time (5:00 PM) in Sydney
    const allAtCorrectTime = occurrences.every(date => {
      // Get the actual time in Sydney for this occurrence
      const actualTimeInSydney = formatInTimeZone(date, 'Australia/Sydney', 'h:mm a')
      console.log(`Time check for ${date.toISOString()}: ${actualTimeInSydney} vs expected ${timeInSydney}`)
      return actualTimeInSydney === timeInSydney
    })

    expect(allAtCorrectTime).toBe(true)
  })
})
