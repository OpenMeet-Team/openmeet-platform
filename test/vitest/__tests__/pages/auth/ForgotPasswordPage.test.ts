import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import ForgotPasswordPage from '../../../../../src/pages/auth/ForgotPasswordPage.vue' // Replace with actual path
import ForgotPasswordComponent from '../../../../../src/components/auth/ForgotPasswordComponent.vue'

installQuasarPlugin()

describe('ForgotPasswordPage.vue', () => {
  it('should render the ForgotPasswordComponent', () => {
    const wrapper = mount(ForgotPasswordPage, {
      global: {
        stubs: {
          ForgotPasswordComponent: {
            template: '<div>Mocked ForgotPasswordComponent</div>'
          }
        }
      }
    })
    expect(wrapper.findComponent(ForgotPasswordComponent).exists()).toBe(true)
  })
})
