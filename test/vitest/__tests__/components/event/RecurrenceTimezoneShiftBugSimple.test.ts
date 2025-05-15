import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'

describe('RecurrenceComponent - Timezone Day Shift Bug (Simple Test)', () => {
  // Declare wrapper with proper type information
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapper: VueWrapper<any>

  // Create component with specific test parameters
  const createComponent = (props = {}) => {
    return mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        startDate: '2025-05-15T17:00:00.000Z', // 5pm Vancouver time on May 15, 2025
        endDate: '2025-05-15T18:00:00.000Z', // 6pm Vancouver time (1 hour later)
        timeZone: 'America/Vancouver',
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
    // Create a fresh component before each test
    wrapper = createComponent()
  })

  afterEach(() => {
    // Clean up after each test
    wrapper.unmount()
  })

  /**
   * This test demonstrates the timezone day shift bug with the simplest possible test case:
   * - Vancouver timezone
   * - Event on Thursday, May 15, 2025 at 5pm Vancouver time
   * - Weekly recurrence
   * - Check if the selected day (Thursday) matches the actual occurrences
   */
  it('should generate recurrences on the correct day of week (Thursday) for Vancouver timezone', async () => {
    // Verify the start date is Thursday in Vancouver
    const startDate = new Date('2025-05-15T17:00:00.000Z')
    const dayInVancouver = formatInTimeZone(startDate, 'America/Vancouver', 'EEEE')

    console.log('Test start date:', {
      utcDate: startDate.toISOString(),
      dayInVancouver
    })

    // Confirm it's Thursday in Vancouver
    expect(dayInVancouver).toBe('Thursday')

    // Set weekly recurrence
    await nextTick()
    wrapper.vm.frequency = 'WEEKLY'

    // Wait for reactivity updates
    await nextTick()

    // Verify Thursday is automatically selected (this should happen automatically based on the start date)
    console.log('Selected days:', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('TH')

    // Get the generated recurrence rule
    const rule = wrapper.vm.rule
    console.log('Generated recurrence rule:', rule)

    // Use the RecurrenceService to generate actual occurrences
    const rrule = RecurrenceService.toRRule(
      rule,
      startDate.toISOString(),
      'America/Vancouver'
    )

    console.log('RRule string:', rrule.toString())

    // Get the first 3 occurrences
    const occurrences = rrule.all((_, i) => i < 3)

    // Check what day these occurrences are in Vancouver timezone
    const daysInVancouver = occurrences.map(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )

    console.log('Generated occurrences:', {
      dates: occurrences.map(d => d.toISOString()),
      daysInVancouver
    })

    // This should pass if the bug is fixed - all occurrences should be on Thursday
    const allThursdays = daysInVancouver.every(day => day === 'Thursday')
    expect(allThursdays).toBe(true)
  })
})
