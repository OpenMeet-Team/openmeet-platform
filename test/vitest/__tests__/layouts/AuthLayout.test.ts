import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AuthLayout from 'src/layouts/AuthLayout.vue'

installQuasarPlugin()

describe('AuthLayout.vue', () => {
  it('should mount component properly', () => {
    const wrapper = shallowMount(AuthLayout, { global: { stubs: { 'router-view': { template: '<div></div>' } } } })
    expect(wrapper.exists()).toBe(true)
  })
})
