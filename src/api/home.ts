import { api } from 'boot/axios.ts'
import { CategoryEntity, EventEntity, GroupEntity, SubCategoryEntity } from 'src/types'

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
