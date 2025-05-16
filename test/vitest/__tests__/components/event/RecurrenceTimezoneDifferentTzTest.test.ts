import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'
import { RecurrenceComponentTestHelper } from '../../../helpers/RecurrenceComponentTestHelper'

describe('RecurrenceComponent - Different Timezone Day Shift', () => {
  // Declare wrapper and test helper
  let wrapper: VueWrapper
  let helper: RecurrenceComponentTestHelper

  // Create component with specific test parameters
  const createComponent = (props = {}) => {
    wrapper = mount(RecurrenceComponent, {
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
    
    // Create test helper with the mounted wrapper
    helper = new RecurrenceComponentTestHelper(wrapper)
    
    return { wrapper, helper }
  }

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
    const { helper } = createComponent({
      startDate: '2025-05-12T06:00:00.000Z', // 3pm Tokyo time on Monday
      timeZone: 'Asia/Tokyo'
    })

    // Wait for component initialization
    await helper.waitForProcessing()

    // Verify the start date is Monday in Tokyo
    const startDate = new Date('2025-05-12T06:00:00.000Z')
    const dayInTokyo = formatInTimeZone(startDate, 'Asia/Tokyo', 'EEEE')
    expect(dayInTokyo).toBe('Monday')

    // Verify Monday is automatically selected
    expect(helper.getSelectedDays()).toContain('MO')

    // Verify frequency is set to weekly by default
    expect(helper.getFrequency()).toBe('WEEKLY')

    // Wait for pattern and occurrences to be calculated
    await helper.waitForProcessing()

    // Get the occurrence dates
    const occurrences = helper.getOccurrences()

    // Verify all occurrences are on Monday in Tokyo
    const allMondays = occurrences.every(date =>
      formatInTimeZone(date, 'Asia/Tokyo', 'EEEE') === 'Monday'
    )

    expect(allMondays).toBe(true)
    
    // Or use the helper method to check days
    expect(helper.occurrencesMatchDay('Monday', 'Asia/Tokyo')).toBe(true)

    // Log component state for debugging
    helper.logComponentState()
  })

  /**
   * Test with Sydney timezone (UTC+10) at a timezone boundary
   * This test specifically checks the bug case where a date is Sunday in UTC
   * but Monday in Sydney (Australia)
   */
  it('should correctly handle timezone boundary between UTC Sunday and Sydney Monday', async () => {
    // Creating a date that's Sunday evening in UTC but Monday morning in Sydney
    // May 18, 2025 at 22:30:00 UTC is May 19, 2025 at 08:30:00 in Sydney
    const { helper } = createComponent({
      startDate: '2025-05-18T22:30:00.000Z',
      timeZone: 'Australia/Sydney'
    })

    // Wait for component to initialize
    await helper.waitForProcessing()

    // Check what day it is in Sydney vs UTC
    const startDate = new Date('2025-05-18T22:30:00.000Z')
    const dayInUTC = startDate.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const dayInSydney = formatInTimeZone(startDate, 'Australia/Sydney', 'EEEE')

    // We expect these to be different - Sunday in UTC, Monday in Sydney
    expect(dayInUTC).toBe('Sunday')
    expect(dayInSydney).toBe('Monday')

    // Check what day is selected by default
    console.log('Selected days:', helper.getSelectedDays())

    // We expect Monday to be selected since that's the day in Sydney
    expect(helper.getSelectedDays()).toContain('MO')

    // Wait for pattern and occurrences to be calculated
    await helper.waitForProcessing()

    // Verify all occurrences are on Monday in Sydney
    expect(helper.occurrencesMatchDay('Monday', 'Australia/Sydney')).toBe(true)

    // Now let's also check directly with the RecurrenceService.toRRule method
    const rule = helper.getRule()
    console.log('Rule for RecurrenceService test:', rule)

    // Create a valid rule manually since the component's rule might be undefined during testing
    const testRule = {
      frequency: 'WEEKLY',
      byweekday: ['MO'],
      timeZone: 'Australia/Sydney' // Now including timezone in rule
    }
    console.log('Using test rule:', testRule)
    
    const rrule = RecurrenceService.toRRule(
      testRule,
      startDate.toISOString()
    )

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