import { api } from 'boot/axios'
import { Group } from 'src/types'

export const groupsApi = {
  getAll: () => api.get<Group[]>('/api/v1/groups'),
  getById: (id: string) => api.get<Group>(`/api/v1/groups/${id}`),
  create: (groupData: Partial<Group>) => api.post<Group>('/api/v1/groups', groupData),
  update: (id: number, groupData: Partial<Group>) => api.put<Group>(`/api/v1/groups/${id}`, groupData),
  delete: (id: string) => api.delete(`/api/v1/groups/${id}`),
  join: (id: string) => api.post(`/api/v1/groups/${id}/join`),
  leave: (id: string) => api.post(`/api/v1/groups/${id}/leave`),
  roles: (id: string) => api.get(`/api/v1/groups/${id}/roles`)
}
