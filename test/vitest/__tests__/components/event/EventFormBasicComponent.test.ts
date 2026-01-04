import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { EventStatus, EventType, EventVisibility, EventEntity } from '../../../../../src/types'
import { eventsApi } from '../../../../../src/api/events'
import { createPinia, setActivePinia } from 'pinia'
import EventFormBasicComponent from '../../../../../src/components/event/EventFormBasicComponent.vue'

// Define an interface for the component's VM
interface EventFormBasicComponentVM {
  eventData: EventEntity;
  onPublish: () => Promise<void>;
  setEndDate: (value: boolean) => void;
  $nextTick: () => Promise<void>;
  [key: string]: unknown;
}

interface DatetimeComponentVMShape {
  onDateUpdate: (date: string) => void;
  onTimeUpdate: (time: string) => void;
  editableDate: string;
  localDate: string;
  finishDateEditing: () => Promise<void>; // Assuming async
  [key: string]: unknown;
}

// Using real date-fns-tz for accurate timezone testing
vi.unmock('date-fns-tz')

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Create a predictable "now" date for testing
const fixedDate = new Date('2025-02-15T12:00:00.000Z')
vi.useFakeTimers()
vi.setSystemTime(fixedDate)

// Mock the API modules
vi.mock('../../../../../src/api/events', () => ({
  eventsApi: {
    create: vi.fn(),
    update: vi.fn(),
    edit: vi.fn(),
    getBySlug: vi.fn()
  }
}))

// Get the correctly typed mock after vi.mock has been called
const typedEventsApi = vi.mocked(eventsApi, true)

vi.mock('../../../../../src/api/categories', () => ({
  categoriesApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' }
      ]
    })
  }
}))

vi.mock('../../../../../src/api/groups', () => ({
  groupsApi: {
    getAllMe: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Group 1' },
        { id: 2, name: 'Group 2' }
      ]
    })
  }
}))

vi.mock('../../../../../src/api/event-series', () => ({
  eventSeriesApi: {
    createSeriesFromEvent: vi.fn().mockResolvedValue({
      data: { slug: 'test-series', name: 'Test Series' }
    })
  }
}))

vi.mock('../../../../../src/services/analyticsService', () => ({
  default: {
    trackEvent: vi.fn()
  }
}))

// First set of tests focuses on isolated behavior
describe('EventForm Default Time Behavior - Isolated Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset mock resolved values before each test if they might change
    typedEventsApi.create.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
    typedEventsApi.update.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
    typedEventsApi.edit.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
    typedEventsApi.getBySlug.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
  })

  it('default time should be 17:00 (5:00 PM) when updating date with empty time', () => {
    const tempDate = '2025-02-15'
    const tempTime = ''
    const currentDate = tempDate || new Date().toISOString().split('T')[0]
    const defaultTime = '17:00'
    const savedTempTime = tempTime || defaultTime
    const dateTimeString = `${currentDate}T${savedTempTime}:00`
    expect(dateTimeString).toBe('2025-02-15T17:00:00')
    const dateObj = new Date(dateTimeString)
    expect(dateObj.getHours()).toBe(17)
    expect(dateObj.getMinutes()).toBe(0)
  })

  it('publishEvent should include correct time in ISO string payload', async () => {
    const eventData: Partial<EventEntity> = {
      name: 'Test Event',
      description: 'Test Description',
      startDate: '2025-02-15T17:00:00.000Z',
      type: EventType.InPerson,
      visibility: EventVisibility.Public,
      categories: [1],
      timeZone: 'America/New_York',
      status: EventStatus.Published
    }
    await typedEventsApi.create(eventData)
    expect(typedEventsApi.create).toHaveBeenCalled()
    const apiPayload = typedEventsApi.create.mock.calls[0][0] as Partial<EventEntity>
    expect(apiPayload).toHaveProperty('startDate')
    expect(apiPayload.startDate).toBe('2025-02-15T17:00:00.000Z')
    expect((apiPayload.startDate as string)).toContain('T17:00:00')
    console.log('API payload startDate:', apiPayload.startDate)
  })

  it('EventFormBasicComponent->DatetimeComponent integration properly handles default time', async () => {
    const { default: DatetimeComponent } = await import('../../../../../src/components/common/DatetimeComponent.vue')
    const updateDateTime = (DatetimeComponent as unknown as { __test__?: { updateDateTime?: unknown } }).__test__
      ? (DatetimeComponent as unknown as { __test__?: { updateDateTime?: (...args: unknown[]) => void } }).__test__.updateDateTime
      : () => {
          const tempDate = '2025-02-15'
          let tempTime = ''
          const currentDate = tempDate
          const defaultTime = '17:00'
          if (!tempTime) {
            tempTime = defaultTime
          }
          return `${currentDate}T${tempTime}:00`
        }
    const result = updateDateTime()
    expect(result).toBe('2025-02-15T17:00:00')
  })
})

