import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import ErrorNotFound from '../../../../src/pages/ErrorNotFound.vue' // Adjust path as needed

installQuasarPlugin()

describe('ErrorNotFound.vue', () => {
  it('should render the 404 error message', () => {
    const wrapper = mount(ErrorNotFound)
    // Check if the text '404' is rendered
    expect(wrapper.find('.text-weight-thin').text()).toBe('404')
  })

  it('should render the "Oops. Nothing here..." message', () => {
    const wrapper = mount(ErrorNotFound)
    // Check if the "Oops. Nothing here..." text is rendered
    expect(wrapper.find('.text-h2').text()).toBe('Oops. Nothing here...')
  })

  it('should render the Go Home button', () => {
    const wrapper = mount(ErrorNotFound)
    // Check if the button with the label 'Go Home' is rendered
    const button = wrapper.findComponent({ name: 'q-btn' })
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe('Go Home')
  })
})
