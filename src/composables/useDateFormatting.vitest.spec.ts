import { describe, it, expect } from 'vitest'
import dateFormatting from './useDateFormatting'

const { searchTimezones, getTimezones, getTimezoneLabel } = dateFormatting

describe('useDateFormatting - timezone search', () => {
  describe('getTimezones', () => {
    it('should return string[] of IANA IDs', () => {
      const zones = getTimezones()
      expect(Array.isArray(zones)).toBe(true)
      expect(zones.length).toBeGreaterThan(0)
      // Every entry should be a string
      zones.forEach(z => expect(typeof z).toBe('string'))
      // Should contain well-known zones
      expect(zones).toContain('America/New_York')
      expect(zones).toContain('Europe/London')
      expect(zones).toContain('Asia/Tokyo')
    })
  })

  describe('searchTimezones', () => {
    it('should return all timezones when search is empty', () => {
      const all = getTimezones()
      const result = searchTimezones('')
      expect(result).toEqual(all)
    })

    it('should still match IANA IDs (america/new)', () => {
      const result = searchTimezones('america/new')
      expect(result).toContain('America/New_York')
    })

    it('should match by abbreviation (PST)', () => {
      const result = searchTimezones('PST')
      expect(result).toContain('America/Los_Angeles')
    })

    it('should match by city name (San Francisco)', () => {
      const result = searchTimezones('San Francisco')
      expect(result).toContain('America/Los_Angeles')
    })

    it('should match by US state name (California)', () => {
      const result = searchTimezones('California')
      expect(result).toContain('America/Los_Angeles')
    })

    it('should match CET and return European zones', () => {
      const result = searchTimezones('CET')
      // CET is used in Central European zones
      expect(result.length).toBeGreaterThan(0)
      // Should include at least one European zone
      const hasEuropean = result.some(z => z.startsWith('Europe/'))
      expect(hasEuropean).toBe(true)
    })

    it('should match by city name (Tokyo)', () => {
      const result = searchTimezones('Tokyo')
      expect(result).toContain('Asia/Tokyo')
    })

    it('should be case-insensitive', () => {
      const lower = searchTimezones('pst')
      const upper = searchTimezones('PST')
      expect(lower).toEqual(upper)
    })
  })

  describe('getTimezoneLabel', () => {
    it('should return IANA ID with abbreviation in parentheses', () => {
      const label = getTimezoneLabel('America/New_York')
      // Should match pattern: "America/New_York (XXX)" where XXX is an abbreviation
      expect(label).toMatch(/^America\/New_York \([A-Z]{2,5}\)$/)
    })

    it('should return IANA ID with abbreviation for another zone', () => {
      const label = getTimezoneLabel('Europe/London')
      expect(label).toMatch(/^Europe\/London \([A-Z]{2,5}\)$/)
    })

    it('should return IANA ID for UTC (not in Intl.supportedValuesOf)', () => {
      const label = getTimezoneLabel('UTC')
      // UTC is not in Intl.supportedValuesOf('timeZone'), so falls back to plain IANA ID
      expect(label).toBe('UTC')
    })
  })
})
