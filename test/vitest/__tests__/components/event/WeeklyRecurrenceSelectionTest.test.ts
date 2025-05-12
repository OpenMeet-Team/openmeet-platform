import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import RecurrenceComponent from '../../../../../src/components/event/RecurrenceComponent.vue'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

describe('RecurrenceComponent - Weekly selection behavior', () => {
  const mondayDate = '2023-12-11T12:00:00.000Z' // This is a Monday
  const timeZone = 'America/New_York'

  beforeEach(() => {
    // Use fake timers to make tests deterministic
    vi.useFakeTimers()
    vi.setSystemTime(new Date(mondayDate))

    // Spy on the emit method to track emitted events
    vi.spyOn(console, 'log')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('initializes weekly view with the start date day selected', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to weekly frequency (it's the default anyway)
    wrapper.vm.frequency = 'WEEKLY'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Since we started with Monday, expect Monday to be selected
    expect(wrapper.vm.selectedDays).toContain('MO')
    expect(wrapper.vm.selectedDays.length).toBe(1)
  })

  it('allows selecting multiple days in weekly view', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to weekly frequency
    wrapper.vm.frequency = 'WEEKLY'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Initially Monday should be selected
    expect(wrapper.vm.selectedDays).toContain('MO')
    
    // Toggle additional days (Wednesday and Friday)
    wrapper.vm.toggleDay('WE')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()
    
    wrapper.vm.toggleDay('FR')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()
    
    // Now we should have three days selected
    expect(wrapper.vm.selectedDays).toContain('MO')
    expect(wrapper.vm.selectedDays).toContain('WE')
    expect(wrapper.vm.selectedDays).toContain('FR')
    expect(wrapper.vm.selectedDays.length).toBe(3)
  })

  it('should NOT update start date when selecting different weekdays', async () => {
    // We'll use the wrapper's emitted events instead of spying

    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to weekly frequency
    wrapper.vm.frequency = 'WEEKLY'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Initial state: Monday should be selected
    expect(wrapper.vm.selectedDays).toContain('MO')
    
    // Toggle additional days: add Wednesday
    wrapper.vm.toggleDay('WE')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()
    
    // Use spy on wrapper's emitted events instead
    expect(wrapper.emitted('update:start-date')).toBeFalsy()

    // Add Friday
    wrapper.vm.toggleDay('FR')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Again, verify no start date update
    expect(wrapper.emitted('update:start-date')).toBeFalsy()

    // Remove Monday (the original day)
    wrapper.vm.toggleDay('MO')
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Even when removing the original day, the start date should not change
    expect(wrapper.emitted('update:start-date')).toBeFalsy()
    
    // Now Wednesday and Friday should be selected, but not Monday
    expect(wrapper.vm.selectedDays).not.toContain('MO')
    expect(wrapper.vm.selectedDays).toContain('WE')
    expect(wrapper.vm.selectedDays).toContain('FR')
  })

  it('maintains existing selected days when start date changes', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to weekly frequency
    wrapper.vm.frequency = 'WEEKLY'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Select Monday, Wednesday and Friday
    wrapper.vm.selectedDays = ['MO', 'WE', 'FR']
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()
    
    // Verify our selection
    expect(wrapper.vm.selectedDays).toEqual(['MO', 'WE', 'FR'])
    
    // Now change the start date to Tuesday
    await wrapper.setProps({
      startDate: '2023-12-12T12:00:00.000Z' // Tuesday
    })
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()
    
    // The selected days should still be the same, not reset to Tuesday
    // This would fail if the component incorrectly resets the selected days
    expect(wrapper.vm.selectedDays).toContain('MO')
    expect(wrapper.vm.selectedDays).toContain('WE')
    expect(wrapper.vm.selectedDays).toContain('FR')
    expect(wrapper.vm.selectedDays).not.toContain('TU')
    expect(wrapper.vm.selectedDays.length).toBe(3)
  })

  it('emits the correct byweekday values in the recurrence rule', async () => {
    const wrapper = mount(RecurrenceComponent, {
      props: {
        isRecurring: true,
        startDate: mondayDate,
        timeZone,
        hideToggle: false
      }
    })

    // Set to weekly frequency
    wrapper.vm.frequency = 'WEEKLY'
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Select Monday and Wednesday
    wrapper.vm.selectedDays = ['MO', 'WE']
    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()
    
    // Capture and examine the emitted value
    const emitted = wrapper.emitted('update:model-value')
    expect(emitted).toBeTruthy()
    
    // Get the last emitted value
    const lastEmittedValue = emitted ? emitted[emitted.length - 1][0] : null
    console.log('Emitted rule value:', JSON.stringify(lastEmittedValue))
    
    // Check that it has the correct byweekday values
    expect(lastEmittedValue).toHaveProperty('byweekday')
    expect(lastEmittedValue.byweekday).toContain('MO')
    expect(lastEmittedValue.byweekday).toContain('WE')
    expect(lastEmittedValue.byweekday.length).toBe(2)
  })
})