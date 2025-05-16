import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'
import { format } from 'date-fns'

/**
 * This test file specifically tests the ability for users to select different days
 * for weekly recurrence, regardless of the start date's day of week.
 * 
 * It ensures the recurrence system follows two key principles:
 * 1. Preserve wall-clock time in the originating timezone - All recurring instances
 *    maintain the same local time in the event's timezone.
 * 2. Day selection refers to days in the originating timezone - When a user selects
 *    "Thursday", this means Thursday in the event's timezone, regardless of what
 *    day that might be in UTC or other timezones.
 * 
 * The tests verify the recurrence system respects user day selections and doesn't
 * override them with the start date's day, especially across timezone boundaries.
 */
describe('RecurrenceComponent - Day Selection Tests', () => {
  // Declare wrapper with proper type information
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapper: VueWrapper<any>

  // Create component with specific test parameters
  const createComponent = (props = {}) => {
    return mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        // Default: Tuesday May 13, 2025 at 5pm UTC (10am Vancouver time)
        startDate: '2025-05-13T17:00:00.000Z',
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
    wrapper = createComponent()
  })

  afterEach(() => {
    wrapper.unmount()
  })

  /**
   * Test 1: Verify the component correctly pre-selects the day of the start date
   * in the user's timezone
   */
  it('should pre-select the day of week based on start date in specified timezone', async () => {
    // May 13, 2025 is a Tuesday in Vancouver
    const startDate = new Date('2025-05-13T17:00:00.000Z')
    const dayInVancouver = formatInTimeZone(startDate, 'America/Vancouver', 'EEEE')
    
    console.log('Start date info:', {
      utcDate: startDate.toISOString(),
      dayInVancouver
    })
    
    // Verify it's Tuesday in Vancouver
    expect(dayInVancouver).toBe('Tuesday')
    
    // Wait for component to initialize
    await nextTick()
    
    // Verify Tuesday is automatically selected
    console.log('Selected days:', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('TU')
  })

  /**
   * Test 2: Verify that when the user selects a different day than the start date's day,
   * the rule and occurrences respect that selection.
   * 
   * This demonstrates the principle: "Day selection refers to days in the originating timezone."
   * The user's selection of Friday overrides the default of Tuesday, and all occurrences
   * respect this selection in the event's timezone.
   */
  it('should respect user day selection different from start date day', async () => {
    // Wait for component to initialize with Tuesday pre-selected
    await nextTick()
    
    // Verify Tuesday is pre-selected by default
    expect(wrapper.vm.selectedDays).toContain('TU')
    
    // Change the selection to Friday
    wrapper.vm.selectedDays = ['FR']
    
    // Wait for reactivity updates
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000)) // Extra wait for async processing
    
    // Verify Friday is now selected
    expect(wrapper.vm.selectedDays).toContain('FR')
    expect(wrapper.vm.selectedDays).not.toContain('TU')
    
    // Get the generated rule
    const rule = wrapper.vm.rule
    console.log('Generated rule after changing to Friday:', rule)
    
    // Verify the rule has correct day (Friday)
    expect(rule.byweekday).toContain('FR')
    expect(rule.byweekday).not.toContain('TU')
    
    // Get the occurrence dates
    const occurrences = wrapper.vm.occurrences
    
    // Log the occurrences
    console.log('Occurrences after selecting Friday:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInVancouver: formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    })))
    
    // The first occurrence should be Friday May 16 (first Friday after Tuesday May 13)
    expect(occurrences.length).toBeGreaterThan(0)
    
    // Check all occurrences are on Friday in Vancouver timezone
    const allFridays = occurrences.every(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE') === 'Friday'
    )
    expect(allFridays).toBe(true)
    
    // Verify first occurrence is on/after the start date
    const firstOccurrence = occurrences[0]
    const firstOccurrenceTime = firstOccurrence.getTime()
    const startDateTime = new Date('2025-05-13T17:00:00.000Z').getTime()
    
    expect(firstOccurrenceTime).toBeGreaterThanOrEqual(startDateTime)
    
    // The first occurrence should be Friday May 16, 2025
    const firstOccurrenceDayVancouver = formatInTimeZone(firstOccurrence, 'America/Vancouver', 'yyyy-MM-dd')
    expect(firstOccurrenceDayVancouver).toBe('2025-05-16')
  })

  /**
   * Test 3: Verify that user can select multiple days for recurrence
   */
  it('should allow selection of multiple days for recurrence', async () => {
    // Wait for component to initialize
    await nextTick()
    
    // Change the selection to Monday, Wednesday, Friday
    wrapper.vm.selectedDays = ['MO', 'WE', 'FR']
    
    // Wait for reactivity updates
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Verify all three days are selected
    expect(wrapper.vm.selectedDays).toContain('MO')
    expect(wrapper.vm.selectedDays).toContain('WE')
    expect(wrapper.vm.selectedDays).toContain('FR')
    
    // Get the generated rule
    const rule = wrapper.vm.rule
    console.log('Generated rule with multiple days:', rule)
    
    // Verify the rule has all three days
    expect(rule.byweekday).toContain('MO')
    expect(rule.byweekday).toContain('WE')
    expect(rule.byweekday).toContain('FR')
    
    // Get the occurrences
    const occurrences = wrapper.vm.occurrences
    
    // Log the occurrences
    console.log('Occurrences with multiple days:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInVancouver: formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    })))
    
    // Check the days of occurrences
    const occurrenceDays = occurrences.map(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    
    // There should be occurrences on Monday, Wednesday, and Friday
    expect(occurrenceDays).toContain('Monday')
    expect(occurrenceDays).toContain('Wednesday')
    expect(occurrenceDays).toContain('Friday')
    
    // There should NOT be occurrences on other days
    expect(occurrenceDays).not.toContain('Tuesday')
    expect(occurrenceDays).not.toContain('Thursday')
    expect(occurrenceDays).not.toContain('Saturday')
    expect(occurrenceDays).not.toContain('Sunday')
  })

  /**
   * Test 4: Verify that day selection works correctly across timezone boundaries
   * This test uses a date that's Wednesday in UTC but Tuesday in Vancouver
   */
  it('should handle day selection correctly across timezone boundaries', async () => {
    // Create a component with a date that's Wednesday in UTC but Tuesday in Vancouver
    // May 14, 2025 at 03:30:00 UTC is May 13, 2025 at 20:30:00 Vancouver time (Tuesday)
    wrapper = createComponent({
      startDate: '2025-05-14T03:30:00.000Z',
      timeZone: 'America/Vancouver'
    })
    
    // Wait for component to initialize
    await nextTick()
    
    // Verify the date is Wednesday in UTC but Tuesday in Vancouver
    const startDate = new Date('2025-05-14T03:30:00.000Z')
    const dayInUTC = format(startDate, 'EEEE') // Should be Wednesday
    const dayInVancouver = formatInTimeZone(startDate, 'America/Vancouver', 'EEEE') // Should be Tuesday
    
    console.log('Timezone boundary test:', {
      utcDate: startDate.toISOString(),
      dayInUTC,
      dayInVancouver
    })
    
    expect(dayInUTC).toBe('Wednesday')
    expect(dayInVancouver).toBe('Tuesday')
    
    // Verify Tuesday is automatically selected (based on Vancouver timezone)
    console.log('Selected days in timezone boundary test:', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('TU')
    
    // Now change selection to Thursday
    wrapper.vm.selectedDays = ['TH']
    
    // Wait for reactivity updates
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Get the generated rule
    const rule = wrapper.vm.rule
    console.log('Generated rule after changing to Thursday:', rule)
    
    // Verify the rule has Thursday, not Tuesday or Wednesday
    expect(rule.byweekday).toContain('TH')
    expect(rule.byweekday).not.toContain('TU')
    expect(rule.byweekday).not.toContain('WE')
    
    // Get the occurrences
    const occurrences = wrapper.vm.occurrences
    
    // Log the occurrences
    console.log('Occurrences after selecting Thursday:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInUTC: format(date, 'EEEE'),
      dayInVancouver: formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    })))
    
    // Check all occurrences are on Thursday in Vancouver timezone
    const allThursdays = occurrences.every(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE') === 'Thursday'
    )
    expect(allThursdays).toBe(true)
    
    // The first occurrence should be Thursday May 15, 2025
    const firstOccurrence = occurrences[0]
    const firstOccurrenceDayVancouver = formatInTimeZone(firstOccurrence, 'America/Vancouver', 'yyyy-MM-dd')
    expect(firstOccurrenceDayVancouver).toBe('2025-05-15')
  })

  /**
   * Test 5: Verify that day selection works when deselecting days and reselecting others
   */
  it('should handle deselecting days and selecting new ones', async () => {
    // Wait for component to initialize with Tuesday pre-selected
    await nextTick()
    
    // Verify Tuesday is pre-selected initially
    expect(wrapper.vm.selectedDays).toContain('TU')
    
    // Deselect all days (empty selection)
    wrapper.vm.selectedDays = []
    
    // Wait for reactivity updates
    await nextTick()
    
    // Verify no days are selected
    expect(wrapper.vm.selectedDays.length).toBe(0)
    
    // Get the rule - it might fall back to the start date's day (Tuesday)
    const intermediateRule = wrapper.vm.rule
    console.log('Rule after deselecting all days:', intermediateRule)
    
    // Now select Saturday
    wrapper.vm.selectedDays = ['SA']
    
    // Wait for reactivity updates
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Verify only Saturday is selected
    expect(wrapper.vm.selectedDays).toContain('SA')
    expect(wrapper.vm.selectedDays.length).toBe(1)
    
    // Get the final rule
    const finalRule = wrapper.vm.rule
    console.log('Final rule after selecting Saturday:', finalRule)
    
    // Verify the rule has Saturday only
    expect(finalRule.byweekday).toContain('SA')
    expect(finalRule.byweekday.length).toBe(1)
    
    // Get the occurrences
    const occurrences = wrapper.vm.occurrences
    
    // Log the occurrences
    console.log('Occurrences after selecting Saturday:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInVancouver: formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    })))
    
    // Check all occurrences are on Saturday in Vancouver timezone
    const allSaturdays = occurrences.every(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE') === 'Saturday'
    )
    expect(allSaturdays).toBe(true)
    
    // The first occurrence should be Saturday May 17, 2025
    const firstOccurrence = occurrences[0]
    const firstOccurrenceDayVancouver = formatInTimeZone(firstOccurrence, 'America/Vancouver', 'yyyy-MM-dd')
    expect(firstOccurrenceDayVancouver).toBe('2025-05-17')
  })
})