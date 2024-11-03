import { useRouter } from 'vue-router'
import { encodeNumberToLowercaseString } from 'src/utils/encoder.ts'

export function useNavigation () {
  const router = useRouter()

  const navigateToGroup = (slug: string, id: number) => {
    const groupId = encodeNumberToLowercaseString(id)
    router.push({ name: 'GroupPage', params: { slug, id: groupId } })
  }

  const navigateToEvent = (slug: string, id: number) => {
    const eventId = encodeNumberToLowercaseString(id)
    router.push({ name: 'EventPage', params: { slug, id: eventId } })
  }

  const navigateToMember = (userId: number) => {
    router.push({ name: 'MemberPage', params: { id: userId } })
  }

  const navigateToChat = (query: { member: string }) => {
    router.push({ name: 'MessagesPage', query })
  }

  return {
    navigateToGroup,
    navigateToEvent,
    navigateToMember,
    navigateToChat
  }
}
