import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { EventEntity } from '../types'
import { EventOccurrence, EventSeriesEntity } from '../types/event-series'

export interface TemplateEventDto {
  startDate: string
  endDate?: string
  type: string
  location?: string
  locationOnline?: string
  maxAttendees?: number
  requireApproval?: boolean
  approvalQuestion?: string
  allowWaitlist?: boolean
  categories?: number[]
}

export interface RecurrenceRuleDto {
  frequency: string // Must use 'frequency' to match backend's RecurrenceRuleDto
  interval?: number
  count?: number
  byweekday?: string[] // Maps to 'byday' in frontend
  bymonth?: number[]
  bymonthday?: number[]
  bysetpos?: number[] // Position within month/year (e.g., 1st, 2nd, 3rd, last)
  until?: string
  wkst?: string

  // Custom properties not part of the standard RFC but used by our implementation
  // These are passed to the backend but not part of the TypeScript interface
  _userExplicitSelection?: boolean // Flag to preserve user's explicit day selection
  timeZone?: string // Timezone for proper day boundary handling
}

export interface CreateEventSeriesDto {
  name: string
  slug?: string
  description?: string
  timeZone: string // Required for recurring series
  recurrenceRule: RecurrenceRuleDto
  templateEvent: TemplateEventDto
  imageId?: number
  groupId?: number
  matrixRoomId?: string
}

export interface UpdateEventSeriesDto {
  name?: string
  description?: string
  timeZone?: string
  recurrenceRule?: RecurrenceRuleDto
  propagateChanges?: boolean
  imageId?: number
  groupId?: number
  templateEventSlug?: string
}

export interface UpdateTemplateEventDto {
  startDate?: string
  endDate?: string
  type?: string
  location?: string
  locationOnline?: string
  maxAttendees?: number
  requireApproval?: boolean
  approvalQuestion?: string
  allowWaitlist?: boolean
  categories?: number[]
}

export interface PromoteToSeriesDto {
  recurrenceRule: RecurrenceRuleDto
  timeZone: string
  name?: string
  description?: string
}

export interface CreateSeriesFromEventDto {
  recurrenceRule: RecurrenceRuleDto
  timeZone: string
  name?: string
  description?: string
  generateOccurrences?: boolean
}

export interface AddEventToSeriesDto {
  seriesSlug: string
  eventSlug: string
}

export interface OccurrencePreviewDto {
  startDate: string
  timeZone: string
  recurrenceRule: RecurrenceRuleDto
  count?: number
}

export interface EventSeriesApiType {
  getAll: (query: { params: { page: number, limit: number } }) => Promise<AxiosResponse<{ data: EventSeriesEntity[], meta: { total: number, page: number, limit: number } }>>
  getBySlug: (slug: string) => Promise<AxiosResponse<EventSeriesEntity>>
  create: (seriesData: CreateEventSeriesDto) => Promise<AxiosResponse<EventSeriesEntity>>
  update: (slug: string, seriesData: UpdateEventSeriesDto) => Promise<AxiosResponse<EventSeriesEntity>>
  delete: (slug: string) => Promise<AxiosResponse<void>>
  getOccurrences: (slug: string, count?: number, includePast?: boolean) => Promise<AxiosResponse<EventOccurrence[]>>
  getOccurrence: (seriesSlug: string, date: string) => Promise<AxiosResponse<EventEntity>>
  updateFutureOccurrences: (seriesSlug: string, fromDate: string, updates: UpdateEventSeriesDto) => Promise<AxiosResponse<{ message: string, count: number }>>
  createSeriesFromEvent: (eventSlug: string, data: CreateSeriesFromEventDto) => Promise<AxiosResponse<EventSeriesEntity>>
  addEventToSeries: (data: AddEventToSeriesDto) => Promise<AxiosResponse<EventEntity>>
  updateTemplateEvent: (seriesSlug: string, updates: UpdateTemplateEventDto) => Promise<AxiosResponse<EventEntity>>
  previewOccurrences: (data: OccurrencePreviewDto) => Promise<AxiosResponse<EventOccurrence[]>>
}

