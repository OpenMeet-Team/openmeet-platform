import { computed, ComputedRef } from 'vue'
import { useAuthStore } from '../stores/auth-store'
import { EventEntity } from '../types/event'
import { GroupEntity } from '../types/group'
import { MatrixMessage } from '../types/matrix'
import {
  canRedactEventMessage,
  canRedactGroupMessage,
  getRedactionReasonPrompt,
  getRedactionConfirmationMessage
} from '../utils/chat-permissions'

/**
 * Composable for chat permissions
 *
 * Provides reactive permission checking for chat actions
 */
export function useChatPermissions () {
  const authStore = useAuthStore()

  /**
   * Create permission checkers for an event context
   */
  function useEventChatPermissions (event: ComputedRef<EventEntity | null>) {
    return {
      canRedactMessage: (message: MatrixMessage): ComputedRef<boolean> =>
        computed(() => {
          const currentUser = authStore.getUser
          const currentEvent = event.value

          if (!currentUser || !currentEvent || !message) {
            return false
          }

          return canRedactEventMessage(currentUser, message, currentEvent)
        }),

      getRedactionReasonPrompt: (message: MatrixMessage): ComputedRef<string> =>
        computed(() => {
          const currentUser = authStore.getUser
          if (!currentUser || !message) {
            return 'Reason for removing this message:'
          }
          return getRedactionReasonPrompt(currentUser, message)
        }),

      getRedactionConfirmationMessage: (message: MatrixMessage): ComputedRef<string> =>
        computed(() => {
          const currentUser = authStore.getUser
          if (!currentUser || !message) {
            return 'Are you sure you want to remove this message?'
          }
          return getRedactionConfirmationMessage(currentUser, message)
        })
    }
  }

  /**
   * Create permission checkers for a group context
   */
  function useGroupChatPermissions (group: ComputedRef<GroupEntity | null>) {
    return {
      canRedactMessage: (message: MatrixMessage): ComputedRef<boolean> =>
        computed(() => {
          const currentUser = authStore.getUser
          const currentGroup = group.value

          if (!currentUser || !currentGroup || !message) {
            return false
          }

          return canRedactGroupMessage(currentUser, message, currentGroup)
        }),

      getRedactionReasonPrompt: (message: MatrixMessage): ComputedRef<string> =>
        computed(() => {
          const currentUser = authStore.getUser
          if (!currentUser || !message) {
            return 'Reason for removing this message:'
          }
          return getRedactionReasonPrompt(currentUser, message)
        }),

      getRedactionConfirmationMessage: (message: MatrixMessage): ComputedRef<string> =>
        computed(() => {
          const currentUser = authStore.getUser
          if (!currentUser || !message) {
            return 'Are you sure you want to remove this message?'
          }
          return getRedactionConfirmationMessage(currentUser, message)
        })
    }
  }

  return {
    useEventChatPermissions,
    useGroupChatPermissions
  }
}

/**
 * Standalone permission checking functions (for non-reactive usage)
 */
export function checkChatPermissions () {
  const authStore = useAuthStore()

  return {
    canRedactEventMessage: (message: MatrixMessage, event: EventEntity): boolean => {
      const user = authStore.getUser
      if (!user) return false
      return canRedactEventMessage(user, message, event)
    },

    canRedactGroupMessage: (message: MatrixMessage, group: GroupEntity): boolean => {
      const user = authStore.getUser
      if (!user) return false
      return canRedactGroupMessage(user, message, group)
    }
  }
}
