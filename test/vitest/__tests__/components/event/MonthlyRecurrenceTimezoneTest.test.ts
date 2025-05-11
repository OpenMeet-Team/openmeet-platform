import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'
import { formatInTimeZone } from 'date-fns-tz'
import { ComponentPublicInstance } from 'vue'

// Import the components we need to test
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Create a fixed date for testing
const FIXED_DATE = new Date('2025-05-14T12:00:00.000Z') // May 14, 2025 (Wednesday)
vi.useFakeTimers()
vi.setSystemTime(FIXED_DATE)

// Mock the RecurrenceService
vi.mock('../../../../../src/services/recurrenceService', () => {
  // Mock the named exports and default export structure
  const RecurrenceServiceMock = {
    frequencyOptions: [
      { value: 'DAILY', label: 'Daily', description: 'Repeat every day' },
      { value: 'WEEKLY', label: 'Weekly', description: 'Repeat every week' },
      { value: 'MONTHLY', label: 'Monthly', description: 'Repeat every month' },
      { value: 'YEARLY', label: 'Yearly', description: 'Repeat every year' }
    ],
    weekdayOptions: [
      { value: 'SU', label: 'Sunday', shortLabel: 'S' },
      { value: 'MO', label: 'Monday', shortLabel: 'M' },
      { value: 'TU', label: 'Tuesday', shortLabel: 'T' },
      { value: 'WE', label: 'Wednesday', shortLabel: 'W' },
      { value: 'TH', label: 'Thursday', shortLabel: 'T' },
      { value: 'FR', label: 'Friday', shortLabel: 'F' },
      { value: 'SA', label: 'Saturday', shortLabel: 'S' }
    ],
    getTimezones: vi.fn().mockReturnValue(['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Pacific/Auckland']),
    searchTimezones: vi.fn().mockReturnValue(['America/New_York']),
    getUserTimezone: vi.fn().mockReturnValue('America/New_York'),
    toRRule: vi.fn().mockReturnValue({
      toText: () => 'every month on the 2nd Wednesday'
    }),
    getOccurrences: vi.fn().mockReturnValue([
      new Date('2025-05-14T17:00:00.000Z'),
      new Date('2025-06-11T17:00:00.000Z'),
      new Date('2025-07-09T17:00:00.000Z')
    ]),
    getHumanReadablePattern: vi.fn().mockReturnValue('every month on the 2nd Wednesday'),
    formatWithTimezone: vi.fn().mockImplementation((date, format, timezone) => {
      return formatInTimeZone(new Date(date), timezone || 'UTC', format)
    })
  }

  // Return the mocked structure
  return {
    // Default export
    default: RecurrenceServiceMock,
    // Named export for the class
    RecurrenceService: RecurrenceServiceMock
  }
})

// Create a utility function to safely update reactive state in test environment
function safeUpdate (wrapper, key: string, value: string | number | boolean) {
  // Get the internal component instance which should have access to all reactive state
  const vm = wrapper.vm as ComponentPublicInstance<Record<string, unknown>>

  // Method 1: Try direct manipulation through vue.__reactivity flag
  try {
    // If the component is using script setup with defineExpose
    if (vm[key] !== undefined) {
      // Direct assignment to unwrapped values
      vm[key] = value
      return true
    }
  } catch (e) {
    console.warn(`Failed to set ${key} directly:`, e)
  }

  // Method 2: If there's a model that matches key, trigger the v-model event
  try {
    wrapper.find(`[data-cy=recurrence-${key}]`).setValue(value)
    return true
  } catch (e) {
    console.warn(`Failed to set ${key} via setValue:`, e)
  }

  // Method 3: Last resort, try Vue Test Utils setData with new wrapper
  try {
    const dataObj = {}
    dataObj[key] = value
    wrapper.setData(dataObj)
    return true
  } catch (e) {
    console.error(`All methods to update ${key} failed:`, e)
    return false
  }
}

