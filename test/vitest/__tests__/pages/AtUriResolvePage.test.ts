import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import AtUriResolvePage from '../../../../src/pages/AtUriResolvePage.vue'
import { installRouter } from '../../install-router'
import { installPinia } from '../../install-pinia'

installQuasarPlugin()
installPinia({ stubActions: false, createSpy: vi.fn })
installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

vi.mock('src/api/atproto', () => ({
  atprotoApi: {
    resolveAtUri: vi.fn()
  }
}))

import { atprotoApi } from 'src/api/atproto'

function flushPromises () {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('AtUriResolvePage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mounts successfully', () => {
    vi.mocked(atprotoApi.resolveAtUri).mockReturnValue(new Promise(() => {}))
    const wrapper = mount(AtUriResolvePage)
    expect(wrapper.exists()).toBe(true)
  })

  it('shows loading state initially', () => {
    vi.mocked(atprotoApi.resolveAtUri).mockReturnValue(new Promise(() => {}))
    const wrapper = mount(AtUriResolvePage)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('shows error message when API returns 404', async () => {
    vi.mocked(atprotoApi.resolveAtUri).mockRejectedValue({
      response: { status: 404 }
    })

    const wrapper = mount(AtUriResolvePage)

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('not found')
  })

  it('shows error message when API returns a generic error', async () => {
    vi.mocked(atprotoApi.resolveAtUri).mockRejectedValue(new Error('Network error'))

    const wrapper = mount(AtUriResolvePage)

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
  })

  it('calls resolveAtUri with route params', async () => {
    vi.mocked(atprotoApi.resolveAtUri).mockRejectedValue(new Error('test'))

    mount(AtUriResolvePage, {
      global: {
        mocks: {
          $route: {
            params: {
              did: 'did:plc:abc123',
              collection: 'net.openmeet.app.event',
              rkey: 'testrkey'
            }
          }
        }
      }
    })

    await flushPromises()

    expect(atprotoApi.resolveAtUri).toHaveBeenCalled()
  })
})
