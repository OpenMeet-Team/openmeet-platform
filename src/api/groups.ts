import { api } from 'boot/axios'
import { EventEntity, ZulipMessageEntity, ZulipTopicEntity, GroupEntity, GroupMemberEntity, GroupPaginationEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'
import { AxiosResponse } from 'axios'

const createGroupApiHeaders = (groupSlug: string) => ({
  headers: { 'x-group-slug': groupSlug }
})

export const groupsApi = {
  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: () => api.get<GroupEntity[]>('/api/groups/me'),
  getDashboardGroup: (slug: string) => api.get<GroupEntity>(`/api/groups/me/${slug}`, createGroupApiHeaders(slug)),
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
  sendDiscussionMessage: (slug: string, message: string, topicName: string): Promise<AxiosResponse<{ id: number }>> => api.post(`/api/groups/${slug}/discussions`, { message, topicName }, createGroupApiHeaders(slug)),
  deleteDiscussionMessage: (slug: string, messageId: number): Promise<AxiosResponse<{ id: number }>> => api.delete(`/api/groups/${slug}/discussions/${messageId}`, createGroupApiHeaders(slug)),
  updateDiscussionMessage: (slug: string, messageId: number, message: string): Promise<AxiosResponse<{ id: number }>> => api.patch(`/api/groups/${slug}/discussions/${messageId}`, { message }, createGroupApiHeaders(slug))
}
