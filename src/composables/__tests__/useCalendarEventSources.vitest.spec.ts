import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { ComputedRef } from 'vue'
import type { EventInput, EventSourceInput } from '@fullcalendar/core'
import { EventAttendeeStatus } from '../../types/event'
import type { MyEventResponse } from '../../api/events'
import { COLORS } from '../useCalendarEventMapping'

// Mock API modules before importing the composable
vi.mock('../../api/events', () => ({
  getMyEvents: vi.fn()
}))
vi.mock('../../api/calendar', () => ({
  getExternalEvents: vi.fn()
}))
vi.mock('../../api/groups', () => ({
  groupsApi: {
    getEvents: vi.fn()
  }
}))

import { useCalendarEventSources } from '../useCalendarEventSources'
import { getMyEvents } from '../../api/events'
import { getExternalEvents } from '../../api/calendar'
import { groupsApi } from '../../api/groups'

// Helper: simulate FullCalendar calling an event source callback
async function fetchEvents (source: ComputedRef<EventSourceInput | null>): Promise<EventInput[]> {
  const fetchInfo = {
    startStr: '2026-03-01T00:00:00Z',
    endStr: '2026-03-31T23:59:59Z',
    start: new Date('2026-03-01'),
    end: new Date('2026-03-31'),
    timeZone: 'UTC'
  }
  return new Promise((resolve, reject) => {
    const src = source.value as { events: (info: typeof fetchInfo, ok: typeof resolve, fail: typeof reject) => void }
    src.events(fetchInfo, resolve, reject)
  })
}

interface GroupApiEvent {
  ulid: string
  slug: string
  name: string
  startDate: string
  endDate: string
  isAllDay: boolean
  status: string
  timeZone: string
  location: string
}

function makeGroupApiEvent (ulid: string, name: string, overrides: Partial<GroupApiEvent> = {}): GroupApiEvent {
  return {
    ulid,
    slug: `event-${ulid.toLowerCase()}`,
    name,
    startDate: '2026-03-15T10:00:00Z',
    endDate: '2026-03-15T11:00:00Z',
    isAllDay: false,
    status: 'published',
    timeZone: 'America/New_York',
    location: 'Test Location',
    ...overrides
  }
}

