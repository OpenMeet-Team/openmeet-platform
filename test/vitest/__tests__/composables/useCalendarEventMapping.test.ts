import { describe, it, expect } from 'vitest'
import {
  mapGroupEvent,
  mapExternalEvent,
  type GroupEvent
} from '../../../../src/composables/useCalendarEventMapping'
import type { ExternalEvent } from '../../../../src/api/calendar'

describe('useCalendarEventMapping', () => {
  describe('mapGroupEvent', () => {
    it('maps a group event to FullCalendar EventInput with correct colors', () => {
      const groupEvent: GroupEvent = {
        ulid: 'evt-001',
        slug: 'team-meeting',
        name: 'Team Meeting',
        startDate: '2025-06-15T14:00:00Z',
        endDate: '2025-06-15T16:00:00Z',
        isAllDay: false,
        status: 'published',
        timeZone: 'America/New_York',
        groupSlug: 'dev-team',
        location: 'Room 101'
      }

      const result = mapGroupEvent(groupEvent)

      expect(result.id).toBe('group-evt-001')
      expect(result.title).toBe('Team Meeting')
      expect(result.start).toBe('2025-06-15T14:00:00Z')
      expect(result.end).toBe('2025-06-15T16:00:00Z')
      expect(result.allDay).toBe(false)
      expect(result.backgroundColor).toBe('#1976d2')
      expect(result.borderColor).toBe('#1976d2')
      expect(result.textColor).toBe('#ffffff')
      expect(result.extendedProps).toMatchObject({
        slug: 'team-meeting',
        type: 'attending',
        groupSlug: 'dev-team',
        location: 'Room 101',
        timeZone: 'America/New_York'
      })
    })

    it('maps a cancelled group event with red color', () => {
      const cancelledEvent: GroupEvent = {
        ulid: 'evt-002',
        slug: 'cancelled-meeting',
        name: 'Cancelled Meeting',
        startDate: '2025-06-15T14:00:00Z',
        endDate: '2025-06-15T16:00:00Z',
        isAllDay: false,
        status: 'cancelled',
        timeZone: 'UTC'
      }

      const result = mapGroupEvent(cancelledEvent)

      expect(result.backgroundColor).toBe('#f44336')
      expect(result.borderColor).toBe('#f44336')
      expect(result.extendedProps?.type).toBe('cancelled')
    })

    it('maps an all-day group event', () => {
      const allDayEvent: GroupEvent = {
        ulid: 'evt-003',
        slug: 'hackathon',
        name: 'Company Hackathon',
        startDate: '2025-06-15T00:00:00Z',
        endDate: '2025-06-16T00:00:00Z',
        isAllDay: true,
        status: 'published',
        timeZone: 'UTC'
      }

      const result = mapGroupEvent(allDayEvent)

      expect(result.allDay).toBe(true)
    })

    it('defaults timeZone to UTC when not provided', () => {
      const event: GroupEvent = {
        ulid: 'evt-004',
        slug: 'simple-event',
        name: 'Simple Event',
        startDate: '2025-06-15T10:00:00Z'
      }

      const result = mapGroupEvent(event)

      expect(result.extendedProps?.timeZone).toBe('UTC')
    })
  })

  describe('mapExternalEvent', () => {
    it('maps an external event to FullCalendar EventInput', () => {
      const externalEvent: ExternalEvent = {
        id: 'ext-001',
        externalId: 'google-abc',
        summary: 'Doctor Appointment',
        description: 'Annual checkup',
        startTime: '2025-06-15T09:00:00Z',
        endTime: '2025-06-15T10:00:00Z',
        isAllDay: false,
        location: 'Medical Center',
        status: 'confirmed',
        calendarSourceId: 1
      }

      const result = mapExternalEvent(externalEvent)

      expect(result.id).toBe('external-ext-001')
      expect(result.title).toBe('Doctor Appointment')
      expect(result.start).toBe('2025-06-15T09:00:00Z')
      expect(result.end).toBe('2025-06-15T10:00:00Z')
      expect(result.allDay).toBe(false)
      expect(result.backgroundColor).toBe('#4caf50')
      expect(result.borderColor).toBe('#4caf50')
      expect(result.textColor).toBe('#ffffff')
      expect(result.extendedProps).toMatchObject({
        type: 'external-event',
        location: 'Medical Center',
        description: 'Annual checkup'
      })
    })

    it('maps an all-day external event', () => {
      const allDayExternal: ExternalEvent = {
        id: 'ext-002',
        externalId: 'google-def',
        summary: 'Holiday',
        startTime: '2025-06-15T00:00:00Z',
        endTime: '2025-06-16T00:00:00Z',
        isAllDay: true,
        status: 'confirmed',
        calendarSourceId: 1
      }

      const result = mapExternalEvent(allDayExternal)

      expect(result.allDay).toBe(true)
    })

    it('uses summary field as the title', () => {
      const event: ExternalEvent = {
        id: 'ext-003',
        externalId: 'google-ghi',
        summary: 'My External Event',
        startTime: '2025-06-15T10:00:00Z',
        endTime: '2025-06-15T11:00:00Z',
        isAllDay: false,
        status: 'confirmed',
        calendarSourceId: 1
      }

      const result = mapExternalEvent(event)

      expect(result.title).toBe('My External Event')
    })

    it('falls back to "External Event" when summary is empty', () => {
      const event: ExternalEvent = {
        id: 'ext-004',
        externalId: 'google-jkl',
        summary: '',
        startTime: '2025-06-15T10:00:00Z',
        endTime: '2025-06-15T11:00:00Z',
        isAllDay: false,
        status: 'confirmed',
        calendarSourceId: 1
      }

      const result = mapExternalEvent(event)

      expect(result.title).toBe('External Event')
    })
  })
})
