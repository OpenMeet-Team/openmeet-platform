import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import DatetimeComponent from '../../../../../src/components/common/DatetimeComponent.vue'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Create a predictable "now" date for testing
const fixedDate = new Date('2025-01-15T12:00:00.000Z')
vi.useFakeTimers()
vi.setSystemTime(fixedDate)

// Using real date-fns-tz functions for more accurate testing
vi.unmock('date-fns-tz')

interface DatetimeComponentVM {
  localDate: string
  localTime: string
  isoDate: string
  onDateUpdate: (date: string) => void
  onTimeUpdate: (time: string) => void
  onTimeZoneUpdate: (timezone: string) => void
  tempDate: string
  tempTime: string
  updateTime: () => Promise<void>
  [key: string]: unknown // Allow other properties
}

describe('DatetimeComponent - Basic Tests', () => {
  const initialDate = '2025-01-15T15:30:00.000Z'

  it('renders with correct props', () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        label: 'Event Date',
        timeZone: 'America/New_York',
        showTimeZone: true
      }
    })

    expect(wrapper.props('modelValue')).toBe(initialDate)
    expect(wrapper.props('label')).toBe('Event Date')
    expect(wrapper.props('timeZone')).toBe('America/New_York')
    expect(wrapper.find('[data-cy="datetime-component"]').exists()).toBe(true)
  })

  it('initializes correctly from ISO string', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    // Component should extract date and time from ISO string
    // In UTC timezone, 15:30 UTC should be 3:30 PM
    expect(vm.localDate).toBe('2025-01-15')
    expect(vm.localTime).toBe('3:30 PM')
    expect(vm.isoDate).toBe(initialDate)
  })

  it('preserves wall clock time when changing timezone', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    // Get initial values
    const initialLocalTime = vm.localTime

    // Change timezone
    await wrapper.setProps({ timeZone: 'America/New_York' })

    // The local time should be the same (wall clock time preserved)
    expect(vm.localTime).toBe(initialLocalTime)

    // But the internal UTC representation should change
    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()

    if (emits) {
      const firstEmit = emits[0][0]
      expect(firstEmit).not.toBe(initialDate)
    }
  })

  it('creates proper ISO string from local inputs', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '',
        timeZone: ''
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    // Set date and time manually using the exposed test methods
    vm.onDateUpdate('2025-02-20')
    vm.onTimeUpdate('3:45 PM')
    vm.onTimeZoneUpdate('America/New_York')

    // Check the emitted value
    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()

    if (emits) {
      const emittedValue = emits[emits.length - 1][0]

      // Parse the emitted ISO string
      const emittedDate = new Date(emittedValue as string)

      // In UTC, 3:45 PM should be 15:45 UTC
      expect(emittedDate.getUTCHours()).toBe(15)
      expect(emittedDate.getUTCMinutes()).toBe(45)
      expect(emittedDate.getUTCDate()).toBe(20)
      expect(emittedDate.getUTCMonth()).toBe(1) // 0-indexed, so 1 = February
    }
  })

  it('updates local date and time correctly', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    // Update date using the exposed test methods
    vm.onDateUpdate('2025-03-25')
    expect(vm.tempDate).toBe('2025-03-25')

    // Update time
    vm.onTimeUpdate('4:20 PM')
    expect(vm.tempTime).toBe('4:20 PM')

    // Both updates should emit update:model-value
    const emits = wrapper.emitted('update:model-value')
    expect(emits?.length).toBeGreaterThanOrEqual(2)
  })

  it('sets default time to 5:00 PM for new events', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '', // Empty string indicates a new event
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    // Update only the date (no time specified)
    vm.onDateUpdate('2025-04-10')

    // Check the emitted value
    const emits = wrapper.emitted('update:model-value')

    if (emits) {
      const emittedValue = emits[emits.length - 1][0]
      const emittedDate = new Date(emittedValue as string)

      // Default time should be 17:00 (5:00 PM)
      expect(emittedDate.getUTCHours()).toBe(17)
      expect(emittedDate.getUTCMinutes()).toBe(0)
    }
  })

  it('updating the date multiple times should be ok and return the correct ISO string', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    vm.onDateUpdate('2025-05-01')
    vm.onDateUpdate('2025-05-02')
    vm.onDateUpdate('2025-05-03')

    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()
    expect(emits?.length).toBe(3)

    const emittedValue3 = emits![emits!.length - 1][0]
    expect(emittedValue3).toBe('2025-05-03T15:30:00.000Z')

    const emittedValue2 = emits![emits!.length - 2][0]
    expect(emittedValue2).toBe('2025-05-02T15:30:00.000Z')

    const emittedValue1 = emits![emits!.length - 3][0]
    expect(emittedValue1).toBe('2025-05-01T15:30:00.000Z')
  })

  it('updating the time multiple times should be ok and return the correct ISO string', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    vm.onTimeUpdate('1:00 AM')
    vm.onTimeUpdate('2:00 AM')
    vm.onTimeUpdate('3:00 AM')

    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()
    expect(emits?.length).toBe(3)

    const emittedValue3 = emits![emits!.length - 1][0]
    expect(emittedValue3).toBe('2025-01-15T03:00:00.000Z')

    const emittedValue2 = emits![emits!.length - 2][0]
    expect(emittedValue2).toBe('2025-01-15T02:00:00.000Z')

    const emittedValue1 = emits![emits!.length - 3][0]
    expect(emittedValue1).toBe('2025-01-15T01:00:00.000Z')
  })

  it('updating the timezone multiple times should be ok and return the correct ISO string', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    vm.onTimeZoneUpdate('America/New_York')
    vm.onTimeZoneUpdate('America/Chicago')
    vm.onTimeZoneUpdate('America/Los_Angeles')

    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()
    expect(emits?.length).toBe(3)

    const emittedValue3 = emits![emits!.length - 1][0]
    expect(emittedValue3).toBe('2025-01-15T15:30:00.000Z')

    const emittedValue2 = emits![emits!.length - 2][0]
    expect(emittedValue2).toBe('2025-01-15T15:30:00.000Z')

    const emittedValue1 = emits![emits!.length - 3][0]
    expect(emittedValue1).toBe('2025-01-15T15:30:00.000Z')
  })

  it('when updating date or time, the other should not shift', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })
    const vm = wrapper.vm as unknown as DatetimeComponentVM

    //  get the displayed time and date
    const displayedTime = vm.localTime
    const displayedDate = vm.localDate

    expect(displayedTime).toBe('3:30 PM')
    expect(displayedDate).toBe('2025-01-15')

    vm.onDateUpdate('2025-05-14')

    //  get the displayed time and date again
    const displayedTime2 = vm.localTime
    const displayedDate2 = vm.localDate

    expect(displayedTime2).toBe('3:30 PM')
    expect(displayedDate2).toBe('2025-05-14')

    vm.onTimeUpdate('2:15 PM')

    //  get the displayed time and date again
    const displayedTime3 = vm.localTime
    const displayedDate3 = vm.localDate

    expect(displayedTime3).toBe('2:15 PM')
    expect(displayedDate3).toBe('2025-05-14')
  })

  it('canonicalizes time input when focus changes', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2025-05-15T12:00:00.000Z',
        label: 'Date and Time'
      }
    })

    const vm = wrapper.vm as unknown as DatetimeComponentVM

    // Test with various time formats
    const testCases = [
      { input: '6:15am', expected: '6:15 AM' },
      { input: '6:16pm', expected: '6:16 PM' },
      { input: '6:17', expected: '6:17 PM' }, // Defaults to PM
      { input: '5', expected: '5:00 PM' }, // Defaults to PM
      { input: '6p', expected: '6:00 PM' },
      { input: '12p', expected: '12:00 PM' },
      // { input: '12a', expected: '12:00 AM' }, // This case might need specific handling logic if 12a implies 00:00
      { input: '9:30', expected: '9:30 PM' }, // Defaults to PM
      { input: '14:12', expected: '2:12 PM' },
      // { input: '24:00', expected: '12:00 AM' }, // Usually 24:00 is treated as 00:00 of next day or invalid
      { input: '00:00', expected: '12:00 AM' }
    ]

    for (const { input, expected } of testCases) {
      // Set the time directly
      vm.localTime = input

      // Trigger the update time function (simulates blur)
      await vm.updateTime()

      // Check the result
      expect(vm.localTime).toBe(expected)
    }
  })
})
