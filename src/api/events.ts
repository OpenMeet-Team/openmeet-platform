import { api } from 'boot/axios'
import { EventAttendeeEntity, EventEntity, EventPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'

export const eventsApi = {
  getAll: (query: RouteQueryAndHash) => api.get<EventPaginationEntity>('/api/events', { params: query }),
  // getAll: () => api.get<EventPaginationEntity>('/api/events'),
  getById: (id: string) => api.get<EventEntity>(`/api/events/${id}`),
  getAttendeesById: (id: string) => api.get<EventEntity>(`/api/event-attendees/${id}`),
  create: (eventData: Partial<EventEntity>) => api.post<EventEntity>('/api/events', eventData),
  update: (id: number, eventData: Partial<EventEntity>) => api.patch<EventEntity>(`/api/events/${id}`, eventData),
  delete: (id: number) => api.delete(`/api/events/${id}`),
  attend: (data: Partial<EventAttendeeEntity>) => api.post('/api/event-attendees/attend', data),
  cancel: (userId: number, eventId: number) => api.delete(`/api/event-attendees/cancel/${userId}/${eventId}`),
  updateAteendee: (id: number, data: Partial<EventAttendeeEntity>) => api.post(`/api/event-attendees/${id}`, data),
  similarEvents: (id: string) => api.get<EventEntity[]>(`/api/events/${id}/recommended-events`)
}
