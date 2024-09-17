import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import HomePage from 'src/pages/HomePage.vue' // Adjust path as needed

installQuasarPlugin()

describe('HomePage.vue', () => {
  it('should render the static text', () => {
    const wrapper = mount(HomePage)
    // Check if the static text is present in the rendered HTML
    expect(wrapper.text()).toContain('Home page')
  })
})
