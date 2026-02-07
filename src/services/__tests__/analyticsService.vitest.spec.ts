import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mockPosthog is available inside the vi.mock factory (which is hoisted)
const mockPosthog = vi.hoisted(() => ({
  identify: vi.fn(),
  reset: vi.fn(),
  capture: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
  has_opted_out_capturing: vi.fn().mockReturnValue(false)
}))

vi.mock('../../boot/posthog', () => ({
  posthog: mockPosthog
}))

import analyticsService from '../analyticsService'

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPosthog.has_opted_out_capturing.mockReturnValue(false)
  })

  describe('optOut', () => {
    it('should call posthog.opt_out_capturing', () => {
      analyticsService.optOut()
      expect(mockPosthog.opt_out_capturing).toHaveBeenCalled()
    })
  })

  describe('optIn', () => {
    it('should call posthog.opt_in_capturing', () => {
      analyticsService.optIn()
      expect(mockPosthog.opt_in_capturing).toHaveBeenCalled()
    })
  })

  describe('hasOptedOut', () => {
    it('should return false when user has not opted out', () => {
      mockPosthog.has_opted_out_capturing.mockReturnValue(false)
      expect(analyticsService.hasOptedOut()).toBe(false)
    })

    it('should return true when user has opted out', () => {
      mockPosthog.has_opted_out_capturing.mockReturnValue(true)
      expect(analyticsService.hasOptedOut()).toBe(true)
    })
  })

  describe('syncWithPreference', () => {
    it('should call optOut when preference is true', () => {
      analyticsService.syncWithPreference(true)
      expect(mockPosthog.opt_out_capturing).toHaveBeenCalled()
      expect(mockPosthog.opt_in_capturing).not.toHaveBeenCalled()
    })

    it('should call optIn when preference is false', () => {
      analyticsService.syncWithPreference(false)
      expect(mockPosthog.opt_in_capturing).toHaveBeenCalled()
      expect(mockPosthog.opt_out_capturing).not.toHaveBeenCalled()
    })

    it('should do nothing when preference is undefined', () => {
      analyticsService.syncWithPreference(undefined)
      expect(mockPosthog.opt_out_capturing).not.toHaveBeenCalled()
      expect(mockPosthog.opt_in_capturing).not.toHaveBeenCalled()
    })
  })
})
