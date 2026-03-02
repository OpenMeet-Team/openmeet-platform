import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { createPinia, setActivePinia, type Pinia } from 'pinia'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Mock FullCalendar and plugins (same as UnifiedCalendarComponent tests)
vi.mock('@fullcalendar/vue3', () => ({
  default: {
    name: 'FullCalendar',
    props: ['options'],
    template: '<div class="fc-mock" data-testid="fullcalendar"></div>',
    methods: {
      getApi () {
        return {
          changeView: vi.fn(),
          gotoDate: vi.fn(),
          today: vi.fn(),
          prev: vi.fn(),
          next: vi.fn(),
          scrollToTime: vi.fn(),
          view: { type: 'timeGridDay' }
        }
      }
    }
  }
}))
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/list', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))
vi.mock('@fullcalendar/luxon3', () => ({ default: {} }))

// Mock API modules
vi.mock('../../../../../src/api/calendar', () => ({
  getExternalEvents: vi.fn(() => Promise.resolve({ data: { events: [] } }))
}))

// Mock vue-router
const mockRoute = {
  params: { slug: 'test-group' },
  query: {} as Record<string, string>
}

const mockReplace = vi.fn()
const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush
  })
}))

// Mock stores
const mockGroupStore = {
  group: {
    slug: 'test-group',
    name: 'Test Group',
    events: [
      {
        ulid: 'evt-001',
        slug: 'team-meeting',
        name: 'Team Meeting',
        startDate: '2025-06-15T14:00:00Z',
        endDate: '2025-06-15T16:00:00Z',
        status: 'published'
      }
    ]
  },
  getterIsPublicGroup: true,
  getterIsAuthenticatedGroup: false,
  getterUserHasPermission: () => true,
  actionGetGroupEvents: vi.fn(() => Promise.resolve())
}

vi.mock('../../../../../src/stores/group-store', () => ({
  useGroupStore: () => mockGroupStore
}))

const mockAuthStore = {
  user: { id: 'test-user', email: 'test@example.com' },
  isAuthenticated: true
}

