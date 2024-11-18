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

  const navigateToMember = (ulid: string) => {
    router.push({ name: 'MemberPage', params: { ulid } })
  }

  const navigateToChat = (query: { member?: string, user?: string, chat?: string }) => {
    router.push({ name: 'MessagesPage', query })
  }

  return {
    navigateToGroup,
    navigateToEvent,
    navigateToMember,
    navigateToChat
  }
}
