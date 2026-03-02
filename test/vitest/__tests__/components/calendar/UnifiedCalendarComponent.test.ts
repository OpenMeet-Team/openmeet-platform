import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { ref } from 'vue'
import UnifiedCalendarComponent from '../../../../../src/components/calendar/UnifiedCalendarComponent.vue'

// Install Quasar for testing
installQuasarPlugin({ plugins: { Notify } })

// Mock FullCalendar Vue3 component
vi.mock('@fullcalendar/vue3', () => ({
  default: {
    name: 'FullCalendar',
    props: ['options'],
    template: '<div class="fc-mock" data-testid="fullcalendar"><slot name="eventContent" :event="{}"></slot></div>',
    methods: {
      getApi () {
        return {
          changeView: vi.fn(),
          gotoDate: vi.fn(),
          today: vi.fn(),
          prev: vi.fn(),
          next: vi.fn()
        }
      }
    }
  }
}))

// Mock FullCalendar plugins
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/list', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))
vi.mock('@fullcalendar/luxon3', () => ({ default: {} }))

// Stub event source objects returned by the composable
const mockPersonalEventsSource = { id: 'personal', events: vi.fn() }
const mockExternalEventsSource = { id: 'external', events: vi.fn() }
const mockGroupEventsSourceValue = ref<{ id: string; events: ReturnType<typeof vi.fn> } | null>(null)

vi.mock('../../../../../src/composables/useCalendarEventSources', () => ({
  useCalendarEventSources: vi.fn(() => ({
    personalEventsSource: mockPersonalEventsSource,
    externalEventsSource: mockExternalEventsSource,
    groupEventsSource: mockGroupEventsSourceValue
  }))
}))

// Mock the stores
const mockAuthStore = {
  user: {
    id: 'test-user',
    email: 'test@example.com'
  } as { id: string; email: string } | null
}

