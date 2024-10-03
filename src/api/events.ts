import { api } from 'boot/axios'
import { EventData } from 'src/types'

export const eventsApi = {
  getAll: () => api.get<EventData[]>('/api/events'),
  getById: (id: string) => api.get<EventData>(`/api/events/${id}`),
  create: (eventData: Partial<EventData>) => api.post<EventData>('/api/events', eventData),
  update: (id: string, eventData: Partial<EventData>) => api.put<EventData>(`/api/events/${id}`, eventData),
  delete: (id: string) => api.delete(`/api/events/${id}`),
  attend: (id: string) => api.post(`/api/events/${id}/attend`),
  leave: (id: string) => api.post(`/api/events/${id}/leave`)
}
