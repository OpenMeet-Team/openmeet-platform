import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import LoginPage from '../../../../../src/pages/auth/LoginPage.vue' // Replace with actual path
import LoginComponent from '../../../../../src/components/auth/LoginComponent.vue'

installQuasarPlugin()

describe('LoginPage.vue', () => {
  it('should render the LoginComponent', () => {
    const wrapper = mount(LoginPage, {
      global: {
        stubs: {
          LoginComponent: {
            template: '<div>Mocked LoginComponent</div>'
          }
        }
      }
    })
    expect(wrapper.findComponent(LoginComponent).exists()).toBe(true)
  })
})
