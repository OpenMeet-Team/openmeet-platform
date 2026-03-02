import { computed, type Ref } from 'vue'
import type { EventSourceFuncArg, EventSourceInput } from '@fullcalendar/core'
import { getMyEvents } from '../api/events'
import { getExternalEvents } from '../api/calendar'
import { groupsApi } from '../api/groups'
import { mapExternalEvent, mapGroupEvent } from './useCalendarEventMapping'
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

  return { personalEventsSource, externalEventsSource, groupEventsSource }
}
