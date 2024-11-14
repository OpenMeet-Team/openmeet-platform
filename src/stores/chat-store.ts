import { defineStore } from 'pinia'
import { useNotification } from 'src/composables/useNotification.ts'
import { chatApi } from 'src/api/chat'
import { ChatEntity, ChatMessageEntity } from 'src/types/model'
const { error } = useNotification()

export const useChatStore = defineStore('chat', {
  state: () => ({
    chatList: [] as ChatEntity[],
    chat: null as ChatEntity | null,
    isLoading: false,
    isLoadingChat: false,
    isSendingMessage: false
  }),

  getters: {},

  actions: {
    async actionGetChatList () {
      this.isLoading = true

      try {
        const res = await chatApi.getChatList()
        this.chatList = res.data
      } catch (err) {
        error('Failed to get chat list')
      } finally {
        this.isLoading = false
      }
    },

    async actionGetChatByUserUlid (userUlid: string) {
      this.isLoadingChat = true
      try {
        const res = await chatApi.getChatByUserUlid(userUlid)
        this.chat = res.data
        if (!this.chatList.find(chat => chat.ulid === this.chat?.ulid)) {
          this.chatList.push(this.chat as ChatEntity)
        }
      } catch (err) {
        error('Failed to get chat')
      } finally {
        this.isLoadingChat = false
      }
    },

    async actionGetChatByUlid (ulid: string) {
      this.isLoadingChat = true
      try {
        const res = await chatApi.getChatByUlid(ulid)
        this.chat = res.data
        if (!this.chatList.find(chat => chat.ulid === this.chat?.ulid)) {
          this.chatList.push(this.chat as ChatEntity)
        }
      } catch (err) {
        error('Failed to get chat')
      } finally {
        this.isLoadingChat = false
      }
    },

    async actionSendMessage (chatUlid: string, data: { content: string, sender_id: number, sender_full_name: string, timestamp: number }) {
      this.isSendingMessage = true
      try {
        await chatApi.sendMessage(chatUlid, data.content).then((res) => {
          this.chat?.messages.push({
            id: res.data.id,
            ...data
          } as ChatMessageEntity)
        })
      } catch (err) {
        error('Failed to send message')
      } finally {
        this.isSendingMessage = false
      }
    }
  }
})
