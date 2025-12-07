import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { EventAttendeeEntity, EventAttendeePaginationEntity, EventEntity, EventPaginationEntity, ActivityFeedEntity, DashboardSummaryEntity } from '../types'
import { RouteQueryAndHash } from 'vue-router'

const createEventApiHeaders = (eventSlug: string) => ({
  headers: { 'x-event-slug': eventSlug }
})

// Type definitions for recurrence API parameters
export interface SplitSeriesParams {
  splitDate: string
  modifications: Partial<EventEntity>
}

export interface OccurrencesQueryParams {
  startDate?: string
  endDate?: string
  count?: number
  includeExcluded?: boolean
}

export interface EventOccurrence {
  date: string
  isExcluded: boolean
}

export interface ExpandedEventOccurrence {
  date: string
  event: EventEntity
}

export interface AdminMessageResult {
  success: boolean
  messageId: string
  deliveredCount: number
  failedCount: number
  errors?: string[]
}

export interface EventApiType {
  getAll: (query: RouteQueryAndHash) => Promise<AxiosResponse<EventPaginationEntity>>
  getByUlid: (ulid: string) => Promise<AxiosResponse<EventEntity>>
  getBySlug: (slug: string) => Promise<AxiosResponse<EventEntity>>
  edit: (slug: string) => Promise<AxiosResponse<EventEntity>>
  create: (eventData: Partial<EventEntity>) => Promise<AxiosResponse<EventEntity>>
  update: (slug: string, eventData: Partial<EventEntity>) => Promise<AxiosResponse<EventEntity>>
  delete: (slug: string) => Promise<AxiosResponse<void>>
  attend: (slug: string, data: Partial<EventAttendeeEntity>) => Promise<AxiosResponse<EventAttendeeEntity>>
  cancelAttending: (slug: string) => Promise<AxiosResponse<EventAttendeeEntity>>
  updateAttendee: (slug: string, attendeeId: number, data: Partial<{ role: string, status: string }>) => Promise<AxiosResponse<EventAttendeeEntity>>
  deleteAttendee: (slug: string, attendeeId: number) => Promise<AxiosResponse<EventAttendeeEntity>>
  similarEvents: (slug: string) => Promise<AxiosResponse<EventEntity[]>>
  getAttendees: (slug: string, query: { page: number, limit: number }) => Promise<AxiosResponse<EventAttendeePaginationEntity>>
  getDashboardEvents: () => Promise<AxiosResponse<EventEntity[]>>
  getDashboardSummary: () => Promise<AxiosResponse<DashboardSummaryEntity>>
  topics: (slug: string) => Promise<AxiosResponse<EventEntity>>
  joinEventChat: (slug: string) => Promise<AxiosResponse<{ matrixRoomId: string }>>
  getICalendar: (slug: string) => Promise<AxiosResponse<string>>
  uploadImage?: (slug: string, file: File) => Promise<AxiosResponse<unknown>>
  cancel?: (slug: string) => Promise<AxiosResponse<unknown>>
  remove?: (slug: string) => Promise<AxiosResponse<unknown>>
  // New endpoint to get all events in a series
  getEventsBySeries: (seriesSlug: string, query?: { page: number, limit: number }) => Promise<AxiosResponse<EventEntity[]>>
  // Activity feed endpoint
  getFeed: (groupSlug: string, eventSlug: string, query?: { limit?: number, offset?: number }) => Promise<AxiosResponse<ActivityFeedEntity[]>>

  // Admin messaging endpoints
  sendAdminMessage: (slug: string, data: { subject: string, message: string }) => Promise<AxiosResponse<AdminMessageResult>>
  previewAdminMessage: (slug: string, data: { subject: string, message: string, testEmail: string }) => Promise<AxiosResponse<{ message: string }>>
  contactOrganizers: (slug: string, data: { contactType: string, subject: string, message: string }) => Promise<AxiosResponse<AdminMessageResult>>

  // Recurrence-related methods (deprecated)
  /**
   * @deprecated Use eventSeriesApi.getOccurrences instead
   */
  getEventOccurrences: (slug: string, query?: OccurrencesQueryParams) => Promise<AxiosResponse<EventOccurrence[]>>

  /**
   * @deprecated Use eventSeriesApi.getOccurrences instead with expanded option
   */
  getExpandedEventOccurrences: (slug: string, query?: OccurrencesQueryParams) => Promise<AxiosResponse<ExpandedEventOccurrence[]>>

  /**
   * @deprecated Use eventSeriesApi.getOccurrence instead
   */
  getEffectiveEventForDate: (slug: string, date: string) => Promise<AxiosResponse<EventEntity>>

  /**
   * @deprecated Use eventSeriesApi.updateFutureOccurrences instead
   */
  splitSeriesAt: (slug: string, params: SplitSeriesParams) => Promise<AxiosResponse<EventEntity>>

  /**
   * @deprecated No direct equivalent in event series API
   */
  addExclusionDate: (slug: string, exclusionDate: string) => Promise<AxiosResponse<void>>

  /**
   * @deprecated No direct equivalent in event series API
   */
  removeExclusionDate: (slug: string, date: string) => Promise<AxiosResponse<void>>
}