describe('Monthly Recurrence Pattern Timezone Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // Test 1: Test the day-of-week calculation near timezone boundaries
  it('should maintain correct day-of-week in monthly pattern across timezone boundaries', async () => {
    // Create a date that is Wednesday in UTC but might be Tuesday or Thursday in other timezones
    // May 14, 2025 @ 00:30 UTC - this is a Wednesday (UTC)
    // In New York (UTC-4), this is Tuesday, May 13 @ 8:30 PM
    // In Tokyo (UTC+9), this is Wednesday, May 14 @ 9:30 AM
    const testDate = '2025-05-14T00:30:00.000Z'

    // Test with Tokyo timezone (UTC+9)
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: testDate,
        timeZone: 'Asia/Tokyo', // UTC+9
        hideToggle: true
      },
      global: {
        stubs: {
          // Stub Quasar components to simplify testing
          'q-select': { template: '<div class="q-select-stub"></div>' },
          'q-radio': { template: '<div class="q-radio-stub"></div>' },
          'q-checkbox': { template: '<div class="q-checkbox-stub"></div>' },
          'q-input': { template: '<div class="q-input-stub"></div>' },
          'q-btn': { template: '<div class="q-btn-stub"></div>' },
          'q-list': { template: '<div class="q-list-stub"></div>' },
          'q-item': { template: '<div class="q-item-stub"></div>' },
          'q-separator': { template: '<div class="q-separator-stub"></div>' },
          'q-skeleton': { template: '<div class="q-skeleton-stub"></div>' },
          'q-icon': { template: '<div class="q-icon-stub"></div>' },
          'q-popup-proxy': { template: '<div class="q-popup-proxy-stub"></div>' },
          'q-date': { template: '<div class="q-date-stub"></div>' },
          'q-item-section': { template: '<div class="q-item-section-stub"></div>' },
          'q-item-label': { template: '<div class="q-item-label-stub"></div>' }
        }
      }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Log for debugging
    console.log('Test date (ISO):', testDate)
    console.log('Date in Tokyo:', formatInTimeZone(new Date(testDate), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm (EEEE)'))
    console.log('Date in UTC:', formatInTimeZone(new Date(testDate), 'UTC', 'yyyy-MM-dd HH:mm (EEEE)'))
    console.log('Date in New York:', formatInTimeZone(new Date(testDate), 'America/New_York', 'yyyy-MM-dd HH:mm (EEEE)'))

    // Check the component's internal state
    console.log('RecurrenceComponent selected days:', wrapper.vm.selectedDays)
    console.log('RecurrenceComponent monthlyWeekday:', wrapper.vm.monthlyWeekday)

    // Change to monthly frequency to test day-of-week pattern
    // Use our safe update utility
    safeUpdate(wrapper, 'frequency', 'MONTHLY')
    safeUpdate(wrapper, 'monthlyRepeatType', 'dayOfWeek')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // CRITICAL TEST: In Tokyo timezone, this date is still Wednesday (WE)
    expect(wrapper.vm.monthlyWeekday).toBe('WE')
    expect(wrapper.vm.selectedDays).toContain('WE')

    // Now check rule generation for this monthly pattern
    const rule = wrapper.vm.rule
    console.log('Generated recurrence rule:', rule)

    // Verify the rule correctly includes Wednesday
    expect(rule.frequency).toBe('MONTHLY')
    expect(rule.byweekday).toContain('WE')
  })

  // Test 2: Test with New York timezone where the day is different than UTC
  it('should use the timezone-correct day of week in New York timezone', async () => {
    // Same test date but with New York timezone (UTC-4)
    // May 14, 2025 @ 00:30 UTC - this is a Wednesday (UTC)
    // In New York (UTC-4), this is Tuesday, May 13 @ 8:30 PM
    const testDate = '2025-05-14T00:30:00.000Z'

    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: testDate,
        timeZone: 'America/New_York', // UTC-4
        hideToggle: true
      },
      global: {
        stubs: {
          // Stub Quasar components to simplify testing
          'q-select': { template: '<div class="q-select-stub"></div>' },
          'q-radio': { template: '<div class="q-radio-stub"></div>' },
          'q-checkbox': { template: '<div class="q-checkbox-stub"></div>' },
          'q-input': { template: '<div class="q-input-stub"></div>' },
          'q-btn': { template: '<div class="q-btn-stub"></div>' },
          'q-list': { template: '<div class="q-list-stub"></div>' },
          'q-item': { template: '<div class="q-item-stub"></div>' },
          'q-separator': { template: '<div class="q-separator-stub"></div>' },
          'q-skeleton': { template: '<div class="q-skeleton-stub"></div>' },
          'q-icon': { template: '<div class="q-icon-stub"></div>' },
          'q-popup-proxy': { template: '<div class="q-popup-proxy-stub"></div>' },
          'q-date': { template: '<div class="q-date-stub"></div>' },
          'q-item-section': { template: '<div class="q-item-section-stub"></div>' },
          'q-item-label': { template: '<div class="q-item-label-stub"></div>' }
        }
      }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Log for debugging
    console.log('Test date (ISO):', testDate)
    console.log('Date in New York:', formatInTimeZone(new Date(testDate), 'America/New_York', 'yyyy-MM-dd HH:mm (EEEE)'))

    // Change to monthly frequency to test day-of-week pattern
    // Use our safe update utility
    safeUpdate(wrapper, 'frequency', 'MONTHLY')
    safeUpdate(wrapper, 'monthlyRepeatType', 'dayOfWeek')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // CRITICAL TEST: In New York timezone, this date is Tuesday (TU) not Wednesday
    console.log('RecurrenceComponent selectedDays:', wrapper.vm.selectedDays)
    console.log('RecurrenceComponent monthlyWeekday:', wrapper.vm.monthlyWeekday)

    // This would be TU in a correct implementation because in New York timezone
    // the date is Tuesday, May 13
    expect(wrapper.vm.monthlyWeekday).toBe('TU')
    expect(wrapper.vm.selectedDays).toContain('TU')

    // Check rule generation
    const rule = wrapper.vm.rule
    console.log('Generated recurrence rule:', rule)

    // In New York timezone, this should be Tuesday
    expect(rule.frequency).toBe('MONTHLY')
    expect(rule.byweekday).toContain('TU')
  })

  // Test 3: Test updating the date through props
  it('should update day of week correctly when startDate prop changes', async () => {
    // Start with a Monday
    const initialDate = '2025-05-12T12:00:00.000Z' // Monday, May 12

    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: initialDate,
        timeZone: 'UTC',
        hideToggle: true
      },
      global: {
        stubs: {
          // Stub Quasar components to simplify testing
          'q-select': { template: '<div class="q-select-stub"></div>' },
          'q-radio': { template: '<div class="q-radio-stub"></div>' },
          'q-checkbox': { template: '<div class="q-checkbox-stub"></div>' },
          'q-input': { template: '<div class="q-input-stub"></div>' },
          'q-btn': { template: '<div class="q-btn-stub"></div>' },
          'q-list': { template: '<div class="q-list-stub"></div>' },
          'q-item': { template: '<div class="q-item-stub"></div>' },
          'q-separator': { template: '<div class="q-separator-stub"></div>' },
          'q-skeleton': { template: '<div class="q-skeleton-stub"></div>' },
          'q-icon': { template: '<div class="q-icon-stub"></div>' },
          'q-popup-proxy': { template: '<div class="q-popup-proxy-stub"></div>' },
          'q-date': { template: '<div class="q-date-stub"></div>' },
          'q-item-section': { template: '<div class="q-item-section-stub"></div>' },
          'q-item-label': { template: '<div class="q-item-label-stub"></div>' }
        }
      }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Verify initial day is Monday
    expect(wrapper.vm.selectedDays).toContain('MO')
    expect(wrapper.vm.monthlyWeekday).toBe('MO')

    // Now update to Wednesday
    await wrapper.setProps({ startDate: '2025-05-14T12:00:00.000Z' }) // Wednesday, May 14
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Verify day updated to Wednesday
    expect(wrapper.vm.selectedDays).toContain('WE')
    expect(wrapper.vm.monthlyWeekday).toBe('WE')

    // Test with a timezone difference
    await wrapper.setProps({
      startDate: '2025-05-14T00:30:00.000Z', // Wednesday in UTC
      timeZone: 'America/New_York' // Tuesday in New York
    })
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Now this should be Tuesday in the New York timezone
    console.log('After timezone change:')
    console.log('RecurrenceComponent selectedDays:', wrapper.vm.selectedDays)
    console.log('RecurrenceComponent monthlyWeekday:', wrapper.vm.monthlyWeekday)

    // In New York timezone, should be Tuesday
    expect(wrapper.vm.selectedDays).toContain('TU')
    expect(wrapper.vm.monthlyWeekday).toBe('TU')
  })
})
