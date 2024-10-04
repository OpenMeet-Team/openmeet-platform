import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventPage from 'src/pages/EventPage.vue'
import { installRouter } from 'app/test/vitest/install-router.ts'

installQuasarPlugin()
installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

vi.mock('src/api/events', () => ({
  eventsApi: {
    getById: vi.fn().mockResolvedValue({ data: { id: '1', name: 'Test Event' } })
  }
}))

describe('EventPage.vue', () => {
  let wrapper

  it('mounts successfully', () => {
    wrapper = shallowMount(EventPage)
    expect(wrapper.exists()).toBe(true)
  })
})
