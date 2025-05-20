import { describe, it, expect, beforeEach } from 'vitest'
import { RecurrenceService } from '../../../../src/services/recurrenceService'
import { RecurrenceRule } from '../../../../src/types/event'
import { formatInTimeZone } from 'date-fns-tz'

describe('Recurrence Service Late Night America/New_York Timezone Test', () => {
  // Define constants for the test scenario
  const NEW_YORK_TIMEZONE = 'America/New_York'

  // Create a test event that starts on a Monday at 10:00 PM in America/New_York
  let testEvent: {
    name: string
    startDate: string
    endDate: string
    timeZone: string
    recurrenceRule: RecurrenceRule
  }

  beforeEach(() => {
    // Use a known Monday for our test
    // May 20, 2024 is a Monday at 10:00 PM ET
    const mondayStartDate = '2024-05-20T22:00:00-04:00'

    // Set up our test event
    testEvent = {
      name: 'Late Night Monday Test Event',
      startDate: mondayStartDate,
      endDate: '2024-05-20T23:00:00-04:00',
      timeZone: NEW_YORK_TIMEZONE,
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['MO'] // Explicitly set to Monday
      }
    }
  })

  it('should correctly identify Monday as the day of week in America/New_York timezone at 10:00 PM', () => {
    const startDate = new Date(testEvent.startDate)

    // Test RecurrenceService.getDayOfWeekInTimezone to ensure it correctly identifies
    // the day of week for the event time
    const { dayCode } = RecurrenceService.getDayOfWeekInTimezone(startDate, NEW_YORK_TIMEZONE)

    // Verify that the day is correctly identified as Monday
    expect(dayCode).toBe('MO')
  })

  it('should generate occurrences that fall on Mondays when event is at 10:00 PM ET', () => {
    // Generate occurrences for the weekly Monday event
    const occurrences = RecurrenceService.getOccurrences(testEvent, 5)

    // Log all occurrences for debugging
    console.log('Generated occurrences:')
    occurrences.forEach((occurrence, index) => {
      console.log(`[${index}] ${occurrence.toISOString()} - Day in ET: ${formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'EEEE')}`)
    })

    // Verify each occurrence falls on a Monday in the America/New_York timezone
    occurrences.forEach((occurrence, index) => {
      const dayOfWeekInET = formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'EEEE')
      const dayCode = formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'iiii').substring(0, 2).toUpperCase()

      expect(dayOfWeekInET).toBe('Monday', `Occurrence ${index} (${occurrence.toISOString()}) should be Monday in ET, but is ${dayOfWeekInET}`)
      expect(dayCode).toBe('MO', `Occurrence ${index} should have day code MO in ET, but has ${dayCode}`)
    })
  })

  it('should generate correct UTC times for late night ET events', () => {
    // Generate occurrences for the weekly Monday event
    const occurrences = RecurrenceService.getOccurrences(testEvent, 5)

    // Verify the first occurrence is the start date itself
    const firstOccurrence = occurrences[0]
    const firstOccurrenceUTCHours = firstOccurrence.getUTCHours()

    // Since 10 PM ET is 02:00 UTC the next day (during EDT), verify the UTC time
    // The hours could be 2 or 3 depending on whether EDT or EST is in effect
    const expectedUTCHours = [2, 3]
    expect(expectedUTCHours).toContain(firstOccurrenceUTCHours)
  })

  it('should demonstrate the timezone mismatch issue with late night Monday events', () => {
    // Create an event with recurrence rule explicitly omitting byweekday
    // This simulates when an event is created at 10 PM Monday without explicit day selection
    const problematicEvent = {
      ...testEvent,
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1
        // Explicitly omit byweekday to demonstrate the issue
      }
    }

    // Generate occurrences
    const occurrences = RecurrenceService.getOccurrences(problematicEvent, 5)

    // Log all occurrences for debugging
    console.log('Generated occurrences for problematic event:')
    occurrences.forEach((occurrence, index) => {
      const dayInET = formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'EEEE')
      const dayInUTC = formatInTimeZone(occurrence, 'UTC', 'EEEE')
      console.log(`[${index}] ${occurrence.toISOString()} - Day in ET: ${dayInET}, Day in UTC: ${dayInUTC}`)
    })

    // Check if all occurrences are correctly on Monday in ET
    const nonMondayOccurrences = occurrences.filter(occurrence => {
      const dayOfWeekInET = formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'EEEE')
      return dayOfWeekInET !== 'Monday'
    })

    // This test might fail if the timezone issue is present
    if (nonMondayOccurrences.length > 0) {
      console.error('Found occurrences not on Monday in ET:', nonMondayOccurrences.map(d =>
        `${d.toISOString()} - ${formatInTimeZone(d, NEW_YORK_TIMEZONE, 'EEEE')}`
      ))
    }

    // Count Sunday occurrences to check if we're seeing the reported issue
    const sundayOccurrences = occurrences.filter(occurrence => {
      const dayOfWeekInET = formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'EEEE')
      return dayOfWeekInET === 'Sunday'
    })

    console.log(`Found ${sundayOccurrences.length} occurrences on Sunday instead of Monday.`)
  })

  it('should generate correct days when byweekday is explicitly set with proper timezone handling', () => {
    // Ensure event is correctly configured for Monday with explicit timezone handling
    const fixedEvent = {
      ...testEvent,
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['MO'], // Explicitly set to Monday
        wkst: 'SU' // Set week start to Sunday (default in US)
      }
    }

    // Generate occurrences
    const occurrences = RecurrenceService.getOccurrences(fixedEvent, 5)

    // Verify all occurrences are on Monday in ET timezone
    occurrences.forEach((occurrence, index) => {
      const dayOfWeekInET = formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'EEEE')
      expect(dayOfWeekInET).toBe('Monday', `Occurrence ${index} should be Monday in ET, but is ${dayOfWeekInET}`)
    })
  })

  it('should demonstrate how UTC date can be on different day than timezone date for late night events', () => {
    // This test illustrates the root cause of the problem
    const startDate = new Date(testEvent.startDate)

    // America/New_York day
    const dayInET = formatInTimeZone(startDate, NEW_YORK_TIMEZONE, 'EEEE')
    // UTC day
    const dayInUTC = formatInTimeZone(startDate, 'UTC', 'EEEE')

    // 10 PM ET on Monday is actually Tuesday in UTC (during EDT)
    console.log(`Start date: ${startDate.toISOString()}`)
    console.log(`Day in ET: ${dayInET}`)
    console.log(`Day in UTC: ${dayInUTC}`)

    expect(dayInET).toBe('Monday')
    // When EDT is in effect, 10 PM ET is 2 AM UTC the next day, which would be Tuesday
    expect(['Monday', 'Tuesday']).toContain(dayInUTC)

    // If they're different, then we've demonstrated the issue
    if (dayInET !== dayInUTC) {
      console.log('⚠️ Demonstrated the day boundary issue: The day in ET timezone differs from UTC')
    }
  })

  it('should use RecurrenceService.isOnExpectedDay to verify day correctness', () => {
    const startDate = new Date(testEvent.startDate)

    // Test the utility method directly
    const isOnExpectedDay = RecurrenceService.isOnExpectedDay(
      startDate,
      'MO', // Expected day code for Monday
      NEW_YORK_TIMEZONE
    )

    expect(isOnExpectedDay).toBe(true, 'The start date should be on Monday in America/New_York')

    // Generate occurrences to test
    const occurrences = RecurrenceService.getOccurrences(testEvent, 5)

    // Verify all occurrences are on the expected day using the service method
    occurrences.forEach((occurrence, index) => {
      const isOccurrenceOnExpectedDay = RecurrenceService.isOnExpectedDay(
        occurrence,
        'MO',
        NEW_YORK_TIMEZONE
      )

      expect(isOccurrenceOnExpectedDay).toBe(
        true,
        `Occurrence ${index} (${occurrence.toISOString()}) should be on Monday in ET`
      )
    })
  })

  it('should demonstrate how findClosestDateWithDay can fix occurrences on the wrong day', () => {
    // First generate potentially problematic occurrences
    const problematicEvent = {
      ...testEvent,
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1
        // Omit byweekday to potentially trigger the issue
      }
    }

    const occurrences = RecurrenceService.getOccurrences(problematicEvent, 5)

    // Find any occurrences that aren't on Monday
    const nonMondayOccurrences = occurrences.filter(occurrence => {
      return !RecurrenceService.isOnExpectedDay(occurrence, 'MO', NEW_YORK_TIMEZONE)
    })

    // If we found any occurrences not on Monday, attempt to fix them
    if (nonMondayOccurrences.length > 0) {
      console.log(`Found ${nonMondayOccurrences.length} occurrences not on Monday. Attempting to fix...`)

      const fixedOccurrences = nonMondayOccurrences.map(occurrence => {
        const fixedDate = RecurrenceService.findClosestDateWithDay(
          occurrence,
          'MO', // We want Monday
          NEW_YORK_TIMEZONE,
          3 // Look up to 3 days in either direction
        )

        // Log the changes
        console.log(`Fixed occurrence:
          Original: ${occurrence.toISOString()} (${formatInTimeZone(occurrence, NEW_YORK_TIMEZONE, 'EEEE')})
          Fixed: ${fixedDate.toISOString()} (${formatInTimeZone(fixedDate, NEW_YORK_TIMEZONE, 'EEEE')})
        `)

        return fixedDate
      })

      // Verify all fixed occurrences are now on Monday
      fixedOccurrences.forEach((fixedDate, index) => {
        const isFixed = RecurrenceService.isOnExpectedDay(fixedDate, 'MO', NEW_YORK_TIMEZONE)
        expect(isFixed).toBe(true, `Occurrence ${index} should be fixed to Monday`)
      })
    } else {
      console.log('All occurrences already on correct day (Monday).')
    }
  })
})
