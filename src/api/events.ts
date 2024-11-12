import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import { EventAttendeeEntity, EventEntity, EventPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'

export const eventsApi = {
  getAll: (query: RouteQueryAndHash): Promise<AxiosResponse<EventPaginationEntity>> => api.get<EventPaginationEntity>('/api/events', { params: query }),
  getById: (id: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${id}`),
  create: (eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>('/api/events', eventData),
  update: (id: number, eventData: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.patch<EventEntity>(`/api/events/${id}`, eventData),
  delete: (id: number): Promise<AxiosResponse<void>> => api.delete(`/api/events/${id}`),
  attend: (id: number, data: Partial<EventAttendeeEntity>): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${id}/attend`, data),
  cancelAttending: (id: number): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${id}/cancel-attending`),
  updateAteendee: (id: number, data: Partial<EventAttendeeEntity>): Promise<AxiosResponse<EventAttendeeEntity>> => api.post(`/api/events/${id}/attendees`, data),
  similarEvents: (id: string): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>(`/api/events/${id}/recommended-events`),
  getAttendees: (id: string): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${id}/attendees`),
  edit: (id: number): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/me/${id}`),
  topics: (id: number): Promise<AxiosResponse<EventEntity>> => api.get<EventEntity>(`/api/events/${id}/topics`),
  postTopic: (id: number, data: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>(`/api/events/${id}/topics`, data),
  updateTopic: (id: number, messageId: number, data: Partial<EventEntity>): Promise<AxiosResponse<EventEntity>> => api.post<EventEntity>(`/api/events/${id}/topics/${messageId}`, data),
  deleteTopic: (id: number, messageId: number): Promise<AxiosResponse<void>> => api.delete(`/api/events/${id}/topics/${messageId}`)
}
