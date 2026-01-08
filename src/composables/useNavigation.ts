import { useRouter, type RouteLocationRaw } from 'vue-router'
import { GroupEntity, EventEntity, UserEntity } from '../types'

export function useNavigation () {
  const router = useRouter()

  /**
   * Navigate back using browser history, or to fallback route if no history.
   * @param fallbackRoute - Route to navigate to if no browser history exists
   */
  const goBack = (fallbackRoute: RouteLocationRaw) => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackRoute)
    }
  }

  const navigateToGroup = (group: GroupEntity) => {
    // After creating/updating a group, always navigate to the public view page
    // so the user can see the result of their changes
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
    goBack,
    navigateToGroup,
    navigateToEvent,
    navigateToMember,
    navigateToChat
  }
}
