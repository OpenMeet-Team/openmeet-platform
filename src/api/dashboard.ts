import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import { EventEntity, GroupEntity } from 'src/types'

export function apiGetDashboardEvents (): Promise<AxiosResponse<EventEntity[]>> {
  return api.get('/api/dashboard/my-events')
}

export function apiGetDashboardGroups (): Promise<AxiosResponse<GroupEntity[]>> {
  return api.get('/api/dashboard/my-groups')
}

export const dashboardEventsApi = {
  getAll: () => api.get<EventEntity[]>('/api/v1/dashboard/events'),
  getById: (id: string) => api.get<EventEntity>(`/api/v1/dashboard/events/${id}`),
  create: (eventData: Partial<EventEntity>) => api.post<EventEntity>('/api/v1/dashboard/events', eventData),
  update: (id: string, eventData: Partial<EventEntity>) => api.put<EventEntity>(`/api/v1/dashboard/events/${id}`, eventData),
  delete: (id: string) => api.delete(`/api/v1/dashboard/events/${id}`),
  attend: (id: string) => api.post(`/api/v1/dashboard/events/${id}/attend`),
  leave: (id: string) => api.post(`/api/v1/dashboard/events/${id}/leave`)
}

export const dashboardGroupsApi = {
  getAll: () => api.get<GroupEntity[]>('/api/v1/dashboard/groups'),
  getById: (id: string) => api.get<GroupEntity>(`/api/v1/dashboard/groups/${id}`),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/v1/dashboard/groups', groupData),
  update: (id: string, groupData: Partial<GroupEntity>) => api.put<GroupEntity>(`/api/v1/dashboard/groups/${id}`, groupData),
  delete: (id: string) => api.delete(`/api/v1/dashboard/groups/${id}`),
  join: (id: string) => api.post(`/api/v1/dashboard/groups/${id}/join`),
  leave: (id: string) => api.post(`/api/v1/dashboard/groups/${id}/leave`)
}
