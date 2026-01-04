import { useRouter } from 'vue-router'
import { GroupEntity, EventEntity, UserEntity } from '../types'

export function useNavigation () {
  const router = useRouter()

  const navigateToGroup = (group: GroupEntity) => {
    router.push({ name: 'GroupPage', params: { slug: group.slug } })
  }

  const navigateToEvent = (event: EventEntity) => {
    console.log('Navigating to event:', event)
    if (!event || !event.slug) {
      console.error('Cannot navigate to event: missing event or slug property', event)
      return
    }

    // Draft events always go to edit page (they can't be viewed publicly)
    if (event.status === 'draft') {
      console.log('Event is draft, redirecting to edit page')
      router.push({ name: 'DashboardEventPage', params: { slug: event.slug } })
      return
    }

    // Published and cancelled events go to public view page
    router.push({ name: 'EventPage', params: { slug: event.slug } })
  }

  const navigateToMember = (user: UserEntity | string) => {
    console.log(user)
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