vi.mock('../../../../../src/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

describe('UnifiedCalendarComponent', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'))
    // Reset mocks
    mockAuthStore.user = { id: 'test-user', email: 'test@example.com' }
    mockGroupEventsSourceValue.value = null
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Component Mounting', () => {
    it('renders successfully with default props', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="fullcalendar"]').exists()).toBe(true)
    })

    it('renders with custom props', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'week',
          height: '500px',
          showControls: false,
          compact: true
        },
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Props Interface Compatibility', () => {
    it('accepts all expected props from parent pages', () => {
      // HomeUserPage usage
      const homeWrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'month',
          compact: true,
          height: '350px'
        },
        global: { plugins: [pinia] }
      })
      expect(homeWrapper.exists()).toBe(true)

      // GroupEventsPage usage (now uses groupSlug, not groupEvents)
      const groupWrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'month',
          height: '500px',
          showControls: true,
          groupSlug: 'my-group',
          legendType: 'group'
        },
        global: { plugins: [pinia] }
      })
      expect(groupWrapper.exists()).toBe(true)
    })
  })

  describe('Event Sources Wiring', () => {
    it('passes eventSources (not events) to FullCalendar options', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      expect(options.eventSources).toBeDefined()
      expect(options.events).toBeUndefined()
    })

    it('includes personal and external sources when user is authenticated', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      expect(options.eventSources).toContain(mockPersonalEventsSource)
      expect(options.eventSources).toContain(mockExternalEventsSource)
    })

    it('excludes personal and external sources when user is not authenticated', () => {
      mockAuthStore.user = null

      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      expect(options.eventSources).not.toContain(mockPersonalEventsSource)
      expect(options.eventSources).not.toContain(mockExternalEventsSource)
    })

    it('includes group source when groupSlug is provided', () => {
      const mockGroupSource = { id: 'group', events: vi.fn() }
      mockGroupEventsSourceValue.value = mockGroupSource

      const wrapper = mount(UnifiedCalendarComponent, {
        props: { groupSlug: 'my-group' },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      // 3 sources: personal + external + group
      expect(options.eventSources).toHaveLength(3)
      const groupSource = options.eventSources.find((s: { id: string }) => s.id === 'group')
      expect(groupSource).toBeDefined()
    })

    it('does not include group source when groupSlug is not provided', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      // Only personal + external
      expect(options.eventSources).toHaveLength(2)
    })
  })

  describe('Event Emission', () => {
    it('defines all expected emits', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const emits = wrapper.vm.$options.emits
      expect(emits).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('handles missing user gracefully', () => {
      mockAuthStore.user = null

      const wrapper = mount(UnifiedCalendarComponent, {
        props: { mode: 'month' },
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="fullcalendar"]').exists()).toBe(true)
    })
  })

  describe('URL Deep Linking Props', () => {
    it('passes initialDate to FullCalendar options', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialDate: '2025-08-20' },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialDate).toBe('2025-08-20')
    })

    it('does not set initialDate when prop is not provided', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialDate).toBeUndefined()
    })

    it('maps initialView "month" to dayGridMonth', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialView: 'month' },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('dayGridMonth')
    })

    it('maps initialView "week" to timeGridWeek', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialView: 'week' },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('timeGridWeek')
    })

    it('maps initialView "day" to timeGridDay', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialView: 'day' },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('timeGridDay')
    })

    it('uses mode prop as fallback when initialView is not provided', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: { mode: 'week' },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialView).toBe('timeGridWeek')
    })

    it('includes datesSet callback in calendar options', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.datesSet).toBeDefined()
      expect(typeof options.datesSet).toBe('function')
    })

    it('emits datesSet when the datesSet callback is invoked', async () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      options.datesSet({
        startStr: '2025-07-01',
        endStr: '2025-07-31',
        view: {
          type: 'dayGridMonth',
          currentStart: new Date('2025-07-01')
        }
      })

      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('datesSet')
      expect(emitted).toBeDefined()
      expect(emitted).toHaveLength(1)
      expect(emitted![0][0]).toEqual(expect.objectContaining({
        startStr: '2025-07-01',
        endStr: '2025-07-31',
        view: expect.objectContaining({ type: 'dayGridMonth' })
      }))
    })

    it('emits viewChange when the view type changes in datesSet callback', async () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      options.datesSet({
        startStr: '2025-06-15',
        endStr: '2025-06-21',
        view: {
          type: 'timeGridWeek',
          currentStart: new Date('2025-06-15')
        }
      })

      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('viewChange')
      expect(emitted).toBeDefined()
      expect(emitted).toHaveLength(1)
      expect(emitted![0][0]).toBe('week')
    })

    it('includes viewDidMount callback when scrollToHour is set', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialView: 'week', scrollToHour: 14 },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      expect(options.viewDidMount).toBeDefined()
      expect(typeof options.viewDidMount).toBe('function')
    })

    it('scrolls to specified hour via viewDidMount', () => {
      const mockScrollToTime = vi.fn()

      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialView: 'week', scrollToHour: 14 },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      options.viewDidMount({
        view: {
          type: 'timeGridWeek',
          calendar: { scrollToTime: mockScrollToTime }
        }
      })

      expect(mockScrollToTime).toHaveBeenCalledWith('14:00:00')
    })

    it('does not scroll in month view even if scrollToHour is set', () => {
      const mockScrollToTime = vi.fn()

      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialView: 'month', scrollToHour: 14 },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      options.viewDidMount({
        view: {
          type: 'dayGridMonth',
          calendar: { scrollToTime: mockScrollToTime }
        }
      })

      expect(mockScrollToTime).not.toHaveBeenCalled()
    })

    it('does not include viewDidMount when scrollToHour is not set', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: { initialView: 'week' },
        global: { plugins: [pinia] }
      })

      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')

      expect(options.viewDidMount).toBeUndefined()
    })

    it('works without deep linking props (backward compatible)', () => {
      const wrapper = mount(UnifiedCalendarComponent, {
        props: {
          mode: 'month',
          compact: true,
          height: '350px'
        },
        global: { plugins: [pinia] }
      })

      expect(wrapper.exists()).toBe(true)
      const fcMock = wrapper.findComponent({ name: 'FullCalendar' })
      const options = fcMock.props('options')
      expect(options.initialDate).toBeUndefined()
    })
  })
})
