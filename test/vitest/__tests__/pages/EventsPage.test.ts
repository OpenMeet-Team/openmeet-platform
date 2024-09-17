import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventsPage from 'src/pages/EventsPage.vue' // Adjust path as needed

installQuasarPlugin()

describe('EventsPage.vue', () => {
  it('should render the static text', () => {
    const wrapper = mount(EventsPage)
    // Check if the static text is present in the rendered HTML
    expect(wrapper.text()).toContain('Events page')
  })
})
