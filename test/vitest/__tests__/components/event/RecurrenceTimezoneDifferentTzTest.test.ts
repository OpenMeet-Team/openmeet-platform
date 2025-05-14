import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'

describe('RecurrenceComponent - Different Timezone Day Shift', () => {
  // Declare wrapper
  let wrapper: VueWrapper<any>

  // Create component with specific test parameters
  const createComponent = (props = {}) => {
    return mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        // Default values will be overridden in test
        startDate: '2025-05-15T00:00:00.000Z',
        timeZone: 'Asia/Tokyo',
        hideToggle: false,
        ...props
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
  }

  beforeEach(() => {
    // Component will be created in each test with specific params
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  /**
   * Test with Tokyo timezone (UTC+9)
   * This test should show the normal case working correctly
   */
  it('should generate occurrences on the correct day of week in Tokyo timezone', async () => {
    // Using Tokyo timezone (UTC+9), 3pm on Monday May 12, 2025
    // This is a normal case without timezone boundary issues
    wrapper = createComponent({
      startDate: '2025-05-12T06:00:00.000Z', // 3pm Tokyo time on Monday
      timeZone: 'Asia/Tokyo'
    })

    // Verify the start date is Monday in Tokyo
    const startDate = new Date('2025-05-12T06:00:00.000Z')
    const dayInTokyo = formatInTimeZone(startDate, 'Asia/Tokyo', 'EEEE')
    const dayInUTC = startDate.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })

    console.log('Tokyo test - Start date info:', {
      utcDate: startDate.toISOString(),
      dayInUTC,
      dayInTokyo
    })

    // Confirm it's Monday in Tokyo
    expect(dayInTokyo).toBe('Monday')

    // Wait for component to initialize
    await nextTick()

    // Verify Monday is automatically selected
    console.log('Tokyo test - Selected days:', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('MO')

    // Wait for pattern and occurrences to be calculated
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the occurrence dates
    const occurrences = wrapper.vm.occurrences

    // Log the occurrences as displayed to user
    console.log('Tokyo test - Occurrences:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInTokyo: formatInTimeZone(date, 'Asia/Tokyo', 'EEEE')
    })))

    // Verify all occurrences are on Monday in Tokyo
    const allMondays = occurrences.every(date =>
      formatInTimeZone(date, 'Asia/Tokyo', 'EEEE') === 'Monday'
    )

    expect(allMondays).toBe(true)
  })

  /**
   * Test with Sydney timezone (UTC+10) at a timezone boundary
   * This test specifically checks the bug case where a date is Sunday in UTC
   * but Monday in Sydney (Australia)
   */
  it('should correctly handle timezone boundary between UTC Sunday and Sydney Monday', async () => {
    // Creating a date that's Sunday evening in UTC but Monday morning in Sydney
    // May 18, 2025 at 22:30:00 UTC is May 19, 2025 at 08:30:00 in Sydney
    wrapper = createComponent({
      startDate: '2025-05-18T22:30:00.000Z',
      timeZone: 'Australia/Sydney'
    })

    // Wait for component to initialize
    await nextTick()

    // Check what day it is in Sydney vs UTC
    const startDate = new Date('2025-05-18T22:30:00.000Z')
    const dayInUTC = startDate.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const dayInSydney = formatInTimeZone(startDate, 'Australia/Sydney', 'EEEE')

    console.log('Sydney boundary case:', {
      utcDate: startDate.toISOString(),
      dayInUTC,
      dayInSydney
    })

    // We expect these to be different - Sunday in UTC, Monday in Sydney
    expect(dayInUTC).toBe('Sunday')
    expect(dayInSydney).toBe('Monday')

    // Check what day is selected by default
    console.log('Sydney test - Selected days:', wrapper.vm.selectedDays)

    // We expect Monday to be selected since that's the day in Sydney
    expect(wrapper.vm.selectedDays).toContain('MO')

    // Wait for pattern and occurrences to be calculated
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check the occurrence dates
    const occurrences = wrapper.vm.occurrences

    console.log('Sydney boundary case occurrences:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInSydney: formatInTimeZone(date, 'Australia/Sydney', 'EEEE')
    })))

    // Verify all occurrences are on Monday in Sydney
    const allMondays = occurrences.every(date =>
      formatInTimeZone(date, 'Australia/Sydney', 'EEEE') === 'Monday'
    )

    // This should fail if the bug exists
    expect(allMondays).toBe(true)

    // Now let's also check directly with the RecurrenceService.toRRule method to confirm where the bug is
    const rule = wrapper.vm.rule
    console.log('Rule for RecurrenceService test:', rule)

    const rrule = RecurrenceService.toRRule(
      rule,
      startDate.toISOString(),
      'Australia/Sydney'
    )

    console.log('Direct RRule string:', rrule.toString())

    // Get the first 3 occurrences
    const directOccurrences = rrule.all((_, i) => i < 3)

    // Check what day these occurrences are in Sydney timezone
    const daysInSydney = directOccurrences.map(date =>
      formatInTimeZone(date, 'Australia/Sydney', 'EEEE')
    )

    console.log('Direct generated occurrences:', {
      dates: directOccurrences.map(d => d.toISOString()),
      daysInSydney
    })

    // This should show if the bug is in the component or in RecurrenceService.toRRule
    const allDirectMondays = daysInSydney.every(day => day === 'Monday')
    expect(allDirectMondays).toBe(true)
  })
})