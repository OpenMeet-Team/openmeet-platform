import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import HomePage from 'src/pages/HomePage.vue' // Adjust path as needed

installQuasarPlugin()

describe('HomePage.vue', () => {
  it('page exists', () => {
    const wrapper = mount(HomePage)
    expect(wrapper.exists()).toBe(true)
  })
})
