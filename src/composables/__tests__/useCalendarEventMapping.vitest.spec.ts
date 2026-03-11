import { describe, it, expect } from 'vitest'
import {
  mapGroupEvent,
  mapGroupEventWithRsvp,
  mapContextEvent,
  mapExternalEvent,
  COLORS,
  type GroupEvent
} from '../useCalendarEventMapping'
import { EventAttendeeStatus } from '../../types/event'
import type { MyEventResponse } from '../../api/events'

// Helper to build a minimal GroupEvent
function makeGroupEvent (overrides: Partial<GroupEvent> = {}): GroupEvent {
  return {
    ulid: 'EVT001',
    slug: 'test-event',
    name: 'Test Event',
    startDate: '2026-03-15T10:00:00Z',
    endDate: '2026-03-15T11:00:00Z',
    groupSlug: 'test-group',
    ...overrides
  }
}

// Helper to build a minimal MyEventResponse
function makeMyEvent (overrides: Partial<MyEventResponse> = {}): MyEventResponse {
  return {
    id: 1,
    ulid: 'EVT001',
    slug: 'test-event',
    name: 'Test Event',
    startDate: '2026-03-15T10:00:00Z',
    endDate: '2026-03-15T11:00:00Z',
    type: 'in-person',
    isOrganizer: false,
    attendeeStatus: EventAttendeeStatus.Confirmed,
    attendeeRole: null,
    ...overrides
  } as MyEventResponse
}

describe('mapGroupEvent', () => {
  it('should map a group event with default attending color', () => {
    const result = mapGroupEvent(makeGroupEvent())
    expect(result.id).toBe('group-EVT001')
    expect(result.title).toBe('Test Event')
    expect(result.backgroundColor).toBe(COLORS.attending)
    expect(result.extendedProps?.groupSlug).toBe('test-group')
    expect(result.extendedProps?.slug).toBe('test-event')
  })

  it('should map a cancelled event with cancelled color', () => {
    const result = mapGroupEvent(makeGroupEvent({ status: 'cancelled' }))
    expect(result.backgroundColor).toBe(COLORS.cancelled)
    expect(result.extendedProps?.type).toBe('cancelled')
  })
})

describe('mapGroupEventWithRsvp', () => {
  it('should enrich a group event with confirmed RSVP status', () => {
    const group = makeGroupEvent()
    const personal = makeMyEvent({ attendeeStatus: EventAttendeeStatus.Confirmed })

    const result = mapGroupEventWithRsvp(group, personal)
    expect(result.id).toBe('group-EVT001')
    expect(result.backgroundColor).toBe(COLORS.attending)
    expect(result.extendedProps?.attendeeStatus).toBe(EventAttendeeStatus.Confirmed)
    expect(result.extendedProps?.groupSlug).toBe('test-group')
  })

  it('should use organizer color when user is organizer', () => {
    const group = makeGroupEvent()
    const personal = makeMyEvent({ isOrganizer: true })

    const result = mapGroupEventWithRsvp(group, personal)
    expect(result.backgroundColor).toBe(COLORS.hosting)
    expect(result.extendedProps?.isOrganizer).toBe(true)
  })

  it('should use maybe color for maybe status', () => {
    const result = mapGroupEventWithRsvp(
      makeGroupEvent(),
      makeMyEvent({ attendeeStatus: EventAttendeeStatus.Maybe })
    )
    expect(result.backgroundColor).toBe(COLORS.maybe)
  })

  it('should use maybe color for pending status', () => {
    const result = mapGroupEventWithRsvp(
      makeGroupEvent(),
      makeMyEvent({ attendeeStatus: EventAttendeeStatus.Pending })
    )
    expect(result.backgroundColor).toBe(COLORS.maybe)
  })

  it('should use waitlist color for waitlist status', () => {
    const result = mapGroupEventWithRsvp(
      makeGroupEvent(),
      makeMyEvent({ attendeeStatus: EventAttendeeStatus.Waitlist })
    )
    expect(result.backgroundColor).toBe(COLORS.waitlist)
  })

  it('should use cancelled color for cancelled RSVP', () => {
    const result = mapGroupEventWithRsvp(
      makeGroupEvent(),
      makeMyEvent({ attendeeStatus: EventAttendeeStatus.Cancelled })
    )
    expect(result.backgroundColor).toBe(COLORS.cancelled)
  })

  it('should use cancelled event color when event itself is cancelled regardless of RSVP', () => {
    const result = mapGroupEventWithRsvp(
      makeGroupEvent({ status: 'cancelled' }),
      makeMyEvent({ attendeeStatus: EventAttendeeStatus.Confirmed })
    )
    expect(result.backgroundColor).toBe(COLORS.cancelled)
    expect(result.extendedProps?.type).toBe('cancelled')
  })

  it('should preserve group event slug and groupSlug in extendedProps', () => {
    const result = mapGroupEventWithRsvp(
      makeGroupEvent({ slug: 'my-group-event', groupSlug: 'cool-group' }),
      makeMyEvent()
    )
    expect(result.extendedProps?.slug).toBe('my-group-event')
    expect(result.extendedProps?.groupSlug).toBe('cool-group')
  })
})

describe('mapContextEvent', () => {
  it('should map a personal event as a faded context event', () => {
    const result = mapContextEvent(makeMyEvent({ ulid: 'PERSONAL001', slug: 'my-personal' }))
    expect(result.id).toBe('context-PERSONAL001')
    expect(result.title).toBe('Test Event')
    expect(result.classNames).toContain('calendar-event-context')
    expect(result.extendedProps?.slug).toBe('my-personal')
  })

  it('should carry RSVP-aware color for context events', () => {
    const result = mapContextEvent(makeMyEvent({ ulid: 'PERSONAL001', isOrganizer: true }))
    expect(result.backgroundColor).toBe(COLORS.hosting)
  })

  it('should include context class for CSS styling', () => {
    const result = mapContextEvent(makeMyEvent({ ulid: 'PERSONAL001' }))
    expect(result.classNames).toEqual(['calendar-event-context'])
  })
})

describe('mapExternalEvent', () => {
  it('should map external events with external color', () => {
    const result = mapExternalEvent({
      id: 'ext-1',
      externalId: 'ext-1-external',
      summary: 'Doctor Appointment',
      startTime: '2026-03-15T09:00:00Z',
      endTime: '2026-03-15T10:00:00Z',
      isAllDay: false,
      status: 'confirmed',
      calendarSourceId: 1
    })
    expect(result.id).toBe('external-ext-1')
    expect(result.backgroundColor).toBe(COLORS.external)
    expect(result.title).toBe('Doctor Appointment')
  })
})
