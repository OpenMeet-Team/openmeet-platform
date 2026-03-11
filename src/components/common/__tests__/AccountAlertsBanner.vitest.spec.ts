import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AccountAlertsBanner from '../AccountAlertsBanner.vue'
import { useAuthStore } from '../../../stores/auth-store'

// Mock router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

describe('AccountAlertsBanner', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
  })

  const mountBanner = () => mount(AccountAlertsBanner, {
    global: {
      stubs: {
        'q-banner': { template: '<div class="q-banner"><slot name="avatar" /><slot /><slot name="action" /></div>' },
        'q-icon': true,
        'q-btn': { template: '<button v-bind="$attrs"><slot />{{ $attrs.label }}</button>', inheritAttrs: false }
      }
    }
  })

  const patchAuth = (overrides: Record<string, unknown>) => {
    authStore.$patch((state) => {
      Object.assign(state, overrides)
    })
  }

  describe('no email alert', () => {
    it('should show banner when user has no email', () => {
      patchAuth({ token: 'valid-token', isInitialized: true, user: { id: 1, email: null } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-no-email"]').exists()).toBe(true)
    })

    it('should not show no-email banner when user has email', () => {
      patchAuth({ token: 'valid-token', isInitialized: true, user: { id: 1, email: 'test@example.com' } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-no-email"]').exists()).toBe(false)
    })
  })

  describe('no AT Protocol identity alert', () => {
    it('should show banner when atprotoIdentity is null', () => {
      patchAuth({ token: 'valid-token', isInitialized: true, user: { id: 1, email: 'test@example.com', atprotoIdentity: null } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-no-atproto"]').exists()).toBe(true)
    })

    it('should not show banner when atprotoIdentity exists with active session', () => {
      patchAuth({ token: 'valid-token', isInitialized: true, user: { id: 1, email: 'test@example.com', atprotoIdentity: { hasActiveSession: true } } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-no-atproto"]').exists()).toBe(false)
    })
  })

  describe('inactive AT Protocol session alert', () => {
    it('should show banner when hasActiveSession is false', () => {
      patchAuth({ token: 'valid-token', isInitialized: true, user: { id: 1, email: 'test@example.com', atprotoIdentity: { hasActiveSession: false } } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-atproto-session"]').exists()).toBe(true)
    })

    it('should not show banner when hasActiveSession is true', () => {
      patchAuth({ token: 'valid-token', isInitialized: true, user: { id: 1, email: 'test@example.com', atprotoIdentity: { hasActiveSession: true } } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-atproto-session"]').exists()).toBe(false)
    })
  })

  describe('not authenticated', () => {
    it('should not show any banners when user is not authenticated', () => {
      patchAuth({ token: '', isInitialized: true, user: {} })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-no-email"]').exists()).toBe(false)
      expect(wrapper.find('[data-cy="alert-no-atproto"]').exists()).toBe(false)
      expect(wrapper.find('[data-cy="alert-atproto-session"]').exists()).toBe(false)
    })

    it('should not show any banners while auth is still initializing', () => {
      patchAuth({ token: 'valid-token', isInitialized: false, user: { id: 1, email: null, atprotoIdentity: null } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-no-email"]').exists()).toBe(false)
      expect(wrapper.find('[data-cy="alert-no-atproto"]').exists()).toBe(false)
      expect(wrapper.find('[data-cy="alert-atproto-session"]').exists()).toBe(false)
    })
  })

  describe('dismissal', () => {
    it('should hide a banner when dismissed', async () => {
      patchAuth({ token: 'valid-token', isInitialized: true, user: { id: 1, email: null, atprotoIdentity: null } })
      const wrapper = mountBanner()
      expect(wrapper.find('[data-cy="alert-no-email"]').exists()).toBe(true)

      // Click dismiss on the no-email banner
      await wrapper.find('[data-cy="dismiss-no-email"]').trigger('click')
      expect(wrapper.find('[data-cy="alert-no-email"]').exists()).toBe(false)

      // Other banners should still show
      expect(wrapper.find('[data-cy="alert-no-atproto"]').exists()).toBe(true)
    })
  })
})
