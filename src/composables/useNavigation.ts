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

    // Determine if we're in dashboard context by checking the current route
    const currentPath = router.currentRoute.value.path
    const isDashboardContext = currentPath.includes('/dashboard')

    // If we're in dashboard context and the event was just published,
    // redirect to the event view page instead of staying in the editor
    if (isDashboardContext && event.status === 'published') {
      console.log('Event was published from dashboard, redirecting to event view page')
      router.push({ name: 'EventPage', params: { slug: event.slug } })
    } else {
      // In other cases, navigate to the appropriate page based on context
      console.log('Navigating to event:', event)
      const routeName = isDashboardContext ? 'DashboardEventPage' : 'EventPage'
      router.push({ name: routeName, params: { slug: event.slug } })
    }
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
