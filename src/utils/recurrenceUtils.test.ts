import { describe, it, expect } from 'vitest'
import { toBackendRecurrenceRule, toFrontendRecurrenceRule } from './recurrenceUtils'
import { RecurrenceRule } from '../types/event'
import { RecurrenceRuleDto } from '../api/event-series'

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
})
