import { defineStore } from 'pinia'
import { MatrixMessage } from '../types/matrix'
import { useGroupStore } from './group-store'
import { useEventStore } from './event-store'
import { useAuthStore } from './auth-store'

interface DiscussionState {
  messages: MatrixMessage[]
  topics: { name: string }[]
  contextType: 'event' | 'group' | 'general'
  contextId: string
  permissions: {
    canRead: boolean
    canWrite: boolean
    canManage: boolean
  }
}

// Define a custom content type that includes the topic property
interface MatrixMessageContent {
  msgtype: string
  body: string
  formatted_body?: string
  format?: string
  topic?: string
}

export const useDiscussionStore = defineStore('discussion', {
  state: () => ({
    messages: [] as MatrixMessage[],
    topics: [] as { name: string }[],
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

      let eventId: string | undefined
      if (this.contextType === 'group') {
        eventId = await useGroupStore().actionSendGroupDiscussionMessage(message, topicName)
      } else if (this.contextType === 'event') {
        eventId = await useEventStore().actionSendEventDiscussionMessage(message, topicName)
      }

      if (eventId) {
        const topic = this.topics.find(t => t.name === topicName)
        if (!topic) {
          this.topics = [{ name: topicName }, ...this.topics]
        }

        // Create a new Matrix message
        const newMessage: MatrixMessage = {
          event_id: eventId,
          room_id: this.contextId,
          sender: useAuthStore().user?.matrixUserId || '',
          content: {
            msgtype: 'm.text',
            body: message,
            // Add topic as a custom property
            topic: topicName
          } as MatrixMessageContent,
          origin_server_ts: Date.now(),
          type: 'm.room.message'
        }

        this.messages = [newMessage, ...this.messages]
      }
      this.isSending = false
    },

    async actionUpdateMessage (eventId: string, newText: string) {
      this.isUpdating = true
      let updatedEventId: string | undefined
      if (this.contextType === 'group') {
        updatedEventId = await useGroupStore().actionUpdateGroupDiscussionMessage(eventId, newText)
      } else if (this.contextType === 'event') {
        updatedEventId = await useEventStore().actionUpdateEventDiscussionMessage(eventId, newText)
      }
      if (updatedEventId) {
        this.messages = this.messages.map(m => m.event_id === eventId ? {
          ...m,
          content: {
            ...m.content,
            body: newText
          }
        } : m)
      }
      this.isUpdating = false
    },

    async actionDeleteMessage (eventId: string) {
      this.isDeleting = true
      let deletedEventId: string | undefined
      if (this.contextType === 'group') {
        deletedEventId = await useGroupStore().actionDeleteGroupDiscussionMessage(eventId)
      } else if (this.contextType === 'event') {
        deletedEventId = await useEventStore().actionDeleteEventDiscussionMessage(eventId)
      }
      if (deletedEventId) {
        this.messages = this.messages.filter(m => m.event_id !== deletedEventId)
      }
      this.isDeleting = false
    }
  }
})
