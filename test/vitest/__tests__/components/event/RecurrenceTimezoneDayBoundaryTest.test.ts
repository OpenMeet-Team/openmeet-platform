import { describe, it, expect } from 'vitest'
import { formatInTimeZone, format } from 'date-fns-tz'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'
import { EventEntity } from '../../../../../src/types/event'

/**
 * This test suite specifically addresses timezone day boundary issues in recurrence
 * It focuses on cases where the date in UTC and the timezone are different days
 */
describe('RecurrenceService - Timezone Day Boundary Handling', () => {
  // Define test cases for day boundary scenarios
  const dayBoundaryTestCases = [
    {
      name: 'Americas late night (UTC+1)',
      startDate: '2025-04-30T03:30:00.000Z', // 11:30 PM Tuesday in New York
      timezone: 'America/New_York',
      selectedDay: 'TU', // User selects Tuesday
      expectedLocalDay: 'Tuesday',
      expectedLocalTime: '23:30:00',
      expectedUtcDay: 'Wednesday'
    },
    {
      name: 'Americas midnight (UTC+1)',
      startDate: '2025-04-30T04:00:00.000Z', // 12:00 AM Wednesday in New York
      timezone: 'America/New_York',
      selectedDay: 'WE', // User selects Wednesday (midnight)
      expectedLocalDay: 'Wednesday',
      expectedLocalTime: '00:00:00',
      expectedUtcDay: 'Wednesday'
    },
    {
      name: 'Pacific late night (UTC+1)',
      startDate: '2025-05-01T05:30:00.000Z', // 10:30 PM Wednesday in Vancouver
      timezone: 'America/Vancouver',
      selectedDay: 'WE', // User selects Wednesday
      expectedLocalDay: 'Wednesday',
      expectedLocalTime: '22:30:00',
      expectedUtcDay: 'Thursday'
    },
    {
      name: 'Asia late night (UTC-1)',
      startDate: '2025-04-29T14:30:00.000Z', // 11:30 PM Tuesday in Tokyo
      timezone: 'Asia/Tokyo',
      selectedDay: 'TU', // User selects Tuesday
      expectedLocalDay: 'Tuesday',
      expectedLocalTime: '23:30:00',
      expectedUtcDay: 'Tuesday'
    },
    {
      name: 'Europe early morning (UTC+1)',
      startDate: '2025-04-29T23:30:00.000Z', // 1:30 AM Wednesday in Berlin
      timezone: 'Europe/Berlin',
      selectedDay: 'WE', // User selects Wednesday
      expectedLocalDay: 'Wednesday',
      expectedLocalTime: '01:30:00',
      expectedUtcDay: 'Tuesday'
    }
  ]

  /**
   * Test case specifically for day boundary conditions across multiple scenarios
   * - Events created in different timezones at times that cross day boundaries
   * - Checks if occurrences correctly respect the weekday in originating timezone
   */
  it.each(dayBoundaryTestCases)('should handle $name day boundary correctly', (testCase) => {
    const startDate = new Date(testCase.startDate)

    // Verify we've set up a proper test case
    const dayInUTC = format(startDate, 'EEEE')
    const dayInLocal = formatInTimeZone(startDate, testCase.timezone, 'EEEE')
    const timeInLocal = formatInTimeZone(startDate, testCase.timezone, 'HH:mm:ss')

    console.log(`Day boundary test case setup [${testCase.name}]:`, {
      utcDate: startDate.toISOString(),
      utcDay: dayInUTC,
      localDay: dayInLocal,
      localTime: timeInLocal,
      timezone: testCase.timezone
    })

    // Confirm our test case matches expected initial values
    expect(dayInLocal).toBe(testCase.expectedLocalDay)
    expect(timeInLocal).toBe(testCase.expectedLocalTime)
    expect(dayInUTC).toBe(testCase.expectedUtcDay)

    // Create a weekly recurrence rule with selected day
    const event = {
      name: 'Test Meeting',
      startDate: startDate.toISOString(),
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: [testCase.selectedDay],
        _userExplicitSelection: true
      },
      timeZone: testCase.timezone
    }

    // Generate occurrences with our service
    console.log(`Generating occurrences for ${testCase.name}`)
    const occurrences = RecurrenceService.getOccurrences(event as unknown as EventEntity, 5)

    // Analyze occurrences to ensure they're all on the expected day in the local timezone
    const occurrenceDetails = occurrences.map(date => {
      return {
        date: date.toISOString(),
        utcDay: format(date, 'EEEE'),
        localDay: formatInTimeZone(date, testCase.timezone, 'EEEE'),
        localTime: formatInTimeZone(date, testCase.timezone, 'HH:mm:ss'),
        localFullDate: formatInTimeZone(date, testCase.timezone, 'yyyy-MM-dd HH:mm:ss (EEEE)')
      }
    })

    console.log(`Generated occurrences for ${testCase.name}:`, occurrenceDetails)

    // Verify all occurrences match expected values
    const allExpectedLocalDay = occurrenceDetails.every(info => info.localDay === testCase.expectedLocalDay)
    expect(allExpectedLocalDay).toBe(true)

    const allExpectedLocalTime = occurrenceDetails.every(info => info.localTime === testCase.expectedLocalTime)
    expect(allExpectedLocalTime).toBe(true)
  })

  // Define test cases for monthly patterns
  const monthlyPatternTestCases = [
    {
      name: 'First Monday of month (night before in UTC)',
      startDate: '2025-05-06T03:30:00.000Z', // 11:30 PM Monday in New York
      timezone: 'America/New_York',
      pattern: {
        frequency: 'MONTHLY',
        byweekday: ['MO'],
        bysetpos: [1] // 1st Monday
      },
      expectedLocalDay: 'Monday',
      expectedLocalTime: '23:30:00'
    },
    {
      name: 'Last Friday of month (midnight)',
      startDate: '2025-04-26T04:00:00.000Z', // Midnight Friday/Saturday in New York
      timezone: 'America/New_York',
      pattern: {
        frequency: 'MONTHLY',
        byweekday: ['FR'],
        bysetpos: [-1] // Last Friday
      },
      expectedLocalDay: 'Friday',
      expectedLocalTime: '00:00:00'
    },
    {
      name: 'Second Wednesday (Australia ahead of UTC)',
      startDate: '2025-05-13T14:00:00.000Z', // Midnight in Sydney
      timezone: 'Australia/Sydney',
      pattern: {
        frequency: 'MONTHLY',
        byweekday: ['WE'],
        bysetpos: [2] // 2nd Wednesday
      },
      expectedLocalDay: 'Wednesday',
      expectedLocalTime: '00:00:00'
    }
  ]

  /**
   * Test if monthlyByDay patterns correctly handle timezone day boundaries
   */
  it.each(monthlyPatternTestCases)('should handle $name monthly patterns correctly across timezones', (testCase) => {
    const startDate = new Date(testCase.startDate)

    // Verify setup
    const dayInUTC = format(startDate, 'EEEE')
    const dayInLocal = formatInTimeZone(startDate, testCase.timezone, 'EEEE')
    const timeInLocal = formatInTimeZone(startDate, testCase.timezone, 'HH:mm:ss')

    console.log(`Monthly pattern test setup [${testCase.name}]:`, {
      utcDate: startDate.toISOString(),
      utcDay: dayInUTC,
      localDay: dayInLocal,
      localTime: timeInLocal,
      timezone: testCase.timezone
    })

    // Create monthly pattern event
    const event = {
      name: 'Monthly Meeting',
      startDate: startDate.toISOString(),
      recurrenceRule: testCase.pattern,
      timeZone: testCase.timezone
    }

    // Generate occurrences
    const occurrences = RecurrenceService.getOccurrences(event as unknown as EventEntity, 3)

    // Analyze occurrences
    const occurrenceDetails = occurrences.map(date => {
      return {
        date: date.toISOString(),
        localDate: formatInTimeZone(date, testCase.timezone, 'yyyy-MM-dd'),
        localDay: formatInTimeZone(date, testCase.timezone, 'EEEE'),
        localTime: formatInTimeZone(date, testCase.timezone, 'HH:mm:ss'),
        localFullDate: formatInTimeZone(date, testCase.timezone, 'yyyy-MM-dd HH:mm:ss (EEEE)')
      }
    })

    console.log(`Monthly pattern occurrences [${testCase.name}]:`, occurrenceDetails)

    // Verify all occurrences are on expected day of week
    const allExpectedDay = occurrenceDetails.every(info => info.localDay === testCase.expectedLocalDay)
    expect(allExpectedDay).toBe(true)

    // Verify all occurrences are at expected time
    const allExpectedTime = occurrenceDetails.every(info => info.localTime === testCase.expectedLocalTime)
    expect(allExpectedTime).toBe(true)

    // Each occurrence should be in a different month
    const months = occurrenceDetails.map(info => info.localDate.substring(0, 7)) // YYYY-MM
    const uniqueMonths = new Set(months)
    expect(uniqueMonths.size).toBe(occurrenceDetails.length)
  })
})
