import { RecurrenceRule } from '../types/event'
import { RecurrenceRuleDto } from '../api/event-series'

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
    byweekday: rule.byweekday, // Now both use byweekday
    bymonth: rule.bymonth,
    bymonthday: rule.bymonthday,
    bysetpos: rule.bysetpos, // Add bysetpos for monthly nth weekday patterns
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
    byweekday: dto.byweekday, // Now both use byweekday
    bymonth: dto.bymonth,
    bymonthday: dto.bymonthday,
    bysetpos: dto.bysetpos, // Add bysetpos for monthly nth weekday patterns
    wkst: dto.wkst as 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'
  }
}
