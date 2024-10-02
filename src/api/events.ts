import { api } from 'boot/axios'
import { EventData } from 'src/types'

export const eventsApi = {
  getAll: () => api.get<EventData[]>('/api/v1/events'),
  getById: (id: string) => api.get<EventData>(`/api/v1/events/${id}`),
  create: (eventData: Partial<EventData>) => api.post<EventData>('/api/v1/events', eventData),
  update: (id: string, eventData: Partial<EventData>) => api.put<EventData>(`/api/v1/events/${id}`, eventData),
  delete: (id: string) => api.delete(`/api/v1/events/${id}`),
  attend: (id: string) => api.post(`/api/v1/events/${id}/attend`),
  leave: (id: string) => api.post(`/api/v1/events/${id}/leave`)
}
