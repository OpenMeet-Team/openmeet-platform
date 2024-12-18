import { useRouter } from 'vue-router'
import { GroupEntity, EventEntity, UserEntity } from 'src/types'

export function useNavigation () {
  const router = useRouter()

  const navigateToGroup = (group: GroupEntity) => {
    router.push({ name: 'GroupPage', params: { slug: group.slug } })
  }

  const navigateToEvent = (event: EventEntity) => {
    router.push({ name: 'EventPage', params: { slug: event.slug } })
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