export const eventSeriesApi: EventSeriesApiType = {
  getAll: (query: { params: { page: number, limit: number } }): Promise<AxiosResponse<{ data: EventSeriesEntity[], meta: { total: number, page: number, limit: number } }>> =>
    api.get('/api/event-series', { params: query.params }),

  getBySlug: (slug: string): Promise<AxiosResponse<EventSeriesEntity>> =>
    api.get(`/api/event-series/${slug}`),

  create: (seriesData: CreateEventSeriesDto): Promise<AxiosResponse<EventSeriesEntity>> =>
    api.post('/api/event-series', seriesData),

  update: (slug: string, seriesData: UpdateEventSeriesDto): Promise<AxiosResponse<EventSeriesEntity>> =>
    api.patch(`/api/event-series/${slug}`, seriesData),

  delete: (slug: string): Promise<AxiosResponse<void>> =>
    api.delete(`/api/event-series/${slug}`),

  getOccurrences: (slug: string, count: number = 10, includePast: boolean = false): Promise<AxiosResponse<EventOccurrence[]>> =>
    api.get(`/api/event-series/${slug}/occurrences`, {
      params: {
        count,
        includePast
      }
    }),

  getOccurrence: (seriesSlug: string, date: string): Promise<AxiosResponse<EventEntity>> =>
    api.get(`/api/event-series/${seriesSlug}/${date}`),

  updateFutureOccurrences: (seriesSlug: string, fromDate: string, updates: UpdateEventSeriesDto): Promise<AxiosResponse<{ message: string, count: number }>> =>
    api.patch(`/api/event-series/${seriesSlug}/future-from/${fromDate}`, updates),

  createSeriesFromEvent: (eventSlug: string, data: CreateSeriesFromEventDto): Promise<AxiosResponse<EventSeriesEntity>> =>
    api.post(`/api/event-series/create-from-event/${eventSlug}`, data),

  addEventToSeries: (data: AddEventToSeriesDto): Promise<AxiosResponse<EventEntity>> =>
    api.post(`/api/event-series/${data.seriesSlug}/add-event/${data.eventSlug}`),

  updateTemplateEvent: (seriesSlug: string, updates: UpdateTemplateEventDto): Promise<AxiosResponse<EventEntity>> =>
    api.patch(`/api/event-series/${seriesSlug}/template`, updates),

  previewOccurrences: (data: OccurrencePreviewDto): Promise<AxiosResponse<EventOccurrence[]>> => {
    // Build recurrence rule - only include properties that are actually present
    const recurrenceRule: Partial<RecurrenceRuleDto> = {
      frequency: data.recurrenceRule?.frequency || 'WEEKLY',
      interval: data.recurrenceRule?.interval || 1
    }

    // CRITICAL: Only add byweekday if it's actually present in the input
    // DO NOT default to ['TU'] - this causes monthly bymonthday patterns to fail
    if (Array.isArray(data.recurrenceRule?.byweekday) && data.recurrenceRule.byweekday.length > 0) {
      recurrenceRule.byweekday = [...data.recurrenceRule.byweekday]
    }

    // Add other optional properties only if present
    if (Array.isArray(data.recurrenceRule?.bymonthday) && data.recurrenceRule.bymonthday.length > 0) {
      recurrenceRule.bymonthday = [...data.recurrenceRule.bymonthday]
    }

    if (Array.isArray(data.recurrenceRule?.bysetpos) && data.recurrenceRule.bysetpos.length > 0) {
      recurrenceRule.bysetpos = [...data.recurrenceRule.bysetpos]
    }

    // Final safety check: NEVER send both bymonthday and byweekday together
    if (recurrenceRule.bymonthday && recurrenceRule.byweekday) {
      console.warn('[API] Both bymonthday and byweekday present - removing byweekday to prevent RRule AND logic')
      delete recurrenceRule.byweekday
      delete recurrenceRule.bysetpos
    }

    // Create a clean, serialized copy of the data
    const serializedData = {
      startDate: data.startDate,
      timeZone: data.timeZone,
      count: data.count || 5,
      recurrenceRule
    }

    // Set explicit content-type to ensure proper serialization
    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    }

    try {
      // Use JSON.stringify to ensure proper serialization
      return api.post('/api/event-series/preview-occurrences', serializedData, config)
    } catch (error) {
      console.error('Error in previewOccurrences API call:', error)
      throw error
    }
  }
}
