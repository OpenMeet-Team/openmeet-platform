import { describe, it, expect } from 'vitest'
import { toBackendRecurrenceRule, toFrontendRecurrenceRule, buildRecurrenceRule, generateOccurrences, getHumanReadablePattern } from './recurrenceUtils'
import { RecurrenceRule } from '../types/event'
import { RecurrenceRuleDto } from '../api/event-series'
import { formatInTimeZone } from 'date-fns-tz'

describe('recurrenceUtils', () => {
  describe('toBackendRecurrenceRule', () => {
    it('should convert frontend RecurrenceRule to backend RecurrenceRuleDto', () => {
      const frontendRule: Partial<RecurrenceRule> = {
        frequency: 'WEEKLY',
        interval: 2,
        count: 10,
        byweekday: ['MO', 'WE', 'FR']
      }

      const result = toBackendRecurrenceRule(frontendRule)

      expect(result).toEqual({
        frequency: 'WEEKLY',
        interval: 2,
        count: 10,
        byweekday: ['MO', 'WE', 'FR']
      })
    })

    it('should handle missing properties', () => {
      const frontendRule: Partial<RecurrenceRule> = {
        frequency: 'DAILY'
      }

      const result = toBackendRecurrenceRule(frontendRule)

      expect(result).toEqual({
        frequency: 'DAILY',
        interval: undefined,
        count: undefined,
        until: undefined,
        byweekday: undefined,
        bymonth: undefined,
        bymonthday: undefined,
        wkst: undefined
      })
    })

    it('should provide default frequency if not provided', () => {
      const frontendRule: Partial<RecurrenceRule> = {
        interval: 1
      }

      const result = toBackendRecurrenceRule(frontendRule)

      expect(result.frequency).toEqual('WEEKLY')
    })
  })

  describe('toFrontendRecurrenceRule', () => {
    it('should convert backend RecurrenceRuleDto to frontend RecurrenceRule', () => {
      const backendRule: RecurrenceRuleDto = {
        frequency: 'MONTHLY',
        interval: 3,
        byweekday: ['TU', 'TH'],
        bymonth: [1, 6],
        bymonthday: [15]
      }

      const result = toFrontendRecurrenceRule(backendRule)

      expect(result).toEqual({
        frequency: 'MONTHLY',
        interval: 3,
        count: undefined,
        until: undefined,
        byweekday: ['TU', 'TH'],
        bymonth: [1, 6],
        bymonthday: [15],
        wkst: undefined
      })
    })

    it('should handle null input', () => {
      const result = toFrontendRecurrenceRule(null)

      expect(result).toEqual({
        frequency: 'WEEKLY'
      })
    })
  })

  it('generates weekly recurrences on the correct weekday in America/New_York', () => {
    const rule = buildRecurrenceRule({
      startDateLocal: '2024-06-10T09:00:00',
      timeZone: 'America/New_York',
      frequency: 'WEEKLY',
      byweekday: ['MO'],
      interval: 1
    })
    const occurrences = generateOccurrences(rule, '2024-06-10T09:00:00', 'America/New_York', 5)
    // All should be Monday in NY
    const allMondays = occurrences.every(date =>
      formatInTimeZone(date, 'America/New_York', 'EEEE') === 'Monday'
    )
    expect(allMondays).toBe(true)
  })

  it('generates monthly recurrences on the 2nd Wednesday in America/New_York', () => {
    const rule = buildRecurrenceRule({
      startDateLocal: '2024-06-12T09:00:00', // 2nd Wednesday of June 2024
      timeZone: 'America/New_York',
      frequency: 'MONTHLY',
      byweekday: ['WE'],
      bysetpos: [2],
      interval: 1
    })
    const occurrences = generateOccurrences(rule, '2024-06-12T09:00:00', 'America/New_York', 3)
    // All should be Wednesday in NY
    const allWednesdays = occurrences.every(date =>
      formatInTimeZone(date, 'America/New_York', 'EEEE') === 'Wednesday'
    )
    expect(allWednesdays).toBe(true)
  })

  it('handles DST spring forward in US (2am skip)', () => {
    // 2024-03-10 is the DST start in US (clocks jump from 2am to 3am)
    const rule = buildRecurrenceRule({
      startDateLocal: '2024-03-10T09:00:00', // 9am local
      timeZone: 'America/New_York',
      frequency: 'WEEKLY',
      byweekday: ['SU'],
      interval: 1
    })
    const occurrences = generateOccurrences(rule, '2024-03-10T09:00:00', 'America/New_York', 3)
    // All should be Sunday in NY
    const allSundays = occurrences.every(date =>
      formatInTimeZone(date, 'America/New_York', 'EEEE') === 'Sunday'
    )
    expect(allSundays).toBe(true)
  })

  it('produces a human-readable pattern for monthly 2nd Wednesday', () => {
    const rule = buildRecurrenceRule({
      startDateLocal: '2024-06-12T09:00:00',
      timeZone: 'America/New_York',
      frequency: 'MONTHLY',
      byweekday: ['WE'],
      bysetpos: [2],
      interval: 1
    })
    const text = getHumanReadablePattern(rule, '2024-06-12T09:00:00', 'America/New_York')
    expect(text.toLowerCase()).toContain('wednesday')
    expect(text.toLowerCase()).toContain('month')
  })

  describe('BUG: Recurrence should anchor to correct local time in timezone', () => {
    it('should generate the first occurrence at the correct UTC time for a local 10:00 PM event in America/New_York', () => {
      // 10:00 PM on May 17, 2025 in America/New_York is 2025-05-18T02:00:00.000Z
      const startDateUtc = '2025-05-18T02:00:00.000Z'
      const timeZone = 'America/New_York'
      const rule = buildRecurrenceRule({
        startDateLocal: '2025-05-17T22:00:00', // 10:00 PM local
        timeZone,
        frequency: 'WEEKLY',
        interval: 1
      })
      // Simulate what the UI does: pass the UTC ISO string and timezone
      const occurrences = generateOccurrences(rule, '2025-05-17T22:00:00', timeZone, 1)
      // The first occurrence should be 2025-05-18T02:00:00.000Z
      expect(occurrences[0].toISOString()).toBe(startDateUtc)
      // And in the event timezone, it should be 10:00 PM on May 17
      expect(formatInTimeZone(occurrences[0], timeZone, 'yyyy-MM-dd HH:mm')).toBe('2025-05-17 22:00')
    })
  })
})
