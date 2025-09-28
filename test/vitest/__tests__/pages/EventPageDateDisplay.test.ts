import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventPage from '../../../../src/pages/EventPage.vue'
import { installRouter } from '../../install-router'
import { installPinia } from '../../install-pinia'
import { useEventStore } from '../../../../src/stores/event-store'
import dateFormatting from '../../../../src/composables/useDateFormatting'

// Mocks must come before importing the component that uses them!
vi.mock('src/api/events', () => ({
  eventsApi: {
    getBySlug: vi.fn().mockResolvedValue({ data: { id: '1', name: 'Default Test Event' } }),
    similarEvents: vi.fn().mockResolvedValue({ data: [] })
  }
}))
vi.mock('src/api/chat', () => ({
  chatApi: {}
}))
vi.mock('../../../../src/composables/useDateFormatting', () => ({
  default: {
    getUserTimezone: vi.fn(),
    formatWithTimezone: vi.fn((date, _options, tz) => {
      if (!date) return 'Invalid Date'
      return `Formatted: ${new Date(date).toISOString()} using TZ: ${tz}`
    }),
    formatWithPattern: vi.fn(),
    getTimezoneDisplay: vi.fn(),
    getTimezones: vi.fn(),
    searchTimezones: vi.fn()
  }
}))
vi.mock('../../../../src/services/eventSeriesService', () => ({
  EventSeriesService: {
    getEventsBySeriesSlug: vi.fn().mockResolvedValue([]),
    getBySlug: vi.fn().mockResolvedValue({ recurrenceRule: null, timeZone: null }),
    getOccurrences: vi.fn().mockResolvedValue([])
  }
}))
vi.mock('../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    user: { slug: 'test-user-slug', id: 'user-1' },
    getUserId: 'user-1'
  }))
}))

installQuasarPlugin()
installPinia({ createSpy: vi.fn })
installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

const MOCK_EVENT_BASE = {
  id: 'evt1',
  ulid: 'ulid1',
  slug: 'test-event-for-dates',
  name: 'Timezone Test Event',
  description: 'An event to test timezone displays.',
  startDate: '2024-06-03T08:30:00.000Z',
  endDate: '2024-06-03T10:30:00.000Z',
  type: 'Hybrid',
  status: 'Published',
  image: null,
  series: null,
  seriesSlug: null,
  attendee: null,
  attendeesCount: 5,
  maxAttendees: 20,
  isRecurring: false,
  requireApproval: false,
  group: { name: 'Test Group', visibility: 'public', image: null, slug: 'test-group' },
  location: 'Test Location',
  locationOnline: 'http://test.online',
  lat: 0,
  lon: 0,
  timeZone: 'America/New_York',
  categories: [],
  sourceType: null,
  topics: [],
  user: { id: 'user-1', slug: 'owner-slug', name: 'Owner User' },
  lead: null
}

