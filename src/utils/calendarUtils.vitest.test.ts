import { describe, it, expect } from 'vitest'
import { getUserCalendarDownloadUrl, getGroupCalendarDownloadUrl } from './calendarUtils'

describe('calendarUtils', () => {
  describe('getUserCalendarDownloadUrl', () => {
    it('should generate correct user calendar URL without date filters', () => {
      // Note: In a real environment, this would use the actual API base URL
      const url = getUserCalendarDownloadUrl()
      expect(url).toContain('/calendar/my/calendar.ics')
    })

    it('should generate correct user calendar URL with date filters', () => {
      const startDate = '2024-01-01'
      const endDate = '2024-12-31'
      const url = getUserCalendarDownloadUrl(startDate, endDate)

      expect(url).toContain('/calendar/my/calendar.ics')
      expect(url).toContain('start=2024-01-01')
      expect(url).toContain('end=2024-12-31')
    })
  })

  describe('getGroupCalendarDownloadUrl', () => {
    it('should generate correct group calendar URL without date filters', () => {
      const groupSlug = 'test-group'
      const url = getGroupCalendarDownloadUrl(groupSlug)

      expect(url).toContain(`/calendar/groups/${groupSlug}/calendar.ics`)
    })

    it('should generate correct group calendar URL with date filters', () => {
      const groupSlug = 'test-group'
      const startDate = '2024-01-01'
      const endDate = '2024-12-31'
      const url = getGroupCalendarDownloadUrl(groupSlug, startDate, endDate)

      expect(url).toContain(`/calendar/groups/${groupSlug}/calendar.ics`)
      expect(url).toContain('start=2024-01-01')
      expect(url).toContain('end=2024-12-31')
    })
  })
})
