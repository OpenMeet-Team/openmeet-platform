import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import RestorePasswordPage from 'src/pages/auth/RestorePasswordPage.vue' // Replace with actual path
import RestorePasswordComponent from 'src/components/auth/RestorePasswordComponent.vue'

installQuasarPlugin()

describe('RestorePasswordPage.vue', () => {
  it('should render the RestorePasswordComponent', () => {
    const wrapper = mount(RestorePasswordPage, {
      global: {
        stubs: {
          RestorePasswordComponent: {
            template: '<div>Mocked RestorePasswordComponent</div>'
          }
        }
      }
    })
    expect(wrapper.findComponent(RestorePasswordComponent).exists()).toBe(true)
  })
})
