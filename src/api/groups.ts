import { api } from '../boot/axios'
import { EventEntity, GroupEntity, GroupMemberEntity, GroupPaginationEntity, ActivityFeedEntity, DashboardGroupsSummaryEntity } from '../types'
import { RouteQueryAndHash } from 'vue-router'
import { AxiosResponse } from 'axios'

const createGroupApiHeaders = (groupSlug: string) => ({
  headers: { 'x-group-slug': groupSlug }
})

export const groupsApi = {

  getAll: (query: RouteQueryAndHash) => api.get<GroupPaginationEntity>('/api/groups', { params: query }),
  getAllMe: () => api.get<GroupEntity[]>('/api/groups/me'),
  getDashboardGroups: () => api.get<GroupEntity[]>('/api/groups/dashboard'),
  getDashboardGroup: (slug: string) => api.get<GroupEntity>(`/api/groups/${slug}/edit`, createGroupApiHeaders(slug)),
  getBySlug: (slug: string) => api.get<GroupEntity>(`/api/groups/${slug}`, createGroupApiHeaders(slug)),
  getAbout: (slug: string) => api.get<{
    events: EventEntity[],
    groupMembers: GroupMemberEntity[]
  }>(`/api/groups/${slug}/about`, createGroupApiHeaders(slug)),
  getEvents: (slug: string) => api.get<EventEntity[]>(`/api/groups/${slug}/events`, createGroupApiHeaders(slug)),
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
  sendAdminMessage: (slug: string, data: { subject: string, message: string, targetUserIds?: number[] }): Promise<AxiosResponse<{ success: boolean, deliveredCount: number, failedCount: number, messageId: string }>> => api.post(`/api/groups/${slug}/admin-message`, data, createGroupApiHeaders(slug)),
  previewAdminMessage: (slug: string, data: { subject: string, message: string, testEmail: string, targetUserIds?: number[] }): Promise<AxiosResponse<{ message: string }>> => api.post(`/api/groups/${slug}/admin-message/preview`, data, createGroupApiHeaders(slug)),
  contactAdmins: (slug: string, data: { subject: string, message: string, contactType: 'question' | 'report' | 'feedback' }): Promise<AxiosResponse<{ success: boolean, deliveredCount: number, failedCount: number, messageId: string }>> => api.post(`/api/groups/${slug}/contact-admins`, data, createGroupApiHeaders(slug)),
  getFeed: (slug: string, params?: { limit?: number, offset?: number, visibility?: string[] }): Promise<AxiosResponse<ActivityFeedEntity[]>> => api.get(`/api/groups/${slug}/feed`, { ...createGroupApiHeaders(slug), params }),
  getDashboardSummary: (): Promise<AxiosResponse<DashboardGroupsSummaryEntity>> => api.get<DashboardGroupsSummaryEntity>('/api/groups/dashboard/summary'),
  getDashboardGroupsPaginated: (params: { page?: number, limit?: number, role?: 'leader' | 'member' }) => api.get<{
    data: GroupEntity[],
    total: number,
    page: number,
    totalPages: number
  }>('/api/groups/dashboard', { params })
}
