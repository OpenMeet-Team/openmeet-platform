import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import { EventData, Group, Message } from 'src/types'

export function apiGetDashboardEvents (): Promise<AxiosResponse<EventData[]>> {
  return api.get('/api/events')
}

export function apiGetDashboardGroups (): Promise<AxiosResponse> {
  return api.get('/api/v1/dashboard/groups')
}

export function apiGetDashboardMessages (): Promise<AxiosResponse> {
  return api.get('/api/v1/dashboard/messages')
}

export const eventsApi = {
  getAll: () => api.get<EventData[]>('/api/v1/dashboard/events'),
  getById: (id: string) => api.get<EventData>(`/api/v1/dashboard/events/${id}`),
  create: (eventData: Partial<EventData>) => api.post<EventData>('/api/v1/dashboard/events', eventData),
  update: (id: string, eventData: Partial<EventData>) => api.put<EventData>(`/api/v1/dashboard/events/${id}`, eventData),
  delete: (id: string) => api.delete(`/api/v1/dashboard/events/${id}`),
  attend: (id: string) => api.post(`/api/v1/dashboard/events/${id}/attend`),
  leave: (id: string) => api.post(`/api/v1/dashboard/events/${id}/leave`)
}

export const groupsApi = {
  getAll: () => api.get<Group[]>('/api/v1/dashboard/groups'),
  getById: (id: string) => api.get<Group>(`/api/v1/dashboard/groups/${id}`),
  create: (groupData: Partial<Group>) => api.post<Group>('/api/v1/dashboard/groups', groupData),
  update: (id: string, groupData: Partial<Group>) => api.put<Group>(`/api/v1/dashboard/groups/${id}`, groupData),
  delete: (id: string) => api.delete(`/api/v1/dashboard/groups/${id}`),
  join: (id: string) => api.post(`/api/v1/dashboard/groups/${id}/join`),
  leave: (id: string) => api.post(`/api/v1/dashboard/groups/${id}/leave`)
}

export const messagesApi = {
  getAllByGroupId: (groupId: string) => api.get<Message[]>(`/api/v1/dashboard/groups/${groupId}/messages`),
  getAllByEventId: (eventId: string) => api.get<Message[]>(`/api/v1/dashboard/events/${eventId}/messages`),
  getById: (id: string) => api.get<Message>(`/api/v1/dashboard/messages/${id}`),
  create: (messageData: Partial<Message>) => api.post<Message>('/api/v1/dashboard/messages', messageData),
  update: (id: string, messageData: Partial<Message>) => api.put<Message>(`/api/v1/dashboard/messages/${id}`, messageData),
  delete: (id: string) => api.delete(`/api/v1/dashboard/messages/${id}`)
}
