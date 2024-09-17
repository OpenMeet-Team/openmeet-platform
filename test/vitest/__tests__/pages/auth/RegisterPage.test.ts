import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import RegisterPage from 'src/pages/auth/RegisterPage.vue' // Replace with actual path
import RegisterComponent from 'src/components/auth/RegisterComponent.vue'

installQuasarPlugin()

describe('RegisterPage.vue', () => {
  it('should render the RegisterComponent', () => {
    const wrapper = mount(RegisterPage, {
      global: {
        stubs: {
          RegisterComponent: {
            template: '<div>Mocked RegisterComponent</div>'
          }
        }
      }
    })
    expect(wrapper.findComponent(RegisterComponent).exists()).toBe(true)
  })
})
