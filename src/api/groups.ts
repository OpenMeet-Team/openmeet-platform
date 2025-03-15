import { api } from '../boot/axios'
import { EventEntity, ZulipMessageEntity, ZulipTopicEntity, GroupEntity, GroupMemberEntity, GroupPaginationEntity } from '../types'
import { RouteQueryAndHash } from 'vue-router'
import { AxiosResponse } from 'axios'
import { MatrixMessage } from '../types/matrix'

const createGroupApiHeaders = (groupSlug: string) => ({
  headers: { 'x-group-slug': groupSlug }
})

export const groupsApi = {
  // Add missing method for Matrix message retrieval
  getDiscussionMessages: (slug: string, limit = 50, from?: string): Promise<AxiosResponse<{ messages: MatrixMessage[], end: string }>> =>
    api.get(`/api/groups/${slug}/discussions/messages`, { params: { limit, from }, ...createGroupApiHeaders(slug) }),

  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: () => api.get<GroupEntity[]>('/api/groups/me'),
  getDashboardGroups: () => api.get<GroupEntity[]>('/api/groups/dashboard'),
  getDashboardGroup: (slug: string) => api.get<GroupEntity>(`/api/groups/${slug}/edit`, createGroupApiHeaders(slug)),
  getBySlug: (slug: string) => api.get<GroupEntity>(`/api/groups/${slug}`, createGroupApiHeaders(slug)),
  getAbout: (slug: string) => api.get<{
    events: EventEntity[],
    groupMembers: GroupMemberEntity[],
    messages: ZulipMessageEntity[],
    topics: ZulipTopicEntity[]
  }>(`/api/groups/${slug}/about`, createGroupApiHeaders(slug)),
  getEvents: (slug: string) => api.get<EventEntity[]>(`/api/groups/${slug}/events`, createGroupApiHeaders(slug)),
  getDiscussions: (slug: string) => api.get<{ topics: ZulipTopicEntity[], messages: ZulipMessageEntity[] }>(`/api/groups/${slug}/discussions`, createGroupApiHeaders(slug)),
  create: (groupData: Partial<GroupEntity>) => api.post<GroupEntity>('/api/groups', groupData),
  update: (slug: string, groupData: Partial<GroupEntity>) => api.patch<GroupEntity>(`/api/groups/${slug}`, groupData, createGroupApiHeaders(slug)),
  delete: (slug: string) => api.delete(`/api/groups/${slug}`, createGroupApiHeaders(slug)),
  join: (slug: string) : Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/groups/${slug}/join`, null, createGroupApiHeaders(slug)),
  leave: (slug: string) => api.delete(`/api/groups/${slug}/leave`, createGroupApiHeaders(slug)),
  updateMemberRole: (slug: string, groupMemberId: number, data: { name: string }): Promise<AxiosResponse<GroupMemberEntity>> => api.patch(`/api/groups/${slug}/members/${groupMemberId}`, data, createGroupApiHeaders(slug)),
  getMembers: (slug: string): Promise<AxiosResponse<GroupMemberEntity[]>> => api.get(`/api/groups/${slug}/members`, createGroupApiHeaders(slug)),
  approveMember: (slug: string, groupMemberId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.post(`/api/groups/${slug}/members/${groupMemberId}/approve`, createGroupApiHeaders(slug)),
  rejectMember: (slug: string, groupMemberId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.delete(`/api/groups/${slug}/members/${groupMemberId}/reject`, createGroupApiHeaders(slug)),
  removeMember: (slug: string, groupMemberId: number): Promise<AxiosResponse<GroupMemberEntity>> => api.delete(`/api/groups/${slug}/members/${groupMemberId}`, createGroupApiHeaders(slug)),
  similarEvents: (slug: string): Promise<AxiosResponse<EventEntity[]>> => api.get<EventEntity[]>(`/api/groups/${slug}/recommended-events`, createGroupApiHeaders(slug)),
  sendDiscussionMessage: (slug: string, message: string): Promise<AxiosResponse<{ id: number }>> => api.post(`/api/groups/${slug}/discussions`, { message }, createGroupApiHeaders(slug)),
  deleteDiscussionMessage: (slug: string, messageId: number): Promise<AxiosResponse<{ id: number }>> => api.delete(`/api/groups/${slug}/discussions/${messageId}`, createGroupApiHeaders(slug)),
  updateDiscussionMessage: (slug: string, messageId: number, message: string): Promise<AxiosResponse<{ id: number }>> => api.patch(`/api/groups/${slug}/discussions/${messageId}`, { message }, createGroupApiHeaders(slug))
}
