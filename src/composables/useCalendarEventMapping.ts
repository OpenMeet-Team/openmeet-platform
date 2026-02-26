import type { EventInput } from '@fullcalendar/core'
import type { ExternalEvent } from '../api/calendar'

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

// Color scheme
const COLORS = {
  attending: '#1976d2',
  hosting: '#2e7d32',
  external: '#4caf50',
  cancelled: '#f44336'
} as const

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

export function mapPersonalAttendingEvent (event: {
  ulid: string
  slug: string
  name: string
  startDate: string
  endDate?: string
  isAllDay?: boolean
  status?: string
  timeZone?: string
  location?: string
}): EventInput {
  const isCancelled = event.status === 'cancelled'
  const color = isCancelled ? COLORS.cancelled : COLORS.attending
  const timeZone = event.timeZone || 'UTC'

  return {
    id: `attending-${event.ulid}`,
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
      location: event.location,
      timeZone
    }
  }
}

export function mapPersonalHostingEvent (event: {
  ulid: string
  slug: string
  name: string
  startDate: string
  endDate?: string
  isAllDay?: boolean
  status?: string
  timeZone?: string
  location?: string
}): EventInput {
  const isCancelled = event.status === 'cancelled'
  const color = isCancelled ? COLORS.cancelled : COLORS.hosting
  const timeZone = event.timeZone || 'UTC'

  return {
    id: `hosting-${event.ulid}`,
    title: event.name,
    start: event.startDate,
    end: event.endDate || event.startDate,
    allDay: event.isAllDay || false,
    backgroundColor: color,
    borderColor: color,
    textColor: '#ffffff',
    extendedProps: {
      slug: event.slug,
      type: isCancelled ? 'cancelled' : 'hosting',
      location: event.location,
      timeZone
    }
  }
}

/**
 * Deduplicates FullCalendar events by extracting ULIDs from ids.
 * IDs follow the pattern: "prefix-ULID" (e.g., "attending-evt-001", "hosting-evt-001").
 * The ULID is everything after the first hyphen.
 * First occurrence wins (so order of input matters).
 */
export function deduplicateEvents (events: EventInput[]): EventInput[] {
  const seenUlids = new Set<string>()
  const result: EventInput[] = []

  for (const event of events) {
    if (!event.id) {
      result.push(event)
      continue
    }

    const id = String(event.id)
    // Extract ULID: everything after the first "-"
    const dashIndex = id.indexOf('-')
    const ulid = dashIndex >= 0 ? id.substring(dashIndex + 1) : id

    if (!seenUlids.has(ulid)) {
      seenUlids.add(ulid)
      result.push(event)
    }
  }

  return result
}
