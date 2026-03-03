import { describe, it, expect } from 'vitest'
import { mapMyEvent } from '../../../../src/composables/useMyEventMapping'
import { EventAttendeeStatus } from '../../../../src/types/event'
import type { MyEventResponse } from '../../../../src/api/events'

function makeEvent (overrides: Partial<MyEventResponse> = {}): MyEventResponse {
  return {
    ulid: 'evt-001',
    slug: 'test-event',
    name: 'Test Event',
    startDate: '2025-06-15T14:00:00Z',
    endDate: '2025-06-15T16:00:00Z',
    isAllDay: false,
    isOrganizer: false,
    attendeeStatus: EventAttendeeStatus.Confirmed,
    attendeeRole: null,
    location: 'Room 101',
    timeZone: 'America/New_York',
    ...overrides
  } as MyEventResponse
}

describe('useMyEventMapping', () => {
  describe('mapMyEvent', () => {
    it('uses my- prefix for event id', () => {
      const result = mapMyEvent(makeEvent())
      expect(result.id).toBe('my-evt-001')
    })

    it('maps title, start, end, allDay correctly', () => {
      const result = mapMyEvent(makeEvent())
      expect(result.title).toBe('Test Event')
      expect(result.start).toBe('2025-06-15T14:00:00Z')
      expect(result.end).toBe('2025-06-15T16:00:00Z')
      expect(result.allDay).toBe(false)
    })

    it('falls back to startDate when endDate is missing', () => {
      const result = mapMyEvent(makeEvent({ endDate: undefined }))
      expect(result.end).toBe('2025-06-15T14:00:00Z')
    })

    it('maps all-day events', () => {
      const result = mapMyEvent(makeEvent({ isAllDay: true }))
      expect(result.allDay).toBe(true)
    })

    it('sets organizer color (green) when isOrganizer is true', () => {
      const result = mapMyEvent(makeEvent({ isOrganizer: true }))
      expect(result.backgroundColor).toBe('#2e7d32')
      expect(result.borderColor).toBe('#2e7d32')
      expect(result.extendedProps?.type).toBe('hosting')
    })

    it('sets confirmed color (blue) for confirmed attendees', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Confirmed }))
      expect(result.backgroundColor).toBe('#1976d2')
      expect(result.extendedProps?.type).toBe('attending')
    })

    it('sets confirmed color for attended status', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Attended }))
      expect(result.backgroundColor).toBe('#1976d2')
    })

    it('sets maybe color (amber) for maybe status', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Maybe }))
      expect(result.backgroundColor).toBe('#f59e0b')
    })

    it('sets maybe color for pending status', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Pending }))
      expect(result.backgroundColor).toBe('#f59e0b')
    })

    it('sets waitlist color (grey) for waitlist status', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Waitlist }))
      expect(result.backgroundColor).toBe('#9e9e9e')
    })

    it('sets invited color (light blue) for invited status', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Invited }))
      expect(result.backgroundColor).toBe('#42a5f5')
    })

    it('sets cancelled color (red) for cancelled status', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Cancelled }))
      expect(result.backgroundColor).toBe('#f44336')
      expect(result.extendedProps?.type).toBe('cancelled')
    })

    it('sets rejected color for rejected status', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: EventAttendeeStatus.Rejected }))
      expect(result.backgroundColor).toBe('#ef5350')
    })

    it('organizer takes priority over attendee status for color', () => {
      const result = mapMyEvent(makeEvent({
        isOrganizer: true,
        attendeeStatus: EventAttendeeStatus.Cancelled
      }))
      expect(result.backgroundColor).toBe('#2e7d32')
      expect(result.extendedProps?.type).toBe('hosting')
    })

    it('defaults to confirmed color when attendeeStatus is null', () => {
      const result = mapMyEvent(makeEvent({ attendeeStatus: null }))
      expect(result.backgroundColor).toBe('#1976d2')
    })

    it('includes slug, location, timeZone in extendedProps', () => {
      const result = mapMyEvent(makeEvent())
      expect(result.extendedProps).toMatchObject({
        slug: 'test-event',
        location: 'Room 101',
        timeZone: 'America/New_York',
        isOrganizer: false,
        attendeeStatus: EventAttendeeStatus.Confirmed
      })
    })

    it('always sets textColor to white', () => {
      const result = mapMyEvent(makeEvent())
      expect(result.textColor).toBe('#ffffff')
    })
  })
})
