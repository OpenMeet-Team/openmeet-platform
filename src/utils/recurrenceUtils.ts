import { RecurrenceRule } from '../types/event'
import { RecurrenceRuleDto } from '../api/event-series'
import { RRule, Options, Weekday, Frequency, ByWeekday } from 'rrule'
import { getTimezoneOffset } from 'date-fns-tz'
import { parse, parseISO } from 'date-fns'

// Helper function to convert string weekday to RRule Weekday
function stringToWeekday (day: string): Weekday {
  const weekdayConst = RRule[day as keyof typeof RRule]
  if (typeof weekdayConst === 'object' && 'nth' in weekdayConst) {
    return weekdayConst as Weekday
  }
  return weekdayConst as unknown as Weekday
}

// Helper function to convert string array to ByWeekday array
function stringArrayToByWeekday (days: string[]): ByWeekday[] {
  return days.map(day => {
    const match = day.match(/^([+-]?\d+)([A-Z]{2})$/)
    if (match) {
      const pos = parseInt(match[1], 10)
      const weekday = match[2]
      return new Weekday(RRule[weekday as keyof typeof RRule] as unknown as number, pos)
    }
    return stringToWeekday(day)
  })
}

/**
 * Convert frontend RecurrenceRule to backend RecurrenceRuleDto format
 */
export function toBackendRecurrenceRule (rule: Partial<RecurrenceRule>): RecurrenceRuleDto {
  if (!rule) return { frequency: 'WEEKLY' }

  // Log the rule for debugging
  console.log('Converting frontend rule to backend format:', JSON.stringify(rule))

  return {
    frequency: rule.frequency || 'WEEKLY',
    interval: rule.interval,
    count: rule.count,
    until: rule.until,
    byweekday: rule.byweekday,
    bymonth: rule.bymonth,
    bymonthday: rule.bymonthday,
    bysetpos: rule.bysetpos,
    wkst: rule.wkst
  }
}

/**
 * Convert backend RecurrenceRuleDto to frontend RecurrenceRule format
 */
export function toFrontendRecurrenceRule (dto: RecurrenceRuleDto): RecurrenceRule {
  if (!dto) return { frequency: 'WEEKLY' }

  // Log the DTO for debugging
  console.log('Converting backend DTO to frontend format:', JSON.stringify(dto))

  return {
    frequency: dto.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY' | 'MINUTELY' | 'SECONDLY' || 'WEEKLY',
    interval: dto.interval,
    count: dto.count,
    until: dto.until,
    byweekday: dto.byweekday,
    bymonth: dto.bymonth,
    bymonthday: dto.bymonthday,
    bysetpos: dto.bysetpos,
    wkst: dto.wkst as 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'
  }
}

// Helper: Convert local time string in a timezone to UTC Date
function localTimeStringToUTC (startDateLocal: string, timeZone: string): Date {
  // Parse the local time string as a Date (interpreted as local time)
  const localDate = parse(startDateLocal, "yyyy-MM-dd'T'HH:mm:ss", new Date())
  // Get the offset in ms for the given timezone at that local time
  const offset = getTimezoneOffset(timeZone, localDate)
  // Subtract the offset to get the UTC time
  return new Date(localDate.getTime() - offset)
}

/**
 * Build a RecurrenceRule from local datetime, timezone, and recurrence options.
 * This is a pure function for testability.
 */
export function buildRecurrenceRule ({
  frequency,
  byweekday,
  bymonthday,
  bysetpos,
  interval,
  count,
  until,
  bymonth,
  wkst
}: {
  startDateLocal: string, // e.g. '2024-06-10T09:00:00'
  timeZone: string,
  frequency: RecurrenceRule['frequency'],
  byweekday?: string[],
  bymonthday?: number[],
  bysetpos?: number[],
  interval?: number,
  count?: number,
  until?: string,
  bymonth?: number[],
  wkst?: RecurrenceRule['wkst']
}): RecurrenceRule {
  // The rule is always anchored to the local time and timezone
  const rule: RecurrenceRule = {
    frequency,
    interval,
    count,
    until,
    byweekday,
    bymonthday,
    bysetpos,
    bymonth,
    wkst
  }
  // Remove undefined fields for cleanliness
  Object.keys(rule).forEach(key => rule[key as keyof RecurrenceRule] === undefined && delete rule[key as keyof RecurrenceRule])
  return rule
}

