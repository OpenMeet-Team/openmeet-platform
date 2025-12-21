import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { EventType, EventVisibility, EventEntity } from '../../../../../src/types'
import { eventsApi } from '../../../../../src/api/events'
import { createPinia, setActivePinia } from 'pinia'
import EventFormBasicComponent from '../../../../../src/components/event/EventFormBasicComponent.vue'

// Define an interface for the component's VM
interface EventFormBasicComponentVM {
  eventData: EventEntity;
  sendNotifications: boolean;
  onPublish: () => Promise<void>;
  $nextTick: () => Promise<void>;
  [key: string]: unknown;
}

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Create a predictable "now" date for testing
const fixedDate = new Date('2025-12-21T12:00:00.000Z')
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

describe('EventFormBasicComponent - Notification Toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    typedEventsApi.create.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event', id: 1 } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })

    typedEventsApi.update.mockResolvedValue({
      data: { slug: 'test-event', name: 'Test Event', id: 1 } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })

    typedEventsApi.edit.mockResolvedValue({
      data: {
        slug: 'test-event',
        name: 'Test Event',
        id: 1,
        description: 'Test description',
        startDate: '2025-12-22T17:00:00.000Z',
        type: EventType.InPerson,
        visibility: EventVisibility.Public,
        timeZone: 'America/New_York'
      } as EventEntity,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: { headers: new Headers() }
    })
  })

  it('should have a notification toggle checkbox in the form', async () => {
    const wrapper = mount(EventFormBasicComponent, {
      props: { editEventSlug: 'test-event' },
      global: {
        stubs: {
          'q-markdown': true,
          'vue-router': true
        }
      }
    })

    await vi.runAllTimersAsync()

    // Look for the notification toggle checkbox
    const notificationCheckbox = wrapper.find('[data-cy="event-notify-attendees"]')
    expect(notificationCheckbox.exists()).toBe(true)
  })

  it('should default the notification toggle to unchecked', async () => {
    const wrapper = mount(EventFormBasicComponent, {
      props: { editEventSlug: 'test-event' },
      global: {
        stubs: {
          'q-markdown': true,
          'vue-router': true
        }
      }
    })

    await vi.runAllTimersAsync()

    const vm = wrapper.vm as unknown as EventFormBasicComponentVM
    expect(vm.sendNotifications).toBe(false)
  })

  it('should send sendNotifications: false when toggle is unchecked during update', async () => {
    const wrapper = mount(EventFormBasicComponent, {
      props: { editEventSlug: 'test-event' },
      global: {
        stubs: {
          'q-markdown': true,
          'vue-router': true
        }
      }
    })

    await vi.runAllTimersAsync()

    const vm = wrapper.vm as unknown as EventFormBasicComponentVM

    // Ensure checkbox is unchecked
    vm.sendNotifications = false

    // Trigger publish
    await vm.onPublish()
    await vm.$nextTick()
    await vi.runAllTimersAsync()

    // Verify API was called with sendNotifications: false (or undefined, which defaults to false)
    expect(typedEventsApi.update).toHaveBeenCalled()
    const updateCall = typedEventsApi.update.mock.calls[0]
    const [slug, payload] = updateCall

    expect(slug).toBe('test-event')
    expect(payload).toHaveProperty('sendNotifications')
    expect(payload.sendNotifications).toBe(false)
  })

  it('should send sendNotifications: true when toggle is checked during update', async () => {
    const wrapper = mount(EventFormBasicComponent, {
      props: { editEventSlug: 'test-event' },
      global: {
        stubs: {
          'q-markdown': true,
          'vue-router': true
        }
      }
    })

    await vi.runAllTimersAsync()

    const vm = wrapper.vm as unknown as EventFormBasicComponentVM

    // Check the notification toggle
    vm.sendNotifications = true

    // Trigger publish
    await vm.onPublish()
    await vm.$nextTick()
    await vi.runAllTimersAsync()

    // Verify API was called with sendNotifications: true
    expect(typedEventsApi.update).toHaveBeenCalled()
    const updateCall = typedEventsApi.update.mock.calls[0]
    const [slug, payload] = updateCall

    expect(slug).toBe('test-event')
    expect(payload).toHaveProperty('sendNotifications')
    expect(payload.sendNotifications).toBe(true)
  })

  it('should not send sendNotifications parameter when creating a new event', async () => {
    const wrapper = mount(EventFormBasicComponent, {
      global: {
        stubs: {
          'q-markdown': true,
          'vue-router': true
        }
      }
    })

    await vi.runAllTimersAsync()

    const vm = wrapper.vm as unknown as EventFormBasicComponentVM

    // Fill in required fields
    vm.eventData.name = 'New Event'
    vm.eventData.description = 'Test description'
    vm.eventData.startDate = '2025-12-22T17:00:00.000Z'

    // Trigger publish
    await vm.onPublish()
    await vm.$nextTick()
    await vi.runAllTimersAsync()

    // Verify API was called without sendNotifications parameter for new events
    expect(typedEventsApi.create).toHaveBeenCalled()
    const createCall = typedEventsApi.create.mock.calls[0]
    const [payload] = createCall

    // Should not have sendNotifications property for new events
    expect(payload).not.toHaveProperty('sendNotifications')
  })

  it('should display helper text explaining the notification toggle', async () => {
    const wrapper = mount(EventFormBasicComponent, {
      props: { editEventSlug: 'test-event' },
      global: {
        stubs: {
          'q-markdown': true,
          'vue-router': true
        }
      }
    })

    await vi.runAllTimersAsync()

    // Look for helper text
    const helperText = wrapper.find('[data-cy="event-notify-attendees-hint"]')
    expect(helperText.exists()).toBe(true)
    expect(helperText.text()).toContain('Send email to RSVPed attendees about this update')
  })
})
