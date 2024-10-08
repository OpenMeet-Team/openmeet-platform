import { api } from 'boot/axios'
import { GroupEntity } from 'src/types'

export const groupsApi = {
  getAll: () => api.get<GroupEntity[]>('/api/groups'),
  getCatalog: () => api.get<GroupEntity[]>('/api/groups/catalog'),
  getById: (id: string) => api.get<GroupEntity>(`/api/groups/${id}`),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/groups', groupData),
  update: (id: number, groupData: Partial<GroupEntity>) => api.put<GroupEntity>(`/api/groups/${id}`, groupData),
  delete: (id: number) => api.delete(`/api/groups/${id}`),
  join: (id: string) => api.post(`/api/groups/${id}/join`),
  leave: (id: string) => api.post(`/api/groups/${id}/leave`),
  roles: (id: string) => api.get(`/api/groups/${id}/roles`)
}
