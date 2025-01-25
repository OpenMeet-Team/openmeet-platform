import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import RestorePasswordPage from '../../../../../src/pages/auth/PasswordChangePage.vue'
import { installPinia } from '../../../install-pinia'

// Install Quasar plugin
installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })

describe('RestorePasswordPage', () => {
  it('mounts successfully', () => {
    const wrapper = shallowMount(RestorePasswordPage)
    expect(wrapper.exists()).toBe(true)
  })
})
