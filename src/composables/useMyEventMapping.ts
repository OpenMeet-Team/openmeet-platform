import type { EventInput } from '@fullcalendar/core'
import type { MyEventResponse } from '../api/events'
import { EventAttendeeStatus } from '../types/event'

// Visual treatment from design doc
const COLORS = {
  organizer: '#2e7d32',
  confirmed: '#1976d2',
  attended: '#1976d2',
  maybe: '#f59e0b',
  pending: '#f59e0b',
  waitlist: '#9e9e9e',
  invited: '#42a5f5',
  cancelled: '#f44336',
  rejected: '#ef5350'
} as const

function getEventColor (event: MyEventResponse): string {
  // Organizer takes visual priority (per design doc)
  if (event.isOrganizer) return COLORS.organizer
  if (!event.attendeeStatus) return COLORS.confirmed

  switch (event.attendeeStatus) {
    case EventAttendeeStatus.Confirmed:
    case EventAttendeeStatus.Attended:
      return COLORS.confirmed
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
      return COLORS.confirmed
  }
}

function getEventType (event: MyEventResponse): string {
  if (event.isOrganizer) return 'hosting'
  if (event.attendeeStatus === EventAttendeeStatus.Cancelled) return 'cancelled'
  return 'attending'
}

export function mapMyEvent (event: MyEventResponse): EventInput {
  const color = getEventColor(event)
  const type = getEventType(event)

  return {
    id: `my-${event.ulid}`,
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
      location: event.location,
      timeZone: event.timeZone,
      isOrganizer: event.isOrganizer,
      attendeeStatus: event.attendeeStatus
    }
  }
}
