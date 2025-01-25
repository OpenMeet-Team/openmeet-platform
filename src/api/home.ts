import { api } from '../boot/axios'
import { CategoryEntity, EventEntity, GroupEntity, SubCategoryEntity } from '../types'

interface HomeGuestResponse {
  groups: GroupEntity[]
  events: EventEntity[]
  categories: CategoryEntity[]
  interests: SubCategoryEntity[]
}

interface HomeUserResponse {
  organizedGroups: GroupEntity[]
  nextHostedEvent: EventEntity
  recentEventDrafts: EventEntity[]
  upcomingEvents: EventEntity[]
  memberGroups: GroupEntity[]
  interests: SubCategoryEntity[]
}

export const homeApi = {
  getUserHome: () => api.get<HomeUserResponse>('/api/home/user'),
  getGuestHome: () => api.get<HomeGuestResponse>('/api/home/guest')
}
