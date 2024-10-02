import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import HomePage from 'src/pages/HomePage.vue'
import { installPinia } from 'app/test/vitest/install-pinia.ts'
import '../../mocks/axios.ts'

installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })

describe('HomePage.vue', () => {
  it('homepage exists', () => {
    const wrapper = mount(HomePage)
    expect(wrapper.exists()).toBe(true)
  })
})