vi.mock('../../../../../src/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

// Mock the calendar event sources composable (used inside UnifiedCalendarComponent)
vi.mock('../../../../../src/composables/useCalendarEventSources', () => ({
  useCalendarEventSources: vi.fn(() => ({
    personalEventsSource: { id: 'personal', events: vi.fn() },
    externalEventsSource: { id: 'external', events: vi.fn() },
    groupEventsSource: { value: null }
  }))
}))

vi.mock('../../../../../src/stores/home-store', () => ({
  useHomeStore: () => ({
    userUpcomingEvents: [],
    actionGetUserHomeState: vi.fn(() => Promise.resolve())
  })
}))

vi.mock('../../../../../src/stores/dashboard-store', () => ({
  useDashboardStore: () => ({
    events: null,
    actionGetDashboardEvents: vi.fn(() => Promise.resolve())
  })
}))

// Import component after all mocks are set up
import GroupEventsPage from '../../../../../src/pages/group/GroupEventsPage.vue'

describe('GroupEventsPage - URL Deep Linking', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'))

    // Reset route query
    mockRoute.query = {}
    mockRoute.params = { slug: 'test-group' }
    mockReplace.mockClear()
    mockPush.mockClear()
    mockGroupStore.actionGetGroupEvents.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders without URL query params (default behavior)', async () => {
    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-cy="group-events-page"]').exists()).toBe(true)
  })

  it('passes date query param as initialDate to UnifiedCalendarComponent', async () => {
    mockRoute.query = { date: '2025-08-20' }

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    expect(calendar.exists()).toBe(true)
    expect(calendar.props('initialDate')).toBe('2025-08-20')
  })

  it('passes view query param as initialView to UnifiedCalendarComponent', async () => {
    mockRoute.query = { view: 'week' }

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    expect(calendar.exists()).toBe(true)
    expect(calendar.props('initialView')).toBe('week')
  })

  it('passes hour query param as scrollToHour to UnifiedCalendarComponent', async () => {
    mockRoute.query = { view: 'day', hour: '14' }

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    expect(calendar.exists()).toBe(true)
    expect(calendar.props('scrollToHour')).toBe(14)
  })

  it('uses view query param for the mode prop', async () => {
    mockRoute.query = { view: 'week' }

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    expect(calendar.props('mode')).toBe('week')
  })

  it('defaults mode to "month" when no view query param', async () => {
    mockRoute.query = {}

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    expect(calendar.props('mode')).toBe('month')
  })

  it('updates URL with both date and view when datesSet fires', async () => {
    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })

    // Simulate datesSet event — this should update BOTH date and view in one router.replace call
    calendar.vm.$emit('datesSet', {
      startStr: '2025-07-01',
      endStr: '2025-07-31',
      view: {
        type: 'dayGridMonth',
        currentStart: new Date('2025-07-01T00:00:00Z')
      }
    })

    await wrapper.vm.$nextTick()

    expect(mockReplace).toHaveBeenCalled()
    const replaceCall = mockReplace.mock.calls[0][0]
    expect(replaceCall.query.date).toBe('2025-07-01')
    expect(replaceCall.query.view).toBe('month')
  })

  it('formats date correctly for UTC dates (no off-by-one from timezone)', async () => {
    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })

    // July 1 at UTC midnight — getDate() in US timezones would return June 30
    calendar.vm.$emit('datesSet', {
      startStr: '2025-07-01',
      endStr: '2025-07-31',
      view: {
        type: 'dayGridMonth',
        currentStart: new Date('2025-07-01T00:00:00Z')
      }
    })

    await wrapper.vm.$nextTick()

    const replaceCall = mockReplace.mock.calls[0][0]
    expect(replaceCall.query.date).toBe('2025-07-01')
  })

  it('adds hour param when datesSet fires with a time grid view', async () => {
    vi.setSystemTime(new Date('2025-06-15T14:30:00.000Z'))

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })

    calendar.vm.$emit('datesSet', {
      startStr: '2025-06-15',
      endStr: '2025-06-21',
      view: {
        type: 'timeGridWeek',
        currentStart: new Date('2025-06-15T00:00:00Z')
      }
    })

    await wrapper.vm.$nextTick()

    const replaceCall = mockReplace.mock.calls[0][0]
    expect(replaceCall.query.view).toBe('week')
    expect(replaceCall.query.hour).toBeDefined()
  })

  it('does not leak stale query params when datesSet fires (race condition fix)', async () => {
    // Simulate stale route.query containing params from a previous navigation
    // that Vue Router hasn't fully processed yet — e.g., an hour param left over
    // from a week view, or an unknown param from another source
    mockRoute.query = { date: '2025-06-15', view: 'week', hour: '14', staleParam: 'should-not-leak' }

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })

    // Switch to month view — should NOT carry over staleParam or hour from route.query
    calendar.vm.$emit('datesSet', {
      startStr: '2025-07-01',
      endStr: '2025-07-31',
      view: {
        type: 'dayGridMonth',
        currentStart: new Date('2025-07-01T00:00:00Z')
      }
    })

    await wrapper.vm.$nextTick()

    expect(mockReplace).toHaveBeenCalled()
    const replaceCall = mockReplace.mock.calls[0][0]

    // Should only contain params we explicitly set
    expect(replaceCall.query.date).toBe('2025-07-01')
    expect(replaceCall.query.view).toBe('month')

    // Must NOT contain stale params leaked from route.query spread
    expect(replaceCall.query.staleParam).toBeUndefined()

    // Month view should not have hour param (even though route.query had one)
    expect(replaceCall.query.hour).toBeUndefined()

    // Verify the query has ONLY the expected keys
    const queryKeys = Object.keys(replaceCall.query)
    expect(queryKeys).toEqual(['date', 'view'])
  })

  it('handles invalid view query param gracefully', async () => {
    mockRoute.query = { view: 'invalid-view' }

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    // Should still render without errors
    expect(wrapper.exists()).toBe(true)
    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    // Should fall back to month mode
    expect(calendar.props('mode')).toBe('month')
  })

  it('passes all three URL params together', async () => {
    mockRoute.query = { date: '2025-09-15', view: 'day', hour: '10' }

    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    expect(calendar.props('initialDate')).toBe('2025-09-15')
    expect(calendar.props('initialView')).toBe('day')
    expect(calendar.props('scrollToHour')).toBe(10)
    expect(calendar.props('mode')).toBe('day')
  })

  it('updates URL query when datesSet fires with new date range', async () => {
    const wrapper = mount(GroupEventsPage, {
      global: { plugins: [pinia] }
    })

    await wrapper.vm.$nextTick()
    await vi.runAllTimersAsync()
    await wrapper.vm.$nextTick()

    const calendar = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    calendar.vm.$emit('datesSet', {
      startStr: '2025-08-01T00:00:00Z',
      endStr: '2025-08-31T23:59:59Z',
      view: { type: 'dayGridMonth', currentStart: new Date('2025-08-01T00:00:00Z') }
    })

    await wrapper.vm.$nextTick()

    // The onDatesSet handler should update the router query
    expect(mockReplace).toHaveBeenCalled()
  })
})
