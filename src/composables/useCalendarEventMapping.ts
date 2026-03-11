import type { EventInput } from '@fullcalendar/core'
import type { ExternalEvent } from '../api/calendar'
import type { MyEventResponse } from '../api/events'
import { EventAttendeeStatus } from '../types/event'

export interface GroupEvent {
  ulid: string
  slug: string
  name: string
  startDate: string
  endDate?: string
  isAllDay?: boolean
  status?: string
  timeZone?: string
  groupSlug?: string
  location?: string
}

export interface CalendarEvent {
  id: string
  title: string
  slug?: string
  type: 'attending' | 'hosting' | 'external-event' | 'external-conflict' | 'cancelled'
  groupSlug?: string
}

// Color scheme — exported for test assertions
export const COLORS = {
  attending: '#1976d2',
  hosting: '#2e7d32',
  external: '#4caf50',
  cancelled: '#f44336',
  maybe: '#f59e0b',
  waitlist: '#9e9e9e',
  invited: '#42a5f5',
  rejected: '#ef5350'
} as const

// Derive RSVP-aware color from a personal event's attendee data
function getRsvpColor (personal: MyEventResponse): string {
  if (personal.isOrganizer) return COLORS.hosting
  if (!personal.attendeeStatus) return COLORS.attending

  switch (personal.attendeeStatus) {
    case EventAttendeeStatus.Confirmed:
    case EventAttendeeStatus.Attended:
      return COLORS.attending
    case EventAttendeeStatus.Maybe:
    case EventAttendeeStatus.Pending:
      return COLORS.maybe
    case EventAttendeeStatus.Waitlist:
      return COLORS.waitlist
    case EventAttendeeStatus.Invited:
      return COLORS.invited
    case EventAttendeeStatus.Cancelled:
      return COLORS.cancelled
    case EventAttendeeStatus.Rejected:
      return COLORS.rejected
    default:
      return COLORS.attending
  }
}

function getEventType (personal: MyEventResponse): string {
  if (personal.isOrganizer) return 'hosting'
  if (personal.attendeeStatus === EventAttendeeStatus.Cancelled) return 'cancelled'
  return 'attending'
}

export function mapGroupEvent (event: GroupEvent): EventInput {
  const isCancelled = event.status === 'cancelled'
  const color = isCancelled ? COLORS.cancelled : COLORS.attending
  const timeZone = event.timeZone || 'UTC'

  return {
    id: `group-${event.ulid}`,
    title: event.name,
    start: event.startDate,
    end: event.endDate || event.startDate,
    allDay: event.isAllDay || false,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    extendedProps: {
      slug: event.slug,
      type: isCancelled ? 'cancelled' : 'attending',
      groupSlug: event.groupSlug,
      location: event.location,
      timeZone
    }
  }
}

// Map a group event enriched with RSVP data from a matching personal event
export function mapGroupEventWithRsvp (event: GroupEvent, personal: MyEventResponse): EventInput {
  const isCancelled = event.status === 'cancelled'
  const color = isCancelled ? COLORS.cancelled : getRsvpColor(personal)
  const type = isCancelled ? 'cancelled' : getEventType(personal)
  const timeZone = event.timeZone || 'UTC'

  return {
    id: `group-${event.ulid}`,
    title: event.name,
    start: event.startDate,
    end: event.endDate || event.startDate,
    allDay: event.isAllDay || false,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    extendedProps: {
      slug: event.slug,
      type,
      groupSlug: event.groupSlug,
      location: event.location,
      timeZone,
      isOrganizer: personal.isOrganizer,
      attendeeStatus: personal.attendeeStatus
    }
  }
}

// Map a personal event as a faded context event on the group calendar
export function mapContextEvent (personal: MyEventResponse): EventInput {
  const color = getRsvpColor(personal)
  const type = getEventType(personal)

  return {
    id: `context-${personal.ulid}`,
    title: personal.name,
    start: personal.startDate,
    end: personal.endDate || personal.startDate,
    allDay: personal.isAllDay || false,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    classNames: ['calendar-event-context'],
    extendedProps: {
      slug: personal.slug,
      type,
      location: personal.location,
      timeZone: personal.timeZone,
      isOrganizer: personal.isOrganizer,
      attendeeStatus: personal.attendeeStatus
    }
  }
}

export function mapExternalEvent (event: ExternalEvent): EventInput {
  const title = event.summary || 'External Event'

  return {
    id: `external-${event.id}`,
    title,
    start: event.startTime,
    end: event.endTime || event.startTime,
    allDay: event.isAllDay || false,
    backgroundColor: COLORS.external,
    borderColor: COLORS.external,
    textColor: '#ffffff',
    extendedProps: {
      type: 'external-event',
      location: event.location,
      description: event.description
    }
  }
}
