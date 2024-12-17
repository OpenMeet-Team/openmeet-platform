import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import { EventAttendeeEntity, EventAttendeePaginationEntity, EventEntity, EventPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'

const createEventApiHeaders = (eventSlug: string) => ({
  headers: { 'x-event-slug': eventSlug }
})

export const eventsApi = {
  getAll: (query: RouteQueryAndHash): Promise<AxiosResponse<EventPaginationEntity>> => api.get<EventPaginationEntity>('/api/events', { params: query }),
  getByUlid: (ulid: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${ulid}`, createEventApiHeaders(ulid)),
  getBySlug: (slug: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${slug}`),
  create: (eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>('/api/events', eventData),
  update: (slug: string, eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.patch<EventEntity>(`/api/events/${slug}`, eventData, createEventApiHeaders(slug)),
  delete: (slug: string): Promise<AxiosResponse<void>> => api.delete(`/api/events/${slug}`, createEventApiHeaders(slug)),
  attend: (slug: string, data: Partial<EventAttendeeEntity>): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${slug}/attend`, data, createEventApiHeaders(slug)),
  cancelAttending: (slug: string): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${slug}/cancel-attending`, null, createEventApiHeaders(slug)),
  updateAteendee: (slug: string, data: Partial<EventAttendeeEntity>): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${slug}/attendees`, data, createEventApiHeaders(slug)),
  deleteAttendee: (slug: string, attendeeId: number): Promise<AxiosResponse<EventAttendeeEntity>> => api.delete(`/api/events/${slug}/attendees/${attendeeId}`, createEventApiHeaders(slug)),
  similarEvents: (slug: string): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>(`/api/events/${slug}/recommended-events`, createEventApiHeaders(slug)),
  getAttendees: (slug: string, query: { page: number, limit: number }): Promise<AxiosResponse<EventAttendeePaginationEntity>> => api.get<EventAttendeePaginationEntity>(`/api/events/${slug}/attendees`, { params: query, ...createEventApiHeaders(slug) }),
  edit: (slug: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${slug}/edit`, createEventApiHeaders(slug)),
  getDashboardEvents: (): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>('/api/events/dashboard'),
  topics: (slug: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${slug}/topics`, createEventApiHeaders(slug)),
  // postTopic: (id: number, data: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>(`/api/events/${id}/topics`, data),
  // updateTopic: (slug: string, messageId: number, data: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>(`/api/events/${slug}/topics/${messageId}`, data, createEventApiHeaders(slug)),
  // deleteTopic: (slug: string, messageId: number): Promise<AxiosResponse<void>> => api.delete(`/api/events/${slug}/topics/${messageId}`, createEventApiHeaders(slug)),
  // createComment: (ulid: string, data: Partial<{content: string, topic?: string}>): Promise<AxiosResponse<{ id: number }>> => api.post(`/api/events/${ulid}/comments`, data, createEventApiHeaders(ulid)),
  sendDiscussionMessage: (slug: string, message: string, topicName: string): Promise<AxiosResponse<{ id: number }>> => api.post(`/api/events/${slug}/discussions`, { message, topicName }, createEventApiHeaders(slug)),
  deleteDiscussionMessage: (slug: string, messageId: number): Promise<AxiosResponse<{ id: number }>> => api.delete(`/api/events/${slug}/discussions/${messageId}`, createEventApiHeaders(slug)),
  updateDiscussionMessage: (slug: string, messageId: number, message: string): Promise<AxiosResponse<{ id: number }>> => api.patch(`/api/events/${slug}/discussions/${messageId}`, { message }, createEventApiHeaders(slug))
}
