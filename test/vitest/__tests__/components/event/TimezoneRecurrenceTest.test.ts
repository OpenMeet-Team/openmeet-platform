import { describe, it, expect } from 'vitest'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/**
 * Test to understand timezone behavior for recurring events across DST boundaries
 *
 * Key Question: Should recurring events maintain:
 * 1. "Wall clock time" (7pm stays 7pm) - Changes UTC time across DST
 * 2. "Absolute time" (UTC time stays same) - Changes local time across DST
 *
 * For calendar events, we typically want #1 (wall clock time)
 */
describe('Timezone and DST Behavior for Recurring Events', () => {
  const timezone = 'America/Vancouver' // Pacific timezone with DST

  /**
   * DST Transition Facts for America/Vancouver:
   * - DST starts: 2nd Sunday in March at 2am → 3am (UTC-7)
   * - DST ends: 1st Sunday in November at 2am → 1am (UTC-8)
   * - 2025 DST ended: November 2, 2025 at 2:00 AM
   */

  describe('Understanding UTC vs Local Time', () => {
    it('should show how the same UTC time converts to different local times across DST', () => {
      // Same UTC time before and after DST ends
      const utcTime = '2025-10-09T02:00:00.000Z' // October (during PDT)
      const sameUtcTimeInNov = '2025-11-13T02:00:00.000Z' // November (during PST)

      const octLocal = formatInTimeZone(utcTime, timezone, 'h:mm a zzz')
      const novLocal = formatInTimeZone(sameUtcTimeInNov, timezone, 'h:mm a zzz')

      console.log('\n=== Same UTC Time, Different Local Time ===')
      console.log('Oct 9 - UTC 02:00 converts to:', octLocal) // 7:00 PM PDT
      console.log('Nov 13 - UTC 02:00 converts to:', novLocal) // 6:00 PM PST

      // October: UTC 02:00 = 7pm PDT (UTC-7)
      const octHour = parseInt(formatInTimeZone(utcTime, timezone, 'HH'), 10)
      expect(octHour).toBe(19) // 7pm

      // November: UTC 02:00 = 6pm PST (UTC-8)
      const novHour = parseInt(formatInTimeZone(sameUtcTimeInNov, timezone, 'HH'), 10)
      expect(novHour).toBe(18) // 6pm

      console.log('❌ Problem: If we store UTC 02:00 for both months, the local time shifts!')
    })

    it('should show how to maintain the same local time across DST', () => {
      // To keep 7pm local time in both months, we need DIFFERENT UTC times

      // October: 7pm PDT = UTC 02:00 (UTC-7)
      const oct7pmLocal = '2025-10-09 19:00:00'
      const oct7pmUtc = fromZonedTime(oct7pmLocal, timezone)

      // November: 7pm PST = UTC 03:00 (UTC-8)
      const nov7pmLocal = '2025-11-13 19:00:00'
      const nov7pmUtc = fromZonedTime(nov7pmLocal, timezone)

      console.log('\n=== Same Local Time, Different UTC Time ===')
      console.log('Oct 9 - 7pm local stores as UTC:', oct7pmUtc.toISOString())
      console.log('Nov 13 - 7pm local stores as UTC:', nov7pmUtc.toISOString())

      // Verify both convert back to 7pm
      const octVerify = formatInTimeZone(oct7pmUtc, timezone, 'h:mm a')
      const novVerify = formatInTimeZone(nov7pmUtc, timezone, 'h:mm a')

      expect(octVerify).toBe('7:00 PM')
      expect(novVerify).toBe('7:00 PM')

      console.log('✅ Solution: Store different UTC times to maintain same local time')
    })
  })

  describe('How Our DatetimeComponent Works', () => {
    it('should correctly convert local time to UTC using fromZonedTime', () => {
      // Simulating what DatetimeComponent.createISOString() does

      // User selects: Nov 12, 2025 at 7:00 PM in Vancouver timezone
      const userDate = '2025-11-12'
      // const userTime = '7:00 PM' // For documentation - actual time is hardcoded below
      const userTimezone = 'America/Vancouver'

      // Parse time (simplified from actual component logic)
      const [year, month, day] = userDate.split('-').map(Number)
      const hours = 19 // 7 PM
      const minutes = 0

      // Create wall time string (what user sees)
      const wallTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
      console.log('\n=== DatetimeComponent Conversion ===')
      console.log('Wall time string:', wallTimeString) // 2025-11-12T19:00:00

      // Convert to UTC (this is what fromZonedTime does)
      const utcDate = fromZonedTime(wallTimeString, userTimezone)
      console.log('Stored as UTC:', utcDate.toISOString())

      // Verify it converts back correctly
      const verifyLocal = formatInTimeZone(utcDate, userTimezone, 'h:mm a zzz')
      console.log('Converts back to:', verifyLocal)

      expect(verifyLocal).toBe('7:00 PM PST')
      expect(utcDate.toISOString()).toBe('2025-11-13T03:00:00.000Z') // 7pm PST = UTC+8
    })
  })

  describe('The CRMC Event Mystery', () => {
    it('should reproduce what happened with the CRMC event', () => {
      console.log('\n=== CRMC Event Timeline ===')

      // Events were created in May for dates from June to November
      // All with 7pm-9pm local time

      // October event (before DST ends) - CORRECT
      const octEvent = {
        startUtc: '2025-10-09T02:00:00.000Z', // 7pm PDT
        endUtc: '2025-10-09T04:00:00.000Z' // 9pm PDT
      }

      const octStart = formatInTimeZone(octEvent.startUtc, timezone, 'h:mm a zzz')
      const octEnd = formatInTimeZone(octEvent.endUtc, timezone, 'h:mm a zzz')

      console.log('October event: ', octStart, 'to', octEnd) // 7:00 PM PDT to 9:00 PM PDT
      expect(octStart).toBe('7:00 PM PDT')

      // November event - WRONG (if using same UTC time)
      const novEventWrong = {
        startUtc: '2025-11-13T02:00:00.000Z', // Same UTC as October!
        endUtc: '2025-11-13T04:00:00.000Z'
      }

      const novStartWrong = formatInTimeZone(novEventWrong.startUtc, timezone, 'h:mm a zzz')
      const novEndWrong = formatInTimeZone(novEventWrong.endUtc, timezone, 'h:mm a zzz')

      console.log('November event (WRONG):', novStartWrong, 'to', novEndWrong)
      expect(novStartWrong).toBe('6:00 PM PST') // ❌ Shifted to 6pm!

      // November event - CORRECT (adjusted for DST)
      const novEventCorrect = {
        startUtc: '2025-11-13T03:00:00.000Z', // One hour later in UTC!
        endUtc: '2025-11-13T05:00:00.000Z'
      }

      const novStartCorrect = formatInTimeZone(novEventCorrect.startUtc, timezone, 'h:mm a zzz')
      const novEndCorrect = formatInTimeZone(novEventCorrect.endUtc, timezone, 'h:mm a zzz')

      console.log('November event (CORRECT):', novStartCorrect, 'to', novEndCorrect)
      expect(novStartCorrect).toBe('7:00 PM PST') // ✅ Stays at 7pm

      console.log('\n=== Conclusion ===')
      console.log('The bug: November event was stored with UTC 02:00 instead of 03:00')
      console.log('This caused it to show as 6pm PST instead of 7pm PST')
    })
  })

  describe('How Recurring Events Should Work', () => {
    it('should demonstrate wall clock time preservation (correct behavior)', () => {
      console.log('\n=== Recurring Event: Every Wednesday at 7pm ===')

      // For a recurring event, we want the LOCAL time to stay consistent
      // This means the UTC time will change across DST boundaries

      const occurrences = [
        { date: '2025-10-08', localTime: '7:00 PM', inDST: true }, // PDT (UTC-7)
        { date: '2025-10-15', localTime: '7:00 PM', inDST: true }, // PDT (UTC-7)
        { date: '2025-10-22', localTime: '7:00 PM', inDST: true }, // PDT (UTC-7)
        { date: '2025-10-29', localTime: '7:00 PM', inDST: true }, // PDT (UTC-7)
        { date: '2025-11-05', localTime: '7:00 PM', inDST: false }, // PST (UTC-8) - DST ended Nov 2
        { date: '2025-11-12', localTime: '7:00 PM', inDST: false } // PST (UTC-8)
      ]

      occurrences.forEach(({ date, localTime, inDST }) => {
        const wallTime = `${date} 19:00:00`
        const utcTime = fromZonedTime(wallTime, timezone)
        const verifyLocal = formatInTimeZone(utcTime, timezone, 'h:mm a zzz')
        const utcHour = utcTime.getUTCHours()

        console.log(`${date}: Local ${localTime} → UTC ${utcTime.toISOString()} → ${verifyLocal}`)

        expect(verifyLocal).toMatch(/7:00 PM (PDT|PST)/)

        // October: 7pm = UTC 02:00 (2am next day, UTC-7)
        // November: 7pm = UTC 03:00 (3am next day, UTC-8)
        if (inDST) {
          expect(utcHour).toBe(2) // PDT: UTC+7 hours
        } else {
          expect(utcHour).toBe(3) // PST: UTC+8 hours
        }
      })

      console.log('✅ Wall clock time stays at 7pm, UTC time shifts by 1 hour')
    })

    it('should show what happens if we DONT adjust for DST (wrong behavior)', () => {
      console.log('\n=== Bug: Using same UTC time for all occurrences ===')

      // If we naively use the same UTC time for all occurrences
      const fixedUtcHour = 2 // Assuming PDT offset

      const dates = ['2025-10-08', '2025-11-12']
      dates.forEach((date, index) => {
        const utcTime = `${date}T0${fixedUtcHour}:00:00.000Z`
        const localTime = formatInTimeZone(utcTime, timezone, 'h:mm a zzz')

        console.log(`${date}: UTC ${utcTime} → ${localTime}`)

        if (index === 0) {
          expect(localTime).toBe('7:00 PM PDT') // October - correct
        } else {
          expect(localTime).toBe('6:00 PM PST') // November - WRONG! Shifted back 1 hour
        }
      })

      console.log('❌ Bug: November occurrence shows 6pm instead of 7pm')
    })
  })

  describe('RRule Library Behavior', () => {
    it('should explain how RRule handles DST with tzid parameter', () => {
      console.log('\n=== RRule Library DST Handling ===')
      console.log('In recurrence-pattern.service.ts line 150:')
      console.log('  tzid: timeZone  // RRule\'s timezone handling for DST')
      console.log('')
      console.log('When tzid is set, RRule:')
      console.log('1. Preserves wall clock time across DST transitions')
      console.log('2. Automatically adjusts UTC times when DST changes')
      console.log('3. Generates occurrences that maintain local time')
      console.log('')
      console.log('Example: FREQ=WEEKLY;BYDAY=WE;BYHOUR=19 with tzid=America/Vancouver')
      console.log('- October: Generates 7pm PDT (UTC 02:00)')
      console.log('- November: Generates 7pm PST (UTC 03:00)')
      console.log('')
      console.log('✅ This is the CORRECT behavior for calendar events')
    })
  })

  describe('Potential Bug Location', () => {
    it('should identify where the bug might be', () => {
      console.log('\n=== Where Is The Bug? ===')
      console.log('')
      console.log('✅ Frontend (DatetimeComponent):')
      console.log('   - Uses fromZonedTime() correctly')
      console.log('   - Converts local time to proper UTC')
      console.log('')
      console.log('✅ Backend (RecurrencePatternService):')
      console.log('   - Uses RRule with tzid parameter')
      console.log('   - Should handle DST correctly')
      console.log('')
      console.log('❓ Potential issue:')
      console.log('   1. Event was created BEFORE DST ended (in May)')
      console.log('   2. Stored UTC time was correct for PDT (UTC 02:00 = 7pm PDT)')
      console.log('   3. After DST ended, that UTC time now means 6pm PST')
      console.log('   4. If recurring events are generated from stored UTC time')
      console.log('      instead of recalculating from local time + timezone,')
      console.log('      they will shift!')
      console.log('')
      console.log('🔍 Need to check: How are individual event occurrences generated?')
      console.log('   - Are they materialized in DB with UTC times?')
      console.log('   - Or dynamically calculated from series + timezone?')
    })
  })
})
