import { useRouter } from 'vue-router'
import { GroupEntity, EventEntity, UserEntity } from '../types'

export function useNavigation () {
  const router = useRouter()

  const navigateToGroup = (group: GroupEntity) => {
    router.push({ name: 'GroupPage', params: { slug: group.slug } })
  }

  const navigateToEvent = (event: EventEntity) => {
    if (!event || !event.slug) {
      return
    }

    // Draft events always go to edit page (they can't be viewed publicly)
    if (event.status === 'draft') {
      router.push({ name: 'DashboardEventPage', params: { slug: event.slug } })
      return
    }

    // Published and cancelled events go to public view page
    router.push({ name: 'EventPage', params: { slug: event.slug } })
  }

  const navigateToMember = (user: UserEntity | string) => {
    router.push({ name: 'MemberPage', params: { slug: typeof user === 'string' ? user : user.slug } })
  }

  const navigateToChat = (query: { user?: string, chat?: string }) => {
    router.push({ name: 'DashboardChatsPage', query })
  }

  return {
    navigateToGroup,
    navigateToEvent,
    navigateToMember,
    navigateToChat
  }
}
