import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { Quasar } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'
import { nextTick } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'

describe('RecurrenceComponent - Timezone Day Shift Tests', () => {
  // Declare wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapper: VueWrapper<any>

  // Create component with Vancouver timezone and Thursday evening start
  const createComponent = (props = {}) => {
    return mount(RecurrenceComponent, {
      props: {
        modelValue: undefined,
        isRecurring: true,
        // 5pm Vancouver time (UTC-7) on Thursday May 15, 2025
        startDate: '2025-05-15T17:00:00.000Z',
        endDate: '2025-05-15T18:00:00.000Z',
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
   * This test focuses specifically on the recurrence pattern and occurrences
   * to ensure that the day of week in Vancouver timezone is correct
   */
  it('should generate weekly occurrences on Thursday in Vancouver timezone', async () => {
    // First verify the start date day in Vancouver
    const startDate = new Date('2025-05-15T17:00:00.000Z')
    const dayInVancouver = formatInTimeZone(startDate, 'America/Vancouver', 'EEEE')

    console.log('Start date info:', {
      utcDate: startDate.toISOString(),
      utcDay: new Date(startDate).getUTCDay(),
      dayInVancouver
    })

    // Confirm it's Thursday in Vancouver
    expect(dayInVancouver).toBe('Thursday')

    // Set weekly recurrence
    await nextTick()

    // Verify Thursday is automatically selected based on the start date
    console.log('Selected days:', wrapper.vm.selectedDays)
    expect(wrapper.vm.selectedDays).toContain('TH')

    // Wait for pattern and occurrences to be calculated
    // Need additional time as the component debounces updates
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get the pattern description
    const pattern = wrapper.vm.humanReadablePattern
    console.log('Recurrence pattern:', pattern)

    // Verify pattern shows weekly
    expect(pattern.toLowerCase()).toContain('week')

    // Get the occurrence dates
    const occurrences = wrapper.vm.occurrences

    // Log the occurrences as displayed to user
    console.log('Occurrences from component:', occurrences.map(date => ({
      date: date.toISOString(),
      formatted: wrapper.vm.formatDate(date),
      dayInVancouver: formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    })))

    // Verify all occurrences are on Thursday in Vancouver
    const allThursdays = occurrences.every(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE') === 'Thursday'
    )

    expect(allThursdays).toBe(true)

    // Verify the first few occurrence dates specifically
    // to make sure they match our expectations
    const expectedDates = [
      '2025-05-15T17:00:00.000Z', // Original date
      '2025-05-22T17:00:00.000Z', // One week later
      '2025-05-29T17:00:00.000Z' // Two weeks later
    ]

    // Check that the first 3 occurrences match our expected dates
    occurrences.slice(0, 3).forEach((date, i) => {
      expect(date.toISOString()).toBe(expectedDates[i])
    })
  })

  /**
   * This test specifically checks the pattern near the timezone boundary
   * where a date can be Wednesday in Vancouver but Thursday in UTC
   */
  it('should correctly handle dates near timezone boundaries (Vancouver)', async () => {
    // Create a component with a date that's at midnight UTC (which is evening in Vancouver)
    // May 1, 2025 at 05:30:00 UTC is Wednesday evening in Vancouver
    wrapper = createComponent({
      startDate: '2025-05-01T05:30:00.000Z',
      timeZone: 'America/Vancouver'
    })

    await nextTick()

    // Check what day it is in Vancouver vs UTC
    const startDate = new Date('2025-05-01T05:30:00.000Z')
    const dayInUTC = startDate.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const dayInVancouver = formatInTimeZone(startDate, 'America/Vancouver', 'EEEE')

    console.log('Timezone boundary case:', {
      utcDate: startDate.toISOString(),
      dayInUTC,
      dayInVancouver
    })

    // We expect these to be different - Thursday in UTC, Wednesday in Vancouver
    expect(dayInUTC).toBe('Thursday')
    expect(dayInVancouver).toBe('Wednesday')

    // Check what day is selected by default
    console.log('Selected days for boundary date:', wrapper.vm.selectedDays)

    // We expect Wednesday to be selected since that's the day in Vancouver
    expect(wrapper.vm.selectedDays).toContain('WE')

    // Wait for pattern and occurrences to be calculated
    // Need additional time as the component debounces updates
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check the occurrence dates
    const occurrences = wrapper.vm.occurrences

    console.log('Boundary case occurrences:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInVancouver: formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    })))

    // Verify all occurrences are on Wednesday in Vancouver
    const allWednesdays = occurrences.every(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE') === 'Wednesday'
    )

    expect(allWednesdays).toBe(true)
  })

  /**
   * This test uses a different timezone (Sydney, Australia) to demonstrate the bug
   * where a date can be Sunday in UTC but Monday in Sydney
   */
  it('should correctly handle dates near timezone boundaries (Sydney)', async () => {
    // Create a component with a date that's Sunday evening in UTC but Monday morning in Sydney
    // May 18, 2025 at 22:30:00 UTC is May 19, 2025 08:30:00 in Sydney
    wrapper = createComponent({
      startDate: '2025-05-18T22:30:00.000Z',
      timeZone: 'Australia/Sydney'
    })

    await nextTick()

    // Check what day it is in Sydney vs UTC
    const startDate = new Date('2025-05-18T22:30:00.000Z')
    const dayInUTC = startDate.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const dayInSydney = formatInTimeZone(startDate, 'Australia/Sydney', 'EEEE')

    console.log('Sydney timezone boundary case:', {
      utcDate: startDate.toISOString(),
      dayInUTC,
      dayInSydney
    })

    // We expect these to be different - Sunday in UTC, Monday in Sydney
    expect(dayInUTC).toBe('Sunday')
    expect(dayInSydney).toBe('Monday')

    // Check what day is selected by default
    console.log('Selected days for Sydney boundary date:', wrapper.vm.selectedDays)

    // We expect Monday to be selected since that's the day in Sydney
    expect(wrapper.vm.selectedDays).toContain('MO')

    // Wait for pattern and occurrences to be calculated
    // Need additional time as the component debounces updates
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check the occurrence dates
    const occurrences = wrapper.vm.occurrences

    console.log('Sydney boundary case occurrences:', occurrences.map(date => ({
      date: date.toISOString(),
      dayInSydney: formatInTimeZone(date, 'Australia/Sydney', 'EEEE'),
      timeInSydney: formatInTimeZone(date, 'Australia/Sydney', 'HH:mm:ss'),
      utcDay: new Date(date).getUTCDay() === 0 ? 'Sunday' : 
              new Date(date).getUTCDay() === 1 ? 'Monday' : 
              new Date(date).getUTCDay() === 2 ? 'Tuesday' : 
              new Date(date).getUTCDay() === 3 ? 'Wednesday' : 
              new Date(date).getUTCDay() === 4 ? 'Thursday' : 
              new Date(date).getUTCDay() === 5 ? 'Friday' : 'Saturday'
    })))
    
    // Print component's internal rule
    console.log('Component recurrence rule:', JSON.stringify(wrapper.vm.rule))

    // Verify all occurrences are on Monday in Sydney
    const allMondays = occurrences.every(date => {
      const dayInSydney = formatInTimeZone(date, 'Australia/Sydney', 'EEEE');
      const isMonday = dayInSydney === 'Monday';
      if (!isMonday) {
        console.error(`Found non-Monday occurrence: ${date.toISOString()} is ${dayInSydney} in Sydney`);
      }
      return isMonday;
    })

    expect(allMondays).toBe(true)
  })
})
