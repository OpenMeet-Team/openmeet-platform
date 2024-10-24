import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import HomePage from 'src/pages/HomePage.vue'
import { installPinia } from 'app/test/vitest/install-pinia.ts'
import '../../mocks/axios.ts'

installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })
vi.mock('src/api/home.ts', () => ({
  apiGuestHome: vi.fn().mockResolvedValue(Promise.resolve({
    data: { id: 1, name: 'Home guest Data' }
  })),
  apiUserHome: vi.fn().mockResolvedValue(Promise.resolve({
    data: { id: 1, name: 'Home userData' }
  }))
}))

describe('HomePage.vue', () => {
  it('homepage exists', () => {
    const wrapper = shallowMount(HomePage)
    expect(wrapper.exists()).toBe(true)
  })
})
