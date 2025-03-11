import { defineStore } from 'pinia'
import { useNotification } from '../composables/useNotification'
import { MatrixMessage } from '../types/matrix'
import { useGroupStore } from './group-store'
import { useEventStore } from './event-store'
import { useAuthStore } from './auth-store'
import { matrixService } from '../services/matrixService'

const { error } = useNotification()

// Typing indicator debounce time (ms)
const TYPING_DEBOUNCE = 2000

export const useMessageStore = defineStore('messages', {
  state: () => ({
    messages: {} as Record<string, MatrixMessage[]>,
    activeRoomId: null as string | null,
    contextType: 'general' as 'general' | 'group' | 'event' | 'direct',
    contextId: '' as string,
    permissions: {
      canRead: false,
      canWrite: false,
      canManage: false
    },
    isLoading: false,
    isSending: false,
    isDeleting: false,
    isUpdating: false,
    typingUsers: {} as Record<string, string[]>, // roomId -> array of userIds who are typing
    typingTimer: null as number | null, // Timer for debouncing typing notifications
    isUserTyping: false, // Whether the current user is typing
    matrixConnected: false, // Whether we're connected to Matrix events
    matrixConnectionAttempted: false // Whether we've tried to connect to Matrix
  }),

  getters: {
    // Get messages for active room
    currentRoomMessages: (state) => {
      if (!state.activeRoomId) return []
      return state.messages[state.activeRoomId] || []
    },

    // Get typing users for the active room
    typingUsersInCurrentRoom: (state) => {
      if (!state.activeRoomId) return []
      return state.typingUsers[state.activeRoomId] || []
    },

    getterPermissions: (state) => state.permissions,
    getterContextId: (state) => state.contextId,
    getterContextType: (state) => state.contextType
  },

  actions: {
    // Set context information
    setContext (roomId: string, contextType: 'general' | 'group' | 'event' | 'direct', contextId: string) {
      this.activeRoomId = roomId
      this.contextType = contextType
      this.contextId = contextId

      // Initialize messages array for this room if it doesn't exist
      if (!this.messages[roomId]) {
        this.messages[roomId] = []
      }
    },

    // Set permissions
    setPermissions (permissions: { canRead: boolean, canWrite: boolean, canManage: boolean }) {
      this.permissions = permissions
    },

    // Initialize Matrix connection
    async initializeMatrix () {
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
          this.addNewMessage(event as unknown as MatrixMessage)
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
    addNewMessage (message: MatrixMessage) {
      if (!message || !message.room_id || !message.event_id) return

      // Initialize room messages if needed
      if (!this.messages[message.room_id]) {
        this.messages[message.room_id] = []
      }

      // Add the message to the messages array if it doesn't already exist
      if (!this.messages[message.room_id].some(m => m.event_id === message.event_id)) {
        this.messages[message.room_id].push(message)

        // Sort messages by timestamp
        this.messages[message.room_id].sort((a, b) => a.origin_server_ts - b.origin_server_ts)
      }
    },

    // Send typing indicator status
    async sendTyping (roomId: string, isTyping: boolean) {
      try {
        // Don't send duplicate typing notifications
        if (this.isUserTyping === isTyping) return

        // Update state
        this.isUserTyping = isTyping

        // Send typing status to server
        await matrixService.sendTyping(roomId, isTyping)

        // Clear any existing timer
        if (this.typingTimer) {
          window.clearTimeout(this.typingTimer)
          this.typingTimer = null
        }

        // If typing, set a timer to automatically clear typing status
        if (isTyping) {
          this.typingTimer = window.setTimeout(() => {
            this.sendTyping(roomId, false).catch(console.error)
          }, TYPING_DEBOUNCE)
        }
      } catch (err) {
        console.error('Failed to send typing indicator:', err)
      }
    },

    // Load messages for a room
    async loadMessages (limit = 50, from?: string) {
      if (!this.activeRoomId) return { messages: [], end: '' }

      this.isLoading = true
      try {
        let result: { messages: MatrixMessage[], end: string }

        // Use different API methods based on context type
        if (this.contextType === 'event') {
          result = await useEventStore().actionGetEventDiscussionMessages(limit, from)
        } else if (this.contextType === 'group') {
          result = await useGroupStore().actionGetGroupDiscussionMessages(limit, from)
        } else {
          // Direct messages or other types
          result = await matrixService.getMessages(this.activeRoomId, limit, from)
        }

        // Process and store messages
        if (result && result.messages) {
          if (from) {
            // Append new messages (pagination)
            this.messages[this.activeRoomId] = [...this.messages[this.activeRoomId], ...result.messages]
          } else {
            // Initial load
            this.messages[this.activeRoomId] = result.messages
          }

          // Sort messages by timestamp
          this.messages[this.activeRoomId].sort((a, b) => a.origin_server_ts - b.origin_server_ts)
        }

        return result
      } catch (err) {
        console.error('Error loading messages:', err)
        return { messages: [], end: '' }
      } finally {
        this.isLoading = false
      }
    },

    // Send a message
    async sendMessage (message: string) {
      if (!this.activeRoomId || !this.permissions.canWrite) {
        throw new Error('Cannot send message: no active room or insufficient permissions')
      }

      this.isSending = true
      try {
        // Clear any typing indicator first
        await this.sendTyping(this.activeRoomId, false)

        // Check if user has Matrix ID
        if (!useAuthStore().user?.matrixUserId) {
          throw new Error('Matrix user ID missing. Please refresh the page and try again.')
        }

        let eventId: string | undefined

        // Use different methods based on context type
        if (this.contextType === 'group') {
          const result = await useGroupStore().actionSendGroupDiscussionMessage(message)
          eventId = result ? String(result) : undefined
        } else if (this.contextType === 'event') {
          const result = await useEventStore().actionSendEventDiscussionMessage(message)
          eventId = result ? String(result) : undefined
        } else {
          // Direct messages or other types
          const result = await matrixService.sendMessage(this.activeRoomId, message)
          eventId = result ? String(result) : undefined
        }

        if (eventId) {
          // Create optimistic message
          const currentUser = useAuthStore().user
          const displayName = currentUser
            ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || currentUser.email?.split('@')[0] || 'OpenMeet User'
            : 'OpenMeet User'

          const newMessage: MatrixMessage = {
            event_id: eventId,
            room_id: this.activeRoomId,
            sender: useAuthStore().user?.matrixUserId,
            sender_name: displayName, // Add OpenMeet username
            content: {
              msgtype: 'm.text',
              body: message
            },
            origin_server_ts: Date.now(),
            type: 'm.room.message'
          }

          // Add to message list
          if (!this.messages[this.activeRoomId]) {
            this.messages[this.activeRoomId] = []
          }
          this.messages[this.activeRoomId].push(newMessage)

          // Sort messages by timestamp
          this.messages[this.activeRoomId].sort((a, b) => a.origin_server_ts - b.origin_server_ts)
        }

        return eventId
      } catch (err) {
        console.error('Error sending message:', err)
        error('Failed to send message')
        throw err
      } finally {
        this.isSending = false
      }
    },

    // Update a message
    async updateMessage (eventId: string, newText: string) {
      // Matrix doesn't fully support message editing through our API yet
      this.isUpdating = false

      // Update the local state for now
      if (this.activeRoomId) {
        this.messages[this.activeRoomId] = this.messages[this.activeRoomId].map(m =>
          m.event_id === eventId ? {
            ...m,
            content: {
              ...m.content,
              body: newText
            }
          } : m
        )
      }

      return eventId
    },

    // Delete a message
    async deleteMessage (eventId: string) {
      // Matrix doesn't fully support message deletion through our API yet
      this.isDeleting = false

      // Update the local state for now
      if (this.activeRoomId) {
        this.messages[this.activeRoomId] = this.messages[this.activeRoomId].filter(m =>
          m.event_id !== eventId
        )
      }

      return eventId
    },

    // Cleanup when component unmounts
    cleanup () {
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
