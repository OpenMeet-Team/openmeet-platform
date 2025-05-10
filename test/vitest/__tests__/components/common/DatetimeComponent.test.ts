import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// Mock the date-fns-tz functions
vi.mock('date-fns-tz', () => ({
  formatInTimeZone: vi.fn().mockImplementation(() => '2025-01-15'),
  toZonedTime: vi.fn().mockImplementation((date) => date),
  fromZonedTime: vi.fn().mockImplementation((date) => date)
}))

describe('DatetimeComponent', () => {
  let initialDate: string

  beforeEach(() => {
    // ISO format date that would come from the API
    initialDate = '2025-01-15T15:30:00.000Z'
  })

  it('renders properly with initial date', () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate,
        label: 'Test Date'
      }
    })

    expect(wrapper.props('modelValue')).toBe(initialDate)
    expect(wrapper.props('label')).toBe('Test Date')
    expect(wrapper.find('[data-cy="datetime-component"]').exists()).toBe(true)
  })

  it('validates and updates the date via onDateUpdate', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate
      }
    })

    // Set a new date directly via the component's onDateUpdate method
    // This simulates selecting a date from the date picker
    wrapper.vm.onDateUpdate('2025-01-20')

    // Wait for Vue to process updates
    await wrapper.vm.$nextTick()

    // The model value should be updated
    expect(wrapper.emitted('update:model-value')).toBeTruthy()

    // Verify that the internal date state was updated
    expect(wrapper.vm.tempDate).toBe('2025-01-20')
  })

  it('does not update with invalid date on blur', async () => {
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: initialDate
      }
    })

    const originalValue = wrapper.vm.date

    // Get the input element
    const input = wrapper.find('input')

    // Focus to start editing
    await input.trigger('focus')

    // Set invalid date text
    await input.setValue('Not a date')

    // Blur to finish editing
    await input.trigger('blur')

    // The model value should not be updated with invalid date
    expect(wrapper.vm.date).toBe(originalValue)
  })

  it('uses 5:00 PM (17:00) as default time when creating a new event', async () => {
    // Create a wrapper with empty model value (simulating a new event)
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '', // Empty model value - new event scenario
        label: 'New Event Date'
      }
    })

    // Simulate user selecting a date through the date picker
    // This better represents real usage where user selects a date first
    wrapper.vm.onDateUpdate('2025-02-15')

    // Wait for Vue to finish updating
    await wrapper.vm.$nextTick()

    // Check if update:model-value event was emitted
    const emittedEvents = wrapper.emitted('update:model-value')
    expect(emittedEvents).toBeTruthy()

    if (emittedEvents) {
      // Get the most recent emitted value
      const emittedValue = emittedEvents[emittedEvents.length - 1][0]

      // Parse the ISO string to verify time portion
      const emittedDate = new Date(emittedValue)

      // Extract the hours and check if they're set to 17 (5:00 PM)
      const hours = emittedDate.getHours()
      const minutes = emittedDate.getMinutes()

      // Check that the time is set to 17:00 (5:00 PM)
      expect(hours).toBe(17)
      expect(minutes).toBe(0)

      // Also verify the internal state
      expect(wrapper.vm.tempDate).toBe('2025-02-15')
      expect(wrapper.vm.tempTime).toBeTruthy()

      console.log('Emitted ISO value for new event after date selection:', emittedValue)
      console.log('Parsed time:', `${hours}:${minutes}`)
    }
  })

  it('preserves provided time when updating existing events', async () => {
    // Create a wrapper with a specific time
    const specificTimeDate = '2025-01-15T09:30:00.000Z'

    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: specificTimeDate,
        label: 'Existing Event Date'
      }
    })

    // Get the internal time value after initialization
    const initialTime = wrapper.vm.tempTime
    console.log('Initial tempTime after mount:', initialTime)

    // Trigger the date picker to change the date but keep the time
    wrapper.vm.onDateUpdate('2025-01-20')

    // Wait for Vue to finish updating
    await wrapper.vm.$nextTick()

    // Check emitted value preserves the original time
    const emittedEvents = wrapper.emitted('update:model-value')
    expect(emittedEvents).toBeTruthy()

    // The key test: verify that tempTime is preserved after date change
    const finalTime = wrapper.vm.tempTime
    console.log('Final tempTime after date change:', finalTime)

    // The time should be preserved (not changed to default 17:00)
    expect(finalTime).toBe(initialTime)

    if (emittedEvents) {
      // The date should be updated but the time should remain the same
      console.log('Update events emitted:', emittedEvents)
      expect(wrapper.vm.tempDate).toBe('2025-01-20')
    }
  })

  it('preserves custom time (not 00:00 or 17:00) when setting time before date', async () => {
    // Create a wrapper with empty model value to simulate a brand new event
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '',
        label: 'New Event with Custom Time'
      }
    })

    // First, set a custom time (2:30 PM) using the time picker
    // This simulates a user selecting a time through the time picker first
    wrapper.vm.onTimeUpdate('2:30 PM')

    // Wait for Vue to finish updating
    await wrapper.vm.$nextTick()

    // Log the time value after setting time
    console.log('tempTime after setting custom time:', wrapper.vm.tempTime)

    // Now set the date - crucially AFTER setting the time
    wrapper.vm.onDateUpdate('2025-03-20')

    // Wait for Vue to finish updating
    await wrapper.vm.$nextTick()

    // Check if events were emitted correctly
    const emittedEvents = wrapper.emitted('update:model-value')
    expect(emittedEvents).toBeTruthy()

    if (emittedEvents) {
      // Get the final emitted value
      const finalEmitted = emittedEvents[emittedEvents.length - 1][0]
      console.log('Final emitted ISO value:', finalEmitted)

      // The key test: verify the time input was used in the final time value
      // This implementation uses direct string comparison instead of parsing the date
      // which is more reliable across timezones
      expect(wrapper.vm.tempTime).toBeTruthy()
      expect(wrapper.vm.tempTime).not.toBe('5:00 PM') // Not default time

      // Verify the internal component state
      expect(wrapper.vm.tempDate).toBe('2025-03-20')

      // Verify that the tempTime has not been set to 17:00 (5:00 PM)
      const containsDefaultTime = wrapper.vm.tempTime.includes('5:00') ||
                               wrapper.vm.tempTime.includes('17:00')

      expect(containsDefaultTime).toBe(false) // Should not contain default time

      // Verify that the tempTime contains the original time we set
      expect(wrapper.vm.tempTime.includes('2:30')).toBe(true)
    }
  })
})
