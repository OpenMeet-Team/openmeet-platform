import { RecurrenceRule } from '../types/event'
import { RecurrenceRuleDto } from '../api/event-series'

/**
 * Convert frontend RecurrenceRule to backend RecurrenceRuleDto format
 * Ensures timezone information is properly preserved
 */
export function toBackendRecurrenceRule (rule: Partial<RecurrenceRule>): RecurrenceRuleDto {
  if (!rule) return { frequency: 'WEEKLY' }

  // Log the rule for debugging
  console.log('Converting frontend rule to backend format:', JSON.stringify(rule))

  // Check if we have any bysetpos but missing byweekday (which would cause issues)
  if (rule.bysetpos && rule.bysetpos.length > 0 && (!rule.byweekday || rule.byweekday.length === 0)) {
    console.error('Missing byweekday with bysetpos present - this will cause pattern issues', {
      bysetpos: rule.bysetpos,
      byweekday: rule.byweekday
    })
  }

  // Check if we have timezone information
  if (rule.timeZone) {
    console.log(`Preserving timezone information in rule: ${rule.timeZone}`)
  }

  // Create backend rule format with all properties
  const backendRule: RecurrenceRuleDto = {
    frequency: rule.frequency || 'WEEKLY',
    interval: rule.interval,
    count: rule.count,
    until: rule.until,
    byweekday: rule.byweekday, // Ensure byweekday is preserved exactly
    bymonth: rule.bymonth,
    bymonthday: rule.bymonthday,
    bysetpos: rule.bysetpos, // Ensure bysetpos is preserved for monthly patterns
    wkst: rule.wkst,
    // Include timeZone in backend rule to preserve timezone context
    timeZone: rule.timeZone
  }

  // Log the complete rule for debugging
  console.log('Final backend rule:', JSON.stringify(backendRule))

  return backendRule
}

/**
 * Convert backend RecurrenceRuleDto to frontend RecurrenceRule format
 * Ensures timezone information is properly preserved
 */
export function toFrontendRecurrenceRule (dto: RecurrenceRuleDto): RecurrenceRule {
  if (!dto) return { frequency: 'WEEKLY' }

  // Log the DTO for debugging
  console.log('Converting backend DTO to frontend format:', JSON.stringify(dto))

  // Check if we have any bysetpos but missing byweekday (which would cause issues)
  if (dto.bysetpos && dto.bysetpos.length > 0 && (!dto.byweekday || dto.byweekday.length === 0)) {
    console.error('Missing byweekday with bysetpos present in backend DTO - this will cause pattern issues', {
      bysetpos: dto.bysetpos,
      byweekday: dto.byweekday
    })
  }

  // Check if we have timezone information
  if (dto.timeZone) {
    console.log(`Preserving timezone information from backend: ${dto.timeZone}`)
  }

  // Create frontend rule with all properties preserved
  const frontendRule: RecurrenceRule = {
    frequency: dto.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY' | 'MINUTELY' | 'SECONDLY' || 'WEEKLY',
    interval: dto.interval,
    count: dto.count,
    until: dto.until,
    byweekday: dto.byweekday, // Preserve byweekday exactly
    bymonth: dto.bymonth,
    bymonthday: dto.bymonthday,
    bysetpos: dto.bysetpos, // Preserve bysetpos for monthly patterns
    wkst: dto.wkst as 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA',
    // Include timeZone in frontend rule to preserve timezone context
    timeZone: dto.timeZone
  }

  // Log the complete rule for debugging
  console.log('Final frontend rule:', JSON.stringify(frontendRule))

  return frontendRule
}
