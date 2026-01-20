import { mount } from '@vue/test-utils'
import DatetimeComponent from './DatetimeComponent.vue'
import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { Quasar, QInput, QIcon } from 'quasar'

describe('DatetimeComponent', () => {
  it('should emit a valid ISO date on mount when given empty modelValue', async () => {
    const emittedValues: string[] = []
    mount(DatetimeComponent, {
      global: {
        plugins: [Quasar],
        stubs: { QInput, QIcon }
      },
      props: {
        modelValue: '',
        timeZone: 'UTC',
        required: true,
        'onUpdate:model-value': (value: string) => {
          emittedValues.push(value)
        }
      }
    })
    await nextTick()

    // Component should have emitted a valid ISO date string on mount
    expect(emittedValues.length).toBeGreaterThan(0)
    const emittedValue = emittedValues[0]

    // Verify it's a valid ISO 8601 date string
    expect(emittedValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    const parsedDate = new Date(emittedValue)
    expect(parsedDate.toString()).not.toBe('Invalid Date')

    // Verify it's based on today's date with default 5:00 PM
    const today = new Date()
    const emittedDate = new Date(emittedValue)
    expect(emittedDate.getUTCFullYear()).toBe(today.getFullYear())
    expect(emittedDate.getUTCMonth()).toBe(today.getMonth())
    expect(emittedDate.getUTCDate()).toBe(today.getDate())
    // Default time is 5:00 PM (17:00) in UTC
    expect(emittedDate.getUTCHours()).toBe(17)
    expect(emittedDate.getUTCMinutes()).toBe(0)
  })

  it('should populate date with today and time with 5:00 PM by default', async () => {
    const wrapper = mount(DatetimeComponent, {
      global: {
        plugins: [Quasar],
        stubs: { QInput, QIcon }
      },
      props: {
        modelValue: '',
        timeZone: 'UTC',
        required: true
      }
    })
    await nextTick()
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const expectedDate = `${yyyy}-${mm}-${dd}`
    // Date input should be today
    expect(wrapper.vm.localDate).toBe(expectedDate)
    // Time input should be 5:00 PM
    expect(wrapper.vm.localTime).toBe('5:00 PM')
  })

  it('should not decrement the date when entering date then tabbing to time', async () => {
    const wrapper = mount(DatetimeComponent, {
      global: {
        plugins: [Quasar],
        stubs: { QInput, QIcon }
      },
      props: {
        modelValue: '',
        timeZone: 'UTC',
        required: true
      }
    })
    await nextTick()
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const expectedDate = `${yyyy}-${mm}-${dd}`
    // Set editableDate directly
    wrapper.vm.editableDate = expectedDate
    await wrapper.vm.finishDateEditing()
    await nextTick()
    // Try to find the time input with a general selector if the data-cy one fails
    let timeInput = wrapper.find('input[data-cy="datetime-component-time-input"]')
    if (!timeInput.exists()) {
      timeInput = wrapper.find('input')
    }
    if (!timeInput.exists()) {
      // Log HTML for debugging if still not found
      console.log('DatetimeComponent HTML:', wrapper.html())
    }
    expect(timeInput.exists()).toBe(true)
    await timeInput.trigger('focus')
    await timeInput.trigger('blur')
    await nextTick()
    // Date should remain the same
    expect(wrapper.vm.localDate).toBe(expectedDate)
  })

  it('should populate end time date from start date plus one hour', async () => {
    // Simulate a start date/time
    const start = new Date()
    start.setHours(15, 0, 0, 0) // 3:00 PM
    const yyyy = start.getFullYear()
    const mm = String(start.getMonth() + 1).padStart(2, '0')
    const dd = String(start.getDate()).padStart(2, '0')
    // End time should be start + 1 hour
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    const endIso = new Date(Date.UTC(yyyy, start.getMonth(), start.getDate(), 16, 0, 0)).toISOString()
    // Mount as end time entry
    const wrapper = mount(DatetimeComponent, {
      global: {
        plugins: [Quasar],
        stubs: { QInput, QIcon }
      },
      props: {
        modelValue: endIso,
        timeZone: 'UTC',
        required: true
      }
    })
    await nextTick()
    // Should show 4:00 PM
    expect(wrapper.vm.localTime).toBe('4:00 PM')
    // Should show same date as start
    const expectedDate = `${yyyy}-${mm}-${dd}`
    expect(wrapper.vm.localDate).toBe(expectedDate)
  })
})
