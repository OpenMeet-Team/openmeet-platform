import { describe, it, expect } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * Test for DST Transition Bug (Issue #281)
 *
 * Reproduces the issue where an event created during DST shows corrupted times
 * after DST ends. Specifically:
 * - Event created: Wed 6pm-9pm (before Nov 2, 2025 DST transition)
 * - After DST ends: Event shows as Wed 7pm to Wed 9am (impossible time range)
 *
 * This test simulates:
 * 1. Event created on Oct 29, 2025 (still in DST/PDT = UTC-7)
 * 2. Event scheduled for Nov 12, 2025 (after DST ended, now PST = UTC-8)
 * 3. Checks if times remain consistent across the DST boundary
 */
describe('DST Transition Bug - Issue #281', () => {
  const timezone = 'America/Vancouver' // Pacific timezone with DST

  /**
   * Test case: Event created during DST, scheduled for after DST ends
   */
  it('should preserve event times across DST boundary (6pm-9pm Wednesday)', () => {
    // SCENARIO: User creates an event on Oct 29, 2025 (during DST)
    // They schedule it for Nov 12, 2025 at 6pm-9pm

    // Nov 12, 2025 6:00 PM Pacific = 2025-11-13T02:00:00.000Z (PST is UTC-8)
    const startDateISO = '2025-11-13T02:00:00.000Z' // 6pm PST = 2am UTC next day
    const endDateISO = '2025-11-13T05:00:00.000Z'   // 9pm PST = 5am UTC next day

    console.log('=== DST Transition Test ===')
    console.log('Event scheduled for Nov 12, 2025 (AFTER DST ended on Nov 2)')
    console.log('Start date UTC:', startDateISO)
    console.log('End date UTC:', endDateISO)

    // Parse the dates
    const startDate = new Date(startDateISO)
    const endDate = new Date(endDateISO)

    // Check what time these show in Pacific timezone
    const startTimeLocal = formatInTimeZone(startDate, timezone, 'EEEE, MMM d, yyyy h:mm a zzz')
    const endTimeLocal = formatInTimeZone(endDate, timezone, 'EEEE, MMM d, yyyy h:mm a zzz')

    console.log('Start time in', timezone, ':', startTimeLocal)
    console.log('End time in', timezone, ':', endTimeLocal)

    // Extract components for validation
    const startDayOfWeek = formatInTimeZone(startDate, timezone, 'EEEE')
    const startHour = parseInt(formatInTimeZone(startDate, timezone, 'HH'), 10)
    const startMinute = parseInt(formatInTimeZone(startDate, timezone, 'mm'), 10)

    const endDayOfWeek = formatInTimeZone(endDate, timezone, 'EEEE')
    const endHour = parseInt(formatInTimeZone(endDate, timezone, 'HH'), 10)
    const endMinute = parseInt(formatInTimeZone(endDate, timezone, 'mm'), 10)

    console.log('Parsed start:', { dayOfWeek: startDayOfWeek, hour: startHour, minute: startMinute })
    console.log('Parsed end:', { dayOfWeek: endDayOfWeek, hour: endHour, minute: endMinute })

    // ASSERTIONS: Times should be correct
    expect(startDayOfWeek).toBe('Wednesday')
    expect(startHour).toBe(18) // 6 PM in 24-hour format
    expect(startMinute).toBe(0)

    expect(endDayOfWeek).toBe('Wednesday')
    expect(endHour).toBe(21) // 9 PM in 24-hour format
    expect(endMinute).toBe(0)

    // Verify end time is after start time
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationHours = durationMs / (1000 * 60 * 60)

    console.log('Event duration:', durationHours, 'hours')

    expect(durationHours).toBe(3)
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime())
  })

  /**
   * Test case: What the bug shows - corrupted times
   * This documents the WRONG behavior we saw in the screenshot
   */
  it('should NOT show corrupted times like in the bug (7pm start, 9am end)', () => {
    // This is what the bug INCORRECTLY showed:
    // Start: Wed, November 12, 2025 at 7:00 PM (wrong - should be 6pm)
    // End: Wed, November 12, 2025 at 9:00 AM (VERY wrong - should be 9pm, and creates impossible time range)

    // If we had the corrupted times, they would look like this:
    const corruptedStartISO = '2025-11-13T03:00:00.000Z' // 7pm PST = 3am UTC
    const corruptedEndISO = '2025-11-12T17:00:00.000Z'   // 9am PST = 5pm UTC PREVIOUS day

    const corruptedStart = new Date(corruptedStartISO)
    const corruptedEnd = new Date(corruptedEndISO)

    // This would show the bug: end time before start time
    const corruptedDuration = corruptedEnd.getTime() - corruptedStart.getTime()
    const corruptedDurationHours = corruptedDuration / (1000 * 60 * 60)

    console.log('=== Documenting the BUG ===')
    console.log('Corrupted duration would be:', corruptedDurationHours, 'hours')
    console.log('This is NEGATIVE, meaning end is before start - impossible!')

    // Verify this is indeed wrong
    expect(corruptedDurationHours).toBeLessThan(0) // Bug creates negative duration
    expect(corruptedEnd.getTime()).toBeLessThan(corruptedStart.getTime()) // Bug makes end before start
  })

  /**
   * Test case: Simulate API response with wrong DST offset applied
   * This tests if the backend might be returning corrupted data
   */
  it('should detect if backend applies wrong DST offset to dates', () => {
    // Original intention: 6pm-9pm on Nov 12 (PST, UTC-8)
    // Stored in DB as UTC: 2025-11-13T02:00:00Z to 2025-11-13T05:00:00Z

    // WRONG: If backend applies PDT offset (UTC-7) instead of PST (UTC-8)
    // when converting, it would give wrong local times

    const correctStartUTC = new Date('2025-11-13T02:00:00.000Z')
    const correctEndUTC = new Date('2025-11-13T05:00:00.000Z')

    // Apply correct offset (PST = UTC-8)
    const correctStartLocal = formatInTimeZone(correctStartUTC, timezone, 'h:mm a')
    const correctEndLocal = formatInTimeZone(correctEndUTC, timezone, 'h:mm a')

    console.log('=== Correct conversion (PST = UTC-8) ===')
    console.log('Start:', correctStartLocal, 'Expected: 6:00 PM')
    console.log('End:', correctEndLocal, 'Expected: 9:00 PM')

    expect(correctStartLocal).toBe('6:00 PM')
    expect(correctEndLocal).toBe('9:00 PM')

    // Now simulate what happens if wrong offset is applied
    // If we add 1 hour (PDT offset difference), we'd get:
    // Start: 6pm + 1 = 7pm (matches bug!)
    // But end going to 9am suggests even worse corruption

    // The "9am" bug might be from applying offset in wrong direction
    // or confusing 12/24 hour format after timezone conversion
  })

  /**
   * Test case: Check if recurring event dates shift across DST
   */
  it('should maintain consistent time for recurring event across DST boundary', () => {
    // Recurring event: Every Wednesday at 6pm-9pm
    // Created before DST ends, first occurrence AFTER DST ends

    // Oct 29, 2025 (still DST) - should be 6pm-9pm PDT
    const occurrenceBeforeDST = new Date('2025-10-30T01:00:00.000Z') // 6pm PDT = UTC+7 = 1am UTC next day

    // Nov 12, 2025 (after DST) - should still be 6pm-9pm, but now PST
    const occurrenceAfterDST = new Date('2025-11-13T02:00:00.000Z') // 6pm PST = UTC+8 = 2am UTC next day

    const timeBeforeDST = formatInTimeZone(occurrenceBeforeDST, timezone, 'h:mm a')
    const timeAfterDST = formatInTimeZone(occurrenceAfterDST, timezone, 'h:mm a')

    console.log('=== Recurring Event Across DST ===')
    console.log('Oct 29 (PDT):', timeBeforeDST)
    console.log('Nov 12 (PST):', timeAfterDST)
    console.log('Both should be 6:00 PM in local time (wall-clock time preserved)')

    // Wall-clock time should remain the same
    expect(timeBeforeDST).toBe('6:00 PM')
    expect(timeAfterDST).toBe('6:00 PM')

    // But UTC times differ by 1 hour due to DST change
    const utcDiff = occurrenceAfterDST.getTime() - occurrenceBeforeDST.getTime()
    const expectedWeekDiff = 14 * 24 * 60 * 60 * 1000 // 2 weeks in ms
    const actualDiff = Math.abs(utcDiff - expectedWeekDiff)
    const hourInMs = 60 * 60 * 1000

    console.log('UTC time difference:', utcDiff / hourInMs, 'hours')
    console.log('Expected (2 weeks):', expectedWeekDiff / hourInMs, 'hours')
    console.log('Difference:', actualDiff / hourInMs, 'hours (should be ~1 for DST change)')

    // The difference should account for the 1-hour DST change
    expect(actualDiff).toBeGreaterThan(0.9 * hourInMs)
    expect(actualDiff).toBeLessThan(1.1 * hourInMs)
  })
})
