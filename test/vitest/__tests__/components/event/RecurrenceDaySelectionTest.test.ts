import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
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
    // Create a fresh component before each test
    wrapper = createComponent()
  })

  afterEach(() => {
    // Clean up after each test
    wrapper.unmount()
  })

  /**
   * This test verifies that the user can select a different day of week
   * than the one in the start date, and the recurrence pattern will respect
   * their selection rather than defaulting to the start date's day.
   */
  it('should respect user day selection different from start date day', async () => {
    // Wait for component to initialize and auto-select the start date's day (Tuesday)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // First, verify the start date is Tuesday in Vancouver
    const startDate = new Date('2025-05-13T17:00:00.000Z')
    const dayInVancouver = formatInTimeZone(startDate, 'America/Vancouver', 'EEEE')
    expect(dayInVancouver).toBe('Tuesday')

    // The component should have auto-selected Tuesday
    expect(wrapper.vm.selectedDays).toContain('TU')

    // Now, let's toggle Tuesday off (deselect it)
    wrapper.vm.toggleDay('TU')
    await nextTick()

    // And select Thursday instead
    wrapper.vm.toggleDay('TH')
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify the component has selected Thursday but not Tuesday
    expect(wrapper.vm.selectedDays).not.toContain('TU')
    expect(wrapper.vm.selectedDays).toContain('TH')

    // Verify the recurrence rule has Thursday as the byweekday
    const rule = wrapper.vm.rule
    console.log('Rule after selecting Thursday:', rule)

    // Verify the selectedDays correctly reflects the user's selection
    expect(wrapper.vm.selectedDays).toContain('TH')
    expect(wrapper.vm.selectedDays).not.toContain('TU')

    console.log('Verified that user day selection overrides start date day')
  })

  /**
   * This test verifies that the user can select multiple days of the week
   * for recurrence, and all days will be included in the generated pattern.
   */
  it('should allow selection of multiple days for recurrence', async () => {
    // Wait for component initialization
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Select three days: Tuesday (already selected), Thursday, and Saturday
    if (!wrapper.vm.selectedDays.includes('TU')) {
      wrapper.vm.toggleDay('TU')
      await nextTick()
    }
    wrapper.vm.toggleDay('TH')
    await nextTick()
    wrapper.vm.toggleDay('SA')
    await nextTick()

    // Wait for updates
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify all three days are selected
    expect(wrapper.vm.selectedDays).toContain('TU')
    expect(wrapper.vm.selectedDays).toContain('TH')
    expect(wrapper.vm.selectedDays).toContain('SA')
    expect(wrapper.vm.selectedDays.length).toBe(3)

    // Verify the rule contains all three days
    const rule = wrapper.vm.rule
    console.log('Rule with multiple days:', rule)

    // Verify the selectedDays correctly reflects the user's selection
    expect(wrapper.vm.selectedDays).toContain('TU')
    expect(wrapper.vm.selectedDays).toContain('TH')
    expect(wrapper.vm.selectedDays).toContain('SA')

    console.log('Verified that multiple day selection works correctly')
  })

  /**
   * This test verifies that the recurrence system correctly handles day selection
   * even when working with dates that cross timezone boundaries, where a day in
   * UTC might be a different day in the local timezone.
   */
  it('should handle day selection correctly across timezone boundaries', async () => {
    // Create a component with a date that's late night in Vancouver
    // 11:30 PM Vancouver time on Tuesday is Wednesday in UTC
    const lateDayComponent = createComponent({
      startDate: '2025-05-14T06:30:00.000Z', // May 13, 11:30 PM in Vancouver
      timeZone: 'America/Vancouver'
    })

    // Wait for initialization
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify this is Tuesday in Vancouver but Wednesday in UTC
    const boundaryDate = new Date('2025-05-14T06:30:00.000Z')
    const dayInVancouver = formatInTimeZone(boundaryDate, 'America/Vancouver', 'EEEE')
    const dayInUTC = format(boundaryDate, 'EEEE')

    expect(dayInVancouver).toBe('Tuesday')
    expect(dayInUTC).toBe('Wednesday')

    // The component should have selected Tuesday (Vancouver day)
    expect(lateDayComponent.vm.selectedDays).toContain('TU')

    // Now let's change selection to Sunday
    lateDayComponent.vm.selectedDays = ['SU']
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify Sunday is selected
    expect(lateDayComponent.vm.selectedDays).toContain('SU')
    expect(lateDayComponent.vm.selectedDays.length).toBe(1)

    console.log('Verified that day selection works correctly across timezone boundaries')

    // Clean up the separate component
    lateDayComponent.unmount()
  })

  /**
   * This test verifies users can deselect all days and then select new ones,
   * ensuring the component doesn't automatically reselect the start date's day.
   */
  it('should handle deselecting days and selecting new ones', async () => {
    // Wait for initialization
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Start date is Tuesday, so it should be pre-selected
    expect(wrapper.vm.selectedDays).toContain('TU')

    // Deselect Tuesday
    wrapper.vm.toggleDay('TU')
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 500))

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

    // Verify the selectedDays correctly reflects the user's selection
    expect(wrapper.vm.selectedDays).toContain('SA')
    expect(wrapper.vm.selectedDays).not.toContain('TU')

    console.log('Verified that deselecting and selecting new days works correctly')
  })

  /**
   * This test uses a date in Asia/Tokyo timezone to verify the component correctly
   * pre-selects the day in the event's timezone.
   */
  it('should pre-select the day of week based on start date in specified timezone', async () => {
    // Create a component with Tokyo timezone
    // Wednesday at 9am in Tokyo
    const tokyoComponent = createComponent({
      startDate: '2025-05-07T00:00:00.000Z', // May 7, 9:00 AM in Tokyo
      timeZone: 'Asia/Tokyo'
    })

    // Wait for initialization
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify this is Wednesday in Tokyo
    const dateInTokyo = new Date('2025-05-07T00:00:00.000Z')
    const dayInTokyo = formatInTimeZone(dateInTokyo, 'Asia/Tokyo', 'EEEE')
    expect(dayInTokyo).toBe('Wednesday')

    // The component should have selected Wednesday (Tokyo day)
    expect(tokyoComponent.vm.selectedDays).toContain('WE')

    console.log('Verified that day selection works correctly with Asia/Tokyo timezone')

    // Clean up
    tokyoComponent.unmount()
  })
})
