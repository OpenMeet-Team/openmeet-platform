import { describe, it, expect } from 'vitest'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'

/**
 * This test demonstrates the UI display bug where:
 * - A weekly event set for Monday at 10:00 PM in America/New_York
 * - The recurrence system correctly identifies that as Monday and generates occurrences on Mondays
 * - But the UI displays "every week on Tuesday (EDT)" in some places
 * - While showing "Mon, May 26, 2025 10:00 PM EDT" in the occurrences list
 *
 * The issue appears to be related to how the pattern description is generated or displayed.
 * Our tests show that the backend calculation is correct, but something in the UI layer
 * is using the wrong timezone context when generating the description.
 */
describe('RecurrencePatternDescription - Timezone Boundary Bug', () => {
  /**
   * This test verifies that the text description correctly uses
   * the day in the event's timezone, not UTC
   */
  it('should describe pattern using day in event timezone, not UTC', () => {
    // Create a rule for an event at 10:00 PM Monday in New York
    // (which is 2:00 AM Tuesday UTC)
    const rule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['MO'], // Explicitly set to Monday
      timeZone: 'America/New_York'
    }

    // Create the RRule
    const rrule = RecurrenceService.toRRule(
      rule,
      '2025-05-20T02:00:00.000Z', // Tuesday in UTC / Monday 10:00 PM in New York
      'America/New_York'
    )

    // Get the text description
    const description = rrule.toText()
    console.log('Generated pattern description:', description)

    // It should mention Monday, not Tuesday
    expect(description.toLowerCase()).toContain('monday')
    expect(description.toLowerCase()).not.toContain('tuesday')
  })

  /**
   * This test verifies that the human-readable text for the event
   * correctly describes the pattern as Monday
   */
  it('should generate correct human-readable pattern mentioning Monday', () => {
    // Create an event at 10:00 PM Monday in New York
    const event = {
      startDate: '2025-05-20T02:00:00.000Z', // Tuesday in UTC / Monday in New York
      timeZone: 'America/New_York',
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['MO'], // Explicitly set to Monday
        timeZone: 'America/New_York'
      }
    }

    // Get the human-readable pattern description
    const description = RecurrenceService.getHumanReadablePattern(event)
    console.log('Human readable pattern:', description)

    // Should mention Monday, not Tuesday
    expect(description.toLowerCase()).toContain('monday')
    expect(description.toLowerCase()).not.toContain('tuesday')
  })

  /**
   * This test compares the day in the description to the day
   * of the actual occurrences to ensure they match
   */
  it('should have matching day in description and occurrences', () => {
    // Create an event at 10:00 PM Monday in New York
    const event = {
      name: 'Test Event',
      startDate: '2025-05-20T02:00:00.000Z', // Tuesday in UTC / Monday in New York
      timeZone: 'America/New_York',
      recurrenceRule: {
        frequency: 'WEEKLY',
        interval: 1,
        byweekday: ['MO'], // Explicitly set to Monday
        timeZone: 'America/New_York'
      }
    }

    // Get the human-readable pattern
    const description = RecurrenceService.getHumanReadablePattern(event)
    console.log('Human readable pattern:', description)

    // Get the occurrences
    const occurrences = RecurrenceService.getOccurrences(event, 3)

    // Log occurrences with their day in New York
    const occurrenceDays = occurrences.map(date => {
      const dayName = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: 'America/New_York'
      }).format(date)
      return {
        date: date.toISOString(),
        dayName
      }
    })
    console.log('Occurrence days:', occurrenceDays)

    // All occurrences should be on the same day mentioned in the description
    // If description mentions Monday, all occurrences should be Monday
    if (description.toLowerCase().includes('monday')) {
      occurrenceDays.forEach(({ dayName }) => {
        expect(dayName.toLowerCase()).toBe('monday')
      })
    } else if (description.toLowerCase().includes('tuesday')) {
      occurrenceDays.forEach(({ dayName }) => {
        expect(dayName.toLowerCase()).toBe('tuesday')
      })
    }
  })
})
