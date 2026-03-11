import { computed, type Ref } from 'vue'
import type { EventInput, EventSourceFuncArg, EventSourceInput } from '@fullcalendar/core'
import { getMyEvents } from '../api/events'
import { getExternalEvents } from '../api/calendar'
import { groupsApi } from '../api/groups'
import {
  mapExternalEvent,
  mapGroupEvent,
  mapGroupEventWithRsvp,
  mapContextEvent,
  type GroupEvent
} from './useCalendarEventMapping'
import { mapMyEvent } from './useMyEventMapping'

export function useCalendarEventSources (groupSlug?: Ref<string | undefined>) {
  const personalEventsSource: EventSourceInput = {
    id: 'personal',
    events: async (fetchInfo: EventSourceFuncArg, successCallback, failureCallback) => {
      try {
        const response = await getMyEvents(fetchInfo.startStr, fetchInfo.endStr)
        successCallback(response.data.map(mapMyEvent))
      } catch (error) {
        failureCallback(error as Error)
      }
    }
  }

  const externalEventsSource: EventSourceInput = {
    id: 'external',
    events: async (fetchInfo: EventSourceFuncArg, successCallback, failureCallback) => {
      try {
        const response = await getExternalEvents({
          startTime: fetchInfo.startStr,
          endTime: fetchInfo.endStr
        })
        successCallback(response.data.events.map(mapExternalEvent))
      } catch (error) {
        failureCallback(error as Error)
      }
    }
  }

  const groupEventsSource = computed<EventSourceInput | null>(() => {
    const slug = groupSlug?.value
    if (!slug) return null
    return {
      id: 'group',
      events: async (fetchInfo: EventSourceFuncArg, successCallback, failureCallback) => {
        try {
          const response = await groupsApi.getEvents(slug, {
            startDate: fetchInfo.startStr,
            endDate: fetchInfo.endStr
          })
          const events = response.data.map((e) => mapGroupEvent({
            ulid: e.ulid,
            slug: e.slug,
            name: e.name,
            startDate: e.startDate,
            endDate: e.endDate,
            isAllDay: e.isAllDay,
            status: e.status,
            timeZone: e.timeZone,
            groupSlug: slug,
            location: e.location
          }))
          successCallback(events)
        } catch (error) {
          failureCallback(error as Error)
        }
      }
    }
  })

  // Single merged source for group calendar: fetches group + personal + external
  // in parallel, deduplicates by ULID, enriches group events with RSVP data,
  // and shows non-group personal events as faded context events.
  const mergedGroupSource = computed<EventSourceInput | null>(() => {
    const slug = groupSlug?.value
    if (!slug) return null
    return {
      id: 'merged-group',
      events: async (fetchInfo: EventSourceFuncArg, successCallback, failureCallback) => {
        try {
          // Fetch all three sources in parallel; personal/external may fail (unauthed)
          const [groupResult, personalResult, externalResult] = await Promise.allSettled([
            groupsApi.getEvents(slug, {
              startDate: fetchInfo.startStr,
              endDate: fetchInfo.endStr
            }),
            getMyEvents(fetchInfo.startStr, fetchInfo.endStr),
            getExternalEvents({
              startTime: fetchInfo.startStr,
              endTime: fetchInfo.endStr
            })
          ])

          const groupEvents = groupResult.status === 'fulfilled' ? groupResult.value.data : []
          const personalEvents = personalResult.status === 'fulfilled' ? personalResult.value.data : []
          const externalEvents = externalResult.status === 'fulfilled' ? externalResult.value.data.events : []

          // Build ULID -> personal event lookup for dedup/enrichment
          const personalByUlid = new Map(personalEvents.map(e => [e.ulid, e]))

          const allEvents: EventInput[] = []

          // 1. Map group events, enriching with RSVP data from matching personal events
          const matchedUlids = new Set<string>()
          for (const e of groupEvents) {
            const groupEvent: GroupEvent = {
              ulid: e.ulid,
              slug: e.slug,
              name: e.name,
              startDate: e.startDate,
              endDate: e.endDate,
              isAllDay: e.isAllDay,
              status: e.status,
              timeZone: e.timeZone,
              groupSlug: slug,
              location: e.location
            }

            const matchingPersonal = personalByUlid.get(e.ulid)
            if (matchingPersonal) {
              matchedUlids.add(e.ulid)
              allEvents.push(mapGroupEventWithRsvp(groupEvent, matchingPersonal))
            } else {
              allEvents.push(mapGroupEvent(groupEvent))
            }
          }

          // 2. Add non-group personal events as faded context events
          for (const e of personalEvents) {
            if (!matchedUlids.has(e.ulid)) {
              allEvents.push(mapContextEvent(e))
            }
          }

          // 3. Add external events unchanged
          for (const e of externalEvents) {
            allEvents.push(mapExternalEvent(e))
          }

          successCallback(allEvents)
        } catch (error) {
          failureCallback(error as Error)
        }
      }
    }
  })

  return { personalEventsSource, externalEventsSource, groupEventsSource, mergedGroupSource }
}
