import { defineStore } from 'pinia'
import { useNotification } from '../composables/useNotification'
import { chatApi } from '../api/chat'
import { ChatEntity } from '../types/model'
import { MatrixMessage } from '../types/matrix'
import { RouteQueryAndHash } from 'vue-router'
const { error } = useNotification()

export const useChatStore = defineStore('chat', {
  state: () => ({
    chatList: [] as ChatEntity[],
    activeChat: null as ChatEntity | null,
    isLoading: false,
    isLoadingChat: false,
    isSendingMessage: false
  }),

  getters: {},

  actions: {
    async actionGetChatList (query: RouteQueryAndHash = {}) {
      return await chatApi.getChatList(query).then(res => {
        this.chatList = res.data.chats
        this.activeChat = res.data.chat
      })
    },

    async actionSendMessage (roomId: string, content: string) {
      this.isSendingMessage = true
      try {
        await chatApi.sendMessage(roomId, content).then(() => {
          // The backend will handle the message creation and return the event ID
          // We don't need to manually add the message to the store as it will be fetched
          // in the next message sync
        })
      } catch (err) {
        error('Failed to send message')
      } finally {
        this.isSendingMessage = false
      }
    },

    async actionSetMessagesRead (roomId: string, eventId: string) {
      try {
        await chatApi.setMessagesRead(roomId, eventId)
        // The backend will handle marking messages as read
      } catch (err) {
        error('Failed to set messages read')
      }
    },

    async actionGetMessages (roomId: string, limit: number = 50, from?: string) {
      try {
        const response = await chatApi.getMessages(roomId, limit, from)
        if (this.activeChat) {
          // Append new messages to the existing ones
          this.activeChat.messages = [...this.activeChat.messages, ...response.data.chunk] as MatrixMessage[]
        }
        return response.data
      } catch (err) {
        error('Failed to fetch messages')
        return null
      }
    },

    async actionUpdateMessage (roomId: string, eventId: string, content: string) {
      try {
        await chatApi.updateMessage(roomId, eventId, content)
        // The backend will handle the message update and it will be reflected in the next sync
      } catch (err) {
        error('Failed to update message')
      }
    },

    async actionDeleteMessage (roomId: string, eventId: string) {
      try {
        await chatApi.deleteMessage(roomId, eventId)
        // The backend will handle the message deletion and it will be reflected in the next sync
      } catch (err) {
        error('Failed to delete message')
      }
    }
  }
})
