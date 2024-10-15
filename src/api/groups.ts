import { api } from 'boot/axios'
import { GroupEntity, GroupMemberEntity, GroupPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'
import { AxiosResponse } from 'axios'

export const groupsApi = {
  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups/me', { params: query }),
  getById: (id: string) => api.get<GroupEntity>(`/api/groups/${id}`),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/groups', groupData),
  update: (id: number, groupData: Partial<GroupEntity>) => api.put<GroupEntity>(`/api/groups/${id}`, groupData),
  delete: (id: number) => api.delete(`/api/groups/${id}`),
  join: (id: string) : Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/group-members/join/${id}`),
  leave: (id: string) => api.post(`/api/group-members/leave/${id}`),
  getMembers: (id: string) => api.get(`/api/group-members/${id}`),
  updateMemberRole: (data: { userId: number, name: string, groupId: number }) => api.post('/api/group-members/update-role', data),
  // similarEvents: (id: string) => api.get(`/api/groups/${id}/similar-events`),
  similarEvents: () => api.get('/api/events')
}
