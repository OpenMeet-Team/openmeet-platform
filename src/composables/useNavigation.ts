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

    // Always navigate to the public event page when an event is published
    if (event.status === 'published') {
      console.log('Event is published, redirecting to public event page')
      router.push({ name: 'EventPage', params: { slug: event.slug } })
      return
    }

    // For non-published events, check if we're in dashboard context
    const currentPath = router.currentRoute.value.path
    const isDashboardContext = currentPath.includes('/dashboard')

    // Navigate based on context
    const routeName = isDashboardContext ? 'DashboardEventPage' : 'EventPage'
    router.push({ name: routeName, params: { slug: event.slug } })
  }

  const navigateToMember = (user: UserEntity | string) => {
    console.log(user)
    router.push({ name: 'MemberPage', params: { slug: typeof user === 'string' ? user : user.slug } })
  }

  const navigateToChat = (query: { user?: string, chat?: string }) => {
    router.push({ name: 'MessagesPage', query })
  }

  return {
    navigateToGroup,
    navigateToEvent,
    navigateToMember,
    navigateToChat
  }
}
