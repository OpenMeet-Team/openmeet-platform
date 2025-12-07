import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import EventFormBasicComponent from '../../../../../src/components/event/EventFormBasicComponent.vue'
import { eventsApi } from '../../../../../src/api/events'
import { EventType, EventVisibility } from '../../../../../src/types'

// Mock the APIs
vi.mock('../../../../../src/api/events', () => ({
  eventsApi: {
    getBySlug: vi.fn(),
    edit: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  }
}))

vi.mock('../../../../../src/api/categories', () => ({
  categoriesApi: {
    getAll: vi.fn(() => Promise.resolve({ data: [] }))
  }
}))

vi.mock('../../../../../src/api/groups', () => ({
  groupsApi: {
    getAllMe: vi.fn(() => Promise.resolve({ data: [] }))
  }
}))

vi.mock('../../../../../src/api/event-series', () => ({
  eventSeriesApi: {
    getBySlug: vi.fn(),
    createSeriesFromEvent: vi.fn(),
    update: vi.fn()
  }
}))

// Mock notification composable
vi.mock('../../../../../src/composables/useNotification', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

// Mock auth store
vi.mock('../../../../../src/stores/auth-store', () => ({
  useAuthStore: () => ({
    getBlueskyDid: null,
    getBlueskyHandle: null
  })
}))

// Mock date formatting
vi.mock('../../../../../src/composables/useDateFormatting', () => ({
  default: {
    getUserTimezone: () => 'America/New_York'
  }
}))

describe('EventFormBasicComponent - Duplication Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should copy event data when duplicateEventSlug prop is provided', async () => {
    // Mock source event data
    const sourceEvent = {
      id: 123,
      slug: 'test-event',
      name: 'Test Event',
      description: 'Test description',
      location: '123 Test St',
      locationOnline: 'https://example.com/meeting',
      lat: 40.7128,
      lon: -74.0060,
      type: EventType.Hybrid,
      image: { id: 1, path: '/images/test.jpg' },
      categories: [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' }
      ],
      maxAttendees: 50,
      visibility: EventVisibility.Public,
      requireApproval: true,
      approvalQuestion: 'Why do you want to attend?',
      allowWaitlist: true,
      requireGroupMembership: false,
      group: { id: 5, name: 'Test Group' },
      timeZone: 'America/Los_Angeles',
      startDate: '2025-05-15T17:00:00.000Z',
      endDate: '2025-05-15T19:00:00.000Z'
    }

    // Mock the API call
    vi.mocked(eventsApi.getBySlug).mockResolvedValue({ data: sourceEvent } as { data: typeof sourceEvent })

    // Mount component with duplicateEventSlug prop
    const wrapper = mount(EventFormBasicComponent, {
      props: {
        duplicateEventSlug: 'test-event'
      },
      global: {
        plugins: [Quasar],
        stubs: {
          'q-form': false,
          'q-card': true,
          'q-card-section': true,
          'q-input': true,
          'q-select': true,
          'q-tabs': true,
          'q-tab': true,
          'q-separator': true,
          'q-btn': true,
          'q-checkbox': true,
          'q-tab-panels': true,
          'q-tab-panel': true,
          'q-markdown': true,
          'q-icon': true,
          UploadComponent: true,
          LocationComponent: true,
          DatetimeComponent: true,
          RecurrenceComponent: true,
          SpinnerComponent: true
        }
      }
    })

    // Wait for component to mount and API call to complete
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 200))

    // Access the exposed eventData
    const eventData = wrapper.vm.eventData

    // Verify copied fields
    expect(eventData.name).toBe('Test Event (Copy)')
    expect(eventData.description).toBe('Test description')
    expect(eventData.location).toBe('123 Test St')
    expect(eventData.locationOnline).toBe('https://example.com/meeting')
    expect(eventData.lat).toBe(40.7128)
    expect(eventData.lon).toBe(-74.0060)
    expect(eventData.type).toBe(EventType.Hybrid)
    expect(eventData.image).toEqual({ id: 1, path: '/images/test.jpg' })
    expect(eventData.categories).toEqual([
      { id: 1, name: 'Category 1' },
      { id: 2, name: 'Category 2' }
    ])
    expect(eventData.maxAttendees).toBe(50)
    expect(eventData.visibility).toBe(EventVisibility.Public)
    expect(eventData.requireApproval).toBe(true)
    expect(eventData.approvalQuestion).toBe('Why do you want to attend?')
    expect(eventData.allowWaitlist).toBe(true)
    expect(eventData.requireGroupMembership).toBe(false)
    expect(eventData.group).toBe(5) // Should be ID only

    // Verify timezone is copied from source event
    expect(eventData.timeZone).toBe('America/Los_Angeles')

    // Verify dates are NOT copied (should use defaults)
    expect(eventData.startDate).not.toBe(sourceEvent.startDate)
    expect(eventData.endDate).not.toBe(sourceEvent.endDate)

    // Verify API was called with correct slug
    expect(eventsApi.getBySlug).toHaveBeenCalledWith('test-event')
  })

  it('should use user timezone when source event has no timezone', async () => {
    // Mock source event without timezone
    const sourceEventNoTz = {
      id: 789,
      slug: 'no-tz-event',
      name: 'Event Without TZ',
      description: 'Test',
      type: EventType.Online,
      visibility: EventVisibility.Public,
      timeZone: null // No timezone set
    }

    vi.mocked(eventsApi.getBySlug).mockResolvedValue({ data: sourceEventNoTz } as { data: typeof sourceEventNoTz })

    const wrapper = mount(EventFormBasicComponent, {
      props: {
        duplicateEventSlug: 'no-tz-event'
      },
      global: {
        plugins: [Quasar],
        stubs: {
          'q-form': false,
          'q-card': true,
          'q-card-section': true,
          'q-input': true,
          'q-select': true,
          'q-tabs': true,
          'q-tab': true,
          'q-separator': true,
          'q-btn': true,
          'q-checkbox': true,
          'q-tab-panels': true,
          'q-tab-panel': true,
          'q-markdown': true,
          'q-icon': true,
          UploadComponent: true,
          LocationComponent: true,
          DatetimeComponent: true,
          RecurrenceComponent: true,
          SpinnerComponent: true
        }
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 200))

    const eventData = wrapper.vm.eventData

    // Should fall back to user's timezone
    expect(eventData.timeZone).toBe('America/New_York')
  })

  it('should handle duplication error gracefully', async () => {
    // Mock API error
    vi.mocked(eventsApi.getBySlug).mockRejectedValue(new Error('Event not found'))

    const wrapper = mount(EventFormBasicComponent, {
      props: {
        duplicateEventSlug: 'non-existent-event'
      },
      global: {
        plugins: [Quasar],
        stubs: {
          'q-form': false,
          'q-card': true,
          'q-card-section': true,
          'q-input': true,
          'q-select': true,
          'q-tabs': true,
          'q-tab': true,
          'q-separator': true,
          'q-btn': true,
          'q-checkbox': true,
          'q-tab-panels': true,
          'q-tab-panel': true,
          'q-markdown': true,
          'q-icon': true,
          UploadComponent: true,
          LocationComponent: true,
          DatetimeComponent: true,
          RecurrenceComponent: true,
          SpinnerComponent: true
        }
      }
    })

    // Wait for component to mount and API call to fail
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify API was called
    expect(eventsApi.getBySlug).toHaveBeenCalledWith('non-existent-event')

    // Component should still render (error handled gracefully)
    expect(wrapper.exists()).toBe(true)
  })

  it('should not copy series information from recurring events', async () => {
    // Mock source event that is part of a series
    const recurringSourceEvent = {
      id: 456,
      slug: 'recurring-event',
      name: 'Weekly Meetup',
      description: 'Weekly gathering',
      type: EventType.InPerson,
      visibility: EventVisibility.Public,
      seriesSlug: 'weekly-meetup-series', // This should NOT be copied
      seriesId: 789, // This should NOT be copied
      timeZone: 'America/New_York',
      startDate: '2025-05-15T17:00:00.000Z'
    }

    vi.mocked(eventsApi.getBySlug).mockResolvedValue({ data: recurringSourceEvent } as { data: typeof recurringSourceEvent })

    const wrapper = mount(EventFormBasicComponent, {
      props: {
        duplicateEventSlug: 'recurring-event'
      },
      global: {
        plugins: [Quasar],
        stubs: {
          'q-form': false,
          'q-card': true,
          'q-card-section': true,
          'q-input': true,
          'q-select': true,
          'q-tabs': true,
          'q-tab': true,
          'q-separator': true,
          'q-btn': true,
          'q-checkbox': true,
          'q-tab-panels': true,
          'q-tab-panel': true,
          'q-markdown': true,
          'q-icon': true,
          UploadComponent: true,
          LocationComponent: true,
          DatetimeComponent: true,
          RecurrenceComponent: true,
          SpinnerComponent: true
        }
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 200))

    const eventData = wrapper.vm.eventData

    // Verify series info is NOT copied
    expect(eventData.seriesSlug).toBeUndefined()
    expect(eventData.seriesId).toBeUndefined()

    // But other fields are copied
    expect(eventData.name).toBe('Weekly Meetup (Copy)')
    expect(eventData.description).toBe('Weekly gathering')
  })
})
