import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventPage from 'src/pages/EventPage.vue' // Adjust path as needed

installQuasarPlugin()

describe('EventPage.vue', () => {
  it('page exists', () => {
    const wrapper = mount(EventPage)
    expect(wrapper.exists()).toBe(true)
  })
})
