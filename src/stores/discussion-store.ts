import { defineStore } from 'pinia'
import { MatrixMessage } from '../types/matrix'
import { useGroupStore } from './group-store'
import { useEventStore } from './event-store'
import { useAuthStore } from './auth-store'

// Define a custom content type that includes the topic property
interface MatrixMessageContent {
  msgtype: string;
  body: string;
  formatted_body?: string;
  format?: string;
  topic?: string;
  [key: string]: unknown; // Add index signature for unknown properties
}

interface TopicEntity {
  name: string;
}

interface DiscussionState {
  messages: MatrixMessage[]
  topics: TopicEntity[]
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
    messages: [] as MatrixMessage[],
    topics: [] as TopicEntity[],
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

      try {
        // Check if user has Matrix ID
        if (!useAuthStore().user?.matrixUserId) {
          throw new Error('Matrix user ID missing. Please refresh the page and try again.')
        }

        let eventId: string | undefined
        if (this.contextType === 'group') {
          const result = await useGroupStore().actionSendGroupDiscussionMessage(message, topicName)
          eventId = result ? String(result) : undefined
        } else if (this.contextType === 'event') {
          const result = await useEventStore().actionSendEventDiscussionMessage(message, topicName)
          eventId = result ? String(result) : undefined
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
            sender: useAuthStore().user?.matrixUserId,
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
      } catch (err) {
        console.error('Error sending Matrix message:', err)
        throw err
      } finally {
        this.isSending = false
      }
    },

    async actionLoadMessages (limit = 50, from?: string) {
      if (this.contextType === 'event') {
        const result = await useEventStore().actionGetEventDiscussionMessages(limit, from)
        if (result && result.messages) {
          // Process messages and add topic property if not present
          const processedMessages = result.messages.map(message => {
            // Make sure each message has a topic (use 'General' as default)
            if (!message.content.topic) {
              return {
                ...message,
                content: {
                  ...message.content,
                  topic: 'General'
                }
              }
            }
            return message
          })

          // Append or replace messages
          if (from) {
            // Append more messages (pagination)
            this.messages = [...this.messages, ...processedMessages]
          } else {
            // Initial load
            this.messages = processedMessages
          }

          // Extract topics from messages
          const uniqueTopics = new Set<string>()
          this.messages.forEach(message => {
            if (message.content.topic) {
              uniqueTopics.add(message.content.topic)
            }
          })

          // Update topics
          this.topics = [...uniqueTopics].map(name => ({ name }))

          return {
            messages: processedMessages,
            end: result.end
          }
        }
      }
      return {
        messages: [],
        end: ''
      }
    },

    async actionUpdateMessage (eventId: string, newText: string) {
      // Matrix doesn't support message editing directly through our API yet
      // This would be implemented in a future version
      this.isUpdating = false

      // For now, just update the local state
      this.messages = this.messages.map(m => m.event_id === eventId ? {
        ...m,
        content: {
          ...m.content,
          body: newText
        }
      } : m)

      return eventId
    },

    async actionDeleteMessage (eventId: string) {
      // Matrix doesn't support message deletion directly through our API yet
      // This would be implemented in a future version
      this.isDeleting = false

      // For now, just update the local state
      this.messages = this.messages.filter(m => m.event_id !== eventId)

      return eventId
    }
  }
})