/**
 * Generate occurrences given a RecurrenceRule, local start datetime, and timezone.
 * Returns Date[] in UTC.
 */
export function generateOccurrences (
  rule: RecurrenceRule,
  startDateLocal: string,
  timeZone: string,
  count: number = 10
): Date[] {
  // Convert the local start date in the given timezone to UTC
  const dtstart = localTimeStringToUTC(startDateLocal, timeZone)

  // Build RRule options
  const options: Partial<Options> = {
    freq: RRule[rule.frequency as keyof typeof RRule] as unknown as Frequency,
    interval: rule.interval || 1,
    dtstart,
    count: rule.count,
    until: rule.until ? parseISO(rule.until) : undefined,
    bymonthday: rule.bymonthday,
    bysetpos: rule.bysetpos,
    bymonth: rule.bymonth,
    wkst: rule.wkst ? RRule[rule.wkst as keyof typeof RRule] as Weekday : undefined
  }

  // Handle byweekday with nth (e.g., 2MO)
  if (rule.byweekday && (rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY') && rule.bysetpos && rule.bysetpos.length > 0) {
    const position = rule.bysetpos[0]
    options.byweekday = rule.byweekday.map(day => {
      const weekdayConst = RRule[day as keyof typeof RRule]
      if (typeof weekdayConst === 'object' && 'nth' in weekdayConst) {
        return (weekdayConst as { nth: (n: number) => Weekday }).nth(position)
      }
      return stringToWeekday(day)
    })
    delete options.bysetpos
  } else if (rule.byweekday) {
    options.byweekday = stringArrayToByWeekday(rule.byweekday)
  }

  // Remove undefined fields
  Object.keys(options).forEach(key => options[key as keyof Options] === undefined && delete options[key as keyof Options])

  // Create the RRule
  const rrule = new RRule(options as Options)

  // Generate occurrences (in UTC)
  return rrule.all((_, i) => i < count)
}

/**
 * Get a human-readable description of the recurrence pattern.
 * Pure function for testability.
 */
export function getHumanReadablePattern (rule: RecurrenceRule, startDateLocal: string, timeZone: string): string {
  // Use the same logic as generateOccurrences to build the RRule
  const dtstart = localTimeStringToUTC(startDateLocal, timeZone)
  const options: Partial<Options> = {
    freq: RRule[rule.frequency as keyof typeof RRule] as unknown as Frequency,
    interval: rule.interval || 1,
    dtstart,
    count: rule.count,
    until: rule.until ? parseISO(rule.until) : undefined,
    bymonthday: rule.bymonthday,
    bysetpos: rule.bysetpos,
    bymonth: rule.bymonth,
    wkst: rule.wkst ? RRule[rule.wkst as keyof typeof RRule] as Weekday : undefined
  }

  if (rule.byweekday && (rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY') && rule.bysetpos && rule.bysetpos.length > 0) {
    const position = rule.bysetpos[0]
    options.byweekday = rule.byweekday.map(day => {
      const weekdayConst = RRule[day as keyof typeof RRule]
      if (typeof weekdayConst === 'object' && 'nth' in weekdayConst) {
        return (weekdayConst as { nth: (n: number) => Weekday }).nth(position)
      }
      return stringToWeekday(day)
    })
    delete options.bysetpos
  } else if (rule.byweekday) {
    options.byweekday = stringArrayToByWeekday(rule.byweekday)
  }

  Object.keys(options).forEach(key => options[key as keyof Options] === undefined && delete options[key as keyof Options])
  const rrule = new RRule(options as Options)
  return rrule.toText()
}
