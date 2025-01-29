import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppLayout from '../../../../src/layouts/AppLayout.vue'

installQuasarPlugin()

describe('AppLayout.vue', () => {
  it('should mount component properly', () => {
    const wrapper = shallowMount(AppLayout, { global: { stubs: { 'router-view': { template: '<div></div>' } } } })
    expect(wrapper.exists()).toBe(true)
  })
})
