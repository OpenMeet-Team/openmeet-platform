import { api } from 'boot/axios'
import { EventEntity, GroupDiscussionEntity, GroupEntity, GroupMemberEntity, GroupPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'
import { AxiosResponse } from 'axios'

export const groupsApi = {
  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups/me', { params: query }),
  getMeById: (id: string) => api.get<GroupEntity>(`/api/groups/me/${id}`),
  getById: (id: string) => api.get<GroupEntity>(`/api/groups/${id}`),
  getEvents: (id: string) => api.get<EventEntity[]>(`/api/groups/${id}/events`),
  getDiscussions: (id: string) => api.get<GroupDiscussionEntity[]>(`/api/groups/${id}/discussions`),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/groups', groupData),
  update: (id: number, groupData: Partial<GroupEntity>) => api.patch<GroupEntity>(`/api/groups/${id}`, groupData),
  delete: (id: number) => api.delete(`/api/groups/${id}`),
  join: (id: string) : Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/groups/${id}/join`),
  leave: (id: string) => api.delete(`/api/groups/${id}/leave`),
  updateMemberRole: (groupId: number, userId: number, data: { name: string }): Promise<AxiosResponse<GroupMemberEntity>> => api.patch(`/api/groups/${groupId}/members/${userId}`, data),
  getMembers: (id: string): Promise<AxiosResponse<GroupMemberEntity[]>> => api.get(`/api/groups/${id}/members`),
  approveMember: (groupId: number, userId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/groups/${groupId}/members/${userId}/approve`),
  rejectMember: (groupId: number, userId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.delete(`/api/groups/${groupId}/members/${userId}/reject`),
  removeMember: (groupId: number, userId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.delete(`/api/groups/${groupId}/members/${userId}`),
  similarEvents: (id: string): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>(`/api/groups/${id}/recommended-events`)
}
