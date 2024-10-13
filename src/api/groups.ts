import { api } from 'boot/axios'
import { GroupEntity, GroupPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'

export const groupsApi = {
  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups/me', { params: query }),
  getById: (id: string) => api.get<GroupEntity>(`/api/groups/${id}`),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/groups', groupData),
  update: (id: number, groupData: Partial<GroupEntity>) => api.put<GroupEntity>(`/api/groups/${id}`, groupData),
  delete: (id: number) => api.delete(`/api/groups/${id}`),
  join: (id: string) => api.post('/api/group-members/join', { groupId: id }),
  leave: (id: string) => api.post('/api/group-members/leave', { groupId: id }),
  similarEvents: (id: string) => api.get(`/api/groups/${id}/similar-events`),
  // join: (id: number) => api.post(`/api/groups/${id}/join`),
  // leave: (id: number) => api.post(`/api/groups/${id}/leave`),
  roles: (id: string) => api.get(`/api/groups/${id}/roles`)
}
