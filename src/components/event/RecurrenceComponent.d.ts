import { RecurrenceRule } from '../../types/event'

export interface RecurrenceComponentProps {
  modelValue?: RecurrenceRule
  isRecurring: boolean
  startDate: string
  timeZone: string
  hideToggle: boolean
}

export interface RecurrenceComponentEmits {
  (e: 'update:model-value', value: RecurrenceRule | undefined): void
  (e: 'update:is-recurring', value: boolean): void
  (e: 'update:time-zone', value: string): void
  (e: 'update:start-date', value: string): void
}
