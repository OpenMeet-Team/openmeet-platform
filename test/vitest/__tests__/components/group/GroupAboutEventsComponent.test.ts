import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { createPinia, setActivePinia } from 'pinia'
import GroupAboutEventsComponent from '../../../../../src/components/group/GroupAboutEventsComponent.vue'
import { EventEntity, EventStatus } from '../../../../../src/types'

// Install Quasar for testing
installQuasarPlugin()

// Mock useNavigation composable
vi.mock('../../../../../src/composables/useNavigation', () => ({
  useNavigation: () => ({
    navigateToEvent: vi.fn()
  })
}))

// Mock Vue Router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn()
}

const mockRoute = {
  fullPath: '/test',
  params: {},
  query: {},
  name: 'test'
}

describe('GroupAboutEventsComponent', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z')) // June 15, 2025
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createMockEvent = (id: number, name: string, startDate: string, endDate?: string, status?: EventStatus): EventEntity => ({
    id,
    ulid: `ulid-${id}`,
    slug: `event-${id}`,
    name,
    startDate,
    endDate,
    status: status || EventStatus.Published,
    type: 'online',
    userId: 1,
    visibility: 'public'
  } as EventEntity)

  it('renders successfully with no events', () => {
    const wrapper = mount(GroupAboutEventsComponent, {
      props: {
        events: []
      },
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        }
      }
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-cy="no-upcoming-events"]').exists()).toBe(false) // Will show "No upcoming events"
    expect(wrapper.text()).toContain('No upcoming events')
  })

  it('filters out past events and shows only upcoming events', async () => {
    const events = [
      createMockEvent(1, 'Past Event', '2025-06-10T10:00:00Z'), // 5 days ago
      createMockEvent(2, 'Today Event', '2025-06-15T14:00:00Z'), // Today (future time)
      createMockEvent(3, 'Tomorrow Event', '2025-06-16T10:00:00Z'), // Tomorrow
      createMockEvent(4, 'Past Event 2', '2025-06-14T10:00:00Z'), // Yesterday
      createMockEvent(5, 'Future Event', '2025-06-20T10:00:00Z') // 5 days from now
    ]

    const wrapper = mount(GroupAboutEventsComponent, {
      props: {
        events
      },
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Check the computed property directly
    const vm = wrapper.vm as { sortedEvents: EventEntity[] }
    expect(vm.sortedEvents).toHaveLength(3)

    // Check that correct events are included
    const eventNames = vm.sortedEvents.map((e: EventEntity) => e.name)
    expect(eventNames).toEqual([
      'Today Event',
      'Tomorrow Event',
      'Future Event'
    ])
  })

  it('includes cancelled events in upcoming events', async () => {
    const events = [
      createMockEvent(1, 'Cancelled Event', '2025-06-20T10:00:00Z', undefined, EventStatus.Cancelled),
      createMockEvent(2, 'Normal Event', '2025-06-21T10:00:00Z', undefined, EventStatus.Published)
    ]

    const wrapper = mount(GroupAboutEventsComponent, {
      props: {
        events
      },
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Check the computed property includes both events
    const vm = wrapper.vm as { sortedEvents: EventEntity[] }
    expect(vm.sortedEvents).toHaveLength(2)

    const eventNames = vm.sortedEvents.map((e: EventEntity) => e.name)
    expect(eventNames).toEqual(['Cancelled Event', 'Normal Event'])
  })

  it('sorts upcoming events by start date', async () => {
    const events = [
      createMockEvent(1, 'Event C', '2025-06-25T10:00:00Z'), // Latest
      createMockEvent(2, 'Event A', '2025-06-16T10:00:00Z'), // Earliest
      createMockEvent(3, 'Event B', '2025-06-20T10:00:00Z') // Middle
    ]

    const wrapper = mount(GroupAboutEventsComponent, {
      props: {
        events
      },
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Check that events are sorted chronologically
    const vm = wrapper.vm as { sortedEvents: EventEntity[] }
    expect(vm.sortedEvents).toHaveLength(3)

    const eventNames = vm.sortedEvents.map((e: EventEntity) => e.name)
    expect(eventNames).toEqual([
      'Event A', // June 16
      'Event B', // June 20
      'Event C' // June 25
    ])
  })

  it('handles edge case with event starting exactly at current time', async () => {
    const events = [
      createMockEvent(1, 'Right Now Event', '2025-06-15T12:00:00Z'), // Exactly current time
      createMockEvent(2, 'Past by 1 second', '2025-06-15T11:59:59Z'), // 1 second ago
      createMockEvent(3, 'Future by 1 second', '2025-06-15T12:00:01Z') // 1 second from now
    ]

    const wrapper = mount(GroupAboutEventsComponent, {
      props: {
        events
      },
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Should show events at current time and future (>= comparison)
    const vm = wrapper.vm as { sortedEvents: EventEntity[] }
    expect(vm.sortedEvents).toHaveLength(2)

    const eventNames = vm.sortedEvents.map((e: EventEntity) => e.name)
    expect(eventNames).toEqual([
      'Right Now Event',
      'Future by 1 second'
    ])
  })

  it('shows events that started in the past but have not ended yet', async () => {
    const events = [
      // Event that started yesterday but ends tomorrow (ongoing)
      createMockEvent(1, 'Ongoing Event', '2025-06-14T10:00:00Z', '2025-06-16T18:00:00Z'),
      // Event that started and ended yesterday (past)
      createMockEvent(2, 'Past Event', '2025-06-14T10:00:00Z', '2025-06-14T18:00:00Z'),
      // Event that starts tomorrow (future)
      createMockEvent(3, 'Future Event', '2025-06-16T10:00:00Z', '2025-06-16T18:00:00Z'),
      // Event that started 2 days ago but ends exactly now (edge case)
      createMockEvent(4, 'Ending Now', '2025-06-13T10:00:00Z', '2025-06-15T12:00:00Z'),
      // Event with no end date that started yesterday (past)
      createMockEvent(5, 'Past No End', '2025-06-14T10:00:00Z')
    ]

    const wrapper = mount(GroupAboutEventsComponent, {
      props: {
        events
      },
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Should show: Ongoing Event, Future Event, and Ending Now (3 events)
    const vm = wrapper.vm as { sortedEvents: EventEntity[] }
    expect(vm.sortedEvents).toHaveLength(3)

    const eventNames = vm.sortedEvents.map((e: EventEntity) => e.name)
    expect(eventNames).toEqual([
      'Ending Now', // Started first, so sorted first
      'Ongoing Event', // Started second
      'Future Event' // Starts tomorrow
    ])
  })
})
