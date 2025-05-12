import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import DatetimeComponent from '../../../../../src/components/common/DatetimeComponent.vue'

// Install Quasar plugin
installQuasarPlugin({ plugins: { Notify } })

describe('DatetimeComponent Time Canonicalization', () => {
  let wrapper
  let timeInput

  // Helper function to set up the component with a time and trigger blur
  async function setupWithTimeAndBlur(timeValue: string) {
    // Mount with basic props
    wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2023-12-14T12:00:00.000Z',
        label: 'Start Date'
      },
    })

    // Access component methods directly for more reliable testing
    const vm = wrapper.vm as any // Cast to any to access internal methods

    // Set the local time directly
    vm.localTime = timeValue

    // Call updateTime to canonicalize
    await vm.updateTime()

    // Return the current time value
    return vm.localTime
  }

  // Tests for various time input formats
  const testCases = [
    { input: '6', expected: '6:00 AM' },
    { input: '6p', expected: '6:00 PM' },
    { input: '6pm', expected: '6:00 PM' },
    { input: '6:00', expected: '6:00 AM' },
    { input: '6:00p', expected: '6:00 PM' },
    { input: '6:00pm', expected: '6:00 PM' },
    { input: '12', expected: '12:00 PM' },
    { input: '12:00', expected: '12:00 PM' },
    { input: '12a', expected: '12:00 AM' },
    { input: '12p', expected: '12:00 PM' },
    { input: '13', expected: '1:00 PM' },
    { input: '13:00', expected: '1:00 PM' },
    { input: '16:30', expected: '4:30 PM' },
    { input: '9', expected: '9:00 AM' },
    { input: '9a', expected: '9:00 AM' },
    { input: '9am', expected: '9:00 AM' },
    { input: '9p', expected: '9:00 PM' },
    { input: '9pm', expected: '9:00 PM' },
    { input: '9:30', expected: '9:30 AM' },
    { input: '9:30a', expected: '9:30 AM' },
    { input: '9:30 am', expected: '9:30 AM' },
    { input: '9:30p', expected: '9:30 PM' },
    { input: '9:30 pm', expected: '9:30 PM' },
  ]

  // Run tests for each time format
  testCases.forEach(({ input, expected }) => {
    it(`should format "${input}" as "${expected}"`, async () => {
      const result = await setupWithTimeAndBlur(input)
      expect(result).toBe(expected)
    })
  })

  it('should correctly process time and emit update events', async () => {
    wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2023-12-14T12:00:00.000Z',
        label: 'Start Date',
        timeZone: 'America/New_York'
      },
    })

    const vm = wrapper.vm as any

    // Reset emitted events to ensure clean testing state
    wrapper.emitted()['update:model-value'] = []
    wrapper.emitted()['update:time-info'] = []

    // Manually set the time and trigger the update
    vm.localTime = '6pm'
    await vm.updateTime()

    // Check that the component emitted the update
    expect(wrapper.emitted('update:model-value')).toBeTruthy()

    // Check that time info was emitted
    expect(wrapper.emitted('update:time-info')).toBeTruthy()

    if (wrapper.emitted('update:time-info')) {
      const timeInfoEvents = wrapper.emitted('update:time-info')
      if (timeInfoEvents && timeInfoEvents.length > 0) {
        const lastTimeInfo = timeInfoEvents[timeInfoEvents.length - 1][0]

        // Verify the hours represent 6 PM (18:00)
        expect(lastTimeInfo.originalHours).toBe(18)
        expect(lastTimeInfo.originalMinutes).toBe(0)
        expect(lastTimeInfo.formattedTime).toBe('6:00 PM')
      }
    }

    // Verify the localTime was properly formatted
    expect(vm.localTime).toBe('6:00 PM')
  })
})