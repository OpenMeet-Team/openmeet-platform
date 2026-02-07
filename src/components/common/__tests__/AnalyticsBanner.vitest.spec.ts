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

// Mock localStorage
const localStorageMock = vi.hoisted(() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
    _store: store
  }
})

describe('AnalyticsBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockAnalyticsService.hasOptedOut.mockReturnValue(false)

    // Reset localStorage mock
    Object.keys(localStorageMock._store).forEach(k => delete localStorageMock._store[k])
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })
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

  it('should not show the banner when already dismissed', () => {
    localStorageMock._store.analytics_banner_dismissed = 'true'
    localStorageMock.getItem.mockImplementation((key: string) => localStorageMock._store[key] ?? null)

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
    expect(localStorageMock.setItem).toHaveBeenCalledWith('analytics_banner_dismissed', 'true')
    expect(wrapper.find('[data-cy="analytics-banner"]').exists()).toBe(false)
  })

  it('should call analyticsService.optOut and dismiss when "Opt out" is clicked', async () => {
    const wrapper = mountBanner()
    const optOutBtn = wrapper.find('[data-cy="analytics-banner-optout"]')
    expect(optOutBtn.exists()).toBe(true)

    await optOutBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(mockAnalyticsService.optOut).toHaveBeenCalled()
    expect(localStorageMock.setItem).toHaveBeenCalledWith('analytics_banner_dismissed', 'true')
    expect(wrapper.find('[data-cy="analytics-banner"]').exists()).toBe(false)
  })

  it('should display informational text about analytics', () => {
    const wrapper = mountBanner()
    expect(wrapper.text()).toContain('analytics')
    expect(wrapper.text()).toContain('opt out')
  })
})
