import { RecurrenceRule } from '../types/event'
import { RecurrenceRuleDto } from '../api/event-series'

/**
 * Convert frontend RecurrenceRule to backend RecurrenceRuleDto format
 */
export function toBackendRecurrenceRule(rule: Partial<RecurrenceRule>): RecurrenceRuleDto {
  if (!rule) return { frequency: 'WEEKLY' }

  return {
    frequency: rule.frequency || 'WEEKLY',
    interval: rule.interval,
    count: rule.count,
    until: rule.until,
    byweekday: rule.byweekday, // Now both use byweekday
    bymonth: rule.bymonth,
    bymonthday: rule.bymonthday,
    wkst: rule.wkst
  }
}

/**
 * Convert backend RecurrenceRuleDto to frontend RecurrenceRule format
 */
export function toFrontendRecurrenceRule(dto: RecurrenceRuleDto): RecurrenceRule {
  if (!dto) return { frequency: 'WEEKLY' }

  return {
    frequency: dto.frequency as any || 'WEEKLY',
    interval: dto.interval,
    count: dto.count,
    until: dto.until,
    byweekday: dto.byweekday, // Now both use byweekday
    bymonth: dto.bymonth,
    bymonthday: dto.bymonthday,
    wkst: dto.wkst as any
  }
}
