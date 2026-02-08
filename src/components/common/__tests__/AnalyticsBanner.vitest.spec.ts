import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'
import AnalyticsBanner from '../AnalyticsBanner.vue'

// Mock analyticsService
const mockAnalyticsService = vi.hoisted(() => ({
  optOut: vi.fn(),
  optIn: vi.fn(),
  hasOptedOut: vi.fn().mockReturnValue(false),
  syncWithPreference: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  trackEvent: vi.fn()
}))

vi.mock('../../../services/analyticsService', () => ({
  default: mockAnalyticsService
}))

const COOKIE_NAME = 'om_analytics_banner_dismissed'

describe('AnalyticsBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockAnalyticsService.hasOptedOut.mockReturnValue(false)

    // Clear the cookie
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`

    // No cookie domain in test env (jsdom doesn't support cross-domain cookies)
    window.APP_CONFIG = {} as typeof window.APP_CONFIG
  })

  const mountBanner = () => {
    return mount(AnalyticsBanner, {
      global: {
        plugins: [Quasar]
      }
    })
  }

  it('should show the banner when not dismissed and not opted out', () => {
    const wrapper = mountBanner()
    expect(wrapper.find('[data-cy="analytics-banner"]').exists()).toBe(true)
  })

  it('should not show the banner when already dismissed via cookie', () => {
    document.cookie = `${COOKIE_NAME}=true; path=/`

    const wrapper = mountBanner()
    expect(wrapper.find('[data-cy="analytics-banner"]').exists()).toBe(false)
  })

  it('should not show the banner when user has already opted out', () => {
    mockAnalyticsService.hasOptedOut.mockReturnValue(true)

    const wrapper = mountBanner()
    expect(wrapper.find('[data-cy="analytics-banner"]').exists()).toBe(false)
  })

  it('should dismiss the banner when "Got it" is clicked', async () => {
    const wrapper = mountBanner()
    const gotItBtn = wrapper.find('[data-cy="analytics-banner-dismiss"]')
    expect(gotItBtn.exists()).toBe(true)

    await gotItBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(document.cookie).toContain(COOKIE_NAME)
    expect(wrapper.find('[data-cy="analytics-banner"]').exists()).toBe(false)
  })

  it('should call analyticsService.optOut and dismiss when "Opt out" is clicked', async () => {
    const wrapper = mountBanner()
    const optOutBtn = wrapper.find('[data-cy="analytics-banner-optout"]')
    expect(optOutBtn.exists()).toBe(true)

    await optOutBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(mockAnalyticsService.optOut).toHaveBeenCalled()
    expect(document.cookie).toContain(COOKIE_NAME)
    expect(wrapper.find('[data-cy="analytics-banner"]').exists()).toBe(false)
  })

  it('should display informational text about analytics', () => {
    const wrapper = mountBanner()
    expect(wrapper.text()).toContain('analytics')
    expect(wrapper.text()).toContain('opt out')
  })
})
