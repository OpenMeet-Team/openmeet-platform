import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'
import { format, parseISO } from 'date-fns'

describe('RecurrenceComponent - Timezone Day Shift Bug', () => {
  // Declare wrapper with proper type information
  let wrapper: VueWrapper<any>

  // Create component with specific test parameters
  const createComponent = (props = {}) => {
    return mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        startDate: '2025-05-15T07:00:00.000Z', // 7am UTC (midnight PDT)
        timeZone: 'America/Vancouver',
        hideToggle: false,
        ...props
      },
      global: {
        plugins: [Quasar],
        // We need to stub Quasar components to avoid actual UI rendering
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

  // Helper to access component properties and methods with proper typing
  const vm = () => wrapper.vm as unknown as any

  beforeEach(() => {
    // Create a fresh component before each test
    wrapper = createComponent()
  })

  afterEach(() => {
    // Clean up after each test
    wrapper.unmount()
  })

  /**
   * This test directly demonstrates the timezone day shift bug by creating an event
   * on Thursday in Vancouver and showing that the occurrence dates may shift to Wednesday
   */
  it('should demonstrate the timezone day shift bug directly', () => {
    // Create a date that's explicitly Thursday in Vancouver
    // May 15, 2025 at 07:00:00 UTC is May 15, 2025 at 00:00:00 Vancouver time (Thursday)
    const utcDate = new Date('2025-05-15T07:00:00.000Z')

    // Verify this is correctly Thursday in Vancouver
    const dayInVancouver = formatInTimeZone(utcDate, 'America/Vancouver', 'EEEE')
    console.log('Test dates:', {
      utcDate: utcDate.toISOString(),
      utcDay: format(utcDate, 'EEEE'),
      dayInVancouver
    })

    // Verify it's Thursday in Vancouver
    expect(dayInVancouver).toBe('Thursday')

    // Create an event with a weekly recurrence rule set to Thursday
    const event = {
      name: 'Test Event',
      startDate: utcDate.toISOString(),
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['TH'] // Thursday
      },
      timeZone: 'America/Vancouver'
    }

    // Now we need to check what day the occurrences are actually on
    // Log the raw date for debugging
    console.log('RRule start date:', {
      date: utcDate.toISOString(),
      day: utcDate.getUTCDay(),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][utcDate.getUTCDay()]
    })

    // Create an RRule directly to demonstrate the issue
    const rrule = RecurrenceService.toRRule(
      event.recurrenceRule,
      event.startDate,
      event.timeZone
    )

    console.log('RRule string:', rrule.toString())

    // Get the first few occurrences
    const occurrences = rrule.all((_, i) => i < 3)
    console.log('Occurrences generated:', occurrences.map(d => d.toISOString()))

    // Check what day these occurrences are in Vancouver timezone
    const daysInVancouver = occurrences.map(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    console.log('Days of week in Vancouver:', daysInVancouver)

    // This will fail if the bug exists - all days should be Thursday
    // If the bug exists, some or all will be Wednesday
    const allThursdays = daysInVancouver.every(day => day === 'Thursday')
    expect(allThursdays).toBe(true)
  })

  /**
   * This test demonstrates the actual bug by using a date near midnight UTC
   * that will shift days when viewed in different timezones.
   */
  it('should demonstrate the day shift bug with a problematic date', () => {
    // Create a date that's Wednesday in UTC but Tuesday in Vancouver
    // Using May 14, 2025 at 23:30:00 UTC, which is May 14, 2025 at 16:30:00 Vancouver time (Wed in UTC, Wed in Vancouver)
    const utcDate = new Date('2025-05-14T23:30:00.000Z')

    // Verify the days in different timezones
    const dayInUTC = format(utcDate, 'EEEE')
    const dayInVancouver = formatInTimeZone(utcDate, 'America/Vancouver', 'EEEE')

    console.log('Test dates for problematic case:', {
      utcDate: utcDate.toISOString(),
      dayInUTC,
      dayInVancouver
    })

    // Both should be Wednesday
    expect(dayInUTC).toBe('Wednesday')
    expect(dayInVancouver).toBe('Wednesday')

    // Now, simulate what happens when a user selects Wednesday recurrence
    // but the day calculation is done incorrectly in UTC

    // Create an event with a weekly recurrence rule set to Wednesday (user's selection)
    const event = {
      name: 'Test Event',
      startDate: utcDate.toISOString(),
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['WE'] // Wednesday - what user selected
      },
      timeZone: 'America/Vancouver'
    }

    // Create an RRule to generate occurrences
    const rrule = RecurrenceService.toRRule(
      event.recurrenceRule,
      event.startDate,
      event.timeZone
    )

    console.log('Problematic RRule string:', rrule.toString())

    // Get the first few occurrences
    const occurrences = rrule.all((_, i) => i < 3)
    console.log('Problematic occurrences generated:', occurrences.map(d => d.toISOString()))

    // Check what day these occurrences are in Vancouver timezone
    const daysInVancouver = occurrences.map(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    console.log('Problematic days of week in Vancouver:', daysInVancouver)

    // All days should be Wednesday (what the user selected)
    const allWednesdays = daysInVancouver.every(day => day === 'Wednesday')
    expect(allWednesdays).toBe(true)
  })

  /**
   * This test demonstrates the day-shift bug when working right at timezone day boundaries
   * This is the actual case where the bug is most noticeable.
   */
  it('should demonstrate the cross-day timezone shift bug', () => {
    // Create a date that's Thursday in UTC but Wednesday in Vancouver
    // 2025-05-01T05:30:00.000Z is midnight + 30 min in Vancouver on April 30 (Wed night in Vancouver, Thu morning in UTC)
    const utcDate = new Date('2025-05-01T05:30:00.000Z')

    // Verify the day in different timezones - this shows the problem
    const dayInUTC = format(utcDate, 'EEEE')
    const dayInVancouver = formatInTimeZone(utcDate, 'America/Vancouver', 'EEEE')

    console.log('Cross-day timezone issue:', {
      utcDate: utcDate.toISOString(),
      dayInUTC, // Should be Thursday (May 1)
      dayInVancouver // Should be Wednesday (April 30)
    })

    // This is where the days differ! Thursday in UTC but Wednesday in Vancouver
    expect(dayInUTC).toBe('Thursday')
    expect(dayInVancouver).toBe('Wednesday')

    // Now, imagine a user in Vancouver creates a recurring event on "Wednesday"
    // If we just use the UTC date when creating the rule, it would set it to Thursday

    // 1. If user selects Wednesday in UI but backend sees Thursday in UTC
    const incorrectEvent = {
      name: 'Test Event',
      startDate: utcDate.toISOString(),
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['TH'] // WRONG! This would be incorrect - code thinks it's Thursday because of UTC
      },
      timeZone: 'America/Vancouver'
    }

    // Create an RRule with the incorrect day setting
    const incorrectRule = RecurrenceService.toRRule(
      incorrectEvent.recurrenceRule,
      incorrectEvent.startDate,
      incorrectEvent.timeZone
    )

    console.log('Incorrect RRule (day shift bug):', incorrectRule.toString())

    // Get occurrences with the incorrect rule
    const incorrectOccurrences = incorrectRule.all((_, i) => i < 3)

    // Format them in Vancouver timezone to see the day
    const incorrectDays = incorrectOccurrences.map(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )

    console.log('Incorrect occurrences (day shift bug):', {
      dates: incorrectOccurrences.map(d => d.toISOString()),
      daysInVancouver: incorrectDays
    })

    // BUG: These are all Thursday in Vancouver, but user selected Wednesday in UI!
    // This is the bug - the occurrences are on the wrong day because we didn't account for timezone

    // 2. The correct approach would be to use the day as seen in the user's timezone:
    const correctEvent = {
      name: 'Test Event',
      startDate: utcDate.toISOString(),
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['WE'] // CORRECT - this is Wednesday as seen by the user in Vancouver
      },
      timeZone: 'America/Vancouver'
    }

    // Create an RRule with the correct day
    const correctRule = RecurrenceService.toRRule(
      correctEvent.recurrenceRule,
      correctEvent.startDate,
      correctEvent.timeZone
    )

    console.log('Correct RRule (fixed):', correctRule.toString())

    // Get occurrences with the correct rule
    const correctOccurrences = correctRule.all((_, i) => i < 3)

    // Format them in Vancouver timezone to see the day
    const correctDays = correctOccurrences.map(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )

    console.log('Correct occurrences (fixed):', {
      dates: correctOccurrences.map(d => d.toISOString()),
      daysInVancouver: correctDays
    })

    // These should all be Wednesday in Vancouver, which is what the user intended
    const allWednesdays = correctDays.every(day => day === 'Wednesday')
    expect(allWednesdays).toBe(true)
  })

  /**
   * This test checks if the day in Vancouver timezone matches the selected recurrence day
   */
  it('should verify that weekly recurrence stays on the correct day in Vancouver timezone', async () => {
    // Re-create component with Thursday as the start date (in Vancouver time)
    const utcDate = new Date('2025-05-15T07:00:00.000Z') // Midnight Vancouver (Thursday)

    wrapper = createComponent({
      startDate: utcDate.toISOString(),
      timeZone: 'America/Vancouver'
    })

    // Need to wait for component to initialize
    await nextTick()

    // Set weekly recurrence on Thursday
    wrapper.vm.frequency = 'WEEKLY'
    wrapper.vm.selectedDays = ['TH'] // Set Thursday as the selected day

    // Wait for reactivity updates
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 500)) // Extra wait for async processing

    // Log what we're seeing
    console.log('Component timezone:', wrapper.props('timeZone'))
    console.log('Frequency set to:', wrapper.vm.frequency)
    console.log('Selected days set to:', wrapper.vm.selectedDays)

    // Get the generated rule
    const rule = wrapper.vm.rule
    console.log('Generated rule:', rule)

    // Create an event with this rule
    const event = {
      name: 'Test Event',
      startDate: utcDate.toISOString(),
      recurrenceRule: rule,
      timeZone: 'America/Vancouver'
    }

    // Create an RRule directly to check the actual occurrences
    const rrule = RecurrenceService.toRRule(
      event.recurrenceRule,
      event.startDate,
      event.timeZone
    )

    console.log('RRule string:', rrule.toString())

    // Get the first few occurrences
    const occurrences = rrule.all((_, i) => i < 3)
    console.log('Occurrences generated:', occurrences.map(d => d.toISOString()))

    // Check what day these occurrences are in Vancouver timezone
    const daysInVancouver = occurrences.map(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    console.log('Days of week in Vancouver:', daysInVancouver)

    // This will fail if the bug exists - all days should be Thursday since that's what was selected
    // If the bug exists, some or all will be Wednesday
    const allThursdays = daysInVancouver.every(day => day === 'Thursday')
    expect(allThursdays).toBe(true)
  })
})
