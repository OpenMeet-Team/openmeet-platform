import { defineStore } from 'pinia'
import { ZulipTopicEntity, ZulipMessageEntity } from 'src/types'
import { useGroupStore } from './group-store'
import { useEventStore } from './event-store'
import { useAuthStore } from './auth-store'

interface DiscussionState {
  messages: ZulipMessageEntity[]
  topics: ZulipTopicEntity[]
  contextType: 'event' | 'group' | 'general'
  contextId: string
  permissions: {
    canRead: boolean
    canWrite: boolean
    canManage: boolean
  }
}

export const useDiscussionStore = defineStore('discussion', {
  state: () => ({
    messages: [] as ZulipMessageEntity[],
    topics: [] as ZulipTopicEntity[],
    contextType: 'general' as 'general' | 'group' | 'event',
    contextId: '',
    permissions: {
      canRead: false,
      canWrite: false,
      canManage: false
    },

    isDeleting: false,
    isUpdating: false,
    isReplying: false,
    isSending: false
  }),

  getters: {
    actionSetDiscussionState: (state) => (discussionState: DiscussionState) => {
      state.messages = discussionState.messages
      state.topics = discussionState.topics
      state.permissions = discussionState.permissions
      state.contextType = discussionState.contextType
      state.contextId = discussionState.contextId
    },
    actionSendMessage: (state) => async (message: string, topicName: string) => {
      state.isSending = true

      let messageId: number | undefined
      if (state.contextType === 'group') {
        messageId = await useGroupStore().actionSendGroupDiscussionMessage(message, topicName)
      } else if (state.contextType === 'event') {
        messageId = await useEventStore().actionSendEventDiscussionMessage(message, topicName)
      }

      if (messageId) {
        const topic = state.topics.find(t => t.name === topicName)
        if (topic) {
          state.topics = state.topics.map(t => t.name === topicName ? { ...t, max_id: messageId } : t)
        } else {
          state.topics = [{ name: topicName, max_id: messageId }, ...state.topics]
        }
        state.messages = [{ id: messageId, content: message, subject: topicName, sender_full_name: `${useAuthStore().user?.firstName || ''} ${useAuthStore().user?.lastName || ''}`.trim() || 'Anonymous', sender_id: useAuthStore().user?.zulipUserId || 0, timestamp: Date.now() }, ...state.messages]
      }
      state.isSending = false
    },

    actionUpdateMessage: (state) => async (messageId: number, newText: string) => {
      state.isUpdating = true
      let updatedMessageId: number | undefined
      if (state.contextType === 'group') {
        updatedMessageId = await useGroupStore().actionUpdateGroupDiscussionMessage(messageId, newText)
      } else if (state.contextType === 'event') {
        updatedMessageId = await useEventStore().actionUpdateEventDiscussionMessage(messageId, newText)
      }
      if (updatedMessageId) {
        state.messages = state.messages.map(m => m.id === messageId ? { ...m, content: newText } : m)
      }
      state.isUpdating = false
    },
    actionDeleteMessage: (state) => async (messageId: number) => {
      state.isDeleting = true
      let deletedMessageId: number | undefined
      if (state.contextType === 'group') {
        deletedMessageId = await useGroupStore().actionDeleteGroupDiscussionMessage(messageId)
      } else if (state.contextType === 'event') {
        deletedMessageId = await useEventStore().actionDeleteEventDiscussionMessage(messageId)
      }
      if (deletedMessageId) {
        state.messages = state.messages.filter(m => m.id !== deletedMessageId)
      }
      state.isDeleting = false
    }
  },

  actions: {}
})
