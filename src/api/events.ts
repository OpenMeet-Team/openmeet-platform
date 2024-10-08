import { api } from 'boot/axios'
import { EventEntity } from 'src/types'

export const eventsApi = {
  getAll: () => api.get<EventEntity[]>('/api/events'),
  getById: (id: string) => api.get<EventEntity>(`/api/events/${id}`),
  create: (eventData: Partial<EventEntity>) => api.post<EventEntity>('/api/events', eventData),
  update: (id: number, eventData: Partial<EventEntity>) => api.put<EventEntity>(`/api/events/${id}`, eventData),
  delete: (id: number) => api.delete(`/api/events/${id}`),
  attend: (id: number) => api.post(`/api/events/${id}/attend`),
  leave: (id: number) => api.post(`/api/events/${id}/leave`)
}
