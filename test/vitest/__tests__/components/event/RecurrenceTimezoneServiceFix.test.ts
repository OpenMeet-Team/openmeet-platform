import { describe, it, expect } from 'vitest'
import { RecurrenceService } from '../../../../../src/services/recurrenceService'
import { formatInTimeZone } from 'date-fns-tz'

describe('RecurrenceService - Timezone Fixes', () => {
  /**
   * This test verifies that our modified toRRule method correctly handles
   * timezone boundaries when generating occurrences
   */
  it('should generate occurrences with timezone-aware days (Vancouver)', () => {
    // 1. Test with a date that's Thursday in UTC but Wednesday in Vancouver
    const rule = {
      frequency: 'WEEKLY',
      byweekday: ['WE'] // We want Wednesday in Vancouver
    }
    
    // May 1, 2025 at 05:30:00 UTC is Wednesday evening in Vancouver
    const startDate = '2025-05-01T05:30:00.000Z'
    const timeZone = 'America/Vancouver'
    
    // Verify what day it is in Vancouver vs UTC
    const date = new Date(startDate)
    const dayInUTC = date.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const dayInVancouver = formatInTimeZone(date, 'America/Vancouver', 'EEEE')
    
    console.log('Timezone boundary case:', {
      utcDate: date.toISOString(),
      dayInUTC,
      dayInVancouver
    })
    
    // We expect these to be different - Thursday in UTC, Wednesday in Vancouver
    expect(dayInUTC).toBe('Thursday')
    expect(dayInVancouver).toBe('Wednesday')
    
    // Now use our patched toRRule method with timezone parameter
    const rrule = RecurrenceService.toRRule(rule, startDate, timeZone)
    
    // Generate 5 occurrences
    const occurrences = rrule.all((_, i) => i < 5)
    
    console.log('Occurrences:', occurrences.map(d => ({
      date: d.toISOString(),
      dayInVancouver: formatInTimeZone(d, 'America/Vancouver', 'EEEE')
    })))
    
    // Verify all occurrences are on Wednesday in Vancouver
    const allWednesdays = occurrences.every(date =>
      formatInTimeZone(date, 'America/Vancouver', 'EEEE') === 'Wednesday'
    )
    
    expect(allWednesdays).toBe(true)
  })
  
  /**
   * This test verifies our fix with a different timezone to ensure it works globally
   */
  it('should generate occurrences with timezone-aware days (Sydney)', () => {
    // Test with a date that's Sunday in UTC but Monday in Sydney
    const rule = {
      frequency: 'WEEKLY',
      byweekday: ['MO'] // We want Monday in Sydney
    }
    
    // May 18, 2025 at 22:30:00 UTC is May 19, 2025 08:30:00 in Sydney
    const startDate = '2025-05-18T22:30:00.000Z'
    const timeZone = 'Australia/Sydney'
    
    // Verify what day it is in Sydney vs UTC
    const date = new Date(startDate)
    const dayInUTC = date.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const dayInSydney = formatInTimeZone(date, 'Australia/Sydney', 'EEEE')
    
    console.log('Sydney timezone boundary case:', {
      utcDate: date.toISOString(),
      dayInUTC,
      dayInSydney
    })
    
    // We expect these to be different - Sunday in UTC, Monday in Sydney
    expect(dayInUTC).toBe('Sunday')
    expect(dayInSydney).toBe('Monday')
    
    // Use our patched toRRule method with timezone parameter
    const rrule = RecurrenceService.toRRule(rule, startDate, timeZone)
    
    // Generate 5 occurrences
    const occurrences = rrule.all((_, i) => i < 5)
    
    console.log('Sydney occurrences:', occurrences.map(d => ({
      date: d.toISOString(),
      dayInSydney: formatInTimeZone(d, 'Australia/Sydney', 'EEEE')
    })))
    
    // Verify all occurrences are on Monday in Sydney
    const allMondays = occurrences.every(date =>
      formatInTimeZone(date, 'Australia/Sydney', 'EEEE') === 'Monday'
    )
    
    expect(allMondays).toBe(true)
  })
})