export const eventsApi: EventApiType = {
  getAll: (query: RouteQueryAndHash): Promise<AxiosResponse<EventPaginationEntity>> => api.get<EventPaginationEntity>('/api/events', { params: query }),
  getByUlid: (ulid: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${ulid}`, createEventApiHeaders(ulid)),
  getBySlug: (slug: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${slug}`),
  create: (eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>('/api/events', eventData),
  update: (slug: string, eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.patch<EventEntity>(`/api/events/${slug}`, eventData, createEventApiHeaders(slug)),
  delete: (slug: string): Promise<AxiosResponse<void>> => api.delete(`/api/events/${slug}`, createEventApiHeaders(slug)),
  attend: (slug: string, data: Partial<EventAttendeeEntity>): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${slug}/attend`, data, createEventApiHeaders(slug)),
  cancelAttending: (slug: string): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${slug}/cancel-attending`, null, createEventApiHeaders(slug)),
  updateAttendee: (slug: string, attendeeId: number, data: Partial<{ role: string, status: string }>): Promise<AxiosResponse<EventAttendeeEntity>> => api.patch(`/api/events/${slug}/attendees/${attendeeId}`, data, createEventApiHeaders(slug)),
  deleteAttendee: (slug: string, attendeeId: number): Promise<AxiosResponse<EventAttendeeEntity>> => api.delete(`/api/events/${slug}/attendees/${attendeeId}`, createEventApiHeaders(slug)),
  similarEvents: (slug: string): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>(`/api/events/${slug}/recommended-events`, createEventApiHeaders(slug)),
  getAttendees: (slug: string, query: { page: number, limit: number }): Promise<AxiosResponse<EventAttendeePaginationEntity>> => api.get<EventAttendeePaginationEntity>(`/api/events/${slug}/attendees`, { params: query, ...createEventApiHeaders(slug) }),
  edit: (slug: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${slug}/edit`, createEventApiHeaders(slug)),
  getDashboardEvents: (): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>('/api/events/dashboard'),
  getDashboardSummary: (): Promise<AxiosResponse<DashboardSummaryEntity>> => api.get<DashboardSummaryEntity>('/api/events/dashboard/summary'),
  topics: (slug: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${slug}/topics`, createEventApiHeaders(slug)),
  joinEventChat: (slug: string): Promise<AxiosResponse<{ matrixRoomId: string }>> => api.post(`/api/chat/event/${slug}/join`, {}),
  getICalendar: (slug: string): Promise<AxiosResponse<string>> => api.get(`/api/events/${slug}/calendar`, {
    responseType: 'text',
    headers: { Accept: 'text/calendar' }
  }),

  // Recurrence API methods
  getEventOccurrences: (slug: string, query?: OccurrencesQueryParams): Promise<AxiosResponse<EventOccurrence[]>> =>
    api.get<EventOccurrence[]>(`/api/recurrence/${slug}/occurrences`, { params: query }),

  getExpandedEventOccurrences: (slug: string, query?: OccurrencesQueryParams): Promise<AxiosResponse<ExpandedEventOccurrence[]>> =>
    api.get<ExpandedEventOccurrence[]>(`/api/recurrence/${slug}/expanded-occurrences`, { params: query }),

  getEffectiveEventForDate: (slug: string, date: string): Promise<AxiosResponse<EventEntity>> =>
    api.get<EventEntity>(`/api/recurrence/${slug}/effective`, { params: { date } }),

  splitSeriesAt: (slug: string, params: SplitSeriesParams): Promise<AxiosResponse<EventEntity>> =>
    api.post<EventEntity>(`/api/recurrence/${slug}/split`, params),

  addExclusionDate: (slug: string, exclusionDate: string): Promise<AxiosResponse<void>> =>
    api.patch<void>(`/api/recurrence/${slug}/exclusions`, { exclusionDate }),

  removeExclusionDate: (slug: string, date: string): Promise<AxiosResponse<void>> =>
    api.patch<void>(`/api/recurrence/${slug}/inclusions`, null, { params: { date } }),

  // New endpoint to get all events in a series
  getEventsBySeries: (seriesSlug: string, query?: { page: number, limit: number }) => api.get<EventEntity[]>(`/api/events/series/${seriesSlug}/events`, { params: query }),

  // Admin messaging endpoints
  sendAdminMessage: (slug: string, data: { subject: string, message: string }): Promise<AxiosResponse<AdminMessageResult>> => api.post(`/api/events/${slug}/admin-message`, data, createEventApiHeaders(slug)),
  previewAdminMessage: (slug: string, data: { subject: string, message: string, testEmail: string }): Promise<AxiosResponse<{ message: string }>> => api.post(`/api/events/${slug}/admin-message/preview`, data, createEventApiHeaders(slug)),

  // Attendee contact endpoints
  contactOrganizers: (slug: string, data: { contactType: string, subject: string, message: string }): Promise<AxiosResponse<AdminMessageResult>> => api.post(`/api/events/${slug}/contact-organizers`, data, createEventApiHeaders(slug)),

  // Activity feed endpoint
  getFeed: (groupSlug: string, eventSlug: string, query?: { limit?: number, offset?: number }): Promise<AxiosResponse<ActivityFeedEntity[]>> => api.get(`/api/events/${eventSlug}/feed`, { params: query })
}
