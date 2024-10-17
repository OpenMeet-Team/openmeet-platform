import { api } from 'boot/axios'
import { EventEntity, GroupEntity, GroupMemberEntity, GroupPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'
import { AxiosResponse } from 'axios'

export const groupsApi = {
  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups/me', { params: query }),
  getById: (id: string) => api.get<GroupEntity>(`/api/groups/${id}`),
  getEvents: (id: string) => api.get<EventEntity[]>(`/api/groups/${id}/event`),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/groups', groupData),
  update: (id: number, groupData: Partial<GroupEntity>) => api.patch<GroupEntity>(`/api/groups/${id}`, groupData),
  delete: (id: number) => api.delete(`/api/groups/${id}`),
  join: (id: string) : Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/group-members/join/${id}`),
  leave: (id: string) => api.post(`/api/group-members/leave/${id}`),
  getMembers: (id: string) => api.get(`/api/group-members/${id}`),
  updateMemberRole: (data: { userId: number, name: string, groupId: number }) => api.post('/api/group-members/update-role', data),
  similarEvents: () => api.get('/api/groups/similar-events')
}
