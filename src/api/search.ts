import { api } from 'boot/axios.ts'

import { EventEntity, GroupEntity } from 'src/types'

interface SearchEvents {
  data: { name: string, slug: string }[]
  page: number
  totalPages: number
  total: number
}

interface SearchGroups {
  data: { name: string, slug: string }[]
  page: number
  totalPages: number
  total: number
}

interface SearchResultEntity {
  events: SearchEvents
  groups: SearchGroups
}

export const searchApi = {
  searchAll: (query: {search: string, page: number, limit: number}) => api.get<SearchResultEntity>('/api/home/search', { params: query }),
  searchEvents: (query: {search: string, page: number, limit: number}) => api.get<EventEntity[]>('/api/search/events', { params: query }),
  searchGroups: (query: {search: string, page: number, limit: number}) => api.get<GroupEntity[]>('/api/search/groups', { params: query })
}
