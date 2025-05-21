import { describe, it, expect } from 'vitest'
import { RecurrenceService } from '../../../../src/services/recurrenceService'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * This file tests the fix for late night events across timezone boundaries
 *
 * The issue is:
 * - 10:00 PM Monday in America/New_York = 2:00 AM Tuesday UTC
 * - RRule with BYDAY=MO should generate occurrences on Mondays in America/New_York
 * - But was generating occurrences on Sundays instead
 *
 * This happens because:
 * 1. The RRule library generates occurrences based on UTC date calculations
 * 2. For late night events, the UTC day is different from the timezone day
 * 3. The occurrences are generated on the wrong day of the week
 * 4. Our fix detects this inconsistency and shifts the dates to the correct day
 */
describe('RecurrenceService - Late Night Fix', () => {
  // Verify that the occurrence generator creates occurrences on the right day
  it('should create occurrences on Monday for a Monday 10 PM event in NY timezone', () => {
    // Create the event data with a Monday 10 PM America/New_York event
    const event = {
      name: 'Late Night Test Event',
      startDate: '2025-05-20T02:00:00.000Z', // Tuesday in UTC / Monday in New York (10 PM)
      timeZone: 'America/New_York',
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['MO'], // Monday explicitly selected
        timeZone: 'America/New_York'
      }
    }

    // Generate occurrences
    const occurrences = RecurrenceService.getOccurrences(event, 5)

    // Verify we got occurrences
    expect(occurrences.length).toBe(5)

    // Verify all occurrences are on Monday in America/New_York
    occurrences.forEach(date => {
      const dayInTimeZone = formatInTimeZone(date, 'America/New_York', 'EEEE')
      expect(dayInTimeZone).toBe('Monday')

      // Also verify the time is preserved as 10:00 PM
      const timeInTimeZone = formatInTimeZone(date, 'America/New_York', 'h:mm a')
      expect(timeInTimeZone).toBe('10:00 PM')
    })
  })

  // Test for multiple selected days
  it('should create occurrences on Monday and Tuesday for MO,TU selection', () => {
    // Create the event data with a Monday 10 PM America/New_York event
    // But select both Monday and Tuesday as the days
    const event = {
      startDate: '2025-05-20T02:00:00.000Z', // Tuesday in UTC / Monday in New York (10 PM)
      timeZone: 'America/New_York',
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['MO', 'TU'], // Select both Monday and Tuesday
        timeZone: 'America/New_York'
      }
    }

    // Generate occurrences
    const occurrences = RecurrenceService.getOccurrences(event, 6)

    // Verify we got occurrences
    expect(occurrences.length).toBe(6)

    // Group by day of week
    const dayGroups = occurrences.reduce((groups, date) => {
      const dayInTimeZone = formatInTimeZone(date, 'America/New_York', 'EEEE')
      if (!groups[dayInTimeZone]) {
        groups[dayInTimeZone] = []
      }
      groups[dayInTimeZone].push(date)
      return groups
    }, {} as Record<string, Date[]>)

    // Verify we have both Monday and Tuesday occurrences
    expect(Object.keys(dayGroups).sort()).toEqual(['Monday', 'Tuesday'])

    // Verify the time is preserved for all occurrences
    Object.values(dayGroups).flat().forEach(date => {
      const timeInTimeZone = formatInTimeZone(date, 'America/New_York', 'h:mm a')
      expect(timeInTimeZone).toBe('10:00 PM')
    })
  })

  // Test the text description for late night events
  it('should describe a Monday 10 PM event as "every week on Monday"', () => {
    // Create a rule for a Monday 10 PM event
    const rule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['MO'],
      timeZone: 'America/New_York'
    }

    // Convert to RRule
    const rrule = RecurrenceService.toRRule(
      rule,
      '2025-05-20T02:00:00.000Z', // Tuesday in UTC / Monday in New York (10 PM)
      'America/New_York'
    )

    // Get the text description
    const description = rrule.toText()

    // Verify the description mentions Monday, not Tuesday
    expect(description.toLowerCase()).toContain('monday')
    expect(description.toLowerCase()).not.toContain('tuesday')
  })
})
