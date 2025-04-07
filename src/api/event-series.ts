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
  until?: string
  wkst?: string
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
}

export interface AddEventToSeriesDto {
  seriesSlug: string
  eventSlug: string
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
}

export const eventSeriesApi: EventSeriesApiType = {
  getAll: (query: { params: { page: number, limit: number } }): Promise<AxiosResponse<{ data: EventSeriesEntity[], meta: { total: number, page: number, limit: number } }>> =>
    api.get('/api/event-series', { params: query.params }),

  getBySlug: (slug: string): Promise<AxiosResponse<EventSeriesEntity>> =>
    api.get(`/api/event-series/${slug}`),

  create: (seriesData: CreateEventSeriesDto): Promise<AxiosResponse<EventSeriesEntity>> => {
    console.log('eventSeriesApi.create called with:', JSON.stringify(seriesData, null, 2))
    return api.post('/api/event-series', seriesData)
  },

  update: (slug: string, seriesData: UpdateEventSeriesDto): Promise<AxiosResponse<EventSeriesEntity>> =>
    api.patch(`/api/event-series/${slug}`, seriesData),

  delete: (slug: string): Promise<AxiosResponse<void>> =>
    api.delete(`/api/event-series/${slug}`),

  getOccurrences: (slug: string, count: number = 10, includePast: boolean = false): Promise<AxiosResponse<EventOccurrence[]>> =>
    api.get(`/api/event-series/${slug}/occurrences`, { params: { count, includePast } }),

  getOccurrence: (seriesSlug: string, date: string): Promise<AxiosResponse<EventEntity>> =>
    api.get(`/api/event-series/${seriesSlug}/${date}`),

  updateFutureOccurrences: (seriesSlug: string, fromDate: string, updates: UpdateEventSeriesDto): Promise<AxiosResponse<{ message: string, count: number }>> =>
    api.patch(`/api/event-series/${seriesSlug}/future-from/${fromDate}`, updates),

  createSeriesFromEvent: (eventSlug: string, data: CreateSeriesFromEventDto): Promise<AxiosResponse<EventSeriesEntity>> =>
    api.post(`/api/event-series/create-from-event/${eventSlug}`, data),

  addEventToSeries: (data: AddEventToSeriesDto): Promise<AxiosResponse<EventEntity>> =>
    api.post(`/api/event-series/${data.seriesSlug}/add-event/${data.eventSlug}`),

  updateTemplateEvent: (seriesSlug: string, updates: UpdateTemplateEventDto): Promise<AxiosResponse<EventEntity>> =>
    api.patch(`/api/event-series/${seriesSlug}/template`, updates)
}
