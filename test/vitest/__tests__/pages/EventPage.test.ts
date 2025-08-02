import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventPage from '../../../../src/pages/EventPage.vue'
import { installRouter } from '../../install-router'
import { installPinia } from '../../install-pinia'

installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })
installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

vi.mock('src/api/events', () => ({
  eventsApi: {
    getBySlug: vi.fn().mockResolvedValue({ data: { id: '1', name: 'Test Event' } })
  }
}))

describe('EventPage.vue', () => {
  let wrapper

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    // Clean up any component instances
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }

    // Run any pending timers and clean them up
    vi.runAllTimers()
    vi.useRealTimers()

    // Clean up any active timeouts
    if (global.__TEST_CLEANUP__) {
      global.__TEST_CLEANUP__()
    }
  })

  it('mounts successfully', () => {
    wrapper = shallowMount(EventPage)
    expect(wrapper.exists()).toBe(true)
  })
})
