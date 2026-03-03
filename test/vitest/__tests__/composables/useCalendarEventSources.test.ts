import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCalendarEventSources } from '../../../../src/composables/useCalendarEventSources'
import type { EventSourceFuncArg } from '@fullcalendar/core'

// Mock API modules
vi.mock('../../../../src/api/events', () => ({
  getMyEvents: vi.fn()
}))
vi.mock('../../../../src/api/calendar', () => ({
  getExternalEvents: vi.fn()
}))
vi.mock('../../../../src/api/groups', () => ({
  groupsApi: {
    getEvents: vi.fn()
  }
}))

// Import mocked modules
import { getMyEvents } from '../../../../src/api/events'
import { getExternalEvents } from '../../../../src/api/calendar'
import { groupsApi } from '../../../../src/api/groups'

const mockFetchInfo: EventSourceFuncArg = {
  start: new Date('2025-06-01'),
  end: new Date('2025-07-01'),
  startStr: '2025-06-01T00:00:00',
  endStr: '2025-07-01T00:00:00',
  timeZone: 'local'
}

describe('useCalendarEventSources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns personalEventsSource with id "personal"', () => {
    const { personalEventsSource } = useCalendarEventSources()
    expect((personalEventsSource as { id: string }).id).toBe('personal')
  })

  it('returns externalEventsSource with id "external"', () => {
    const { externalEventsSource } = useCalendarEventSources()
    expect((externalEventsSource as { id: string }).id).toBe('external')
  })

  it('returns null groupEventsSource when no groupSlug', () => {
    const { groupEventsSource } = useCalendarEventSources()
    expect(groupEventsSource.value).toBeNull()
  })

  it('returns groupEventsSource with id "group" when groupSlug provided', () => {
    const slug = ref<string | undefined>('dev-team')
    const { groupEventsSource } = useCalendarEventSources(slug)
    expect(groupEventsSource.value).not.toBeNull()
    expect((groupEventsSource.value as { id: string }).id).toBe('group')
  })

  it('returns null groupEventsSource when groupSlug is undefined', () => {
    const slug = ref<string | undefined>(undefined)
    const { groupEventsSource } = useCalendarEventSources(slug)
    expect(groupEventsSource.value).toBeNull()
  })

  it('personalEventsSource calls getMyEvents with date range', async () => {
    const mockResponse = { data: [] }
    vi.mocked(getMyEvents).mockResolvedValue(mockResponse as never)

    const { personalEventsSource } = useCalendarEventSources()
    const successCb = vi.fn()
    const failureCb = vi.fn()

    const eventsFn = (personalEventsSource as { events: (info: EventSourceFuncArg, success: (events: never[]) => void, failure: (err: Error) => void) => Promise<void> }).events
    await eventsFn(mockFetchInfo, successCb, failureCb)

    expect(getMyEvents).toHaveBeenCalledWith('2025-06-01T00:00:00', '2025-07-01T00:00:00')
    expect(successCb).toHaveBeenCalledWith([])
    expect(failureCb).not.toHaveBeenCalled()
  })

  it('personalEventsSource calls failureCallback on API error', async () => {
    const error = new Error('Network error')
    vi.mocked(getMyEvents).mockRejectedValue(error)

    const { personalEventsSource } = useCalendarEventSources()
    const successCb = vi.fn()
    const failureCb = vi.fn()

    const eventsFn = (personalEventsSource as { events: (info: EventSourceFuncArg, success: (events: never[]) => void, failure: (err: Error) => void) => Promise<void> }).events
    await eventsFn(mockFetchInfo, successCb, failureCb)

    expect(successCb).not.toHaveBeenCalled()
    expect(failureCb).toHaveBeenCalledWith(error)
  })

  it('externalEventsSource calls getExternalEvents with date range', async () => {
    const mockResponse = { data: { events: [] } }
    vi.mocked(getExternalEvents).mockResolvedValue(mockResponse as never)

    const { externalEventsSource } = useCalendarEventSources()
    const successCb = vi.fn()
    const failureCb = vi.fn()

    const eventsFn = (externalEventsSource as { events: (info: EventSourceFuncArg, success: (events: never[]) => void, failure: (err: Error) => void) => Promise<void> }).events
    await eventsFn(mockFetchInfo, successCb, failureCb)

    expect(getExternalEvents).toHaveBeenCalledWith({
      startTime: '2025-06-01T00:00:00',
      endTime: '2025-07-01T00:00:00'
    })
    expect(successCb).toHaveBeenCalledWith([])
    expect(failureCb).not.toHaveBeenCalled()
  })

  it('groupEventsSource calls groupsApi.getEvents with slug and dates', async () => {
    const mockResponse = { data: [] }
    vi.mocked(groupsApi.getEvents).mockResolvedValue(mockResponse as never)

    const slug = ref<string | undefined>('dev-team')
    const { groupEventsSource } = useCalendarEventSources(slug)
    const successCb = vi.fn()
    const failureCb = vi.fn()

    const source = groupEventsSource.value!
    const eventsFn = (source as { events: (info: EventSourceFuncArg, success: (events: never[]) => void, failure: (err: Error) => void) => Promise<void> }).events
    await eventsFn(mockFetchInfo, successCb, failureCb)

    expect(groupsApi.getEvents).toHaveBeenCalledWith('dev-team', {
      startDate: '2025-06-01T00:00:00',
      endDate: '2025-07-01T00:00:00'
    })
    expect(successCb).toHaveBeenCalledWith([])
    expect(failureCb).not.toHaveBeenCalled()
  })
})
