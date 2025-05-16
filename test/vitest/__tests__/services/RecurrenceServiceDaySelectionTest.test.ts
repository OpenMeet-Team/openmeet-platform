import { describe, it, expect } from 'vitest'
import { RecurrenceService } from '../../../../src/services/recurrenceService'
import { formatInTimeZone } from 'date-fns-tz'
import { RecurrenceRule } from '../../../../src/types/event'

/**
 * This test file specifically focuses on the RecurrenceService's implementation
 * of two key principles for recurring events:
 * 
 * 1. Preserve wall-clock time in the originating timezone - All recurring instances
 *    maintain the same local time in the event's timezone, even through DST changes.
 * 
 * 2. Day selection refers to days in the originating timezone - When a user selects
 *    "Thursday", this means Thursday in the event's timezone, regardless of what
 *    day that might be in UTC or other timezones.
 * 
 * It verifies that the service:
 * - Respects user-selected days over the start date's day
 * - Maintains consistent wall-clock time in the originating timezone
 * - Correctly handles timezone day boundaries without changing the user's selected days
 * - Properly generates occurrences that follow these principles
 */
describe('RecurrenceService Day Selection Tests', () => {
  
  /**
   * Test 1: Verify toRRule preserves user-selected day that differs from start date
   */
  it('should preserve user-selected day different from start date', () => {
    // Create a recurrence rule with user-selected day (Friday)
    // but start date is on Tuesday in the target timezone
    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['FR'], // User explicitly selected Friday
      timeZone: 'America/Vancouver'
    }
    
    // Tuesday in Vancouver
    const startDate = '2025-05-13T17:00:00.000Z'
    
    // Verify start date is Tuesday in Vancouver
    const startDateObj = new Date(startDate)
    const dayInVancouver = formatInTimeZone(startDateObj, 'America/Vancouver', 'EEEE')
    expect(dayInVancouver).toBe('Tuesday')
    
    // Call toRRule
    const rrule = RecurrenceService.toRRule(rule, startDate, 'America/Vancouver')
    
    // Generate occurrences to verify days
    const occurrences = rrule.all((_, i) => i < 3)
    
    // All occurrences should be on Friday in Vancouver
    const daysInVancouver = occurrences.map(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    
    console.log('User selected Friday, start date is Tuesday:', {
      rule,
      startDate,
      occurrenceDays: daysInVancouver,
      occurrenceDates: occurrences.map(d => d.toISOString())
    })
    
    // All occurrences should be on Friday
    expect(daysInVancouver.every(day => day === 'Friday')).toBe(true)
  })
  
  /**
   * Test 2: Test with a date at timezone boundary 
   * (Wednesday in UTC, Tuesday in Vancouver)
   */
  it('should respect user day selection with timezone boundary dates', () => {
    // Create a date that's Wednesday in UTC but Tuesday in Vancouver
    // May 14, 2025 at 03:30:00 UTC is May 13, 2025 at 20:30:00 Vancouver time (Tuesday)
    const startDate = '2025-05-14T03:30:00.000Z'
    
    // Create a recurrence rule with user-selected day (Thursday)
    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['TH'], // User explicitly selected Thursday
      timeZone: 'America/Vancouver'
    }
    
    // Verify start date is Wednesday in UTC but Tuesday in Vancouver
    const startDateObj = new Date(startDate)
    const dayInUTC = formatInTimeZone(startDateObj, 'UTC', 'EEEE')
    const dayInVancouver = formatInTimeZone(startDateObj, 'America/Vancouver', 'EEEE')
    
    expect(dayInUTC).toBe('Wednesday')
    expect(dayInVancouver).toBe('Tuesday')
    
    // Call toRRule
    const rrule = RecurrenceService.toRRule(rule, startDate, 'America/Vancouver')
    
    // Generate occurrences to verify days
    const occurrences = rrule.all((_, i) => i < 3)
    
    // All occurrences should be on Thursday in Vancouver
    const daysInVancouver = occurrences.map(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    
    console.log('Cross timezone boundary - User selected Thursday:', {
      rule,
      startDate,
      occurrenceDays: daysInVancouver,
      occurrenceDates: occurrences.map(d => d.toISOString())
    })
    
    // All occurrences should be on Thursday
    expect(daysInVancouver.every(day => day === 'Thursday')).toBe(true)
  })
  
  /**
   * Test 3: Multiple day selection
   */
  it('should handle multiple day selection', () => {
    // Create a rule with multiple selected days
    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['MO', 'WE', 'FR'], // User selected Monday, Wednesday, Friday
      timeZone: 'America/Vancouver'
    }
    
    // Tuesday in Vancouver
    const startDate = '2025-05-13T17:00:00.000Z'
    
    // Call toRRule
    const rrule = RecurrenceService.toRRule(rule, startDate, 'America/Vancouver')
    
    // Generate occurrences to verify days (get enough to cover all selected days)
    const occurrences = rrule.all((_, i) => i < 10)
    
    // Get unique days of week in Vancouver
    const daysInVancouver = occurrences.map(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    
    const uniqueDays = [...new Set(daysInVancouver)]
    
    console.log('Multiple days selected:', {
      rule,
      startDate,
      occurrenceDays: daysInVancouver,
      uniqueDays
    })
    
    // Should have exactly Monday, Wednesday, and Friday occurrences
    expect(uniqueDays).toContain('Monday')
    expect(uniqueDays).toContain('Wednesday')
    expect(uniqueDays).toContain('Friday')
    expect(uniqueDays.length).toBe(3)
  })
  
  /**
   * Test 4: Day selection with Sydney timezone (substantial UTC offset)
   */
  it('should respect day selection with Sydney timezone', () => {
    // Create a rule with Thursday selected
    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['TH'], // User selected Thursday
      timeZone: 'Australia/Sydney'
    }
    
    // Tuesday in Sydney
    const startDate = '2025-05-13T03:00:00.000Z' // Tuesday 13:00 in Sydney
    
    // Verify start date is Tuesday in Sydney
    const startDateObj = new Date(startDate)
    const dayInSydney = formatInTimeZone(startDateObj, 'Australia/Sydney', 'EEEE')
    expect(dayInSydney).toBe('Tuesday')
    
    // Call toRRule
    const rrule = RecurrenceService.toRRule(rule, startDate, 'Australia/Sydney')
    
    // Generate occurrences
    const occurrences = rrule.all((_, i) => i < 3)
    
    // All occurrences should be on Thursday in Sydney
    const daysInSydney = occurrences.map(date => 
      formatInTimeZone(date, 'Australia/Sydney', 'EEEE')
    )
    
    console.log('Sydney timezone - User selected Thursday:', {
      rule,
      startDate,
      occurrenceDays: daysInSydney,
      occurrenceDates: occurrences.map(d => d.toISOString())
    })
    
    // All occurrences should be on Thursday
    expect(daysInSydney.every(day => day === 'Thursday')).toBe(true)
  })
  
  /**
   * Test 5: Same day selection as start date - should work fine
   */
  it('should work correctly when selected day matches start date day', () => {
    // Create a rule with Tuesday selected (same as the start date's day)
    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['TU'], // User selected Tuesday
      timeZone: 'America/Vancouver'
    }
    
    // Tuesday in Vancouver
    const startDate = '2025-05-13T17:00:00.000Z'
    
    // Call toRRule
    const rrule = RecurrenceService.toRRule(rule, startDate, 'America/Vancouver')
    
    // Generate occurrences
    const occurrences = rrule.all((_, i) => i < 3)
    
    // All occurrences should be on Tuesday in Vancouver
    const daysInVancouver = occurrences.map(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    )
    
    console.log('Selected day matches start date day:', {
      rule,
      startDate,
      occurrenceDays: daysInVancouver,
      occurrenceDates: occurrences.map(d => d.toISOString())
    })
    
    // All occurrences should be on Tuesday
    expect(daysInVancouver.every(day => day === 'Tuesday')).toBe(true)
    
    // First occurrence should be the start date
    expect(occurrences[0].toISOString()).toBe(startDate)
  })
  
  /**
   * Test 6: Day selection with a start date right at midnight
   */
  it('should handle day selection with start date at midnight', () => {
    // Create a rule with Friday selected
    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      byweekday: ['FR'], // User selected Friday
      timeZone: 'America/Vancouver'
    }
    
    // Midnight Thursday/Friday in Vancouver
    // May 16, 2025 at 07:00:00 UTC is May 16, 2025 at 00:00:00 Vancouver time (Friday)
    const startDate = '2025-05-16T07:00:00.000Z'
    
    // Verify start date is Friday at midnight in Vancouver
    const startDateObj = new Date(startDate)
    const timeInVancouver = formatInTimeZone(startDateObj, 'America/Vancouver', 'EEEE HH:mm:ss')
    expect(timeInVancouver).toBe('Friday 00:00:00')
    
    // Call toRRule
    const rrule = RecurrenceService.toRRule(rule, startDate, 'America/Vancouver')
    
    // Generate occurrences
    const occurrences = rrule.all((_, i) => i < 3)
    
    // All occurrences should be on Friday in Vancouver
    const daysAndTimesInVancouver = occurrences.map(date => 
      formatInTimeZone(date, 'America/Vancouver', 'EEEE HH:mm:ss')
    )
    
    console.log('Start date at midnight:', {
      rule,
      startDate,
      occurrencesInVancouver: daysAndTimesInVancouver,
      occurrenceDates: occurrences.map(d => d.toISOString())
    })
    
    // All occurrences should be on Friday
    expect(daysAndTimesInVancouver.every(day => day.startsWith('Friday'))).toBe(true)
    
    // They should all be at midnight
    expect(daysAndTimesInVancouver.every(day => day.endsWith('00:00:00'))).toBe(true)
  })
})