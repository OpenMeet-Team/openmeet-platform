import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import EventPage from 'src/pages/EventPage.vue' // Adjust path as needed

installQuasarPlugin()

describe('EventPage.vue', () => {
  it('should render the static text', () => {
    const wrapper = mount(EventPage)
    // Check if the static text is present in the rendered HTML
    expect(wrapper.text()).toContain('Event page')
  })
})
