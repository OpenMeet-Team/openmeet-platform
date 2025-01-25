import { defineStore } from 'pinia'
import { useNotification } from '../composables/useNotification'
import { chatApi } from '../api/chat'
import { ChatEntity } from '../types/model'
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

    async actionSendMessage (chatUlid: string, data: { content: string, sender_id: number, sender_full_name: string, timestamp: number }) {
      this.isSendingMessage = true
      try {
        await chatApi.sendMessage(chatUlid, data.content).then((res) => {
          this.activeChat?.messages.push({
            id: res.data.id,
            ...data
          })
        })
      } catch (err) {
        error('Failed to send message')
      } finally {
        this.isSendingMessage = false
      }
    },

    async actionSetMessagesRead (messageIds: number[]) {
      try {
        await chatApi.setMessagesRead(messageIds).then(res => {
          if (this.activeChat && this.activeChat.messages) {
            this.activeChat.messages = this.activeChat.messages.map(message => {
              if (res.data.messages.includes(message.id)) {
                return { ...message, flags: ['read'] }
              }
              return message
            })
          }
        })
      } catch (err) {
        error('Failed to set messages read')
      }
    }
  }
})
