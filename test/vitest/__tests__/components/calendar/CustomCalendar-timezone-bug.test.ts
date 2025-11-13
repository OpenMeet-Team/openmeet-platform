import { describe, it, expect } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * Test Suite: CustomCalendar Timezone Display Bug (Screenshot Issue)
 *
 * This test reproduces the bug reported in the screenshot where:
 * - A Wednesday evening event (6pm PST Nov 12) displays on Thursday (Nov 13)
 * - The calendar extracts date from UTC string without timezone conversion
 *
 * ROOT CAUSE: CustomCalendar.vue lines 663, 708, 744
 * ```typescript
 * date: event.startDate.split('T')[0]  // ❌ Uses UTC date!
 * ```
 *
 * EXPECTED BEHAVIOR:
 * - Event at 2025-11-13T02:00:00.000Z in America/Vancouver timezone
 * - Should display on Wednesday, November 12, 2025 at 6:00 PM PST
 *
 * ACTUAL BEHAVIOR (BUG):
 * - Displays on Thursday, November 13, 2025 (wrong day!)
 */
describe('CustomCalendar - Timezone Display Bug (Issue #281)', () => {
  describe('Date Extraction Bug', () => {
    it('should demonstrate the UTC date extraction bug', () => {
      // Event from the screenshot
      const event = {
        ulid: 'crmc-november-meeting',
        name: 'CRMC Monthly Meeting',
        startDate: '2025-11-13T02:00:00.000Z', // 6pm PST Nov 12
        endDate: '2025-11-13T05:00:00.000Z', // 9pm PST Nov 12
        isAllDay: false,
        timeZone: 'America/Vancouver'
      }

      // Current (WRONG) implementation
      const buggyDate = event.startDate.split('T')[0]
      console.log('\n=== Date Extraction Bug ===')
      console.log('Event UTC string:', event.startDate)
      console.log('Buggy extraction (split on T):', buggyDate)
      console.log('This gives us:', 'November 13 (Thursday)')

      // Correct implementation
      const correctDate = formatInTimeZone(
        new Date(event.startDate),
        event.timeZone,
        'yyyy-MM-dd'
      )
      console.log('\nCorrect extraction (with timezone):', correctDate)
      console.log('This gives us:', 'November 12 (Wednesday)')
      console.log('========================\n')

      expect(buggyDate).toBe('2025-11-13') // Current bug
      expect(correctDate).toBe('2025-11-12') // What it should be
      expect(buggyDate).not.toBe(correctDate) // They're different!
    })

    it('should demonstrate the day-of-week error from screenshot', () => {
      // The exact scenario from the screenshot
      const wednesdayEvent = {
        startDate: '2025-11-13T02:00:00.000Z', // Wednesday 6pm PST = Thursday 2am UTC
        timeZone: 'America/Vancouver'
      }

      // What the buggy code does
      const buggyDate = wednesdayEvent.startDate.split('T')[0]
      const buggyDayOfWeek = new Date(buggyDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })

      // What it should be
      const correctDate = formatInTimeZone(
        new Date(wednesdayEvent.startDate),
        wednesdayEvent.timeZone,
        'yyyy-MM-dd'
      )
      const correctDayOfWeek = formatInTimeZone(
        new Date(wednesdayEvent.startDate),
        wednesdayEvent.timeZone,
        'EEEE'
      )

      console.log('\n=== Day of Week Error ===')
      console.log('Event stored in DB:', wednesdayEvent.startDate)
      console.log('Event timezone:', wednesdayEvent.timeZone)
      console.log('\nBuggy extraction:')
      console.log('  Date:', buggyDate)
      console.log('  Day:', buggyDayOfWeek)
      console.log('\nCorrect extraction:')
      console.log('  Date:', correctDate)
      console.log('  Day:', correctDayOfWeek)
      console.log('========================\n')

      // The bug causes the event to show on the wrong day
      expect(buggyDayOfWeek).toBe('Thursday')
      expect(correctDayOfWeek).toBe('Wednesday')
    })

    it('should show the bug affects PST/PDT events crossing midnight UTC', () => {
      // Events in the evening (PST/PDT) that cross midnight in UTC
      const testCases = [
        {
          name: 'Evening event in October (PDT)',
          startDate: '2025-10-09T02:00:00.000Z', // 7pm PDT Oct 8
          timeZone: 'America/Vancouver',
          expectedDate: '2025-10-08',
          expectedDay: 'Wednesday'
        },
        {
          name: 'Evening event in November (PST)',
          startDate: '2025-11-13T03:00:00.000Z', // 7pm PST Nov 12
          timeZone: 'America/Vancouver',
          expectedDate: '2025-11-12',
          expectedDay: 'Wednesday'
        },
        {
          name: 'Late evening event (PST)',
          startDate: '2025-11-13T06:00:00.000Z', // 10pm PST Nov 12
          timeZone: 'America/Vancouver',
          expectedDate: '2025-11-12',
          expectedDay: 'Wednesday'
        }
      ]

      console.log('\n=== UTC Midnight Crossing Bug ===')
      testCases.forEach(testCase => {
        const buggyDate = testCase.startDate.split('T')[0]
        const correctDate = formatInTimeZone(
          new Date(testCase.startDate),
          testCase.timeZone,
          'yyyy-MM-dd'
        )
        const correctDay = formatInTimeZone(
          new Date(testCase.startDate),
          testCase.timeZone,
          'EEEE'
        )

        console.log(`\n${testCase.name}:`)
        console.log(`  UTC: ${testCase.startDate}`)
        console.log(`  Buggy date: ${buggyDate} (wrong!)`)
        console.log(`  Correct date: ${correctDate}`)
        console.log(`  Correct day: ${correctDay}`)

        expect(correctDate).toBe(testCase.expectedDate)
        expect(correctDay).toBe(testCase.expectedDay)
        expect(buggyDate).not.toBe(correctDate)
      })
      console.log('========================\n')
    })
  })

  describe('Time Display Bug', () => {
    it('should demonstrate the toLocaleTimeString bug', () => {
      const event = {
        startDate: '2025-11-13T02:00:00.000Z',
        timeZone: 'America/Vancouver' // PST (UTC-8)
      }

      // Current (WRONG) implementation - uses browser timezone
      const startTime = new Date(event.startDate)
      // Note: This will vary based on where the test runs!
      const buggyTime = startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      // Correct implementation - uses event timezone
      const correctTime = formatInTimeZone(
        new Date(event.startDate),
        event.timeZone,
        'HH:mm'
      )

      console.log('\n=== Time Display Bug ===')
      console.log('Event UTC:', event.startDate)
      console.log('Event timezone:', event.timeZone)
      console.log('Buggy time (browser TZ):', buggyTime)
      console.log('Correct time (event TZ):', correctTime, 'PST')
      console.log('========================\n')

      // The correct time should be 18:00 (6pm PST)
      expect(correctTime).toBe('18:00')
    })
  })

  describe('Proposed Fix', () => {
    // Helper function that should replace the buggy code
    function getEventDateInTimezone (startDate: string, timeZone: string): string {
      return formatInTimeZone(new Date(startDate), timeZone, 'yyyy-MM-dd')
    }

    function getEventTimeDisplay (
      startDate: string,
      endDate: string | undefined,
      timeZone: string,
      isAllDay: boolean
    ): string | undefined {
      if (isAllDay) return undefined

      const startTime = formatInTimeZone(new Date(startDate), timeZone, 'HH:mm')

      if (endDate) {
        const endTime = formatInTimeZone(new Date(endDate), timeZone, 'HH:mm')
        return `${startTime}-${endTime}`
      }

      return startTime
    }

    it('should correctly extract date with timezone', () => {
      const event = {
        startDate: '2025-11-13T02:00:00.000Z',
        endDate: '2025-11-13T05:00:00.000Z',
        timeZone: 'America/Vancouver',
        isAllDay: false
      }

      // Use the fixed function
      const date = getEventDateInTimezone(event.startDate, event.timeZone)
      const time = getEventTimeDisplay(
        event.startDate,
        event.endDate,
        event.timeZone,
        event.isAllDay
      )

      console.log('\n=== Proposed Fix Works ===')
      console.log('Date:', date, '(Wednesday Nov 12)')
      console.log('Time:', time, '(6pm-9pm PST)')
      console.log('========================\n')

      expect(date).toBe('2025-11-12')
      expect(time).toBe('18:00-21:00')
    })

    it('should work across DST transitions', () => {
      const events = [
        {
          name: 'October event (PDT)',
          startDate: '2025-10-09T02:00:00.000Z', // 7pm PDT Oct 8
          timeZone: 'America/Vancouver',
          expectedDate: '2025-10-08',
          expectedTime: '19:00'
        },
        {
          name: 'November event (PST)',
          startDate: '2025-11-13T03:00:00.000Z', // 7pm PST Nov 12
          timeZone: 'America/Vancouver',
          expectedDate: '2025-11-12',
          expectedTime: '19:00'
        }
      ]

      console.log('\n=== DST Transition Test ===')
      events.forEach(event => {
        const date = getEventDateInTimezone(event.startDate, event.timeZone)
        const time = getEventTimeDisplay(
          event.startDate,
          undefined,
          event.timeZone,
          false
        )

        console.log(`${event.name}:`)
        console.log(`  Date: ${date} (expected: ${event.expectedDate})`)
        console.log(`  Time: ${time} (expected: ${event.expectedTime})`)

        expect(date).toBe(event.expectedDate)
        expect(time).toBe(event.expectedTime)
      })
      console.log('========================\n')
    })
  })
})
