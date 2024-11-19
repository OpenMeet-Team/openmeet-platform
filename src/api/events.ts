import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import { EventAttendeeEntity, EventEntity, EventPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'

const createEventApiHeaders = (eventSlug: string) => ({
  headers: { 'x-event-slug': eventSlug }
})

export const eventsApi = {
  getAll: (query: RouteQueryAndHash): Promise<AxiosResponse<EventPaginationEntity>> => api.get<EventPaginationEntity>('/api/events', { params: query }),
  getByUlid: (ulid: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${ulid}`, createEventApiHeaders(ulid)),
  getBySlug: (slug: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${slug}`),
  create: (eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>('/api/events', eventData),
  update: (ulid: string, eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.patch<EventEntity>(`/api/events/${ulid}`, eventData, createEventApiHeaders(ulid)),
  delete: (ulid: string): Promise<AxiosResponse<void>> => api.delete(`/api/events/${ulid}`, createEventApiHeaders(ulid)),
  attend: (ulid: string, data: Partial<EventAttendeeEntity>): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${ulid}/attend`, data, createEventApiHeaders(ulid)),
  cancelAttending: (slug: string): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${slug}/cancel-attending`, null, createEventApiHeaders(slug)),
  updateAteendee: (ulid: string, data: Partial<EventAttendeeEntity>): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${ulid}/attendees`, data, createEventApiHeaders(ulid)),
  similarEvents: (ulid: string): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>(`/api/events/${ulid}/recommended-events`, createEventApiHeaders(ulid)),
  getAttendees: (ulid: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${ulid}/attendees`, createEventApiHeaders(ulid)),
  edit: (ulid: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/me/${ulid}`, createEventApiHeaders(ulid)),
  topics: (ulid: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${ulid}/topics`, createEventApiHeaders(ulid)),
  postTopic: (id: number, data: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>(`/api/events/${id}/topics`, data),
  updateTopic: (ulid: string, messageId: number, data: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>(`/api/events/${ulid}/topics/${messageId}`, data, createEventApiHeaders(ulid)),
  deleteTopic: (ulid: string, messageId: number): Promise<AxiosResponse<void>> => api.delete(`/api/events/${ulid}/topics/${messageId}`, createEventApiHeaders(ulid)),
  createComment: (ulid: string, data: Partial<{content: string, topic?: string}>): Promise<AxiosResponse<{ id: number }>> => api.post(`/api/events/${ulid}/comments`, data, createEventApiHeaders(ulid))
}
