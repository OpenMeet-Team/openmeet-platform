import { describe, it, expect } from 'vitest'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * This test demonstrates the UI pattern description mismatch and provides a fix:
 *
 * The problem:
 * - Late night events (10pm) in non-UTC timezones show the wrong day in the pattern description
 * - Example: Monday 10pm in America/New_York shows as "every week on Tuesday" in some parts of the UI
 * - But the actual occurrences list shows correctly as "Mon, May 26, 2025 10:00 PM EDT"
 *
 * This test reproduces the issue and shows how to fix it by ensuring consistent
 * timezone handling when generating pattern descriptions.
 */
describe('RecurrencePatternDateMismatch - Fix', () => {
  it('shows how the mismatch happens when using inconsistent timezone context', () => {
    // Create start date representing Monday 10pm Eastern (Tuesday 2am UTC)
    const startDate = new Date('2025-05-20T02:00:00.000Z')

    // This is the core of the issue: different formatting produces different day names
    const dayInUTC = formatInTimeZone(startDate, 'UTC', 'EEEE')
    const dayInNewYork = formatInTimeZone(startDate, 'America/New_York', 'EEEE')

    console.log('Date representation in different contexts:', {
      utcIsoString: startDate.toISOString(),
      utcDay: dayInUTC,
      newYorkDay: dayInNewYork,
      newYorkDateTime: formatInTimeZone(startDate, 'America/New_York', 'yyyy-MM-dd h:mm a')
    })

    // The issue happens when the UI displays the UTC day instead of timezone-adjusted day
    expect(dayInUTC).toBe('Tuesday')
    expect(dayInNewYork).toBe('Monday')
  })

  it('demonstrates the correct way to generate and display a pattern description', () => {
    // Create a rule with Monday selected
    const rule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['MO'], // Monday explicitly selected
      timeZone: 'America/New_York'
    }

    // Generate the RRule with the proper timezone context
    const rrule = RecurrenceService.toRRule(
      rule,
      '2025-05-20T02:00:00.000Z', // This is Tuesday in UTC, but Monday in New York
      'America/New_York'
    )

    // Get the pattern description
    const description = rrule.toText()
    console.log('Generated pattern description:', description)

    // It should correctly mention Monday
    expect(description.toLowerCase()).toContain('monday')

    // This is how you would display it in the UI, with the timezone appended
    const tzDisplay = RecurrenceService.getTimezoneDisplay('America/New_York')
    const fullDescription = `${description} (${tzDisplay.split(' ').pop()?.replace(/[()]/g, '')})`
    console.log('UI pattern description with timezone:', fullDescription)

    // Should be "every week on Monday (EDT)"
    expect(fullDescription.toLowerCase()).toContain('monday')
    expect(fullDescription).toContain('EDT')
  })

  it('demonstrates how to correctly format occurrence dates for display', () => {
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

    // Get the occurrences
    const occurrences = RecurrenceService.getOccurrences(event, 3)

    // Format occurrence dates for UI display
    const formattedOccurrences = occurrences.map(date => {
      // 'EEE, MMM d, yyyy h:mm a zzz' format gives: "Mon, May 26, 2025 10:00 PM EDT"
      return formatInTimeZone(date, 'America/New_York', 'EEE, MMM d, yyyy h:mm a zzz')
    })

    console.log('Formatted occurrences for UI display:', formattedOccurrences)

    // All occurrences should be formatted as Monday
    formattedOccurrences.forEach(formattedDate => {
      expect(formattedDate.startsWith('Mon')).toBe(true)
      expect(formattedDate).toContain('10:00 PM EDT')
    })
  })

  /**
   * THIS TEST REPRODUCES THE BUG that's likely in your UI code
   * You need to check where the pattern description is being displayed and
   * ensure it's using the event's timezone consistently.
   */
  it('reproduces the bug that might be happening in your UI', () => {
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

    // The bug might be here - somewhere in UI code could be ignoring timezone
    // and using UTC day for description while using timezone for occurrence display

    // BUGGY APPROACH - using UTC day for description
    const startDateUTC = new Date(event.startDate)
    const dayInUTC = startDateUTC.toLocaleDateString('en-US', { weekday: 'long' }) // Will use system timezone, likely UTC in CI
    const buggyDescription = `every week on ${dayInUTC}`
    console.log('BUGGY pattern description using UTC day:', buggyDescription)

    // CORRECT APPROACH - using timezone-adjusted day for both
    const correctDay = formatInTimeZone(new Date(event.startDate), event.timeZone, 'EEEE')
    const correctDescription = `every week on ${correctDay}`
    console.log('CORRECT pattern description using timezone day:', correctDescription)

    // Format occurrences (which are always correct because they use timezone)
    const occurrences = RecurrenceService.getOccurrences(event, 3)
    const formattedOccurrences = occurrences.map(date => {
      return formatInTimeZone(date, event.timeZone, 'EEE, MMM d, yyyy h:mm a zzz')
    })
    console.log('Occurrences display (always correct):', formattedOccurrences)

    // The mismatch - description says Tuesday but occurrences show Monday
    expect(buggyDescription.toLowerCase()).toContain('tuesday')
    formattedOccurrences.forEach(formattedDate => {
      expect(formattedDate.startsWith('Mon')).toBe(true)
    })
  })
})
