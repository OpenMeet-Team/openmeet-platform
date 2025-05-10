import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import DatetimeComponent from '../../../../../src/components/common/DatetimeComponent.vue'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

describe('DatetimeComponent Day Preservation', () => {
  it('should preserve the exact day when the date is updated', async () => {
    // Mount the component with a starting date and time (May 14, 2025, 2:00 PM)
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2025-05-14T14:00:00.000Z',
        timeZone: 'America/New_York', // EDT (-4:00) timezone
        label: 'Test Date'
      }
    })

    // Verify the initial date is May 14
    const initialDate = new Date(wrapper.props('modelValue'))
    expect(initialDate.getUTCDate()).toBe(14)

    // Mock the date picker's update by directly calling onDateUpdate
    // with a new date (still May 14, same day)
    wrapper.vm.onDateUpdate('2025-05-14')
    await wrapper.vm.$nextTick()

    // Get the emitted model-value
    const emittedEvents = wrapper.emitted('update:model-value')

    // There should be an emitted value after the update
    expect(emittedEvents).toBeTruthy()
    expect(emittedEvents!.length).toBeGreaterThan(0)

    // Check that the emitted date is still May 14
    const emittedValue = emittedEvents![emittedEvents!.length - 1][0]
    const finalDate = new Date(emittedValue)

    // Log helpful info for debugging
    console.log('Initial date:', initialDate.toISOString())
    console.log('Emitted date:', finalDate.toISOString())
    console.log('Initial day:', initialDate.getUTCDate())
    console.log('Emitted day:', finalDate.getUTCDate())

    // The critical test: the day must be preserved exactly
    expect(finalDate.getUTCDate()).toBe(14)
  })

  it('should preserve day when converting between timezones', async () => {
    // Mount the component with a starting date and timezone
    const wrapper = mount(DatetimeComponent, {
      props: {
        modelValue: '2025-05-14T14:00:00.000Z',
        timeZone: 'America/New_York', // Eastern Time
        label: 'Test Date'
      }
    })

    // Verify initial state
    const initialDate = new Date(wrapper.props('modelValue'))
    expect(initialDate.getUTCDate()).toBe(14)

    // Now simulate changing the timezone to a drastically different one
    // This would be done via the timezone picker in real usage
    wrapper.vm.selectedTimezone = 'Asia/Tokyo' // UTC+9
    wrapper.vm.applyTimezone()
    await wrapper.vm.$nextTick()

    // Check timezone was emitted
    expect(wrapper.emitted('update:timeZone')).toBeTruthy()

    // The critical test: the day must remain the same
    // despite the timezone difference (13 hours)
    const events = wrapper.emitted('update:model-value')
    if (events && events.length > 0) {
      const emittedValue = events[events.length - 1][0]
      const finalDate = new Date(emittedValue)

      console.log('After timezone change:')
      console.log('Initial date:', initialDate.toISOString())
      console.log('Emitted date:', finalDate.toISOString())
      console.log('Initial day:', initialDate.getUTCDate())
      console.log('Emitted day:', finalDate.getUTCDate())

      // The day must not change when just changing timezone
      expect(finalDate.getUTCDate()).toBe(14)
    }
  })
})
