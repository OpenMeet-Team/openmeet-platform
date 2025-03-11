import { defineStore } from 'pinia'
import { useNotification } from '../composables/useNotification'
import { chatApi } from '../api/chat'
import { ChatEntity } from '../types/model'
import { MatrixMessage } from '../types/matrix'
import { RouteQueryAndHash } from 'vue-router'
import { matrixService } from '../services/matrixService'
const { error } = useNotification()

// Typing indicator debounce time (ms)
const TYPING_DEBOUNCE = 2000

export const useChatStore = defineStore('chat', {
  state: () => ({
    chatList: [] as ChatEntity[],
    activeChat: null as ChatEntity | null,
    isLoading: false,
    isLoadingChat: false,
    isSendingMessage: false,
    typingUsers: {} as Record<string, string[]>, // roomId -> array of userIds who are typing
    typingTimer: null as number | null, // Timer for debouncing typing notifications
    isUserTyping: false, // Whether the current user is typing
    matrixConnected: false, // Whether we're connected to Matrix events
    matrixConnectionAttempted: false // Whether we've tried to connect to Matrix
  }),

  getters: {
    // Get typing users for the active chat
    getActiveTypingUsers: (state) => {
      if (!state.activeChat || !state.activeChat.roomId) return []
      return state.typingUsers[state.activeChat.roomId] || []
    }
  },

  actions: {
    // Initialize the store and connect to Matrix events
    async actionInitializeMatrix () {
      // Don't try to connect again if we've already attempted
      if (this.matrixConnectionAttempted) return this.matrixConnected

      this.matrixConnectionAttempted = true

      try {
        // Connect to Matrix events service
        const success = await matrixService.connect()
        this.matrixConnected = success

        if (success) {
          console.log('Successfully connected to Matrix events')

          // Add event handler for Matrix events
          matrixService.addEventHandler(this.handleMatrixEvent.bind(this))
        } else {
          console.error('Failed to connect to Matrix events')
        }

        return success
      } catch (err) {
        console.error('Error initializing Matrix connection:', err)
        return false
      }
    },

    // Handle Matrix events from SSE
    handleMatrixEvent (event: Record<string, unknown>) {
      if (!event || !event.type) return

      try {
        // Handle different event types
        if (event.type === 'm.typing') {
          this.updateTypingUsers(
            event.room_id as string,
            event.user_ids as string[]
          )
        } else if (event.type === 'm.room.message') {
          this.addNewMessage(event as Record<string, unknown>)
        }
      } catch (err) {
        console.error('Error handling Matrix event:', err)
      }
    },

    // Update typing users for a room
    updateTypingUsers (roomId: string, userIds: string[]) {
      if (!roomId || !Array.isArray(userIds)) return
      this.typingUsers[roomId] = userIds
    },

    // Add a new message from real-time events
    addNewMessage (message: Record<string, unknown>) {
      if (!message || !message.room_id || !message.event_id) return

      // Update active chat if this message is for it
      if (this.activeChat && this.activeChat.roomId === message.room_id) {
        // Add the message to the messages array if it doesn't already exist
        const messages = this.activeChat.messages || []
        if (!messages.some(m => m.id === message.event_id)) {
          // Handle content with appropriate type checking
          const content = message.content && typeof message.content === 'object' && 'body' in message.content &&
            typeof message.content.body === 'string' ? message.content.body : 'Message'

          // Handle sender with appropriate type checking
          const sender = message.sender && typeof message.sender === 'string' ? message.sender : '@unknown:matrix.org'
          const senderName = sender.split(':')[0].substring(1) // Extract username from @username:server.com

          // Handle timestamp with appropriate type checking
          const timestamp = message.origin_server_ts && typeof message.origin_server_ts === 'number'
            ? Math.floor(message.origin_server_ts / 1000) : Math.floor(Date.now() / 1000)

          this.activeChat.messages.push({
            id: message.event_id,
            content,
            sender_id: sender,
            sender_full_name: senderName,
            timestamp
          })
        }
      }
    },

    // Action to add a Matrix message (used by the matrix service)
    actionAddMessage (message: MatrixMessage) {
      this.addNewMessage(message)
    },

    // Send typing indicator status
    async actionSendTyping (roomId: string, isTyping: boolean) {
      try {
        // Don't send duplicate typing notifications
        if (this.isUserTyping === isTyping) return

        // Update state
        this.isUserTyping = isTyping

        // Send typing status to server
        if (chatApi.sendTyping) {
          await chatApi.sendTyping(roomId, isTyping)
        }

        // Clear any existing timer
        if (this.typingTimer) {
          window.clearTimeout(this.typingTimer)
          this.typingTimer = null
        }

        // If typing, set a timer to automatically clear typing status
        if (isTyping) {
          this.typingTimer = window.setTimeout(() => {
            this.actionSendTyping(roomId, false).catch(console.error)
          }, TYPING_DEBOUNCE)
        }
      } catch (err) {
        console.error('Failed to send typing indicator:', err)
      }
    },

    async actionGetChatList (query: RouteQueryAndHash = {}) {
      // Try to initialize Matrix connection if not already connected
      if (!this.matrixConnected && !this.matrixConnectionAttempted) {
        await this.actionInitializeMatrix()
      }

      return await chatApi.getChatList(query).then(res => {
        this.chatList = res.data.chats
        this.activeChat = res.data.chat
      })
    },

    async actionSendMessage (chatUlid: string, data: { content: string, sender_id: number, sender_full_name: string, timestamp: number }) {
      this.isSendingMessage = true
      try {
        // Clear any typing indicator first
        if (this.activeChat?.roomId) {
          await this.actionSendTyping(this.activeChat.roomId, false)
        }

        // Send the message
        await chatApi.sendMessage(chatUlid, data.content).then((res) => {
          // Add the message to the local state
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
    },

    // Cleanup when component unmounts
    actionCleanup () {
      // Clear any typing timer
      if (this.typingTimer) {
        window.clearTimeout(this.typingTimer)
        this.typingTimer = null
      }

      // Reset typing state
      this.isUserTyping = false

      // Don't disconnect from Matrix as it might be used by other components
    }
  }
})