function makeMyEventApiResponse (ulid: string, name: string, overrides: Partial<MyEventResponse> = {}): MyEventResponse {
  return {
    id: 1,
    ulid,
    slug: `event-${ulid.toLowerCase()}`,
    name,
    startDate: '2026-03-15T10:00:00Z',
    endDate: '2026-03-15T11:00:00Z',
    type: 'in-person',
    isOrganizer: false,
    attendeeStatus: EventAttendeeStatus.Confirmed,
    attendeeRole: null,
    ...overrides
  } as MyEventResponse
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCalendarEventSources', () => {
  describe('without groupSlug (personal calendar)', () => {
    it('should return personal, external, and null group source', () => {
      const { personalEventsSource, externalEventsSource, groupEventsSource } =
        useCalendarEventSources()

      expect(personalEventsSource).toBeDefined()
      expect(externalEventsSource).toBeDefined()
      expect(groupEventsSource.value).toBeNull()
    })
  })

  describe('with groupSlug (group calendar) - merged source', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock helpers need partial data
    type MockReturn = any
    function mockApis (
      groupData: GroupApiEvent[],
      personalData: MyEventResponse[] | Error,
      externalData: { events: unknown[] } | Error
    ) {
      vi.mocked(groupsApi.getEvents).mockResolvedValue({ data: groupData } as MockReturn)
      if (personalData instanceof Error) {
        vi.mocked(getMyEvents).mockRejectedValue(personalData)
      } else {
        vi.mocked(getMyEvents).mockResolvedValue({ data: personalData } as MockReturn)
      }
      if (externalData instanceof Error) {
        vi.mocked(getExternalEvents).mockRejectedValue(externalData)
      } else {
        vi.mocked(getExternalEvents).mockResolvedValue({ data: externalData } as MockReturn)
      }
    }

    it('should return a merged group source when groupSlug is provided', () => {
      const groupSlug = ref('test-group')
      const { mergedGroupSource } = useCalendarEventSources(groupSlug)

      expect(mergedGroupSource).toBeDefined()
      expect(mergedGroupSource.value).not.toBeNull()
    })

    it('should deduplicate: personal event with same ULID as group event produces one entry', async () => {
      const groupSlug = ref('test-group')
      const sharedUlid = 'SHARED001'

      mockApis(
        [makeGroupApiEvent(sharedUlid, 'Group Meeting')],
        [makeMyEventApiResponse(sharedUlid, 'Group Meeting', {
          attendeeStatus: EventAttendeeStatus.Confirmed,
          isOrganizer: false
        })],
        { events: [] }
      )

      const { mergedGroupSource } = useCalendarEventSources(groupSlug)
      const events = await fetchEvents(mergedGroupSource)

      const matchingEvents = events.filter(e => (e.id as string).includes(sharedUlid))
      expect(matchingEvents).toHaveLength(1)
      expect(matchingEvents[0].id).toBe(`group-${sharedUlid}`)
    })

    it('should enrich group event with RSVP color from matching personal event', async () => {
      const groupSlug = ref('test-group')
      const sharedUlid = 'SHARED002'

      mockApis(
        [makeGroupApiEvent(sharedUlid, 'Enriched Event')],
        [makeMyEventApiResponse(sharedUlid, 'Enriched Event', { isOrganizer: true })],
        { events: [] }
      )

      const { mergedGroupSource } = useCalendarEventSources(groupSlug)
      const events = await fetchEvents(mergedGroupSource)

      const enriched = events.find(e => e.id === `group-${sharedUlid}`)
      expect(enriched).toBeDefined()
      expect(enriched!.backgroundColor).toBe(COLORS.hosting)
      expect(enriched!.extendedProps!.isOrganizer).toBe(true)
    })

    it('should show non-group personal events as faded context events', async () => {
      const groupSlug = ref('test-group')

      mockApis(
        [makeGroupApiEvent('GROUP001', 'Group Only Event')],
        [makeMyEventApiResponse('PERSONAL001', 'My Lunch', {
          attendeeStatus: EventAttendeeStatus.Confirmed
        })],
        { events: [] }
      )

      const { mergedGroupSource } = useCalendarEventSources(groupSlug)
      const events = await fetchEvents(mergedGroupSource)

      const contextEvent = events.find(e => e.id === 'context-PERSONAL001')
      expect(contextEvent).toBeDefined()
      expect(contextEvent!.classNames).toContain('calendar-event-context')
    })

    it('should include external events unchanged', async () => {
      const groupSlug = ref('test-group')

      mockApis(
        [],
        [],
        {
          events: [{
            id: 'ext-1',
            summary: 'Doctor Visit',
            startTime: '2026-03-15T09:00:00Z',
            endTime: '2026-03-15T10:00:00Z',
            isAllDay: false
          }]
        }
      )

      const { mergedGroupSource } = useCalendarEventSources(groupSlug)
      const events = await fetchEvents(mergedGroupSource)

      const ext = events.find(e => e.id === 'external-ext-1')
      expect(ext).toBeDefined()
      expect(ext!.backgroundColor).toBe(COLORS.external)
    })

    it('should handle unauthenticated user with only group events', async () => {
      const groupSlug = ref('test-group')

      mockApis(
        [makeGroupApiEvent('GROUP001', 'Public Group Event')],
        new Error('Unauthorized'),
        new Error('Unauthorized')
      )

      const { mergedGroupSource } = useCalendarEventSources(groupSlug)
      const events = await fetchEvents(mergedGroupSource)

      expect(events).toHaveLength(1)
      expect(events[0].id).toBe('group-GROUP001')
      expect(events[0].backgroundColor).toBe(COLORS.attending)
    })

    it('should show cancelled event status correctly regardless of RSVP', async () => {
      const groupSlug = ref('test-group')
      const sharedUlid = 'CANCELLED001'

      mockApis(
        [makeGroupApiEvent(sharedUlid, 'Cancelled Event', { status: 'cancelled' })],
        [makeMyEventApiResponse(sharedUlid, 'Cancelled Event', {
          attendeeStatus: EventAttendeeStatus.Confirmed
        })],
        { events: [] }
      )

      const { mergedGroupSource } = useCalendarEventSources(groupSlug)
      const events = await fetchEvents(mergedGroupSource)

      const cancelled = events.find(e => e.id === `group-${sharedUlid}`)
      expect(cancelled).toBeDefined()
      expect(cancelled!.backgroundColor).toBe(COLORS.cancelled)
      expect(cancelled!.extendedProps!.type).toBe('cancelled')
    })
  })
})
