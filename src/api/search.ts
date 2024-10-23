import { api } from 'boot/axios.ts'

import { EventEntity, GroupEntity } from 'src/types'

interface SearchResultEntity {
  events: EventEntity[]
  groups: GroupEntity[]
}

export const searchApi = {
  searchAll: (query: {q: string}) => api.get<SearchResultEntity>('/api/search', { params: query }),
  searchEvents: (query: {q: string}) => api.get<EventEntity[]>('/api/search/events', { params: query }),
  searchGroups: (query: {q: string}) => api.get<GroupEntity[]>('/api/search/groups', { params: query })
}
