import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventsPage from 'src/pages/EventsPage.vue' // Adjust path as needed

installQuasarPlugin()

vi.mock('src/api/events', () => ({
  eventsApi: {
    getAll: vi.fn().mockResolvedValue({ data: [] })
  }
}))

describe('EventsPage.vue', () => {
  it('page exists', () => {
    const wrapper = mount(EventsPage)
    expect(wrapper.exists()).toBe(true)
  })
})
