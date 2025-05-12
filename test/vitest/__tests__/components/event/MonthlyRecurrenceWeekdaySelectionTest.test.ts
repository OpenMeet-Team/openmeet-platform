import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

describe('RecurrenceComponent - Monthly day of week selection issue', () => {
  const mondayDate = '2023-12-11T12:00:00.000Z' // This is a Monday
  const tuesdayDate = '2023-12-12T12:00:00.000Z' // This is a Tuesday
  const timeZone = 'America/New_York'

  beforeEach(() => {
    // Use fake timers to make tests deterministic
    vi.useFakeTimers()
    vi.setSystemTime(new Date(mondayDate))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with day of month pattern by default', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to monthly frequency
    wrapper.vm.frequency = 'MONTHLY'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Check that the default monthly repeat type is dayOfMonth
    expect(wrapper.vm.monthlyRepeatType).toBe('dayOfMonth')
  })

  it('initially sets day of week to match the start date', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to monthly frequency and day of week type
    wrapper.vm.frequency = 'MONTHLY'
    wrapper.vm.monthlyRepeatType = 'dayOfWeek'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Since mondayDate is a Monday, monthlyWeekday should be MO
    expect(wrapper.vm.monthlyWeekday).toBe('MO')

    // Log for debugging
    console.log('Initial monthlyWeekday value:', wrapper.vm.monthlyWeekday)
  })

  // This test demonstrates the issue - inability to select a different day of week
  it('allows selecting a different day of week', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to monthly frequency and day of week type
    wrapper.vm.frequency = 'MONTHLY'
    wrapper.vm.monthlyRepeatType = 'dayOfWeek'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Initially it should be MO (Monday)
    expect(wrapper.vm.monthlyWeekday).toBe('MO')
    console.log('Initial monthlyWeekday:', wrapper.vm.monthlyWeekday)

    // Try to change it to Wednesday
    wrapper.vm.monthlyWeekday = 'WE'
    await wrapper.vm.$nextTick()
    console.log('After setting monthlyWeekday to WE:', wrapper.vm.monthlyWeekday)

    // Run all timers to let watchers complete
    await vi.runAllTimersAsync()
    console.log('After running timers, monthlyWeekday is:', wrapper.vm.monthlyWeekday)

    // This is where the bug appears - it should stay as WE but might get reset to MO
    // This test will fail if the monthlyWeekday gets reset
    expect(wrapper.vm.monthlyWeekday).toBe('WE')
  })

  it('should maintain weekday selection when start date changes', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to monthly frequency and day of week type
    wrapper.vm.frequency = 'MONTHLY'
    wrapper.vm.monthlyRepeatType = 'dayOfWeek'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Initially it should be MO (Monday)
    expect(wrapper.vm.monthlyWeekday).toBe('MO')

    // Change to Wednesday
    wrapper.vm.monthlyWeekday = 'WE'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Make sure our change was applied
    expect(wrapper.vm.monthlyWeekday).toBe('WE')
    console.log('Set weekday to WE before changing start date:', wrapper.vm.monthlyWeekday)

    // Now change the start date
    await wrapper.setProps({
      startDate: tuesdayDate // Tuesday
    })
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    console.log('After changing start date to Tuesday, weekday is:', wrapper.vm.monthlyWeekday)

    // The weekday should still be WE, not changed to TU
    // This test will currently fail because of the bug
    expect(wrapper.vm.monthlyWeekday).toBe('WE')
  })

  it('should emit correct byweekday value with the user-selected day', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to monthly frequency and day of week type
    wrapper.vm.frequency = 'MONTHLY'
    wrapper.vm.monthlyRepeatType = 'dayOfWeek'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Change to Wednesday
    wrapper.vm.monthlyWeekday = 'WE'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Capture and examine the emitted value
    const emitted = wrapper.emitted('update:model-value')
    expect(emitted).toBeTruthy()

    // Get the last emitted value
    const lastEmittedValue = emitted ? emitted[emitted.length - 1][0] : null
    console.log('Emitted rule value:', JSON.stringify(lastEmittedValue))

    // Check that it has the correct weekday
    expect(lastEmittedValue).toHaveProperty('byweekday')
    expect(lastEmittedValue.byweekday).toContain('WE')
  })
})