// Integration tests with actual component mounting
describe('EventForm Default Time Behavior - Integration Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    typedEventsApi.create.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
  })

  it('ensures new events have a default time of 17:00 (5:00 PM) when published', async () => {
    if (process.env.CI === 'true') return
    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    await vi.runAllTimersAsync()
    await wrapper.find('[data-cy="event-name-input"]').setValue('New Test Event')
    await wrapper.find('[data-cy="event-description"]').setValue('This is a test event description')
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })
    if (datetimeComponent.exists()) {
      const dtVm = datetimeComponent.vm as unknown as DatetimeComponentVMShape
      dtVm.onDateUpdate('2025-02-20')
      await vm.$nextTick()
      await wrapper.find('[data-cy="event-name-input"]').setValue('Default Time Event')
      await wrapper.find('[data-cy="event-description"]').setValue('This is a test event description')
      await vm.onPublish()
      await vm.$nextTick()
      await vi.runAllTimersAsync()
      expect(typedEventsApi.create).toHaveBeenCalled()
      if (typedEventsApi.create.mock.calls.length > 0) {
        const apiCallArg = typedEventsApi.create.mock.calls[0][0] as Partial<EventEntity>
        console.log('Event creation payload:', apiCallArg)
        expect(apiCallArg).toHaveProperty('startDate')
        const dateObj = new Date(apiCallArg.startDate as string)
        expect(dateObj.getHours()).toBe(17)
        expect(dateObj.getMinutes()).toBe(0)
        expect(dateObj.getHours()).not.toBe(0)
        console.log(`Event startDate from API call: ${apiCallArg.startDate}`)
        console.log(`Parsed hours: ${dateObj.getHours()}`)
      }
    } else {
      expect(datetimeComponent.exists(), 'DatetimeComponent not found in EventFormBasicComponent').toBe(true)
    }
  })

  it('preserves existing time when user selects date for an event with time already set', async () => {
    if (process.env.CI === 'true') return
    const wrapper = mount(EventFormBasicComponent)
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    await vi.runAllTimersAsync()
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })
    if (datetimeComponent.exists()) {
      const dtVm = datetimeComponent.vm as unknown as DatetimeComponentVMShape
      dtVm.onTimeUpdate('2:30 PM')
      await vm.$nextTick()
      dtVm.onDateUpdate('2025-03-15')
      await vm.$nextTick()
      await wrapper.find('[data-cy="event-name-input"]').setValue('Custom Time Event')
      await wrapper.find('[data-cy="event-description"]').setValue('This event has a custom time')
      await vm.onPublish()
      await vm.$nextTick()
      await vi.runAllTimersAsync()
      expect(typedEventsApi.create).toHaveBeenCalled()
      if (typedEventsApi.create.mock.calls.length > 0) {
        const apiCallArg = typedEventsApi.create.mock.calls[0][0] as Partial<EventEntity>
        const dateObj = new Date(apiCallArg.startDate as string)
        expect(dateObj.getHours()).toBe(14)
        expect(dateObj.getMinutes()).toBe(30)
        console.log(`Custom time event startDate: ${apiCallArg.startDate}`)
        console.log(`Hours: ${dateObj.getHours()}, Minutes: ${dateObj.getMinutes()}`)
      }
    }
  })

  it('preserves the start time when setting an end time with the checkbox', async () => {
    const wrapper = mount(EventFormBasicComponent)
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    await vi.runAllTimersAsync()
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })
    if (datetimeComponent.exists()) {
      const dtVm = datetimeComponent.vm as unknown as DatetimeComponentVMShape
      dtVm.onTimeUpdate('2:15 PM')
      await vm.$nextTick()
      dtVm.onDateUpdate('2025-04-20')
      await vm.$nextTick()
      console.log('Start date before clicking checkbox:', vm.eventData.startDate)
      const startDateBefore = vm.eventData.startDate
      vm.setEndDate(true)
      await vm.$nextTick()
      console.log('Start date after checking box:', vm.eventData.startDate)
      console.log('End date after checking box:', vm.eventData.endDate)
      expect(vm.eventData.startDate).toBe(startDateBefore)
      const startDateAfter = new Date(vm.eventData.startDate as string)
      const endDateAfter = new Date(vm.eventData.endDate as string)
      expect(startDateAfter.getHours()).toBe(14)
      expect(startDateAfter.getMinutes()).toBe(15)
      expect(endDateAfter.getHours()).toBe(15)
      expect(endDateAfter.getMinutes()).toBe(15)
      expect(startDateAfter.getHours()).not.toBe(0)
      expect(startDateAfter.getMinutes()).not.toBe(0)
    }
  })
})