describe('EventPageDateDisplay.vue', () => {
  let eventStore

  beforeEach(() => {
    vi.clearAllMocks()
    global.window.scrollTo = vi.fn()
    global.window.lastEventPageLoad = {}
    global.window.eventBeingLoaded = null

    eventStore = useEventStore()
    eventStore.event = { ...MOCK_EVENT_BASE }
    eventStore.errorMessage = null
    eventStore.getterUserIsAttendee = vi.fn().mockReturnValue(false)
    eventStore.getterGroupMemberHasPermission = vi.fn().mockReturnValue(false)
    eventStore.getterUserHasPermission = vi.fn().mockReturnValue(false)
    eventStore.actionGetEventBySlug = vi.fn().mockResolvedValue(undefined)
    eventStore.actionMaterializeOccurrence = vi.fn().mockResolvedValue({ slug: 'materialized-slug' })

    vi.spyOn(dateFormatting, 'getUserTimezone').mockReturnValue('America/New_York')
    vi.spyOn(dateFormatting, 'formatWithTimezone').mockImplementation((date, _options, tz) => {
      if (!date) return 'Invalid Date'
      return `Formatted: ${new Date(date).toISOString()} using TZ: ${tz}`
    })
  })

  it('displays event time using user timezone if event has no timezone', async () => {
    vi.spyOn(dateFormatting, 'getUserTimezone').mockReturnValue('Europe/Berlin')
    eventStore.event = {
      ...MOCK_EVENT_BASE,
      timeZone: null,
      series: { timeZone: null },
      startDate: '2024-06-03T08:30:00.000Z'
    }

    const wrapper = mount(EventPage, {
      global: {
        mocks: { $route: { params: { slug: 'test-event-for-dates' }, query: {} } }
      }
    })
    await wrapper.vm.$nextTick()

    const expectedFormattedDateString = `Formatted: ${new Date(eventStore.event.startDate).toISOString()} using TZ: Europe/Berlin`
    const dateDisplayElements = wrapper.findAll('.text-body2.text-bold')
    let found = false
    dateDisplayElements.forEach(el => {
      if (el.text().includes(expectedFormattedDateString)) {
        found = true
      }
    })
    expect(found).toBe(true)

    expect(wrapper.html()).toContain('Dates shown in your local time (Europe/Berlin)')
    // expect(wrapper.html()).toContain('(event timezone not specified)')
  })

  it('displays event time using event timezone when user timezone is the same', async () => {
    vi.spyOn(dateFormatting, 'getUserTimezone').mockReturnValue('America/New_York')
    eventStore.event = {
      ...MOCK_EVENT_BASE,
      timeZone: 'America/New_York',
      startDate: '2024-06-03T08:30:00.000Z'
    }

    const wrapper = mount(EventPage, {
      global: {
        mocks: { $route: { params: { slug: 'test-event-for-dates' }, query: {} } }
      }
    })
    await wrapper.vm.$nextTick()

    const expectedFormattedDateString = `Formatted: ${new Date(eventStore.event.startDate).toISOString()} using TZ: America/New_York`
    const dateDisplayElements = wrapper.findAll('.text-body2.text-bold')
    let found = false
    dateDisplayElements.forEach(el => {
      if (el.text().includes(expectedFormattedDateString)) {
        found = true
      }
    })
    expect(found).toBe(true)

    const caption = wrapper.find('.q-item-label[caption]')
    expect(caption.exists()).toBe(false)
  })

  it('displays only user timezone when user and event timezones are the same', async () => {
    vi.spyOn(dateFormatting, 'getUserTimezone').mockReturnValue('America/New_York')
    eventStore.event = {
      ...MOCK_EVENT_BASE,
      timeZone: 'America/New_York',
      startDate: '2024-06-03T08:30:00.000Z'
    }

    const wrapper = mount(EventPage, {
      global: {
        mocks: { $route: { params: { slug: 'test-event-for-dates' }, query: {} } }
      }
    })
    await wrapper.vm.$nextTick()

    // Main time should be in user timezone
    const expectedFormattedDateString = `Formatted: ${new Date(eventStore.event.startDate).toISOString()} using TZ: America/New_York`
    const dateDisplayElements = wrapper.findAll('.text-body2.text-bold')
    let found = false
    dateDisplayElements.forEach(el => {
      if (el.text().includes(expectedFormattedDateString)) {
        found = true
      }
    })
    expect(found).toBe(true)

    // There should NOT be a secondary line for event timezone
    expect(wrapper.html()).not.toContain('Event time in original timezone')
    // Caption should clarify local time
    expect(wrapper.html()).toContain('Dates shown in your local time (America/New_York)')
  })

  it('falls back to event timezone if user timezone is missing', async () => {
    vi.spyOn(dateFormatting, 'getUserTimezone').mockReturnValue(undefined)
    eventStore.event = {
      ...MOCK_EVENT_BASE,
      timeZone: 'America/Chicago',
      startDate: '2024-06-03T08:30:00.000Z'
    }

    const wrapper = mount(EventPage, {
      global: {
        mocks: { $route: { params: { slug: 'test-event-for-dates' }, query: {} } }
      }
    })
    await wrapper.vm.$nextTick()

    // Should fall back to event timezone for display
    const expectedFormattedDateString = `Formatted: ${new Date(eventStore.event.startDate).toISOString()} using TZ: America/Chicago`
    const dateDisplayElements = wrapper.findAll('.text-body2.text-bold')
    let found = false
    dateDisplayElements.forEach(el => {
      if (el.text().includes(expectedFormattedDateString)) {
        found = true
      }
    })
    expect(found).toBe(true)

    // Should not show a secondary line since user timezone is missing
    expect(wrapper.html()).not.toContain('Event time in original timezone')
    // Caption should not error
    expect(wrapper.html()).toContain('Dates shown in your local time')
  })
})
