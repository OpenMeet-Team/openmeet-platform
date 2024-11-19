import { api } from 'boot/axios'
import { EventEntity, GroupDiscussionEntity, GroupEntity, GroupMemberEntity, GroupPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'
import { AxiosResponse } from 'axios'

const createGroupApiHeaders = (groupSlug: string) => ({
  headers: { 'x-group-slug': groupSlug }
})

export const groupsApi = {
  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups/me', { params: query }),
  getMeBySlug: (slug: string) => api.get<GroupEntity>(`/api/groups/me/${slug}`, createGroupApiHeaders(slug)),
  getBySlug: (slug: string) => api.get<GroupEntity>(`/api/groups/${slug}`, createGroupApiHeaders(slug)),
  getEvents: (slug: string) => api.get<EventEntity[]>(`/api/groups/${slug}/events`, createGroupApiHeaders(slug)),
  getDiscussions: (slug: string) => api.get<GroupDiscussionEntity[]>(`/api/groups/${slug}/discussions`, createGroupApiHeaders(slug)),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/groups', groupData),
  update: (slug: string, groupData: Partial<GroupEntity>) => api.patch<GroupEntity>(`/api/groups/${slug}`, groupData, createGroupApiHeaders(slug)),
  delete: (slug: string) => api.delete(`/api/groups/${slug}`, createGroupApiHeaders(slug)),
  join: (slug: string) : Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/groups/${slug}/join`, createGroupApiHeaders(slug)),
  leave: (slug: string) => api.delete(`/api/groups/${slug}/leave`, createGroupApiHeaders(slug)),
  updateMemberRole: (slug: string, groupMemberId: number, data: { name: string }): Promise<AxiosResponse<GroupMemberEntity>> => api.patch(`/api/groups/${slug}/members/${groupMemberId}`, data, createGroupApiHeaders(slug)),
  getMembers: (slug: string): Promise<AxiosResponse<GroupMemberEntity[]>> => api.get(`/api/groups/${slug}/members`, createGroupApiHeaders(slug)),
  approveMember: (slug: string, groupMemberId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/groups/${slug}/members/${groupMemberId}/approve`, createGroupApiHeaders(slug)),
  rejectMember: (slug: string, groupMemberId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.delete(`/api/groups/${slug}/members/${groupMemberId}/reject`, createGroupApiHeaders(slug)),
  removeMember: (slug: string, groupMemberId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.delete(`/api/groups/${slug}/members/${groupMemberId}`, createGroupApiHeaders(slug)),
  similarEvents: (slug: string): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>(`/api/groups/${slug}/recommended-events`, createGroupApiHeaders(slug))
}
