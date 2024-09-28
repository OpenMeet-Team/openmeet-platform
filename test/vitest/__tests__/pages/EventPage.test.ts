import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventPage from 'src/pages/EventPage.vue'
import { installRouter } from 'app/test/vitest/install-router.ts' // Adjust path as needed

installQuasarPlugin()
installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

describe('EventPage.vue', () => {
  it('page exists', () => {
    const wrapper = mount(EventPage)
    expect(wrapper.exists()).toBe(true)
  })
})
