import { api } from 'boot/axios'
import { EventEntity, EventPaginationEntity } from 'src/types'

export const eventsApi = {
  getAll: () => api.get<EventPaginationEntity>('/api/events'),
  getById: (id: string) => api.get<EventEntity>(`/api/events/${id}`),
  create: (eventData: Partial<EventEntity>) => api.post<EventEntity>('/api/events', eventData),
  update: (id: number, eventData: Partial<EventEntity>) => api.patch<EventEntity>(`/api/events/${id}`, eventData),
  delete: (id: number) => api.delete(`/api/events/${id}`),
  attend: (data: {eventId: number, }) => api.post('/api/event-attendees/attend', data),
  leave: (id: number) => api.post(`/api/events/${id}/leave`)

}
