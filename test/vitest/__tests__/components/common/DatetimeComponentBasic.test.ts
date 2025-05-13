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

    // Component should extract date and time from ISO string
    // In UTC timezone, 15:30 UTC should be 3:30 PM
    expect(wrapper.vm.localDate).toBe('2025-01-15')
    expect(wrapper.vm.localTime).toBe('3:30 PM')
    expect(wrapper.vm.isoDate).toBe(initialDate)
  })

  it('preserves wall clock time when changing timezone', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })

    // Get initial values
    const initialLocalTime = wrapper.vm.localTime

    // Change timezone
    await wrapper.setProps({ timeZone: 'America/New_York' })

    // The local time should be the same (wall clock time preserved)
    expect(wrapper.vm.localTime).toBe(initialLocalTime)

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

    // Set date and time manually using the exposed test methods
    wrapper.vm.onDateUpdate('2025-02-20')
    wrapper.vm.onTimeUpdate('3:45 PM')
    wrapper.vm.onTimeZoneUpdate('America/New_York')

    // Check the emitted value
    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()

    if (emits) {
      const emittedValue = emits[emits.length - 1][0]

      // Parse the emitted ISO string
      const emittedDate = new Date(emittedValue)

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

    // Update date using the exposed test methods
    wrapper.vm.onDateUpdate('2025-03-25')
    expect(wrapper.vm.tempDate).toBe('2025-03-25')

    // Update time
    wrapper.vm.onTimeUpdate('4:20 PM')
    expect(wrapper.vm.tempTime).toBe('4:20 PM')

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

    // Update only the date (no time specified)
    wrapper.vm.onDateUpdate('2025-04-10')

    // Check the emitted value
    const emits = wrapper.emitted('update:model-value')

    if (emits) {
      const emittedValue = emits[emits.length - 1][0]
      const emittedDate = new Date(emittedValue)

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

    wrapper.vm.onDateUpdate('2025-05-01')
    wrapper.vm.onDateUpdate('2025-05-02')
    wrapper.vm.onDateUpdate('2025-05-03')

    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()
    expect(emits?.length).toBe(3)

    const emittedValue3 = emits[emits.length - 1][0]
    expect(emittedValue3).toBe('2025-05-03T15:30:00.000Z')

    const emittedValue2 = emits[emits.length - 2][0]
    expect(emittedValue2).toBe('2025-05-02T15:30:00.000Z')

    const emittedValue1 = emits[emits.length - 3][0]
    expect(emittedValue1).toBe('2025-05-01T15:30:00.000Z')
  })

  it('updating the time multiple times should be ok and return the correct ISO string', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })

    wrapper.vm.onTimeUpdate('1:00 AM')
    wrapper.vm.onTimeUpdate('2:00 AM')
    wrapper.vm.onTimeUpdate('3:00 AM')

    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()
    expect(emits?.length).toBe(3)

    const emittedValue3 = emits[emits.length - 1][0]
    expect(emittedValue3).toBe('2025-01-15T03:00:00.000Z')

    const emittedValue2 = emits[emits.length - 2][0]
    expect(emittedValue2).toBe('2025-01-15T02:00:00.000Z')

    const emittedValue1 = emits[emits.length - 3][0]
    expect(emittedValue1).toBe('2025-01-15T01:00:00.000Z')
  })

  it('updating the timezone multiple times should be ok and return the correct ISO string', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })

    wrapper.vm.onTimeZoneUpdate('America/New_York')
    wrapper.vm.onTimeZoneUpdate('America/Chicago')
    wrapper.vm.onTimeZoneUpdate('America/Los_Angeles')

    const emits = wrapper.emitted('update:model-value')
    expect(emits).toBeTruthy()
    expect(emits?.length).toBe(3)

    const emittedValue3 = emits[emits.length - 1][0]
    expect(emittedValue3).toBe('2025-01-15T15:30:00.000Z')

    const emittedValue2 = emits[emits.length - 2][0]
    expect(emittedValue2).toBe('2025-01-15T15:30:00.000Z')

    const emittedValue1 = emits[emits.length - 3][0]
    expect(emittedValue1).toBe('2025-01-15T15:30:00.000Z')
  })

  it('when updating date or time, the other should not shift', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        timeZone: 'UTC'
      }
    })

    //  get the displayed time and date
    const displayedTime = wrapper.vm.localTime
    const displayedDate = wrapper.vm.localDate

    expect(displayedTime).toBe('3:30 PM')
    expect(displayedDate).toBe('2025-01-15')

    wrapper.vm.onDateUpdate('2025-05-14')

    //  get the displayed time and date again
    const displayedTime2 = wrapper.vm.localTime
    const displayedDate2 = wrapper.vm.localDate

    expect(displayedTime2).toBe('3:30 PM')
    expect(displayedDate2).toBe('2025-05-14')

    wrapper.vm.onTimeUpdate('2:15 PM')

    //  get the displayed time and date again
    const displayedTime3 = wrapper.vm.localTime
    const displayedDate3 = wrapper.vm.localDate

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

    const vm = wrapper.vm as {
      localTime: string;
      updateTime: () => Promise<void>
    }

    // Test with various time formats
    const testCases = [
      { input: '6', expected: '6:00 AM' },
      { input: '6p', expected: '6:00 PM' },
      { input: '14', expected: '2:00 PM' },
      { input: '9:30', expected: '9:30 AM' }
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
