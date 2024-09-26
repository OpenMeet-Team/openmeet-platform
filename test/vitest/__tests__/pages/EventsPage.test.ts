import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventsPage from 'src/pages/EventsPage.vue' // Adjust path as needed

installQuasarPlugin()

describe('EventsPage.vue', () => {
  it('page exists', () => {
    const wrapper = mount(EventsPage)
    expect(wrapper.exists()).toBe(true)
  })
})
