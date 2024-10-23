import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventsPage from 'src/pages/EventsPage.vue' // Adjust path as needed
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
    getAll: vi.fn().mockResolvedValue({ data: [] })
  }
}))

vi.mock('src/api/categories', () => ({
  categoriesApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] })
  }
}))

describe('EventsPage.vue', () => {
  it('--- page exists', () => {
    const wrapper = mount(EventsPage)
    expect(wrapper.exists()).toBe(true)
  })
})