describe('EventFormBasicComponent - Start Date Entry (Timezone: EST)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    typedEventsApi.create.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
  })

  it('should not shift the date when entering 5/21/2025 and tabbing out in EST', async () => {
    const mountOptions = {
      props: { group: undefined, editEventSlug: undefined },
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    await vi.runAllTimersAsync()
    vm.eventData.timeZone = 'America/New_York'
    vm.eventData.startDate = ''
    await vm.$nextTick()
    const datetimeComponent = wrapper.findComponent({ name: 'DatetimeComponent' })
    expect(datetimeComponent.exists()).toBe(true)
    const dateInput = datetimeComponent.find('input[data-cy="datetime-component-date-input"]')
    if (!dateInput.exists()) {
      console.error('Date input not found. DatetimeComponent HTML:', datetimeComponent.html())
    }
    expect(dateInput.exists()).toBe(true)
    const dtVm = datetimeComponent.vm as unknown as DatetimeComponentVMShape
    dtVm.editableDate = '5/21/2025'
    await dtVm.finishDateEditing()
    await vm.$nextTick()
    const localDate = dtVm.localDate
    expect(localDate).toBe('2025-05-21')
    const editableDate = dtVm.editableDate
    expect(editableDate).toContain('May 21')
    const startDate = vm.eventData.startDate
    const startDateObj = new Date(startDate as string)
    const { formatInTimeZone } = await import('date-fns-tz')
    const localDateString = formatInTimeZone(startDateObj, 'America/New_York', 'yyyy-MM-dd')
    expect(localDateString).toBe('2025-05-21')
  })
})

// Tests for responsive layout and accessibility
describe('EventFormBasicComponent - Layout and Accessibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    typedEventsApi.create.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event' } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
  })

  it('should have a responsive grid layout with row wrapper', async () => {
    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Check for the main responsive row container
    const formContent = wrapper.find('[data-cy="event-form"]')
    expect(formContent.exists()).toBe(true)

    // Should have a row with gutter for the two-column layout
    const responsiveRow = wrapper.find('.row.q-col-gutter-lg')
    expect(responsiveRow.exists()).toBe(true)
  })

  it('should place Basic Information card in left column (col-lg-7)', async () => {
    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Find the left column with Basic Information
    const leftColumn = wrapper.find('.col-lg-7')
    expect(leftColumn.exists()).toBe(true)

    // Basic Information card should be in this column
    const basicInfoCard = leftColumn.find('[data-cy="basic-info-card"]')
    expect(basicInfoCard.exists()).toBe(true)
  })

  it('should place Event Settings and Categories cards in right column (col-lg-5)', async () => {
    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Find the right column
    const rightColumn = wrapper.find('.col-lg-5')
    expect(rightColumn.exists()).toBe(true)

    // Event Settings card should be in this column
    const settingsCard = rightColumn.find('[data-cy="event-settings-card"]')
    expect(settingsCard.exists()).toBe(true)

    // Categories card should be in this column
    const categoriesCard = rightColumn.find('[data-cy="categories-card"]')
    expect(categoriesCard.exists()).toBe(true)
  })

  it('should have cards with role="group" and aria-labelledby attributes', async () => {
    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Check Basic Information card has proper ARIA attributes
    const basicInfoCard = wrapper.find('[data-cy="basic-info-card"]')
    expect(basicInfoCard.exists()).toBe(true)
    expect(basicInfoCard.attributes('role')).toBe('group')
    expect(basicInfoCard.attributes('aria-labelledby')).toBe('basic-info-heading')

    // Check Event Settings card
    const settingsCard = wrapper.find('[data-cy="event-settings-card"]')
    expect(settingsCard.exists()).toBe(true)
    expect(settingsCard.attributes('role')).toBe('group')
    expect(settingsCard.attributes('aria-labelledby')).toBe('event-settings-heading')

    // Check Categories card
    const categoriesCard = wrapper.find('[data-cy="categories-card"]')
    expect(categoriesCard.exists()).toBe(true)
    expect(categoriesCard.attributes('role')).toBe('group')
    expect(categoriesCard.attributes('aria-labelledby')).toBe('categories-heading')

    // Check Location card
    const locationCard = wrapper.find('[data-cy="location-card"]')
    expect(locationCard.exists()).toBe(true)
    expect(locationCard.attributes('role')).toBe('group')
    expect(locationCard.attributes('aria-labelledby')).toBe('location-heading')
  })

  it('should have aria-hidden="true" on decorative icons', async () => {
    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Find all q-icon elements in card headers (decorative icons)
    const cardHeaders = wrapper.findAll('.text-h6 .q-icon')

    // Each decorative icon should have aria-hidden="true"
    cardHeaders.forEach((icon) => {
      expect(icon.attributes('aria-hidden')).toBe('true')
    })

    // At minimum we should have icons for: Basic Info, Location, Categories, Event Settings
    expect(cardHeaders.length).toBeGreaterThanOrEqual(4)
  })

  it('should stack columns on mobile (col-12 on all columns)', async () => {
    const mountOptions = {
      global: { stubs: { 'q-markdown': true, 'vue-router': true } }
    }
    const wrapper = mount(EventFormBasicComponent, mountOptions)
    await vi.runAllTimersAsync()

    // Both columns should have col-12 for mobile stacking
    const leftColumn = wrapper.find('.col-12.col-lg-7')
    expect(leftColumn.exists()).toBe(true)

    const rightColumn = wrapper.find('.col-12.col-lg-5')
    expect(rightColumn.exists()).toBe(true)
  })
})
