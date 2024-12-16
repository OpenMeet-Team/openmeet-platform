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
    contextId: '' as string,
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
    getterMessages: (state) => state.messages,
    getterTopics: (state) => state.topics,
    getterPermissions: (state) => state.permissions,
    getterContextId: (state) => state.contextId,
    getterContextType: (state) => state.contextType
  },
  actions: {
    actionSetDiscussionState (discussionState: DiscussionState) {
      this.messages = discussionState.messages
      this.topics = discussionState.topics
      this.permissions = discussionState.permissions
      this.contextId = discussionState.contextId
      this.contextType = discussionState.contextType ?? 'general'
    },
    async actionSendMessage (message: string, topicName: string) {
      this.isSending = true

      let messageId: number | undefined
      if (this.contextType === 'group') {
        messageId = await useGroupStore().actionSendGroupDiscussionMessage(message, topicName)
      } else if (this.contextType === 'event') {
        messageId = await useEventStore().actionSendEventDiscussionMessage(message, topicName)
      }

      if (messageId) {
        const topic = this.topics.find(t => t.name === topicName)
        if (topic) {
          this.topics = this.topics.map(t => t.name === topicName ? { ...t, max_id: messageId } : t)
        } else {
          this.topics = [{ name: topicName, max_id: messageId }, ...this.topics]
        }
        this.messages = [{ id: messageId, content: message, subject: topicName, sender_full_name: `${useAuthStore().user?.firstName || ''} ${useAuthStore().user?.lastName || ''}`.trim() || 'Anonymous', sender_id: useAuthStore().user?.zulipUserId || 0, timestamp: Date.now() }, ...this.messages]
      }
      this.isSending = false
    },

    async actionUpdateMessage (messageId: number, newText: string) {
      this.isUpdating = true
      let updatedMessageId: number | undefined
      if (this.contextType === 'group') {
        updatedMessageId = await useGroupStore().actionUpdateGroupDiscussionMessage(messageId, newText)
      } else if (this.contextType === 'event') {
        updatedMessageId = await useEventStore().actionUpdateEventDiscussionMessage(messageId, newText)
      }
      if (updatedMessageId) {
        this.messages = this.messages.map(m => m.id === messageId ? { ...m, content: newText } : m)
      }
      this.isUpdating = false
    },
    async actionDeleteMessage (messageId: number) {
      this.isDeleting = true
      let deletedMessageId: number | undefined
      if (this.contextType === 'group') {
        deletedMessageId = await useGroupStore().actionDeleteGroupDiscussionMessage(messageId)
      } else if (this.contextType === 'event') {
        deletedMessageId = await useEventStore().actionDeleteEventDiscussionMessage(messageId)
      }
      if (deletedMessageId) {
        this.messages = this.messages.filter(m => m.id !== deletedMessageId)
      }
      this.isDeleting = false
    }
  }
})
